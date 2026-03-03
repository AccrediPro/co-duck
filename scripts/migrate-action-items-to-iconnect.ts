/**
 * Migration: action_items → iConnect posts + task items
 *
 * Each action item becomes an iConnect post (type='task') with one task item.
 * The conversation between the coach and client is found or created.
 *
 * Usage:
 *   npx tsx scripts/migrate-action-items-to-iconnect.ts
 *   npx tsx scripts/migrate-action-items-to-iconnect.ts --dry-run
 */

import 'dotenv/config';
import { db } from '../src/db';
import {
  actionItems,
  conversations,
  iconnectPosts,
  iconnectTaskItems,
} from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
  console.log('[DRY RUN] No writes will be performed.\n');
}

async function findOrCreateConversation(
  coachId: string,
  clientId: string
): Promise<number> {
  const existing = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.coachId, coachId), eq(conversations.clientId, clientId)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  if (isDryRun) {
    console.log(`  [DRY RUN] Would create conversation: coachId=${coachId}, clientId=${clientId}`);
    // Return a placeholder ID so the rest of the dry-run can proceed
    return -1;
  }

  const [created] = await db
    .insert(conversations)
    .values({ coachId, clientId })
    .returning({ id: conversations.id });

  return created.id;
}

async function alreadyMigrated(
  conversationId: number,
  content: string,
  createdAt: Date
): Promise<boolean> {
  if (conversationId === -1) {
    // Dry-run placeholder — treat as not yet migrated
    return false;
  }

  const existing = await db
    .select({ id: iconnectPosts.id })
    .from(iconnectPosts)
    .where(
      and(
        eq(iconnectPosts.conversationId, conversationId),
        eq(iconnectPosts.type, 'task'),
        eq(iconnectPosts.content, content),
        eq(iconnectPosts.createdAt, createdAt)
      )
    )
    .limit(1);

  return existing.length > 0;
}

async function migrateItem(item: typeof actionItems.$inferSelect): Promise<'migrated' | 'skipped' | 'error'> {
  const content = item.description
    ? `${item.title}\n${item.description}`
    : item.title;

  try {
    const conversationId = await findOrCreateConversation(item.coachId, item.clientId);

    const skipped = await alreadyMigrated(conversationId, content, item.createdAt);
    if (skipped) {
      console.log(`  SKIP  id=${item.id} "${item.title}" — already migrated`);
      return 'skipped';
    }

    if (isDryRun) {
      console.log(
        `  [DRY RUN] Would migrate id=${item.id} "${item.title}"` +
          ` → conversationId=${conversationId}, completed=${item.isCompleted}`
      );
      return 'migrated';
    }

    await db.transaction(async (tx) => {
      const [post] = await tx
        .insert(iconnectPosts)
        .values({
          conversationId,
          senderUserId: item.coachId,
          type: 'task',
          content,
          createdAt: item.createdAt,
        })
        .returning({ id: iconnectPosts.id });

      await tx.insert(iconnectTaskItems).values({
        postId: post.id,
        label: item.title,
        completed: item.isCompleted,
        completedAt: item.isCompleted ? item.updatedAt : null,
      });
    });

    console.log(`  OK    id=${item.id} "${item.title}"`);
    return 'migrated';
  } catch (err) {
    console.error(`  ERROR id=${item.id} "${item.title}":`, err instanceof Error ? err.message : err);
    return 'error';
  }
}

async function main() {
  const allItems = await db.select().from(actionItems).orderBy(actionItems.id);

  const total = allItems.length;
  console.log(`Found ${total} action items to process.\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    process.stdout.write(`[${i + 1}/${total}] `);
    const result = await migrateItem(item);
    if (result === 'migrated') migrated++;
    else if (result === 'skipped') skipped++;
    else errors++;
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total:    ${total}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped:  ${skipped} (already migrated)`);
  console.log(`Errors:   ${errors}`);

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes were written to the database.');
  } else {
    console.log('\nMigration complete.');
  }

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
