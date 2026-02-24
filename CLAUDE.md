# Coaching Platform

Platform connecting coaches with clients for 1:1 coaching sessions, with booking, payments, messaging, reviews, and calendar sync.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Drizzle ORM (hosted on Supabase)
- **Auth**: Clerk (webhook sync to DB)
- **Payments**: Stripe Connect (destination charges, 10% platform fee)
- **Email**: Resend (React email templates)
- **Storage**: Supabase Storage (avatars bucket)
- **Calendar**: Google Calendar OAuth2 (optional)
- **Validation**: Zod

## Project Structure

```
src/
  app/
    (public)/             # Public pages (coaches, about, etc.)
    (dashboard)/dashboard/ # Auth-required dashboard pages
    admin/                # Admin pages
    api/                  # API routes
      action-items/       # CRUD for action items
      auth/               # /me, /sync, /google OAuth
      bookings/           # CRUD + cancel
      coaches/            # List, profile, availability, reviews
      conversations/      # Messages + read receipts
      reviews/            # Create review
      upload/             # Avatar upload
      webhooks/           # Clerk + Stripe webhooks
      cron/               # Session reminder cron
    onboarding/coach/     # 4-step coach onboarding
  components/
    ui/                   # shadcn/ui primitives
    dashboard/            # Dashboard widgets (coach + client)
    sessions/             # Session cards and lists
    booking/              # Booking flow components
    messages/             # Chat UI components
    coaches/              # Coach cards, search, profile display
    onboarding/           # Onboarding step forms
    navigation/           # Headers, footers, sidebars
  lib/
    stripe.ts             # Stripe client
    email.ts              # Resend email sender
    conversations.ts      # Conversation helpers + server actions
    google-calendar.ts    # Google Calendar OAuth
    google-calendar-sync.ts # Calendar sync logic
    supabase.ts           # Supabase client (storage)
    refunds.ts            # Refund handling
    timezones.ts          # Timezone utilities
    utils.ts              # cn() - Tailwind class merger
    validators/
      coach-onboarding.ts # Zod schemas + constants
    emails/               # React email templates
  db/
    schema.ts             # Complete DB schema (12 tables, 5 enums)
    index.ts              # Drizzle client init
```

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run format       # Prettier format
npm run typecheck    # TypeScript check
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema directly (no migration files)
npm run db:studio    # Open Drizzle Studio
```

## Environment Variables

```
# Database (Supabase)
DATABASE_URL

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET

# Payments (Stripe Connect)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET

# Email (Resend)
RESEND_API_KEY

# Storage (Supabase)
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# Google Calendar (optional)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI

# Cron
CRON_SECRET

# App
NEXT_PUBLIC_APP_URL
```

---

## Database Schema

### Tables & Relationships

```
users (PK: id = Clerk user ID)
  ├── coach_profiles (1:1, PK: userId)
  │     ├── coach_availability (1:N, weekly schedule)
  │     └── availability_overrides (1:N, date exceptions)
  ├── bookings (as coach or client)
  │     ├── transactions (1:1)
  │     ├── session_notes (1:1, coach-only private notes)
  │     └── reviews (1:1, client writes)
  ├── conversations (as coach or client, unique per pair)
  │     └── messages (1:N)
  ├── action_items (as coach or client)
  └── google_calendar_tokens (1:1)
```

### Key Tables

| Table                    | PK                    | Key Fields                                                                                                                                           | Notes                                                 |
| ------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `users`                  | `id` (text, Clerk ID) | email, name, avatarUrl, role                                                                                                                         | role enum: admin/coach/client                         |
| `coach_profiles`         | `userId` (FK)         | slug (unique), headline, bio, specialties (JSONB), sessionTypes (JSONB), hourlyRate, stripeAccountId, averageRating, reviewCount, verificationStatus | isPublished controls visibility                       |
| `coach_availability`     | `id` (serial)         | coachId, dayOfWeek (0-6), startTime, endTime, isAvailable                                                                                            | Weekly recurring schedule                             |
| `availability_overrides` | `id` (serial)         | coachId, date, isAvailable, startTime, endTime, reason                                                                                               | Date-specific exceptions                              |
| `bookings`               | `id` (serial)         | coachId, clientId, sessionType (JSONB snapshot), startTime, endTime, status, meetingLink                                                             | status: pending/confirmed/completed/cancelled/no_show |
| `transactions`           | `id` (serial)         | bookingId, coachId, clientId, amountCents, platformFeeCents (10%), coachPayoutCents (90%), status, stripePaymentIntentId                             | All money in cents                                    |
| `conversations`          | `id` (serial)         | coachId, clientId, lastMessageAt                                                                                                                     | Unique per coach-client pair                          |
| `messages`               | `id` (serial)         | conversationId, senderId, content, messageType, isRead                                                                                               | type: text/system                                     |
| `session_notes`          | `id` (serial)         | bookingId (unique), coachId, content                                                                                                                 | Private to coach only                                 |
| `action_items`           | `id` (serial)         | coachId, clientId, bookingId?, title, description, dueDate, isCompleted                                                                              | Coach creates, both can complete                      |
| `reviews`                | `id` (serial)         | bookingId (unique), coachId, clientId, rating (1-5), title, content, coachResponse, isPublic                                                         | One per booking                                       |
| `google_calendar_tokens` | `userId` (FK)         | accessToken, refreshToken, tokenExpiresAt, calendarId, isConnected                                                                                   | OAuth2 tokens                                         |

### Enums

- `user_role`: admin, coach, client
- `booking_status`: pending, confirmed, completed, cancelled, no_show
- `transaction_status`: pending, succeeded, failed, refunded
- `message_type`: text, system
- `verification_status`: pending, verified, rejected

### JSONB Shapes

```ts
// coach_profiles.sessionTypes
{ id: string, name: string, duration: number /* minutes */, price: number /* cents */ }[]

