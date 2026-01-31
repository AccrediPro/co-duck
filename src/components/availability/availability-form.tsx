'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  saveAvailabilitySettings,
  type DaySchedule,
  type AvailabilitySettings,
} from '@/app/(dashboard)/dashboard/availability/actions';

// Copy schedule from one day to others (client-side utility)
type CopyScheduleData = {
  sourceDay: number;
  targetDays: number[];
  schedule: DaySchedule[];
};

function copyDaySchedule(data: CopyScheduleData): DaySchedule[] {
  const sourceSchedule = data.schedule.find((d) => d.dayOfWeek === data.sourceDay);
  if (!sourceSchedule) return data.schedule;

  return data.schedule.map((day) => {
    if (data.targetDays.includes(day.dayOfWeek)) {
      return {
        ...day,
        isAvailable: sourceSchedule.isAvailable,
        startTime: sourceSchedule.startTime,
        endTime: sourceSchedule.endTime,
      };
    }
    return day;
  });
}

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Save, Copy, Clock } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const BUFFER_OPTIONS = [
  { value: 0, label: 'No buffer' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
];

const ADVANCE_NOTICE_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 2, label: '2 hours' },
  { value: 4, label: '4 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours (1 day)' },
  { value: 48, label: '48 hours (2 days)' },
  { value: 72, label: '72 hours (3 days)' },
  { value: 168, label: '168 hours (1 week)' },
];

const MAX_ADVANCE_DAYS_OPTIONS = [
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 30, label: '1 month' },
  { value: 60, label: '2 months' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];

// Generate time options in 30-minute increments
function generateTimeOptions() {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      const value = `${h}:${m}`;
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const label = `${displayHour}:${m.padStart(2, '0')} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

interface AvailabilityFormProps {
  initialData: {
    schedule: DaySchedule[];
    bufferMinutes: number;
    advanceNoticeHours: number;
    maxAdvanceDays: number;
    timezone: string;
  };
}

export function AvailabilityForm({ initialData }: AvailabilityFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schedule, setSchedule] = useState<DaySchedule[]>(initialData.schedule);
  const [bufferMinutes, setBufferMinutes] = useState(initialData.bufferMinutes);
  const [advanceNoticeHours, setAdvanceNoticeHours] = useState(initialData.advanceNoticeHours);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initialData.maxAdvanceDays);
  const [copySourceDay, setCopySourceDay] = useState<number | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);

  const updateDaySchedule = (dayOfWeek: number, updates: Partial<DaySchedule>) => {
    setSchedule((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...updates } : day))
    );
  };

  const handleCopySchedule = () => {
    if (copySourceDay === null || copyTargetDays.length === 0) return;

    const newSchedule = copyDaySchedule({
      sourceDay: copySourceDay,
      targetDays: copyTargetDays,
      schedule,
    });

    setSchedule(newSchedule);
    setCopyPopoverOpen(false);
    setCopySourceDay(null);
    setCopyTargetDays([]);

    toast({
      title: 'Schedule Copied',
      description: `Schedule copied to ${copyTargetDays.length} day(s).`,
    });
  };

  const toggleCopyTargetDay = (day: number) => {
    setCopyTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  async function handleSave() {
    setIsSubmitting(true);

    try {
      const data: AvailabilitySettings = {
        schedule,
        bufferMinutes,
        advanceNoticeHours,
        maxAdvanceDays,
      };

      const result = await saveAvailabilitySettings(data);

      if (result.success) {
        toast({
          title: 'Availability Saved',
          description: 'Your availability settings have been updated successfully.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Timezone Notice */}
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              Timezone: <span className="font-normal">{initialData.timezone}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              All times are shown in your profile timezone. You can update it in your profile
              settings.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Set your available hours for each day of the week</CardDescription>
            </div>
            <Popover open={copyPopoverOpen} onOpenChange={setCopyPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Schedule
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Copy from</Label>
                    <Select
                      value={copySourceDay?.toString() ?? ''}
                      onValueChange={(val) => setCopySourceDay(parseInt(val))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select a day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={day.value.toString()}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Copy to</Label>
                    <div className="mt-2 space-y-2">
                      {DAYS_OF_WEEK.filter((day) => day.value !== copySourceDay).map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`copy-to-${day.value}`}
                            checked={copyTargetDays.includes(day.value)}
                            onCheckedChange={() => toggleCopyTargetDay(day.value)}
                          />
                          <label
                            htmlFor={`copy-to-${day.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleCopySchedule}
                    disabled={copySourceDay === null || copyTargetDays.length === 0}
                    className="w-full"
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const daySchedule = schedule.find((s) => s.dayOfWeek === day.value);
              if (!daySchedule) return null;

              return (
                <div
                  key={day.value}
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-[120px] items-center justify-between sm:justify-start">
                    <span className="font-medium">{day.label}</span>
                    <div className="flex items-center gap-2 sm:hidden">
                      <Switch
                        checked={daySchedule.isAvailable}
                        onCheckedChange={(checked) =>
                          updateDaySchedule(day.value, { isAvailable: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <Switch
                      checked={daySchedule.isAvailable}
                      onCheckedChange={(checked) =>
                        updateDaySchedule(day.value, { isAvailable: checked })
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {daySchedule.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>

                  {daySchedule.isAvailable ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <Select
                        value={daySchedule.startTime}
                        onValueChange={(value) =>
                          updateDaySchedule(day.value, { startTime: value })
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">to</span>
                      <Select
                        value={daySchedule.endTime}
                        onValueChange={(value) => updateDaySchedule(day.value, { endTime: value })}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <span className="text-sm text-muted-foreground sm:hidden">Unavailable</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Booking Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Settings</CardTitle>
          <CardDescription>Configure how clients can book sessions with you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Buffer Time */}
          <div className="space-y-2">
            <Label htmlFor="buffer-time">Buffer time between sessions</Label>
            <Select
              value={bufferMinutes.toString()}
              onValueChange={(value) => setBufferMinutes(parseInt(value))}
            >
              <SelectTrigger id="buffer-time" className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUFFER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Time between sessions to prepare and take breaks
            </p>
          </div>

          {/* Advance Notice */}
          <div className="space-y-2">
            <Label htmlFor="advance-notice">Minimum advance notice</Label>
            <Select
              value={advanceNoticeHours.toString()}
              onValueChange={(value) => setAdvanceNoticeHours(parseInt(value))}
            >
              <SelectTrigger id="advance-notice" className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADVANCE_NOTICE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">How far in advance clients must book</p>
          </div>

          {/* Max Advance Days */}
          <div className="space-y-2">
            <Label htmlFor="max-advance">Maximum advance booking</Label>
            <Select
              value={maxAdvanceDays.toString()}
              onValueChange={(value) => setMaxAdvanceDays(parseInt(value))}
            >
              <SelectTrigger id="max-advance" className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_ADVANCE_DAYS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              How far into the future clients can book
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Card>
        <CardContent className="flex justify-end pt-6">
          <Button onClick={handleSave} disabled={isSubmitting} size="lg">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Availability
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
