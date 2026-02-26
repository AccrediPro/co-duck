'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ReviewVisibilityToggleProps {
  reviewId: number;
  isPublic: boolean;
  onToggle: (reviewId: number, isPublic: boolean) => Promise<void>;
}

export function ReviewVisibilityToggle({
  reviewId,
  isPublic,
  onToggle,
}: ReviewVisibilityToggleProps) {
  const [loading, setLoading] = React.useState(false);
  const [visible, setVisible] = React.useState(isPublic);

  const handleToggle = async () => {
    const newValue = !visible;
    setLoading(true);
    setVisible(newValue);

    try {
      await onToggle(reviewId, newValue);
    } catch {
      setVisible(visible);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={visible ? 'outline' : 'destructive'}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="min-w-[90px]"
    >
      {visible ? (
        <>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Public
        </>
      ) : (
        <>
          <EyeOff className="mr-1.5 h-3.5 w-3.5" />
          Hidden
        </>
      )}
    </Button>
  );
}
