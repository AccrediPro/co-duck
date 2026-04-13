'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GroupDialog } from './group-dialog';
import { useToast } from '@/hooks/use-toast';

interface ClientGroup {
  id: number;
  name: string;
}

interface ClientGroupBadgesProps {
  clientId: string;
}

export function ClientGroupBadges({ clientId }: ClientGroupBadgesProps) {
  const { toast } = useToast();
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [allGroups, setAllGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingGroupId, setAddingGroupId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ClientGroup | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchClientGroups = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/groups`);
      const json = await res.json();
      if (json.success) {
        setClientGroups(json.data.groups);
      }
    } catch {
      // Silent fail
    }
  }, [clientId]);

  const fetchAllGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/client-groups');
      const json = await res.json();
      if (json.success) {
        setAllGroups(json.data.groups);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchClientGroups(), fetchAllGroups()]);
      setLoading(false);
    };
    init();
  }, [fetchClientGroups, fetchAllGroups]);

  const assignedGroupIds = new Set(clientGroups.map((g) => g.id));
  const availableGroups = allGroups.filter((g) => !assignedGroupIds.has(g.id));

  const handleAddToGroup = async (groupId: number) => {
    setAddingGroupId(groupId);
    try {
      const res = await fetch(`/api/client-groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json();
      if (json.success) {
        const group = allGroups.find((g) => g.id === groupId);
        if (group) {
          setClientGroups((prev) => [...prev, group].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to add to group',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add to group', variant: 'destructive' });
    } finally {
      setAddingGroupId(null);
    }
  };

  const handleRemoveFromGroup = async () => {
    if (!removeTarget) return;
    setRemovingId(removeTarget.id);
    try {
      const res = await fetch(`/api/client-groups/${removeTarget.id}/members/${clientId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setClientGroups((prev) => prev.filter((g) => g.id !== removeTarget.id));
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to remove from group',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove from group', variant: 'destructive' });
    } finally {
      setRemovingId(null);
      setRemoveTarget(null);
    }
  };

  const handleGroupCreated = (group: { id: number; name: string; memberCount: number }) => {
    const newGroup = { id: group.id, name: group.name };
    setAllGroups((prev) => [...prev, newGroup].sort((a, b) => a.name.localeCompare(b.name)));
    // Auto-add client to the newly created group
    handleAddToGroup(group.id);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1 py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading groups...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {clientGroups.map((group) => (
        <Badge
          key={group.id}
          variant="secondary"
          className="gap-1 bg-burgundy/10 text-burgundy hover:bg-burgundy/15"
        >
          {group.name}
          <button
            className="ml-0.5 rounded-full p-0.5 hover:bg-burgundy/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy"
            onClick={() => setRemoveTarget(group)}
            disabled={removingId === group.id}
            aria-label={`Remove from ${group.name}`}
          >
            {removingId === group.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        </Badge>
      ))}

      {/* Add to group dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            disabled={addingGroupId !== null}
          >
            {addingGroupId !== null ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Add to group
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {availableGroups.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {allGroups.length === 0 ? 'No groups yet' : 'Client is in all groups'}
            </div>
          ) : (
            availableGroups.map((group) => (
              <DropdownMenuItem key={group.id} onClick={() => handleAddToGroup(group.id)}>
                {group.name}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create new group
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create group dialog */}
      <GroupDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        mode="create"
        onCreated={handleGroupCreated}
      />

      {/* Remove confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Group</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this client from &quot;{removeTarget?.name}&quot;? You can add them back any
              time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
