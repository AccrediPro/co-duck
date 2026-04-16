/**
 * @fileoverview Database Schema for Coaching Platform
 *
 * This file defines the complete PostgreSQL database schema using Drizzle ORM.
 * The platform connects coaches with clients for 1:1 and group coaching sessions.
 *
 * ## Schema Overview
 *
 * The database is organized around these core entities:
 * - **Users**: All platform users (admins, coaches, clients) authenticated via Clerk
 * - **Coach Profiles**: Extended profile data for users with the 'coach' role
 * - **Availability**: Weekly schedules and date-specific overrides for coaches
 * - **Bookings**: Scheduled coaching sessions between coaches and clients
 * - **Transactions**: Payment records via Stripe Connect
 * - **Messaging**: Conversations and messages between coaches and clients
 * - **Session Notes**: Private coach notes for each session
 * - **Action Items**: Tasks assigned by coaches to clients
 *
 * ## Entity Relationships (ERD Overview)
 *
 * ```
 * users (1) ──────── (1) coach_profiles
 *   │                        │
 *   │                        ├── (1:N) coach_availability
 *   │                        └── (1:N) availability_overrides
 *   │
 *   ├── (1:N as coach) ─┬── bookings ──── (1:1) session_notes
 *   │                   │      │
 *   └── (1:N as client) ┘      └── (1:N) transactions
 *
 *   ├── (1:N as coach) ─┬── conversations ── (1:N) messages
 *   │                   │
 *   └── (1:N as client) ┘
 *
 *   ├── (1:N as coach) ─┬── action_items
 *   │                   │
 *   └── (1:N as client) ┘
 * ```
 *
 * ## Key Design Decisions
 *
 * 1. **Clerk Integration**: User IDs are text (Clerk user IDs), not auto-generated
 * 2. **Soft Deletes**: Bookings track cancellation metadata instead of hard delete
 * 3. **JSONB for Flexibility**: Session types and specialties use JSONB for flexibility
 * 4. **Monetary Values**: All amounts stored in CENTS (integer) to avoid float precision issues
 * 5. **Timestamps**: All timestamps include timezone (timestamptz)
 * 6. **Cascade Deletes**: Foreign keys cascade delete to maintain referential integrity
 *
 * @module db/schema
 * @see {@link https://orm.drizzle.team/docs/overview} Drizzle ORM Documentation
 */

import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  time,
  date,
  serial,
  unique,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * User Role Enum
 *
 * Defines the three types of users in the platform.
 *
 * @enum {string}
 * @property {'admin'} admin - Platform administrators with full access
 * @property {'coach'} coach - Coaches who offer coaching services (requires coach_profiles record)
 * @property {'client'} client - Clients who book sessions with coaches (default role)
 *
 * @remarks
 * - New users from Clerk webhook default to 'client' role
 * - Users become 'coach' by completing the onboarding flow
 * - Role is managed by the application, NOT synced from Clerk
 */
export const userRoleEnum = pgEnum('user_role', ['admin', 'coach', 'client']);

/**
 * Booking Status Enum
 *
 * Tracks the lifecycle state of a coaching session booking.
 *
 * @enum {string}
 * @property {'pending'} pending - Booking created, awaiting payment confirmation
 * @property {'confirmed'} confirmed - Payment successful, session scheduled
 * @property {'completed'} completed - Session has occurred and been marked complete
 * @property {'cancelled'} cancelled - Session was cancelled (see cancelledBy for who)
 * @property {'no_show'} no_show - Client did not attend the scheduled session
 *
 * @remarks
 * State transitions:
 * - pending → confirmed (Stripe webhook: checkout.session.completed)
 * - pending → cancelled (Stripe webhook: checkout.session.expired OR user cancellation)
 * - confirmed → completed (Coach marks session complete)
 * - confirmed → cancelled (Coach or client cancels; triggers refund)
 * - confirmed → no_show (Coach marks client as no-show)
 */
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

/**
 * Transaction Status Enum
 *
 * Tracks the payment lifecycle for a booking transaction.
 *
 * @enum {string}
 * @property {'pending'} pending - Payment initiated, awaiting confirmation
 * @property {'succeeded'} succeeded - Payment successful, funds captured
 * @property {'failed'} failed - Payment failed (card declined, etc.)
 * @property {'refunded'} refunded - Payment refunded (full or partial)
 *
 * @remarks
 * - Platform fee (10%) is calculated at transaction creation
 * - Coach receives 90% via Stripe Connect destination charges
 * - Refunds update refundAmountCents; status becomes 'refunded' on full refund
 */
export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

/**
 * Message Type Enum
 *
 * Distinguishes between user messages and system-generated messages.
 *
 * @enum {string}
 * @property {'text'} text - Regular message sent by a user
 * @property {'system'} system - System-generated message (e.g., "Session booked")
 */
export const messageTypeEnum = pgEnum('message_type', ['text', 'system']);

/**
 * Coach Verification Status Enum
 *
 * Tracks the admin verification status of a coach profile.
 *
 * @enum {string}
 * @property {'pending'} pending - Coach has not been verified yet (default)
 * @property {'verified'} verified - Coach has been verified by an admin
 * @property {'rejected'} rejected - Coach verification was rejected
 *
 * @remarks
 * Verified coaches display a badge on their profile.
 * Admin can change status via the admin dashboard.
 */
export const verificationStatusEnum = pgEnum('verification_status', [
  'pending',
  'verified',
  'rejected',
]);

/**
 * Program Status Enum
 *
 * Tracks the lifecycle of a coaching program.
 *
 * @enum {string}
 * @property {'active'} active - Program is currently in progress
 * @property {'completed'} completed - Program has been finished
 * @property {'archived'} archived - Program is archived (no longer active)
 */
export const programStatusEnum = pgEnum('program_status', ['active', 'completed', 'archived']);

/**
 * Goal Status Enum
 *
 * Tracks the progress of a coaching goal.
 *
 * @enum {string}
 * @property {'pending'} pending - Goal not yet started
 * @property {'in_progress'} in_progress - Goal is being worked on
 * @property {'completed'} completed - Goal has been achieved
 */
export const goalStatusEnum = pgEnum('goal_status', ['pending', 'in_progress', 'completed']);

/**
 * Goal Priority Enum
 *
 * Defines the urgency level of a coaching goal.
 *
 * @enum {string}
 * @property {'low'} low - Low priority
 * @property {'medium'} medium - Medium priority (default)
 * @property {'high'} high - High priority
 */
export const goalPriorityEnum = pgEnum('goal_priority', ['low', 'medium', 'high']);

/**
 * iConnect Post Type Enum
 *
 * Distinguishes between types of posts in the iConnect feed.
 *
 * @enum {string}
 * @property {'text'} text - Text-only post
 * @property {'image'} image - Image post (may include text caption)
 * @property {'task'} task - Task post with checklist items
 */
export const iconnectPostTypeEnum = pgEnum('iconnect_post_type', ['text', 'image', 'task']);

/**
 * Check-In Mood Enum
 *
 * Client self-reported mood during weekly check-ins.
 *
 * @enum {string}
 * @property {'good'} good - Client feels positive
 * @property {'okay'} okay - Client feels neutral
 * @property {'struggling'} struggling - Client is having difficulties
 */
export const checkInMoodEnum = pgEnum('check_in_mood', ['good', 'okay', 'struggling']);

/**
 * Streak Action Type Enum
 *
 * Qualifying actions that count toward a client's coaching streak.
 *
 * @enum {string}
 * @property {'session_completed'} session_completed - Completed a coaching session
 * @property {'action_item_completed'} action_item_completed - Completed an action item
 * @property {'iconnect_post'} iconnect_post - Posted in iConnect workspace
 * @property {'message_sent'} message_sent - Sent a message to coach
 * @property {'check_in_completed'} check_in_completed - Completed a weekly check-in
 * @property {'session_prep_completed'} session_prep_completed - Completed session prep
 */
/**
 * Form Type Enum (P0-08)
 *
 * Classifies the intent of a generic form created by a coach.
 *
 * @enum {string}
 * @property {'intake'} intake - Pre-engagement questionnaire (client onboarding)
 * @property {'session_feedback'} session_feedback - Post-session feedback
 * @property {'progress_check'} progress_check - Periodic check-ins
 * @property {'custom'} custom - Free-form / uncategorized (default)
 */
export const formTypeEnum = pgEnum('form_type', [
  'intake',
  'session_feedback',
  'progress_check',
  'custom',
]);

export const streakActionTypeEnum = pgEnum('streak_action_type', [
  'session_completed',
  'action_item_completed',
  'iconnect_post',
  'message_sent',
  'check_in_completed',
  'session_prep_completed',
]);

/**
 * AI Processing Status Enum
 *
 * Tracks the state of AI-assisted session note generation (P0-10).
 *
 * @enum {string}
 * @property {'idle'} idle - No AI processing active (default)
 * @property {'uploading'} uploading - Audio recording is being uploaded to storage
 * @property {'transcribing'} transcribing - Whisper is transcribing the recording
 * @property {'generating'} generating - LLM is generating structured notes
 * @property {'ready'} ready - Notes are generated and ready for coach review
 * @property {'failed'} failed - Processing failed; see processingError
 *
 * @remarks
 * State transitions:
 * - idle → uploading → transcribing → generating → ready
 * - idle → generating → ready (when coach pastes a transcript directly)
 * - any → failed (sets processingError)
 * - failed/ready → idle (coach retries)
 */
export const aiProcessingStatusEnum = pgEnum('ai_processing_status', [
  'idle',
  'uploading',
  'transcribing',
  'generating',
  'ready',
  'failed',
]);

/**
 * Membership Subscription Status Enum
 *
 * Tracks the lifecycle of a client's recurring membership with a coach.
 * Values mirror Stripe's `Stripe.Subscription.Status` semantics (subset we handle).
 *
 * @enum {string}
 * @property {'active'} active - Subscription is current, periodic payment succeeded
 * @property {'past_due'} past_due - Renewal payment failed; in grace period
 * @property {'canceled'} canceled - Subscription ended (by client or coach)
 * @property {'incomplete'} incomplete - Checkout completed but initial payment not yet settled
 */
export const membershipSubscriptionStatusEnum = pgEnum('membership_subscription_status', [
  'active',
  'past_due',
  'canceled',
  'incomplete',
]);

// ============================================================================
// JSONB TYPE DEFINITIONS
// ============================================================================

/**
 * Session Type Interface
 *
 * Represents a coaching service offering defined by a coach.
 * Stored in coach_profiles.sessionTypes JSONB array.
 *
 * @interface SessionType
 * @property {string} id - Unique identifier (format: "session_{timestamp}_{random7chars}")
 * @property {string} name - Display name (e.g., "Discovery Call", "1-Hour Coaching")
 * @property {number} duration - Session length in MINUTES (e.g., 30, 60, 90)
 * @property {number} price - Session price in CENTS (e.g., 15000 = $150.00)
 *
 * @example
 * // Example session type
 * const sessionType: SessionType = {
 *   id: "session_1706745600000_abc1234",
 *   name: "Discovery Call",
 *   duration: 30,
 *   price: 0 // Free discovery calls
 * };
 *
 * @example
 * // Paid session example
 * const paidSession: SessionType = {
 *   id: "session_1706745600000_xyz9876",
 *   name: "1-Hour Coaching Session",
 *   duration: 60,
 *   price: 15000 // $150.00
 * };
 */
export interface SessionType {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number; // in cents
  /**
   * Optional intake form (P0-09) that clients must submit before the booking can
   * be confirmed. When set, overrides the coach's default intake form for this
   * session type. See `coachProfiles.defaultIntakeFormId`.
   */
  intakeFormId?: number | null;
}

/**
 * Link Preview Data Interface
 *
 * Stores Open Graph metadata extracted from a URL found in a message.
 */
export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/**
 * Message Metadata Interface
 *
 * Optional JSONB metadata stored on messages for rich content like link previews.
 */
export interface MessageMetadata {
  linkPreview?: LinkPreviewData;
}

/**
 * Credential Interface
 *
 * Represents a professional credential, certification, degree, or membership.
 * Stored in coach_profiles.credentials JSONB array.
 */
export interface Credential {
  id: string;
  type: 'certification' | 'degree' | 'license' | 'membership';
  title: string;
  issuer: string;
  issuedYear: number;
  expiresYear?: number;
  credentialId?: string;
  verificationUrl?: string;
  documentUrl?: string;
  verifiedAt?: string; // ISO date when admin verified
  verifiedBy?: string; // admin user id
}

/**
 * Booking Session Type Interface
 *
 * Snapshot of session type at the time of booking.
 * Stored in bookings.sessionType JSONB field.
 *
 * @interface BookingSessionType
 * @property {string} name - Session name at time of booking
 * @property {number} duration - Duration in MINUTES
 * @property {number} price - Price in CENTS at time of booking
 *
 * @remarks
 * This is a SNAPSHOT - it captures pricing at booking time.
 * If coach updates their prices later, existing bookings retain original price.
 * Does NOT include 'id' since we just need the snapshot data.
 */
export interface BookingSessionType {
  name: string;
  duration: number; // in minutes
  price: number; // in cents
}

// ============================================================================
// USERS TABLE
// ============================================================================

/**
 * Users Table
 *
 * Core user table for all platform users. Synced from Clerk authentication.
 *
 * ## Purpose
 * Stores basic user information synced from Clerk via webhook.
 * All users start as 'client'; coaches complete onboarding to become 'coach'.
 *
 * ## Relationships
 * - Has one optional coach_profiles (if role = 'coach')
 * - Has many bookings (as coach or client)
 * - Has many transactions (as coach or client)
 * - Has many conversations (as coach or client)
 * - Has many messages (as sender)
 * - Has many action_items (as coach or client)
 *
 * ## Clerk Sync
 * - Created by: Clerk webhook (user.created event)
 * - Updated by: Clerk webhook (user.updated event)
 * - Deleted by: Clerk webhook (user.deleted event) - CASCADE to all related records
 *
 * @remarks
 * The 'role' field is NOT synced from Clerk - it's managed by the application.
 * Role changes happen through the coach onboarding flow.
 */
