/**
 * @fileoverview Message button component for starting conversations.
 *
 * A reusable button that initiates or navigates to a conversation between
 * a coach and client. Typically used on coach profile pages or booking flows.
 *
 * ## Behavior
 *
 * 1. User clicks the button
 * 2. Button shows loading state
 * 3. Creates/finds the conversation (via getOrCreateConversation)
 * 4. Navigates to the chat view
 *
 * ## Usage Locations
 *
 * - Coach profile pages (public)
 * - Session detail pages
 * - Booking confirmation pages
 *
 * @module components/messages/message-button
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Loader2 } from 'lucide-react';
import { getOrCreateConversation } from '@/lib/conversations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props for the MessageButton component.
 *
 * @property coachId - Clerk user ID of the coach
 * @property clientId - Clerk user ID of the client (typically current user)
 * @property variant - Button variant (default: 'outline')
 * @property size - Button size (default: 'default')
 * @property className - Additional CSS classes
 * @property showIcon - Whether to show the message icon (default: true)
 * @property label - Button text (default: 'Message')
 * @property fullWidth - Whether button should be full width (default: false)
 */
interface MessageButtonProps {
  coachId: string;
  clientId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showIcon?: boolean;
  label?: string;
  fullWidth?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Button that starts or navigates to a conversation.
 *
 * Creates the conversation if it doesn't exist, then navigates to the chat view.
 * Shows a toast error if the operation fails.
 *
 * @param props - Component props
 * @returns Message button JSX
 *
 * @example
 * // On a coach profile page
 * <MessageButton
 *   coachId={coach.userId}
 *   clientId={currentUserId}
 *   label="Contact Coach"
 *   fullWidth
 * />
 *
 * @example
 * // Icon-only button
 * <MessageButton
 *   coachId={coachId}
 *   clientId={clientId}
 *   size="icon"
 *   label=""
 * />
 */
export function MessageButton({
  coachId,
  clientId,
  variant = 'outline',
  size = 'default',
  className = '',
  showIcon = true,
  label = 'Message',
  fullWidth = false,
}: MessageButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const result = await getOrCreateConversation(coachId, clientId);

      if (result.success && result.conversationId) {
        router.push(`/dashboard/messages/${result.conversationId}`);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to start conversation',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start conversation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={`${fullWidth ? 'w-full' : ''} ${className}`}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className={`h-4 w-4 animate-spin ${showIcon && label ? 'mr-2' : ''}`} />
      ) : showIcon ? (
        <MessageSquare className={`h-4 w-4 ${label ? 'mr-2' : ''}`} />
      ) : null}
      {label}
    </Button>
  );
}
