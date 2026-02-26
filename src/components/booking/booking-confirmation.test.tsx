import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingConfirmation } from './booking-confirmation';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock server actions
const mockCreateBooking = vi.fn();
const mockCreateCheckoutSession = vi.fn();
const mockGenerateIcsFile = vi.fn();
vi.mock('@/app/(public)/coaches/[slug]/book/confirm/actions', () => ({
  createBooking: (...args: unknown[]) => mockCreateBooking(...args),
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
  generateIcsFile: (...args: unknown[]) => mockGenerateIcsFile(...args),
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
  name: 'Dr. Smith',
  avatarUrl: 'https://example.com/avatar.jpg',
  headline: 'Executive Coach',
  timezone: 'America/New_York',
  currency: 'USD',
  sessionTypes: [],
  bufferMinutes: 15,
  advanceNoticeHours: 24,
  maxAdvanceDays: 30,
};

const defaultSessionType = {
  id: 'st_1',
  name: 'Discovery Call',
  duration: 30,
  price: 5000,
};

const defaultProps = {
  coach: defaultCoach,
  slug: 'dr-smith',
  sessionType: defaultSessionType,
  startTime: '2025-02-15T14:00:00Z',
  endTime: '2025-02-15T14:30:00Z',
  clientTimezone: 'America/New_York',
  isAuthenticated: true,
  returnUrl: '/coaches/dr-smith/book/confirm',
};

describe('BookingConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders coach name and headline', () => {
    render(<BookingConfirmation {...defaultProps} />);

    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Executive Coach')).toBeInTheDocument();
  });

  it('renders session type name and duration', () => {
    render(<BookingConfirmation {...defaultProps} />);

    expect(screen.getByText('Discovery Call')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
  });

  it('formats price correctly in USD', () => {
    render(<BookingConfirmation {...defaultProps} />);

    // Price appears in badge and total
    const priceElements = screen.getAllByText('$50.00');
    expect(priceElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders timezone display', () => {
    render(<BookingConfirmation {...defaultProps} />);

    expect(screen.getByText(/Your timezone: America\/New_York/)).toBeInTheDocument();
  });

  it('shows "Pay Now" button for paid sessions when authenticated', () => {
    render(<BookingConfirmation {...defaultProps} />);

    expect(screen.getByText('Pay Now')).toBeInTheDocument();
  });

  it('shows "Confirm Booking" for free sessions when authenticated', () => {
    render(
      <BookingConfirmation
        {...defaultProps}
        sessionType={{ ...defaultSessionType, price: 0 }}
      />
    );

    expect(screen.getByText('Confirm Booking')).toBeInTheDocument();
  });

  it('shows sign-in prompt when not authenticated (paid)', () => {
    render(<BookingConfirmation {...defaultProps} isAuthenticated={false} />);

    expect(screen.getByText('Sign in to Pay & Book')).toBeInTheDocument();
  });

  it('shows sign-in prompt when not authenticated (free)', () => {
    render(
      <BookingConfirmation
        {...defaultProps}
        isAuthenticated={false}
        sessionType={{ ...defaultSessionType, price: 0 }}
      />
    );

    expect(screen.getByText('Sign in to Confirm Booking')).toBeInTheDocument();
  });

  it('shows auth warning when not authenticated', () => {
    render(<BookingConfirmation {...defaultProps} isAuthenticated={false} />);

    expect(screen.getByText(/You'll need to sign in/)).toBeInTheDocument();
  });

  it('does not show auth warning when authenticated', () => {
    render(<BookingConfirmation {...defaultProps} isAuthenticated={true} />);

    expect(screen.queryByText(/You'll need to sign in/)).not.toBeInTheDocument();
  });

  it('redirects to sign-in when unauthenticated user clicks confirm', async () => {
    render(<BookingConfirmation {...defaultProps} isAuthenticated={false} />);

    fireEvent.click(screen.getByText('Sign in to Pay & Book'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('/sign-in?redirect_url=')
      );
    });
  });

  it('renders notes textarea with character counter', () => {
    render(<BookingConfirmation {...defaultProps} />);

    expect(screen.getByLabelText(/Notes for your coach/)).toBeInTheDocument();
    expect(screen.getByText('0/1000 characters')).toBeInTheDocument();
  });

  it('updates character counter as user types', () => {
    render(<BookingConfirmation {...defaultProps} />);

    const textarea = screen.getByLabelText(/Notes for your coach/);
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    expect(screen.getByText('5/1000 characters')).toBeInTheDocument();
  });

  it('renders back and cancel links', () => {
    render(<BookingConfirmation {...defaultProps} />);

    const backLink = screen.getByText('Back to Time Selection').closest('a');
    expect(backLink).toHaveAttribute('href', '/coaches/dr-smith/book');

    const cancelLink = screen.getByText('Cancel').closest('a');
    expect(cancelLink).toHaveAttribute('href', '/coaches/dr-smith');
  });

  it('calls createCheckoutSession for paid sessions', async () => {
    mockCreateCheckoutSession.mockResolvedValue({ success: true, checkoutUrl: 'https://checkout.stripe.com/test' });

    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<BookingConfirmation {...defaultProps} />);

    fireEvent.click(screen.getByText('Pay Now'));

    await waitFor(() => {
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          coachId: 'coach_1',
          coachSlug: 'dr-smith',
          sessionType: { name: 'Discovery Call', duration: 30, price: 5000 },
        })
      );
    });

    // Restore
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('calls createBooking for free sessions', async () => {
    mockCreateBooking.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        coachName: 'Dr. Smith',
        coachSlug: 'dr-smith',
        coachAvatarUrl: null,
        sessionType: { name: 'Free Call', duration: 15, price: 0 },
        startTime: new Date('2025-02-15T14:00:00Z'),
        endTime: new Date('2025-02-15T14:15:00Z'),
        clientNotes: null,
      },
    });

    render(
      <BookingConfirmation
        {...defaultProps}
        sessionType={{ ...defaultSessionType, name: 'Free Call', duration: 15, price: 0 }}
      />
    );

    fireEvent.click(screen.getByText('Confirm Booking'));

    await waitFor(() => {
      expect(mockCreateBooking).toHaveBeenCalled();
    });
  });
});
