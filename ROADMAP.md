# Coaching Platform — Feature Roadmap

> Last updated: 2026-02-06
> Overall platform completion: ~62%
> Production readiness: Not yet — missing testing, CI/CD, rate limiting, error monitoring

---

## How to Read This Document

Each feature has:

- **Status**: current completion level
- **Priority**: P0 (ship-blocker) → P1 (launch quality) → P2 (growth) → P3 (nice-to-have)
- **Depends on**: features or infra that must exist first
- **Subtasks**: incremental work items, ordered by implementation sequence

---

## Phase 0 — Foundation (Ship Blockers)

These must be done before any public launch. They protect revenue, data, and platform integrity.

---

### F-001: Testing Infrastructure

**Status**: 0% — no tests exist
**Priority**: P0
**Depends on**: nothing

| #   | Subtask                                            | Scope                        | Notes                                                             |
| --- | -------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| 1   | Install Vitest + React Testing Library             | config                       | `vitest.config.ts`, update `package.json` scripts                 |
| 2   | Add test utilities (mock Clerk auth, mock Drizzle) | `src/test/`                  | Shared helpers for auth context and DB mocks                      |
| 3   | Unit tests for business logic                      | `src/lib/`                   | Availability calculation, fee math, slug generation, refund logic |
| 4   | API route tests for bookings flow                  | `src/app/api/bookings/`      | Create, cancel, status transitions                                |
| 5   | API route tests for conversations                  | `src/app/api/conversations/` | Create, send message, mark read                                   |
| 6   | API route tests for auth endpoints                 | `src/app/api/auth/`          | /me, /sync                                                        |
| 7   | Component tests for booking flow                   | `src/components/booking/`    | Date selection, confirmation, validation                          |
| 8   | Component tests for onboarding forms               | `src/components/onboarding/` | All 4 steps, validation errors                                    |
| 9   | Install Playwright for E2E                         | config                       | `playwright.config.ts`                                            |
| 10  | E2E: coach onboarding flow                         | e2e                          | Sign up → 4 steps → published profile                             |
| 11  | E2E: booking + payment flow                        | e2e                          | Browse → select slot → checkout → confirmation                    |
| 12  | E2E: messaging flow                                | e2e                          | Open conversation → send message → verify delivery                |

---

### F-002: CI/CD Pipeline

**Status**: 0%
**Priority**: P0
**Depends on**: F-001 (tests must exist to run in CI)

| #   | Subtask                                         | Scope                      | Notes                                           |
| --- | ----------------------------------------------- | -------------------------- | ----------------------------------------------- |
| 1   | GitHub Actions: lint + typecheck + format on PR | `.github/workflows/ci.yml` | Run `npm run lint`, `typecheck`, `format:check` |
| 2   | GitHub Actions: run Vitest on PR                | `.github/workflows/ci.yml` | Unit + API tests                                |
| 3   | GitHub Actions: Playwright E2E on PR            | `.github/workflows/ci.yml` | Needs test DB or mocks                          |
| 4   | Preview deployments (Vercel)                    | `vercel.json` or dashboard | Auto-deploy PR branches                         |
| 5   | Production deploy on merge to main              | Vercel / GitHub Actions    | Auto-deploy with env validation                 |
| 6   | Database migration automation                   | CI step                    | Run `npm run db:migrate` on deploy              |

---

### F-003: Rate Limiting

**Status**: 0% — all API endpoints unprotected
**Priority**: P0
**Depends on**: nothing

| #   | Subtask                                                                         | Scope                                | Notes                                    |
| --- | ------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| 1   | Install rate limiting library (e.g., `@upstash/ratelimit` or `next-rate-limit`) | `package.json`                       | Upstash Redis recommended for serverless |
| 2   | Create rate limit middleware helper                                             | `src/lib/rate-limit.ts`              | Configurable per-route limits            |
| 3   | Apply to auth endpoints                                                         | `/api/auth/*`                        | 30 req/min per IP                        |
| 4   | Apply to booking creation                                                       | `/api/bookings POST`                 | 10 req/min per user                      |
| 5   | Apply to message sending                                                        | `/api/conversations/*/messages POST` | 30 req/min per user                      |
| 6   | Apply to review creation                                                        | `/api/reviews POST`                  | 5 req/min per user                       |
| 7   | Apply to file uploads                                                           | `/api/upload/*`                      | 5 req/min per user                       |
| 8   | Return proper 429 responses with Retry-After header                             | all limited routes                   | Standard HTTP 429                        |

---

### F-004: Error Monitoring & Boundaries

**Status**: 60% — basic try/catch exists, no monitoring
**Priority**: P0
**Depends on**: nothing

