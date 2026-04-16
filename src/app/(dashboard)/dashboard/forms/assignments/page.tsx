import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';

import { db, users, coachProfiles, forms } from '@/db';
import { FormAssignment } from '@/components/forms/builder';
import type { SessionType } from '@/db/schema';

export const metadata = {
  title: 'Intake assignments | Coaching Platform',
  description: 'Choose which intake form runs before each session type.',
};

export default async function IntakeAssignmentsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRecords.length === 0 || userRecords[0].role !== 'coach') {
    redirect('/dashboard');
  }

  const profile = await db
    .select({
      defaultIntakeFormId: coachProfiles.defaultIntakeFormId,
      sessionTypes: coachProfiles.sessionTypes,
    })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  const available = await db
    .select({ id: forms.id, title: forms.title, formType: forms.formType })
    .from(forms)
    .where(and(eq(forms.coachId, userId), eq(forms.isPublished, true)));

  const sessionTypes = (profile[0]?.sessionTypes as SessionType[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Intake assignments</h1>
        <p className="text-sm text-muted-foreground">
          Decide which form clients fill out before their booking is confirmed.
        </p>
      </div>
      <FormAssignment
        availableForms={available}
        defaultFormId={profile[0]?.defaultIntakeFormId ?? null}
        sessionTypes={sessionTypes}
      />
    </div>
  );
}
