import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Pencil,
  ExternalLink,
  Calendar,
  MessageSquare,
  DollarSign,
  Clock,
  CheckSquare,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface QuickActionsProps {
  role: 'coach' | 'client';
  coachSlug?: string;
}

interface ActionItem {
  href: string;
  label: string;
  icon: LucideIcon;
  variant: 'primary' | 'secondary' | 'accent';
  external?: boolean;
}

function ActionButton({ href, label, icon: Icon, variant, external }: ActionItem) {
  const styles = {
    primary: 'bg-burgundy text-white hover:bg-burgundy-light',
    secondary:
      'border-2 border-burgundy/20 text-burgundy hover:bg-burgundy/5 hover:border-burgundy/40',
    accent: 'bg-gold text-white hover:bg-gold-dark',
  };

  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg p-4 transition-all',
        styles[variant]
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={href}>{content}</Link>;
}

export function QuickActions({ role, coachSlug }: QuickActionsProps) {
  const coachActions: ActionItem[] = [
    { href: '/dashboard/sessions', label: 'Sessions', icon: Calendar, variant: 'primary' },
    { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare, variant: 'primary' },
    { href: '/dashboard/profile', label: 'Edit Profile', icon: Pencil, variant: 'secondary' },
    { href: '/dashboard/availability', label: 'Availability', icon: Clock, variant: 'secondary' },
    { href: '/dashboard/payments', label: 'Payments', icon: DollarSign, variant: 'accent' },
    ...(coachSlug
      ? [
          {
            href: `/coaches/${coachSlug}`,
            label: 'Public Profile',
            icon: ExternalLink,
            variant: 'secondary' as const,
            external: true,
          },
        ]
      : []),
  ];

  const clientActions: ActionItem[] = [
    { href: '/coaches', label: 'Find a Coach', icon: Search, variant: 'primary' },
    { href: '/dashboard/my-sessions', label: 'My Sessions', icon: Calendar, variant: 'primary' },
    { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare, variant: 'secondary' },
    {
      href: '/dashboard/action-items',
      label: 'Action Items',
      icon: CheckSquare,
      variant: 'secondary',
    },
  ];

  const actions = role === 'coach' ? coachActions : clientActions;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {actions.map((action) => (
            <ActionButton key={action.href} {...action} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
