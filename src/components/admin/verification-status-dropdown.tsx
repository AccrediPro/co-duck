'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

interface VerificationStatusDropdownProps {
  coachId: string;
  currentStatus: 'pending' | 'verified' | 'rejected';
  onStatusChange: (coachId: string, newStatus: string) => Promise<void>;
}

/**
 * Returns the display config for each verification status.
 */
function getStatusConfig(status: string) {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        icon: CheckCircle,
        variant: 'default' as const,
        color: 'text-green-500',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        icon: XCircle,
        variant: 'destructive' as const,
        color: 'text-red-500',
      };
    default:
      return {
        label: 'Pending',
        icon: Clock,
        variant: 'secondary' as const,
        color: 'text-yellow-500',
      };
  }
}

/**
 * Client-side verification status dropdown with auto-submit on change.
 */
export function VerificationStatusDropdown({
  coachId,
  currentStatus,
  onStatusChange,
}: VerificationStatusDropdownProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [value, setValue] = React.useState(currentStatus);

  const handleValueChange = async (newStatus: string) => {
    if (newStatus === value) return;

    setIsLoading(true);
    setValue(newStatus as 'pending' | 'verified' | 'rejected');

    try {
      await onStatusChange(coachId, newStatus);
    } catch (error) {
      // Revert on error
      setValue(currentStatus);
      console.error('Failed to update verification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={handleValueChange} disabled={isLoading}>
      <SelectTrigger className="w-[140px]">
        <SelectValue>
          {(() => {
            const config = getStatusConfig(value);
            const Icon = config.icon;
            return (
              <span className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                {config.label}
              </span>
            );
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            Pending
          </span>
        </SelectItem>
        <SelectItem value="verified">
          <span className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Verified
          </span>
        </SelectItem>
        <SelectItem value="rejected">
          <span className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            Rejected
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
