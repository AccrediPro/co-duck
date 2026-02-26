import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionCard } from './session-card';
import type { SessionWithClient } from '@/app/(dashboard)/dashboard/sessions/actions';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock date-fns format
vi.mock('date-fns', () => ({
  format: (date: Date, pattern: string) => {
    if (pattern === 'EEE, MMM d, yyyy') return 'Mon, Jan 15, 2025';
    if (pattern === 'h:mm a') return '10:00 AM';
    return date.toISOString();
  },
}));

// Mock CancellationDialog
vi.mock('./cancellation-dialog', () => ({
  CancellationDialog: ({ triggerButton }: { triggerButton: React.ReactNode }) => (
    <div data-testid="cancellation-dialog">{triggerButton}</div>
  ),
}));

function createMockSession(overrides: Partial<SessionWithClient> = {}): SessionWithClient {
  return {
    id: 1,
    clientId: 'user_123',
    clientName: 'Jane Doe',
    clientAvatar: 'https://example.com/avatar.jpg',
    clientEmail: 'jane@example.com',
    sessionType: { name: 'Discovery Call', duration: 30, price: 5000 },
    startTime: new Date('2025-01-15T10:00:00Z'),
    endTime: new Date('2025-01-15T10:30:00Z'),
    status: 'confirmed',
    clientNotes: null,
    coachNotes: null,
    createdAt: new Date('2025-01-10T08:00:00Z'),
    paymentStatus: 'paid',
    ...overrides,
  };
}

describe('SessionCard', () => {
  it('renders client name and session type', () => {
    render(<SessionCard session={createMockSession()} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Discovery Call')).toBeInTheDocument();
  });

  it('renders "Unknown Client" when clientName is null', () => {
    render(<SessionCard session={createMockSession({ clientName: null })} />);

    expect(screen.getByText('Unknown Client')).toBeInTheDocument();
  });

  it('shows correct status badge for confirmed', () => {
    render(<SessionCard session={createMockSession({ status: 'confirmed' })} />);

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows correct status badge for pending', () => {
    render(<SessionCard session={createMockSession({ status: 'pending' })} />);

    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('shows correct status badge for completed', () => {
    render(<SessionCard session={createMockSession({ status: 'completed' })} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows correct status badge for cancelled', () => {
    render(<SessionCard session={createMockSession({ status: 'cancelled' })} />);

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows correct status badge for no_show', () => {
    render(<SessionCard session={createMockSession({ status: 'no_show' })} />);

    expect(screen.getByText('No Show')).toBeInTheDocument();
  });

  it('shows Paid payment badge for paid sessions', () => {
    render(
      <SessionCard
        session={createMockSession({ paymentStatus: 'paid' })}
      />
    );

    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('shows Payment Required badge', () => {
    render(
      <SessionCard
        session={createMockSession({ paymentStatus: 'payment_required' })}
      />
    );

    expect(screen.getByText('Payment Required')).toBeInTheDocument();
  });

  it('shows Payment Failed badge', () => {
    render(
      <SessionCard
        session={createMockSession({ paymentStatus: 'payment_failed' })}
      />
    );

    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
  });

  it('does not show payment badge for free sessions', () => {
    render(
      <SessionCard
        session={createMockSession({
          paymentStatus: 'free',
          sessionType: { name: 'Free Call', duration: 15, price: 0 },
        })}
      />
    );

    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment Required')).not.toBeInTheDocument();
  });

  it('formats price correctly', () => {
    render(<SessionCard session={createMockSession()} />);

    expect(screen.getByText('30 min - $50.00')).toBeInTheDocument();
  });

  it('renders View link pointing to session details', () => {
    render(<SessionCard session={createMockSession({ id: 42 })} />);

    const viewLink = screen.getByText('View').closest('a');
    expect(viewLink).toHaveAttribute('href', '/dashboard/sessions/42');
  });

  it('shows Accept/Reject buttons for pending approval', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      <SessionCard
        session={createMockSession({ status: 'pending' })}
        onAccept={onAccept}
        onReject={onReject}
      />
    );

    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('does not show Accept/Reject for non-pending sessions', () => {
    render(
      <SessionCard
        session={createMockSession({ status: 'confirmed' })}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('shows Complete button for past, non-completed sessions', () => {
    render(
      <SessionCard
        session={createMockSession({ status: 'confirmed' })}
        isPast={true}
        onMarkComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('does not show Complete button for already completed sessions', () => {
    render(
      <SessionCard
        session={createMockSession({ status: 'completed' })}
        isPast={true}
        onMarkComplete={vi.fn()}
      />
    );

    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('shows Cancel button for cancellable sessions', () => {
    render(
      <SessionCard
        session={createMockSession({ status: 'confirmed' })}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not show Cancel for already cancelled sessions', () => {
    render(
      <SessionCard
        session={createMockSession({ status: 'cancelled' })}
        isCancelled={true}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('calls onAccept when Accept is clicked', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionCard
        session={createMockSession({ status: 'pending' })}
        onAccept={onAccept}
      />
    );

    fireEvent.click(screen.getByText('Accept'));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith(1);
    });
  });

  it('calls onReject when Reject is clicked', async () => {
    const onReject = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionCard
        session={createMockSession({ status: 'pending' })}
        onReject={onReject}
      />
    );

    fireEvent.click(screen.getByText('Reject'));

    await waitFor(() => {
      expect(onReject).toHaveBeenCalledWith(1);
    });
  });

  it('disables buttons during accept/reject loading', async () => {
    // Accept that never resolves
    const onAccept = vi.fn(() => new Promise<void>(() => {}));
    const onReject = vi.fn();
    render(
      <SessionCard
        session={createMockSession({ status: 'pending' })}
        onAccept={onAccept}
        onReject={onReject}
      />
    );

    fireEvent.click(screen.getByText('Accept'));

    // Both buttons should be disabled while accepting
    await waitFor(() => {
      const acceptBtn = screen.getByText('Accept').closest('button');
      const rejectBtn = screen.getByText('Reject').closest('button');
      expect(acceptBtn).toBeDisabled();
      expect(rejectBtn).toBeDisabled();
    });
  });
});
