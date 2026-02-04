import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, ArrowRight, Circle } from 'lucide-react';

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

export function ActionItemsWidget({ count, recentItems }: ActionItemsWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="h-4 w-4" />
          Action Items
          {count > 0 && (
            <Badge variant="secondary" className="ml-1">
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
          <p className="text-sm text-muted-foreground">No pending action items.</p>
        ) : (
          <div className="space-y-2">
            {recentItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <Circle className="mt-0.5 h-3 w-3 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.coachName && <span>From {item.coachName}</span>}
                    {item.dueDate && (
                      <span>Due {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {count > recentItems.length && (
              <p className="text-xs text-muted-foreground">
                +{count - recentItems.length} more items
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
