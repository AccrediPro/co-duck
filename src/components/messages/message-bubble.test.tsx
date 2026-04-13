import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './message-bubble';

// MessageWithSender type inline for testing
interface MessageWithSender {
  id: number;
  content: string;
  messageType: 'text' | 'system';
  senderId: string;
  senderName: string | null;
  senderAvatar: string | null;
  isOwn: boolean;
  isRead: boolean;
  createdAt: Date;
}

function createMockMessage(overrides: Partial<MessageWithSender> = {}): MessageWithSender {
  return {
    id: 1,
    content: 'Hello there!',
    messageType: 'text',
    senderId: 'user_abc',
    senderName: 'Alice',
    senderAvatar: null,
    isOwn: false,
    isRead: true,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('MessageBubble', () => {
  it('renders message content', () => {
    render(<MessageBubble message={createMockMessage({ content: 'Test message' })} />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders system messages with centered layout', () => {
    const { container } = render(
      <MessageBubble
        message={createMockMessage({
          messageType: 'system',
          content: 'Session confirmed',
        })}
      />
    );

    expect(screen.getByText('Session confirmed')).toBeInTheDocument();
    // System messages have justify-center
    const wrapper = container.querySelector('.justify-center');
    expect(wrapper).toBeInTheDocument();
  });

  it('aligns own messages to the right', () => {
    const { container } = render(<MessageBubble message={createMockMessage({ isOwn: true })} />);

    const wrapper = container.querySelector('.justify-end');
    expect(wrapper).toBeInTheDocument();
  });

  it('aligns other messages to the left', () => {
    const { container } = render(<MessageBubble message={createMockMessage({ isOwn: false })} />);

    const wrapper = container.querySelector('.justify-start');
    expect(wrapper).toBeInTheDocument();
  });

  it('hides timestamp when showTimestamp is false', () => {
    const now = new Date();
    const { container } = render(
      <MessageBubble message={createMockMessage({ createdAt: now })} showTimestamp={false} />
    );

    // The message content should still be there
    expect(screen.getByText('Hello there!')).toBeInTheDocument();
    // But no timestamp span with the specific class
    const timestampSpans = container.querySelectorAll('.text-xs');
    expect(timestampSpans.length).toBe(0);
  });

  it('shows timestamp when showTimestamp is true', () => {
    const { container } = render(
      <MessageBubble message={createMockMessage({ createdAt: new Date() })} showTimestamp={true} />
    );

    const timestampSpans = container.querySelectorAll('.text-xs');
    expect(timestampSpans.length).toBeGreaterThan(0);
  });

  it('preserves whitespace in messages', () => {
    const { container } = render(
      <MessageBubble message={createMockMessage({ content: 'Line 1\nLine 2' })} />
    );

    const paragraph = container.querySelector('.whitespace-pre-wrap');
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toBe('Line 1\nLine 2');
  });
});