export const users = pgTable('users', {
  /**
   * User ID from Clerk (e.g., "user_2abc123...")
   * @type {string}
   */
  id: text('id').primaryKey(),

  /**
   * User's email address (synced from Clerk)
   * @type {string}
   */
  email: text('email').notNull().unique(),

  /**
   * User's display name (synced from Clerk firstName + lastName)
   * @type {string | null}
   */
  name: text('name'),

  /**
   * URL to user's profile picture (synced from Clerk imageUrl)
   * @type {string | null}
   */
  avatarUrl: text('avatar_url'),

  /**
   * User's phone number (optional, set by user)
   * @type {string | null}
   */
  phone: text('phone'),

  /**
   * User's IANA timezone (e.g., "America/New_York")
   * @type {string | null}
   */
  timezone: text('timezone'),

  /**
   * Email notification preferences (JSONB)
   * @type {{ bookings?: boolean, messages?: boolean, reviews?: boolean, reminders?: boolean, marketing?: boolean } | null}
   */
  emailPreferences: jsonb('email_preferences'),

  /**
   * Client's background or what they're looking for in coaching
   * @type {string | null}
   */
  bio: text('bio'),

  /**
   * Client's date of birth
   * @type {string | null} Format: "YYYY-MM-DD"
   */
  dateOfBirth: date('date_of_birth'),

  /**
   * Client's city / location
   * @type {string | null}
   */
  city: text('city'),

  /**
   * Client's occupation or job title
   * @type {string | null}
   */
  occupation: text('occupation'),

  /**
   * Client's coaching objectives / goals
   * @type {string | null}
   */
  goals: text('goals'),

  /**
   * User role determining platform access level
   * @type {'admin' | 'coach' | 'client'}
   * @default 'client'
   */
  role: userRoleEnum('role').notNull().default('client'),

  /**
   * Timestamp when user record was created
   * @type {Date}
   */
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  /**
   * Timestamp of last update (auto-updated on changes)
   * @type {Date}
   */
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Type for selecting a user record */
export type User = typeof users.$inferSelect;

/** Type for inserting a new user record */
export type NewUser = typeof users.$inferInsert;

// ============================================================================
// COACH PROFILES TABLE
// ============================================================================

/**
 * Coach Profiles Table
 *
 * Extended profile information for users with the 'coach' role.
 *
 * ## Purpose
 * Stores coach-specific data including:
 * - Public profile (headline, bio, specialties)
 * - Pricing (hourly rate, session types)
 * - Availability settings (buffer time, advance notice)
 * - Stripe Connect integration for payments
 *
 * ## Relationships
 * - Belongs to users (1:1, userId is both PK and FK)
 * - Has many coach_availability records (weekly schedule)
 * - Has many availability_overrides (date exceptions)
 *
 * ## JSONB Fields
 * - **specialties**: Array of strings (e.g., ["Career Coaching", "Executive Coaching"])
 * - **sessionTypes**: Array of SessionType objects (see interface above)
 *
 * ## Visibility
 * - isPublished = false: Profile only visible to coach (draft mode)
 * - isPublished = true: Profile appears in public coach directory
 *
 * @remarks
 * Profile completion percentage is calculated by the application,
 * stored here for efficient filtering in coach directory queries.
 */
export const coachProfiles = pgTable(
  'coach_profiles',
  {
    /**
     * References users.id - coach's Clerk user ID
     * @type {string}
     */
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * URL-friendly identifier for the coach's public profile
     * @example "john-smith" → /coaches/john-smith
     * @type {string}
     */
    slug: text('slug').notNull().unique(),

    /**
     * Short tagline displayed below coach name
     * @example "Executive Coach | Leadership Expert"
     * @type {string | null}
     */
    headline: text('headline'),

    /**
     * Full bio/description shown on coach profile page
     * @type {string | null}
     */
    bio: text('bio'),

    /**
     * Coaching specialties in the 2-level taxonomy format (or legacy flat strings).
     * @type {Array<{category: string; subNiches: string[]}> | string[]}
     * @default []
     * @example [{"category":"Health & Wellness","subNiches":["Functional Medicine","Gut Health"]},{"category":"Life","subNiches":[]}]
     *
     * @remarks
     * Evolved from a flat string[] to a 2-level tree in migration 0027.
     * The column remains a union during the transition: legacy coaches still
     * hold `string[]`, new onboarders hold `{category, subNiches}[]`.
     * Use `flattenSpecialties` (in coach-onboarding.ts) to normalize either
     * shape into a flat label array for display or filtering.
     * Use COACH_CATEGORIES from coach-onboarding.ts for the canonical list.
     */
    specialties: jsonb('specialties')
      .$type<Array<{ category: string; subNiches: string[] }> | string[]>()
      .default([]),

    /**
     * Default hourly rate in CENTS
     * @type {number | null}
     * @example 15000 // $150.00 per hour
     *
     * @deprecated Use sessionTypes for pricing instead
     */
    hourlyRate: integer('hourly_rate'),

    /**
     * Currency code for pricing
     * @type {string}
     * @default 'USD'
     */
    currency: text('currency').default('USD'),

    /**
     * Coach's preferred timezone for scheduling
     * @type {string | null}
     * @example "America/New_York", "Europe/London"
     */
    timezone: text('timezone'),

    /**
     * URL to an introduction video (optional)
     * @type {string | null}
     */
    videoIntroUrl: text('video_intro_url'),

    /**
     * Array of session types offered by this coach
     * @type {SessionType[]}
     * @default []
     * @see SessionType interface for structure
     *
     * @remarks
     * Each session type has an id, name, duration (minutes), and price (cents).
     * Coaches can offer multiple session types (e.g., "30min Discovery", "1hr Coaching").
     */
    sessionTypes: jsonb('session_types').$type<SessionType[]>().default([]),

    /**
     * Whether profile appears in public coach directory
     * @type {boolean}
     * @default false
     */
    isPublished: boolean('is_published').notNull().default(false),

    /**
     * Calculated profile completeness (0-100)
     * @type {number}
     * @default 0
     *
     * @remarks
     * Updated by application during onboarding.
     * Used for filtering incomplete profiles in directory.
     */
    profileCompletionPercentage: integer('profile_completion_percentage').notNull().default(0),

    // ----------------------
    // Availability Settings
    // ----------------------

    /**
     * Minutes of buffer time between sessions
     * @type {number}
     * @default 15
     *
     * @remarks
     * Buffer is added AFTER each session ends.
     * Prevents back-to-back bookings.
     */
    bufferMinutes: integer('buffer_minutes').notNull().default(15),

    /**
     * Minimum hours notice required for bookings
     * @type {number}
     * @default 24
     *
     * @remarks
     * Clients cannot book sessions starting within this window.
     * Prevents last-minute bookings.
     */
    advanceNoticeHours: integer('advance_notice_hours').notNull().default(24),

    /**
     * Maximum days in advance a client can book
     * @type {number}
     * @default 60
     *
     * @remarks
     * Limits how far into the future bookings can be made.
     * Helps coaches manage their long-term availability.
     */
    maxAdvanceDays: integer('max_advance_days').notNull().default(60),

    // ----------------------
    // Stripe Connect Fields
    // ----------------------

    /**
     * Stripe Connected Account ID for receiving payments
     * @type {string | null}
     * @example "acct_1234567890"
     *
     * @remarks
     * Created when coach starts Stripe onboarding.
     * Required for coaches to receive payouts.
     */
    stripeAccountId: text('stripe_account_id'),

    /**
     * Whether Stripe Connect onboarding is complete
     * @type {boolean}
     * @default false
     *
     * @remarks
     * Set to true when coach completes Stripe's onboarding flow.
     * Must be true for coach to accept paid bookings.
     */
    stripeOnboardingComplete: boolean('stripe_onboarding_complete').notNull().default(false),

    // ----------------------
    // Review Statistics
    // ----------------------

    /**
     * Average rating from client reviews (1-5)
     * @type {number | null}
     *
     * @remarks
     * Calculated as average of all review ratings.
     * Updated when reviews are added/modified.
     * Stored as decimal for precision (e.g., 4.7).
     */
    averageRating: text('average_rating'),

    /**
     * Total number of reviews
     * @type {number}
     * @default 0
     *
     * @remarks
     * Incremented when new review is added.
     * Used for displaying "X reviews" on coach cards.
     */
    reviewCount: integer('review_count').notNull().default(0),

    // ----------------------
    // Intake Form (P0-09)
    // ----------------------

    /**
     * Default intake form shown to new clients before their first session.
     * Applied when the selected session type does not declare its own
     * `intakeFormId`. Null disables the default intake.
     *
     * @type {number | null}
     * @remarks
     * FK is declared *after* the `forms` table is created via
     * `coachProfilesDefaultIntakeFormFk` below to avoid circular
     * declaration order.
     */
    defaultIntakeFormId: integer('default_intake_form_id'),

    // ----------------------
    // Verification Fields
    // ----------------------

    /**
     * Admin verification status of the coach
     * @type {'pending' | 'verified' | 'rejected'}
     * @default 'pending'
     *
     * @remarks
     * Managed by admins via the admin dashboard.
     * Verified coaches display a badge on their profile.
     */
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('pending'),

    /**
     * When the coach was verified by an admin
     * @type {Date | null}
     *
     * @remarks
     * Set when admin changes status to 'verified'.
     * Null if never verified or if status is pending/rejected.
     */
    verifiedAt: timestamp('verified_at', { withTimezone: true }),

    /**
     * Professional credentials, certifications, degrees, and memberships.
     * @type {Credential[]}
     * @default []
     *
     * @remarks
     * Each credential can be individually verified by an admin (verifiedAt/verifiedBy).
     * The "Verified Coach" badge displays when verificationStatus === 'verified' AND
     * at least one credential has a verifiedAt date set.
     */
    credentials: jsonb('credentials').$type<Credential[]>().default([]),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index on slug for fast profile lookups by URL
    index('coach_profiles_slug_idx').on(table.slug),
    // Index on isPublished for filtering coach directory
    index('coach_profiles_is_published_idx').on(table.isPublished),
  ]
);

/** Type for selecting a coach profile record */
export type CoachProfile = typeof coachProfiles.$inferSelect;

/** Type for inserting a new coach profile record */
export type NewCoachProfile = typeof coachProfiles.$inferInsert;

// ============================================================================
// COACH AVAILABILITY TABLE (Weekly Schedule)
// ============================================================================

/**
 * Coach Availability Table
 *
 * Defines a coach's recurring weekly schedule.
 *
 * ## Purpose
 * Stores the default weekly availability pattern for each coach.
 * Each day of the week has its own row defining available hours.
 *
 * ## Relationships
 * - Belongs to coach_profiles (many:1)
 *
 * ## Usage Pattern
 * - Coach sets up 7 records (one per day) during onboarding
 * - Days with isAvailable=false have no bookable slots
 * - startTime/endTime define the available window for that day
 *
 * ## Override Priority
 * Date-specific overrides in availability_overrides table take precedence
 * over this weekly schedule for specific dates.
 *
 * @remarks
 * dayOfWeek uses JavaScript convention: 0 = Sunday, 6 = Saturday
 */
export const coachAvailability = pgTable(
  'coach_availability',
  {
    id: serial('id').primaryKey(),

    /**
     * References coach_profiles.userId
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => coachProfiles.userId, { onDelete: 'cascade' }),

    /**
     * Day of week (0-6)
     * @type {number}
     *
     * @remarks
     * 0 = Sunday
     * 1 = Monday
     * 2 = Tuesday
     * 3 = Wednesday
     * 4 = Thursday
     * 5 = Friday
     * 6 = Saturday
     */
    dayOfWeek: integer('day_of_week').notNull(),

    /**
     * Start of availability window
     * @type {string} Time format: "HH:MM:SS"
     * @example "09:00:00" - Available from 9 AM
     */
    startTime: time('start_time').notNull(),

    /**
     * End of availability window
     * @type {string} Time format: "HH:MM:SS"
     * @example "17:00:00" - Available until 5 PM
     */
    endTime: time('end_time').notNull(),

    /**
     * Whether this day has any availability
     * @type {boolean}
     * @default true
     *
     * @remarks
     * false = No availability on this day of week
     * true = Available during startTime-endTime window
     */
    isAvailable: boolean('is_available').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index for fetching all availability for a coach
    index('coach_availability_coach_id_idx').on(table.coachId),
    // Index for fetching availability by day
    index('coach_availability_day_of_week_idx').on(table.dayOfWeek),
  ]
);

/** Type for selecting a coach availability record */
export type CoachAvailability = typeof coachAvailability.$inferSelect;

/** Type for inserting a new coach availability record */
export type NewCoachAvailability = typeof coachAvailability.$inferInsert;

// ============================================================================
// AVAILABILITY OVERRIDES TABLE (Date-Specific Exceptions)
// ============================================================================

/**
 * Availability Overrides Table
 *
 * Date-specific exceptions to a coach's weekly availability.
 *
 * ## Purpose
 * Allows coaches to:
 * - Block off specific dates (vacation, holidays)
 * - Add extra availability on normally unavailable days
 * - Modify hours for specific dates
 *
 * ## Relationships
 * - Belongs to coach_profiles (many:1)
 *
 * ## Override Logic
 * When checking availability for a specific date:
 * 1. First check availability_overrides for that date
 * 2. If override exists, use override's isAvailable and times
 * 3. If no override, fall back to coach_availability weekly schedule
 *
 * @remarks
 * An override with isAvailable=false and null times blocks the entire day.
 * An override with isAvailable=true requires startTime/endTime to be set.
 */
export const availabilityOverrides = pgTable(
  'availability_overrides',
  {
    id: serial('id').primaryKey(),

    /**
     * References coach_profiles.userId
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => coachProfiles.userId, { onDelete: 'cascade' }),

    /**
     * The specific date this override applies to
     * @type {string} Format: "YYYY-MM-DD"
     */
    date: date('date').notNull(),

    /**
     * Whether coach is available on this date
     * @type {boolean}
     * @default false
     *
     * @remarks
     * false = Blocked off (vacation, holiday)
     * true = Available (with custom times)
     */
    isAvailable: boolean('is_available').notNull().default(false),

    /**
     * Start of availability on this date
     * @type {string | null} Time format: "HH:MM:SS"
     *
     * @remarks
     * Null if isAvailable=false (entire day blocked)
     * Required if isAvailable=true
     */
    startTime: time('start_time'),

    /**
     * End of availability on this date
     * @type {string | null} Time format: "HH:MM:SS"
     *
     * @remarks
     * Null if isAvailable=false (entire day blocked)
     * Required if isAvailable=true
     */
    endTime: time('end_time'),

    /**
     * Optional reason for the override
     * @type {string | null}
     * @example "Holiday", "Vacation", "Conference", "Personal Day"
     */
    reason: text('reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index for fetching overrides for a coach
    index('availability_overrides_coach_id_idx').on(table.coachId),
    // Index for fetching overrides by date
    index('availability_overrides_date_idx').on(table.date),
    // Composite index for checking specific coach+date (most common query)
    index('availability_overrides_coach_date_idx').on(table.coachId, table.date),
  ]
);

/** Type for selecting an availability override record */
export type AvailabilityOverride = typeof availabilityOverrides.$inferSelect;

/** Type for inserting a new availability override record */
export type NewAvailabilityOverride = typeof availabilityOverrides.$inferInsert;

// ============================================================================
// BOOKINGS TABLE
// ============================================================================

/**
 * Bookings Table
 *
 * Represents scheduled coaching sessions between coaches and clients.
 *
 * ## Purpose
 * Tracks the complete lifecycle of a coaching session from booking to completion.
 *
 * ## Relationships
 * - Belongs to users (as coach, many:1)
 * - Belongs to users (as client, many:1)
 * - Has one transaction (payment record)
 * - Has one session_notes record (optional)
 * - Optionally linked from action_items
 *
 * ## JSONB Field
 * - **sessionType**: Snapshot of session type at booking time (BookingSessionType)
 *   - Captures name, duration, price to preserve original booking terms
 *   - Coach price changes don't affect existing bookings
 *
 * ## Booking Flow
 * 1. Client selects coach, session type, date/time
 * 2. Booking created with status='pending'
 * 3. Client redirected to Stripe Checkout
 * 4. On successful payment: status='confirmed' (via webhook)
 * 5. On payment failure/expiry: status='cancelled'
 * 6. Session occurs, coach marks status='completed'
 *
 * ## Cancellation
 * - cancelledBy: User ID of who cancelled
 * - cancelledAt: When cancellation occurred
 * - cancellationReason: Optional explanation
 *
 * @remarks
 * startTime and endTime are in UTC with timezone information.
 * Display logic should convert to user's local timezone.
 */
export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),

    /**
     * The coach providing the session
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * The client receiving the session
     * @type {string}
     */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Snapshot of session type at booking time
     * @type {BookingSessionType}
     * @see BookingSessionType interface
     *
     * @remarks
     * Contains name, duration (minutes), price (cents).
     * Preserves original terms even if coach updates pricing.
     */
    sessionType: jsonb('session_type').$type<BookingSessionType>().notNull(),

    /**
     * When the session starts (UTC with timezone)
     * @type {Date}
     */
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),

    /**
     * When the session ends (UTC with timezone)
     * @type {Date}
     *
     * @remarks
     * Calculated as: startTime + sessionType.duration minutes
     */
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),

    /**
     * Current status of the booking
     * @type {'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'}
     * @default 'pending'
     */
    status: bookingStatusEnum('status').notNull().default('pending'),

    /**
     * Notes from client when booking
     * @type {string | null}
     *
     * @remarks
     * Visible to both coach and client.
     * Set during booking process.
     */
    clientNotes: text('client_notes'),

    /**
     * Private notes from coach
     * @type {string | null}
     *
     * @deprecated Use session_notes table instead
     */
    coachNotes: text('coach_notes'),

    /**
     * Associated membership subscription (if the session was redeemed
     * against an active recurring membership rather than a one-time payment).
     *
     * @type {number | null}
     *
     * @remarks
     * - null for regular paid bookings (Stripe Checkout).
     * - non-null when the session was redeemed against a membership
     *   (no payment created; the member's sessions_remaining_this_period was decremented).
     * - on cascade delete of the subscription we keep the booking (set null) so
     *   historical records are preserved.
     */
    membershipSubscriptionId: integer('membership_subscription_id').references(
      (): AnyPgColumn => membershipSubscriptions.id,
      { onDelete: 'set null' }
    ),

    /**
     * User ID of who cancelled (if cancelled)
     * @type {string | null}
     */
    cancelledBy: text('cancelled_by').references(() => users.id),

    /**
     * When the booking was cancelled
     * @type {Date | null}
     */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    /**
     * Reason for cancellation
     * @type {string | null}
     */
    cancellationReason: text('cancellation_reason'),

    /**
     * Video meeting URL (Zoom, Google Meet, etc.)
     * @type {string | null}
     *
     * @remarks
     * Set by coach after booking is confirmed.
     * Must be a valid HTTPS URL.
     */
    meetingLink: text('meeting_link'),

    /**
     * When the 24-hour reminder email was sent
     * @type {Date | null}
     *
     * @remarks
     * Set by cron job when sending 24-hour reminder.
     * Null if reminder not yet sent.
     */
    reminder24hSentAt: timestamp('reminder_24h_sent_at', { withTimezone: true }),

    /**
     * When the 1-hour reminder email was sent
     * @type {Date | null}
     *
     * @remarks
     * Set by cron job when sending 1-hour reminder.
     * Null if reminder not yet sent.
     */
    reminder1hSentAt: timestamp('reminder_1h_sent_at', { withTimezone: true }),

    /**
     * Google Calendar event ID for synced bookings
     * @type {string | null}
     *
     * @remarks
     * Set when a booking is synced to Google Calendar.
     * Used to update/delete the event on reschedule/cancel.
     */
    googleCalendarEventId: text('google_calendar_event_id'),

    /** Package purchase used to redeem this session. Null for direct Stripe bookings. */
    packagePurchaseId: integer('package_purchase_id'),

    /**
     * Intake form response (P0-09) submitted for this booking.
     * Required when the coach / session type has an intake form attached
     * and the booking is still `pending`. Set via the client-facing intake
     * flow at `/booking/[bookingId]/intake` before payment can proceed.
     *
     * FK added in migration 0034 (circular dep with form_responses).
     *
     * @type {number | null}
     */
    intakeResponseId: integer('intake_response_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index for coach's session list
    index('bookings_coach_id_idx').on(table.coachId),
    // Index for client's session list
    index('bookings_client_id_idx').on(table.clientId),
    // Index for finding sessions by time (conflict detection, upcoming sessions)
    index('bookings_start_time_idx').on(table.startTime),
    // Index for filtering by status (tabs: upcoming, past, cancelled)
    index('bookings_status_idx').on(table.status),
    // Index for package-redeemed bookings
    index('bookings_package_purchase_id_idx').on(table.packagePurchaseId),
    // Index for fast intake lookup / orphan detection
    index('bookings_intake_response_id_idx').on(table.intakeResponseId),
    // Index for finding bookings redeemed against a given membership subscription
    index('bookings_membership_subscription_id_idx').on(table.membershipSubscriptionId),
  ]
);

