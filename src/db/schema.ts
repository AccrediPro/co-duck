import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  boolean,
  index,
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