// bookings.sessionType (snapshot at booking time)
{ name: string, duration: number, price: number }
```

---

## API Endpoints

### Coaches (Public)

| Method | Endpoint                                | Auth | Description                                                   |
| ------ | --------------------------------------- | ---- | ------------------------------------------------------------- |
| GET    | `/api/coaches`                          | No   | List published coaches. Query: search, specialty, page, limit |
| GET    | `/api/coaches/:slug`                    | No   | Get coach profile by slug                                     |
| GET    | `/api/coaches/:slug/availability/:date` | No   | Get available time slots. Query: duration                     |
| GET    | `/api/coaches/:slug/reviews`            | No   | Get coach reviews. Query: page, limit                         |

### Auth

| Method | Endpoint                    | Auth | Description                            |
| ------ | --------------------------- | ---- | -------------------------------------- |
| GET    | `/api/auth/me`              | Yes  | Current user with role + coach profile |
| POST   | `/api/auth/sync`            | Yes  | Sync Clerk user to DB (creates if new) |
| GET    | `/api/auth/google`          | Yes  | Start Google Calendar OAuth flow       |
| GET    | `/api/auth/google/callback` | No   | OAuth callback, stores tokens          |

### Bookings

| Method | Endpoint                   | Auth | Description                                                                            |
| ------ | -------------------------- | ---- | -------------------------------------------------------------------------------------- |
| GET    | `/api/bookings`            | Yes  | List bookings. Query: status, role, upcoming, page, limit                              |
| POST   | `/api/bookings`            | Yes  | Create booking (status=pending). Body: coachId, sessionTypeId, startTime, clientNotes? |
| GET    | `/api/bookings/:id`        | Yes  | Get booking details                                                                    |
| PATCH  | `/api/bookings/:id`        | Yes  | Update booking (meetingLink, status)                                                   |
| POST   | `/api/bookings/:id/cancel` | Yes  | Cancel booking. Body: reason?                                                          |

### Conversations & Messages

| Method | Endpoint                          | Auth | Description                                            |
| ------ | --------------------------------- | ---- | ------------------------------------------------------ |
| GET    | `/api/conversations`              | Yes  | List conversations with last message + unread count    |
| POST   | `/api/conversations`              | Yes  | Get or create conversation. Body: otherUserId          |
| GET    | `/api/conversations/:id/messages` | Yes  | Get messages. Query: limit, before (cursor pagination) |
| POST   | `/api/conversations/:id/messages` | Yes  | Send message. Body: content                            |
| POST   | `/api/conversations/:id/read`     | Yes  | Mark messages as read                                  |

### Action Items

| Method | Endpoint                | Auth  | Description                                                                   |
| ------ | ----------------------- | ----- | ----------------------------------------------------------------------------- |
| GET    | `/api/action-items`     | Yes   | List action items. Query: status, role, page, limit                           |
| POST   | `/api/action-items`     | Coach | Create action item. Body: clientId, title, description?, dueDate?, bookingId? |
| GET    | `/api/action-items/:id` | Yes   | Get action item                                                               |
| PATCH  | `/api/action-items/:id` | Yes   | Update action item (coach: all fields, client: isCompleted only)              |
| DELETE | `/api/action-items/:id` | Coach | Delete action item                                                            |

### Reviews

| Method | Endpoint       | Auth   | Description                                                               |
| ------ | -------------- | ------ | ------------------------------------------------------------------------- |
| POST   | `/api/reviews` | Client | Create review. Body: bookingId, rating (1-5), title?, content?, isPublic? |

### Upload

| Method | Endpoint             | Auth | Description                                               |
| ------ | -------------------- | ---- | --------------------------------------------------------- |
| POST   | `/api/upload/avatar` | Yes  | Upload profile photo (FormData). Max 500KB, jpeg/png/webp |

### Webhooks

| Method | Endpoint               | Verification     | Description                                                               |
| ------ | ---------------------- | ---------------- | ------------------------------------------------------------------------- |
| POST   | `/api/webhooks/clerk`  | Svix signature   | Handles user.created, user.updated, user.deleted                          |
| POST   | `/api/webhooks/stripe` | Stripe signature | Handles checkout.session.completed/expired, payment_intent.payment_failed |

### Cron

| Method   | Endpoint                      | Auth        | Description                             |
| -------- | ----------------------------- | ----------- | --------------------------------------- |
| GET/POST | `/api/cron/session-reminders` | CRON_SECRET | Send 24h and 1h session reminder emails |

---

## Key Business Logic

### Booking Flow

1. Client selects coach, session type, and time slot at `/coaches/:slug/book`
2. `POST /api/bookings` creates booking with status=`pending`
3. Client redirected to Stripe Checkout
4. On payment success: Stripe webhook fires `checkout.session.completed`
   - Updates booking to `confirmed`
   - Creates transaction record (10% platform fee, 90% coach payout)
   - Sends booking confirmation emails to both parties
   - Sends system message in conversation
   - Syncs to Google Calendar (if connected)
5. On expiry (30min timeout): `checkout.session.expired` cancels the pending booking

### Availability Logic

1. Check for date-specific override (`availability_overrides`)
2. If no override, use weekly schedule (`coach_availability`) for that day of week
3. Generate slots based on: available hours, session duration + buffer time, existing bookings (conflict check), advance notice hours, max advance days

### Fee Structure

- Platform takes 10%, coach receives 90%
- All monetary values stored in **cents** (integer)
- Example: $150 session = 15000 cents total, 1500 platform fee, 13500 coach payout

### Conversations

- One conversation per coach-client pair (unique constraint)
- Created lazily on first message or booking
- System messages auto-generated for bookings
- Unread tracking per recipient

### Reviews

- One review per completed booking (unique constraint)
- Updates coach's `averageRating` and `reviewCount`
- Coach can add a `coachResponse`

---

## Page Routes

### Public

| Route                                | Description                        |
| ------------------------------------ | ---------------------------------- |
| `/`                                  | Homepage                           |
| `/coaches`                           | Coach directory with search/filter |
| `/coaches/:slug`                     | Coach profile                      |
| `/coaches/:slug/book`                | Booking flow (date/time selection) |
| `/coaches/:slug/book/confirm`        | Booking confirmation               |
| `/coaches/:slug/book/success`        | Post-payment success               |
| `/about`, `/contact`, `/specialties` | Static pages                       |
| `/terms`, `/privacy`                 | Legal pages                        |

### Dashboard (Auth Required)

| Route                     | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `/dashboard`              | Role-specific home (coach stats vs client overview) |
| `/dashboard/sessions`     | All sessions (coach view)                           |
| `/dashboard/sessions/:id` | Session details                                     |
| `/dashboard/my-sessions`  | My sessions (client view)                           |
| `/dashboard/messages`     | Conversations list                                  |
| `/dashboard/messages/:id` | Chat view                                           |
| `/dashboard/action-items` | Action items                                        |
| `/dashboard/availability` | Manage weekly schedule + overrides (coach)          |
| `/dashboard/profile`      | Edit profile                                        |
| `/dashboard/payments`     | Payments & earnings (coach)                         |
| `/dashboard/settings`     | Account settings                                    |

### Onboarding

| Route                      | Description                         |
| -------------------------- | ----------------------------------- |
| `/onboarding/coach`        | Step 1: Basic info (name, headline) |
| `/onboarding/coach/step-2` | Step 2: Bio & specialties           |
| `/onboarding/coach/step-3` | Step 3: Pricing & session types     |
| `/onboarding/coach/step-4` | Step 4: Review & publish            |

### Admin

| Route            | Description        |
| ---------------- | ------------------ |
| `/admin`         | Admin dashboard    |
| `/admin/users`   | User management    |
| `/admin/coaches` | Coach verification |

---

## Conventions

- **Server components by default**, `'use client'` only when needed (interactivity, hooks, browser APIs)
- **Money in cents** — never use floats for money
- **Clerk user IDs as PKs** — `users.id` is a text string from Clerk (e.g. `user_2abc...`)
- **Slugs for coach URLs** — auto-generated from display name, stored on `coach_profiles.slug`
- **JSONB for flexible data** — session types, specialties stored as JSONB arrays
- **Cascade deletes** — FK references cascade on user deletion
- **Soft deletes for bookings** — use status=`cancelled`, never hard delete
- **Role managed in DB** — `users.role` is managed by the app, NOT synced from Clerk
- **API response shape**: `{ success: boolean, data?: any, error?: { code: string, message: string } }`
- **Timestamps**: All use `timestamptz` (timezone-aware)
- **File uploads**: Max 500KB, stored in Supabase Storage, old files auto-deleted on re-upload

## Constants (in `src/lib/validators/coach-onboarding.ts`)

- **Specialties**: Executive, Career, Life, Business, Health & Wellness, Relationship, Financial, Leadership, Performance, Mindset, Communication, Transition
- **Session durations**: 15, 30, 45, 60, 90, 120 minutes
- **Currencies**: USD, EUR, GBP, CAD, AUD, NZD, CHF, INR, JPY, SGD
