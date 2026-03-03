import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { eq, or, and } from 'drizzle-orm';
import { db, users, conversations } from '@/db';
import { ChatView } from '@/components/messages';
import { getConversationDetails, getMessages, getClientContext } from './actions';

export const metadata = {
  title: 'Conversation | Coaching Platform',
  description: 'Chat with your coach or client',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { id: conversationIdStr } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const conversationId = parseInt(conversationIdStr, 10);

  if (isNaN(conversationId)) {
    notFound();
  }

  // Check if user exists
  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    redirect('/dashboard');
  }

  // Get conversation and verify user is a participant
  const conversationRecords = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
      )
    )
    .limit(1);

  if (conversationRecords.length === 0) {
    notFound();
  }

  // Fetch conversation details
  const detailsResult = await getConversationDetails(conversationId);

  if (!detailsResult.success || !detailsResult.conversation) {
    notFound();
  }

  // Fetch initial messages (last 50)
  const messagesResult = await getMessages(conversationId, 50);

  const initialMessages = messagesResult.success ? messagesResult.messages || [] : [];
  const hasMore = messagesResult.success ? messagesResult.hasMore || false : false;

  // Fetch client context for coaches
  let clientContext = null;
  if (detailsResult.conversation.isCoach) {
    const contextResult = await getClientContext(conversationId);
    if (contextResult.success && contextResult.context) {
      clientContext = contextResult.context;
    }
  }

  return (
    <div>
      <ChatView
        conversation={detailsResult.conversation}
        initialMessages={initialMessages}
        initialHasMore={hasMore}
        clientContext={clientContext}
      />
    </div>
  );
}
