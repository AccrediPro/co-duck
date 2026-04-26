import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, ArrowRight, Check } from 'lucide-react';
import { formatDateShort } from '@/lib/date-utils';

interface ActionItemPreview {
  id: number;
  title: string;
  dueDate: string | null;
  coachName: string | null;
  isCompleted: boolean;
}

interface ActionItemsWidgetProps {
  count: number;
  recentItems: ActionItemPreview[];
}

function getItemPriority(item: ActionItemPreview): 'overdue' | 'due-soon' | 'normal' | 'completed' {
  if (item.isCompleted) return 'completed';
  if (!item.dueDate) return 'normal';
  const now = new Date();
  const due = new Date(item.dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 2) return 'due-soon';
  return 'normal';
}

const priorityStyles = {
  overdue: 'border-l-destructive',
  'due-soon': 'border-l-gold',
  normal: 'border-l-burgundy/20',
  completed: 'border-l-sage',
};

const datePriorityStyles = {
  overdue: 'text-destructive',
  'due-soon': 'text-gold-dark',
  normal: 'text-muted-foreground',
  completed: 'text-sage',
};

export function ActionItemsWidget({ count, recentItems }: ActionItemsWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="h-4 w-4" />
          Action Items
          {count > 0 && (
            <Badge variant="secondary" className="ml-1 bg-burgundy/10 text-burgundy">
              {count}
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/action-items">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {recentItems.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckSquare className="mb-2 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No pending action items</p>
            <p className="mb-3 text-xs text-muted-foreground/70">You&apos;re all caught up!</p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/action-items">View All Items</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentItems.map((item) => {
              const priority = getItemPriority(item);
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 rounded-md border-l-4 px-3 py-2 transition-colors hover:bg-muted/50 ${priorityStyles[priority]}`}
                >
                  {priority === 'completed' ? (
                    <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sage/20">
                      <Check className="h-3 w-3 text-sage" />
                    </div>
                  ) : (
                    <div className="mt-1 h-2.5 w-2.5 rounded-full border-2 border-current text-burgundy/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${
                        priority === 'completed' ? 'text-muted-foreground line-through' : ''
                      }`}
                    >
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.coachName && <span>From {item.coachName}</span>}
                      {item.dueDate && (
                        <span className={datePriorityStyles[priority]}>
                          Due {formatDateShort(item.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {count > recentItems.length && (
              <p className="pl-3 text-xs text-muted-foreground">
                +{count - recentItems.length} more items
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
