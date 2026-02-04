# API Documentation

This document describes all API routes in the Coaching Platform. The platform uses Next.js 14 App Router with server actions for most data operations, and traditional API routes for webhook integrations.

## Overview

| Route                  | Method | Purpose                       |
| ---------------------- | ------ | ----------------------------- |
| `/api/webhooks/stripe` | POST   | Stripe payment event handling |
| `/api/webhooks/clerk`  | POST   | Clerk user sync events        |

## Authentication

### Webhook Endpoints

Webhook endpoints do not use standard user authentication. Instead, they use signature verification:

- **Stripe webhooks**: Verified using `stripe-signature` header with HMAC-SHA256
- **Clerk webhooks**: Verified using Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`)

### Server Actions

Most data operations use Next.js Server Actions, which are authenticated via Clerk. See the server action files in `src/app/**/actions.ts` for authenticated data operations.

---

## Webhook Endpoints

### POST /api/webhooks/stripe

Handles incoming payment events from Stripe. This endpoint processes checkout completions, expirations, and payment failures.

**Source**: `src/app/api/webhooks/stripe/route.ts`

#### Headers

| Header             | Required | Description                                 |
| ------------------ | -------- | ------------------------------------------- |
| `stripe-signature` | Yes      | HMAC signature from Stripe for verification |

#### Events Handled

| Event Type                      | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `checkout.session.completed`    | Payment successful, confirms booking        |
| `checkout.session.expired`      | Checkout timed out, cancels pending booking |
| `payment_intent.payment_failed` | Payment attempt failed, logs error          |

#### Request Body

Stripe sends the event payload as JSON. The body must be read as raw text for signature verification.

```json
{
  "id": "evt_xxx",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_xxx",
      "payment_status": "paid",
      "amount_total": 5000,
      "currency": "usd",
      "metadata": {
        "bookingId": "123",
        "coachId": "user_abc",
        "clientId": "user_xyz",
        "sessionPrice": "5000"
      }
    }
  }
}
```

#### Metadata Fields

The checkout session must include these metadata fields:

| Field          | Type   | Description                                       |
| -------------- | ------ | ------------------------------------------------- |
| `bookingId`    | string | Database booking ID                               |
| `coachId`      | string | Clerk user ID of the coach                        |
| `clientId`     | string | Clerk user ID of the client                       |
| `sessionPrice` | string | Price in cents (fallback if amount_total missing) |

#### Response Codes

| Code | Description                                          |
| ---- | ---------------------------------------------------- |
| 200  | Event processed successfully (or logged and ignored) |
| 400  | Invalid signature or malformed request               |

**Note**: Returns 200 even for handler errors to prevent Stripe retries. Errors are logged for debugging.

#### Processing Logic

##### checkout.session.completed

1. Validates booking ID from metadata
2. Confirms payment status is 'paid'
3. Updates booking status from 'pending' to 'confirmed'
4. Creates transaction record with fee calculations:
   - Platform fee: 10% of total
   - Coach payout: 90% of total
5. Creates system message in coach-client conversation

##### checkout.session.expired

1. Looks up booking by ID from metadata
2. If booking is still 'pending', cancels it
3. Sets cancellation reason to 'Payment session expired'
4. Frees up the coach's time slot

##### payment_intent.payment_failed

1. Logs the failure with error code and message
2. Updates any pending transaction to 'failed' status
3. Does NOT cancel the booking (user can retry)

#### Idempotency

All handlers are idempotent:

- Checks if transaction already exists before creating
- Only updates bookings still in 'pending' status
- Safe to receive the same event multiple times

---

### POST /api/webhooks/clerk

Synchronizes user data from Clerk authentication to the application database.

**Source**: `src/app/api/webhooks/clerk/route.ts`

#### Headers

| Header           | Required | Description                              |
| ---------------- | -------- | ---------------------------------------- |
| `svix-id`        | Yes      | Unique identifier for webhook delivery   |
| `svix-timestamp` | Yes      | Unix timestamp (prevents replay attacks) |
| `svix-signature` | Yes      | HMAC signature for verification          |

#### Events Handled

| Event Type     | Description                              |
| -------------- | ---------------------------------------- |
| `user.created` | New user signup, creates database record |
| `user.updated` | Profile changes, syncs to database       |
| `user.deleted` | User deletion, removes from database     |

#### Request Body

```json
{
  "type": "user.created",
  "data": {
    "id": "user_xxx",
    "email_addresses": [{ "email_address": "user@example.com" }],
    "first_name": "John",
    "last_name": "Doe",
    "image_url": "https://img.clerk.com/..."
  }
}
```

#### Response Codes

| Code | Description                                          |
| ---- | ---------------------------------------------------- |
| 200  | Webhook processed successfully                       |
| 400  | Missing headers, invalid signature, or missing email |
| 500  | Database operation failed                            |

#### Processing Logic

##### user.created

1. Extracts email, name, and avatar from payload
2. Validates email is present
3. Creates user record with Clerk ID as primary key
4. Assigns default role of 'client' (coach role via onboarding)

##### user.updated

1. Syncs email, name, and avatar URL
2. Does NOT update role (application-managed)
3. Role changes happen through coach onboarding flow

##### user.deleted

1. Performs hard delete of user record
2. Related data behavior depends on foreign key constraints
3. See `src/db/schema.ts` for cascade behavior

---

## Environment Variables

### Required for Stripe Webhooks

```bash
STRIPE_SECRET_KEY=sk_xxx          # Stripe API secret key
STRIPE_WEBHOOK_SECRET=whsec_xxx   # Webhook signing secret
```

### Required for Clerk Webhooks

```bash
CLERK_WEBHOOK_SECRET=svix_xxx     # Webhook signing secret from Clerk Dashboard
```

---

## Webhook Setup

### Stripe Dashboard Configuration

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) > Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Subscribe to events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

### Clerk Dashboard Configuration

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) > Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET`

