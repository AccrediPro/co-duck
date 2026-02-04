'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RoleChangeDropdownProps {
  userId: string;
  currentRole: string;
  onRoleChange: (userId: string, newRole: string) => Promise<void>;
}

/**
 * Client-side role change dropdown with auto-submit on change.
 */
export function RoleChangeDropdown({
  userId,
  currentRole,
  onRoleChange,
}: RoleChangeDropdownProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [value, setValue] = React.useState(currentRole);

  const handleValueChange = async (newRole: string) => {
    if (newRole === value) return;

    setIsLoading(true);
    setValue(newRole);

    try {
      await onRoleChange(userId, newRole);
    } catch (error) {
      // Revert on error
      setValue(currentRole);
      console.error('Failed to update role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={handleValueChange} disabled={isLoading}>
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="coach">Coach</SelectItem>
        <SelectItem value="client">Client</SelectItem>
      </SelectContent>
    </Select>
  );
}
