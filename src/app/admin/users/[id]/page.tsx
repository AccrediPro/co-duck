import { notFound } from 'next/navigation';
import { eq, sql, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { formatDate } from '@/lib/date-utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { RoleChangeDropdown } from '@/components/admin/role-change-dropdown';
import { db, users, bookings, messages, reviews, actionItems } from '@/db';
import {
  ArrowLeft,
  Mail,
  Globe,
  Calendar,
  MessageSquare,
  Star,
  ClipboardList,
  BookOpen,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

async function updateUserRole(userId: string, newRole: string) {
  'use server';

  if (!userId || !newRole) return;
  if (!['admin', 'coach', 'client'].includes(newRole)) return;

  try {
    await db
      .update(users)
      .set({ role: newRole as 'admin' | 'coach' | 'client' })
      .where(eq(users.id, userId));
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath('/admin/users');
  } catch (error) {
    console.error('[Admin] Error updating user role:', error);
  }
}

async function getUserDetail(id: string) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        coachProfile: {
          columns: {
            slug: true,
            headline: true,
            verificationStatus: true,
            isPublished: true,
            averageRating: true,
            reviewCount: true,
          },
        },
      },
    });

    if (!user) return null;

    const [
      bookingsAsCoachRows,
      bookingsAsClientRows,
      messageCountResult,
      reviewsGivenResult,
      reviewsReceivedResult,
      actionItemResult,
    ] = await Promise.all([
      db
        .select({ status: bookings.status, count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(eq(bookings.coachId, id))
        .groupBy(bookings.status),
      db
        .select({ status: bookings.status, count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(eq(bookings.clientId, id))
        .groupBy(bookings.status),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(eq(messages.senderId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(eq(reviews.clientId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(eq(reviews.coachId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(actionItems)
        .where(or(eq(actionItems.coachId, id), eq(actionItems.clientId, id))),
    ]);

    const toStatusMap = (rows: { status: string; count: number }[]) => {
      const map: Record<string, number> = {};
      let total = 0;
      for (const row of rows) {
        map[row.status] = row.count;
        total += row.count;
      }
      return { byStatus: map, total };
    };

    return {
      user,
      activity: {
        bookingsAsCoach: toStatusMap(bookingsAsCoachRows),
        bookingsAsClient: toStatusMap(bookingsAsClientRows),
        messagesSent: messageCountResult[0]?.count ?? 0,
        reviewsGiven: reviewsGivenResult[0]?.count ?? 0,
        reviewsReceived: reviewsReceivedResult[0]?.count ?? 0,
        actionItems: actionItemResult[0]?.count ?? 0,
      },
    };
  } catch (error) {
    console.error('[Admin] Error fetching user detail:', error);
    return null;
  }
}

function getRoleVariant(role: string): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'admin':
      return 'default';
    case 'coach':
      return 'secondary';
    default:
      return 'outline';
  }
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

function getVerificationVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'verified':
      return 'default';
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}

function BookingStatusBreakdown({
  label,
  data,
}: {
  label: string;
  data: { byStatus: Record<string, number>; total: number };
}) {
  if (data.total === 0) {
    return (
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">0</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{data.total}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {Object.entries(data.byStatus).map(([status, count]) => (
          <span key={status} className="text-xs text-muted-foreground">
            {count} {status}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getUserDetail(id);

  if (!result) {
    notFound();
  }

  const { user, activity } = result;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Page Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/admin/users">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <CardTitle className="text-2xl font-bold">{user.name || user.email}</CardTitle>
              <CardDescription>User account details</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.name || user.email} />
                <AvatarFallback className="text-lg">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-xl font-semibold">{user.name || 'No name'}</h2>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={getRoleVariant(user.role)} className="capitalize">
                    {user.role}
                  </Badge>
                  {user.timezone && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      {user.timezone}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {formatDate(user.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-sm font-medium">Change role:</span>
                  <RoleChangeDropdown
                    userId={user.id}
                    currentRole={user.role}
                    onRoleChange={updateUserRole}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coach Profile Card (if applicable) */}
        {user.coachProfile && (
          <Card>
            <CardHeader>
              <CardTitle>Coach Profile</CardTitle>
              <CardDescription>This user has a coach profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <Badge
                  variant={getVerificationVariant(user.coachProfile.verificationStatus)}
                  className="capitalize"
                >
                  {user.coachProfile.verificationStatus === 'verified' && (
                    <CheckCircle className="mr-1 h-3 w-3" />
                  )}
                  {user.coachProfile.verificationStatus}
                </Badge>
                <Badge variant={user.coachProfile.isPublished ? 'default' : 'outline'}>
                  {user.coachProfile.isPublished ? 'Published' : 'Draft'}
                </Badge>
                {user.coachProfile.averageRating && (
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-gold text-gold" />
                    {user.coachProfile.averageRating} ({user.coachProfile.reviewCount} reviews)
                  </span>
                )}
                {user.coachProfile.headline && (
                  <span className="text-sm text-muted-foreground">
                    {user.coachProfile.headline}
                  </span>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/coaches/${user.coachProfile.slug}`} target="_blank">
                    View Public Profile
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Summary</CardTitle>
            <CardDescription>User engagement across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Bookings</span>
                </div>
                <BookingStatusBreakdown label="As Coach" data={activity.bookingsAsCoach} />
                <BookingStatusBreakdown label="As Client" data={activity.bookingsAsClient} />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Messages</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold">{activity.messagesSent}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Reviews</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Given</p>
                  <p className="text-2xl font-bold">{activity.reviewsGiven}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Received</p>
                  <p className="text-2xl font-bold">{activity.reviewsReceived}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Action Items</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{activity.actionItems}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
