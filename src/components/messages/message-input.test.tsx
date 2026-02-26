import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageInput } from './message-input';

// Mock socket
vi.mock('@/lib/socket', () => ({
  getSocket: () => ({
    connected: false,
    emit: vi.fn(),
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('MessageInput', () => {
  const mockOnSend = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea with placeholder', () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    expect(textarea).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(<MessageInput onSend={mockOnSend} placeholder="Write something..." />);

    expect(screen.getByPlaceholderText('Write something...')).toBeInTheDocument();
  });

  it('renders send button', () => {
    render(<MessageInput onSend={mockOnSend} />);

    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('disables send button when message is empty', () => {
    render(<MessageInput onSend={mockOnSend} />);

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).toBeDisabled();
  });

  it('enables send button when message is typed', () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).not.toBeDisabled();
  });

  it('calls onSend with trimmed message on button click', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: '  Hello World  ' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('Hello World', undefined);
    });
  });

  it('clears input after successful send', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('calls onSend on Enter key press', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'Enter test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('Enter test', undefined);
    });
  });

  it('does not send on Shift+Enter (allows newline)', () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('does not send when disabled', () => {
    render(<MessageInput onSend={mockOnSend} disabled={true} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    expect(textarea).toBeDisabled();
  });

  it('does not send empty messages', async () => {
    render(<MessageInput onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('shows hint text about Enter/Shift+Enter', () => {
    render(<MessageInput onSend={mockOnSend} />);

    expect(screen.getByText(/Press Enter to send/)).toBeInTheDocument();
    expect(screen.getByText(/Shift\+Enter for new line/)).toBeInTheDocument();
  });
});
