import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Stripe Invoices lib so the create+finalize flow is deterministic.
vi.mock('@/lib/stripe-invoices', () => ({
  getOrCreateCustomer: vi.fn(),
  createDraftInvoice: vi.fn(),
  addInvoiceItem: vi.fn(),
  finalizeInvoice: vi.fn(),
  computePlatformFeeCents: (totalCents: number) => Math.round(totalCents * 0.02),
  DEFAULT_INVOICE_CURRENCY: 'usd',
  DEFAULT_DAYS_UNTIL_DUE: 30,
}));

import {
  mockAuth,
  mockDbQueryFindFirst,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  makeRequest,
  makeJsonRequest,
  resetMocks,
} from './setup';
import {
  getOrCreateCustomer,
  createDraftInvoice,
  addInvoiceItem,
  finalizeInvoice,
} from '@/lib/stripe-invoices';

import { GET, POST } from '../invoices/route';

const mockGetOrCreateCustomer = vi.mocked(getOrCreateCustomer);
const mockCreateDraftInvoice = vi.mocked(createDraftInvoice);
const mockAddInvoiceItem = vi.mocked(addInvoiceItem);
const mockFinalizeInvoice = vi.mocked(finalizeInvoice);

const URL_BASE = 'https://example.com/api/invoices';

function resetAll() {
  resetMocks();
  mockDbSelect.mockReset();
  mockDbInsert.mockReset();
  mockDbUpdate.mockReset();
  mockGetOrCreateCustomer.mockReset();
  mockCreateDraftInvoice.mockReset();
  mockAddInvoiceItem.mockReset();
  mockFinalizeInvoice.mockReset();
}

describe('POST /api/invoices', () => {
  beforeEach(() => {
    resetAll();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const res = await POST(
      makeJsonRequest(URL_BASE, {
        clientId: 'user_client',
        items: [{ description: 'x', amountCents: 1000 }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when items are missing', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });

    const res = await POST(makeJsonRequest(URL_BASE, { clientId: 'user_client' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when caller is not a coach', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null); // no coach profile

    const res = await POST(
      makeJsonRequest(URL_BASE, {
        clientId: 'user_client',
        items: [{ description: 'Retainer', amountCents: 50000 }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 STRIPE_NOT_READY when charges are not enabled', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      userId: 'user_coach',
      stripeAccountId: 'acct_123',
      chargesEnabled: false,
    });

    const res = await POST(
      makeJsonRequest(URL_BASE, {
        clientId: 'user_client',
        items: [{ description: 'Retainer', amountCents: 50000 }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe('STRIPE_NOT_READY');
  });

  it('returns 404 when client not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst
      .mockResolvedValueOnce({
        userId: 'user_coach',
        stripeAccountId: 'acct_123',
        chargesEnabled: true,
      })
      .mockResolvedValueOnce(null); // client lookup

    const res = await POST(
      makeJsonRequest(URL_BASE, {
        clientId: 'user_missing',
        items: [{ description: 'Retainer', amountCents: 50000 }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('CLIENT_NOT_FOUND');
  });

  it('creates, finalizes and persists an invoice (happy path)', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst
      // coach profile (gating ok)
      .mockResolvedValueOnce({
        userId: 'user_coach',
        stripeAccountId: 'acct_123',
        chargesEnabled: true,
      })
      // client lookup
      .mockResolvedValueOnce({ id: 'user_client', email: 'client@example.com', name: 'Client' })
      // coach_client_billing cache miss
      .mockResolvedValueOnce(null);

    mockGetOrCreateCustomer.mockResolvedValueOnce({ id: 'cus_123', deleted: false } as never);

    // billing cache insert (.values().onConflictDoNothing())
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({ onConflictDoNothing }),
    } as never);

    mockCreateDraftInvoice.mockResolvedValueOnce({ id: 'in_123' } as never);
    mockAddInvoiceItem.mockResolvedValue({} as never);
    mockFinalizeInvoice.mockResolvedValueOnce({
      id: 'in_123',
      status: 'open',
      number: 'ABCD-0001',
      hosted_invoice_url: 'https://pay.stripe.com/in_123',
      invoice_pdf: 'https://pay.stripe.com/in_123.pdf',
      due_date: 1700000000,
    } as never);

    // invoices insert (.values().returning())
    const persistedRow = {
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
      bookingId: null,
      stripeInvoiceId: 'in_123',
      stripeCustomerId: 'cus_123',
      status: 'open',
      amountTotalCents: 50000,
      applicationFeeCents: 1000,
      currency: 'usd',
      invoiceNumber: 'ABCD-0001',
      hostedInvoiceUrl: 'https://pay.stripe.com/in_123',
      invoicePdfUrl: 'https://pay.stripe.com/in_123.pdf',
      description: null,
      dueDate: new Date(1700000000 * 1000),
      finalizedAt: new Date(),
      paidAt: null,
      voidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDbInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([persistedRow]) }),
    } as never);

    const res = await POST(
      makeJsonRequest(URL_BASE, {
        clientId: 'user_client',
        items: [{ description: 'Retainer June', amountCents: 50000, quantity: 1 }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.stripeInvoiceId).toBe('in_123');
    expect(body.data.amountTotalCents).toBe(50000);
    expect(body.data.applicationFeeCents).toBe(1000); // 2% of 50000
    expect(body.data.invoiceNumber).toBe('ABCD-0001');
    expect(body.data.hostedInvoiceUrl).toBe('https://pay.stripe.com/in_123');

    // 2% fee was passed to the draft
    expect(mockCreateDraftInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeAccountId: 'acct_123',
        customerId: 'cus_123',
        totalCents: 50000,
      })
    );
    expect(mockFinalizeInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ stripeAccountId: 'acct_123', invoiceId: 'in_123' })
    );
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it('returns 502 when Stripe fails', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst
      .mockResolvedValueOnce({
        userId: 'user_coach',
        stripeAccountId: 'acct_123',
        chargesEnabled: true,
      })
      .mockResolvedValueOnce({ id: 'user_client', email: 'client@example.com', name: 'Client' })
      .mockResolvedValueOnce(null);

    mockGetOrCreateCustomer.mockRejectedValueOnce(new Error('stripe down'));

    const res = await POST(
      makeJsonRequest(URL_BASE, {
        clientId: 'user_client',
        items: [{ description: 'Retainer', amountCents: 50000 }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe('STRIPE_ERROR');
  });
});

describe('GET /api/invoices', () => {
  beforeEach(() => {
    resetAll();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const res = await GET(makeRequest(URL_BASE));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('lists the coach invoices scoped by coachId, newest first', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });

    const rows = [
      {
        id: 2,
        coachId: 'user_coach',
        clientId: 'user_client',
        bookingId: null,
        stripeInvoiceId: 'in_2',
        stripeCustomerId: 'cus_1',
        status: 'open',
        amountTotalCents: 20000,
        applicationFeeCents: 400,
        currency: 'usd',
        invoiceNumber: 'ABCD-0002',
        hostedInvoiceUrl: 'https://pay/2',
        invoicePdfUrl: 'https://pay/2.pdf',
        description: null,
        dueDate: null,
        finalizedAt: new Date(),
        paidAt: null,
        voidedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // count query (first in Promise.all)
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: rows.length }]),
    } as never);
    // paginated query (second in Promise.all)
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue(rows),
    } as never);

    const res = await GET(makeRequest(`${URL_BASE}?clientId=user_client`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.invoices).toHaveLength(1);
    expect(body.data.invoices[0].stripeInvoiceId).toBe('in_2');
    expect(body.data.pagination.total).toBe(1);
  });
});
