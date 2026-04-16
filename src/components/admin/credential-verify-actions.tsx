'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Credential } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { BadgeCheck, ExternalLink, ShieldX } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  certification: 'Certification',
  degree: 'Degree',
  license: 'License',
  membership: 'Membership',
};

interface CredentialVerifyActionsProps {
  coachId: string;
  credentials: Credential[];
}

export function CredentialVerifyActions({ coachId, credentials }: CredentialVerifyActionsProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(credentialId: string, action: 'verify' | 'unverify') {
    setLoading(credentialId);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/verify-credential`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId, action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Request failed');
      toast({
        title: action === 'verify' ? 'Credential verified' : 'Verification removed',
        description:
          action === 'verify'
            ? 'The credential has been marked as verified.'
            : 'Verification has been removed from this credential.',
      });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  }

  if (credentials.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No credentials submitted by this coach.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {credentials.map((cred) => (
        <div key={cred.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{cred.title}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {TYPE_LABELS[cred.type] || cred.type}
                </Badge>
                {cred.verifiedAt && (
                  <Badge className="border-green-200 bg-green-100 text-xs text-green-800">
                    <BadgeCheck className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{cred.issuer}</p>
              <p className="text-xs text-muted-foreground">
                {cred.issuedYear}
                {cred.expiresYear ? ` – ${cred.expiresYear}` : ''}
                {cred.credentialId ? ` · ID: ${cred.credentialId}` : ''}
              </p>
              {cred.verifiedAt && cred.verifiedBy && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Verified on {new Date(cred.verifiedAt).toLocaleDateString()}
                </p>
              )}
              {cred.verificationUrl && (
                <a
                  href={cred.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-burgundy hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Verify externally
                </a>
              )}
            </div>
            <div className="shrink-0">
              {cred.verifiedAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading === cred.id}
                  onClick={() => handleAction(cred.id, 'unverify')}
                  className="text-xs text-muted-foreground"
                >
                  <ShieldX className="mr-1 h-3 w-3" />
                  {loading === cred.id ? 'Updating...' : 'Remove'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={loading === cred.id}
                  onClick={() => handleAction(cred.id, 'verify')}
                  className="text-xs"
                >
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {loading === cred.id ? 'Verifying...' : 'Verify'}
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
