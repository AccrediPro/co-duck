'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Form, SessionType } from '@/db/schema';

interface FormAssignmentProps {
  /** Published forms the coach can pick from. */
  availableForms: Pick<Form, 'id' | 'title' | 'formType'>[];
  /** Coach default intake form ID, if any. */
  defaultFormId: number | null;
  /** Session types from the coach profile, with current intake form IDs. */
  sessionTypes: SessionType[];
}

const NONE_VALUE = 'none';

/**
 * Lets the coach wire forms to session types and set a coach-wide default.
 * Uses `PATCH /api/coach/intake-assignments` (defined in P0-09).
 */
export function FormAssignment({
  availableForms,
  defaultFormId,
  sessionTypes,
}: FormAssignmentProps) {
  const [defaultId, setDefaultId] = useState<number | null>(defaultFormId);
  const [perSession, setPerSession] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(sessionTypes.map((st) => [st.id, st.intakeFormId ?? null]))
  );
  const [saving, setSaving] = useState(false);

  const options = [
    { label: 'No intake form', value: NONE_VALUE, id: null as number | null },
    ...availableForms.map((f) => ({ label: f.title, value: String(f.id), id: f.id })),
  ];

  const setDefault = (val: string) => {
    setDefaultId(val === NONE_VALUE ? null : Number(val));
  };

  const setSession = (sessionId: string, val: string) => {
    setPerSession((prev) => ({
      ...prev,
      [sessionId]: val === NONE_VALUE ? null : Number(val),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/coach/intake-assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultFormId: defaultId, perSessionType: perSession }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to save assignments');
        return;
      }
      toast.success('Intake assignments saved');
    } catch (err) {
      console.error('[form-assignment] save error', err);
      toast.error('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  if (availableForms.length === 0) {
    return (
      <Card className="space-y-2 p-5">
        <h3 className="text-base font-semibold">Intake forms</h3>
        <p className="text-sm text-muted-foreground">
          You haven&apos;t published any forms yet. Build a form in{' '}
          <Link className="underline" href="/dashboard/forms/builder/new">
            the form builder
          </Link>
          , publish it, and it will show up here.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h3 className="text-base font-semibold">Intake forms</h3>
        <p className="text-sm text-muted-foreground">
          Pick a default form that runs before every first session, and optionally override it per
          session type.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Default intake form</Label>
        <Select
          value={defaultId == null ? NONE_VALUE : String(defaultId)}
          onValueChange={setDefault}
        >
          <SelectTrigger className="w-full md:w-96">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sessionTypes.length > 0 && (
        <div className="space-y-3">
          <Label>Per session type</Label>
          <div className="space-y-2">
            {sessionTypes.map((st) => (
              <div key={st.id} className="flex flex-wrap items-center gap-3">
                <div className="min-w-[180px] text-sm font-medium">{st.name}</div>
                <div className="text-xs text-muted-foreground">
                  {st.duration}min · ${(st.price / 100).toFixed(2)}
                </div>
                <div className="ml-auto">
                  <Select
                    value={perSession[st.id] == null ? NONE_VALUE : String(perSession[st.id])}
                    onValueChange={(v) => setSession(st.id, v)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Use default" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save assignments'}
        </Button>
      </div>
    </Card>
  );
}
