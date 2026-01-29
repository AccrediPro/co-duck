'use client';

import { useState, useCallback } from 'react';
import { Loader2, Save, Video, Copy, ExternalLink, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateMeetingLink } from '../actions';

interface MeetingLinkSectionProps {
  sessionId: number;
  initialMeetingLink: string | null;
  isCoachView: boolean;
  isUpcoming: boolean;
  isConfirmed: boolean;
}

export function MeetingLinkSection({
  sessionId,
  initialMeetingLink,
  isCoachView,
  isUpcoming,
  isConfirmed,
}: MeetingLinkSectionProps) {
  const { toast } = useToast();
  const [meetingLink, setMeetingLink] = useState(initialMeetingLink || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only show for upcoming confirmed sessions
  const shouldShow = isUpcoming && isConfirmed;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await updateMeetingLink(sessionId, meetingLink);

      if (result.success) {
        toast({
          title: 'Meeting link saved',
          description: 'The meeting link has been updated.',
        });
        setHasChanges(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save meeting link',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, meetingLink, toast]);

  const handleBlur = useCallback(() => {
    if (hasChanges && meetingLink.trim()) {
      handleSave();
    }
  }, [hasChanges, meetingLink, handleSave]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMeetingLink(e.target.value);
    setHasChanges(true);
  };

  const handleCopyLink = useCallback(async () => {
    if (!meetingLink) return;

    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      toast({
        title: 'Link copied',
        description: 'Meeting link copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy link. Please copy manually.',
        variant: 'destructive',
      });
    }
  }, [meetingLink, toast]);

  const handleJoinMeeting = useCallback(() => {
    if (!meetingLink) return;
    window.open(meetingLink, '_blank', 'noopener,noreferrer');
  }, [meetingLink]);

  if (!shouldShow) {
    return null;
  }

  // Client view - read only
  if (!isCoachView) {
    if (!meetingLink) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Meeting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The coach has not added a meeting link yet. Check back closer to your session time.
            </p>
            <p className="mt-3 text-xs italic text-muted-foreground">
              Native video integration coming soon
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Meeting
          </CardTitle>
          <CardDescription>Join your session using the link below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
            <span className="flex-1 truncate text-sm">{meetingLink}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleJoinMeeting} className="flex-1 sm:flex-none">
              <ExternalLink className="mr-2 h-4 w-4" />
              Join Meeting
            </Button>
            <Button variant="outline" onClick={handleCopyLink} className="flex-1 sm:flex-none">
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
          <p className="text-xs italic text-muted-foreground">
            Native video integration coming soon
          </p>
        </CardContent>
      </Card>
    );
  }

  // Coach view - editable
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Meeting
            </CardTitle>
            <CardDescription>
              Add a meeting link (Zoom, Google Meet, etc.) for your client
            </CardDescription>
          </div>
          {meetingLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            type="url"
            placeholder="https://zoom.us/j/... or https://meet.google.com/..."
            value={meetingLink}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {hasChanges && meetingLink && (
            <p className="text-xs text-muted-foreground">
              Unsaved changes - will auto-save on blur or click Save
            </p>
          )}
        </div>
        {meetingLink && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleJoinMeeting}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Test Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        )}
        <p className="text-xs italic text-muted-foreground">Native video integration coming soon</p>
      </CardContent>
    </Card>
  );
}
