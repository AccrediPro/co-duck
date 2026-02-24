/**
 * @fileoverview Coach Earnings CSV Export
 *
 * Export earnings as CSV for tax reporting.
 *
 * @module api/earnings/export
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { transactions, users } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

/**
 * GET /api/earnings/export
 *
 * Export earnings as CSV file.
 *
 * @query {string} [from] - Start date (ISO string, default: 1 year ago)
 * @query {string} [to] - End date (ISO string, default: now)
 *
 * @returns CSV file download
 */
export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || user.role !== 'coach') {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Coach access required' } },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const toDate = toParam ? new Date(toParam) : new Date();
    const fromDate = fromParam
      ? new Date(fromParam)
      : new Date(toDate.getTime() - 365 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: transactions.id,
        bookingId: transactions.bookingId,
        clientName: users.name,
        amountCents: transactions.amountCents,
        platformFeeCents: transactions.platformFeeCents,
        coachPayoutCents: transactions.coachPayoutCents,
        currency: transactions.currency,
        status: transactions.status,
        refundAmountCents: transactions.refundAmountCents,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(users, eq(users.id, transactions.clientId))
      .where(
        and(
          eq(transactions.coachId, userId),
          gte(transactions.createdAt, fromDate),
          lte(transactions.createdAt, toDate)
        )
      )
      .orderBy(desc(transactions.createdAt));

    // Build CSV
    const header =
      'Date,Transaction ID,Booking ID,Client,Amount,Platform Fee,Your Earnings,Refund,Currency,Status';
    const csvRows = rows.map((r) => {
      const date = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '';
      const clientName = (r.clientName || 'Unknown').replace(/,/g, ' ');
      return [
        date,
        r.id,
        r.bookingId || '',
        clientName,
        (r.amountCents / 100).toFixed(2),
        (r.platformFeeCents / 100).toFixed(2),
        (r.coachPayoutCents / 100).toFixed(2),
        r.refundAmountCents ? (r.refundAmountCents / 100).toFixed(2) : '0.00',
        r.currency.toUpperCase(),
        r.status,
      ].join(',');
    });

    const csv = [header, ...csvRows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="earnings-${fromDate.toISOString().split('T')[0]}-to-${toDate.toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting earnings:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export earnings' } },
      { status: 500 }
    );
  }
}
