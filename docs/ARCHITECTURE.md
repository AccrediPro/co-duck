# Architecture Overview

This document describes the overall architecture of the Coaching Platform, including folder structure, data flows, and system design decisions.

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Folder Structure](#folder-structure)
4. [Authentication Flow](#authentication-flow)
5. [Core Data Flows](#core-data-flows)
6. [Component Architecture](#component-architecture)
7. [Server Actions vs API Routes](#server-actions-vs-api-routes)
8. [Database Architecture](#database-architecture)
9. [External Services](#external-services)
10. [Environment Configuration](#environment-configuration)

---

## System Overview

The Coaching Platform is a marketplace connecting coaches with clients for 1:1 coaching sessions. The platform handles:

- **Coach Discovery**: Public directory of coaches with search and filtering
- **Session Booking**: Multi-step booking flow with Stripe payment integration
- **Session Management**: Scheduling, rescheduling, and cancellations
- **Real-time Messaging**: 1:1 conversations between coaches and clients
- **Action Items**: Task assignment and tracking for coaching engagements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SYSTEM ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
     │   Browser    │         │    Clerk     │         │   Stripe     │
     │   (Client)   │         │  (Auth)      │         │  (Payments)  │
     └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
            │                        │                        │
            │ HTTP/HTTPS             │ Webhooks               │ Webhooks
            │                        │ user.created           │ checkout.session.completed
            │                        │ user.updated           │ checkout.session.expired
            │                        │ user.deleted           │ payment_intent.payment_failed
            ▼                        ▼                        ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                        Next.js Application                       │
     │  ┌─────────────────────────────────────────────────────────────┐│
     │  │                      Middleware (Clerk)                     ││
     │  │  - Route protection: /dashboard/*, /onboarding/*           ││
     │  │  - Public routes: /, /coaches/*, /sign-in, /sign-up        ││
     │  └─────────────────────────────────────────────────────────────┘│
     │                                                                  │
     │  ┌─────────────────────┐  ┌────────────────────────────────────┐│
     │  │   Server Actions    │  │         API Routes                 ││
     │  │  (actions.ts files) │  │   /api/webhooks/stripe             ││
     │  │  - Booking flow     │  │   /api/webhooks/clerk              ││
     │  │  - Session CRUD     │  │                                    ││
     │  │  - Messaging        │  │   (External service callbacks)     ││
     │  │  - Availability     │  │                                    ││
     │  └──────────┬──────────┘  └─────────────────────────────────────┘│
     │             │                                                    │
     │             │  Drizzle ORM                                       │
     │             ▼                                                    │
     │  ┌─────────────────────────────────────────────────────────────┐│
     │  │                   PostgreSQL (Supabase)                     ││
     │  │  users, coach_profiles, bookings, transactions,            ││
     │  │  conversations, messages, session_notes, action_items       ││
     │  └─────────────────────────────────────────────────────────────┘│
     └─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer              | Technology              | Purpose                       |
| ------------------ | ----------------------- | ----------------------------- |
| **Frontend**       | Next.js 14 (App Router) | React framework with SSR      |
| **Styling**        | Tailwind CSS            | Utility-first CSS             |
| **UI Components**  | shadcn/ui               | Headless component library    |
| **Forms**          | React Hook Form + Zod   | Form state and validation     |
| **Authentication** | Clerk                   | User auth, session management |
| **Database**       | PostgreSQL (Supabase)   | Relational data storage       |
| **ORM**            | Drizzle                 | Type-safe database queries    |
| **Payments**       | Stripe Connect          | Payment processing, payouts   |
| **Hosting**        | Vercel (assumed)        | Serverless deployment         |

---

## Folder Structure

```
coaching-platform/
├── docs/                          # Documentation
│   ├── API.md                     # API route documentation
│   └── ARCHITECTURE.md            # This file
│
├── drizzle/                       # Database migrations
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (dashboard)/           # Route group: authenticated dashboard
│   │   │   ├── dashboard/         # Coach/Client dashboard pages
│   │   │   │   ├── action-items/  # Action item management
│   │   │   │   ├── availability/  # Coach availability settings
│   │   │   │   ├── messages/      # Messaging inbox and chat
│   │   │   │   ├── my-sessions/   # Client session list
│   │   │   │   ├── payments/      # Coach earnings
│   │   │   │   ├── profile/       # Coach profile editor
│   │   │   │   └── sessions/      # Coach session list
│   │   │   └── onboarding/        # Coach onboarding wizard
│   │   │
│   │   ├── (public)/              # Route group: public pages
│   │   │   └── coaches/           # Coach discovery
│   │   │       └── [slug]/        # Individual coach profile
│   │   │           └── book/      # Booking flow
│   │   │
│   │   ├── api/                   # API routes
│   │   │   └── webhooks/          # External service callbacks
│   │   │       ├── clerk/         # User sync webhook
│   │   │       └── stripe/        # Payment webhook
│   │   │
│   │   ├── sign-in/               # Clerk sign-in page
│   │   ├── sign-up/               # Clerk sign-up page
│   │   ├── layout.tsx             # Root layout
│   │   └── page.tsx               # Landing page
│   │
│   ├── components/                # React components by domain
│   │   ├── action-items/          # Task management
│   │   ├── availability/          # Availability forms
│   │   ├── booking/               # Booking flow
│   │   ├── coaches/               # Coach discovery
│   │   ├── messages/              # Messaging UI
│   │   ├── navigation/            # Headers, sidebars
│   │   ├── onboarding/            # Onboarding wizard steps
│   │   ├── payments/              # Earnings display
│   │   ├── profile/               # Profile editing
│   │   ├── sessions/              # Session cards/lists
│   │   └── ui/                    # shadcn/ui primitives
│   │
│   ├── db/                        # Database layer
│   │   ├── schema.ts              # Drizzle schema definitions
│   │   ├── queries/               # Organized query modules
│   │   └── README.md              # Schema documentation
│   │
│   ├── lib/                       # Utilities and helpers
│   │   ├── validators/            # Zod validation schemas
│   │   ├── conversations.ts       # Messaging utilities
│   │   ├── refunds.ts             # Refund calculations
│   │   ├── stripe.ts              # Stripe client
│   │   └── utils.ts               # General utilities
│   │
│   └── middleware.ts              # Clerk auth middleware
│
├── public/                        # Static assets
├── CLAUDE.md                      # AI coding instructions
├── package.json
└── tailwind.config.ts
```

### Route Groups Explained

Next.js App Router uses **route groups** (folders in parentheses) for organization without affecting URLs:

| Route Group   | Purpose             | Layout                  |
| ------------- | ------------------- | ----------------------- |
| `(dashboard)` | Authenticated pages | Sidebar navigation      |
| `(public)`    | Public pages        | Marketing header/footer |

---

## Authentication Flow

The platform uses Clerk for authentication with server-side session management.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐                                              ┌─────────────────┐
  │ Browser │                                              │  Clerk Service  │
  └────┬────┘                                              └────────┬────────┘
       │                                                            │
       │  1. User visits protected route (/dashboard)               │
       │─────────────────────────────────────────────────────────►  │
       │                                                            │
       │                        middleware.ts                       │
       │                   ┌─────────────────────┐                  │
       │                   │ clerkMiddleware()   │                  │
       │                   │                     │                  │
       │                   │ isProtectedRoute()? ├──Yes──►auth.protect()
       │                   │       │             │                  │
       │                   │      No             │                  │
       │                   │       │             │                  │
       │                   │   Pass through      │                  │
       │                   └─────────────────────┘                  │
       │                                                            │
       │  2. No session? Redirect to /sign-in                       │
       │◄─────────────────────────────────────────────────────────  │
       │                                                            │
       │  3. User authenticates with Clerk                          │
       │─────────────────────────────────────────────────────────►  │
       │                                                            │
       │  4. Clerk creates session, redirects back                  │
       │◄─────────────────────────────────────────────────────────  │
       │                                                            │
       │                                                            │
       │  5. Clerk webhook: user.created                            │
       │                   ┌─────────────────────┐                  │
       │                   │ POST /api/webhooks/ │◄─────────────────│
       │                   │      clerk          │                  │
       │                   │                     │                  │
       │                   │ • Verify signature  │                  │
       │                   │ • Create user in DB │                  │
       │                   │ • Default role:     │                  │
       │                   │   'client'          │                  │
       │                   └─────────────────────┘                  │
       │                                                            │
       │  6. User access protected routes                           │
       ▼                                                            │
  Server Actions call auth() to get current user ID                 │
```

### Key Authentication Points

1. **Middleware** (`src/middleware.ts`): Protects `/dashboard/*` and `/onboarding/*` routes
2. **Clerk Webhook**: Syncs user creation/updates to database
3. **Server Actions**: Use `auth()` helper to get authenticated user
4. **Role Assignment**: New users default to `client`; coaches assigned via onboarding

### User Roles

| Role     | Assigned When               | Capabilities                                                |
| -------- | --------------------------- | ----------------------------------------------------------- |
| `client` | User signup (default)       | Book sessions, message coaches, view action items           |
| `coach`  | After completing onboarding | All client capabilities + manage sessions, set availability |
| `admin`  | Manual assignment           | Platform administration                                     |

---

## Core Data Flows

### 1. Booking Flow

The booking process involves three steps with Stripe payment integration.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BOOKING FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  Client Browser                    Server Actions                    Stripe
  ─────────────────────────────────────────────────────────────────────────────

  Step 1: Select Session Type
  ┌─────────────────────────┐
  │ /coaches/[slug]/book    │
  │                         │
  │ Choose:                 │
  │ • Discovery Call (free) │
  │ • 1-Hour Session ($150) │
  └───────────┬─────────────┘
              │
              ▼
  Step 2: Select Date & Time
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ /coaches/[slug]/book    │──────►│ getAvailableSlots()     │
  │                         │       │                         │
  │ • Calendar view         │       │ • Check weekly schedule │
  │ • Time slot selection   │       │ • Apply overrides       │
  │                         │       │ • Exclude conflicts     │
  │                         │       │ • Apply buffer time     │
  └───────────┬─────────────┘       └─────────────────────────┘
              │
              ▼
  Step 3: Confirm & Pay
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ /coaches/[slug]/book/   │──────►│ createCheckoutSession() │
  │        confirm          │       │                         │
  │                         │       │ • Create pending booking│
  │ Session details         │       │ • Generate Stripe URL   │
  │ Price summary           │◄──────│ • Platform fee: 10%     │
  │ [Pay Now] button        │       └───────────┬─────────────┘
  └───────────┬─────────────┘                   │
              │                                 │
              │ Redirect to Stripe Checkout     │
              ▼                                 ▼
        ┌───────────────────────────────────────────────┐
        │                Stripe Checkout                 │
        │                                               │
        │  Card entry, 3D Secure, etc.                  │
        └───────────────────────────────────────────────┘
              │
              │ Success webhook (async)
              │
              ▼
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ Webhook: checkout.      │──────►│ handleCheckoutCompleted │
  │ session.completed       │       │                         │
  │                         │       │ • Update booking:       │
  │ POST /api/webhooks/     │       │   pending → confirmed   │
  │      stripe             │       │ • Create transaction    │
  └───────────┬─────────────┘       │ • Send system message   │
              │                     └─────────────────────────┘
              │
              ▼
  ┌─────────────────────────┐
  │ /coaches/[slug]/book/   │
  │        success          │
  │                         │
  │ ✓ Booking confirmed     │
  │ [Download Calendar]     │
  │ [View Sessions]         │
  └─────────────────────────┘
```

### 2. Payment Processing

All payments use Stripe Connect for marketplace payouts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PAYMENT STRUCTURE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  Client pays: $150.00 (15000 cents)
  ─────────────────────────────────────────────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │    Total Amount: $150.00                                        │
  │    ├── Platform Fee (10%): $15.00 ───► Platform Stripe Account  │
  │    └── Coach Payout (90%): $135.00 ──► Coach Stripe Connect     │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

  Database: transactions table
  ┌────────────────────────────────┐
  │ amountCents: 15000             │
  │ platformFeeCents: 1500         │
  │ coachPayoutCents: 13500        │
  │ status: 'succeeded'            │
  └────────────────────────────────┘
```

### 3. Messaging Flow

1:1 conversations between coaches and clients with polling-based updates.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MESSAGING FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  Client/Coach Browser               Server Actions                  Database
  ─────────────────────────────────────────────────────────────────────────────

  Load Chat View
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ /dashboard/messages/[id]│──────►│ getConversationDetails  │
  │                         │       │ getMessages (page 1)    │
  │                         │◄──────│                         │
  │ Display messages        │       └─────────────────────────┘
  └───────────┬─────────────┘
              │
              │ Polling every 3 seconds
              │
              ▼
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ ChatView component      │──────►│ getNewMessages(lastId)  │
  │                         │       │                         │
  │ useEffect interval      │       │ WHERE id > lastId       │
  │                         │◄──────│                         │
  │ Append new messages     │       └─────────────────────────┘
  └───────────┬─────────────┘
              │
              │ User types message
              │
              ▼
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ MessageInput component  │──────►│ sendMessage()           │
  │                         │       │                         │
  │ [Send] button           │       │ • Insert message        │
  │ Optimistic update       │◄──────│ • Update lastMessageAt  │
  └─────────────────────────┘       └─────────────────────────┘


  Message Types
  ─────────────────────────────────────────────────────────────────────────────

  'text'   - Regular user message
  'system' - Automated notifications (e.g., "Session booked for March 15")
```

### 4. Availability Calculation

Time slot generation considers multiple factors.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AVAILABILITY CALCULATION                               │
└─────────────────────────────────────────────────────────────────────────────┘

  Input: Requested date (e.g., March 15, 2024)
  ─────────────────────────────────────────────────────────────────────────────

  Step 1: Check for Override
  ┌─────────────────────────┐
  │ availability_overrides  │
  │                         │
  │ date = March 15?        │
  │ ├── Found: Use override │
  │ │   • isAvailable       │
  │ │   • startTime/endTime │
  │ │                       │
  │ └── Not found: Step 2   │
  └───────────┬─────────────┘
              │
              ▼
  Step 2: Get Weekly Schedule
  ┌─────────────────────────┐
  │ coach_availability      │
  │                         │
  │ dayOfWeek = 5 (Friday)  │
  │ startTime: "09:00"      │
  │ endTime: "17:00"        │
  │ isAvailable: true       │
  └───────────┬─────────────┘
              │
              ▼
  Step 3: Generate Time Slots
  ┌─────────────────────────┐
  │ 30-minute increments    │
  │                         │
  │ 09:00, 09:30, 10:00...  │
  │ ...16:00, 16:30         │
  │                         │
  │ (Last slot ends by      │
  │  endTime based on       │
  │  session duration)      │
  └───────────┬─────────────┘
              │
              ▼
  Step 4: Remove Conflicts
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ For each slot:          │──────►│ bookings table          │
  │                         │       │                         │
  │ • Existing bookings?    │       │ WHERE coachId = X       │
  │ • Include buffer time   │       │ AND status IN (pending, │
  │                         │       │     confirmed)          │
  │ If overlap → remove     │       │ AND date overlaps       │
  └───────────┬─────────────┘       └─────────────────────────┘
              │
              ▼
  Step 5: Apply Constraints
  ┌─────────────────────────┐
  │ coach_profiles          │
  │                         │
  │ • advanceNoticeHours    │ (e.g., 24 hours minimum)
  │ • maxBookingDays        │ (e.g., 60 days maximum)
  │ • bufferMinutes         │ (e.g., 15 min between sessions)
  │                         │
  │ Remove slots that       │
  │ violate constraints     │
  └───────────┬─────────────┘
              │
              ▼
  Output: Available time slots
  [09:30, 11:00, 14:00, 15:30]
```

---

## Component Architecture

### Component Types

| Type             | Directive      | Use Case                      |
| ---------------- | -------------- | ----------------------------- |
| Server Component | None (default) | Data fetching, static content |
| Client Component | `'use client'` | Interactivity, browser APIs   |

### Data Flow Pattern

```
  Server Component (page.tsx)
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  async function Page() {                                        │
  │    const data = await fetchData(); // Server action             │
  │    return <ClientComponent initialData={data} />;               │
  │  }                                                              │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
                            │
                            │ Props (serialized)
                            ▼
  Client Component
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  'use client';                                                  │
  │                                                                 │
  │  function ClientComponent({ initialData }) {                    │
  │    const [data, setData] = useState(initialData);               │
  │                                                                 │
  │    async function handleAction() {                              │
  │      const result = await serverAction(input);                  │
  │      setData(result);                                           │
  │    }                                                            │
  │  }                                                              │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### Component Organization

Components are organized by feature domain in `src/components/`:

| Folder        | Domain             | Key Components                   |
| ------------- | ------------------ | -------------------------------- |
| `booking/`    | Session booking    | BookingFlow, BookingConfirmation |
| `sessions/`   | Session management | SessionCard, SessionsList        |
| `messages/`   | Messaging          | ChatView, MessageInput           |
| `onboarding/` | Coach setup        | BasicInfoForm, PricingForm       |
| `ui/`         | Primitives         | Button, Card, Dialog (shadcn/ui) |

---

## Server Actions vs API Routes

The platform uses **Server Actions** as the primary data layer, with API routes reserved for webhooks.

### Server Actions

Location: `actions.ts` files throughout `src/app/`

```typescript
// src/app/(dashboard)/dashboard/sessions/actions.ts

'use server';

import { auth } from '@clerk/nextjs/server';

export async function getCoachSessions(params) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Database operations...
  return { success: true, data: sessions };
}
```

Benefits:

- Type-safe function calls
- Automatic Clerk authentication
- Co-located with UI
- No API route maintenance

### API Routes

Location: `src/app/api/webhooks/`

Reserved for external service callbacks that cannot use server actions:

| Route                  | Service | Purpose          |
| ---------------------- | ------- | ---------------- |
| `/api/webhooks/stripe` | Stripe  | Payment events   |
| `/api/webhooks/clerk`  | Clerk   | User sync events |

---

## Database Architecture

### Schema Overview

10 tables organized by domain:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  Users & Profiles              Scheduling                  Payments
  ─────────────────────        ─────────────────────       ─────────────────────
  ┌─────────────────┐          ┌─────────────────┐         ┌─────────────────┐
  │     users       │          │coach_availability│         │  transactions   │
  │─────────────────│          │─────────────────│         │─────────────────│
  │ id (Clerk ID)   │          │ dayOfWeek (0-6) │         │ amountCents     │
  │ email           │          │ startTime       │         │ platformFeeCents│
  │ role            │          │ endTime         │         │ coachPayoutCents│
  └────────┬────────┘          └─────────────────┘         └─────────────────┘
           │
           │ 1:1                ┌─────────────────┐         ┌─────────────────┐
           ▼                   │availability_    │         │    bookings     │
  ┌─────────────────┐          │    overrides    │         │─────────────────│
  │ coach_profiles  │          │─────────────────│         │ sessionType     │
  │─────────────────│          │ date            │         │   (JSONB)       │
  │ sessionTypes    │          │ isAvailable     │         │ status          │
  │   (JSONB)       │          │ reason          │         └─────────────────┘
  │ specialties[]   │          └─────────────────┘
  │ stripeAccountId │
  └─────────────────┘

  Messaging                     Tasks
  ─────────────────────        ─────────────────────
  ┌─────────────────┐          ┌─────────────────┐
  │  conversations  │          │  action_items   │
  │─────────────────│          │─────────────────│
  │ coachId         │          │ title           │
  │ clientId        │          │ isCompleted     │
  │ lastMessageAt   │          │ dueDate         │
  └────────┬────────┘          └─────────────────┘
           │
           │ 1:N
           ▼
  ┌─────────────────┐          ┌─────────────────┐
  │    messages     │          │  session_notes  │
  │─────────────────│          │─────────────────│
  │ content         │          │ content         │
  │ messageType     │          │ (1:1 w/booking) │
  │ isRead          │          └─────────────────┘
  └─────────────────┘
```

### Key Design Decisions

1. **Clerk IDs as Primary Keys**: User IDs are text strings from Clerk (`user_2abc...`)
2. **Monetary Values in Cents**: All prices stored as integers (15000 = $150.00)
3. **Session Type Snapshots**: Booking stores pricing at time of booking
4. **Soft Deletes**: Bookings cancelled, not deleted
5. **1:1 Conversations**: Unique constraint on (coachId, clientId) pair

See [Database README](../src/db/README.md) for complete schema documentation.

---

## External Services

### Clerk (Authentication)

| Feature         | Usage                            |
| --------------- | -------------------------------- |
| User management | Signup, signin, session handling |
| Webhooks        | User sync to database            |
| Middleware      | Route protection                 |
| Server helpers  | `auth()` in server actions       |

### Stripe Connect (Payments)

| Feature           | Usage                     |
| ----------------- | ------------------------- |
| Checkout Sessions | Payment collection        |
| Connect accounts  | Coach payout destinations |
| Webhooks          | Payment confirmation      |
| Refunds           | Cancellation processing   |

Platform fee structure:

- Platform: 10% of transaction
- Coach: 90% via destination charge

---

## Environment Configuration

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=svix_...

# Stripe Payments
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Development Setup

1. Clone repository
2. Copy `.env.example` to `.env.local`
3. Install dependencies: `npm install`
4. Run migrations: `npm run db:migrate`
5. Start dev server: `npm run dev`

### Webhook Testing

```bash
# Stripe webhooks (local)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Clerk webhooks (requires tunnel)
ngrok http 3000
# Update webhook URL in Clerk Dashboard
```

---

## Related Documentation

- [API Documentation](./API.md) - Webhook endpoint details
- [Database Schema](../src/db/README.md) - Table structures and ERD
- [Components](../src/components/README.md) - UI component guide
- [Validators](../src/lib/validators/coach-onboarding.ts) - Zod schemas
