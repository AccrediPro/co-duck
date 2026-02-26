import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock @sentry/nextjs
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock next/navigation for booking error
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'test-coach' }),
}));

import * as Sentry from '@sentry/nextjs';

import DashboardHomeError from '@/app/(dashboard)/dashboard/error';
import SessionsError from '@/app/(dashboard)/dashboard/sessions/error';
import MessagesError from '@/app/(dashboard)/dashboard/messages/error';
import BookingError from '@/app/(public)/coaches/[slug]/book/error';

describe('Error Boundaries', () => {
  const testError = Object.assign(new Error('Test error'), { digest: 'abc123' });
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('DashboardHomeError', () => {
    it('renders error message', () => {
      render(<DashboardHomeError error={testError} reset={mockReset} />);

      expect(screen.getByText('Unable to load your dashboard')).toBeInTheDocument();
    });

    it('shows error digest', () => {
      render(<DashboardHomeError error={testError} reset={mockReset} />);

      expect(screen.getByText('Error ID: abc123')).toBeInTheDocument();
    });

    it('does not show digest when absent', () => {
      const errorNoDigest = new Error('No digest') as Error & { digest?: string };
      render(<DashboardHomeError error={errorNoDigest} reset={mockReset} />);

      expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
    });

    it('calls Sentry.captureException', () => {
      render(<DashboardHomeError error={testError} reset={mockReset} />);

      expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    });

    it('calls reset when Try Again is clicked', () => {
      render(<DashboardHomeError error={testError} reset={mockReset} />);

      fireEvent.click(screen.getByText('Try Again'));
      expect(mockReset).toHaveBeenCalled();
    });

    it('has Go Home link', () => {
      render(<DashboardHomeError error={testError} reset={mockReset} />);

      const homeLink = screen.getByText('Go Home').closest('a');
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  describe('SessionsError', () => {
    it('renders sessions error message', () => {
      render(<SessionsError error={testError} reset={mockReset} />);

      expect(screen.getByText('Something went wrong loading your sessions')).toBeInTheDocument();
    });

    it('calls Sentry.captureException', () => {
      render(<SessionsError error={testError} reset={mockReset} />);

      expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    });

    it('has Back to Dashboard link', () => {
      render(<SessionsError error={testError} reset={mockReset} />);

      const link = screen.getByText('Back to Dashboard').closest('a');
      expect(link).toHaveAttribute('href', '/dashboard');
    });

    it('calls reset when Try Again is clicked', () => {
      render(<SessionsError error={testError} reset={mockReset} />);

      fireEvent.click(screen.getByText('Try Again'));
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('MessagesError', () => {
    it('renders messages error message', () => {
      render(<MessagesError error={testError} reset={mockReset} />);

      expect(screen.getByText('Unable to load messages')).toBeInTheDocument();
    });

    it('calls Sentry.captureException', () => {
      render(<MessagesError error={testError} reset={mockReset} />);

      expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    });

    it('has Back to Dashboard link', () => {
      render(<MessagesError error={testError} reset={mockReset} />);

      const link = screen.getByText('Back to Dashboard').closest('a');
      expect(link).toHaveAttribute('href', '/dashboard');
    });

    it('calls reset when Try Again is clicked', () => {
      render(<MessagesError error={testError} reset={mockReset} />);

      fireEvent.click(screen.getByText('Try Again'));
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('BookingError', () => {
    it('renders booking error message', () => {
      render(<BookingError error={testError} reset={mockReset} />);

      expect(screen.getByText('Booking unavailable')).toBeInTheDocument();
    });

    it('mentions no payment was charged', () => {
      render(<BookingError error={testError} reset={mockReset} />);

      expect(screen.getByText(/No payment has been charged/)).toBeInTheDocument();
    });

    it('calls Sentry.captureException', () => {
      render(<BookingError error={testError} reset={mockReset} />);

      expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    });

    it('has Back to Coach Profile link with slug', () => {
      render(<BookingError error={testError} reset={mockReset} />);

      const link = screen.getByText('Back to Coach Profile').closest('a');
      expect(link).toHaveAttribute('href', '/coaches/test-coach');
    });

    it('calls reset when Try Again is clicked', () => {
      render(<BookingError error={testError} reset={mockReset} />);

      fireEvent.click(screen.getByText('Try Again'));
      expect(mockReset).toHaveBeenCalled();
    });
  });
});