/** Type for selecting a booking record */
export type Booking = typeof bookings.$inferSelect;

/** Type for inserting a new booking record */
export type NewBooking = typeof bookings.$inferInsert;

// ============================================================================
// TRANSACTIONS TABLE
// ============================================================================

/**
 * Transactions Table
 *
 * Payment records for coaching session bookings.
 *
 * ## Purpose
 * Tracks financial transactions including:
 * - Payment amounts and status
 * - Platform fees (10% of total)
 * - Coach payouts (90% of total)
 * - Stripe integration IDs
 * - Refund tracking
 *
 * ## Relationships
 * - Belongs to bookings (many:1, nullable for future flexibility)
 * - Belongs to users (as coach, many:1)
 * - Belongs to users (as client, many:1)
 *
 * ## Fee Structure
 * - Platform takes 10% fee
 * - Coach receives 90% via Stripe Connect
 * - All amounts in CENTS (integer)
 *
 * ## Stripe Integration
 * - stripePaymentIntentId: Payment Intent for the charge
 * - stripeCheckoutSessionId: Checkout Session ID
 * - stripeTransferId: Transfer ID for coach payout
 *
 * @example
 * // $100 booking breakdown
 * {
 *   amountCents: 10000,        // $100.00 total
 *   platformFeeCents: 1000,    // $10.00 platform fee (10%)
 *   coachPayoutCents: 9000,    // $90.00 to coach (90%)
 * }
 *
 * @remarks
 * bookingId is nullable to allow for future non-booking transactions
 * (e.g., package purchases, gift cards, etc.)
 */
export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),

    /**
     * Associated booking (nullable for future flexibility)
     * @type {number | null}
     */
    bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),

    /**
     * Coach receiving the payment
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Client making the payment
     * @type {string}
     */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Total transaction amount in CENTS
     * @type {number}
     * @example 15000 // $150.00
     */
    amountCents: integer('amount_cents').notNull(),

    /**
     * Currency code (lowercase)
     * @type {string}
     * @default 'usd'
     */
    currency: text('currency').notNull().default('usd'),

    /**
     * Platform fee in CENTS (10% of amount)
     * @type {number}
     * @example 1500 // $15.00 fee on $150 transaction
     */
    platformFeeCents: integer('platform_fee_cents').notNull(),

    /**
     * Amount coach receives in CENTS (90% of amount)
     * @type {number}
     * @example 13500 // $135.00 payout on $150 transaction
     */
    coachPayoutCents: integer('coach_payout_cents').notNull(),

    /**
     * Stripe Payment Intent ID
     * @type {string | null}
     * @example "pi_1234567890"
     */
    stripePaymentIntentId: text('stripe_payment_intent_id'),

    /**
     * Stripe Checkout Session ID
     * @type {string | null}
     * @example "cs_1234567890"
     */
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),

    /**
     * Stripe Transfer ID (for coach payout)
     * @type {string | null}
     * @example "tr_1234567890"
     */
    stripeTransferId: text('stripe_transfer_id'),

    /**
     * Current payment status
     * @type {'pending' | 'succeeded' | 'failed' | 'refunded'}
     * @default 'pending'
     */
    status: transactionStatusEnum('status').notNull().default('pending'),

    /**
     * Refund amount in CENTS (if refunded)
     * @type {number | null}
     *
     * @remarks
     * Null until refund processed.
     * May be partial (e.g., 50% refund for late cancellation).
     */
    refundAmountCents: integer('refund_amount_cents'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index for finding transaction by booking
    index('transactions_booking_id_idx').on(table.bookingId),
    // Index for coach's transaction history
    index('transactions_coach_id_idx').on(table.coachId),
    // Index for client's transaction history
    index('transactions_client_id_idx').on(table.clientId),
    // Index for filtering by status
    index('transactions_status_idx').on(table.status),
  ]
);

/** Type for selecting a transaction record */
export type Transaction = typeof transactions.$inferSelect;

/** Type for inserting a new transaction record */
export type NewTransaction = typeof transactions.$inferInsert;

// ============================================================================
// CONVERSATIONS TABLE
// ============================================================================

/**
 * Conversations Table
 *
 * Represents a messaging thread between a coach and client.
 *
 * ## Purpose
 * Enables direct messaging between coaches and their clients.
 * Each coach-client pair has exactly one conversation.
 *
 * ## Relationships
 * - Belongs to users (as coach, many:1)
 * - Belongs to users (as client, many:1)
 * - Has many messages
 *
 * ## Uniqueness
 * Each coach-client pair has ONE conversation (enforced by unique constraint).
 * New messages are added to existing conversation, not creating new ones.
 *
 * @remarks
 * Conversations are created lazily - when first message is sent.
 * lastMessageAt is used for sorting conversation list.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: serial('id').primaryKey(),

    /**
     * The coach in this conversation
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * The client in this conversation
     * @type {string}
     */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Timestamp of most recent message
     * @type {Date | null}
     *
     * @remarks
     * Used for sorting conversation list by recency.
     * Updated whenever a new message is added.
     */
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Index for coach's conversation list
    index('conversations_coach_id_idx').on(table.coachId),
    // Index for client's conversation list
    index('conversations_client_id_idx').on(table.clientId),
    // Index for sorting by most recent
    index('conversations_last_message_at_idx').on(table.lastMessageAt),
    // Ensure one conversation per coach-client pair
    unique('conversations_coach_client_unique').on(table.coachId, table.clientId),
  ]
);

/** Type for selecting a conversation record */
export type Conversation = typeof conversations.$inferSelect;

/** Type for inserting a new conversation record */
export type NewConversation = typeof conversations.$inferInsert;

// ============================================================================
// MESSAGES TABLE
// ============================================================================

