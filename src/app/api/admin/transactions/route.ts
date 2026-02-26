/**
 * @fileoverview Admin Transactions API
 *
 * List and manage platform transactions (admin only).
 *
 * @module api/admin/transactions
 */

import { db } from '@/db';
import { transactions, users } from '@/db/schema';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/admin/transactions
 *
 * List all platform transactions with optional filters.
 *
 * @query {string} [status] - Filter: pending, succeeded, failed, refunded
 * @query {number} [page=1]
 * @query {number} [limit=30]
 *
 * @returns Paginated transactions with coach/client names
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'admin-transactions-list');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) {
      conditions.push(
        eq(transactions.status, status as 'pending' | 'succeeded' | 'failed' | 'refunded')
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [allTransactions, countResult] = await Promise.all([
      db
        .select()
        .from(transactions)
        .where(whereClause)
        .orderBy(desc(transactions.createdAt))
        .offset(offset)
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(whereClause),
    ]);

    // Get user names
    const userIds = Array.from(new Set(allTransactions.flatMap((t) => [t.coachId, t.clientId])));
    const usersData = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    const total = countResult[0]?.count ?? 0;

    return Response.json({
      success: true,
      data: {
        transactions: allTransactions.map((t) => ({
          id: t.id,
          bookingId: t.bookingId,
          amountCents: t.amountCents,
          currency: t.currency,
          platformFeeCents: t.platformFeeCents,
          coachPayoutCents: t.coachPayoutCents,
          status: t.status,
          refundAmountCents: t.refundAmountCents,
          stripePaymentIntentId: t.stripePaymentIntentId,
          createdAt: t.createdAt,
          coach: usersMap.get(t.coachId)
            ? {
                id: t.coachId,
                name: usersMap.get(t.coachId)!.name,
                email: usersMap.get(t.coachId)!.email,
              }
            : null,
          client: usersMap.get(t.clientId)
            ? {
                id: t.clientId,
                name: usersMap.get(t.clientId)!.name,
                email: usersMap.get(t.clientId)!.email,
              }
            : null,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Error fetching admin transactions:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch transactions' },
      },
      { status: 500 }
    );
  }
}
