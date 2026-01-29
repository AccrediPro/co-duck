# Coaching Platform

## Overview

Platform connecting coaches with clients for 1:1 and group coaching sessions.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Clerk
- **Validation**: Zod
- **Payments**: Stripe Connect (future)

## Project Structure

```
src/
  app/           # Next.js App Router pages
  components/    # React components
    ui/          # shadcn/ui components
  lib/           # Utilities, helpers
  db/            # Drizzle schema and queries
```

## Development Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run db:generate # Generate migrations
npm run db:migrate  # Run migrations
```

## Environment Variables

Required in `.env.local`:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `CLERK_WEBHOOK_SECRET` - For user sync webhook

## Key Conventions

- Use server components by default, client components only when needed
- API routes in `src/app/api/`
- Database queries in `src/db/queries/`
- Zod schemas colocated with forms or in `src/lib/validators/`
