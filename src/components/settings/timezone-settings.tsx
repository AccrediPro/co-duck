'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TIMEZONES, getDetectedTimezone } from '@/lib/timezones';

// Group timezones by region (derived from the IANA value prefix)
function getRegion(value: string): string {
  const prefix = value.split('/')[0];
  const regionMap: Record<string, string> = {
    America: 'Americas',
    Pacific: 'Pacific',
    Europe: 'Europe',
    Asia: 'Asia',
    Australia: 'Australia & Pacific',
    Africa: 'Africa',
  };
  return regionMap[prefix] || prefix;
}

const GROUPED_TIMEZONES = TIMEZONES.reduce(
  (acc, tz) => {
    const region = getRegion(tz.value);
    if (!acc[region]) acc[region] = [];
    acc[region].push(tz);
    return acc;
  },
  {} as Record<string, typeof TIMEZONES[number][]>
);

const REGION_ORDER = ['Americas', 'Europe', 'Asia', 'Australia & Pacific', 'Africa', 'Pacific'];

export function TimezoneSettings() {
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/settings/preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Use saved timezone, or auto-detect on first visit
          setTimezone(data.data.timezone || getDetectedTimezone());
        }
      })
      .catch(() => {
        setTimezone(getDetectedTimezone());
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = useCallback(
    async (value: string) => {
      const previous = timezone;
      setTimezone(value);
      setSaving(true);

      try {
        const res = await fetch('/api/settings/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone: value }),
        });

        const data = await res.json();

        if (!data.success) {
          setTimezone(previous);
          toast({
            title: 'Error',
            description: data.error?.message || 'Failed to update timezone',
            variant: 'destructive',
          });
          return;
        }

        const label = TIMEZONES.find((tz) => tz.value === value)?.label || value;
        toast({ title: 'Timezone updated', description: label });
      } catch {
        setTimezone(previous);
        toast({
          title: 'Error',
          description: 'Failed to update timezone',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    },
    [timezone, toast]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Timezone
          </CardTitle>
          <CardDescription>Set your timezone for accurate session scheduling</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading timezone...
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentLabel = TIMEZONES.find((tz) => tz.value === timezone)?.label;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Timezone
        </CardTitle>
        <CardDescription>Set your timezone for accurate session scheduling</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Select value={timezone || undefined} onValueChange={handleChange} disabled={saving}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select your timezone" />
            </SelectTrigger>
            <SelectContent>
              {REGION_ORDER.filter((r) => GROUPED_TIMEZONES[r]).map((region) => (
                <SelectGroup key={region}>
                  <SelectLabel>{region}</SelectLabel>
                  {GROUPED_TIMEZONES[region].map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {currentLabel && !saving && (
          <p className="text-xs text-muted-foreground">
            Current: {currentLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
