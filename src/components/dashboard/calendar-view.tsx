'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSessionsForMonth } from '@/app/(dashboard)/dashboard/actions';
import type { CalendarSession } from '@/app/(dashboard)/dashboard/actions';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [isPending, startTransition] = useTransition();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await getSessionsForMonth(year, month);
      if (result.success) {
        setSessions(result.sessions);
      }
    });
  }, [year, month]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const sessionsByDay = new Map<number, CalendarSession[]>();
  for (const session of sessions) {
    const day = new Date(session.startTime).getDate();
    if (!sessionsByDay.has(day)) sessionsByDay.set(day, []);
    sessionsByDay.get(day)!.push(session);
  }

  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
  };

  const selectedSessions = selectedDay ? sessionsByDay.get(selectedDay) || [] : [];

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`transition-opacity ${isPending ? 'opacity-50' : ''}`}>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before first of month */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const daySessions = sessionsByDay.get(day) || [];
              const isToday =
                day === now.getDate() &&
                month === now.getMonth() + 1 &&
                year === now.getFullYear();
              const isSelected = day === selectedDay;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`h-10 rounded-md text-sm relative flex items-center justify-center transition-colors
                    ${isToday ? 'font-bold' : ''}
                    ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
                    ${isToday && !isSelected ? 'ring-1 ring-primary' : ''}
                  `}
                >
                  {day}
                  {daySessions.length > 0 && (
                    <span
                      className={`absolute bottom-1 h-1 w-1 rounded-full ${
                        isSelected ? 'bg-primary-foreground' : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day sessions */}
          {selectedDay !== null && (
            <div className="mt-4 border-t pt-3">
              <h4 className="text-sm font-medium mb-2">
                {MONTHS[month - 1]} {selectedDay} — {selectedSessions.length} session{selectedSessions.length !== 1 ? 's' : ''}
              </h4>
              {selectedSessions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sessions this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedSessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {new Date(s.startTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                      <span className="font-medium">{s.otherUserName || 'User'}</span>
                      <Badge variant="outline" className="text-xs">
                        {s.sessionType.name}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
