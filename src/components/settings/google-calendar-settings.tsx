'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';
import {
  getGoogleCalendarStatus,
  disconnectGoogleCalendar,
} from '@/app/(dashboard)/dashboard/settings/actions';

export function GoogleCalendarSettings() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getGoogleCalendarStatus().then((result) => {
      if (result.success) {
        setIsConfigured(result.data.isConfigured);
        setIsConnected(result.data.isConnected);
        setLastSyncAt(result.data.lastSyncAt);
      }
      setLoading(false);
    });
  }, []);

  const handleConnect = () => {
    window.location.href = '/api/auth/google';
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      const result = await disconnectGoogleCalendar();
      if (result.success) {
        setIsConnected(false);
        setLastSyncAt(null);
      }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Integration
          </CardTitle>
          <CardDescription>
            Connect Google Calendar to automatically sync your coaching sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection status...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Integration
          </CardTitle>
          <CardDescription>
            Connect Google Calendar to automatically sync your coaching sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            Google Calendar integration is not yet configured. It will be available soon.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Integration
        </CardTitle>
        <CardDescription>
          Connect Google Calendar to automatically sync your coaching sessions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Google Calendar connected
            </div>
            {lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(lastSyncAt).toLocaleDateString()}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              New bookings will automatically appear in your Google Calendar. Cancelled sessions
              will be removed.
            </p>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect Google Calendar'
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Not connected
            </div>
            <p className="text-sm text-muted-foreground">
              Connect your Google Calendar to automatically sync coaching sessions. Events will be
              created when sessions are booked and removed when cancelled.
            </p>
            <Button onClick={handleConnect}>Connect Google Calendar</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
