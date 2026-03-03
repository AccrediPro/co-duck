'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle,
  User,
  Calendar,
  CreditCard,
  MessageSquare,
  Settings,
  Search,
  Clock,
  RotateCcw,
  Download,
  Upload,
} from 'lucide-react';

// All test items organized by section
const TEST_SECTIONS = [
  {
    phase: 'Phase 0',
    title: 'Foundation',
    sections: [
      {
        id: 'setup',
        storyIds: 'COACH-001 to COACH-004',
        title: 'Project Setup & Navigation',
        icon: 'settings',
        steps: [
          { id: 'setup-1', text: 'Visit / - Landing page with hero, value props, how it works' },
          { id: 'setup-2', text: 'Check responsive navigation (hamburger menu on mobile)' },
          { id: 'setup-3', text: 'Visit /sign-up - Create a new account via Clerk' },
          { id: 'setup-4', text: 'Visit /sign-in - Sign in with existing account' },
          { id: 'setup-5', text: 'After login, visit /dashboard - Role-based dashboard' },
          { id: 'setup-6', text: 'Check sidebar navigation (different links for coach/client)' },
        ],
      },
      {
        id: 'onboarding',
        storyIds: 'COACH-005 to COACH-009',
        title: 'Coach Onboarding (4 Steps)',
        icon: 'user',
        steps: [
          {
            id: 'onboard-1',
            text: 'Visit /onboarding/coach - Step 1: Basic info (name, headline, photo URL, timezone)',
          },
          {
            id: 'onboard-2',
            text: 'Continue to Step 2: Bio and specialties (select from list or add custom)',
          },
          {
            id: 'onboard-3',
            text: 'Continue to Step 3: Pricing (hourly rate, currency, session types)',
          },
          { id: 'onboard-4', text: 'Continue to Step 4: Review and publish profile' },
          { id: 'onboard-5', text: 'Click "Publish" to make profile public or "Save as Draft"' },
          { id: 'onboard-6', text: 'Check profile completion percentage updates at each step' },
        ],
      },
    ],
  },
  {
    phase: 'Phase 1',
    title: 'Coach Profiles',
    sections: [
      {
        id: 'directory',
        storyIds: 'COACH-010 to COACH-012',
        title: 'Public Coach Directory',
        icon: 'search',
        steps: [
          { id: 'dir-1', text: 'Visit /coaches - Browse all published coaches' },
          { id: 'dir-2', text: 'Test search by name/headline' },
          { id: 'dir-3', text: 'Test specialty filter (multi-select)' },
          { id: 'dir-4', text: 'Test price range filter (min/max)' },
          { id: 'dir-5', text: 'Test sort options (newest, price low-high, price high-low)' },
          { id: 'dir-6', text: 'Check pagination (12 per page)' },
          { id: 'dir-7', text: 'Click a coach card to view their profile' },
          { id: 'dir-8', text: 'Visit /coaches/[slug] - Full coach profile page' },
          { id: 'dir-9', text: 'Check SEO metadata (title, description)' },
          { id: 'dir-10', text: 'Test "Share Profile" button (copies URL)' },
        ],
      },
      {
        id: 'dashboard-profile',
        storyIds: 'COACH-013 to COACH-015',
        title: 'Dashboard & Profile Editor',
        icon: 'user',
        steps: [
          { id: 'dash-1', text: 'Visit /dashboard - Check role-based content' },
          { id: 'dash-2', text: 'Coach: See profile status, completion %, quick actions' },
          { id: 'dash-3', text: 'Client: See upcoming sessions placeholder, find coach CTA' },
          { id: 'dash-4', text: 'Visit /dashboard/profile (as coach) - Edit all profile fields' },
          { id: 'dash-5', text: 'Test publish/unpublish toggle (Switch component)' },
          { id: 'dash-6', text: 'Test "Preview" button opens public profile' },
          { id: 'dash-7', text: 'Verify profile completion % updates live' },
        ],
      },
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Availability & Booking',
    sections: [
      {
        id: 'availability',
        storyIds: 'COACH-016 to COACH-017',
        title: 'Coach Availability Setup',
        icon: 'clock',
        steps: [
          { id: 'avail-1', text: 'Visit /dashboard/availability (as coach)' },
          { id: 'avail-2', text: 'Set weekly schedule: toggle days on/off' },
          { id: 'avail-3', text: 'Set start/end times for each day' },
          { id: 'avail-4', text: 'Use "Copy Schedule" to duplicate times to other days' },
          { id: 'avail-5', text: 'Set buffer time between sessions (0-60 min)' },
          { id: 'avail-6', text: 'Set advance notice requirement (1h to 1 week)' },
          { id: 'avail-7', text: 'Set max advance booking (1 week to 1 year)' },
          { id: 'avail-8', text: 'Click Save and verify toast notification' },
        ],
      },
      {
        id: 'booking',
        storyIds: 'COACH-018 to COACH-020',
        title: 'Client Booking Flow',
        icon: 'calendar',
        steps: [
          { id: 'book-1', text: 'Visit /coaches/[slug] - Check availability section' },
          { id: 'book-2', text: 'See "Next Available" time and weekly schedule summary' },
          { id: 'book-3', text: 'Click "Book Session" to start booking' },
          { id: 'book-4', text: 'Step 1: Select session type' },
          { id: 'book-5', text: 'Step 2: Select date from calendar (unavailable dates disabled)' },
          { id: 'book-6', text: 'Step 3: Select available time slot' },
          { id: 'book-7', text: 'Click "Continue to Confirm"' },
          { id: 'book-8', text: 'On confirm page: Add optional notes' },
          { id: 'book-9', text: 'For FREE sessions: Click "Confirm Booking"' },
          { id: 'book-10', text: 'For PAID sessions: Click "Pay Now" (redirects to Stripe)' },
          { id: 'book-11', text: 'After booking: See success page with "Add to Calendar" button' },
        ],
      },
      {
        id: 'sessions',
        storyIds: 'COACH-021 to COACH-025',
        title: 'Session Management',
        icon: 'calendar',
        steps: [
          { id: 'sess-1', text: 'Visit /dashboard/sessions (as coach) - See all sessions' },
          { id: 'sess-2', text: 'Check tabs: Upcoming, Past, Cancelled' },
          { id: 'sess-3', text: 'Click "View" on a session for details' },
          { id: 'sess-4', text: 'Test "Mark as Complete" for past sessions' },
          { id: 'sess-5', text: 'Test cancel with reason selection' },
          { id: 'sess-6', text: 'Visit /dashboard/my-sessions (as client)' },
          { id: 'sess-7', text: 'Test "Add to Calendar" download (.ics file)' },
          { id: 'sess-8', text: 'Test reschedule flow: /dashboard/sessions/[id]/reschedule' },
          { id: 'sess-9', text: 'Verify refund info shows in cancellation dialog' },
        ],
      },
      {
        id: 'nav-avail',
        storyIds: 'COACH-026 to COACH-027',
        title: 'Navigation & Public Availability',
        icon: 'settings',
        steps: [
          { id: 'nav-1', text: 'Check sidebar shows role-based navigation' },
          {
            id: 'nav-2',
            text: 'Coach: Overview, Profile, Sessions, Availability, Payments, Messages, Settings',
          },
          { id: 'nav-3', text: 'Client: Overview, My Sessions, Action Items, Messages, Settings' },
          { id: 'nav-4', text: 'Visit /coaches/[slug] - Check availability section shows' },
          { id: 'nav-5', text: 'See next available slot, weekly summary, timezone' },
        ],
      },
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Payments',
    sections: [
      {
        id: 'stripe',
        storyIds: 'COACH-028 to COACH-035',
        title: 'Stripe Connect & Transactions',
        icon: 'credit-card',
        steps: [
          { id: 'stripe-1', text: 'Visit /dashboard/payments (as coach)' },
          { id: 'stripe-2', text: 'Click "Set Up Payments" to start Stripe Connect onboarding' },
          { id: 'stripe-3', text: 'Complete Stripe Express onboarding flow' },
          { id: 'stripe-4', text: 'Return to payments page - see "Connected" status' },
          {
            id: 'stripe-5',
            text: 'After connection: See earnings overview (total, this month, pending)',
          },
          { id: 'stripe-6', text: 'See transactions list with pagination' },
          { id: 'stripe-7', text: 'Click "View in Stripe" to open Stripe Express Dashboard' },
          { id: 'stripe-8', text: 'Book a PAID session as a client' },
          { id: 'stripe-9', text: 'Complete payment via Stripe Checkout' },
          { id: 'stripe-10', text: 'Verify transaction appears in coach earnings' },
          { id: 'stripe-11', text: 'Test refund flow: Cancel session within/outside 24h window' },
          {
            id: 'stripe-12',
            text: 'Coach cancellation = full refund, Client cancellation = policy-based',
          },
        ],
      },
      {
        id: 'payment-status',
        storyIds: 'Payment Status',
        title: 'Payment Status Display',
        icon: 'credit-card',
        steps: [
          { id: 'pay-1', text: 'Check session cards show payment badges' },
          { id: 'pay-2', text: 'Free sessions: No badge' },
          { id: 'pay-3', text: 'Paid sessions: Green "Paid" badge' },
          { id: 'pay-4', text: 'Payment required: Amber badge with "Pay Now" button' },
          { id: 'pay-5', text: 'Payment failed: Red badge' },
          { id: 'pay-6', text: 'Session detail page shows PaymentSection with transaction info' },
        ],
      },
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Messaging',
    sections: [
      {
        id: 'messaging',
        storyIds: 'COACH-036 to COACH-042',
        title: 'Chat System',
        icon: 'message',
        steps: [
          { id: 'msg-1', text: 'Visit /dashboard/messages - See conversation list' },
          { id: 'msg-2', text: 'Search/filter conversations by name' },
          { id: 'msg-3', text: 'Click conversation to open chat view' },
          { id: 'msg-4', text: 'Send a message (Enter to send, Shift+Enter for new line)' },
          { id: 'msg-5', text: 'Verify real-time message polling (3 second interval)' },
          { id: 'msg-6', text: 'Check unread indicator (blue dot) on conversations' },
          { id: 'msg-7', text: 'Check unread count badge in sidebar navigation' },
          { id: 'msg-8', text: 'On coach profile: Click "Message" button to start conversation' },
          { id: 'msg-9', text: 'On session detail: Click "Message Coach/Client" button' },
          { id: 'msg-10', text: 'After booking: System message auto-created in conversation' },
          {
            id: 'msg-11',
            text: 'Coach view: See client context panel (stats, upcoming sessions, action items)',
          },
          { id: 'msg-12', text: 'Mobile: Click info icon to open context panel in sheet' },
        ],
      },
    ],
  },
  {
    phase: 'Phase 5',
    title: 'Session Tools',
    sections: [
      {
        id: 'notes',
        storyIds: 'COACH-043 to COACH-044',
        title: 'Session Notes',
        icon: 'user',
        steps: [
          { id: 'note-1', text: 'View session detail as coach' },
          { id: 'note-2', text: 'Find "Session Notes" section' },
          { id: 'note-3', text: 'Type notes in textarea' },
          { id: 'note-4', text: 'Click "Save" or blur field (auto-save)' },
          { id: 'note-5', text: 'Verify toast notification on save' },
          { id: 'note-6', text: 'Notes persist across page reloads' },
        ],
      },
      {
        id: 'action-items',
        storyIds: 'COACH-045 to COACH-047',
        title: 'Action Items',
        icon: 'check',
        steps: [
          { id: 'action-1', text: 'On session detail (as coach): Click "Add Action Item"' },
          { id: 'action-2', text: 'Fill form: Title (required), description, due date' },
          { id: 'action-3', text: 'In messages context panel: See action items for client' },
          { id: 'action-4', text: 'Add action items from chat context panel' },
          { id: 'action-5', text: 'Visit /dashboard/action-items (as client)' },
          { id: 'action-6', text: 'See all action items with tabs: All, Pending, Completed' },
          { id: 'action-7', text: 'Mark items complete/incomplete' },
          { id: 'action-8', text: 'Check overdue items highlighted in red' },
          { id: 'action-9', text: 'Dashboard widget shows pending count' },
        ],
      },
      {
        id: 'meeting-link',
        storyIds: 'COACH-048',
        title: 'Meeting Links',
        icon: 'calendar',
        steps: [
          { id: 'meet-1', text: 'View upcoming confirmed session detail' },
          { id: 'meet-2', text: 'Coach: See editable meeting link field' },
          { id: 'meet-3', text: 'Paste a video meeting URL (must be https://)' },
          { id: 'meet-4', text: 'Auto-saves on blur' },
          { id: 'meet-5', text: 'Use "Test Link" to open in new tab' },
          { id: 'meet-6', text: 'Use "Copy Link" to copy to clipboard' },
          { id: 'meet-7', text: 'Client: See read-only link with "Join Meeting" button' },
        ],
      },
    ],
  },
  {
    phase: 'Phase 6',
    title: 'Email & Reviews (NEW)',
    sections: [
      {
        id: 'email-system',
        storyIds: 'US-001 to US-005',
        title: 'Email Notifications',
        icon: 'message',
        steps: [
          { id: 'email-1', text: 'Set RESEND_API_KEY in .env.local (get from resend.com)' },
          { id: 'email-2', text: 'Book a session - check for booking confirmation email' },
          {
            id: 'email-3',
            text: 'Cancel a session - check for cancellation email to both parties',
          },
          { id: 'email-4', text: 'Check email includes session details, date, time' },
          { id: 'email-5', text: 'Check email includes meeting link if set' },
          { id: 'email-6', text: 'Verify emails have proper AccrediPro CoachHub branding' },
        ],
      },
      {
        id: 'reviews-system',
        storyIds: 'US-006 to US-010',
        title: 'Reviews & Ratings',
        icon: 'check',
        steps: [
          { id: 'review-1', text: 'Complete a session (mark as completed)' },
          { id: 'review-2', text: 'As client, view completed session detail' },
          { id: 'review-3', text: 'See "Leave a Review" form with star rating' },
          { id: 'review-4', text: 'Submit review with 1-5 stars, title, content' },
          { id: 'review-5', text: 'Visit coach profile - see reviews section' },
          { id: 'review-6', text: 'Check average rating and review count display' },
          { id: 'review-7', text: 'Visit /coaches directory - see ratings on coach cards' },
          { id: 'review-8', text: 'As coach, respond to a review' },
          { id: 'review-9', text: 'Verify cannot review same booking twice' },
        ],
      },
      {
        id: 'session-reminders',
        storyIds: 'US-011',
        title: 'Session Reminders (Cron)',
        icon: 'clock',
        steps: [
          { id: 'remind-1', text: 'Set CRON_SECRET in .env.local' },
          { id: 'remind-2', text: 'Book a session 24 hours from now' },
          {
            id: 'remind-3',
            text: 'Manually trigger: curl -H "Authorization: Bearer YOUR_CRON_SECRET" localhost:3001/api/cron/session-reminders',
          },
          { id: 'remind-4', text: 'Check 24-hour reminder email sent to both parties' },
          { id: 'remind-5', text: 'Check 1-hour reminder for sessions starting soon' },
        ],
      },
    ],
  },
  {
    phase: 'Phase 7',
    title: 'Admin Dashboard (NEW)',
    sections: [
      {
        id: 'admin-access',
        storyIds: 'US-012',
        title: 'Admin Access & Layout',
        icon: 'settings',
        steps: [
          { id: 'admin-1', text: 'Set a user role to "admin" in database' },
          { id: 'admin-2', text: 'Visit /admin as admin user - see admin dashboard' },
          { id: 'admin-3', text: 'Visit /admin as non-admin - should redirect to /dashboard' },
          { id: 'admin-4', text: 'Check admin sidebar: Overview, Users, Coaches' },
        ],
      },
      {
        id: 'admin-overview',
        storyIds: 'US-013',
        title: 'Admin Overview Stats',
        icon: 'search',
        steps: [
          { id: 'admin-stat-1', text: 'Visit /admin - see stat cards' },
          { id: 'admin-stat-2', text: 'Check total users count' },
          { id: 'admin-stat-3', text: 'Check total coaches count' },
          { id: 'admin-stat-4', text: 'Check total bookings count' },
          { id: 'admin-stat-5', text: 'Check total revenue' },
          { id: 'admin-stat-6', text: 'See recent bookings list' },
        ],
      },
      {
        id: 'admin-users',
        storyIds: 'US-014',
        title: 'Admin User Management',
        icon: 'user',
        steps: [
          { id: 'admin-user-1', text: 'Visit /admin/users - see paginated user list' },
          { id: 'admin-user-2', text: 'Search users by name or email' },
          { id: 'admin-user-3', text: 'Filter by role (client, coach, admin)' },
          { id: 'admin-user-4', text: 'Change a user role via dropdown' },
          { id: 'admin-user-5', text: 'Verify cannot change own role' },
          { id: 'admin-user-6', text: 'Check confirmation dialog for admin role changes' },
        ],
      },
      {
        id: 'admin-coaches',
        storyIds: 'US-015',
        title: 'Coach Verification',
        icon: 'check',
        steps: [
          { id: 'admin-coach-1', text: 'Visit /admin/coaches - see all coach profiles' },
          { id: 'admin-coach-2', text: 'Filter by verification status' },
          { id: 'admin-coach-3', text: 'Click "Verify" on a pending coach' },
          { id: 'admin-coach-4', text: 'Click "Reject" on a coach' },
          { id: 'admin-coach-5', text: 'Visit verified coach profile - see verified badge' },
          { id: 'admin-coach-6', text: 'Check /coaches directory shows verified badges' },
        ],
      },
    ],
  },
];

const STORAGE_KEY = 'coaching-platform-test-progress';

function getIcon(iconName: string) {
  switch (iconName) {
    case 'settings':
      return <Settings className="h-4 w-4" />;
    case 'user':
      return <User className="h-4 w-4" />;
    case 'search':
      return <Search className="h-4 w-4" />;
    case 'clock':
      return <Clock className="h-4 w-4" />;
    case 'calendar':
      return <Calendar className="h-4 w-4" />;
    case 'credit-card':
      return <CreditCard className="h-4 w-4" />;
    case 'message':
      return <MessageSquare className="h-4 w-4" />;
    case 'check':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
}

export default function TestPage() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCheckedItems(JSON.parse(saved));
      } catch {
        // Invalid JSON, start fresh
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedItems));
    }
  }, [checkedItems, isLoaded]);

  // Calculate totals
  const allSteps = TEST_SECTIONS.flatMap((phase) =>
    phase.sections.flatMap((section) => section.steps)
  );
  const totalSteps = allSteps.length;
  const completedSteps = allSteps.filter((step) => checkedItems[step.id]).length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const resetProgress = () => {
    if (confirm('Are you sure you want to reset all test progress?')) {
      setCheckedItems({});
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const exportProgress = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      progress: checkedItems,
      stats: { completed: completedSteps, total: totalSteps, percent: progressPercent },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-progress-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProgress = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            if (data.progress) {
              setCheckedItems(data.progress);
            }
          } catch {
            alert('Invalid file format');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const markSectionComplete = (steps: { id: string }[]) => {
    setCheckedItems((prev) => {
      const updated = { ...prev };
      steps.forEach((step) => {
        updated[step.id] = true;
      });
      return updated;
    });
  };

  const markSectionIncomplete = (steps: { id: string }[]) => {
    setCheckedItems((prev) => {
      const updated = { ...prev };
      steps.forEach((step) => {
        updated[step.id] = false;
      });
      return updated;
    });
  };

  if (!isLoaded) {
    return (
      <div className="container mx-auto flex max-w-4xl items-center justify-center px-4 py-8">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header with Progress */}
      <div className="mb-8">
        <div className="mb-4 text-center">
          <h1 className="mb-2 text-3xl font-bold">Coaching Platform Testing Guide</h1>
          <p className="text-muted-foreground">
            Track your testing progress - {completedSteps} of {totalSteps} tests completed
          </p>
        </div>

        {/* Progress Bar */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="font-bold text-primary">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetProgress}>
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={exportProgress}>
                <Download className="mr-1 h-3 w-3" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={importProgress}>
                <Upload className="mr-1 h-3 w-3" />
                Import
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prerequisites */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Prerequisites
          </CardTitle>
          <CardDescription>Required setup before testing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold">Environment Variables (.env.local)</h4>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                <code>DATABASE_URL</code> - PostgreSQL connection string
              </li>
              <li>
                <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> - Clerk public key
              </li>
              <li>
                <code>CLERK_SECRET_KEY</code> - Clerk secret key
              </li>
              <li>
                <code>CLERK_WEBHOOK_SECRET</code> - For user sync webhook
              </li>
              <li>
                <code>STRIPE_SECRET_KEY</code> - Stripe secret key (for payments)
              </li>
              <li>
                <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> - Stripe public key
              </li>
              <li>
                <code>STRIPE_WEBHOOK_SECRET</code> - For payment webhooks
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Database Setup</h4>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                Run <code>npm run db:migrate</code> to apply all migrations
              </li>
              <li>10 migrations total (0000-0010)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Stripe Test Card</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Use <code>4242 4242 4242 4242</code> with any future expiry and any CVC
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Data - Existing Users & Coaches */}
      <Card className="mb-6 border-burgundy/30 bg-cream/50 dark:bg-burgundy-dark/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-burgundy" />
            Test Data (Database)
          </CardTitle>
          <CardDescription>Existing users and coaches for testing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-burgundy dark:text-burgundy-light">Coach Accounts</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Slug</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  <tr className="border-b border-dashed">
                    <td className="py-1.5 pr-4">coach.qa.test@gmail.com</td>
                    <td className="py-1.5 pr-4">test-coach</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-xs">
                        pending
                      </Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5 pr-4">tettypottycoach@gmail.com</td>
                    <td className="py-1.5 pr-4">tettypotty-coach</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-xs">
                        pending
                      </Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5 pr-4">sarah.johnson@demomail.com</td>
                    <td className="py-1.5 pr-4">sarah-johnson</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-xs">
                        pending
                      </Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5 pr-4">michael.chen@demomail.com</td>
                    <td className="py-1.5 pr-4">michael-chen</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-xs">
                        pending
                      </Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5 pr-4">emily.rodriguez@demomail.com</td>
                    <td className="py-1.5 pr-4">emily-rodriguez</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-xs">
                        pending
                      </Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5 pr-4">david.kim@demomail.com</td>
                    <td className="py-1.5 pr-4">david-kim</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-xs">
                        pending
                      </Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5 pr-4">lisa.thompson@demomail.com</td>
                    <td className="py-1.5 pr-4">lisa-thompson</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-xs">
                        pending
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-4">james.wilson@demomail.com</td>
                    <td className="py-1.5 pr-4">james-wilson</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className="text-xs">
                        pending
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold text-burgundy dark:text-burgundy-light">Client Accounts</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2">Email</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  <tr className="border-b border-dashed">
                    <td className="py-1.5">tettypottyclient@gmail.com</td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5">alex.morgan@demomail.com</td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5">jessica.lee@demomail.com</td>
                  </tr>
                  <tr>
                    <td className="py-1.5">marcus.johnson@demomail.com</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <Separator />
          <div className="rounded-md bg-gold/10 p-3 dark:bg-gold-dark/20">
            <h4 className="font-semibold text-burgundy-dark dark:text-gold">Quick Links</h4>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <a href="/coaches/test-coach" className="text-burgundy hover:underline">
                /coaches/test-coach
              </a>
              <span className="text-muted-foreground">|</span>
              <a href="/coaches/sarah-johnson" className="text-burgundy hover:underline">
                /coaches/sarah-johnson
              </a>
              <span className="text-muted-foreground">|</span>
              <a href="/coaches/michael-chen" className="text-burgundy hover:underline">
                /coaches/michael-chen
              </a>
              <span className="text-muted-foreground">|</span>
              <a href="/admin" className="text-burgundy hover:underline">
                /admin
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Test Sections */}
      {TEST_SECTIONS.map((phase) => (
        <div key={phase.phase} className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline" className="text-lg">
              {phase.phase}
            </Badge>
            <h2 className="text-2xl font-bold">{phase.title}</h2>
            <span className="ml-auto text-sm text-muted-foreground">
              {
                phase.sections.flatMap((s) => s.steps).filter((step) => checkedItems[step.id])
                  .length
              }
              /{phase.sections.flatMap((s) => s.steps).length}
            </span>
          </div>

          <div className="grid gap-4">
            {phase.sections.map((section) => {
              const sectionCompleted = section.steps.filter((s) => checkedItems[s.id]).length;
              const sectionTotal = section.steps.length;
              const allComplete = sectionCompleted === sectionTotal;

              return (
                <Card key={section.id} className={allComplete ? 'border-sage/50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {getIcon(section.icon)}
                        {section.title}
                        {allComplete && <CheckCircle className="h-4 w-4 text-sage" />}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={allComplete ? 'default' : 'secondary'}
                          className={`text-xs ${allComplete ? 'bg-sage' : ''}`}
                        >
                          {sectionCompleted}/{sectionTotal}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {section.storyIds}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {section.steps.map((step) => (
                        <li key={step.id} className="flex items-start gap-3">
                          <Checkbox
                            id={step.id}
                            checked={checkedItems[step.id] || false}
                            onCheckedChange={() => toggleItem(step.id)}
                            className="mt-0.5"
                          />
                          <label
                            htmlFor={step.id}
                            className={`cursor-pointer text-sm ${
                              checkedItems[step.id]
                                ? 'text-muted-foreground line-through'
                                : 'text-foreground'
                            }`}
                          >
                            {step.text}
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markSectionComplete(section.steps)}
                        disabled={allComplete}
                      >
                        Mark All Complete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markSectionIncomplete(section.steps)}
                        disabled={sectionCompleted === 0}
                      >
                        Clear Section
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Separator className="my-8" />
        </div>
      ))}

      {/* Recommended Test Flow */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Recommended Test Flow</CardTitle>
          <CardDescription>Complete end-to-end testing</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>Create Account A (will be coach) - Complete onboarding, set availability</li>
            <li>Create Account B (will be client) - Browse coaches, book a session</li>
            <li>Complete payment flow with Stripe test card: 4242 4242 4242 4242</li>
            <li>Send messages between accounts</li>
            <li>Add action items from coach to client</li>
            <li>Test reschedule and cancellation flows</li>
            <li>Add meeting link and session notes</li>
          </ol>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        <p>63 user stories implemented across 7 phases</p>
        <p className="mt-1">
          Progress is saved to your browser. Use Export/Import to backup or share.
        </p>
      </div>
    </div>
  );
}
