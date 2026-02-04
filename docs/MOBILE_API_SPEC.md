# Mobile App API Specification

This document provides everything needed to build a mobile application for the Coaching Platform.

> **STATUS**: REST API endpoints have been created at `src/app/api/*` for mobile app integration.
> All core endpoints for auth, coaches, bookings, conversations, and action items are available.

## Table of Contents

1. [Authentication](#authentication)
2. [Database Schema](#database-schema)
3. [Required API Endpoints](#required-api-endpoints)
4. [Data Types](#data-types)
5. [Business Logic](#business-logic)
6. [External Services](#external-services)

---

## Authentication

### Provider: Clerk

- **Website**: https://clerk.com
- **Mobile SDKs**: React Native, Expo, iOS (Swift), Android (Kotlin)
- **Documentation**: https://clerk.com/docs

### User ID Format

Clerk user IDs are strings in the format: `user_2abc123def456...`

These IDs are used as primary keys in the `users` table.

### Authentication Flow

1. User signs up/in via Clerk SDK
2. Clerk returns a JWT session token
3. Mobile app sends token in `Authorization: Bearer <token>` header
4. Backend validates token via Clerk SDK: `await clerkClient.verifyToken(token)`

### Environment Variables (Backend)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

---

## Database Schema

### PostgreSQL (hosted on Supabase)

Connection string format:

```
postgresql://user:password@host:5432/database
```

### Entity Relationship Diagram

```
users (1) ──────── (1) coach_profiles
  │                        │
  │                        ├── (1:N) coach_availability
  │                        └── (1:N) availability_overrides
  │
  ├── (1:N as coach) ─┬── bookings ──── (1:1) session_notes
  │                   │      │
  └── (1:N as client) ┘      └── (1:N) transactions

  ├── (1:N as coach) ─┬── conversations ── (1:N) messages
  │                   │
  └── (1:N as client) ┘

  ├── (1:N as coach) ─┬── action_items
  │                   │
  └── (1:N as client) ┘
```

### Tables Overview

| Table                    | Description           | Primary Key                |
| ------------------------ | --------------------- | -------------------------- |
| `users`                  | All platform users    | `id` (text, Clerk user ID) |
| `coach_profiles`         | Coach-specific data   | `user_id` (FK to users)    |
| `coach_availability`     | Weekly schedule       | `id` (serial)              |
| `availability_overrides` | Date exceptions       | `id` (serial)              |
| `bookings`               | Coaching sessions     | `id` (serial)              |
| `transactions`           | Payment records       | `id` (serial)              |
| `conversations`          | Chat threads          | `id` (serial)              |
| `messages`               | Chat messages         | `id` (serial)              |
| `session_notes`          | Coach notes (private) | `id` (serial)              |
| `action_items`           | Tasks for clients     | `id` (serial)              |

### Enums

```sql
-- User roles
CREATE TYPE user_role AS ENUM ('admin', 'coach', 'client');

-- Booking status
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');

-- Transaction status
CREATE TYPE transaction_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- Message type
CREATE TYPE message_type AS ENUM ('text', 'system');
```

---

## Required API Endpoints

### Authentication

| Method | Endpoint         | Description                                       |
| ------ | ---------------- | ------------------------------------------------- |
| POST   | `/api/auth/sync` | Sync Clerk user to database (called after signup) |
| GET    | `/api/auth/me`   | Get current user profile with role                |

### Coaches (Public)

| Method | Endpoint                                | Description                                    |
| ------ | --------------------------------------- | ---------------------------------------------- |
| GET    | `/api/coaches`                          | List published coaches (paginated, filterable) |
| GET    | `/api/coaches/:slug`                    | Get coach public profile                       |
| GET    | `/api/coaches/:slug/availability`       | Get coach's available time slots               |
| GET    | `/api/coaches/:slug/availability/:date` | Get slots for specific date                    |

### Query Parameters for `/api/coaches`

```
?page=1
&limit=12
&search=john
&specialties=Career,Executive
&minPrice=5000
&maxPrice=20000
&sort=newest|price_asc|price_desc
```

### Bookings

| Method | Endpoint                     | Description                   |
| ------ | ---------------------------- | ----------------------------- |
| POST   | `/api/bookings`              | Create new booking            |
| GET    | `/api/bookings`              | List user's bookings          |
| GET    | `/api/bookings/:id`          | Get booking details           |
| PATCH  | `/api/bookings/:id`          | Update booking (reschedule)   |
| POST   | `/api/bookings/:id/cancel`   | Cancel booking                |
| POST   | `/api/bookings/:id/complete` | Mark as complete (coach only) |

### Booking Request Body

```json
{
  "coachId": "user_abc123",
  "sessionTypeId": "session_1706745600000_xyz",
  "startTime": "2024-02-15T14:00:00Z",
  "clientNotes": "Optional notes",
  "clientTimezone": "America/New_York"
}
```

### Payments

| Method | Endpoint                          | Description                    |
| ------ | --------------------------------- | ------------------------------ |
| POST   | `/api/payments/checkout`          | Create Stripe checkout session |
| GET    | `/api/payments/status/:bookingId` | Check payment status           |
| GET    | `/api/coach/earnings`             | Coach earnings summary         |
| GET    | `/api/coach/transactions`         | Coach transaction history      |

### Messaging

| Method | Endpoint                          | Description                       |
| ------ | --------------------------------- | --------------------------------- |
| GET    | `/api/conversations`              | List user's conversations         |
| POST   | `/api/conversations`              | Create/get conversation with user |
| GET    | `/api/conversations/:id/messages` | Get messages (paginated)          |
| POST   | `/api/conversations/:id/messages` | Send message                      |
| POST   | `/api/conversations/:id/read`     | Mark messages as read             |

### Coach Profile Management

| Method | Endpoint                       | Description           |
| ------ | ------------------------------ | --------------------- |
| GET    | `/api/coach/profile`           | Get own coach profile |
| PATCH  | `/api/coach/profile`           | Update coach profile  |
| POST   | `/api/coach/profile/publish`   | Publish profile       |
| POST   | `/api/coach/profile/unpublish` | Unpublish profile     |

### Coach Availability

| Method | Endpoint                                | Description            |
| ------ | --------------------------------------- | ---------------------- |
| GET    | `/api/coach/availability`               | Get weekly schedule    |
| PUT    | `/api/coach/availability`               | Update weekly schedule |
| GET    | `/api/coach/availability/overrides`     | Get date overrides     |
| POST   | `/api/coach/availability/overrides`     | Add date override      |
| DELETE | `/api/coach/availability/overrides/:id` | Remove override        |

### Action Items

| Method | Endpoint                | Description                |
| ------ | ----------------------- | -------------------------- |
| GET    | `/api/action-items`     | List action items          |
| POST   | `/api/action-items`     | Create action item (coach) |
| PATCH  | `/api/action-items/:id` | Update/complete item       |
| DELETE | `/api/action-items/:id` | Delete item (coach)        |

### Session Notes (Coach Only)

| Method | Endpoint                  | Description        |
| ------ | ------------------------- | ------------------ |
| GET    | `/api/bookings/:id/notes` | Get session notes  |
| PUT    | `/api/bookings/:id/notes` | Save session notes |

---

## Data Types

### User

```typescript
interface User {
  id: string; // Clerk user ID
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'coach' | 'client';
  createdAt: string; // ISO timestamp
  updatedAt: string;
}
```

### Coach Profile

```typescript
interface CoachProfile {
  userId: string;
  slug: string;
  headline: string | null;
  bio: string | null;
  specialties: string[];
  currency: string; // 'USD', 'EUR', etc.
  timezone: string | null;
  sessionTypes: SessionType[];
  isPublished: boolean;
  profileCompletionPercentage: number;
  bufferMinutes: number;
  advanceNoticeHours: number;
  maxAdvanceDays: number;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
}

interface SessionType {
  id: string;
  name: string;
  duration: number; // minutes
  price: number; // cents (5000 = $50.00)
}
```

### Booking

```typescript
interface Booking {
  id: number;
  coachId: string;
  clientId: string;
  sessionType: {
    name: string;
    duration: number; // minutes
    price: number; // cents
  };
  startTime: string; // ISO timestamp
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  clientNotes: string | null;
  meetingLink: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}
```

### Conversation & Message

```typescript
interface Conversation {
  id: number;
  coachId: string;
  clientId: string;
  lastMessageAt: string | null;
  // Computed fields for list view:
  otherUser: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  lastMessage: string | null;
  unreadCount: number;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: string;
  content: string;
  messageType: 'text' | 'system';
  isRead: boolean;
  createdAt: string;
}
```

### Action Item

```typescript
interface ActionItem {
  id: number;
  coachId: string;
  clientId: string;
  bookingId: number | null;
  title: string;
  description: string | null;
  dueDate: string | null; // "YYYY-MM-DD"
  isCompleted: boolean;
  completedAt: string | null;
}
```

---

## Business Logic

### Availability Slot Calculation

To calculate available booking slots:

1. Get coach's weekly schedule from `coach_availability`
2. Check for date-specific overrides in `availability_overrides`
3. Get existing bookings for the date range
4. Apply buffer time (coach's `bufferMinutes` setting)
5. Apply advance notice (coach's `advanceNoticeHours`)
6. Apply max advance days (coach's `maxAdvanceDays`)

```
Available slot =
  (within weekly schedule OR has override with isAvailable=true)
  AND (not conflicting with existing booking + buffer)
  AND (>= advanceNoticeHours from now)
  AND (<= maxAdvanceDays from now)
```

### Booking Flow

1. Client selects coach, session type, date/time
2. Create booking with `status: 'pending'`
3. If price > 0:
   - Create Stripe Checkout session
   - Redirect to Stripe payment
   - Stripe webhook updates status to 'confirmed' on success
4. If price = 0 (free session):
   - Set status to 'confirmed' immediately

### Cancellation & Refunds

- **Coach cancels**: Full refund to client (always)
- **Client cancels > 24h before**: Full refund
- **Client cancels < 24h before**: No refund

```typescript
const refundEligible = cancelledBy === coachId || hoursUntilSession > 24;
```

### Platform Fees

- Platform fee: 10% of transaction
- Coach receives: 90% of transaction

```
amountCents = 15000        // $150.00
platformFeeCents = 1500    // $15.00 (10%)
coachPayoutCents = 13500   // $135.00 (90%)
```

---

## External Services

### Supabase (Database + Realtime)

- **Purpose**: PostgreSQL database + WebSocket realtime subscriptions
- **Documentation**: https://supabase.com/docs

#### Environment Variables

```
DATABASE_URL=postgresql://...           # For Drizzle ORM queries
NEXT_PUBLIC_SUPABASE_URL=https://...    # For Realtime subscriptions
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...    # Public anon key
```

#### Realtime Tables

Enable replication in Supabase Dashboard for:

- `messages` - Chat messages
- `conversations` - Conversation updates
- `bookings` - Booking status changes

---

### Stripe Connect

- **Purpose**: Process payments, pay coaches
- **Account Type**: Express (simplest for marketplace)
- **Documentation**: https://stripe.com/docs/connect

#### Required Environment Variables

```
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Webhook Events to Handle

| Event                           | Action                              |
| ------------------------------- | ----------------------------------- |
| `checkout.session.completed`    | Confirm booking, create transaction |
| `checkout.session.expired`      | Cancel pending booking              |
| `payment_intent.payment_failed` | Log failure                         |

### Clerk Authentication

- **Purpose**: User authentication
- **Documentation**: https://clerk.com/docs

#### Webhook Events

| Event          | Action                  |
| -------------- | ----------------------- |
| `user.created` | Create user in database |
| `user.updated` | Sync user data          |
| `user.deleted` | Delete user cascade     |

---

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "This time slot is no longer available"
  }
}
```

### Common Error Codes

| Code               | Description                   |
| ------------------ | ----------------------------- |
| `UNAUTHORIZED`     | Missing or invalid auth token |
| `FORBIDDEN`        | User doesn't have permission  |
| `NOT_FOUND`        | Resource not found            |
| `VALIDATION_ERROR` | Invalid request data          |
| `BOOKING_CONFLICT` | Time slot unavailable         |
| `PAYMENT_REQUIRED` | Payment needed to complete    |
| `STRIPE_ERROR`     | Payment processing failed     |

---

## Files to Reference

| File                                     | Contents                                       |
| ---------------------------------------- | ---------------------------------------------- |
| `src/db/schema.ts`                       | Complete database schema with types            |
| `src/lib/supabase.ts`                    | Supabase Realtime client & subscription helpers|
| `docs/API.md`                            | Webhook endpoint documentation                 |
| `docs/ARCHITECTURE.md`                   | System architecture overview                   |
| `src/lib/stripe.ts`                      | Stripe client configuration                    |
| `src/lib/refunds.ts`                     | Refund calculation logic                       |
| `src/lib/conversations.ts`               | Messaging utilities                            |
| `src/lib/validators/coach-onboarding.ts` | Validation schemas                             |

---

## Real-time Messaging (Supabase Realtime)

The platform uses **Supabase Realtime** for real-time messaging via WebSockets.

### Setup

```bash
# Install Supabase client
npm install @supabase/supabase-js
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Initialize Client

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
```

### Subscribe to New Messages

```typescript
// Subscribe to messages in a conversation
const channel = supabase
  .channel(`messages:${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      // payload.new contains the new message
      const message = payload.new;
      console.log('New message:', message);
    }
  )
  .subscribe();

// Cleanup when leaving the conversation
supabase.removeChannel(channel);
```

### Subscribe to Conversation List Updates

```typescript
// Subscribe to conversation updates for a user
const channel = supabase
  .channel(`conversations:${userId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'conversations',
      filter: `coach_id=eq.${userId}`,
    },
    (payload) => {
      // Conversation updated (new message arrived)
      refreshConversationList();
    }
  )
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'conversations',
      filter: `client_id=eq.${userId}`,
    },
    (payload) => {
      refreshConversationList();
    }
  )
  .subscribe();
```

### Subscribe to Booking Updates

```typescript
// Get notified when bookings are created/updated
const channel = supabase
  .channel(`bookings:${userId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'bookings',
      filter: `client_id=eq.${userId}`,
    },
    (payload) => {
      if (payload.eventType === 'INSERT') {
        showNotification('New booking created');
      } else if (payload.eventType === 'UPDATE') {
        if (payload.new.status === 'confirmed') {
          showNotification('Booking confirmed!');
        }
      }
    }
  )
  .subscribe();
```

### Supabase Dashboard Setup

To enable Realtime on your tables:

1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for these tables:
   - `messages`
   - `conversations`
   - `bookings`
3. Optionally enable Row Level Security (RLS) for production

### Mobile SDK Links

- **React Native**: https://supabase.com/docs/guides/getting-started/tutorials/with-react-native
- **Flutter**: https://supabase.com/docs/guides/getting-started/tutorials/with-flutter
- **iOS (Swift)**: https://supabase.com/docs/reference/swift/introduction
- **Android (Kotlin)**: https://supabase.com/docs/reference/kotlin/introduction

---

## Available REST API Endpoints

The following REST API endpoints are now implemented at `src/app/api/*`:

### Authentication
| Method | Endpoint | Status |
|--------|----------|--------|
| POST | `/api/auth/sync` | ✅ Implemented |
| GET | `/api/auth/me` | ✅ Implemented |

### Coaches
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/api/coaches` | ✅ Implemented |
| GET | `/api/coaches/:slug` | ✅ Implemented |
| GET | `/api/coaches/:slug/availability/:date` | ✅ Implemented |

### Bookings
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/api/bookings` | ✅ Implemented |
| POST | `/api/bookings` | ✅ Implemented |
| GET | `/api/bookings/:id` | ✅ Implemented |
| PATCH | `/api/bookings/:id` | ✅ Implemented |
| POST | `/api/bookings/:id/cancel` | ✅ Implemented |

### Conversations & Messaging
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/api/conversations` | ✅ Implemented |
| POST | `/api/conversations` | ✅ Implemented |
| GET | `/api/conversations/:id/messages` | ✅ Implemented |
| POST | `/api/conversations/:id/messages` | ✅ Implemented |
| POST | `/api/conversations/:id/read` | ✅ Implemented |

### Action Items
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/api/action-items` | ✅ Implemented |
| POST | `/api/action-items` | ✅ Implemented |
| GET | `/api/action-items/:id` | ✅ Implemented |
| PATCH | `/api/action-items/:id` | ✅ Implemented |
| DELETE | `/api/action-items/:id` | ✅ Implemented |

---

## Next Steps for Mobile Development

1. **Install Clerk mobile SDK** for your platform (`@clerk/clerk-expo` for Expo)
2. **Create API service layer** in mobile app with base URL configuration
3. **Set up Stripe SDK** for payment handling
4. **Configure Supabase Realtime** for messaging (see above)
5. **Handle push notifications** for:
   - New messages
   - Booking confirmations
   - Session reminders
   - Action item assignments
