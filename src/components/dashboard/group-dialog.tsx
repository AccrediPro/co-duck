'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'rename';
  groupId?: number;
  initialName?: string;
  onCreated?: (group: { id: number; name: string; memberCount: number }) => void;
  onRenamed?: (groupId: number, newName: string) => void;
}

export function GroupDialog({
  open,
  onOpenChange,
  mode,
  groupId,
  initialName = '',
  onCreated,
  onRenamed,
}: GroupDialogProps) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError('');
    }
  }, [open, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Group name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'create') {
        const res = await fetch('/api/client-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || 'Failed to create group.');
          return;
        }
        onCreated?.(json.data.group);
        onOpenChange(false);
      } else {
        if (!groupId) return;
        const res = await fetch(`/api/client-groups/${groupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || 'Failed to rename group.');
          return;
        }
        onRenamed?.(groupId, trimmed);
        onOpenChange(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create Group' : 'Rename Group'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new group to organize your clients.'
              : 'Enter a new name for this group.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="group-name" className="mb-2 block">
              Group name
            </Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Clients, New Clients..."
              autoFocus
              maxLength={100}
            />
            {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-burgundy text-white hover:bg-burgundy-light"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