/**
 * Messages Table
 *
 * Individual messages within a conversation.
 *
 * ## Purpose
 * Stores all messages exchanged between coaches and clients.
 *
 * ## Relationships
 * - Belongs to conversations (many:1)
 * - Belongs to users (as sender, many:1)
 *
 * ## Message Types
 * - 'text': Regular user-sent message
 * - 'system': Auto-generated (e.g., "Session booked for Jan 15")
 *
 * @remarks
 * Messages are never edited or deleted.
 * isRead tracks read status for unread count display.
 */
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),

    /**
     * The conversation this message belongs to
     * @type {number}
     */
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),

    /**
     * The user who sent this message
     * @type {string}
     */
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Message content (text)
     * @type {string}
     */
    content: text('content').notNull(),

    /**
     * Type of message
     * @type {'text' | 'system'}
     * @default 'text'
     */
    messageType: messageTypeEnum('message_type').notNull().default('text'),

    /**
     * Whether recipient has read the message
     * @type {boolean}
     * @default false
     */
    isRead: boolean('is_read').notNull().default(false),

    /**
     * URL to the uploaded attachment file in Supabase Storage
     * @type {string | null}
     */
    attachmentUrl: text('attachment_url'),

    /**
     * Original file name of the attachment
     * @type {string | null}
     */
    attachmentName: text('attachment_name'),

    /**
     * MIME type of the attachment (e.g., "image/png", "application/pdf")
     * @type {string | null}
     */
    attachmentType: text('attachment_type'),

    /**
     * File size in bytes
     * @type {number | null}
     */
    attachmentSize: integer('attachment_size'),

    /**
     * Optional metadata for the message (e.g., link previews)
     * @type {MessageMetadata | null}
     */
    metadata: jsonb('metadata').$type<MessageMetadata>(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Index for fetching messages in a conversation
    index('messages_conversation_id_idx').on(table.conversationId),
    // Index for filtering by sender
    index('messages_sender_id_idx').on(table.senderId),
    // Index for chronological ordering
    index('messages_created_at_idx').on(table.createdAt),
    // Composite index for unread count queries per conversation
    index('messages_conversation_id_is_read_idx').on(table.conversationId, table.isRead),
  ]
);

/** Type for selecting a message record */
export type Message = typeof messages.$inferSelect;

/** Type for inserting a new message record */
export type NewMessage = typeof messages.$inferInsert;

// ============================================================================
// SESSION NOTE TEMPLATES TABLE
// ============================================================================

/**
 * Session Note Templates Table
 *
 * Reusable structured templates for coaching session notes.
 * System templates (isSystem=true, coachId=null) are available to all coaches.
 * Custom templates (isSystem=false) are created by individual coaches.
 */
export const sessionNoteTemplates = pgTable(
  'session_note_templates',
  {
    id: serial('id').primaryKey(),
    coachId: text('coach_id').references(() => users.id, { onDelete: 'cascade' }), // null = system template
    name: text('name').notNull(),
    description: text('description'),
    sections: jsonb('sections')
      .notNull()
      .$type<Array<{ title: string; placeholder: string; type: 'text' | 'textarea' }>>(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('session_note_templates_coach_id_idx').on(table.coachId),
    index('session_note_templates_is_system_idx').on(table.isSystem),
  ]
);

/** Type for selecting a session note template record */
export type SessionNoteTemplate = typeof sessionNoteTemplates.$inferSelect;

/** Type for inserting a new session note template record */
export type NewSessionNoteTemplate = typeof sessionNoteTemplates.$inferInsert;

// ============================================================================
// SESSION NOTES TABLE
// ============================================================================

/**
 * Session Notes Table
 *
 * Private coach notes for each completed session.
 *
 * ## Purpose
 * Allows coaches to keep private notes about sessions.
 * Notes are visible ONLY to the coach, never to clients.
 *
 * ## Relationships
 * - Belongs to bookings (1:1, unique constraint)
 * - Belongs to users (as coach, many:1)
 *
 * ## Privacy
 * Session notes are private to the coach.
 * Unlike clientNotes (on bookings), these are never shown to clients.
 *
 * @remarks
 * One note per session (enforced by unique constraint on bookingId).
 * This table replaced the deprecated bookings.coachNotes field.
 */
export const sessionNotes = pgTable(
  'session_notes',
  {
    id: serial('id').primaryKey(),

    /**
     * The session this note is about (unique - one note per session)
     * @type {number}
     */
    bookingId: integer('booking_id')
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: 'cascade' }),

    /**
     * The coach who wrote the note
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * The note content (plain text or concatenated SOAP body when AI-generated).
     * Defaults to empty string for AI-processing rows that haven't finished yet.
     * @type {string}
     */
    content: text('content').notNull().default(''),

    /**
     * Optional template used to structure this note
     * @type {number | null}
     */
    templateId: integer('template_id').references(() => sessionNoteTemplates.id, {
      onDelete: 'set null',
    }),

    /**
     * Structured section content when a template was used
     * @type {Record<string, string> | null}
     */
    sections: jsonb('sections').$type<Record<string, string>>(),

    // ==========================================================================
    // AI Session Notes (P0-10) — Whisper transcription + GPT-4o summarization
    // ==========================================================================

    /**
     * Path in Supabase Storage to the uploaded audio recording.
     * Private bucket `session-recordings`, 7-day lifecycle.
     * @type {string | null}
     */
    transcriptUrl: text('transcript_url'),

    /**
     * Raw transcript text (from Whisper or pasted by coach).
     * @type {string | null}
     */
    transcript: text('transcript'),

    /**
     * True when the structured note content was produced by an LLM.
     * Coach is expected to review/edit before finalizing.
     * @type {boolean}
     */
    aiGenerated: boolean('ai_generated').notNull().default(false),

    /**
     * Identifier of the LLM that generated the notes (e.g. 'gpt-4o').
     * @type {string | null}
     */
    aiModel: text('ai_model'),

    /**
     * Timestamp when the AI generation completed.
     * @type {Date | null}
     */
    aiGeneratedAt: timestamp('ai_generated_at', { withTimezone: true }),

    /**
     * SOAP — Subjective: client's self-reported state/concerns/symptoms.
     * @type {string | null}
     */
    soapSubjective: text('soap_subjective'),

    /**
     * SOAP — Objective: observable data, tracked metrics, behavioral observations.
     * @type {string | null}
     */
    soapObjective: text('soap_objective'),

    /**
     * SOAP — Assessment: coach's impression, patterns, what's working/stuck.
     * @type {string | null}
     */
    soapAssessment: text('soap_assessment'),

    /**
     * SOAP — Plan: plan for client until next session.
     * @type {string | null}
     */
    soapPlan: text('soap_plan'),

    /**
     * Suggested topic tags extracted from the session.
     * @type {string[] | null}
     */
    keyTopics: jsonb('key_topics').$type<string[]>(),

    /**
     * AI-suggested action items the coach can convert into real `action_items` rows.
     * Array of short strings.
     * @type {string[] | null}
     */
    actionItemsSuggested: jsonb('action_items_suggested').$type<string[]>(),

    /**
     * Free-text suggestions for the next session (topics to revisit, questions to probe).
     * @type {string | null}
     */
    nextSessionSuggestions: text('next_session_suggestions'),

    /**
     * AI-drafted follow-up email subject. Coach reviews before sending.
     * @type {string | null}
     */
    followUpEmailSubject: text('follow_up_email_subject'),

    /**
     * AI-drafted follow-up email body. Coach reviews before sending.
     * @type {string | null}
     */
    followUpEmailBody: text('follow_up_email_body'),

    /**
     * Current AI processing state (upload → transcribe → generate → ready).
     * @type {'idle' | 'uploading' | 'transcribing' | 'generating' | 'ready' | 'failed'}
     */
    processingStatus: aiProcessingStatusEnum('processing_status').notNull().default('idle'),

    /**
     * Error message when processingStatus === 'failed'.
     * @type {string | null}
     */
    processingError: text('processing_error'),

    /**
     * Tokens consumed by the LLM call (for cost tracking).
     * @type {number | null}
     */
    aiTokensUsed: integer('ai_tokens_used'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index for finding note by booking
    index('session_notes_booking_id_idx').on(table.bookingId),
    // Index for coach's note history
    index('session_notes_coach_id_idx').on(table.coachId),
    // Index for polling status lookups
    index('session_notes_processing_status_idx').on(table.processingStatus),
  ]
);

/** Type for selecting a session note record */
export type SessionNote = typeof sessionNotes.$inferSelect;

/** Type for inserting a new session note record */
export type NewSessionNote = typeof sessionNotes.$inferInsert;

// ============================================================================
// ACTION ITEMS TABLE
// ============================================================================

/**
 * Action Items Table
 *
 * Tasks assigned by coaches to clients.
 *
 * ## Purpose
 * Allows coaches to assign actionable tasks to clients:
 * - Homework between sessions
 * - Goals to work toward
 * - Follow-up items from sessions
 *
 * ## Relationships
 * - Belongs to users (as coach, many:1)
 * - Belongs to users (as client, many:1)
 * - Optionally linked to bookings (for session-specific tasks)
 *
 * ## Lifecycle
 * - Coach creates action item (isCompleted = false)
 * - Client or coach marks complete (isCompleted = true, completedAt set)
 *
 * @remarks
 * bookingId is optional - action items can exist independently of sessions.
 * dueDate is optional for tasks without specific deadlines.
 */
export const actionItems = pgTable(
  'action_items',
  {
    id: serial('id').primaryKey(),

    /**
     * Coach who assigned the task
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Client assigned to complete the task
     * @type {string}
     */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Associated session (optional)
     * @type {number | null}
     *
     * @remarks
     * Links task to specific session if created during/after session.
     * Null for general tasks not tied to a session.
     */
    bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),

    /**
     * Associated goal (optional)
     * @type {number | null}
     *
     * @remarks
     * Links action item to a specific coaching goal.
     * Null for action items not tied to a goal.
     */
    goalId: integer('goal_id').references(() => goals.id, { onDelete: 'set null' }),

    /**
     * Task title/summary
     * @type {string}
     */
    title: text('title').notNull(),

    /**
     * Detailed task description
     * @type {string | null}
     */
    description: text('description'),

    /**
     * Due date for the task
     * @type {string | null} Format: "YYYY-MM-DD"
     */
    dueDate: date('due_date'),

    /**
     * Whether task has been completed
     * @type {boolean}
     * @default false
     */
    isCompleted: boolean('is_completed').notNull().default(false),

    /**
     * When the task was marked complete
     * @type {Date | null}
     */
    completedAt: timestamp('completed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index for coach's task list
    index('action_items_coach_id_idx').on(table.coachId),
    // Index for client's task list
    index('action_items_client_id_idx').on(table.clientId),
    // Index for filtering pending vs completed
    index('action_items_is_completed_idx').on(table.isCompleted),
  ]
);

/** Type for selecting an action item record */
export type ActionItem = typeof actionItems.$inferSelect;

/** Type for inserting a new action item record */
export type NewActionItem = typeof actionItems.$inferInsert;

// ============================================================================
// REVIEWS TABLE
// ============================================================================

/**
 * Reviews Table
 *
 * Client reviews for completed coaching sessions.
 *
 * ## Purpose
 * Allows clients to leave reviews for coaches after completing sessions.
 * Reviews include:
 * - Star rating (1-5)
 * - Title and detailed content
 * - Optional coach response
 * - Visibility control (public/private)
 *
 * ## Relationships
 * - Belongs to bookings (1:1, unique constraint - one review per booking)
 * - Belongs to users (as coach, many:1)
 * - Belongs to users (as client, many:1)
 *
 * ## Constraints
 * - Only one review allowed per booking (unique on bookingId)
 * - Rating must be between 1-5 (validated at application level)
 * - Only completed bookings can have reviews (validated at application level)
 *
 * @remarks
 * Coach averageRating and reviewCount in coach_profiles are updated
 * when reviews are created or modified.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),

    /**
     * The completed booking this review is for (unique - one review per booking)
     * @type {number}
     */
    bookingId: integer('booking_id')
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: 'cascade' }),

    /**
     * The coach being reviewed
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * The client writing the review
     * @type {string}
     */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Star rating (1-5)
     * @type {number}
     *
     * @remarks
     * 1 = Poor, 2 = Fair, 3 = Good, 4 = Very Good, 5 = Excellent
     * Validation at application level ensures 1-5 range.
     */
    rating: integer('rating').notNull(),

    /**
     * Review title/summary
     * @type {string | null}
     */
    title: text('title'),

    /**
     * Detailed review content
     * @type {string | null}
     */
    content: text('content'),

    /**
     * Coach's response to the review
     * @type {string | null}
     *
     * @remarks
     * Allows coaches to respond to reviews.
     * Only the coach can set/edit this field.
     */
    coachResponse: text('coach_response'),

    /**
     * Whether review is publicly visible
     * @type {boolean}
     * @default true
     *
     * @remarks
     * true = Visible on coach's public profile
     * false = Only visible to coach and client
     */
    isPublic: boolean('is_public').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index for fetching reviews by coach (for profile display)
    index('reviews_coach_id_idx').on(table.coachId),
    // Index for fetching reviews by client
    index('reviews_client_id_idx').on(table.clientId),
    // Index for filtering public reviews
    index('reviews_is_public_idx').on(table.isPublic),
    // Index for sorting by creation date
    index('reviews_created_at_idx').on(table.createdAt),
  ]
);

/** Type for selecting a review record */
export type Review = typeof reviews.$inferSelect;

/** Type for inserting a new review record */
export type NewReview = typeof reviews.$inferInsert;

// ============================================================================
// GOOGLE CALENDAR TOKENS TABLE
// ============================================================================

/**
 * Google Calendar Tokens Table
 *
 * Stores OAuth2 tokens for Google Calendar integration.
 * One record per user who has connected their Google Calendar.
 */
export const googleCalendarTokens = pgTable('google_calendar_tokens', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  accessToken: text('access_token').notNull(),

  refreshToken: text('refresh_token').notNull(),

  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),

  calendarId: text('calendar_id').notNull().default('primary'),

  isConnected: boolean('is_connected').notNull().default(true),

  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;
export type NewGoogleCalendarToken = typeof googleCalendarTokens.$inferInsert;

// ============================================================================
// NOTIFICATION TYPE ENUM
// ============================================================================

