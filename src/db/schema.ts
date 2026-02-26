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
  time,
  date,
  serial,
  unique,
  varchar,
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
     * Array of coaching specialties/focus areas
     * @type {string[]}
     * @default []
     * @example ["Career Coaching", "Executive Coaching", "Work-Life Balance"]
     *
     * @remarks
     * Can include predefined values from COACH_SPECIALTIES constant
     * or custom specialties added by the coach.
     */
    specialties: jsonb('specialties').$type<string[]>().default([]),

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
  ]
);

/** Type for selecting a message record */
export type Message = typeof messages.$inferSelect;

/** Type for inserting a new message record */
export type NewMessage = typeof messages.$inferInsert;

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
     * The note content
     * @type {string}
     */
    content: text('content').notNull(),

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

    /** Longer description/body text */
    body: text('body'),

    /** Deep link path within the app (e.g., "/dashboard/sessions/42") */
    link: text('link'),

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

export const groupSessionParticipantsRelations = relations(
  groupSessionParticipants,
  ({ one }) => ({
    groupSession: one(groupSessions, {
      fields: [groupSessionParticipants.groupSessionId],
      references: [groupSessions.id],
    }),
    client: one(users, {
      fields: [groupSessionParticipants.clientId],
      references: [users.id],
    }),
  })
);