---

## Local Development

### Testing Stripe Webhooks

Use the Stripe CLI to forward webhooks to your local server:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI will output a webhook signing secret (whsec_xxx)
# Add this to your .env.local file
```

### Testing Clerk Webhooks

Use a tunneling service like ngrok or localtunnel:

```bash
# Using ngrok
ngrok http 3000

# Update Clerk webhook endpoint to ngrok URL
# https://xxx.ngrok.io/api/webhooks/clerk
```

---

## Error Handling

### Stripe Webhook Errors

| Error                           | Cause                             | Resolution                                     |
| ------------------------------- | --------------------------------- | ---------------------------------------------- |
| Missing stripe-signature header | Request not from Stripe           | Verify endpoint URL                            |
| Signature verification failed   | Wrong webhook secret              | Check STRIPE_WEBHOOK_SECRET                    |
| No bookingId in metadata        | Checkout session missing metadata | Verify createCheckoutSession includes metadata |

### Clerk Webhook Errors

| Error                         | Cause                  | Resolution                        |
| ----------------------------- | ---------------------- | --------------------------------- |
| No svix headers               | Request not from Clerk | Verify endpoint URL               |
| Signature verification failed | Wrong webhook secret   | Check CLERK_WEBHOOK_SECRET        |
| No email address found        | User missing email     | Clerk should always provide email |

---

## Related Documentation

- [Database Schema](../src/db/README.md) - Table structures and relationships
- [Components](../src/components/README.md) - UI component documentation
- Stripe Webhook Documentation: https://stripe.com/docs/webhooks
- Clerk Webhook Documentation: https://clerk.com/docs/integration/webhooks

---

## Server Actions vs API Routes

This platform primarily uses **Next.js Server Actions** for authenticated data operations rather than traditional API routes. Server actions provide:

- Type-safe function calls with automatic serialization
- Built-in Clerk authentication via `auth()` helper
- Co-location with UI components for better DX
- No manual API route maintenance

API routes are reserved for:

- **Webhook endpoints** (Stripe, Clerk) - external service callbacks
- **Public APIs** - if needed for mobile apps or third-party integrations

### Finding Server Actions

Server actions are located in `actions.ts` files throughout the codebase:

| Path                                                      | Purpose                     |
| --------------------------------------------------------- | --------------------------- |
| `src/app/(public)/coaches/[slug]/book/actions.ts`         | Booking flow                |
| `src/app/(public)/coaches/[slug]/book/confirm/actions.ts` | Payment confirmation        |
| `src/app/(dashboard)/dashboard/sessions/actions.ts`       | Coach session management    |
| `src/app/(dashboard)/dashboard/my-sessions/actions.ts`    | Client session management   |
| `src/app/(dashboard)/dashboard/availability/actions.ts`   | Availability settings       |
| `src/app/(dashboard)/dashboard/messages/actions.ts`       | Messaging                   |
| `src/lib/conversations.ts`                                | Core conversation functions |

See JSDoc in each file for detailed function documentation.