| #   | Subtask                                 | Scope                                                                | Notes                                         |
| --- | --------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Install Sentry (or similar)             | `package.json`, `sentry.client.config.ts`, `sentry.server.config.ts` | Next.js SDK with source maps                  |
| 2   | Add global `error.tsx` for app routes   | `src/app/error.tsx`                                                  | User-friendly error page with retry           |
| 3   | Add `global-error.tsx` for root layout  | `src/app/global-error.tsx`                                           | Catches layout-level errors                   |
| 4   | Add `not-found.tsx` for custom 404      | `src/app/not-found.tsx`                                              | Branded 404 page                              |
| 5   | Add error boundary to dashboard layout  | `src/app/(dashboard)/error.tsx`                                      | Dashboard-specific recovery                   |
| 6   | Tag Sentry errors with user ID and role | middleware / Sentry config                                           | For debugging user-specific issues            |
| 7   | Set up Sentry alerts for critical paths | Sentry dashboard                                                     | Webhook failures, payment errors, auth errors |

---

### F-005: Stripe Connect — Complete Payment Flow

**Status**: 75% — onboarding + checkout work, payouts missing
**Priority**: P0
**Depends on**: nothing (Stripe account required)

| #   | Subtask                                                      | Scope                                                     | Notes                                                    |
| --- | ------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Add `transfer_data.destination` to checkout session creation | `src/app/(public)/coaches/[slug]/book/confirm/actions.ts` | Route funds to coach's Connect account                   |
| 2   | Add `application_fee_amount` to checkout session             | same file                                                 | 10% platform fee via Stripe, not manual calc             |
| 3   | Verify webhook handles transfer creation correctly           | `src/app/api/webhooks/stripe/route.ts`                    | Transaction record should reflect actual Stripe transfer |
| 4   | Add payout schedule display for coaches                      | `src/components/payments/`                                | Show when next payout arrives                            |
| 5   | Handle Stripe Connect account deauthorization                | webhook or polling                                        | If coach disconnects, pause their bookings               |
| 6   | Add refund flow via Stripe (not just DB status)              | `src/lib/refunds.ts`                                      | Call `stripe.refunds.create()`                           |
| 7   | Test full payment lifecycle in Stripe test mode              | manual / E2E                                              | Checkout → confirm → payout → refund                     |

---

## Phase 1 — Launch Quality

These bring the platform to a polished, professional state for early users.

---

### F-006: Email Notification System

**Status**: 35% — 3 templates, many scenarios uncovered
**Priority**: P1
**Depends on**: nothing (Resend already configured)

