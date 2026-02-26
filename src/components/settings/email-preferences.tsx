'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Bell, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailPreferences {
  bookings: boolean;
  messages: boolean;
  reviews: boolean;
  reminders: boolean;
  marketing: boolean;
}

const PREFERENCE_CONFIG = [
  {
    key: 'bookings' as const,
    label: 'Bookings',
    description: 'Booking confirmations, cancellations, and reminders',
  },
  {
    key: 'messages' as const,
    label: 'Messages',
    description: 'New message notifications',
  },
  {
    key: 'reviews' as const,
    label: 'Reviews',
    description: 'Review notifications and responses',
  },
  {
    key: 'reminders' as const,
    label: 'Reminders',
    description: 'Session reminders (24h and 1h before)',
  },
  {
    key: 'marketing' as const,
    label: 'Marketing',
    description: 'Product updates and tips',
  },
] as const;

const DEFAULT_PREFERENCES: EmailPreferences = {
  bookings: true,
  messages: true,
  reviews: true,
  reminders: true,
  marketing: false,
};

export function EmailPreferencesSettings() {
  const [preferences, setPreferences] = useState<EmailPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof EmailPreferences | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/settings/preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.emailPreferences) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...data.data.emailPreferences });
        }
      })
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to load email preferences',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const handleToggle = useCallback(
    async (key: keyof EmailPreferences) => {
      const previousValue = preferences[key];
      const newValue = !previousValue;

      // Optimistic update
      setPreferences((prev) => ({ ...prev, [key]: newValue }));
      setSavingKey(key);

      try {
        const res = await fetch('/api/settings/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailPreferences: { [key]: newValue } }),
        });

        const data = await res.json();

        if (!data.success) {
          // Revert on failure
          setPreferences((prev) => ({ ...prev, [key]: previousValue }));
          toast({
            title: 'Error',
            description: data.error?.message || 'Failed to update preferences',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Preferences updated',
          description: `${PREFERENCE_CONFIG.find((p) => p.key === key)?.label} notifications ${newValue ? 'enabled' : 'disabled'}`,
        });
      } catch {
        // Revert on error
        setPreferences((prev) => ({ ...prev, [key]: previousValue }));
        toast({
          title: 'Error',
          description: 'Failed to update preferences',
          variant: 'destructive',
        });
      } finally {
        setSavingKey(null);
      }
    },
    [preferences, toast]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>Choose which email notifications you receive</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preferences...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>Choose which email notifications you receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PREFERENCE_CONFIG.map((pref, index) => (
          <div key={pref.key}>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={`email-pref-${pref.key}`} className="text-sm font-medium">
                  {pref.label}
                </Label>
                <p className="text-sm text-muted-foreground">{pref.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {savingKey === pref.key && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id={`email-pref-${pref.key}`}
                  checked={preferences[pref.key]}
                  onCheckedChange={() => handleToggle(pref.key)}
                  disabled={savingKey !== null}
                  aria-label={`${pref.label} email notifications`}
                />
              </div>
            </div>
            {index < PREFERENCE_CONFIG.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
