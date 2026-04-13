/**
 * @fileoverview Admin Coaches Management Page
 *
 * Allows administrators to view and manage coach profiles, including verification status.
 *
 * ## Features
 * - Paginated coach table with avatar, name, email, and verification status
 * - Search by name or email
 * - Filter by verification status (pending, verified, rejected)
 * - Verification status dropdown with auto-submit
 *
 * @module app/admin/coaches/page
 */

import { sql, eq, or, ilike, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VerificationStatusDropdown } from '@/components/admin/verification-status-dropdown';
import { InviteCoachDialog } from '@/components/admin/invite-coach-dialog';
import { db, users, coachProfiles, coachInvites } from '@/db';
import {
  UserCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle,
  Mail,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/date-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const COACHES_PER_PAGE = 10;

// ============================================================================
// TYPES
// ============================================================================

interface SearchParams {
  search?: string;
  status?: string;
  page?: string;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Updates a coach's verification status.
 *
 * Server action that can be called from client components.
 *
 * @param coachId - Coach user ID to update
 * @param newStatus - New verification status to assign
 */
async function updateVerificationStatus(coachId: string, newStatus: string) {
  'use server';

  if (!coachId || !newStatus) {
    return;
  }

  // Validate status
  if (!['pending', 'verified', 'rejected'].includes(newStatus)) {
    return;
  }

  try {
    const updateData: {
      verificationStatus: 'pending' | 'verified' | 'rejected';
      verifiedAt?: Date | null;
    } = {
      verificationStatus: newStatus as 'pending' | 'verified' | 'rejected',
    };

    // Set verifiedAt timestamp when status changes to verified
    if (newStatus === 'verified') {
      updateData.verifiedAt = new Date();
    } else {
      // Clear verifiedAt when not verified
      updateData.verifiedAt = null;
    }

    await db.update(coachProfiles).set(updateData).where(eq(coachProfiles.userId, coachId));

    // Revalidate the admin coaches page
    revalidatePath('/admin/coaches');
  } catch (error) {
    console.error('[Admin] Error updating verification status:', error);
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches paginated coaches with optional search and status filter.
 *
 * @param options - Query options
 * @returns Paginated coach list and total count
 */
async function getCoaches(options: {
  search?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const { search, status, page, limit } = options;
  const offset = (page - 1) * limit;

  try {
    // Build where conditions
    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(or(ilike(users.name, searchTerm), ilike(users.email, searchTerm)));
    }

    if (status && status !== 'all' && ['pending', 'verified', 'rejected'].includes(status)) {
      conditions.push(
        eq(coachProfiles.verificationStatus, status as 'pending' | 'verified' | 'rejected')
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(whereClause);

    const totalCount = Number(countResult[0]?.count) || 0;

    // Get coaches for current page
    const coachList = await db
      .select({
        userId: coachProfiles.userId,
        slug: coachProfiles.slug,
        headline: coachProfiles.headline,
        isPublished: coachProfiles.isPublished,
        verificationStatus: coachProfiles.verificationStatus,
        verifiedAt: coachProfiles.verifiedAt,
        averageRating: coachProfiles.averageRating,
        reviewCount: coachProfiles.reviewCount,
        createdAt: coachProfiles.createdAt,
        // User fields
        userName: users.name,
        userEmail: users.email,
        userAvatarUrl: users.avatarUrl,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(whereClause)
      .orderBy(desc(coachProfiles.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      coaches: coachList,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error('[Admin] Error fetching coaches:', error);
    return {
      coaches: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats a date to a readable string.
 *
 * @param date - Date to format
 * @returns Formatted date string (e.g., "Jan 15, 2026")
 */
/**
 * Gets user initials for avatar fallback.
 *
 * @param name - User name
 * @param email - User email
 * @returns Initials string (e.g., "JS" or "J")
 */
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

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Search and filter form component.
 */
function SearchFilters({
  currentSearch,
  currentStatus,
}: {
  currentSearch: string;
  currentStatus: string;
}) {
  return (
    <form className="flex flex-col gap-4 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          name="search"
          placeholder="Search by name or email..."
          defaultValue={currentSearch}
          className="pl-9"
        />
      </div>
      <Select name="status" defaultValue={currentStatus || 'all'}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="verified">Verified</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Search</Button>
    </form>
  );
}

/**
 * Coach table row component.
 */
function CoachRow({
  coach,
  onStatusChange,
}: {
  coach: {
    userId: string;
    slug: string;
    headline: string | null;
    isPublished: boolean;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    verifiedAt: Date | null;
    averageRating: string | null;
    reviewCount: number;
    createdAt: Date;
    userName: string | null;
    userEmail: string;
    userAvatarUrl: string | null;
  };
  onStatusChange: (coachId: string, newStatus: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4 border-b py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage
            src={coach.userAvatarUrl || undefined}
            alt={coach.userName || coach.userEmail}
          />
          <AvatarFallback>{getInitials(coach.userName, coach.userEmail)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{coach.userName || 'No name'}</p>
            {coach.verificationStatus === 'verified' && (
              <CheckCircle className="h-4 w-4 text-[hsl(var(--brand-accent))]" />
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">{coach.userEmail}</p>
          {coach.headline && (
            <p className="truncate text-xs text-muted-foreground">{coach.headline}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Rating display */}
        <div className="flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 fill-gold text-gold" />
          <span>{coach.averageRating || '-'}</span>
          <span className="text-muted-foreground">({coach.reviewCount})</span>
        </div>
        {/* Published status */}
        <Badge variant={coach.isPublished ? 'default' : 'outline'}>
          {coach.isPublished ? 'Published' : 'Draft'}
        </Badge>
        {/* Detail link */}
        <Link
          href={`/admin/coaches/${coach.userId}`}
          className="text-sm text-burgundy hover:underline"
        >
          View Details
        </Link>
        {/* Public profile link */}
        <Link
          href={`/coaches/${coach.slug}`}
          className="text-sm text-[hsl(var(--brand-warm))] hover:underline"
          target="_blank"
        >
          View Profile
        </Link>
        {/* Verification dropdown */}
        <VerificationStatusDropdown
          coachId={coach.userId}
          currentStatus={coach.verificationStatus}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  );
}

/**
 * Pagination controls component.
 */
function Pagination({
  currentPage,
  totalPages,
  search,
  status,
}: {
  currentPage: number;
  totalPages: number;
  search: string;
  status: string;
}) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status);
    params.set('page', String(page));
    return `/admin/coaches?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex gap-2">
        {currentPage > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildUrl(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        )}
        {currentPage < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildUrl(currentPage + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STATS CARDS
// ============================================================================

/**
 * Fetches coach verification statistics.
 */
async function getCoachStats() {
  try {
    const [pendingCount, verifiedCount, rejectedCount, totalCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(coachProfiles)
        .where(eq(coachProfiles.verificationStatus, 'pending')),
      db
        .select({ count: sql<number>`count(*)` })
        .from(coachProfiles)
        .where(eq(coachProfiles.verificationStatus, 'verified')),
      db
        .select({ count: sql<number>`count(*)` })
        .from(coachProfiles)
        .where(eq(coachProfiles.verificationStatus, 'rejected')),
      db.select({ count: sql<number>`count(*)` }).from(coachProfiles),
    ]);

    return {
      pending: Number(pendingCount[0]?.count) || 0,
      verified: Number(verifiedCount[0]?.count) || 0,
      rejected: Number(rejectedCount[0]?.count) || 0,
      total: Number(totalCount[0]?.count) || 0,
    };
  } catch (error) {
    console.error('[Admin] Error fetching coach stats:', error);
    return { pending: 0, verified: 0, rejected: 0, total: 0 };
  }
}

// ============================================================================
// PENDING INVITES
// ============================================================================

async function getPendingInvites() {
  try {
    return await db
      .select({
        id: coachInvites.id,
        email: coachInvites.email,
        createdAt: coachInvites.createdAt,
      })
      .from(coachInvites)
      .where(eq(coachInvites.status, 'pending'))
      .orderBy(desc(coachInvites.createdAt));
  } catch {
    return [];
  }
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

/**
 * Admin Coaches Management Page
 *
 * Displays paginated coach table with search, filter, and verification management.
 * Only accessible to users with admin role (enforced by layout).
 *
 * @param props - Page props with searchParams
 * @returns Admin coaches page with stats, table, search, filters, and pagination
 */
export default async function AdminCoachesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search || '';
  const status = params.status || 'all';
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const [{ coaches: coachList, totalCount, totalPages, currentPage }, stats, pendingInvites] =
    await Promise.all([
      getCoaches({
        search,
        status,
        page,
        limit: COACHES_PER_PAGE,
      }),
      getCoachStats(),
      getPendingInvites(),
    ]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Page Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Coach Management</CardTitle>
              <CardDescription>Review and verify coach accounts</CardDescription>
            </div>
            <InviteCoachDialog />
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Coaches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold-dark">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Verified</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--brand-warm))]">
                {stats.verified}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rejected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Coaches</CardTitle>
            <CardDescription>
              Find coaches by name, email, or filter by verification status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SearchFilters currentSearch={search} currentStatus={status} />
          </CardContent>
        </Card>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Pending Invites</CardTitle>
                  <CardDescription>
                    {pendingInvites.length} invite{pendingInvites.length !== 1 ? 's' : ''} awaiting
                    signup
                  </CardDescription>
                </div>
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between border-b py-3 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Invited {formatDate(invite.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-gold/30 bg-gold/5 text-gold-dark">
                      Invited
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coaches Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Coaches</CardTitle>
                <CardDescription>
                  {totalCount} coach{totalCount !== 1 ? 'es' : ''} found
                </CardDescription>
              </div>
              <UserCheck className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {coachList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <UserCheck className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No coaches found</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {coachList.map((coach) => (
                  <CoachRow
                    key={coach.userId}
                    coach={coach}
                    onStatusChange={updateVerificationStatus}
                  />
                ))}
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              search={search}
              status={status}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
