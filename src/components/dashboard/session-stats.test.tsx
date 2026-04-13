import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionStats } from './session-stats';

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

describe('SessionStats', () => {
  it('renders all stat values', () => {
    render(<SessionStats distinctClients={12} sessionsThisMonth={5} totalSessions={48} />);

    expect(screen.getByText('Session Stats')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
  });

  it('renders stat labels', () => {
    render(<SessionStats distinctClients={0} sessionsThisMonth={0} totalSessions={0} />);

    expect(screen.getByText('Total Clients')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
  });

  it('shows pending requests link when count > 0', () => {
    render(
      <SessionStats
        distinctClients={3}
        sessionsThisMonth={1}
        totalSessions={10}
        pendingBookingRequests={4}
      />
    );

    expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    const link = screen.getByText('Pending Requests').closest('a');
    expect(link).toHaveAttribute('href', '/dashboard/sessions?tab=upcoming');
  });

  it('does not show pending requests when count is 0', () => {
    render(
      <SessionStats
        distinctClients={3}
        sessionsThisMonth={1}
        totalSessions={10}
        pendingBookingRequests={0}
      />
    );

    expect(screen.queryByText('Pending Requests')).not.toBeInTheDocument();
  });

  it('does not show pending requests when prop is omitted', () => {
    render(<SessionStats distinctClients={3} sessionsThisMonth={1} totalSessions={10} />);

    expect(screen.queryByText('Pending Requests')).not.toBeInTheDocument();
  });
});
