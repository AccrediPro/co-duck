'use client';

import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, Key, Smartphone, Mail, ExternalLink, Loader2 } from 'lucide-react';

export default function SecuritySettingsPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPassword = user?.passwordEnabled;
  const hasTwoFactor = user?.twoFactorEnabled;
  const emailAddresses = user?.emailAddresses ?? [];
  const primaryEmail = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Security Settings</CardTitle>
          <CardDescription>
            Manage your password, two-factor authentication, and connected accounts
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {/* Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Password
            </CardTitle>
            <CardDescription>
              {hasPassword
                ? 'Your account is protected with a password'
                : 'You signed up with a social provider — no password set'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${hasPassword ? 'bg-sage' : 'bg-gold'}`}
                />
                <span className="text-sm">
                  {hasPassword ? 'Password enabled' : 'No password set'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://${window.location.host}/sign-in#/user/security`,
                    '_blank'
                  )
                }
              >
                {hasPassword ? 'Change Password' : 'Set Password'}
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security with 2FA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${hasTwoFactor ? 'bg-sage' : 'bg-gold'}`}
                />
                <span className="text-sm">
                  {hasTwoFactor ? '2FA enabled' : '2FA not enabled'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://${window.location.host}/sign-in#/user/security`,
                    '_blank'
                  )
                }
              >
                {hasTwoFactor ? 'Manage 2FA' : 'Enable 2FA'}
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email Addresses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Addresses
            </CardTitle>
            <CardDescription>
              Email addresses associated with your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {emailAddresses.map((email) => (
              <div key={email.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{email.emailAddress}</span>
                  {email.emailAddress === primaryEmail && (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Primary
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {email.verification?.status === 'verified' ? 'Verified' : 'Unverified'}
                </span>
              </div>
            ))}
            {emailAddresses.length > 1 && <Separator />}
          </CardContent>
        </Card>

        {/* Account Security Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Overview
            </CardTitle>
            <CardDescription>
              Summary of your account security status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <SecurityItem
                label="Password protection"
                enabled={!!hasPassword}
              />
              <SecurityItem
                label="Two-factor authentication"
                enabled={!!hasTwoFactor}
              />
              <SecurityItem
                label="Email verified"
                enabled={
                  emailAddresses.some(
                    (e) => e.verification?.status === 'verified'
                  )
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SecurityItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-2 w-2 rounded-full ${enabled ? 'bg-sage' : 'bg-gold'}`}
      />
      <span className="text-sm">{label}</span>
      <span
        className={`ml-auto text-xs ${enabled ? 'text-sage' : 'text-gold-dark'}`}
      >
        {enabled ? 'Active' : 'Not set'}
      </span>
    </div>
  );
}
