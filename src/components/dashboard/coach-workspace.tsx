'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDate, formatDateShort } from '@/lib/date-utils';
import {
  CalendarDays,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Upload,
  Trash2,
  BookOpen,
  Target,
  Paperclip,
  ListChecks,
  Star,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewForm } from '@/components/reviews';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// --- Types ---

interface Coach {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  profile: {
    headline: string | null;
    slug: string | null;
    specialties: string[] | null;
  } | null;
  lastBookingDate: string;
  totalSessions: number;
  activeProgramsCount: number;
}

interface Program {
  id: number;
  title: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  goalsCount: number;
  goalsCompleted: number;
}

interface GoalFromAPI {
  id: number;
  programId: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ActionItemFromAPI {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  goalId?: number | null;
  coach: { id: string; name: string | null; avatarUrl: string | null } | null;
}

interface Attachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: number | null;
  uploadedBy: string;
  programId: number | null;
  goalId: number | null;
  actionItemId: number | null;
  createdAt: string;
}

// --- Helpers ---

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    active: 'bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand-accent-dark))] dark:bg-[hsl(var(--brand-accent-darker))]/30 dark:text-[hsl(var(--brand-accent-muted))]',
    completed: 'bg-sage/15 text-sage dark:bg-sage/20 dark:text-sage',
    archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    pending: 'bg-gold/15 text-gold-dark dark:bg-gold/20 dark:text-gold',
    in_progress: 'bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand-accent-dark))] dark:bg-[hsl(var(--brand-accent-darker))]/30 dark:text-[hsl(var(--brand-accent-muted))]',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    archived: 'Archived',
    pending: 'Pending',
    in_progress: 'In Progress',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        styles[status] || styles.pending
      )}
    >
      {labels[status] || status}
    </span>
  );
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return <FileIcon className="h-5 w-5 text-muted-foreground" />;
  if (fileType.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-burgundy" />;
  if (fileType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
  return <FileIcon className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Main Component ---

interface CoachWorkspaceProps {
  coach: Coach;
  initialPrograms: Program[];
}

export function CoachWorkspace({ coach, initialPrograms }: CoachWorkspaceProps) {
  const { toast } = useToast();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewableBookingIds, setReviewableBookingIds] = useState<number[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Fetch completed bookings for this coach to determine if review is possible
  useEffect(() => {
    async function checkReviewable() {
      try {
        const res = await fetch('/api/bookings?status=completed&role=client&limit=50');
        const json = await res.json();
        if (!json.success) return;

        const coachBookingIds = (
          json.data.bookings as { id: number; coach: { id: string } | null }[]
        )
          .filter((b) => b.coach?.id === coach.id)
          .map((b) => b.id);

        if (coachBookingIds.length > 0) {
          setReviewableBookingIds(coachBookingIds);
        }
      } catch {
        // Silent fail — button stays hidden
      }
    }
    checkReviewable();
  }, [coach.id]);

  const handleReviewSubmit = async (data: { rating: number; title: string; content: string }) => {
    if (reviewableBookingIds.length === 0) return;
    setSubmittingReview(true);

    // Try each booking until one succeeds (skipping already-reviewed ones)
    for (const bookingId of reviewableBookingIds) {
      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId,
            rating: data.rating,
            title: data.title || undefined,
            content: data.content || undefined,
          }),
        });
        const json = await res.json();

        if (json.success) {
          setReviewDialogOpen(false);
          setReviewableBookingIds([]);
          toast({
            title: 'Review submitted',
            description: 'Thank you for your feedback!',
          });
          setSubmittingReview(false);
          return;
        }

        // If already reviewed, try next booking
        if (json.error?.code === 'ALREADY_REVIEWED') {
          continue;
        }

        // Any other error — show it and stop
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to submit review',
          variant: 'destructive',
        });
        setSubmittingReview(false);
        return;
      } catch {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
        setSubmittingReview(false);
        return;
      }
    }

    // All bookings already reviewed
    setReviewableBookingIds([]);
    setReviewDialogOpen(false);
    toast({
      title: 'Already reviewed',
      description: 'You have already reviewed all sessions with this coach.',
    });
    setSubmittingReview(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={coach.avatarUrl || undefined} alt={coach.name || 'Coach'} />
            <AvatarFallback className="text-lg">{getInitials(coach.name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{coach.name || 'Coach'}</h1>
            {coach.profile?.headline && (
              <p className="text-muted-foreground">{coach.profile.headline}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {coach.profile?.slug && (
            <Button variant="outline" asChild>
              <Link href={`/coaches/${coach.profile.slug}`}>
                <CalendarDays className="mr-2 h-4 w-4" />
                Book Session
              </Link>
            </Button>
          )}
          {reviewableBookingIds.length > 0 && (
            <Button variant="outline" onClick={() => setReviewDialogOpen(true)}>
              <Star className="mr-2 h-4 w-4" />
              Write a Review
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard/messages">
              <MessageSquare className="mr-2 h-4 w-4" />
              Send Message
            </Link>
          </Button>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review {coach.name || 'your coach'}</DialogTitle>
          </DialogHeader>
          {reviewableBookingIds.length > 0 && (
            <ReviewForm
              bookingId={reviewableBookingIds[0]}
              onSubmit={handleReviewSubmit}
              isLoading={submittingReview}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Programs as primary content */}
      <ProgramsList programs={initialPrograms} coachId={coach.id} />
    </div>
  );
}

// --- Programs List (primary view, no tabs) ---

function ProgramsList({ programs, coachId }: { programs: Program[]; coachId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [programGoals, setProgramGoals] = useState<Record<number, GoalFromAPI[]>>({});
  const [programTasks, setProgramTasks] = useState<Record<number, ActionItemFromAPI[]>>({});
  const [programAttachments, setProgramAttachments] = useState<Record<number, Attachment[]>>({});
  const [loadingGoals, setLoadingGoals] = useState<Record<number, boolean>>({});
  const [loadingTasks, setLoadingTasks] = useState<Record<number, boolean>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<number, boolean>>({});
  const [togglingGoals, setTogglingGoals] = useState<Record<number, boolean>>({});
  const [togglingTasks, setTogglingTasks] = useState<Record<number, boolean>>({});
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  // Track locally updated goal counts for progress recalculation
  const [localGoalCounts, setLocalGoalCounts] = useState<Record<number, { total: number; completed: number }>>({});
  const [localTaskCounts, setLocalTaskCounts] = useState<Record<number, { total: number; completed: number }>>({});

  const fetchGoals = useCallback(async (programId: number) => {
    setLoadingGoals((prev) => ({ ...prev, [programId]: true }));
    try {
      const res = await fetch(`/api/programs/${programId}/goals`);
      const json = await res.json();
      if (json.success) {
        const goals: GoalFromAPI[] = json.data.goals;
        setProgramGoals((prev) => ({ ...prev, [programId]: goals }));
        setLocalGoalCounts((prev) => ({
          ...prev,
          [programId]: {
            total: goals.length,
            completed: goals.filter((g) => g.status === 'completed').length,
          },
        }));
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingGoals((prev) => ({ ...prev, [programId]: false }));
    }
  }, []);

  const fetchTasks = useCallback(async (programId: number, goalIds: number[]) => {
    if (goalIds.length === 0) {
      setProgramTasks((prev) => ({ ...prev, [programId]: [] }));
      setLocalTaskCounts((prev) => ({ ...prev, [programId]: { total: 0, completed: 0 } }));
      return;
    }
    setLoadingTasks((prev) => ({ ...prev, [programId]: true }));
    try {
      // Fetch action items linked to each goal in this program
      const allTasks: ActionItemFromAPI[] = [];
      const seen = new Set<number>();
      await Promise.all(
        goalIds.map(async (goalId) => {
          try {
            const res = await fetch(`/api/goals/${goalId}`);
            const json = await res.json();
            if (json.success && json.data.actionItems) {
              for (const ai of json.data.actionItems) {
                if (!seen.has(ai.id)) {
                  seen.add(ai.id);
                  allTasks.push({ ...ai, goalId });
                }
              }
            }
          } catch {
            // Continue
          }
        })
      );
      setProgramTasks((prev) => ({ ...prev, [programId]: allTasks }));
      setLocalTaskCounts((prev) => ({
        ...prev,
        [programId]: {
          total: allTasks.length,
          completed: allTasks.filter((t) => t.isCompleted).length,
        },
      }));
    } catch {
      // Silent fail
    } finally {
      setLoadingTasks((prev) => ({ ...prev, [programId]: false }));
    }
  }, []);

  const fetchFiles = useCallback(async (programId: number) => {
    setLoadingFiles((prev) => ({ ...prev, [programId]: true }));
    try {
      const res = await fetch(`/api/attachments?programId=${programId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProgramAttachments((prev) => ({ ...prev, [programId]: json.data }));
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingFiles((prev) => ({ ...prev, [programId]: false }));
    }
  }, []);

  const handleToggle = (programId: number) => {
    const willOpen = !expanded[programId];
    setExpanded((prev) => ({ ...prev, [programId]: willOpen }));
    if (willOpen && !programGoals[programId]) {
      fetchGoals(programId);
    }
    if (willOpen && !programAttachments[programId]) {
      fetchFiles(programId);
    }
  };

  // Fetch tasks when goals for a program first load
  useEffect(() => {
    for (const [pidStr, goals] of Object.entries(programGoals)) {
      const pid = Number(pidStr);
      if (!programTasks[pid] && !loadingTasks[pid] && goals.length > 0) {
        const goalIds = goals.map((g) => g.id);
        fetchTasks(pid, goalIds);
      }
    }
  }, [programGoals, programTasks, loadingTasks, fetchTasks]);

  const handleGoalToggle = useCallback(
    async (goalId: number, programId: number, currentStatus: string) => {
      const isCompleting = currentStatus !== 'completed';
      const newStatus = isCompleting ? 'completed' : 'pending';

      // Optimistic update
      setTogglingGoals((prev) => ({ ...prev, [goalId]: true }));
      setProgramGoals((prev) => ({
        ...prev,
        [programId]: (prev[programId] || []).map((g) =>
          g.id === goalId
            ? {
                ...g,
                status: newStatus,
                completedAt: isCompleting ? new Date().toISOString() : null,
              }
            : g
        ),
      }));
      setLocalGoalCounts((prev) => {
        const current = prev[programId] || { total: 0, completed: 0 };
        return {
          ...prev,
          [programId]: {
            ...current,
            completed: isCompleting ? current.completed + 1 : current.completed - 1,
          },
        };
      });

      try {
        const res = await fetch(`/api/goals/${goalId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        const json = await res.json();
        if (json.success) {
          toast({
            title: isCompleting ? 'Goal completed' : 'Goal reopened',
            description: isCompleting
              ? 'Great progress! Goal marked as completed.'
              : 'Goal has been reopened.',
          });
          router.refresh();
        } else {
          // Revert optimistic update
          setProgramGoals((prev) => ({
            ...prev,
            [programId]: (prev[programId] || []).map((g) =>
              g.id === goalId
                ? {
                    ...g,
                    status: currentStatus,
                    completedAt: currentStatus === 'completed' ? g.completedAt : null,
                  }
                : g
            ),
          }));
          setLocalGoalCounts((prev) => {
            const current = prev[programId] || { total: 0, completed: 0 };
            return {
              ...prev,
              [programId]: {
                ...current,
                completed: isCompleting ? current.completed - 1 : current.completed + 1,
              },
            };
          });
          if (json.error?.code === 'FORBIDDEN') {
            toast({
              title: 'Cannot reopen goal',
              description: 'Only your coach can reopen completed goals.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error',
              description: json.error?.message || 'Failed to update goal',
              variant: 'destructive',
            });
          }
        }
      } catch {
        // Revert
        setProgramGoals((prev) => ({
          ...prev,
          [programId]: (prev[programId] || []).map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  status: currentStatus,
                  completedAt: currentStatus === 'completed' ? g.completedAt : null,
                }
              : g
          ),
        }));
        setLocalGoalCounts((prev) => {
          const current = prev[programId] || { total: 0, completed: 0 };
          return {
            ...prev,
            [programId]: {
              ...current,
              completed: isCompleting ? current.completed - 1 : current.completed + 1,
            },
          };
        });
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setTogglingGoals((prev) => ({ ...prev, [goalId]: false }));
      }
    },
    [toast, router]
  );

  const handleTaskToggle = useCallback(
    async (taskId: number, programId: number, currentCompleted: boolean) => {
      const newCompleted = !currentCompleted;

      // Optimistic update
      setTogglingTasks((prev) => ({ ...prev, [taskId]: true }));
      setProgramTasks((prev) => ({
        ...prev,
        [programId]: (prev[programId] || []).map((t) =>
          t.id === taskId
            ? {
                ...t,
                isCompleted: newCompleted,
                completedAt: newCompleted ? new Date().toISOString() : null,
              }
            : t
        ),
      }));
      setLocalTaskCounts((prev) => {
        const current = prev[programId] || { total: 0, completed: 0 };
        return {
          ...prev,
          [programId]: {
            ...current,
            completed: newCompleted ? current.completed + 1 : current.completed - 1,
          },
        };
      });

      try {
        const res = await fetch(`/api/action-items/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isCompleted: newCompleted }),
        });
        const json = await res.json();
        if (json.success) {
          toast({
            title: newCompleted ? 'Task completed' : 'Task reopened',
            description: newCompleted
              ? 'Nice work! Task marked as complete.'
              : 'Task has been reopened.',
          });
          router.refresh();
        } else {
          // Revert
          setProgramTasks((prev) => ({
            ...prev,
            [programId]: (prev[programId] || []).map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    isCompleted: currentCompleted,
                    completedAt: currentCompleted ? t.completedAt : null,
                  }
                : t
            ),
          }));
          setLocalTaskCounts((prev) => {
            const current = prev[programId] || { total: 0, completed: 0 };
            return {
              ...prev,
              [programId]: {
                ...current,
                completed: newCompleted ? current.completed - 1 : current.completed + 1,
              },
            };
          });
          toast({
            title: 'Error',
            description: json.error?.message || 'Failed to update task',
            variant: 'destructive',
          });
        }
      } catch {
        // Revert
        setProgramTasks((prev) => ({
          ...prev,
          [programId]: (prev[programId] || []).map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  isCompleted: currentCompleted,
                  completedAt: currentCompleted ? t.completedAt : null,
                }
              : t
          ),
        }));
        setLocalTaskCounts((prev) => {
          const current = prev[programId] || { total: 0, completed: 0 };
          return {
            ...prev,
            [programId]: {
              ...current,
              completed: newCompleted ? current.completed - 1 : current.completed + 1,
            },
          };
        });
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setTogglingTasks((prev) => ({ ...prev, [taskId]: false }));
      }
    },
    [toast, router]
  );

  const handleUpload = useCallback(
    async (programId: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB.',
          variant: 'destructive',
        });
        return;
      }

      setUploading((prev) => ({ ...prev, [programId]: true }));
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('programId', String(programId));

        const res = await fetch('/api/attachments/upload', { method: 'POST', body: formData });
        const json = await res.json();

        if (json.success) {
          toast({ title: 'File uploaded', description: `"${file.name}" uploaded successfully.` });
          setProgramAttachments((prev) => ({
            ...prev,
            [programId]: [json.data, ...(prev[programId] || [])],
          }));
          router.refresh();
        } else {
          toast({
            title: 'Upload failed',
            description: json.error?.message || 'Failed to upload file.',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred during upload.',
          variant: 'destructive',
        });
      } finally {
        setUploading((prev) => ({ ...prev, [programId]: false }));
        e.target.value = '';
      }
    },
    [toast, router]
  );

  const handleDeleteFile = useCallback(
    async (programId: number, attachment: Attachment) => {
      setDeletingIds((prev) => new Set(prev).add(attachment.id));
      try {
        const res = await fetch(`/api/attachments/${attachment.id}`, { method: 'DELETE' });
        const json = await res.json();

        if (json.success) {
          toast({
            title: 'File deleted',
            description: `"${attachment.fileName}" has been deleted.`,
          });
          setProgramAttachments((prev) => ({
            ...prev,
            [programId]: (prev[programId] || []).filter((a) => a.id !== attachment.id),
          }));
          router.refresh();
        } else {
          toast({
            title: 'Delete failed',
            description: json.error?.message || 'Failed to delete file.',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred.',
          variant: 'destructive',
        });
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(attachment.id);
          return next;
        });
      }
    },
    [toast, router]
  );

  if (programs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No programs yet</p>
          <p className="text-sm text-muted-foreground">
            Your coach hasn&apos;t created any programs for you yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {programs.map((program) => {
        const isOpen = expanded[program.id];
        const goals = programGoals[program.id] || [];
        const tasks = programTasks[program.id] || [];
        const files = programAttachments[program.id] || [];

        // Progress calculation: (completed goals + completed tasks) / (total goals + total tasks)
        const gc = localGoalCounts[program.id] || {
          total: program.goalsCount,
          completed: program.goalsCompleted,
        };
        const tc = localTaskCounts[program.id] || { total: 0, completed: 0 };
        const totalItems = gc.total + tc.total;
        const completedItems = gc.completed + tc.completed;
        const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        return (
          <Card key={program.id}>
            <CardContent className="p-4">
              {/* Program header (clickable to expand) */}
              <button
                className="flex w-full items-start gap-3 text-left"
                onClick={() => handleToggle(program.id)}
              >
                <div className="mt-1 shrink-0">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{program.title}</h3>
                    {getStatusBadge(program.status)}
                  </div>
                  {program.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {program.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {program.startDate && (
                      <span>From {formatDate(program.startDate)}</span>
                    )}
                    {program.endDate && (
                      <span>To {formatDate(program.endDate)}</span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {completedItems}/{totalItems} completed
                      </span>
                      <span className="font-medium">{progressPct}%</span>
                    </div>
                    <Progress
                      value={progressPct}
                      className={cn('h-2', progressPct === 100 && '[&>div]:bg-[hsl(var(--brand-accent))]')}
                    />
                  </div>
                </div>
              </button>

              {/* Expanded content with sub-tabs */}
              {isOpen && (
                <div className="ml-7 mt-4 border-t pt-4">
                  <Tabs defaultValue="goals">
                    <TabsList className="mb-3">
                      <TabsTrigger value="goals" className="gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        Goals
                        {gc.total > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({gc.total})</span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="tasks" className="gap-1.5">
                        <ListChecks className="h-3.5 w-3.5" />
                        Tasks
                        {tc.total > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({tc.total})</span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="files" className="gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" />
                        Files
                        {files.length > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({files.length})
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    {/* Goals sub-tab */}
                    <TabsContent value="goals" className="mt-0">
                      {loadingGoals[program.id] ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : goals.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No goals in this program yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {goals.map((goal) => {
                            const isToggling = togglingGoals[goal.id];
                            const isCompleted = goal.status === 'completed';
                            return (
                              <div
                                key={goal.id}
                                className={cn(
                                  'rounded-lg border p-3 transition-opacity',
                                  isCompleted && 'opacity-70'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex items-center">
                                    {isToggling ? (
                                      <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                      <Checkbox
                                        checked={isCompleted}
                                        onCheckedChange={() =>
                                          handleGoalToggle(goal.id, program.id, goal.status)
                                        }
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={cn(
                                          'font-medium',
                                          isCompleted &&
                                            'text-muted-foreground line-through'
                                        )}
                                      >
                                        {goal.title}
                                      </span>
                                      {getStatusBadge(goal.status)}
                                    </div>
                                    {goal.description && (
                                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                        {goal.description}
                                      </p>
                                    )}
                                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                      {goal.dueDate && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          Due{' '}
                                          {formatDate(goal.dueDate)}
                                        </span>
                                      )}
                                      {goal.completedAt && (
                                        <span className="flex items-center gap-1 text-[hsl(var(--brand-warm))]">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Completed{' '}
                                          {formatDateShort(goal.completedAt)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* Tasks sub-tab */}
                    <TabsContent value="tasks" className="mt-0">
                      {loadingTasks[program.id] ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : tasks.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No tasks in this program yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {tasks.map((task) => {
                            const isToggling = togglingTasks[task.id];
                            const isOverdue =
                              !task.isCompleted &&
                              task.dueDate &&
                              new Date(task.dueDate) < new Date();
                            return (
                              <div
                                key={task.id}
                                className={cn(
                                  'rounded-lg border p-3 transition-opacity',
                                  task.isCompleted && 'opacity-70'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex items-center">
                                    {isToggling ? (
                                      <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                      <Checkbox
                                        checked={task.isCompleted}
                                        onCheckedChange={() =>
                                          handleTaskToggle(
                                            task.id,
                                            program.id,
                                            task.isCompleted
                                          )
                                        }
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={cn(
                                        'font-medium',
                                        task.isCompleted &&
                                          'text-muted-foreground line-through'
                                      )}
                                    >
                                      {task.title}
                                    </span>
                                    {task.description && (
                                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                        {task.description}
                                      </p>
                                    )}
                                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                      {task.dueDate && (
                                        <span
                                          className={cn(
                                            'flex items-center gap-1',
                                            isOverdue && 'font-medium text-red-500'
                                          )}
                                        >
                                          <Clock className="h-3 w-3" />
                                          Due{' '}
                                          {formatDate(task.dueDate)}
                                        </span>
                                      )}
                                      {task.isCompleted && task.completedAt && (
                                        <span className="flex items-center gap-1 text-[hsl(var(--brand-warm))]">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Completed{' '}
                                          {formatDateShort(task.completedAt)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* Files sub-tab */}
                    <TabsContent value="files" className="mt-0">
                      {loadingFiles[program.id] ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Upload */}
                          <label className="flex cursor-pointer items-center gap-3">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                              onChange={(e) => handleUpload(program.id, e)}
                              disabled={uploading[program.id]}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={uploading[program.id]}
                              asChild
                            >
                              <span>
                                {uploading[program.id] ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="mr-2 h-3.5 w-3.5" />
                                )}
                                {uploading[program.id] ? 'Uploading...' : 'Upload file'}
                              </span>
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              PDF, images, or documents up to 10MB
                            </span>
                          </label>

                          {files.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                              No files in this program yet.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {files.map((att) => (
                                <div
                                  key={att.id}
                                  className="flex items-center gap-3 rounded-lg border p-3"
                                >
                                  {getFileIcon(att.fileType)}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                      {att.fileName}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      {att.fileSize != null && (
                                        <span>{formatFileSize(att.fileSize)}</span>
                                      )}
                                      <span>
                                        {formatDate(att.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      asChild
                                    >
                                      <a
                                        href={att.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                      >
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </Button>
                                    {att.uploadedBy !== coachId && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteFile(program.id, att)}
                                        disabled={deletingIds.has(att.id)}
                                      >
                                        {deletingIds.has(att.id) ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
