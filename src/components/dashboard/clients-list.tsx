'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CalendarDays, BookOpen, Activity, Info } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Client {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  lastBookingDate: string;
  totalSessions: number;
  activeProgramsCount: number;
}

interface ClientsListProps {
  initialClients: Client[];
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function ClientsList({ initialClients }: ClientsListProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filteredClients = initialClients.filter((client) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      client.name?.toLowerCase().includes(q) ||
      client.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Search className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No results</p>
            <p className="text-sm text-muted-foreground">
              No clients found for &quot;{search}&quot;
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/dashboard/clients/${client.id}`)}
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
                    <p className="truncate font-semibold">
                      {client.name || 'Client'}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {client.email}
                    </p>
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
                      {client.activeProgramsCount} {client.activeProgramsCount === 1 ? 'program' : 'programs'}
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
                    router.push(`/dashboard/clients/${client.id}/profile`);
                  }}
                >
                  <Info className="mr-1.5 h-4 w-4" />
                  See Information
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
