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
} from 'drizzle-orm/pg-core';

// Role enum for users
export const userRoleEnum = pgEnum('user_role', ['admin', 'coach', 'client']);

// Booking status enum
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

// Transaction status enum
export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Will use Clerk user ID
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').notNull().default('client'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Session type stored in JSONB
export interface SessionType {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number; // in cents
}

// Coach profiles table
export const coachProfiles = pgTable(
  'coach_profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    headline: text('headline'),
    bio: text('bio'),
    specialties: jsonb('specialties').$type<string[]>().default([]),
    hourlyRate: integer('hourly_rate'), // Stored in cents
    currency: text('currency').default('USD'),
    timezone: text('timezone'),
    videoIntroUrl: text('video_intro_url'),
    sessionTypes: jsonb('session_types').$type<SessionType[]>().default([]),
    isPublished: boolean('is_published').notNull().default(false),
    profileCompletionPercentage: integer('profile_completion_percentage').notNull().default(0),
    // Availability settings
    bufferMinutes: integer('buffer_minutes').notNull().default(15),
    advanceNoticeHours: integer('advance_notice_hours').notNull().default(24),
    maxAdvanceDays: integer('max_advance_days').notNull().default(60),
    // Stripe Connect fields
    stripeAccountId: text('stripe_account_id'),
    stripeOnboardingComplete: boolean('stripe_onboarding_complete').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('coach_profiles_slug_idx').on(table.slug),
    index('coach_profiles_is_published_idx').on(table.isPublished),
  ]
);

// Coach profile type exports
export type CoachProfile = typeof coachProfiles.$inferSelect;
export type NewCoachProfile = typeof coachProfiles.$inferInsert;

// Coach weekly availability table (recurring schedule)
export const coachAvailability = pgTable(
  'coach_availability',
  {
    id: serial('id').primaryKey(),
    coachId: text('coach_id')
      .notNull()
      .references(() => coachProfiles.userId, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 6 = Saturday
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('coach_availability_coach_id_idx').on(table.coachId),
    index('coach_availability_day_of_week_idx').on(table.dayOfWeek),
  ]
);

// Coach availability type exports
export type CoachAvailability = typeof coachAvailability.$inferSelect;
export type NewCoachAvailability = typeof coachAvailability.$inferInsert;

// Availability overrides for date-specific exceptions
export const availabilityOverrides = pgTable(
  'availability_overrides',
  {
    id: serial('id').primaryKey(),
    coachId: text('coach_id')
      .notNull()
      .references(() => coachProfiles.userId, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    isAvailable: boolean('is_available').notNull().default(false),
    startTime: time('start_time'), // Null if not available
    endTime: time('end_time'), // Null if not available
    reason: text('reason'), // Optional reason for the override (e.g., "Holiday", "Vacation")
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('availability_overrides_coach_id_idx').on(table.coachId),
    index('availability_overrides_date_idx').on(table.date),
    index('availability_overrides_coach_date_idx').on(table.coachId, table.date),
  ]
);

// Availability override type exports
export type AvailabilityOverride = typeof availabilityOverrides.$inferSelect;
export type NewAvailabilityOverride = typeof availabilityOverrides.$inferInsert;

// Session type snapshot stored in booking JSONB (captures pricing at time of booking)
export interface BookingSessionType {
  name: string;
  duration: number; // in minutes
  price: number; // in cents
}

// Bookings table
export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionType: jsonb('session_type').$type<BookingSessionType>().notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    status: bookingStatusEnum('status').notNull().default('pending'),
    clientNotes: text('client_notes'), // Notes from client when booking
    coachNotes: text('coach_notes'), // Private notes from coach
    cancelledBy: text('cancelled_by').references(() => users.id), // Who cancelled (if cancelled)
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('bookings_coach_id_idx').on(table.coachId),
    index('bookings_client_id_idx').on(table.clientId),
    index('bookings_start_time_idx').on(table.startTime),
    index('bookings_status_idx').on(table.status),
  ]
);

// Booking type exports
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

// Transactions table (for payment tracking)
export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }), // Nullable for future non-booking transactions
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(), // Total amount in cents
    currency: text('currency').notNull().default('usd'),
    platformFeeCents: integer('platform_fee_cents').notNull(), // Platform fee (e.g., 10% of amount)
    coachPayoutCents: integer('coach_payout_cents').notNull(), // Amount minus platform fee
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    stripeTransferId: text('stripe_transfer_id'), // For transfers to coach's connected account
    status: transactionStatusEnum('status').notNull().default('pending'),
    refundAmountCents: integer('refund_amount_cents'), // Nullable, populated on refund
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('transactions_booking_id_idx').on(table.bookingId),
    index('transactions_coach_id_idx').on(table.coachId),
    index('transactions_client_id_idx').on(table.clientId),
    index('transactions_status_idx').on(table.status),
  ]
);

// Transaction type exports
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Message type enum
export const messageTypeEnum = pgEnum('message_type', ['text', 'system']);

// Conversations table (for messaging between coach and client)
export const conversations = pgTable(
  'conversations',
  {
    id: serial('id').primaryKey(),
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('conversations_coach_id_idx').on(table.coachId),
    index('conversations_client_id_idx').on(table.clientId),
    index('conversations_last_message_at_idx').on(table.lastMessageAt),
    unique('conversations_coach_client_unique').on(table.coachId, table.clientId),
  ]
);

// Conversation type exports
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

// Messages table
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    messageType: messageTypeEnum('message_type').notNull().default('text'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_sender_id_idx').on(table.senderId),
    index('messages_created_at_idx').on(table.createdAt),
  ]
);

// Message type exports
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
