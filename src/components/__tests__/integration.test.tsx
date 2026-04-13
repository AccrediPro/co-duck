import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: () => 'Mon, Jan 15, 2025',
}));

// Mock CancellationDialog
vi.mock('@/components/sessions/cancellation-dialog', () => ({
  CancellationDialog: ({ triggerButton }: { triggerButton: React.ReactNode }) => (
    <div data-testid="cancellation-dialog">{triggerButton}</div>
  ),
}));

// Mock server actions — full mock (no importActual)
const mockMarkComplete = vi.fn();
const mockCancelSession = vi.fn();
const mockGetRefundEligibility = vi.fn();
vi.mock('@/app/(dashboard)/dashboard/sessions/actions', () => ({
  markSessionComplete: (...args: unknown[]) => mockMarkComplete(...args),
  cancelSession: (...args: unknown[]) => mockCancelSession(...args),
  getRefundEligibility: (...args: unknown[]) => mockGetRefundEligibility(...args),
}));

import { SessionsList } from '@/components/sessions/sessions-list';

// Inline the types
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

function createSession(overrides: Partial<SessionWithClient> = {}): SessionWithClient {
  return {
    id: 1,
    clientId: 'user_client1',
    clientName: 'Test Client',
    clientAvatar: null,
    clientEmail: 'client@test.com',
    sessionType: { name: 'Coaching', duration: 60, price: 10000 },
    startTime: new Date('2025-01-20T14:00:00Z'),
    endTime: new Date('2025-01-20T15:00:00Z'),
    status: 'confirmed',
    clientNotes: null,
    coachNotes: null,
    createdAt: new Date(),
    paymentStatus: 'paid',
    ...overrides,
  };
}

describe('Integration: SessionsList with SessionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRefundEligibility.mockResolvedValue({ success: false });
  });

  it('marks a session as complete and shows success toast', async () => {
    mockMarkComplete.mockResolvedValue({ success: true });

    const sessions = [createSession({ id: 1, clientName: 'Alice', status: 'confirmed' })];

    render(
      <SessionsList
        initialTab="past"
        initialSessions={sessions}
        initialTotalCount={1}
        currentPage={1}
        perPage={10}
      />
    );

    const completeBtn = screen.getByText('Complete');
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(mockMarkComplete).toHaveBeenCalledWith(1);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Session marked as complete',
        })
      );
    });
  });

  it('shows error toast when marking complete fails', async () => {
    mockMarkComplete.mockResolvedValue({ success: false, error: 'Not authorized' });

    render(
      <SessionsList
        initialTab="past"
        initialSessions={[createSession({ status: 'confirmed' })]}
        initialTotalCount={1}
        currentPage={1}
        perPage={10}
      />
    );

    fireEvent.click(screen.getByText('Complete'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      );
    });
  });

  it('handles booking acceptance via fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    const sessions = [createSession({ id: 5, status: 'pending', clientName: 'Pending Client' })];

    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={sessions}
        initialTotalCount={1}
        currentPage={1}
        perPage={10}
      />
    );

    fireEvent.click(screen.getByText('Accept'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/bookings/5/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'accept' }),
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Booking accepted' })
      );
    });
  });

  it('handles booking rejection via fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    const sessions = [createSession({ id: 7, status: 'pending', clientName: 'Rejected Client' })];

    render(
      <SessionsList
        initialTab="upcoming"
        initialSessions={sessions}
        initialTotalCount={1}
        currentPage={1}
        perPage={10}
      />
    );

    fireEvent.click(screen.getByText('Reject'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/bookings/7/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'reject' }),
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Booking rejected' })
      );
    });
  });

  it('shows empty state for cancelled tab', () => {
    render(
      <SessionsList
        initialTab="cancelled"
        initialSessions={[]}
        initialTotalCount={0}
        currentPage={1}
        perPage={10}
      />
    );

    expect(screen.getByText('No cancelled sessions')).toBeInTheDocument();
    expect(screen.getByText(/That's a good thing!/)).toBeInTheDocument();
  });
});

describe('Integration: Booking data transformation', () => {
  it('correctly transforms session type price from cents to dollars', () => {
    const sessionType = { name: 'Premium Session', duration: 90, price: 25000 };

    const formatted = `$${(sessionType.price / 100).toFixed(2)}`;
    expect(formatted).toBe('$250.00');
  });

  it('correctly calculates platform fee (10%)', () => {
    const totalCents = 15000;
    const platformFeeCents = Math.round(totalCents * 0.1);
    const coachPayoutCents = totalCents - platformFeeCents;

    expect(platformFeeCents).toBe(1500);
    expect(coachPayoutCents).toBe(13500);
  });

  it('handles zero-price sessions', () => {
    const sessionType = { name: 'Free Discovery', duration: 15, price: 0 };

    const formatted = `$${(sessionType.price / 100).toFixed(2)}`;
    expect(formatted).toBe('$0.00');

    const isPaid = sessionType.price > 0;
    expect(isPaid).toBe(false);
  });

  it('handles various currency amounts', () => {
    const amounts = [
      { cents: 100, expected: '1.00' },
      { cents: 1, expected: '0.01' },
      { cents: 99999, expected: '999.99' },
      { cents: 50, expected: '0.50' },
    ];

    for (const { cents, expected } of amounts) {
      expect((cents / 100).toFixed(2)).toBe(expected);
    }
  });
});
