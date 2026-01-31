# Database Schema

This directory contains the database schema and queries for the Coaching Platform.

## Tech Stack

- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (hosted on Supabase)
- **Migrations**: Drizzle Kit

## Directory Structure

```
src/db/
├── schema.ts    # Complete database schema definitions
├── queries/     # Organized database query modules
│   ├── users.ts
│   ├── coaches.ts
│   ├── bookings.ts
│   └── ...
└── README.md    # This file
```

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COACHING PLATFORM ERD                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │    users     │
                              │──────────────│
                              │ id (PK)      │◄─────────────────┐
                              │ email        │                  │
                              │ name         │                  │
                              │ avatarUrl    │                  │
                              │ role         │                  │
                              │ createdAt    │                  │
                              │ updatedAt    │                  │
                              └──────┬───────┘                  │
                                     │                          │
                    ┌────────────────┼────────────────┐         │
                    │ 1:1            │                │         │
                    ▼                │                │         │
           ┌────────────────┐       │                │         │
           │ coach_profiles │       │                │         │
           │────────────────│       │                │         │
           │ userId (PK/FK) │       │                │         │
           │ slug           │       │                │         │
           │ headline       │       │                │         │
           │ bio            │       │                │         │
           │ specialties[]  │       │                │         │
           │ sessionTypes[] │       │                │         │
           │ isPublished    │       │                │         │
           │ bufferMinutes  │       │                │         │
           │ stripeAccountId│       │                │         │
           │ ...            │       │                │         │
           └───────┬────────┘       │                │         │
                   │                │                │         │
        ┌──────────┴──────────┐     │                │         │
        │ 1:N                 │ 1:N │            1:N │         │
        ▼                     ▼     ▼                ▼         │
┌─────────────────┐  ┌────────────────────┐  ┌────────────┐   │
│coach_availability│  │availability_overrides│  │  bookings  │   │
│─────────────────│  │────────────────────│  │────────────│   │
│ id (PK)         │  │ id (PK)            │  │ id (PK)    │   │
│ coachId (FK)    │  │ coachId (FK)       │  │ coachId(FK)│───┤
│ dayOfWeek       │  │ date               │  │ clientId(FK)───┤
│ startTime       │  │ isAvailable        │  │ sessionType│   │
│ endTime         │  │ startTime          │  │ startTime  │   │
│ isAvailable     │  │ endTime            │  │ endTime    │   │
└─────────────────┘  │ reason             │  │ status     │   │
                     └────────────────────┘  │ meetingLink│   │
                                             └─────┬──────┘   │
                              ┌─────────────────────┼─────────┤
                              │ 1:N                 │ 1:1     │
                              ▼                     ▼         │
                     ┌────────────────┐    ┌──────────────┐   │
                     │  transactions  │    │session_notes │   │
                     │────────────────│    │──────────────│   │
                     │ id (PK)        │    │ id (PK)      │   │
                     │ bookingId (FK) │    │ bookingId(FK)│   │
                     │ coachId (FK)   │────│ coachId (FK) │───┤
                     │ clientId (FK)  │────│ content      │   │
                     │ amountCents    │    └──────────────┘   │
                     │ platformFeeCents│                      │
                     │ coachPayoutCents│                      │
                     │ status         │                       │
                     └────────────────┘                       │
                                                              │
                     ┌────────────────┐    ┌──────────────┐   │
                     │ conversations  │    │ action_items │   │
                     │────────────────│    │──────────────│   │
                     │ id (PK)        │    │ id (PK)      │   │
                     │ coachId (FK)   │────│ coachId (FK) │───┤
                     │ clientId (FK)  │────│ clientId(FK) │───┤
                     │ lastMessageAt  │    │ bookingId(FK)│   │
                     └───────┬────────┘    │ title        │   │
                             │             │ isCompleted  │   │
                        1:N  │             └──────────────┘   │
                             ▼                                │
                     ┌────────────────┐                       │
                     │   messages     │                       │
                     │────────────────│                       │
                     │ id (PK)        │                       │
                     │ conversationId │                       │
                     │ senderId (FK)  │───────────────────────┘
                     │ content        │
                     │ messageType    │
                     │ isRead         │
                     └────────────────┘
