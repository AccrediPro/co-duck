/**
 * Seed system session note templates.
 *
 * Usage: npx tsx scripts/seed-templates.ts
 */

import 'dotenv/config';
import { db } from '../src/db';
import { sessionNoteTemplates } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const systemTemplates = [
  {
    name: 'GROW Model',
    description: 'Goal, Reality, Options, Way Forward — the classic coaching framework',
    sections: [
      { title: 'Goal', placeholder: 'What does the client want to achieve?', type: 'textarea' as const },
      { title: 'Reality', placeholder: 'What is the current situation?', type: 'textarea' as const },
      { title: 'Options', placeholder: 'What options are available?', type: 'textarea' as const },
      { title: 'Way Forward', placeholder: 'What will the client do next?', type: 'textarea' as const },
    ],
    isSystem: true,
    coachId: null,
  },
  {
    name: 'SMART Goals',
    description: 'Specific, Measurable, Achievable, Relevant, Time-bound goal setting',
    sections: [
      { title: 'Specific', placeholder: 'What exactly will be accomplished?', type: 'textarea' as const },
      { title: 'Measurable', placeholder: 'How will progress be measured?', type: 'textarea' as const },
      { title: 'Achievable', placeholder: 'Is this goal realistic? What resources are needed?', type: 'textarea' as const },
      { title: 'Relevant', placeholder: 'Why does this goal matter? How does it align with broader objectives?', type: 'textarea' as const },
      { title: 'Time-bound', placeholder: 'What is the deadline or timeline?', type: 'textarea' as const },
      { title: 'Action Plan', placeholder: 'What are the specific next steps?', type: 'textarea' as const },
    ],
    isSystem: true,
    coachId: null,
  },
  {
    name: 'General Coaching',
    description: 'Simple structured format for any coaching session',
    sections: [
      { title: 'Session Topic', placeholder: 'What was the main focus of this session?', type: 'textarea' as const },
      { title: 'Key Insights', placeholder: 'What insights or breakthroughs emerged?', type: 'textarea' as const },
      { title: 'Action Items', placeholder: 'What actions did the client commit to?', type: 'textarea' as const },
      { title: 'Follow-up Notes', placeholder: 'What to follow up on in the next session?', type: 'textarea' as const },
    ],
    isSystem: true,
    coachId: null,
  },
  {
    name: 'Appreciative Inquiry',
    description: 'Strengths-based approach: Discovery, Dream, Design, Destiny',
    sections: [
      { title: 'Discovery', placeholder: 'What is working well? What strengths were identified?', type: 'textarea' as const },
      { title: 'Dream', placeholder: 'What does the ideal future look like?', type: 'textarea' as const },
      { title: 'Design', placeholder: 'What changes or structures will support the dream?', type: 'textarea' as const },
      { title: 'Destiny', placeholder: 'What commitments and next steps were agreed upon?', type: 'textarea' as const },
    ],
    isSystem: true,
    coachId: null,
  },
];

async function seed() {
  console.log('Seeding system session note templates...');

  // Check existing system templates to avoid duplicates
  const existing = await db
    .select({ name: sessionNoteTemplates.name })
    .from(sessionNoteTemplates)
    .where(eq(sessionNoteTemplates.isSystem, true));

  const existingNames = new Set(existing.map((t) => t.name));

  const toInsert = systemTemplates.filter((t) => !existingNames.has(t.name));

  if (toInsert.length === 0) {
    console.log('All system templates already exist, skipping.');
    process.exit(0);
  }

  const inserted = await db.insert(sessionNoteTemplates).values(toInsert).returning({ id: sessionNoteTemplates.id, name: sessionNoteTemplates.name });

  console.log(`Inserted ${inserted.length} system templates:`);
  inserted.forEach((t) => console.log(`  - [${t.id}] ${t.name}`));
  console.log('Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
