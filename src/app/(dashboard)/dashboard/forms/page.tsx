import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';

import { db, users, forms } from '@/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Forms | Coaching Platform',
  description: 'Build intake, feedback, and progress forms for your clients.',
};

export default async function FormsListPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRecords.length === 0 || userRecords[0].role !== 'coach') {
    redirect('/dashboard');
  }

  const coachForms = await db
    .select({
      id: forms.id,
      title: forms.title,
      description: forms.description,
      formType: forms.formType,
      isPublished: forms.isPublished,
      updatedAt: forms.updatedAt,
    })
    .from(forms)
    .where(eq(forms.coachId, userId))
    .orderBy(desc(forms.updatedAt));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Build intake, feedback, and progress-check forms for your clients.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/forms/builder/new">
            <Plus className="h-4 w-4" /> New form
          </Link>
        </Button>
      </div>

      {coachForms.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" /> No forms yet
            </CardTitle>
            <CardDescription>
              Create your first intake form to gather important client info before a session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/forms/builder/new">
                <Plus className="h-4 w-4" /> Build your first form
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {coachForms.map((form) => (
            <Link key={form.id} href={`/dashboard/forms/builder/${form.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex-1">
                    <CardTitle className="text-base">{form.title}</CardTitle>
                    {form.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {form.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{form.formType.replace('_', ' ')}</Badge>
                    {form.isPublished ? (
                      <Badge>Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
