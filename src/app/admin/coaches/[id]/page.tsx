import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { db, users, coachProfiles } from '@/db';
import { formatDate } from '@/lib/date-utils';
import type { SessionType } from '@/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CoachVerifyActions, VerificationBadge } from '@/components/admin/coach-verify-actions';
import { CredentialVerifyActions } from '@/components/admin/credential-verify-actions';
import type { Credential } from '@/db/schema';
import {
  ArrowLeft,
  Award,
  Star,
  Clock,
  Calendar,
  DollarSign,
  Globe,
  ExternalLink,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || email[0].toUpperCase();
  }
  return email[0].toUpperCase();
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`;
}

async function getCoachDetail(coachId: string) {
  const result = await db
    .select({
      userId: coachProfiles.userId,
      slug: coachProfiles.slug,
      headline: coachProfiles.headline,
      bio: coachProfiles.bio,
      specialties: coachProfiles.specialties,
      sessionTypes: coachProfiles.sessionTypes,
      hourlyRate: coachProfiles.hourlyRate,
      currency: coachProfiles.currency,
      timezone: coachProfiles.timezone,
      isPublished: coachProfiles.isPublished,
      verificationStatus: coachProfiles.verificationStatus,
      verifiedAt: coachProfiles.verifiedAt,
      averageRating: coachProfiles.averageRating,
      reviewCount: coachProfiles.reviewCount,
      stripeOnboardingComplete: coachProfiles.stripeOnboardingComplete,
      profileCompletionPercentage: coachProfiles.profileCompletionPercentage,
      credentials: coachProfiles.credentials,
      createdAt: coachProfiles.createdAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
      userCreatedAt: users.createdAt,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(eq(coachProfiles.userId, coachId))
    .limit(1);

  return result[0] || null;
}

export default async function AdminCoachDetailPage({ params }: PageProps) {
  const { id } = await params;
  const coach = await getCoachDetail(id);

  if (!coach) {
    notFound();
  }

  const specialties = (coach.specialties || []) as unknown as string[];
  const sessionTypes = (coach.sessionTypes || []) as SessionType[];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Page Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/admin/coaches">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <CardTitle className="text-2xl font-bold">
                {coach.userName || 'Unknown Coach'}
              </CardTitle>
              <CardDescription>Coach details and verification</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {/* Coach identity card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar className="h-20 w-20">
                <AvatarImage
                  src={coach.userAvatarUrl || undefined}
                  alt={coach.userName || coach.userEmail}
                />
                <AvatarFallback className="text-xl">
                  {getInitials(coach.userName, coach.userEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold">{coach.userName || 'No name'}</h1>
                  <VerificationBadge status={coach.verificationStatus} />
                  <Badge variant={coach.isPublished ? 'default' : 'outline'}>
                    {coach.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                {coach.headline && <p className="text-muted-foreground">{coach.headline}</p>}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>{coach.userEmail}</span>
                  {coach.timezone && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {coach.timezone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined {formatDate(coach.userCreatedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-gold text-gold" />
                    {coach.averageRating || '—'} ({coach.reviewCount} review
                    {coach.reviewCount !== 1 ? 's' : ''})
                  </span>
                  {coach.hourlyRate != null && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {formatCents(coach.hourlyRate)}/hr
                    </span>
                  )}
                  <span>Profile: {coach.profileCompletionPercentage}% complete</span>
                  <span>
                    Stripe: {coach.stripeOnboardingComplete ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <div className="pt-1">
                  <Link
                    href={`/coaches/${coach.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-sm text-[hsl(var(--brand-warm))] hover:underline"
                  >
                    View public profile
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: bio + specialties + sessions */}
          <div className="space-y-6 lg:col-span-2">
            {/* Bio */}
            <Card>
              <CardHeader>
                <CardTitle>Bio</CardTitle>
              </CardHeader>
              <CardContent>
                {coach.bio ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{coach.bio}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No bio provided</p>
                )}
              </CardContent>
            </Card>

            {/* Specialties */}
            <Card>
              <CardHeader>
                <CardTitle>Specialties</CardTitle>
              </CardHeader>
              <CardContent>
                {specialties.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((specialty) => (
                      <Badge key={specialty} variant="secondary">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No specialties listed</p>
                )}
              </CardContent>
            </Card>

            {/* Session Types */}
            <Card>
              <CardHeader>
                <CardTitle>Session Types</CardTitle>
                <CardDescription>
                  {sessionTypes.length} session type{sessionTypes.length !== 1 ? 's' : ''} offered
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionTypes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4 font-medium">Name</th>
                          <th className="pb-2 pr-4 font-medium">Duration</th>
                          <th className="pb-2 font-medium">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionTypes.map((st) => (
                          <tr key={st.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">{st.name}</td>
                            <td className="py-2 pr-4">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {formatDuration(st.duration)}
                              </span>
                            </td>
                            <td className="py-2">
                              {st.price === 0 ? (
                                <Badge variant="secondary">Free</Badge>
                              ) : (
                                formatCents(st.price)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No session types configured
                  </p>
                )}
              </CardContent>
            </Card>
            {/* Credentials */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Credentials</CardTitle>
                </div>
                <CardDescription>
                  Verify individual credentials submitted by this coach
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CredentialVerifyActions
                  coachId={coach.userId}
                  credentials={(coach.credentials as Credential[]) || []}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column: verification actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Verification</CardTitle>
                <CardDescription>Approve or reject this coach&apos;s profile</CardDescription>
              </CardHeader>
              <CardContent>
                <CoachVerifyActions
                  coachId={coach.userId}
                  currentStatus={coach.verificationStatus}
                />
                {coach.verifiedAt && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Verified on {formatDate(coach.verifiedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
