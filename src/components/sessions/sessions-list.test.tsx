import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionsList } from './sessions-list';

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(''),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock server actions — full mock (no importActual since it's a server module)
vi.mock('@/app/(dashboard)/dashboard/sessions/actions', () => ({
  markSessionComplete: vi.fn().mockResolvedValue({ success: true }),
  cancelSession: vi.fn().mockResolvedValue({ success: true }),
  getRefundEligibility: vi.fn().mockResolvedValue({ success: false }),
}));

// Mock date-fns format
vi.mock('date-fns', () => ({
  format: () => 'Mon, Jan 15, 2025',
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock CancellationDialog
vi.mock('./cancellation-dialog', () => ({
  CancellationDialog: ({ triggerButton }: { triggerButton: React.ReactNode }) => (
    <div data-testid="cancellation-dialog">{triggerButton}</div>
  ),
}));

// Inline the types we need (they come from the mocked server module)
interface SessionWithClient {
  id: number;
  clientId: string;
  clientName: string | null;
  clientAvatar: string | null;
  clientEmail: string;
  sessionType: { name: string; duration: number; price: number };
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  clientNotes: string | null;
  coachNotes: string | null;
  createdAt: Date;
  paymentStatus: 'free' | 'paid' | 'payment_required' | 'payment_failed';
}

function createMockSession(overrides: Partial<SessionWithClient> = {}): SessionWithClient {
  return {
    id: 1,
    clientId: 'user_123',
    clientName: 'Test Client',
    clientAvatar: null,
    clientEmail: 'test@example.com',
    sessionType: { name: 'Coaching Session', duration: 60, price: 10000 },
    startTime: new Date('2025-01-20T14:00:00Z'),
    endTime: new Date('2025-01-20T15:00:00Z'),
    status: 'confirmed',
    clientNotes: null,
    coachNotes: null,
    createdAt: new Date('2025-01-10T08:00:00Z'),
    paymentStatus: 'paid',
    ...overrides,
  };
}

describe('SessionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four tab triggers', () => {
    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={[]}
        initialTotalCount={0}
        currentPage={1}
        perPage={10}
      />
    );

    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Past')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows empty state when no sessions', () => {
    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={[]}
        initialTotalCount={0}
        currentPage={1}
        perPage={10}
      />
    );

    expect(screen.getByText('No upcoming sessions')).toBeInTheDocument();
  });

  it('renders session cards when sessions exist', () => {
    const sessions = [
      createMockSession({ id: 1, clientName: 'Alice' }),
      createMockSession({ id: 2, clientName: 'Bob' }),
    ];

    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={sessions}
        initialTotalCount={2}
        currentPage={1}
        perPage={10}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows count text', () => {
    const sessions = [createMockSession()];

    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={sessions}
        initialTotalCount={1}
        currentPage={1}
        perPage={10}
      />
    );

    expect(screen.getByText(/Showing 1-1 of 1 session$/)).toBeInTheDocument();
  });

  it('pluralizes session count text', () => {
    const sessions = [
      createMockSession({ id: 1 }),
      createMockSession({ id: 2 }),
    ];

    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={sessions}
        initialTotalCount={2}
        currentPage={1}
        perPage={10}
      />
    );

    expect(screen.getByText(/Showing 1-2 of 2 sessions$/)).toBeInTheDocument();
  });

  it('does not show pagination when only one page', () => {
    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={[createMockSession()]}
        initialTotalCount={1}
        currentPage={1}
        perPage={10}
      />
    );

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('shows pagination when multiple pages', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      createMockSession({ id: i + 1 })
    );

    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={sessions}
        initialTotalCount={25}
        currentPage={1}
        perPage={10}
      />
    );

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('starts with correct initial tab active', () => {
    render(
      <SessionsList
        initialTab="confirmed"
        initialSessions={[]}
        initialTotalCount={0}
        currentPage={1}
        perPage={10}
      />
    );

    // Confirmed tab should be active with initialTab="confirmed"
    const confirmedTab = screen.getByText('Confirmed').closest('button');
    expect(confirmedTab).toHaveAttribute('data-state', 'active');

    // Other tabs should be inactive
    const upcomingTab = screen.getByText('Upcoming').closest('button');
    expect(upcomingTab).toHaveAttribute('data-state', 'inactive');
  });
});