/**
 * Notification Type Enum
 *
 * Categorizes in-app notifications for filtering and display.
 *
 * @enum {string}
 * @property {'booking_confirmed'} booking_confirmed - Booking payment confirmed
 * @property {'booking_cancelled'} booking_cancelled - Booking was cancelled
 * @property {'session_completed'} session_completed - Session marked complete
 * @property {'new_message'} new_message - New chat message received
 * @property {'new_review'} new_review - New review submitted for coach
 * @property {'review_response'} review_response - Coach responded to a review
 * @property {'action_item'} action_item - New action item assigned
 * @property {'session_reminder'} session_reminder - Upcoming session reminder
 * @property {'system'} system - System announcement
 */
export const notificationTypeEnum = pgEnum('notification_type', [
  'booking_confirmed',
  'booking_cancelled',
  'session_completed',
  'new_message',
  'new_review',
  'review_response',
  'action_item',
  'session_reminder',
  'system',
]);

// ============================================================================
// NOTIFICATIONS TABLE
// ============================================================================

/**
 * Notifications Table
 *
 * In-app notifications for all platform users.
 * Created by system events (bookings, messages, reviews, etc.)
 * and consumed by the notification bell/panel in the UI.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),

    /** The user who receives the notification */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Notification category for filtering and icon display */
    type: notificationTypeEnum('type').notNull(),

    /** Short title displayed in notification list */
    title: text('title').notNull(),

    /** Main notification message (required by DB constraint) */
    message: text('message').notNull(),

    /** Longer description/body text */
    body: text('body'),

    /** Deep link path within the app (e.g., "/dashboard/sessions/42") */
    link: text('link_url'),

    /** Whether the user has read/seen this notification */
    isRead: boolean('is_read').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_unread_idx').on(table.userId, table.isRead),
    index('notifications_created_at_idx').on(table.createdAt),
  ]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// ============================================================================
// GROUP COACHING ENUMS
// ============================================================================

/**
 * Group Session Status Enum
 *
 * @enum {string}
 * @property {'draft'} draft - Created but not published
 * @property {'published'} published - Open for registration
 * @property {'full'} full - Max participants reached
 * @property {'in_progress'} in_progress - Session is happening now
 * @property {'completed'} completed - Session finished
 * @property {'cancelled'} cancelled - Session was cancelled
 */
export const groupSessionStatusEnum = pgEnum('group_session_status', [
  'draft',
  'published',
  'full',
  'in_progress',
  'completed',
  'cancelled',
]);

/**
 * Group Participant Status Enum
 *
 * @enum {string}
 * @property {'registered'} registered - Participant signed up and paid
 * @property {'cancelled'} cancelled - Participant cancelled their registration
 * @property {'attended'} attended - Confirmed attendance after session
 * @property {'no_show'} no_show - Did not attend
 */
export const groupParticipantStatusEnum = pgEnum('group_participant_status', [
  'registered',
  'cancelled',
  'attended',
  'no_show',
]);

// ============================================================================
// GROUP SESSIONS TABLE
// ============================================================================

/**
 * Group Sessions Table
 *
 * Stores group coaching sessions created by coaches. Multiple clients
 * can join a single session up to maxParticipants.
 */
export const groupSessions = pgTable(
  'group_sessions',
  {
    id: serial('id').primaryKey(),

    /** Coach who created this group session */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Session title displayed to clients */
    title: text('title').notNull(),

    /** Detailed description of what the session covers */
    description: text('description'),

    /** Maximum number of participants (excluding coach) */
    maxParticipants: integer('max_participants').notNull().default(10),

    /** Current registered participant count (denormalized for query performance) */
    participantCount: integer('participant_count').notNull().default(0),

    /** Price per participant in cents */
    priceCents: integer('price_cents').notNull(),

    /** Currency code (e.g., 'usd') */
    currency: text('currency').notNull().default('usd'),

    /** Session start time */
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),

    /** Session end time */
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),

    /** Duration in minutes */
    duration: integer('duration').notNull(),

    /** Online meeting link */
    meetingLink: text('meeting_link'),

    /** Session status */
    status: groupSessionStatusEnum('status').notNull().default('draft'),

    /** Optional specialties/tags for this session (JSONB array of strings) */
    tags: jsonb('tags').$type<string[]>(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('group_sessions_coach_id_idx').on(table.coachId),
    index('group_sessions_status_idx').on(table.status),
    index('group_sessions_start_time_idx').on(table.startTime),
  ]
);

export type GroupSession = typeof groupSessions.$inferSelect;
export type NewGroupSession = typeof groupSessions.$inferInsert;

// ============================================================================
// GROUP SESSION PARTICIPANTS TABLE
// ============================================================================

/**
 * Group Session Participants Table
 *
 * Join table tracking which clients have registered for group sessions.
 * One record per client per group session.
 */
export const groupSessionParticipants = pgTable(
  'group_session_participants',
  {
    id: serial('id').primaryKey(),

    /** The group session */
    groupSessionId: integer('group_session_id')
      .notNull()
      .references(() => groupSessions.id, { onDelete: 'cascade' }),

    /** The client who registered */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Registration/attendance status */
    status: groupParticipantStatusEnum('status').notNull().default('registered'),

    /** Stripe payment intent ID for this participant's payment */
    stripePaymentIntentId: text('stripe_payment_intent_id'),

    /** Amount paid in cents */
    amountPaidCents: integer('amount_paid_cents'),

    /** When they registered */
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),

    /** When they cancelled (if applicable) */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (table) => [
    index('group_participants_session_idx').on(table.groupSessionId),
    index('group_participants_client_idx').on(table.clientId),
    unique('group_participants_unique').on(table.groupSessionId, table.clientId),
  ]
);

export type GroupSessionParticipant = typeof groupSessionParticipants.$inferSelect;
export type NewGroupSessionParticipant = typeof groupSessionParticipants.$inferInsert;

// ============================================================================
// PROGRAMS TABLE
// ============================================================================

/**
 * Programs Table
 *
 * Coaching programs that group goals, tasks, and materials for a coach-client pair.
 *
 * ## Purpose
 * Represents a structured coaching engagement between a coach and client.
 * Programs contain goals, action items, and attachments.
 *
 * ## Relationships
 * - Belongs to users (as coach, many:1)
 * - Belongs to users (as client, many:1)
 * - Has many goals
 * - Has many attachments
 *
 * @remarks
 * Coach-client relationships are derived from bookings.
 * Programs are created by coaches to organize ongoing work with clients.
 */
export const programs = pgTable(
  'programs',
  {
    id: serial('id').primaryKey(),

    /** Coach who created this program */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Client assigned to this program */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Program title */
    title: varchar('title', { length: 255 }).notNull(),

    /** Detailed program description */
    description: text('description'),

    /** Current program status */
    status: programStatusEnum('status').notNull().default('active'),

    /** Program start date */
    startDate: date('start_date'),

    /** Program end date */
    endDate: date('end_date'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('programs_coach_id_idx').on(table.coachId),
    index('programs_client_id_idx').on(table.clientId),
    index('programs_status_idx').on(table.status),
    index('programs_coach_client_idx').on(table.coachId, table.clientId),
  ]
);

/** Type for selecting a program record */
export type Program = typeof programs.$inferSelect;

/** Type for inserting a new program record */
export type NewProgram = typeof programs.$inferInsert;

// ============================================================================
// GOALS TABLE
// ============================================================================

/**
 * Goals Table
 *
 * Individual coaching goals within a program.
 *
 * ## Purpose
 * Tracks specific objectives assigned by coaches to clients.
 * Goals belong to a program and can have action items and attachments.
 *
 * ## Relationships
 * - Belongs to programs (many:1)
 * - Belongs to users (as coach, many:1)
 * - Belongs to users (as client, many:1)
 * - Has many action_items (via goalId)
 * - Has many attachments
 *
 * @remarks
 * Goals have priority levels and due dates for tracking progress.
 */
export const goals = pgTable(
  'goals',
  {
    id: serial('id').primaryKey(),

    /** Program this goal belongs to */
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),

    /** Coach who created this goal */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Client assigned to this goal */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Goal title */
    title: varchar('title', { length: 255 }).notNull(),

    /** Detailed goal description */
    description: text('description'),

    /** Current goal status */
    status: goalStatusEnum('status').notNull().default('pending'),

    /** Goal priority level */
    priority: goalPriorityEnum('priority').notNull().default('medium'),

    /** Target completion date */
    dueDate: date('due_date'),

    /** When the goal was marked complete */
    completedAt: timestamp('completed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('goals_program_id_idx').on(table.programId),
    index('goals_coach_id_idx').on(table.coachId),
    index('goals_client_id_idx').on(table.clientId),
    index('goals_status_idx').on(table.status),
  ]
);

/** Type for selecting a goal record */
export type Goal = typeof goals.$inferSelect;

/** Type for inserting a new goal record */
export type NewGoal = typeof goals.$inferInsert;

// ============================================================================
// ATTACHMENTS TABLE
// ============================================================================

/**
 * Attachments Table
 *
 * File attachments for programs, goals, and action items.
 *
 * ## Purpose
 * Enables bidirectional file sharing between coaches and clients:
 * - Coaches attach materials (PDFs, templates, worksheets)
 * - Clients upload completed work (filled PDFs, documents)
 *
 * ## Relationships
 * - Optionally belongs to programs (many:1)
 * - Optionally belongs to goals (many:1)
 * - Optionally belongs to action_items (many:1)
 * - Belongs to users (as uploader, many:1)
 *
 * @remarks
 * At least one of programId, goalId, or actionItemId should be set.
 * Files are stored in Supabase Storage; fileUrl contains the storage path.
 */
export const attachments = pgTable(
  'attachments',
  {
    id: serial('id').primaryKey(),

    /** Associated program (optional) */
    programId: integer('program_id').references(() => programs.id, { onDelete: 'cascade' }),

    /** Associated goal (optional) */
    goalId: integer('goal_id').references(() => goals.id, { onDelete: 'cascade' }),

    /** Associated action item (optional) */
    actionItemId: integer('action_item_id').references(() => actionItems.id, {
      onDelete: 'cascade',
    }),

    /** User who uploaded this file */
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Original file name */
    fileName: varchar('file_name', { length: 255 }).notNull(),

    /** Storage URL or path */
    fileUrl: text('file_url').notNull(),

    /** MIME type (e.g., "application/pdf", "image/png") */
    fileType: varchar('file_type', { length: 100 }).notNull(),

    /** File size in bytes */
    fileSize: integer('file_size').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('attachments_program_id_idx').on(table.programId),
    index('attachments_goal_id_idx').on(table.goalId),
    index('attachments_action_item_id_idx').on(table.actionItemId),
    index('attachments_uploaded_by_idx').on(table.uploadedBy),
  ]
);

/** Type for selecting an attachment record */
export type Attachment = typeof attachments.$inferSelect;

/** Type for inserting a new attachment record */
export type NewAttachment = typeof attachments.$inferInsert;

// ============================================================================
// ICONNECT POSTS TABLE
// ============================================================================

/**
 * iConnect Posts Table
 *
 * Posts in the 1:1 iConnect feed/bulletin board between a coach and client.
 *
 * ## Purpose
 * Enables a shared feed within an existing conversation where coaches and
 * clients can post text, images, or task checklists.
 *
 * ## Relationships
 * - Belongs to conversations (many:1)
 * - Belongs to users (as sender, many:1)
 * - Has many iconnectTaskItems (for task-type posts)
 */
export const iconnectPosts = pgTable(
  'iconnect_posts',
  {
    id: serial('id').primaryKey(),

    /** The conversation this post belongs to */
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),

    /** The user who created this post */
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Type of post */
    type: iconnectPostTypeEnum('type').notNull(),

    /** Post text content (nullable for image-only posts) */
    content: text('content'),

    /** URL to uploaded image (nullable) */
    imageUrl: text('image_url'),

    /** Whether the recipient has read this post */
    isRead: boolean('is_read').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('iconnect_posts_conversation_id_idx').on(table.conversationId),
    index('iconnect_posts_sender_user_id_idx').on(table.senderUserId),
    index('iconnect_posts_created_at_idx').on(table.createdAt),
  ]
);

/** Type for selecting an iConnect post record */
export type IconnectPost = typeof iconnectPosts.$inferSelect;

/** Type for inserting a new iConnect post record */
export type NewIconnectPost = typeof iconnectPosts.$inferInsert;

// ============================================================================
// ICONNECT TASK ITEMS TABLE
// ============================================================================

/**
 * iConnect Task Items Table
 *
 * Checklist items within a task-type iConnect post.
 *
 * ## Purpose
 * Stores individual checklist items for iConnect posts of type 'task'.
 * Each item can be independently toggled complete/incomplete.
 *
 * ## Relationships
 * - Belongs to iconnectPosts (many:1)
 */
export const iconnectTaskItems = pgTable(
  'iconnect_task_items',
  {
    id: serial('id').primaryKey(),

    /** The task post this item belongs to */
    postId: integer('post_id')
      .notNull()
      .references(() => iconnectPosts.id, { onDelete: 'cascade' }),

    /** Task item label/description */
    label: text('label').notNull(),

    /** Whether this item has been completed */
    completed: boolean('completed').notNull().default(false),

    /** When this item was marked complete */
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('iconnect_task_items_post_id_idx').on(table.postId)]
);

/** Type for selecting an iConnect task item record */
export type IconnectTaskItem = typeof iconnectTaskItems.$inferSelect;

/** Type for inserting a new iConnect task item record */
export type NewIconnectTaskItem = typeof iconnectTaskItems.$inferInsert;

// ============================================================================
// ICONNECT COMMENTS TABLE
// ============================================================================

/**
 * iConnect Comments Table
 *
 * Comments on iConnect posts within a coach-client conversation.
 *
 * ## Purpose
 * Allows coaches and clients to comment on iConnect posts,
 * enabling threaded discussion on shared feed items.
 *
 * ## Relationships
 * - Belongs to iconnectPosts (many:1)
 * - Belongs to users (as sender, many:1)
 */
