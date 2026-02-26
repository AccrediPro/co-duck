import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ClientWorkspace } from '@/components/dashboard/client-workspace';

export const metadata = {
  title: 'Client Details | Coaching Platform',
  description: 'View and manage your client\'s coaching journey',
};

interface PageProps {
  params: Promise<{ clientId: string }>;
}

async function fetchClientData(baseUrl: string, cookie: string, clientId: string) {
  const [clientsRes, programsRes, actionItemsRes] = await Promise.all([
    fetch(`${baseUrl}/api/clients?limit=50`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
    fetch(`${baseUrl}/api/programs?clientId=${clientId}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
    fetch(`${baseUrl}/api/action-items?role=coach&limit=50`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
  ]);

  const [clientsJson, programsJson, actionItemsJson] = await Promise.all([
    clientsRes.ok ? clientsRes.json() : { success: false },
    programsRes.ok ? programsRes.json() : { success: false },
    actionItemsRes.ok ? actionItemsRes.json() : { success: false },
  ]);

  const clients = clientsJson.success ? clientsJson.data.clients : [];
  const client = clients.find((c: { id: string }) => c.id === clientId) || null;
  const programs = programsJson.success ? programsJson.data.programs : [];
  const allActionItems = actionItemsJson.success ? actionItemsJson.data.actionItems : [];
  const clientActionItems = allActionItems.filter(
    (item: { client?: { id: string } | null }) => item.client?.id === clientId
  );

  return { client, programs, actionItems: clientActionItems };
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { clientId } = await params;
  const { headers } = await import('next/headers');
  const headersList = await headers();
  const cookie = headersList.get('cookie') || '';
  const host = headersList.get('host') || 'localhost:3001';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const data = await fetchClientData(baseUrl, cookie, clientId);

  if (!data.client) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Client not found</h2>
          <p className="mt-1 text-muted-foreground">
            This client does not exist or you do not have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClientWorkspace
      client={data.client}
      initialPrograms={data.programs}
      initialActionItems={data.actionItems}
      clientId={clientId}
    />
  );
}
