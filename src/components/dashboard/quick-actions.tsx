import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Pencil,
  ExternalLink,
  Calendar,
  MessageSquare,
  DollarSign,
  Clock,
  User,
  CheckSquare,
  Search,
} from 'lucide-react';

interface QuickActionsProps {
  role: 'coach' | 'client';
  coachSlug?: string;
}

export function QuickActions({ role, coachSlug }: QuickActionsProps) {
  if (role === 'coach') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href="/dashboard/sessions">
              <Calendar className="mr-2 h-4 w-4" />
              Sessions
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/messages">
              <MessageSquare className="mr-2 h-4 w-4" />
              Messages
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/profile">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/availability">
              <Clock className="mr-2 h-4 w-4" />
              Availability
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/payments">
              <DollarSign className="mr-2 h-4 w-4" />
              Payments
            </Link>
          </Button>
          {coachSlug && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/coaches/${coachSlug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Public Profile
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link href="/coaches">
            <Search className="mr-2 h-4 w-4" />
            Find a Coach
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/my-sessions">
            <Calendar className="mr-2 h-4 w-4" />
            My Sessions
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/messages">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/action-items">
            <CheckSquare className="mr-2 h-4 w-4" />
            Action Items
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
