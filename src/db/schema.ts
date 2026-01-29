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
} from 'drizzle-orm/pg-core';

// Role enum for users
export const userRoleEnum = pgEnum('user_role', ['admin', 'coach', 'client']);

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
