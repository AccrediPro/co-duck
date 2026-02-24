/**
 * @fileoverview Admin Coaches List API
 *
 * List all coaches with verification status for admin management.
 *
 * @module api/admin/coaches
 */

import { db } from '@/db';
import { coachProfiles, users } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * GET /api/admin/coaches
 *
 * List all coach profiles with user info and verification status.
 *
 * @query {string} [status] - Filter: pending, verified, rejected
 * @query {number} [page=1]
 * @query {number} [limit=30]
 *
 * @returns Paginated coach profiles
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const verificationStatus = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (verificationStatus) {
      conditions.push(
        eq(
          coachProfiles.verificationStatus,
          verificationStatus as 'pending' | 'verified' | 'rejected'
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [coaches, countResult] = await Promise.all([
      db
        .select({
          userId: coachProfiles.userId,
          slug: coachProfiles.slug,
          headline: coachProfiles.headline,
          isPublished: coachProfiles.isPublished,
          verificationStatus: coachProfiles.verificationStatus,
          averageRating: coachProfiles.averageRating,
          reviewCount: coachProfiles.reviewCount,
          createdAt: coachProfiles.createdAt,
          userName: users.name,
          userEmail: users.email,
          userAvatarUrl: users.avatarUrl,
        })
        .from(coachProfiles)
        .leftJoin(users, eq(coachProfiles.userId, users.id))
        .where(whereClause)
        .orderBy(desc(coachProfiles.createdAt))
        .offset(offset)
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(coachProfiles)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return Response.json({
      success: true,
      data: {
        coaches: coaches.map((c) => ({
          userId: c.userId,
          slug: c.slug,
          headline: c.headline,
          isPublished: c.isPublished,
          verificationStatus: c.verificationStatus,
          averageRating: c.averageRating,
          reviewCount: c.reviewCount,
          createdAt: c.createdAt,
          user: {
            name: c.userName,
            email: c.userEmail,
            avatarUrl: c.userAvatarUrl,
          },
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Error fetching admin coaches:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch coaches' } },
      { status: 500 }
    );
  }
}
