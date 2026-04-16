'use client';

import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  coachCredentialsSchema,
  CoachCredentialsFormData,
  CREDENTIAL_TYPES,
  CredentialType,
} from '@/lib/validators/coach-onboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Award, Plus, Trash2, Upload, X, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  certification: 'Certification',
  degree: 'Degree',
  license: 'License',
  membership: 'Membership',
};

interface CredentialsEditorProps {
  initialCredentials?: CoachCredentialsFormData['credentials'];
  onSave: (data: CoachCredentialsFormData) => Promise<{ success: boolean; error?: string } | void>;
  submitLabel?: string;
  nextPath?: string;
}

export function CredentialsEditor({
  initialCredentials = [],
  onSave,
  submitLabel = 'Save & Continue',
  nextPath,
}: CredentialsEditorProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  const form = useForm<CoachCredentialsFormData>({
    resolver: zodResolver(coachCredentialsSchema),
    defaultValues: {
      credentials: initialCredentials,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'credentials',
  });

  function addCredential() {
    append({
      id: crypto.randomUUID(),
      type: 'certification',
      title: '',
      issuer: '',
      issuedYear: new Date().getFullYear(),
      expiresYear: null,
      credentialId: null,
      verificationUrl: null,
      documentUrl: null,
      verifiedAt: null,
      verifiedBy: null,
    });
  }

  async function handleDocumentUpload(index: number, file: File) {
    setUploading((prev) => ({ ...prev, [index]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/credential-doc', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      const { url } = await res.json();
      form.setValue(`credentials.${index}.documentUrl`, url);
      toast({ title: 'Document uploaded', description: 'Your credential document has been saved.' });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading((prev) => ({ ...prev, [index]: false }));
    }
  }

  async function onSubmit(data: CoachCredentialsFormData) {
    setSaving(true);
    try {
      const result = await onSave(data);
      if (result && !result.success) {
        toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Credentials saved' });
      if (nextPath) router.push(nextPath);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Empty state */}
      {fields.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
          <Award className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-muted-foreground">No credentials added yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your certifications, degrees, licenses, and memberships to build client trust.
          </p>
        </div>
      )}

      {/* Credential cards */}
      {fields.map((field, index) => {
        const docUrl = form.watch(`credentials.${index}.documentUrl`);
        return (
          <Card key={field.id} className="relative">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Credential #{index + 1}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type */}
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.watch(`credentials.${index}.type`)}
                  onValueChange={(val) =>
                    form.setValue(`credentials.${index}.type`, val as CredentialType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDENTIAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CREDENTIAL_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <Label>
                  Credential Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Institute for Functional Medicine Certified Practitioner"
                  {...form.register(`credentials.${index}.title`)}
                />
                {form.formState.errors.credentials?.[index]?.title && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.credentials[index].title?.message}
                  </p>
                )}
              </div>

              {/* Issuer */}
              <div className="space-y-1">
                <Label>
                  Issuing Organization <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. IFM, Harvard University, State Board"
                  {...form.register(`credentials.${index}.issuer`)}
                />
                {form.formState.errors.credentials?.[index]?.issuer && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.credentials[index].issuer?.message}
                  </p>
                )}
              </div>

              {/* Years row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>
                    Year Issued <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1900}
                    max={currentYear}
                    {...form.register(`credentials.${index}.issuedYear`, { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Expiry Year (optional)</Label>
                  <Input
                    type="number"
                    min={currentYear}
                    max={2100}
                    placeholder="Leave blank if no expiry"
                    {...form.register(`credentials.${index}.expiresYear`, {
                      valueAsNumber: true,
                      setValueAs: (v) => (v === '' || isNaN(v) ? null : Number(v)),
                    })}
                  />
                </div>
              </div>

              {/* Credential ID (optional) */}
              <div className="space-y-1">
                <Label>License / Credential ID (optional)</Label>
                <Input
                  placeholder="e.g. IFM-12345"
                  {...form.register(`credentials.${index}.credentialId`)}
                />
              </div>

              {/* Verification URL (optional) */}
              <div className="space-y-1">
                <Label>Verification URL (optional)</Label>
                <Input
                  type="url"
                  placeholder="https://verify.ifm.org/..."
                  {...form.register(`credentials.${index}.verificationUrl`)}
                />
                {form.formState.errors.credentials?.[index]?.verificationUrl && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.credentials[index].verificationUrl?.message}
                  </p>
                )}
              </div>

              {/* Document upload */}
              <div className="space-y-1">
                <Label>Supporting Document (optional)</Label>
                {docUrl ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="flex-1 truncate text-muted-foreground">Document uploaded</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => form.setValue(`credentials.${index}.documentUrl`, null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/20">
                    <Upload className="h-4 w-4" />
                    {uploading[index] ? 'Uploading...' : 'Upload certificate or diploma (PDF, JPG, PNG — max 2MB)'}
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={uploading[index]}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocumentUpload(index, file);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Admin-verified badge (read-only) */}
              {field.verifiedAt && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Verified by Co-duck admin
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Add credential button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={addCredential}
        disabled={fields.length >= 20}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Credential
      </Button>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'Saving...' : submitLabel}
      </Button>
    </form>
  );
}
