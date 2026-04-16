import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';

import { db, users, forms } from '@/db';
import { FormBuilderCanvas, type FormBuilderInitial } from '@/components/forms/builder';
import type { FormQuestionData } from '@/lib/validators/forms';

export const metadata = {
  title: 'Form builder | Coaching Platform',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FormBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRecords.length === 0 || userRecords[0].role !== 'coach') {
    redirect('/dashboard');
  }

  let initial: FormBuilderInitial;

  if (id === 'new') {
    initial = {
      id: null,
      title: '',
      description: null,
      formType: 'intake',
      questions: [],
      isPublished: false,
    };
  } else {
    const formId = parseInt(id, 10);
    if (Number.isNaN(formId)) notFound();

    const rows = await db
      .select()
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.coachId, userId)))
      .limit(1);

    if (rows.length === 0) notFound();

    const f = rows[0];
    initial = {
      id: f.id,
      title: f.title,
      description: f.description,
      formType: f.formType,
      questions: (f.questions ?? []) as FormQuestionData[],
      isPublished: f.isPublished,
    };
  }

  return (
    <div className="mx-auto max-w-6xl">
      <FormBuilderCanvas initial={initial} />
    </div>
  );
}
