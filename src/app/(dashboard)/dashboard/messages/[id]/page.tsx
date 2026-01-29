import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { eq, or, and } from 'drizzle-orm';
import { db, users, conversations } from '@/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, MessageSquare } from 'lucide-react';

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

  const conversation = conversationRecords[0];
  const isCoach = conversation.coachId === userId;
  const otherUserId = isCoach ? conversation.clientId : conversation.coachId;

  // Get other user's info
  const otherUserRecords = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, otherUserId))
    .limit(1);

  const otherUserName = otherUserRecords[0]?.name || 'User';

  // Placeholder for COACH-038: Chat View Component
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/messages">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to messages</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{otherUserName}</h1>
          <p className="text-muted-foreground">{isCoach ? 'Client' : 'Coach'}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Chat Coming Soon</CardTitle>
              <CardDescription>
                The full chat interface is being built. Check back soon!
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You will be able to send and receive messages with {otherUserName} here. The chat
            feature will include real-time messaging, message history, and read receipts.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/dashboard/messages">Back to Messages</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
