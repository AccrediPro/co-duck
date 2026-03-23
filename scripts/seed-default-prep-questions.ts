/**
 * Seed default session prep questions.
 *
 * Creates a single "default" row in sessionPrepQuestions (coachId=null, isDefault=true)
 * that serves as the fallback template for coaches who haven't customized theirs.
 *
 * Idempotent — skips if defaults already exist.
 *
 * Usage: npx tsx scripts/seed-default-prep-questions.ts
 */

import 'dotenv/config';
import { db } from '../src/db';
import { sessionPrepQuestions } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const defaultQuestions = [
  "Qual è la cosa più importante di cui vuoi parlare nella prossima sessione?",
  "Come ti senti rispetto all'ultimo obiettivo che ci siamo dati?",
  "C'è qualcosa che è successo questa settimana che vuoi condividere?",
];

async function seed() {
  console.log('Seeding default session prep questions...');

  // Check if defaults already exist
  const existing = await db
    .select({ id: sessionPrepQuestions.id })
    .from(sessionPrepQuestions)
    .where(eq(sessionPrepQuestions.isDefault, true));

  if (existing.length > 0) {
    console.log('Default prep questions already exist, skipping.');
    process.exit(0);
  }

  const inserted = await db
    .insert(sessionPrepQuestions)
    .values({
      coachId: null,
      questions: defaultQuestions,
      isDefault: true,
    })
    .returning({ id: sessionPrepQuestions.id });

  console.log(`Inserted default prep questions (id: ${inserted[0].id}):`);
  defaultQuestions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  console.log('Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
