'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormRunner } from '@/components/forms';
import type { FormQuestionData } from '@/lib/validators/forms';

interface IntakeRunnerClientProps {
  bookingId: number;
  form: {
    id: number;
    title: string;
    description: string | null;
    questions: FormQuestionData[];
  };
  alreadyAnswered: boolean;
}

/**
 * Client wrapper for the intake form on /booking/[bookingId]/intake.
 *
 * Posts answers to /api/bookings/[id]/intake, then redirects to
 * /dashboard/my-sessions on success.
 */
export function IntakeRunnerClient({ bookingId, form, alreadyAnswered }: IntakeRunnerClientProps) {
  const router = useRouter();
  const [done, setDone] = useState(alreadyAnswered);

  if (done) {
    return (
      <Card className="space-y-4 p-6 text-center">
        <h2 className="text-lg font-semibold">Intake submitted</h2>
        <p className="text-sm text-muted-foreground">
          Thanks — your coach now has everything they need to prepare for your session.
        </p>
        <div className="flex justify-center">
          <Button onClick={() => router.push('/dashboard/my-sessions')}>Back to my sessions</Button>
        </div>
      </Card>
    );
  }

  const handleSubmit = async (
    answers: Record<string, string | string[] | number | boolean | undefined>
  ) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to submit intake');
        return;
      }
      toast.success('Intake submitted');
      setDone(true);
      router.refresh();
    } catch (err) {
      console.error('[intake-runner] submit error', err);
      toast.error('Network error while submitting');
    }
  };

  return (
    <FormRunner
      title={form.title}
      description={form.description}
      questions={form.questions}
      onSubmit={handleSubmit}
      submitLabel="Submit intake"
    />
  );
}
