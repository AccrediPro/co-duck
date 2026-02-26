import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentSuccessContent } from './payment-success-content';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock server actions
vi.mock('@/app/(public)/coaches/[slug]/book/success/actions', () => ({
  generateSuccessIcsFile: vi.fn(),
}));

// Mock validators
vi.mock('@/lib/validators/coach-onboarding', () => ({
  SUPPORTED_CURRENCIES: [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '\u20AC', name: 'Euro' },
  ],
}));

const defaultCoach = {
  userId: 'coach_1',
  name: 'Coach Jane',
  avatarUrl: null,
  headline: 'Life Coach',
  timezone: 'America/Chicago',
  currency: 'USD',
  sessionTypes: [],
  bufferMinutes: 15,
  advanceNoticeHours: 24,
  maxAdvanceDays: 30,
};

const defaultBooking = {
  id: 42,
  coachName: 'Coach Jane',
  coachAvatarUrl: null,
  sessionType: { name: 'Power Session', duration: 60, price: 15000 },
  startTime: new Date('2025-03-01T15:00:00Z'),
  endTime: new Date('2025-03-01T16:00:00Z'),
  clientNotes: 'Looking forward to it!',
  coachTimezone: 'America/Chicago',
  coachSlug: 'coach-jane',
  status: 'pending' as const,
  amountPaid: 15000,
  currency: 'USD',
};

describe('PaymentSuccessContent', () => {
  it('renders success state with booking details', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={defaultBooking}
      />
    );

    expect(screen.getByText('Booking Request Submitted!')).toBeInTheDocument();
    expect(screen.getByText(/Payment of \$150\.00 USD confirmed/)).toBeInTheDocument();
  });

  it('renders coach name in description', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={defaultBooking}
      />
    );

    const coachNameElements = screen.getAllByText(/Coach Jane/);
    expect(coachNameElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders session type details', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={defaultBooking}
      />
    );

    expect(screen.getByText('Power Session')).toBeInTheDocument();
    expect(screen.getByText('60 minutes')).toBeInTheDocument();
  });

  it('renders booking reference number', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={defaultBooking}
      />
    );

    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Booking Reference')).toBeInTheDocument();
  });

  it('renders client notes when present', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={defaultBooking}
      />
    );

    expect(screen.getByText('Looking forward to it!')).toBeInTheDocument();
  });

  it('does not show notes section when clientNotes is null', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={{ ...defaultBooking, clientNotes: null }}
      />
    );

    expect(screen.queryByText('Your Notes:')).not.toBeInTheDocument();
  });

  it('shows pending approval notice', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={defaultBooking}
      />
    );

    expect(screen.getByText(/Awaiting coach approval/)).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={defaultBooking}
      />
    );

    expect(screen.getByText('Add to Calendar')).toBeInTheDocument();
    expect(screen.getByText('View Coach Profile')).toBeInTheDocument();
    expect(screen.getByText('Go to My Sessions')).toBeInTheDocument();
  });

  it('links to correct coach profile', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        booking={defaultBooking}
      />
    );

    const profileLink = screen.getByText('View Coach Profile').closest('a');
    expect(profileLink).toHaveAttribute('href', '/coaches/coach-jane');
  });

  it('renders error state when error prop is set', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
        error="Something went wrong"
      />
    );

    expect(screen.getByText('Payment Processing')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders error state when booking is undefined', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
      />
    );

    expect(screen.getByText('Payment Processing')).toBeInTheDocument();
    expect(screen.getByText('View My Sessions')).toBeInTheDocument();
  });

  it('shows fallback message in error state', () => {
    render(
      <PaymentSuccessContent
        coach={defaultCoach}
        slug="coach-jane"
      />
    );

    expect(screen.getByText(/We are processing your booking/)).toBeInTheDocument();
  });
});