export const iconnectComments = pgTable(
  'iconnect_comments',
  {
    id: serial('id').primaryKey(),

    /** The post this comment belongs to */
    postId: integer('post_id')
      .notNull()
      .references(() => iconnectPosts.id, { onDelete: 'cascade' }),

    /** The user who wrote this comment */
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Comment text content */
    content: text('content').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('iconnect_comments_post_id_idx').on(table.postId)]
);

/** Type for selecting an iConnect comment record */
export type IconnectComment = typeof iconnectComments.$inferSelect;

/** Type for inserting a new iConnect comment record */
export type NewIconnectComment = typeof iconnectComments.$inferInsert;

// ============================================================================
// COACH INVITES TABLE
// ============================================================================

export const coachInviteStatusEnum = pgEnum('coach_invite_status', ['pending', 'claimed']);

export const coachInvites = pgTable('coach_invites', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  status: coachInviteStatusEnum('status').notNull().default('pending'),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
});

/** Type for selecting a coach invite record */
export type CoachInvite = typeof coachInvites.$inferSelect;

/** Type for inserting a new coach invite record */
export type NewCoachInvite = typeof coachInvites.$inferInsert;

// ============================================================================
// PUSH TOKENS TABLE
// ============================================================================

/**
 * Push Tokens Table
 *
 * Stores Expo push notification tokens for mobile and web clients.
 * One token per device per user. Upserted on device re-registration.
 *
 * ## Relationships
 * - Belongs to users (many:1, cascade delete)
 *
 * ## Uniqueness
 * - Unique per (userId, deviceId) — re-registration updates the token
 */
export const pushTokens = pgTable(
  'push_tokens',
  {
    id: serial('id').primaryKey(),

    /** The user this token belongs to */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Expo push token (e.g. ExponentPushToken[xxx]) */
    token: text('token').notNull(),

    /** Device platform */
    platform: text('platform').notNull(), // 'ios' | 'android' | 'web'

    /** Unique device identifier (used to upsert on re-registration) */
    deviceId: text('device_id').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('push_tokens_user_device_idx').on(table.userId, table.deviceId),
    index('push_tokens_user_id_idx').on(table.userId),
  ]
);

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;

// ============================================================================
// DRIZZLE RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  coachProfile: one(coachProfiles, {
    fields: [users.id],
    references: [coachProfiles.userId],
  }),
  coachBookings: many(bookings, { relationName: 'coachBookings' }),
  clientBookings: many(bookings, { relationName: 'clientBookings' }),
  coachConversations: many(conversations, { relationName: 'coachConversations' }),
  clientConversations: many(conversations, { relationName: 'clientConversations' }),
  sentMessages: many(messages),
  coachActionItems: many(actionItems, { relationName: 'coachActionItems' }),
  clientActionItems: many(actionItems, { relationName: 'clientActionItems' }),
  coachPrograms: many(programs, { relationName: 'coachPrograms' }),
  clientPrograms: many(programs, { relationName: 'clientPrograms' }),
  coachGoals: many(goals, { relationName: 'coachGoals' }),
  clientGoals: many(goals, { relationName: 'clientGoals' }),
  uploadedAttachments: many(attachments),
  notifications: many(notifications),
  coachReviews: many(reviews, { relationName: 'coachReviews' }),
  clientReviews: many(reviews, { relationName: 'clientReviews' }),
  coachGroupSessions: many(groupSessions),
  iconnectPosts: many(iconnectPosts),
  iconnectComments: many(iconnectComments),
  pushTokens: many(pushTokens),
  clientGroups: many(clientGroups),
  clientGroupMemberships: many(clientGroupMembers),
  coachingStreak: one(coachingStreaks, {
    fields: [users.id],
    references: [coachingStreaks.userId],
  }),
  streakActivities: many(streakActivities),
  clientCheckIns: many(weeklyCheckIns, { relationName: 'clientCheckIns' }),
  coachCheckIns: many(weeklyCheckIns, { relationName: 'coachCheckIns' }),
  clientPrepResponses: many(sessionPrepResponses, { relationName: 'clientPrepResponses' }),
  coachPrepResponses: many(sessionPrepResponses, { relationName: 'coachPrepResponses' }),
  sessionPrepQuestions: one(sessionPrepQuestions, {
    fields: [users.id],
    references: [sessionPrepQuestions.coachId],
  }),
  coachMemberships: many(memberships, { relationName: 'coachMemberships' }),
  clientMembershipSubscriptions: many(membershipSubscriptions, {
    relationName: 'clientMembershipSubscriptions',
  }),
  coachMembershipSubscriptions: many(membershipSubscriptions, {
    relationName: 'coachMembershipSubscriptions',
  }),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  coach: one(users, {
    fields: [programs.coachId],
    references: [users.id],
    relationName: 'coachPrograms',
  }),
  client: one(users, {
    fields: [programs.clientId],
    references: [users.id],
    relationName: 'clientPrograms',
  }),
  goals: many(goals),
  attachments: many(attachments),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  program: one(programs, {
    fields: [goals.programId],
    references: [programs.id],
  }),
  coach: one(users, {
    fields: [goals.coachId],
    references: [users.id],
    relationName: 'coachGoals',
  }),
  client: one(users, {
    fields: [goals.clientId],
    references: [users.id],
    relationName: 'clientGoals',
  }),
  actionItems: many(actionItems),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  program: one(programs, {
    fields: [attachments.programId],
    references: [programs.id],
  }),
  goal: one(goals, {
    fields: [attachments.goalId],
    references: [goals.id],
  }),
  actionItem: one(actionItems, {
    fields: [attachments.actionItemId],
    references: [actionItems.id],
  }),
  uploader: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));

