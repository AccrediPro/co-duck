import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq, and, or, ne, desc, sql, inArray } from 'drizzle-orm';
import { db, conversations, users, iconnectPosts } from '@/db';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactList, type IConnectContact } from '@/components/iconnect/contact-list';

export const metadata = {
  title: 'iConnect | Coaching Platform',
  description: 'Your personal feed with your coach or client',
};

export default async function IConnectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    redirect('/dashboard');
  }

  const currentUser = userRecords[0];

  // Fetch all conversations where user is coach or client
  const conversationsData = await db
    .select({
      id: conversations.id,
      coachId: conversations.coachId,
      clientId: conversations.clientId,
    })
    .from(conversations)
    .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)));

  if (conversationsData.length === 0) {
    const otherPartyLabel = currentUser.role === 'coach' ? 'clients' : 'coaches';
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">iConnect</CardTitle>
            <CardDescription>Your personal feed with {otherPartyLabel}</CardDescription>
          </CardHeader>
        </Card>
        <div className="mt-6">
          <ContactList contacts={[]} userRole={currentUser.role} />
        </div>
      </div>
    );
  }

  // Batch-fetch other users info
  const otherUserIds = conversationsData.map((c) =>
    c.coachId === userId ? c.clientId : c.coachId
  );
  const uniqueOtherUserIds = Array.from(new Set(otherUserIds));

  const otherUsersData = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(inArray(users.id, uniqueOtherUserIds));

  const usersMap = new Map(otherUsersData.map((u) => [u.id, u]));

  // Batch-fetch latest iConnect post per conversation using a subquery approach
  const conversationIds = conversationsData.map((c) => c.id);

  // Get latest post per conversation (single query with DISTINCT ON equivalent)
  const latestPostsRaw = await db
    .select({
      conversationId: iconnectPosts.conversationId,
      content: iconnectPosts.content,
      type: iconnectPosts.type,
      createdAt: iconnectPosts.createdAt,
    })
    .from(iconnectPosts)
    .where(inArray(iconnectPosts.conversationId, conversationIds))
    .orderBy(desc(iconnectPosts.createdAt));

  // Deduplicate: keep only the first (newest) post per conversation
  const latestPostMap = new Map<number, { content: string | null; type: string; createdAt: Date }>();
  for (const post of latestPostsRaw) {
    if (!latestPostMap.has(post.conversationId)) {
      latestPostMap.set(post.conversationId, {
        content: post.content,
        type: post.type,
        createdAt: post.createdAt,
      });
    }
  }

  // Batch-fetch unread counts per conversation
  const unreadCounts = await db
    .select({
      conversationId: iconnectPosts.conversationId,
      count: sql<number>`count(*)`,
    })
    .from(iconnectPosts)
    .where(
      and(
        inArray(iconnectPosts.conversationId, conversationIds),
        ne(iconnectPosts.senderUserId, userId),
        eq(iconnectPosts.isRead, false)
      )
    )
    .groupBy(iconnectPosts.conversationId);

  const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, Number(u.count)]));

  // Assemble contacts
  const contacts: IConnectContact[] = conversationsData.map((conv) => {
    const otherUserId = conv.coachId === userId ? conv.clientId : conv.coachId;
    const otherUser = usersMap.get(otherUserId);
    const latestPost = latestPostMap.get(conv.id);
    const unreadCount = unreadMap.get(conv.id) || 0;

    let previewText: string | null = null;
    if (latestPost) {
      if (latestPost.type === 'task') {
        previewText = latestPost.content || 'New task';
      } else if (latestPost.type === 'image') {
        previewText = latestPost.content || 'Shared an image';
      } else {
        previewText = latestPost.content;
      }
    }

    return {
      conversationId: conv.id,
      otherUserId,
      otherUserName: otherUser?.name || null,
      otherUserAvatar: otherUser?.avatarUrl || null,
      otherUserRole: otherUser?.role || 'client',
      lastPostContent: previewText,
      lastPostAt: latestPost?.createdAt || null,
      unreadCount,
    };
  });

  // Sort: conversations with posts first (by recency), then those without posts
  contacts.sort((a, b) => {
    if (a.lastPostAt && b.lastPostAt) {
      return new Date(b.lastPostAt).getTime() - new Date(a.lastPostAt).getTime();
    }
    if (a.lastPostAt && !b.lastPostAt) return -1;
    if (!a.lastPostAt && b.lastPostAt) return 1;
    return 0;
  });

  const otherPartyLabel = currentUser.role === 'coach' ? 'clients' : 'coaches';

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">iConnect</CardTitle>
          <CardDescription>Your personal feed with {otherPartyLabel}</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <ContactList contacts={contacts} userRole={currentUser.role} />
      </div>
    </div>
  );
}
