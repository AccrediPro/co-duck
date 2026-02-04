# Coaching Platform

A marketplace platform connecting coaches with clients for 1:1 coaching sessions. Built with Next.js 14, TypeScript, and PostgreSQL.

## Features

### For Clients

- **Coach Discovery** - Browse and search coaches by specialty, view profiles and reviews
- **Session Booking** - Book sessions with real-time availability, integrated Stripe payments
- **Session Management** - View upcoming/past sessions, reschedule, cancel with refund policy
- **Messaging** - Real-time 1:1 conversations with coaches
- **Action Items** - Track tasks and assignments from coaching sessions

### For Coaches

- **Profile Management** - Create and publish professional coaching profile
- **Availability Settings** - Configure weekly schedule with date-specific overrides
- **Session Management** - View bookings, mark complete, add session notes
- **Client Management** - Message clients, assign action items, track progress
- **Earnings Dashboard** - View payment history and earnings (Stripe Connect)

### Platform Features

- **Authentication** - Clerk-powered auth with role-based access (client, coach, admin)
- **Payments** - Stripe Connect for marketplace payments (10% platform fee)
- **Real-time Messaging** - Polling-based chat with read receipts
- **Calendar Export** - ICS file generation for session scheduling

## Tech Stack

| Category           | Technology                      |
| ------------------ | ------------------------------- |
| **Framework**      | Next.js 14 (App Router)         |
| **Language**       | TypeScript                      |
| **Styling**        | Tailwind CSS                    |
| **UI Components**  | shadcn/ui (Radix UI primitives) |
| **Database**       | PostgreSQL                      |
| **ORM**            | Drizzle ORM                     |
| **Authentication** | Clerk                           |
| **Payments**       | Stripe Connect                  |
| **Forms**          | React Hook Form + Zod           |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)
- Clerk account (for authentication)
- Stripe account with Connect enabled (for payments)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd coaching-platform
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy the example environment file and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   See [Environment Variables](#environment-variables) section for required values.

4. **Set up the database**

   ```bash
   # Generate migrations from schema
   npm run db:generate

   # Apply migrations to database
   npm run db:migrate
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Open your browser**

   Visit [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env.local` file with the following variables:

### Database

```bash
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host:5432/database"
```

### Clerk Authentication

```bash
# From Clerk Dashboard > API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Clerk webhook secret (from Clerk Dashboard > Webhooks)
CLERK_WEBHOOK_SECRET="whsec_..."

# Clerk URLs (defaults work for most setups)
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
```

### Stripe Payments

```bash
# From Stripe Dashboard > Developers > API Keys
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Stripe webhook secret (from Stripe Dashboard > Webhooks)
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Application URLs

```bash
# Your application's base URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Development Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Generate database migrations
npm run db:generate

# Run database migrations
npm run db:migrate

# Push schema changes (dev only)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Project Structure

```
coaching-platform/
├── docs/                    # Documentation
│   ├── API.md              # API routes documentation
│   └── ARCHITECTURE.md     # System architecture overview
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (dashboard)/    # Protected dashboard routes
│   │   ├── (public)/       # Public-facing routes
│   │   └── api/            # API routes (webhooks)
│   ├── components/         # React components
│   │   ├── ui/             # shadcn/ui primitives
│   │   └── [feature]/      # Feature-specific components
│   ├── db/                 # Database layer
│   │   ├── schema.ts       # Drizzle schema definitions
│   │   └── queries/        # Database query modules
│   └── lib/                # Utilities and helpers
│       ├── validators/     # Zod validation schemas
│       ├── stripe.ts       # Stripe client configuration
│       └── refunds.ts      # Refund calculation logic
├── public/                 # Static assets
└── package.json
```

## Documentation

- **[Architecture Overview](./docs/ARCHITECTURE.md)** - System design, data flows, and architecture decisions
- **[API Documentation](./docs/API.md)** - Webhook endpoints and request/response formats
- **[Database Schema](./src/db/README.md)** - ERD, table documentation, and query examples
- **[Components Guide](./src/components/README.md)** - Component organization and patterns

## Webhook Setup

### Stripe Webhooks

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

**Local Development:**

```bash
# Install Stripe CLI, then:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Clerk Webhooks

1. Go to Clerk Dashboard > Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Select events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET`

**Local Development:**

Use ngrok or similar to expose localhost, then configure Clerk webhook to point to your ngrok URL.

## Key Concepts

### User Roles

| Role       | Description                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| **Client** | Default role. Can browse coaches, book sessions, message coaches            |
| **Coach**  | Created via onboarding flow. Can manage availability, sessions, and clients |
| **Admin**  | Platform administrator (future features)                                    |

### Booking Flow

1. Client selects session type and date/time
2. Client confirms booking details
3. Stripe Checkout processes payment
4. Webhook confirms payment and creates session
5. Both parties receive confirmation

### Payment Structure

- Platform fee: 10%
- Coach receives: 90%
- Processed via Stripe Connect destination charges

### Refund Policy

| Cancellation By | Timing           | Refund |
| --------------- | ---------------- | ------ |
| Coach           | Any time         | 100%   |
| Client          | >24 hours before | 100%   |
| Client          | <24 hours before | 0%     |

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass: `npm run typecheck && npm run lint`
4. Submit a pull request

## License

[Add your license here]
