import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientsList } from '@/components/dashboard/clients-list';

export const metadata = {
  title: 'My Clients | Coaching Platform',
  description: 'Manage your clients and their coaching programs',
};

async function fetchClients(baseUrl: string, cookie: string) {
  const res = await fetch(`${baseUrl}/api/clients?limit=50`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  });
  if (!res.ok) return { clients: [], pagination: null };
  const json = await res.json();
  return json.success ? json.data : { clients: [], pagination: null };
}

export default async function ClientsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { headers } = await import('next/headers');
  const headersList = await headers();
  const cookie = headersList.get('cookie') || '';
  const host = headersList.get('host') || 'localhost:3001';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const data = await fetchClients(baseUrl, cookie);

  if (!data.clients || data.clients.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Clients</h1>
          <p className="text-muted-foreground">Manage your clients and their coaching journeys</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>No clients yet</CardTitle>
            <CardDescription className="mx-auto max-w-md">
              You don&apos;t have any clients yet. Clients will appear here after their first confirmed session.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Clients</h1>
        <p className="text-muted-foreground">Manage your clients and their coaching journeys</p>
      </div>

      <ClientsList initialClients={data.clients} />
    </div>
  );
}
