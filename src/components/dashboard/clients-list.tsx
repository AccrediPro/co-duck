'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  CalendarDays,
  BookOpen,
  Activity,
  Info,
  Plus,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { GroupToggle, GroupViewMode } from './group-toggle';
import { GroupSection } from './group-section';
import { GroupDialog } from './group-dialog';
import { useToast } from '@/hooks/use-toast';
import { ClientStreakBadge } from '@/components/streaks/client-streak-badge';

interface Client {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  lastBookingDate: string;
  totalSessions: number;
  activeProgramsCount: number;
}

interface ClientGroup {
  id: number;
  name: string;
  memberCount: number;
  clientIds: string[];
}

interface ClientStreak {
  userId: string;
  currentStreak: number;
  isAtRisk: boolean;
}

interface ClientsListProps {
  initialClients: Client[];
}

const VIEW_MODE_KEY = 'clients-view-mode';

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function ClientCard({
  client,
  streak,
  onNavigate,
}: {
  client: Client;
  streak?: ClientStreak;
  onNavigate: (path: string) => void;
}) {
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onNavigate(`/dashboard/clients/${client.id}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={client.avatarUrl || undefined} />
            <AvatarFallback className="text-sm font-medium">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              {client.name || 'Client'}
              {streak && (
                <ClientStreakBadge
                  currentStreak={streak.currentStreak}
                  isAtRisk={streak.isAtRisk}
                />
              )}
            </p>
            <p className="truncate text-sm text-muted-foreground">{client.email}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {client.totalSessions} {client.totalSessions === 1 ? 'session' : 'sessions'}
          </span>
          {client.activeProgramsCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="h-3 w-3" />
              {client.activeProgramsCount}{' '}
              {client.activeProgramsCount === 1 ? 'program' : 'programs'}
            </Badge>
          )}
        </div>

        {client.lastBookingDate && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            Last session: {formatDate(client.lastBookingDate)}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/dashboard/clients/${client.id}/profile`);
          }}
        >
          <Info className="mr-1.5 h-4 w-4" />
          See Information
        </Button>
      </CardContent>
    </Card>
  );
}

export function ClientsList({ initialClients }: ClientsListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<GroupViewMode>('all');
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [streakMap, setStreakMap] = useState<Map<string, ClientStreak>>(new Map());

  // Fetch client streaks
  useEffect(() => {
    fetch('/api/streaks/clients')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const map = new Map<string, ClientStreak>();
          for (const s of json.data) {
            map.set(s.userId, {
              userId: s.userId,
              currentStreak: s.currentStreak,
              isAtRisk: s.isAtRisk,
            });
          }
          setStreakMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // Persist view mode in localStorage
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === 'by-group' || saved === 'all') {
      setViewMode(saved as GroupViewMode);
    }
  }, []);

  const handleViewModeChange = (mode: GroupViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch('/api/client-groups');
      const json = await res.json();
      if (json.success) {
        setGroups(json.data.groups);
      }
    } catch {
      // Silent fail — groups just won't load
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'by-group') {
      fetchGroups();
    }
  }, [viewMode, fetchGroups]);

  const filteredClients = initialClients.filter((client) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return client.name?.toLowerCase().includes(q) || client.email?.toLowerCase().includes(q);
  });

  const handleGroupCreated = (group: { id: number; name: string; memberCount: number }) => {
    setGroups((prev) =>
      [...prev, { ...group, clientIds: [] }].sort((a, b) => a.name.localeCompare(b.name))
    );
    toast({ title: 'Group created', description: group.name });
  };

  const handleGroupRenamed = (groupId: number, newName: string) => {
    setGroups((prev) =>
      prev
        .map((g) => (g.id === groupId ? { ...g, name: newName } : g))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    toast({ title: 'Group renamed', description: newName });
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    setDeletingGroup(true);
    try {
      const res = await fetch(`/api/client-groups/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
        toast({ title: 'Group deleted', description: deleteTarget.name });
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to delete group',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete group', variant: 'destructive' });
    } finally {
      setDeletingGroup(false);
      setDeleteTarget(null);
    }
  };

  const clientsInGroup = (group: ClientGroup) =>
    filteredClients.filter((c) => group.clientIds.includes(c.id));

  const ungroupedClients = filteredClients.filter(
    (c) => !groups.some((g) => g.clientIds.includes(c.id))
  );

  const navigate = (path: string) => router.push(path);

  return (
    <div className="space-y-4">
      {/* Search + View toggle row */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <GroupToggle mode={viewMode} onChange={handleViewModeChange} />
              {viewMode === 'by-group' && (
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-burgundy text-white hover:bg-burgundy-light"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Group
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All view */}
      {viewMode === 'all' && (
        <>
          {filteredClients.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  streak={streakMap.get(client.id)}
                  onNavigate={navigate}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Group view */}
      {viewMode === 'by-group' && (
        <>
          {loadingGroups ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 && filteredClients.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <div className="space-y-2">
              {groups
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((group) => {
                  const members = clientsInGroup(group);
                  return (
                    <GroupSection
                      key={group.id}
                      groupId={group.id}
                      groupName={group.name}
                      memberCount={members.length}
                      onRename={(id, name) => setRenameTarget({ id, name })}
                      onDelete={(id) => setDeleteTarget({ id, name: group.name })}
                    >
                      {members.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">
                          {search
                            ? 'No matching clients in this group.'
                            : 'No clients in this group yet.'}
                        </p>
                      ) : (
                        <div className="grid gap-4 pb-3 pt-1 sm:grid-cols-2 lg:grid-cols-3">
                          {members.map((client) => (
                            <ClientCard
                              key={client.id}
                              client={client}
                              streak={streakMap.get(client.id)}
                              onNavigate={navigate}
                            />
                          ))}
                        </div>
                      )}
                    </GroupSection>
                  );
                })}

              {/* Ungrouped section */}
              {ungroupedClients.length > 0 && (
                <GroupSection
                  groupId={null}
                  groupName="Ungrouped"
                  memberCount={ungroupedClients.length}
                  defaultOpen={false}
                >
                  <div className="grid gap-4 pb-3 pt-1 sm:grid-cols-2 lg:grid-cols-3">
                    {ungroupedClients.map((client) => (
                      <ClientCard
                        key={client.id}
                        client={client}
                        streak={streakMap.get(client.id)}
                        onNavigate={navigate}
                      />
                    ))}
                  </div>
                </GroupSection>
              )}

              {groups.length === 0 && ungroupedClients.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-lg font-medium">No groups yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create a group to organize your clients.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Create group dialog */}
      <GroupDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        mode="create"
        onCreated={handleGroupCreated}
      />

      {/* Rename group dialog */}
      <GroupDialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        mode="rename"
        groupId={renameTarget?.id}
        initialName={renameTarget?.name}
        onRenamed={handleGroupRenamed}
      />

      {/* Delete group confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? Clients in this
              group will not be deleted — they will be moved to Ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={deletingGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  if (search) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No results</p>
          <p className="text-sm text-muted-foreground">No clients found for &quot;{search}&quot;</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <Search className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No clients yet</p>
        <p className="text-sm text-muted-foreground">
          Clients will appear here once they book a session with you.
        </p>
      </CardContent>
    </Card>
  );
}