| #   | Subtask                                            | Scope                                              | Notes                                                                |
| --- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Welcome email on user creation                     | `src/lib/emails/templates/WelcomeEmail.tsx`        | Trigger from Clerk webhook `user.created`                            |
| 2   | Coach profile approved/rejected email              | `src/lib/emails/templates/VerificationEmail.tsx`   | Trigger from admin verification action                               |
| 3   | Review request email (24h after completed session) | `src/lib/emails/templates/ReviewRequestEmail.tsx`  | Add to cron job or trigger on status=completed                       |
| 4   | New message notification email                     | `src/lib/emails/templates/NewMessageEmail.tsx`     | Trigger from message creation, debounced (don't email every message) |
| 5   | Action item assigned email                         | `src/lib/emails/templates/ActionItemEmail.tsx`     | Trigger from action item creation                                    |
| 6   | Payment receipt email                              | `src/lib/emails/templates/PaymentReceiptEmail.tsx` | Trigger from Stripe webhook on successful payment                    |
| 7   | Add unsubscribe links to all emails                | all templates                                      | Required for CAN-SPAM compliance                                     |
| 8   | Email preference settings (opt out per category)   | `src/app/(dashboard)/dashboard/settings/` + schema | New `email_preferences` table or JSONB on users                      |

---

### F-007: In-App Notification System

**Status**: 0%
**Priority**: P1
**Depends on**: F-006 (shares notification triggers)

| #   | Subtask                                          | Scope                                         | Notes                                               |
| --- | ------------------------------------------------ | --------------------------------------------- | --------------------------------------------------- |
| 1   | Create `notifications` table                     | `src/db/schema.ts`                            | userId, type, title, body, link, isRead, createdAt  |
| 2   | Create notification API routes                   | `src/app/api/notifications/`                  | GET (list), PATCH (mark read), POST (internal only) |
| 3   | Create notification bell component               | `src/components/notifications/`               | Bell icon with unread count badge                   |
| 4   | Add notification dropdown/panel                  | `src/components/notifications/`               | Click bell → see recent notifications               |
| 5   | Wire up notification creation to existing events | booking confirm, message, review, action item | Use a shared `createNotification()` helper          |
| 6   | Add polling or SSE for real-time updates         | `src/components/notifications/`               | Poll every 30s or use Server-Sent Events            |
| 7   | Mark all as read action                          | API + UI                                      | Bulk mark read                                      |

---

### F-008: Settings Page Completion

**Status**: 40% — mostly placeholders
**Priority**: P1
**Depends on**: F-006 (email preferences need email system)

| #   | Subtask                             | Scope                          | Notes                                                       |
| --- | ----------------------------------- | ------------------------------ | ----------------------------------------------------------- |
| 1   | Email notification preferences UI   | `src/components/settings/`     | Toggles per email category                                  |
| 2   | Timezone preference (persist to DB) | `src/components/settings/`     | Add `timezone` column to `users` table                      |
| 3   | Display name editing                | `src/components/settings/`     | Update via Clerk API + sync to DB                           |
| 4   | Account deletion request            | `src/components/settings/`     | Soft delete flow: confirm → schedule → delete via Clerk API |
| 5   | Data export (GDPR compliance)       | `src/app/api/settings/export/` | Generate JSON/CSV of user's data                            |
| 6   | Connected accounts section          | `src/components/settings/`     | Google Calendar (exists) + future integrations              |

---

### F-009: Review System — Coach Responses

**Status**: 85% — creation + display works, no replies
**Priority**: P1
**Depends on**: nothing

| #   | Subtask                                  | Scope                                        | Notes                                                |
| --- | ---------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| 1   | Add coach response API endpoint          | `src/app/api/reviews/[id]/response/route.ts` | PATCH with `coachResponse` field (already in schema) |
| 2   | Add response form on session detail page | `src/components/reviews/`                    | Coach sees review + reply box                        |
| 3   | Display coach response on public profile | `src/components/reviews/review-card.tsx`     | Show response below review                           |
| 4   | Email client when coach responds         | use F-006 infrastructure                     | Optional notification                                |

---

### F-010: Admin Panel — Complete

**Status**: 50%
**Priority**: P1
**Depends on**: nothing

| #   | Subtask                        | Scope                         | Notes                                            |
| --- | ------------------------------ | ----------------------------- | ------------------------------------------------ |
| 1   | Transaction management page    | `src/app/admin/transactions/` | List all transactions, filter by status, search  |
| 2   | Refund approval workflow       | `src/app/admin/transactions/` | Admin can initiate/approve refunds               |
| 3   | Coach verification detail view | `src/app/admin/coaches/[id]/` | Review full profile, approve/reject with notes   |
| 4   | Review moderation page         | `src/app/admin/reviews/`      | Flag/hide inappropriate reviews                  |
| 5   | Platform revenue dashboard     | `src/app/admin/`              | Revenue over time, fee breakdown, growth charts  |
| 6   | User detail view               | `src/app/admin/users/[id]/`   | Full user activity: bookings, messages, payments |

---

## Phase 2 — Growth Features

These drive engagement, retention, and platform value after launch.

---

### F-011: Real-Time Messaging Upgrade

**Status**: 70% — polling works, no push
**Priority**: P2
**Depends on**: nothing

| #   | Subtask                                                         | Scope                       | Notes                                                 |
| --- | --------------------------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| 1   | Evaluate real-time approach: Pusher, Ably, or Supabase Realtime | research                    | Supabase Realtime is free with existing Supabase plan |
| 2   | Implement real-time message delivery                            | `src/components/messages/`  | Subscribe to new messages in active conversation      |
| 3   | Typing indicators                                               | `src/components/messages/`  | Show "X is typing..."                                 |
| 4   | Online/offline presence                                         | `src/components/messages/`  | Green dot on avatar                                   |
| 5   | File/image attachments                                          | API + UI + Supabase Storage | Upload to `message-attachments` bucket                |
| 6   | Link previews                                                   | `src/components/messages/`  | Unfurl URLs in messages                               |
| 7   | Message search                                                  | API + UI                    | Full-text search across conversations                 |

---

### F-012: Analytics & Metrics

**Status**: 0%
**Priority**: P2
**Depends on**: nothing

| #   | Subtask                                                                              | Scope                                      | Notes                                             |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------- |
| 1   | Install PostHog (or similar)                                                         | `package.json`, `src/lib/analytics.ts`     | Self-hosted or cloud                              |
| 2   | Track page views                                                                     | `src/app/layout.tsx` or middleware         | Automatic route tracking                          |
| 3   | Track key events: booking created, payment completed, message sent, review submitted | scattered across API routes                | Use `analytics.track()` helper                    |
| 4   | Coach analytics dashboard                                                            | `src/app/(dashboard)/dashboard/analytics/` | Profile views, booking conversion, revenue trends |
| 5   | Admin analytics dashboard                                                            | `src/app/admin/analytics/`                 | Platform-wide metrics, cohort analysis            |
| 6   | Conversion funnel: coach profile → book → pay → complete                             | PostHog funnels                            | Identify drop-off points                          |

---

### F-013: Advanced Coach Search

**Status**: 75% — basic search + specialty filter
**Priority**: P2
**Depends on**: nothing

| #   | Subtask                                       | Scope                          | Notes                                                          |
| --- | --------------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| 1   | Move specialty + price filtering to SQL layer | `src/app/api/coaches/route.ts` | Currently filtered in JS — won't scale                         |
| 2   | Add rating threshold filter                   | API + UI                       | "4+ stars only"                                                |
| 3   | Add availability filter                       | API + UI                       | "Available this week" — requires join with availability tables |
| 4   | Add language filter                           | schema + API + UI              | New `languages` field on coach_profiles                        |
| 5   | Add location/timezone filter                  | API + UI                       | Use existing timezone field                                    |
| 6   | Full-text search with PostgreSQL `tsvector`   | schema + API                   | Index on name, headline, bio for better search                 |
| 7   | "Featured coaches" or staff picks             | schema + admin UI              | `isFeatured` flag on coach_profiles                            |

---

### F-014: Group Coaching

**Status**: 0% — mentioned in docs but unimplemented
**Priority**: P2
**Depends on**: F-005 (payments must be solid first)

| #   | Subtask                                              | Scope                                           | Notes                                                                                                       |
| --- | ---------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Design group session schema                          | `src/db/schema.ts`                              | New `group_sessions` table: coachId, title, description, maxParticipants, price, startTime, endTime, status |
| 2   | Create `group_session_participants` join table       | `src/db/schema.ts`                              | groupSessionId, clientId, status, transactionId                                                             |
| 3   | Group session CRUD API                               | `src/app/api/group-sessions/`                   | Coach creates, clients join                                                                                 |
| 4   | Group session listing on coach profile               | `src/components/coaches/`                       | Upcoming group sessions section                                                                             |
| 5   | Group session booking + payment flow                 | booking components + Stripe                     | Price per participant, capacity tracking                                                                    |
| 6   | Group session management for coaches                 | `src/app/(dashboard)/dashboard/group-sessions/` | View participants, send group messages                                                                      |
| 7   | Group messaging (conversation with multiple clients) | schema + API + UI                               | Extend conversations to support multiple participants                                                       |

---

### F-015: Coach Earnings & Financial Tools

**Status**: 80% — earnings display works, missing advanced features
**Priority**: P2
**Depends on**: F-005 (Stripe payouts)

| #   | Subtask                                                     | Scope                      | Notes                                      |
| --- | ----------------------------------------------------------- | -------------------------- | ------------------------------------------ |
| 1   | Earnings breakdown by time period (weekly, monthly, yearly) | `src/components/payments/` | Filter + chart                             |
| 2   | Revenue charts (line chart over time)                       | `src/components/payments/` | Use recharts or chart.js                   |
| 3   | Client revenue breakdown                                    | `src/components/payments/` | Which clients generate most revenue        |
| 4   | Export earnings as CSV                                      | API endpoint               | For tax reporting                          |
| 5   | Invoice generation (PDF)                                    | `src/app/api/invoices/`    | Auto-generated per transaction or monthly  |
| 6   | Payout history from Stripe                                  | `src/components/payments/` | Pull from Stripe API, display in dashboard |

---

## Phase 3 — Nice to Have

Features that improve experience but aren't blockers.

---

### F-016: Session Recordings & Resources

**Priority**: P3
**Depends on**: F-014 (optional, works for 1:1 too)

| #   | Subtask                                        | Notes                                   |
| --- | ---------------------------------------------- | --------------------------------------- |
| 1   | File upload per session (PDFs, worksheets)     | Supabase Storage `session-files` bucket |
| 2   | Recording link storage (Zoom, Google Meet)     | Add `recordingUrl` to bookings          |
| 3   | Resource library per coach-client relationship | New `resources` table                   |
| 4   | Shared notes (coach + client collaborative)    | Extend session_notes or new table       |

---

### F-017: Client Progress Tracking

**Priority**: P3
**Depends on**: nothing

| #   | Subtask                                       | Notes                                                     |
| --- | --------------------------------------------- | --------------------------------------------------------- |
| 1   | Goal setting (coach defines goals for client) | New `goals` table: title, description, targetDate, status |
| 2   | Progress milestones                           | New `milestones` table linked to goals                    |
| 3   | Progress dashboard for client                 | Visual progress bars, completed goals                     |
| 4   | Coach view of all clients' progress           | Aggregate view across clients                             |

---

### F-018: Scheduling Improvements

**Priority**: P3
**Depends on**: nothing

| #   | Subtask                                    | Notes                                                               |
| --- | ------------------------------------------ | ------------------------------------------------------------------- |
| 1   | Recurring sessions (weekly/biweekly)       | Booking recurrence pattern, auto-create future bookings             |
| 2   | Waitlist for fully booked coaches          | New `waitlist` table, notify when slot opens                        |
| 3   | Package deals (buy 5 sessions, get 1 free) | New `packages` table, Stripe subscription or multi-session checkout |
| 4   | Calendar embed for external websites       | Public iCal feed or embeddable widget                               |

---

### F-019: Social & Discovery

**Priority**: P3
**Depends on**: F-013 (search should be solid first)

| #   | Subtask                                   | Notes                                               |
| --- | ----------------------------------------- | --------------------------------------------------- |
| 1   | Coach blog/articles                       | New `articles` table, public pages                  |
| 2   | Testimonial import from LinkedIn/external | UI for pasting external testimonials                |
| 3   | Video introduction upload                 | Supabase Storage, `videoIntroUrl` already in schema |
| 4   | Referral program (client refers client)   | Referral codes, discount tracking                   |
| 5   | Coach badges and achievements             | Gamification: "50 sessions completed", "Top rated"  |

---

### F-020: Platform Operations

**Priority**: P3
**Depends on**: F-004 (error monitoring), F-012 (analytics)

| #   | Subtask                             | Notes                                                              |
| --- | ----------------------------------- | ------------------------------------------------------------------ |
| 1   | Health check endpoint               | `/api/health` — DB connectivity, external service status           |
| 2   | Admin audit log                     | Track all admin actions (verification, refunds, etc.)              |
| 3   | Automated fraud detection           | Flag suspicious booking patterns, multiple failed payments         |
| 4   | SEO optimization                    | Dynamic meta tags, structured data for coach profiles, sitemap.xml |
| 5   | Performance monitoring (Web Vitals) | Track LCP, FID, CLS per page                                       |

---

## Dependency Graph

```
F-001 Testing ──────► F-002 CI/CD
                         │
F-003 Rate Limiting      │     (independent)
F-004 Error Monitoring   │     (independent)
F-005 Stripe Complete ───┼───► F-014 Group Coaching
                         │         │
F-006 Email System ──────┼───► F-008 Settings
         │               │
         ▼               │
F-007 In-App Notifs      │
                         │
F-009 Reviews            │     (independent)
F-010 Admin Panel        │     (independent)
F-011 Real-Time Chat     │     (independent)
F-012 Analytics ─────────┼───► F-020 Platform Ops
F-013 Search ────────────┼───► F-019 Social/Discovery
F-005 ───────────────────┼───► F-015 Coach Earnings
                         │
                    Launch Gate
                         │
              F-016, F-017, F-018 (Phase 3)
```

---

## Recommended Implementation Order

| Order | Feature                    | Rationale                                                |
| ----- | -------------------------- | -------------------------------------------------------- |
| 1     | F-003 Rate Limiting        | Quick win, protects all endpoints immediately            |
| 2     | F-004 Error Monitoring     | Catch issues from day one                                |
| 3     | F-005 Stripe Complete      | Revenue-critical — must work before accepting real money |
| 4     | F-001 Testing              | Lock down existing features before building more         |
| 5     | F-002 CI/CD                | Automate quality gates                                   |
| 6     | F-006 Email System         | High user impact, moderate effort                        |
| 7     | F-009 Review Responses     | Small scope, high value for coaches                      |
| 8     | F-008 Settings             | Polish existing UI                                       |
| 9     | F-007 In-App Notifications | Major UX improvement                                     |
| 10    | F-010 Admin Panel          | Needed for operations at scale                           |
| 11    | F-013 Advanced Search      | Growth lever — helps clients find coaches                |
| 12    | F-011 Real-Time Chat       | Engagement feature                                       |
| 13    | F-012 Analytics            | Data-driven decisions                                    |
| 14    | F-015 Coach Earnings       | Coach retention                                          |
| 15    | F-014 Group Coaching       | Major new revenue stream                                 |
| 16+   | Phase 3 features           | As needed based on user feedback                         |
