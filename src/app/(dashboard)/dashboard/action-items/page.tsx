import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare } from 'lucide-react';
import { getMyActionItems } from './actions';
import { ClientActionItemsList } from './client-action-items-list';

export const metadata = {
  title: 'Action Items | Coaching Platform',
  description: 'View and manage your action items from coaching sessions',
};

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function ActionItemsPage({ searchParams }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const params = await searchParams;

  // Parse filter from URL
  const filter: 'all' | 'pending' | 'completed' =
    params.filter === 'pending' || params.filter === 'completed' ? params.filter : 'all';

  // Fetch action items
  const result = await getMyActionItems(filter);

  if (!result.success) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Action Items</CardTitle>
            <CardDescription>Tasks and action items from your coaching sessions</CardDescription>
          </CardHeader>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {result.error || 'Failed to load action items'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const actionItems = result.actionItems || [];

  // Count items for each filter
  const allItems = actionItems;
  const pendingItems = actionItems.filter((item) => !item.isCompleted);
  const completedItems = actionItems.filter((item) => item.isCompleted);

  // Check if user has any action items at all
  if (allItems.length === 0 && filter === 'all') {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Action Items</CardTitle>
            <CardDescription>Tasks and action items from your coaching sessions</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckSquare className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>No Action Items Yet</CardTitle>
              <CardDescription className="mx-auto max-w-md">
                Your coaches haven&apos;t assigned any action items yet. When they do, you&apos;ll
                see them here and can track your progress.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Action Items</CardTitle>
          <CardDescription>Tasks and action items from your coaching sessions</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <ClientActionItemsList
          initialFilter={filter}
          initialItems={actionItems}
          allCount={allItems.length}
          pendingCount={pendingItems.length}
          completedCount={completedItems.length}
        />
      </div>
    </div>
  );
}
