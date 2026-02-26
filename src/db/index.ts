import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ⚠️ SUPABASE DATABASE - DO NOT CHANGE TO NEON ⚠️
// This project uses Supabase with postgres-js driver.
// Changing to @neondatabase/serverless will break the connection.

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 10 });

export const db = drizzle(client, { schema });

export * from './schema';