export const actionItemsRelations = relations(actionItems, ({ one, many }) => ({
  coach: one(users, {
    fields: [actionItems.coachId],
    references: [users.id],
    relationName: 'coachActionItems',
  }),
  client: one(users, {
    fields: [actionItems.clientId],
    references: [users.id],
    relationName: 'clientActionItems',
  }),
  booking: one(bookings, {
    fields: [actionItems.bookingId],
    references: [bookings.id],
  }),
  goal: one(goals, {
    fields: [actionItems.goalId],
    references: [goals.id],
  }),
  attachments: many(attachments),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  coach: one(users, {
    fields: [bookings.coachId],
    references: [users.id],
    relationName: 'coachBookings',
  }),
  client: one(users, {
    fields: [bookings.clientId],
    references: [users.id],
    relationName: 'clientBookings',
  }),
  transaction: one(transactions),
  sessionNote: one(sessionNotes),
  review: one(reviews),
  actionItems: many(actionItems),
  sessionPrepResponse: one(sessionPrepResponses),
  membershipSubscription: one(membershipSubscriptions, {
    fields: [bookings.membershipSubscriptionId],
    references: [membershipSubscriptions.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  booking: one(bookings, {
    fields: [transactions.bookingId],
    references: [bookings.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  coach: one(users, {
    fields: [conversations.coachId],
    references: [users.id],
    relationName: 'coachConversations',
  }),
  client: one(users, {
    fields: [conversations.clientId],
    references: [users.id],
    relationName: 'clientConversations',
  }),
  messages: many(messages),
  iconnectPosts: many(iconnectPosts),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const sessionNotesRelations = relations(sessionNotes, ({ one }) => ({
  booking: one(bookings, {
    fields: [sessionNotes.bookingId],
    references: [bookings.id],
  }),
  coach: one(users, {
    fields: [sessionNotes.coachId],
    references: [users.id],
  }),
  template: one(sessionNoteTemplates, {
    fields: [sessionNotes.templateId],
    references: [sessionNoteTemplates.id],
  }),
}));

export const sessionNoteTemplatesRelations = relations(sessionNoteTemplates, ({ one }) => ({
  coach: one(users, {
    fields: [sessionNoteTemplates.coachId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  coach: one(users, {
    fields: [reviews.coachId],
    references: [users.id],
    relationName: 'coachReviews',
  }),
  client: one(users, {
    fields: [reviews.clientId],
    references: [users.id],
    relationName: 'clientReviews',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const coachProfilesRelations = relations(coachProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [coachProfiles.userId],
    references: [users.id],
  }),
  availability: many(coachAvailability),
  overrides: many(availabilityOverrides),
}));

export const coachAvailabilityRelations = relations(coachAvailability, ({ one }) => ({
  coachProfile: one(coachProfiles, {
    fields: [coachAvailability.coachId],
    references: [coachProfiles.userId],
  }),
}));

export const availabilityOverridesRelations = relations(availabilityOverrides, ({ one }) => ({
  coachProfile: one(coachProfiles, {
    fields: [availabilityOverrides.coachId],
    references: [coachProfiles.userId],
  }),
}));

export const groupSessionsRelations = relations(groupSessions, ({ one, many }) => ({
  coach: one(users, {
    fields: [groupSessions.coachId],
    references: [users.id],
  }),
  participants: many(groupSessionParticipants),
}));

export const groupSessionParticipantsRelations = relations(groupSessionParticipants, ({ one }) => ({
  groupSession: one(groupSessions, {
    fields: [groupSessionParticipants.groupSessionId],
    references: [groupSessions.id],
  }),
  client: one(users, {
    fields: [groupSessionParticipants.clientId],
    references: [users.id],
  }),
}));

export const iconnectPostsRelations = relations(iconnectPosts, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [iconnectPosts.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [iconnectPosts.senderUserId],
    references: [users.id],
  }),
  taskItems: many(iconnectTaskItems),
  comments: many(iconnectComments),
}));

export const iconnectTaskItemsRelations = relations(iconnectTaskItems, ({ one }) => ({
  post: one(iconnectPosts, {
    fields: [iconnectTaskItems.postId],
    references: [iconnectPosts.id],
  }),
}));

export const iconnectCommentsRelations = relations(iconnectComments, ({ one }) => ({
  post: one(iconnectPosts, {
    fields: [iconnectComments.postId],
    references: [iconnectPosts.id],
  }),
  sender: one(users, {
    fields: [iconnectComments.senderUserId],
    references: [users.id],
  }),
}));

export const coachInvitesRelations = relations(coachInvites, ({ one }) => ({
  inviter: one(users, {
    fields: [coachInvites.invitedBy],
    references: [users.id],
  }),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// CLIENT GROUPS TABLE
// ============================================================================

/**
 * Client Groups Table
 *
 * Organizational folders for coaches to group their clients.
 *
 * ## Purpose
 * Allows coaches to organize clients into named groups (e.g., "VIP", "Q1 Cohort").
 *
 * ## Relationships
 * - Belongs to users (as coach, many:1)
 * - Has many clientGroupMembers (1:N)
 */
export const clientGroups = pgTable(
  'client_groups',
  {
    id: serial('id').primaryKey(),

    /** The coach who owns this group */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Group name (unique per coach) */
    name: text('name').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('client_groups_coach_id_idx').on(table.coachId),
    unique('client_groups_coach_name_unique').on(table.coachId, table.name),
  ]
);

/** Type for selecting a client group record */
export type ClientGroup = typeof clientGroups.$inferSelect;

/** Type for inserting a new client group record */
export type NewClientGroup = typeof clientGroups.$inferInsert;

// ============================================================================
// CLIENT GROUP MEMBERS TABLE
// ============================================================================

/**
 * Client Group Members Table
 *
 * Junction table linking clients to their groups.
 *
 * ## Purpose
 * Tracks which clients belong to which coach-defined group.
 *
 * ## Relationships
 * - Belongs to clientGroups (many:1)
 * - Belongs to users (as client, many:1)
 */
export const clientGroupMembers = pgTable(
  'client_group_members',
  {
    id: serial('id').primaryKey(),

    /** The group this membership belongs to */
    groupId: integer('group_id')
      .notNull()
      .references(() => clientGroups.id, { onDelete: 'cascade' }),

    /** The client user in this group */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('client_group_members_group_id_idx').on(table.groupId),
    index('client_group_members_client_id_idx').on(table.clientId),
    unique('client_group_members_group_client_unique').on(table.groupId, table.clientId),
  ]
);

/** Type for selecting a client group member record */
export type ClientGroupMember = typeof clientGroupMembers.$inferSelect;

/** Type for inserting a new client group member record */
export type NewClientGroupMember = typeof clientGroupMembers.$inferInsert;

export const clientGroupsRelations = relations(clientGroups, ({ one, many }) => ({
  coach: one(users, {
    fields: [clientGroups.coachId],
    references: [users.id],
  }),
  members: many(clientGroupMembers),
}));

export const clientGroupMembersRelations = relations(clientGroupMembers, ({ one }) => ({
  group: one(clientGroups, {
    fields: [clientGroupMembers.groupId],
    references: [clientGroups.id],
  }),
  client: one(users, {
    fields: [clientGroupMembers.clientId],
    references: [users.id],
  }),
}));

// ============================================================================
// === Retention Features (S18) ===
// ============================================================================

// ============================================================================
// COACHING STREAKS TABLE
// ============================================================================

/**
 * Coaching Streaks Table
 *
 * Tracks the current and longest coaching streak per client.
 * A streak represents consecutive weeks of coaching engagement.
 *
 * ## Purpose
 * Gamification layer to encourage consistent client engagement.
 * One row per client, updated weekly by CRON job.
 *
 * ## Relationships
 * - Belongs to users (as client, 1:1 via unique index)
 * - Has many streakActivities (audit log)
 */
export const coachingStreaks = pgTable(
  'coaching_streaks',
  {
    id: serial('id').primaryKey(),

    /** The client whose streak is tracked */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Current consecutive weeks of engagement */
    currentStreak: integer('current_streak').notNull().default(0),

    /** All-time longest streak in weeks */
    longestStreak: integer('longest_streak').notNull().default(0),

    /** Timestamp of the most recent qualifying activity */
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),

    /** Day the week starts on (0=Sunday, 1=Monday) */
    weekStartsOn: integer('week_starts_on').notNull().default(1),

    /** When the current streak began */
    streakStartedAt: timestamp('streak_started_at', { withTimezone: true }),

    /** Whether the streak is at risk of breaking (no activity this week) */
    isAtRisk: boolean('is_at_risk').notNull().default(false),

    /** Whether the at-risk notification was already sent */
    notifiedAtRisk: boolean('notified_at_risk').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('coaching_streaks_user_id_idx').on(table.userId)]
);

/** Type for selecting a coaching streak record */
export type CoachingStreak = typeof coachingStreaks.$inferSelect;

/** Type for inserting a new coaching streak record */
export type NewCoachingStreak = typeof coachingStreaks.$inferInsert;

// ============================================================================
// STREAK ACTIVITIES TABLE
// ============================================================================

/**
 * Streak Activities Table
 *
 * Audit log of qualifying actions per week that contribute to streaks.
 *
 * ## Purpose
 * Records each qualifying action (session, check-in, message, etc.) with
 * ISO week/year for weekly aggregation.
 *
 * ## Relationships
 * - Belongs to users (as client, many:1)
 */
export const streakActivities = pgTable(
  'streak_activities',
  {
    id: serial('id').primaryKey(),

    /** The client who performed the action */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The type of qualifying action */
    actionType: streakActionTypeEnum('action_type').notNull(),

    /** Optional reference to the source entity (bookingId, actionItemId, etc.) */
    referenceId: text('reference_id'),

    /** ISO week number (1-53) */
    weekNumber: integer('week_number').notNull(),

    /** ISO year for the week */
    weekYear: integer('week_year').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('streak_activities_user_id_idx').on(table.userId),
    index('streak_activities_user_week_idx').on(table.userId, table.weekYear, table.weekNumber),
  ]
);

/** Type for selecting a streak activity record */
export type StreakActivity = typeof streakActivities.$inferSelect;

/** Type for inserting a new streak activity record */
export type NewStreakActivity = typeof streakActivities.$inferInsert;

// ============================================================================
// WEEKLY CHECK-INS TABLE
// ============================================================================

/**
 * Weekly Check-Ins Table
 *
 * Client mood check-ins submitted weekly to their coach.
 *
 * ## Purpose
 * Lightweight pulse-check allowing clients to share their mood and a brief note
 * with their coach between sessions.
 *
 * ## Relationships
 * - Belongs to users (as client, many:1)
 * - Belongs to users (as coach, many:1)
 *
 * ## Constraints
 * - One check-in per client-coach pair per week (unique index)
 * - Note max 280 chars (enforced at API level)
 */
export const weeklyCheckIns = pgTable(
  'weekly_check_ins',
  {
    id: serial('id').primaryKey(),

    /** The client submitting the check-in */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The coach receiving the check-in */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Client's self-reported mood */
    mood: checkInMoodEnum('mood').notNull(),

    /** Optional brief note (max 280 chars, enforced at API level) */
    note: text('note'),

    /** ISO week number (1-53) */
    weekNumber: integer('week_number').notNull(),

    /** ISO year for the week */
    weekYear: integer('week_year').notNull(),

    /** Day of week the check-in is prompted (0=Sun..6=Sat, default Wed) */
    checkInDay: integer('check_in_day').notNull().default(3),

    /** When the coach responded/acknowledged (null = pending) */
    respondedAt: timestamp('responded_at', { withTimezone: true }),

    /** When the check-in prompt was sent to the client */
    promptedAt: timestamp('prompted_at', { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('weekly_check_ins_user_coach_week_idx').on(
      table.userId,
      table.coachId,
      table.weekYear,
      table.weekNumber
    ),
    index('weekly_check_ins_coach_id_idx').on(table.coachId),
  ]
);

/** Type for selecting a weekly check-in record */
export type WeeklyCheckIn = typeof weeklyCheckIns.$inferSelect;

/** Type for inserting a new weekly check-in record */
export type NewWeeklyCheckIn = typeof weeklyCheckIns.$inferInsert;

// ============================================================================
// SESSION PREP RESPONSES TABLE
// ============================================================================

/**
 * Session Prep Responses Table
 *
 * Client-submitted preparation for upcoming sessions.
 *
 * ## Purpose
 * Captures client answers to prep questions before each session,
 * giving coaches context to prepare better sessions.
 *
 * ## Relationships
 * - Belongs to bookings (1:1 via unique index)
 * - Belongs to users (as client, many:1)
 * - Belongs to users (as coach, many:1)
 */
export const sessionPrepResponses = pgTable(
  'session_prep_responses',
  {
    id: serial('id').primaryKey(),

    /** The upcoming session this prep is for (unique — one prep per session) */
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),

    /** The client preparing for the session */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The coach for the session */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Client's answers to prep questions */
    responses: jsonb('responses').notNull().$type<Array<{ question: string; answer: string }>>(),

    /** When the prep prompt was sent to the client */
    promptedAt: timestamp('prompted_at', { withTimezone: true }).notNull().defaultNow(),

    /** When the client completed the prep (null = in progress) */
    completedAt: timestamp('completed_at', { withTimezone: true }),

    /** Whether the coach has viewed this prep */
    viewedByCoach: boolean('viewed_by_coach').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('session_prep_responses_booking_id_idx').on(table.bookingId),
    index('session_prep_responses_coach_id_idx').on(table.coachId),
    index('session_prep_responses_user_id_idx').on(table.userId),
  ]
);

/** Type for selecting a session prep response record */
export type SessionPrepResponse = typeof sessionPrepResponses.$inferSelect;

/** Type for inserting a new session prep response record */
export type NewSessionPrepResponse = typeof sessionPrepResponses.$inferInsert;

// ============================================================================
// SESSION PREP QUESTIONS TABLE
// ============================================================================

/**
 * Session Prep Questions Table
 *
 * Coach-configurable questions asked to clients before sessions.
 *
 * ## Purpose
 * Each coach can customize their prep questions (2-5 questions).
 * One row per coach (unique index). Default questions seeded for new coaches.
 *
 * ## Relationships
 * - Belongs to users (as coach, 1:1 via unique index)
 */
export const sessionPrepQuestions = pgTable(
  'session_prep_questions',
  {
    id: serial('id').primaryKey(),

    /** The coach who configured these questions (null = global default) */
    coachId: text('coach_id').references(() => users.id, { onDelete: 'cascade' }),

    /** Array of 2-5 prep questions */
    questions: jsonb('questions').notNull().$type<string[]>(),

    /** Whether these are the default questions */
    isDefault: boolean('is_default').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('session_prep_questions_coach_id_idx').on(table.coachId)]
);

/** Type for selecting a session prep questions record */
export type SessionPrepQuestion = typeof sessionPrepQuestions.$inferSelect;

/** Type for inserting a new session prep questions record */
export type NewSessionPrepQuestion = typeof sessionPrepQuestions.$inferInsert;

// ============================================================================
// FORMS TABLE (P0-08)
// ============================================================================

/**
 * Question shape stored inside `forms.questions` JSONB.
 *
 * Mirrors the Zod `formQuestionSchema` in `src/lib/validators/forms.ts`.
 * Kept minimal here to avoid a runtime dependency on the validators module.
 */
export interface FormQuestion {
  id: string;
  order: number;
  type: 'short_text' | 'long_text' | 'single_choice' | 'multi_choice' | 'rating' | 'yes_no';
  label: string;
  required: boolean;
  options?: string[];
}

/**
 * Forms Table (P0-08)
 *
 * Generic form primitive authored by coaches. Replaces the older session-prep
 * specific logic with a reusable structure for intake, feedback, progress
 * checks, and custom coach-authored questionnaires.
 *
 * ## Key Fields
 * - `coachId` - Owning coach (cascade delete)
 * - `formType` - Classification (intake | session_feedback | progress_check | custom)
 * - `questions` - Ordered array of typed questions (JSONB)
 * - `isPublished` - When true, the form is exposed via the public endpoint and
 *   accepts responses. Questions cannot be edited while published.
 *
 * ## Relationships
 * - Belongs to users (as coach)
 * - Has many form_responses
 */
export const forms = pgTable(
  'forms',
  {
    id: serial('id').primaryKey(),

    /** Coach who owns this form */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Display title */
    title: text('title').notNull(),

    /** Optional description shown to respondents */
    description: text('description'),

    /** Form classification */
    formType: formTypeEnum('form_type').notNull().default('custom'),

    /** Ordered list of typed questions */
    questions: jsonb('questions').notNull().default([]).$type<FormQuestion[]>(),

    /** When true, form accepts responses */
    isPublished: boolean('is_published').notNull().default(false),

    /** First time the form was published */
    publishedAt: timestamp('published_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('forms_coach_id_idx').on(table.coachId),
    index('forms_form_type_idx').on(table.formType),
  ]
);

/** Type for selecting a form record */
export type Form = typeof forms.$inferSelect;

/** Type for inserting a new form record */
export type NewForm = typeof forms.$inferInsert;

// ============================================================================
// FORM RESPONSES TABLE (P0-08)
// ============================================================================

/**
 * Form Responses Table (P0-08)
 *
 * Submitted answers to a published form. One row per submission.
 *
 * ## Key Fields
 * - `formId` - The form being answered (cascade delete)
 * - `respondentId` - User who submitted the response (cascade delete)
 * - `bookingId` - Optional link to a session (set null on booking delete)
 * - `answers` - Map of `questionId -> answer` (string | string[] | number | boolean)
 *
 * ## Relationships
 * - Belongs to forms
 * - Belongs to users (as respondent)
 * - Optionally belongs to bookings
 */
export const formResponses = pgTable(
  'form_responses',
  {
    id: serial('id').primaryKey(),

    /** The form this response belongs to */
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),

    /** User who submitted the response */
    respondentId: text('respondent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Optional booking this response is associated with */
    bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),

    /** Map of questionId -> answer value */
    answers: jsonb('answers')
      .notNull()
      .default({})
      .$type<Record<string, string | string[] | number | boolean>>(),

    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('form_responses_form_id_idx').on(table.formId),
    index('form_responses_respondent_id_idx').on(table.respondentId),
    index('form_responses_booking_id_idx').on(table.bookingId),
  ]
);

/** Type for selecting a form response record */
export type FormResponse = typeof formResponses.$inferSelect;

/** Type for inserting a new form response record */
export type NewFormResponse = typeof formResponses.$inferInsert;

// ============================================================================
// FORMS RELATIONS (P0-08)
// ============================================================================

export const formsRelations = relations(forms, ({ one, many }) => ({
  coach: one(users, {
    fields: [forms.coachId],
    references: [users.id],
  }),
  responses: many(formResponses),
}));

export const formResponsesRelations = relations(formResponses, ({ one }) => ({
  form: one(forms, {
    fields: [formResponses.formId],
    references: [forms.id],
  }),
  respondent: one(users, {
    fields: [formResponses.respondentId],
    references: [users.id],
  }),
  booking: one(bookings, {
    fields: [formResponses.bookingId],
    references: [bookings.id],
  }),
}));

// ============================================================================
// RETENTION FEATURES RELATIONS (S18)
// ============================================================================

export const coachingStreaksRelations = relations(coachingStreaks, ({ one, many }) => ({
  user: one(users, {
    fields: [coachingStreaks.userId],
    references: [users.id],
  }),
  activities: many(streakActivities),
}));

export const streakActivitiesRelations = relations(streakActivities, ({ one }) => ({
  user: one(users, {
    fields: [streakActivities.userId],
    references: [users.id],
  }),
  streak: one(coachingStreaks, {
    fields: [streakActivities.userId],
    references: [coachingStreaks.userId],
  }),
}));

export const weeklyCheckInsRelations = relations(weeklyCheckIns, ({ one }) => ({
  user: one(users, {
    fields: [weeklyCheckIns.userId],
    references: [users.id],
    relationName: 'clientCheckIns',
  }),
  coach: one(users, {
    fields: [weeklyCheckIns.coachId],
    references: [users.id],
    relationName: 'coachCheckIns',
  }),
}));

export const sessionPrepResponsesRelations = relations(sessionPrepResponses, ({ one }) => ({
  booking: one(bookings, {
    fields: [sessionPrepResponses.bookingId],
    references: [bookings.id],
  }),
  user: one(users, {
    fields: [sessionPrepResponses.userId],
    references: [users.id],
    relationName: 'clientPrepResponses',
  }),
  coach: one(users, {
    fields: [sessionPrepResponses.coachId],
    references: [users.id],
    relationName: 'coachPrepResponses',
  }),
}));

export const sessionPrepQuestionsRelations = relations(sessionPrepQuestions, ({ one }) => ({
  coach: one(users, {
    fields: [sessionPrepQuestions.coachId],
    references: [users.id],
  }),
}));

// ============================================================================
// ENUMS — PACKAGES & SUBSCRIPTIONS (P0-05 + P0-07)
// ============================================================================

export const packagePurchaseStatusEnum = pgEnum('package_purchase_status', [
  'active',
  'expired',
  'completed',
  'refunded',
]);

export const billingIntervalEnum = pgEnum('billing_interval', ['monthly', 'yearly']);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
]);

// ============================================================================
// PACKAGES TABLE (P0-05)
// ============================================================================

/**
 * Packages Table
 *
 * Multi-session coaching bundles coaches can sell at a discounted rate.
 * Clients purchase upfront and redeem sessions over time.
 */
export const packages = pgTable(
  'packages',
  {
    id: serial('id').primaryKey(),

    /** The coach offering this package */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Display name, e.g. "6-Session Functional Medicine Reset" */
    title: text('title').notNull(),

    /** Full description shown on coach profile */
    description: text('description'),

    /** Number of sessions included */
    sessionCount: integer('session_count').notNull(),

    /** Duration per session in minutes */
    sessionDuration: integer('session_duration').notNull(),

    /** Total bundle price in CENTS */
    priceCents: integer('price_cents').notNull(),

    /** Original (undiscounted) price in CENTS — for "save X" badge */
    originalPriceCents: integer('original_price_cents'),

    /** Days from purchase date within which sessions must be used */
    validityDays: integer('validity_days').notNull().default(180),

    /** Whether this package is publicly listed on the coach's profile */
    isPublished: boolean('is_published').notNull().default(false),

    /** Optional link to an existing session type on coach_profiles */
    sessionTypeId: text('session_type_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('packages_coach_id_idx').on(table.coachId),
    index('packages_is_published_idx').on(table.isPublished),
  ]
);

export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;

// ============================================================================
// PACKAGE PURCHASES TABLE (P0-05)
// ============================================================================

/**
 * Package Purchases Table
 *
 * Records when a client buys a coaching package.
 * Tracks session consumption and expiration.
 */
export const packagePurchases = pgTable(
  'package_purchases',
  {
    id: serial('id').primaryKey(),

    /** The package that was purchased */
    packageId: integer('package_id')
      .notNull()
      .references(() => packages.id, { onDelete: 'restrict' }),

    /** The client who purchased */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The coach (denormalized for query convenience) */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** When the package was paid for */
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),

    /** When the package expires (purchasedAt + validityDays) */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    /** Total sessions in this purchase (snapshot of package.sessionCount) */
    totalSessions: integer('total_sessions').notNull(),

    /** Sessions already used */
    usedSessions: integer('used_sessions').notNull().default(0),

    /** Total amount paid in CENTS */
    totalPaidCents: integer('total_paid_cents').notNull(),

    /** Platform fee in CENTS (varies by coach subscription plan) */
    platformFeeCents: integer('platform_fee_cents').notNull(),

    /** Coach payout in CENTS */
    coachPayoutCents: integer('coach_payout_cents').notNull(),

    /** Purchase lifecycle status */
    status: packagePurchaseStatusEnum('status').notNull().default('active'),

    /** Stripe Payment Intent ID */
    stripePaymentIntentId: text('stripe_payment_intent_id'),

    /** Stripe Checkout Session ID */
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('package_purchases_client_id_idx').on(table.clientId),
    index('package_purchases_coach_id_idx').on(table.coachId),
    index('package_purchases_package_id_idx').on(table.packageId),
    index('package_purchases_status_idx').on(table.status),
  ]
);

export type PackagePurchase = typeof packagePurchases.$inferSelect;
export type NewPackagePurchase = typeof packagePurchases.$inferInsert;

// ============================================================================
// COACH SUBSCRIPTIONS TABLE (P0-07)
// ============================================================================

/**
 * Coach Subscriptions Table
 *
 * SaaS subscription for coaches. Determines platform fee percentage and
 * feature limits. One row per coach (unique constraint on coachId).
 *
 * Plans: starter (10% fee, $39/mo) | pro (5% fee, $79/mo) | scale (3% fee, $149/mo)
 */
export const coachSubscriptions = pgTable(
  'coach_subscriptions',
  {
    id: serial('id').primaryKey(),

    /** The coach this subscription belongs to (unique — one plan per coach) */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Plan identifier: 'starter' | 'pro' | 'scale' */
    planId: text('plan_id').notNull().default('starter'),

    /** Billing cycle */
    billingInterval: billingIntervalEnum('billing_interval').notNull().default('monthly'),

    /** Stripe Subscription ID */
    stripeSubscriptionId: text('stripe_subscription_id'),

    /** Stripe Customer ID */
    stripeCustomerId: text('stripe_customer_id'),

    /** Subscription lifecycle status */
    status: subscriptionStatusEnum('status').notNull().default('trialing'),

    /** Start of current billing period */
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),

    /** End of current billing period */
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

    /** When the 14-day free trial ends */
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),

    /** Whether subscription cancels at end of period */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('coach_subscriptions_coach_id_idx').on(table.coachId),
    index('coach_subscriptions_status_idx').on(table.status),
    index('coach_subscriptions_stripe_sub_id_idx').on(table.stripeSubscriptionId),
  ]
);

export type CoachSubscription = typeof coachSubscriptions.$inferSelect;
export type NewCoachSubscription = typeof coachSubscriptions.$inferInsert;

// ============================================================================
// BOOKINGS — add packagePurchaseId FK (P0-05)
// NOTE: The column is added via migration 0030. The Drizzle relation below
// references it for ORM queries once the column exists in the DB.
// ============================================================================

// ============================================================================
// PACKAGES + SUBSCRIPTIONS RELATIONS
// ============================================================================

export const packagesRelations = relations(packages, ({ one, many }) => ({
  coach: one(users, {
    fields: [packages.coachId],
    references: [users.id],
  }),
  purchases: many(packagePurchases),
}));

export const packagePurchasesRelations = relations(packagePurchases, ({ one }) => ({
  package: one(packages, {
    fields: [packagePurchases.packageId],
    references: [packages.id],
  }),
  client: one(users, {
    fields: [packagePurchases.clientId],
    references: [users.id],
    relationName: 'clientPackagePurchases',
  }),
  coach: one(users, {
    fields: [packagePurchases.coachId],
    references: [users.id],
    relationName: 'coachPackagePurchases',
  }),
}));

export const coachSubscriptionsRelations = relations(coachSubscriptions, ({ one }) => ({
  coach: one(users, {
    fields: [coachSubscriptions.coachId],
    references: [users.id],
  }),
}));

// ============================================================================
// MEMBERSHIPS TABLE
// ============================================================================

/**
 * Memberships Table
 *
 * A coach-offered recurring retainer product. Clients purchase a membership
 * and are charged monthly by Stripe Subscriptions. Each billing period the
 * client gets a fresh allotment of sessions (`sessionsPerPeriod`) that they
 * can redeem against the coach, plus optional add-ons (e.g. unlimited
 * messaging).
 *
 * ## Purpose
 *
 * Unlike one-time session bookings or multi-session packages, memberships
 * are a recurring revenue model:
 * - Monthly auto-renewal via Stripe Subscriptions
 * - Session allotment resets each billing period
 * - Cancel-anytime (cancel_at_period_end by default)
 *
 * ## Relationships
 * - Belongs to users (as coach, many:1)
 * - Has many membershipSubscriptions
 *
 * ## Stripe Integration
 *
 * On creation the platform creates:
 * - A Stripe Product (stored in `stripeProductId`)
 * - A recurring Price (stored in `stripePriceId`, interval=month)
 *
 * Price changes create a NEW Stripe Price and update `stripePriceId`.
 * Existing subscriptions keep their original price until explicitly migrated.
 *
 * ## Soft Deletion
 *
 * `isActive=false` means the membership is hidden from the public profile
 * and no new subscriptions can be created, but existing subscriptions
 * continue to renew until canceled.
 *
 * @remarks
 * All monetary values in CENTS. Uses the coach's profile currency.
 */
export const memberships = pgTable(
  'memberships',
  {
    id: serial('id').primaryKey(),

    /**
     * The coach offering this membership
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Display name of the membership (e.g. "Premium Coaching")
     * @type {string}
     */
    name: text('name').notNull(),

    /**
     * Longer marketing description shown on the coach profile
     * @type {string | null}
     */
    description: text('description'),

    /**
     * Monthly price in CENTS
     * @type {number}
     * @example 40000 // $400.00 per month
     */
    monthlyPriceCents: integer('monthly_price_cents').notNull(),

    /**
     * Currency code (lowercase ISO)
     * @type {string}
     * @default 'usd'
     */
    currency: text('currency').notNull().default('usd'),

    /**
     * Number of sessions included in a billing period
     * @type {number}
     * @example 2 // 2 sessions per month
     */
    sessionsPerPeriod: integer('sessions_per_period').notNull(),

    /**
     * Whether unlimited messaging is included with this membership
     * @type {boolean}
     * @default true
     */
    includesMessaging: boolean('includes_messaging').notNull().default(true),

    /**
     * Stripe Product ID (created when the membership is created)
     * @type {string | null}
     * @example "prod_abc123"
     */
    stripeProductId: text('stripe_product_id'),

    /**
     * Current Stripe Price ID used for new checkouts
     * @type {string | null}
     * @example "price_abc123"
     *
     * @remarks
     * Stripe Prices are immutable — updating the monthly price creates a
     * new Price and rotates this pointer. Existing subscriptions keep the
     * old price until migrated.
     */
    stripePriceId: text('stripe_price_id'),

    /**
     * Whether the membership is currently offered for new subscriptions
     * @type {boolean}
     * @default true
     */
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('memberships_coach_id_idx').on(table.coachId),
    index('memberships_is_active_idx').on(table.isActive),
  ]
);

/** Type for selecting a membership record */
export type Membership = typeof memberships.$inferSelect;

/** Type for inserting a new membership record */
export type NewMembership = typeof memberships.$inferInsert;

// ============================================================================
// MEMBERSHIP SUBSCRIPTIONS TABLE
// ============================================================================

/**
 * Membership Subscriptions Table
 *
 * A client's active (or historical) subscription to a coach's membership.
 * Mirrors the core fields of a Stripe Subscription so we can drive the UI
 * without round-tripping to Stripe on every request.
 *
 * ## Purpose
 * Tracks:
 * - Subscription state (active / past_due / canceled / incomplete)
 * - Current billing period window (start / end)
 * - Session allotment remaining in THIS period
 * - Pending cancellation (cancel_at_period_end)
 *
 * ## Relationships
 * - Belongs to memberships (many:1)
 * - Belongs to users as client (many:1)
 * - Belongs to users as coach (denormalized for query speed) (many:1)
 * - Has many bookings (sessions redeemed from this subscription)
 *
 * ## Session Allotment
 *
 * `sessionsRemainingThisPeriod` is initialized to the membership's
 * `sessionsPerPeriod` on creation and on every `invoice.payment_succeeded`
 * for a renewal. Each redeemed booking decrements the counter.
 *
 * ## Grace Period
 *
 * When Stripe reports `past_due` we keep the subscription usable for a
 * short grace window (handled in app logic, not schema) so a failed
 * renewal doesn't immediately block bookings already scheduled.
 *
 * @remarks
 * `stripeSubscriptionId` is unique — webhook lookups use it to dedupe
 * and locate the row idempotently.
 */
export const membershipSubscriptions = pgTable(
  'membership_subscriptions',
  {
    id: serial('id').primaryKey(),

    /**
     * The membership this subscription is for
     * @type {number}
     */
    membershipId: integer('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'restrict' }),

    /**
     * Client who owns this subscription
     * @type {string}
     */
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Coach who receives the subscription revenue.
     * Denormalized from memberships.coach_id for faster queries
     * (e.g. "does this client have an active membership with coach X?").
     *
     * @type {string}
     */
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Stripe Subscription ID (unique)
     * @type {string}
     * @example "sub_abc123"
     */
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),

    /**
     * Stripe Customer ID attached to this subscription
     * @type {string}
     */
    stripeCustomerId: text('stripe_customer_id').notNull(),

    /**
     * Current lifecycle state of the subscription
     * @type {'active' | 'past_due' | 'canceled' | 'incomplete'}
     * @default 'incomplete'
     */
    status: membershipSubscriptionStatusEnum('status').notNull().default('incomplete'),

    /**
     * Start of the current billing period (UTC)
     * @type {Date}
     */
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),

    /**
     * End of the current billing period (UTC).
     *
     * Also acts as the renewal date for active subscriptions, and as the
     * access cutoff when `cancelAtPeriodEnd=true`.
     *
     * @type {Date}
     */
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),

    /**
     * Sessions the client can still redeem in this billing period.
     * Reset to membership.sessionsPerPeriod on every renewal.
     *
     * @type {number}
     */
    sessionsRemainingThisPeriod: integer('sessions_remaining_this_period').notNull(),

    /**
     * If true, the subscription will NOT renew at the end of the current
     * period. The client retains access until `currentPeriodEnd`.
     *
     * @type {boolean}
     * @default false
     */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),

    /**
     * When the subscription was actually canceled (either immediately or at
     * the end of the period).
     *
     * @type {Date | null}
     */
    canceledAt: timestamp('canceled_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('membership_subscriptions_membership_id_idx').on(table.membershipId),
    index('membership_subscriptions_client_id_idx').on(table.clientId),
    index('membership_subscriptions_coach_id_idx').on(table.coachId),
    index('membership_subscriptions_status_idx').on(table.status),
    // Fast lookup when checking "does this client have an active membership with this coach?"
    index('membership_subscriptions_client_coach_status_idx').on(
      table.clientId,
      table.coachId,
      table.status
    ),
  ]
);

/** Type for selecting a membership subscription record */
export type MembershipSubscription = typeof membershipSubscriptions.$inferSelect;

/** Type for inserting a new membership subscription record */
export type NewMembershipSubscription = typeof membershipSubscriptions.$inferInsert;

// ============================================================================
// MEMBERSHIP RELATIONS
// ============================================================================

export const membershipsRelations = relations(memberships, ({ one, many }) => ({
  coach: one(users, {
    fields: [memberships.coachId],
    references: [users.id],
    relationName: 'coachMemberships',
  }),
  subscriptions: many(membershipSubscriptions),
}));

export const membershipSubscriptionsRelations = relations(
  membershipSubscriptions,
  ({ one, many }) => ({
    membership: one(memberships, {
      fields: [membershipSubscriptions.membershipId],
      references: [memberships.id],
    }),
    client: one(users, {
      fields: [membershipSubscriptions.clientId],
      references: [users.id],
      relationName: 'clientMembershipSubscriptions',
    }),
    coach: one(users, {
      fields: [membershipSubscriptions.coachId],
      references: [users.id],
      relationName: 'coachMembershipSubscriptions',
    }),
    bookings: many(bookings),
  })
);
