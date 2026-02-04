import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock } from 'lucide-react';

interface ClientSessionHistoryProps {
  completedCount: number;
  totalHours: number;
}

export function ClientSessionHistory({ completedCount, totalHours }: ClientSessionHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Session History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Completed
            </div>
            <span className="text-lg font-semibold">{completedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Hours Coached
            </div>
            <span className="text-lg font-semibold">{totalHours}h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
