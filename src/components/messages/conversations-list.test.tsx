import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversationsList } from './conversations-list';

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

// Mock useSocket
vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ socket: null, isConnected: false }),
}));

// Mock server action
vi.mock('@/app/(dashboard)/dashboard/messages/actions', () => ({
  getConversations: vi.fn().mockResolvedValue({ success: true, conversations: [] }),
}));

interface ConversationWithDetails {
  id: number;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
  lastMessageContent: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  isCoach: boolean;
}

function createConversation(overrides: Partial<ConversationWithDetails> = {}): ConversationWithDetails {
  return {
    id: 1,
    otherUserId: 'user_456',
    otherUserName: 'Bob Jones',
    otherUserAvatar: null,
    lastMessageContent: 'See you tomorrow!',
    lastMessageAt: new Date(),
    unreadCount: 0,
    isCoach: false,
    ...overrides,
  };
}

describe('ConversationsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conversations', () => {
    const conversations = [
      createConversation({ id: 1, otherUserName: 'Alice' }),
      createConversation({ id: 2, otherUserName: 'Bob' }),
    ];

    render(<ConversationsList initialConversations={conversations} userRole="coach" />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows client empty state when role is client', () => {
    render(<ConversationsList initialConversations={[]} userRole="client" />);

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('Book a session with a coach to start chatting.')).toBeInTheDocument();
    expect(screen.getByText('Browse Coaches')).toBeInTheDocument();
  });

  it('shows coach empty state when role is coach', () => {
    render(<ConversationsList initialConversations={[]} userRole="coach" />);

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('Your conversations with clients will appear here.')).toBeInTheDocument();
  });

  it('does not show Browse Coaches button for coach role', () => {
    render(<ConversationsList initialConversations={[]} userRole="coach" />);

    expect(screen.queryByText('Browse Coaches')).not.toBeInTheDocument();
  });

  it('renders search input', () => {
    const conversations = [createConversation()];
    render(<ConversationsList initialConversations={conversations} userRole="coach" />);

    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
  });
});