```

## Tables Overview

### Core User Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | All platform users (synced from Clerk) | id, email, name, role |
| `coach_profiles` | Extended profile for coaches | userId, slug, specialties, sessionTypes |

### Availability Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `coach_availability` | Weekly recurring schedule | coachId, dayOfWeek, startTime, endTime |
| `availability_overrides` | Date-specific exceptions | coachId, date, isAvailable, reason |

### Booking & Payment Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `bookings` | Scheduled sessions | coachId, clientId, sessionType, status |
| `transactions` | Payment records | bookingId, amountCents, status |

### Messaging Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `conversations` | Chat threads (1 per coach-client pair) | coachId, clientId, lastMessageAt |
| `messages` | Individual messages | conversationId, senderId, content |

### Supporting Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `session_notes` | Private coach notes (1 per booking) | bookingId, coachId, content |
| `action_items` | Tasks assigned to clients | coachId, clientId, title, isCompleted |

## Enum Values

### `user_role`
| Value | Description |
|-------|-------------|
| `admin` | Platform administrators |
| `coach` | Users who offer coaching services |
| `client` | Users who book sessions (default) |

### `booking_status`
| Value | Description |
|-------|-------------|
| `pending` | Awaiting payment confirmation |
| `confirmed` | Payment successful, session scheduled |
| `completed` | Session occurred |
| `cancelled` | Session was cancelled |
| `no_show` | Client didn't attend |

### `transaction_status`
| Value | Description |
|-------|-------------|
| `pending` | Payment in progress |
| `succeeded` | Payment successful |
| `failed` | Payment failed |
| `refunded` | Payment refunded |

### `message_type`
| Value | Description |
|-------|-------------|
| `text` | Regular user message |
| `system` | Auto-generated message |

## JSONB Field Structures

### `coach_profiles.specialties`
```typescript
// Array of specialty strings
string[]
// Example: ["Career Coaching", "Executive Coaching", "Work-Life Balance"]
```

### `coach_profiles.sessionTypes`
```typescript
interface SessionType {
  id: string;       // "session_{timestamp}_{random7chars}"
  name: string;     // "Discovery Call", "1-Hour Coaching"
  duration: number; // Minutes (30, 60, 90)
  price: number;    // Cents (0, 15000, 25000)
}
// Example:
[
  { id: "session_123_abc1234", name: "Discovery Call", duration: 30, price: 0 },
  { id: "session_456_xyz5678", name: "1-Hour Session", duration: 60, price: 15000 }
]
```

### `bookings.sessionType`
```typescript
interface BookingSessionType {
  name: string;     // Session name at booking time
  duration: number; // Duration in minutes
  price: number;    // Price in cents (snapshot)
}
// Note: Captures pricing at booking time - coach price changes don't affect existing bookings
```

## Key Design Decisions

### 1. Clerk User IDs
User IDs are text strings from Clerk (e.g., `user_2abc123...`), not auto-generated integers. This maintains sync between Clerk and our database.

### 2. Monetary Values in Cents
All money amounts are stored as integers in **cents** to avoid floating-point precision issues:
- `$150.00` → `15000` cents
- `$25.50` → `2550` cents

### 3. Platform Fee Structure
The platform takes a 10% fee on all transactions:
- Total: `amountCents`
- Platform: `platformFeeCents` (10%)
- Coach: `coachPayoutCents` (90%)

### 4. Availability Override Priority
When checking if a coach is available on a specific date:
1. Check `availability_overrides` for that date
2. If found, use override's settings
3. If not found, use `coach_availability` weekly schedule

### 5. Soft Deletes for Bookings
Bookings are never hard-deleted. Cancellations set:
- `status = 'cancelled'`
- `cancelledBy` = user who cancelled
- `cancelledAt` = timestamp
- `cancellationReason` = optional reason

### 6. Session Type Snapshots
`bookings.sessionType` stores a **snapshot** of the session type at booking time. This preserves the original terms even if the coach updates their prices later.

## Common Queries

### Get Coach's Weekly Availability
```typescript
const availability = await db
  .select()
  .from(coachAvailability)
  .where(eq(coachAvailability.coachId, coachId))
  .orderBy(coachAvailability.dayOfWeek);
```

### Get Upcoming Sessions for Coach
```typescript
const sessions = await db
  .select()
  .from(bookings)
  .where(
    and(
      eq(bookings.coachId, coachId),
      eq(bookings.status, 'confirmed'),
      gt(bookings.startTime, new Date())
    )
  )
  .orderBy(bookings.startTime);
```

### Check for Booking Conflicts
```typescript
const conflicts = await db
  .select()
  .from(bookings)
  .where(
    and(
      eq(bookings.coachId, coachId),
      inArray(bookings.status, ['pending', 'confirmed']),
      lt(bookings.startTime, proposedEndTime),
      gt(bookings.endTime, proposedStartTime)
    )
  );
```

## Migrations

### Generate Migration
```bash
npm run db:generate
```

### Run Migration
```bash
npm run db:migrate
```

### Migration Files
Migrations are stored in `/drizzle` directory at project root.

## Environment Variables

Required database configuration in `.env.local`:

```env
DATABASE_URL=postgresql://user:pass@host:5432/database
```

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- See `schema.ts` for detailed JSDoc on each table and field
