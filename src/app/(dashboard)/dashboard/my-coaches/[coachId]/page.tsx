import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CoachWorkspace } from '@/components/dashboard/coach-workspace';

interface PageProps {
  params: Promise<{ coachId: string }>;
}

async function getCoachData(coachId: string) {
  const { headers: getHeaders } = await import('next/headers');
  const headersList = await getHeaders();
  const cookie = headersList.get('cookie') || '';
  const host = headersList.get('host') || 'localhost:3001';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const [coachesRes, programsRes] = await Promise.all([
    fetch(`${baseUrl}/api/my-coaches?limit=50`, { headers: { Cookie: cookie }, cache: 'no-store' }),
    fetch(`${baseUrl}/api/programs?coachId=${coachId}&limit=50`, { headers: { Cookie: cookie }, cache: 'no-store' }),
  ]);

  const [coachesJson, programsJson] = await Promise.all([coachesRes.json(), programsRes.json()]);

  const coach = coachesJson.success
    ? coachesJson.data.coaches.find((c: { id: string }) => c.id === coachId)
    : null;

  const programs = programsJson.success ? programsJson.data.programs : [];

  return { coach, programs };
}

export default async function CoachDetailPage({ params }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { coachId } = await params;
  const { coach, programs } = await getCoachData(coachId);

  if (!coach) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-burgundy-dark">Coach Not Found</CardTitle>
            <CardDescription>
              This coach doesn&apos;t exist or you don&apos;t have an active relationship.
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                You need at least one confirmed booking with this coach to access their workspace.
              </p>
              <a
                href="/dashboard/my-coaches"
                className="mt-4 inline-flex items-center justify-center rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-light"
              >
                Back to My Coaches
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <CoachWorkspace coach={coach} initialPrograms={programs} />
    </div>
  );
}
