'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Loader2 } from 'lucide-react';
import { getOrCreateConversation } from '@/lib/conversations';

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
