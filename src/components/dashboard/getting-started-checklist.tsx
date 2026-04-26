'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircle2,
  Circle,
  FileText,
  CreditCard,
  Calendar,
  Globe,
  UserCircle,
} from 'lucide-react';

interface ProfileData {
  bio: string | null;
  headline: string | null;
  sessionTypes: unknown[];
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  isPublished: boolean;
  hasAvailability: boolean;
}

interface ChecklistItem {
  key: string;
  label: string;
  href: string;
  icon: typeof FileText;
  check: (p: ProfileData) => boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: 'bio',
    label: 'Complete your bio',
    href: '/dashboard/profile',
    icon: UserCircle,
    check: (p) => Boolean(p.bio && p.bio.length > 10 && p.headline),
  },
  {
    key: 'sessions',
    label: 'Add session types',
    href: '/dashboard/profile',
    icon: FileText,
    check: (p) => Array.isArray(p.sessionTypes) && p.sessionTypes.length > 0,
  },
  {
    key: 'stripe',
    label: 'Connect Stripe',
    href: '/dashboard/payments',
    icon: CreditCard,
    check: (p) => Boolean(p.stripeAccountId) || p.stripeOnboardingComplete,
  },
  {
    key: 'availability',
    label: 'Set availability',
    href: '/dashboard/availability',
    icon: Calendar,
    check: (p) => p.hasAvailability,
  },
  {
    key: 'publish',
    label: 'Publish profile',
    href: '/dashboard/profile',
    icon: Globe,
    check: (p) => p.isPublished,
  },
];

export function GettingStartedChecklist() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.coachProfile) {
          const cp = json.data.coachProfile;
          setProfile({
            bio: cp.bio,
            headline: cp.headline,
            sessionTypes: cp.sessionTypes || [],
            stripeAccountId: cp.stripeAccountId,
            stripeOnboardingComplete: cp.stripeOnboardingComplete ?? false,
            isPublished: cp.isPublished,
            hasAvailability: cp.hasAvailability ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !profile) return null;

  const completed = CHECKLIST_ITEMS.filter((item) => item.check(profile)).length;
  const total = CHECKLIST_ITEMS.length;

  if (completed >= total) return null;

  const progressPercent = Math.round((completed / total) * 100);

  return (
    <Card className="border-burgundy/20 bg-burgundy/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-burgundy-dark">Getting Started</CardTitle>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-burgundy/10">
            <div
              className="h-full rounded-full bg-burgundy transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-burgundy">
            {completed}/{total}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {CHECKLIST_ITEMS.map((item) => {
          const done = item.check(profile);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-burgundy/10 ${
                done ? 'text-muted-foreground' : 'text-foreground'
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-sage" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-burgundy/40" />
              )}
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={done ? 'line-through' : ''}>{item.label}</span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
