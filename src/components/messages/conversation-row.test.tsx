import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConversationRow } from './conversation-row';

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

function createMockConversation(
  overrides: Partial<ConversationWithDetails> = {}
): ConversationWithDetails {
  return {
    id: 1,
    otherUserId: 'user_456',
    otherUserName: 'John Smith',
    otherUserAvatar: null,
    lastMessageContent: 'Hey, looking forward to our session!',
    lastMessageAt: new Date(),
    unreadCount: 0,
    isCoach: false,
    ...overrides,
  };
}

describe('ConversationRow', () => {
  it('renders other user name', () => {
    render(<ConversationRow conversation={createMockConversation()} onClick={vi.fn()} />);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('renders "Unknown User" when name is null', () => {
    render(
      <ConversationRow
        conversation={createMockConversation({ otherUserName: null })}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Unknown User')).toBeInTheDocument();
  });

  it('renders last message preview', () => {
    render(
      <ConversationRow
        conversation={createMockConversation({ lastMessageContent: 'Short message' })}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Short message')).toBeInTheDocument();
  });

  it('truncates long messages to 50 characters', () => {
    const longMessage =
      'This is a very long message that should be truncated because it exceeds fifty characters';
    render(
      <ConversationRow
        conversation={createMockConversation({ lastMessageContent: longMessage })}
        onClick={vi.fn()}
      />
    );

    // Should show truncated text with ...
    const preview = screen.getByText(/This is a very long message/);
    expect(preview.textContent!.length).toBeLessThan(longMessage.length);
    expect(preview.textContent).toContain('...');
  });

  it('shows "No messages yet" when no last message', () => {
    render(
      <ConversationRow
        conversation={createMockConversation({ lastMessageContent: null })}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('shows unread indicator when unreadCount > 0', () => {
    const { container } = render(
      <ConversationRow
        conversation={createMockConversation({ unreadCount: 3 })}
        onClick={vi.fn()}
      />
    );

    // Unread dot is a brown div
    const unreadDot = container.querySelector('.bg-\\[hsl\\(var\\(--brand-accent\\)\\)\\]');
    expect(unreadDot).toBeInTheDocument();
  });

  it('does not show unread indicator when unreadCount is 0', () => {
    const { container } = render(
      <ConversationRow
        conversation={createMockConversation({ unreadCount: 0 })}
        onClick={vi.fn()}
      />
    );

    const unreadDot = container.querySelector('.bg-\\[hsl\\(var\\(--brand-accent\\)\\)\\]');
    expect(unreadDot).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ConversationRow conversation={createMockConversation()} onClick={onClick} />);

    // The component is a button
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders avatar fallback initials', () => {
    render(
      <ConversationRow
        conversation={createMockConversation({ otherUserName: 'Alice Bob', otherUserAvatar: null })}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('AB')).toBeInTheDocument();
  });
});
