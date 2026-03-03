import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { eq, desc, inArray } from 'drizzle-orm';
import { db, conversations, users, iconnectPosts, iconnectTaskItems } from '@/db';
import { FeedView, type FeedPost, type FeedTaskItem } from '@/components/iconnect/feed-view';

const POSTS_PER_PAGE = 20;

export const metadata = {
  title: 'iConnect Feed | Coaching Platform',
};

export default async function IConnectFeedPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { conversationId: conversationIdParam } = await params;
  const conversationId = parseInt(conversationIdParam);
  if (isNaN(conversationId)) notFound();

  // Verify user is a participant
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (!conversation) notFound();
  if (conversation.coachId !== userId && conversation.clientId !== userId) notFound();

  // Determine other user
  const otherUserId =
    conversation.coachId === userId ? conversation.clientId : conversation.coachId;

  // Fetch other user info + posts in parallel
  const [otherUserData, postsRaw] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, otherUserId))
      .limit(1),
    db
      .select()
      .from(iconnectPosts)
      .where(eq(iconnectPosts.conversationId, conversationId))
      .orderBy(desc(iconnectPosts.createdAt))
      .limit(POSTS_PER_PAGE + 1),
  ]);

  const otherUser = otherUserData[0] || { id: otherUserId, name: null, avatarUrl: null };

  const hasMore = postsRaw.length > POSTS_PER_PAGE;
  const paginatedPosts = postsRaw.slice(0, POSTS_PER_PAGE);

  // Batch-fetch task items for task-type posts
  const taskPostIds = paginatedPosts.filter((p) => p.type === 'task').map((p) => p.id);
  const taskItems =
    taskPostIds.length > 0
      ? await db
          .select()
          .from(iconnectTaskItems)
          .where(inArray(iconnectTaskItems.postId, taskPostIds))
      : [];

  const taskItemsByPost = new Map<number, FeedTaskItem[]>();
  for (const item of taskItems) {
    const existing = taskItemsByPost.get(item.postId) || [];
    existing.push({
      id: item.id,
      postId: item.postId,
      label: item.label,
      completed: item.completed,
      completedAt: item.completedAt?.toISOString() || null,
    });
    taskItemsByPost.set(item.postId, existing);
  }

  // Batch-fetch sender info
  const senderIds = Array.from(new Set(paginatedPosts.map((p) => p.senderUserId)));
  const senders =
    senderIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(inArray(users.id, senderIds))
      : [];
  const sendersMap = new Map(senders.map((u) => [u.id, u]));

  // Format posts for client component (serialize dates)
  const formattedPosts: FeedPost[] = paginatedPosts.map((post) => {
    const sender = sendersMap.get(post.senderUserId);
    return {
      id: post.id,
      conversationId: post.conversationId,
      type: post.type,
      content: post.content,
      imageUrl: post.imageUrl,
      isRead: post.isRead,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      sender: sender
        ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl }
        : null,
      taskItems: post.type === 'task' ? taskItemsByPost.get(post.id) || [] : undefined,
    };
  });

  return (
    <FeedView
      initialPosts={formattedPosts}
      initialHasMore={hasMore}
      conversationId={conversationId}
      currentUserId={userId}
      otherUser={otherUser}
    />
  );
}
