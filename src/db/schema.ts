import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

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
