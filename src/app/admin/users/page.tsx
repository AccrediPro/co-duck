/**
 * @fileoverview Admin Users Management Page
 *
 * Allows administrators to view and manage platform users.
 *
 * ## Features
 * - Paginated user table with avatar, name, email, role, and created date
 * - Search by name or email
 * - Filter by role (admin, coach, client)
 * - Role change dropdown with server action
 *
 * @module app/admin/users/page
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
import { RoleChangeDropdown } from '@/components/admin/role-change-dropdown';
import { db, users } from '@/db';
import { Users, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// CONSTANTS
// ============================================================================

const USERS_PER_PAGE = 10;

// ============================================================================
// TYPES
// ============================================================================

interface SearchParams {
  search?: string;
  role?: string;
  page?: string;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Updates a user's role.
 *
 * Server action that can be called from client components.
 *
 * @param userId - User ID to update
 * @param newRole - New role to assign
 */
async function updateUserRole(userId: string, newRole: string) {
  'use server';

  if (!userId || !newRole) {
    return;
  }

  // Validate role
  if (!['admin', 'coach', 'client'].includes(newRole)) {
    return;
  }

  try {
    await db
      .update(users)
      .set({ role: newRole as 'admin' | 'coach' | 'client' })
      .where(eq(users.id, userId));

    // Revalidate the admin users page
    revalidatePath('/admin/users');
  } catch (error) {
    console.error('[Admin] Error updating user role:', error);
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches paginated users with optional search and role filter.
 *
 * @param options - Query options
 * @returns Paginated user list and total count
 */
async function getUsers(options: {
  search?: string;
  role?: string;
  page: number;
  limit: number;
}) {
  const { search, role, page, limit } = options;
  const offset = (page - 1) * limit;

  try {
    // Build where conditions
    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(ilike(users.name, searchTerm), ilike(users.email, searchTerm))
      );
    }

    if (role && role !== 'all' && ['admin', 'coach', 'client'].includes(role)) {
      conditions.push(eq(users.role, role as 'admin' | 'coach' | 'client'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const totalCount = Number(countResult[0]?.count) || 0;

    // Get users for current page
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      users: userList,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error('[Admin] Error fetching users:', error);
    return {
      users: [],
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
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Returns badge variant based on user role.
 *
 * @param role - User role
 * @returns Badge variant for the role
 */
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
  currentRole,
}: {
  currentSearch: string;
  currentRole: string;
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
      <Select name="role" defaultValue={currentRole || 'all'}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Filter by role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="coach">Coach</SelectItem>
          <SelectItem value="client">Client</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Search</Button>
    </form>
  );
}

/**
 * User table row component.
 */
function UserRow({
  user,
  onRoleChange,
}: {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    role: 'admin' | 'coach' | 'client';
    createdAt: Date;
  };
  onRoleChange: (userId: string, newRole: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4 border-b py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.avatarUrl || undefined} alt={user.name || user.email} />
          <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{user.name || 'No name'}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="hidden sm:block">
          <Badge variant={getRoleVariant(user.role)} className="capitalize">
            {user.role}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</div>
        <RoleChangeDropdown
          userId={user.id}
          currentRole={user.role}
          onRoleChange={onRoleChange}
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
  role,
}: {
  currentPage: number;
  totalPages: number;
  search: string;
  role: string;
}) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (role && role !== 'all') params.set('role', role);
    params.set('page', String(page));
    return `/admin/users?${params.toString()}`;
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
// PAGE COMPONENT
// ============================================================================

/**
 * Admin Users Management Page
 *
 * Displays paginated user table with search, filter, and role management.
 * Only accessible to users with admin role (enforced by layout).
 *
 * @param props - Page props with searchParams
 * @returns Admin users page with table, search, filters, and pagination
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search || '';
  const role = params.role || 'all';
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const { users: userList, totalCount, totalPages, currentPage } = await getUsers({
    search,
    role,
    page,
    limit: USERS_PER_PAGE,
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">View and manage platform users</p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Users</CardTitle>
          <CardDescription>Find users by name, email, or filter by role</CardDescription>
        </CardHeader>
        <CardContent>
          <SearchFilters currentSearch={search} currentRole={role} />
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                {totalCount} user{totalCount !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {userList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No users found</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {userList.map((user) => (
                <UserRow key={user.id} user={user} onRoleChange={updateUserRole} />
              ))}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            search={search}
            role={role}
          />
        </CardContent>
      </Card>
    </div>
  );
}
