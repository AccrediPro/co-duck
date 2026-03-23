'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays } from 'lucide-react';

const DAYS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
] as const;

interface CheckInSettingsProps {
  clientId?: string;
}

export function CheckInSettings({ clientId }: CheckInSettingsProps) {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState('3'); // default Wednesday
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!clientId) {
      toast({
        title: 'Info',
        description: 'Select a client to configure the check-in day.',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/check-ins/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          checkInDay: parseInt(selectedDay, 10),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Saved', description: 'Check-in day updated.' });
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Unable to save',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Weekly Check-in
        </CardTitle>
        <CardDescription>
          Configure the default day for weekly check-ins.
          {!clientId && ' Per-client settings are available on the client card.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="checkin-day">Check-in day</Label>
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger id="checkin-day" className="w-full sm:w-[240px]">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((day) => (
                <SelectItem key={day.value} value={day.value}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {clientId && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-burgundy text-white hover:bg-burgundy-light"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
