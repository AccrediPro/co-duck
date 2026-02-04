# Components Directory

This directory contains all React components for the Coaching Platform, organized by feature domain.

## Directory Structure

```
components/
├── action-items/      # Client task management
├── availability/      # Coach availability settings
├── booking/           # Session booking flow
├── coaches/           # Coach discovery & profiles
├── messages/          # Real-time messaging
├── navigation/        # Header, sidebar, footer
├── onboarding/        # Coach onboarding wizard
├── payments/          # Payment & earnings display
├── profile/           # Coach profile editing
├── sessions/          # Session management
└── ui/                # shadcn/ui primitives
```

## Folder Descriptions

### `action-items/`

Client task management components for tracking coaching assignments.

| Component             | Description                                        |
| --------------------- | -------------------------------------------------- |
| `ActionItemsList`     | Displays client's action items with status toggles |
| `AddActionItemDialog` | Modal for coaches to create new tasks              |

### `availability/`

Coach availability configuration.

| Component          | Description                                      |
| ------------------ | ------------------------------------------------ |
| `AvailabilityForm` | Weekly schedule editor with copy-to-days feature |

### `booking/`

Three-step booking flow for clients reserving sessions.

| Component               | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `BookingFlow`           | Multi-step wizard: session → date → time       |
| `BookingConfirmation`   | Pre-payment summary with session details       |
| `PaymentSuccessContent` | Post-payment confirmation with calendar export |

### `coaches/`

Coach discovery and profile display.

| Component             | Description                           |
| --------------------- | ------------------------------------- |
| `CoachCard`           | Coach preview card for directory grid |
| `CoachCardSkeleton`   | Loading placeholder for coach cards   |
| `CoachesGrid`         | Paginated grid of coach cards         |
| `CoachProfileDisplay` | Full public coach profile page        |
| `CoachSearchFilters`  | Specialty and search filters          |
| `AvailabilitySection` | Next available slot display           |

### `messages/`

Real-time messaging between coaches and clients.

| Component           | Description                         |
| ------------------- | ----------------------------------- |
| `ConversationsList` | Inbox view with search              |
| `ConversationRow`   | Conversation preview item           |
| `ChatView`          | Message thread with polling updates |
| `MessageBubble`     | Text or system message display      |
| `MessageInput`      | Auto-resizing textarea with send    |
| `MessageButton`     | "Message Coach" button              |
| `ChatContextPanel`  | Coach-only client context sidebar   |

**Note:** Uses barrel export in `index.ts` for clean imports.

### `navigation/`

App-wide navigation components.

| Component               | Description                   |
| ----------------------- | ----------------------------- |
| `DashboardSidebar`      | Role-based sidebar navigation |
| `DashboardMobileHeader` | Mobile hamburger menu         |
| `PublicHeader`          | Marketing site header         |
| `PublicFooter`          | Marketing site footer         |

### `onboarding/`

Four-step coach onboarding wizard.

| Component            | Description                             |
| -------------------- | --------------------------------------- |
| `StepIndicator`      | Visual progress indicator               |
| `BasicInfoForm`      | Step 1: Name, headline, photo, timezone |
| `BioSpecialtiesForm` | Step 2: Bio and specialty selection     |
| `PricingForm`        | Step 3: Currency and session types      |
| `ReviewPublishForm`  | Step 4: Preview and publish             |

### `payments/`

Coach earnings and transaction display.

| Component          | Description                       |
| ------------------ | --------------------------------- |
| `PaymentsContent`  | Main payments dashboard layout    |
| `EarningsOverview` | Summary cards with total earnings |
| `TransactionsList` | Paginated transaction history     |

### `profile/`

Coach profile management.

| Component           | Description                                   |
| ------------------- | --------------------------------------------- |
| `ProfileEditorForm` | All-in-one profile editor with publish toggle |

### `sessions/`

Session management for both coaches and clients.

| Component            | Description                                   |
| -------------------- | --------------------------------------------- |
| `SessionCard`        | Coach-view session with actions               |
| `SessionsList`       | Tabbed session list (upcoming/past/cancelled) |
| `ClientSessionCard`  | Client-view session card                      |
| `ClientSessionsList` | Client's session list                         |
| `CancellationDialog` | Refund-aware cancellation modal               |

### `ui/`

Base UI primitives from shadcn/ui. **Do not modify directly** – these are generated.

| Component                      | Source                               |
| ------------------------------ | ------------------------------------ |
| `Button`, `Input`, `Textarea`  | shadcn/ui form controls              |
| `Card`, `Badge`, `Avatar`      | shadcn/ui display components         |
| `Dialog`, `Sheet`, `Popover`   | shadcn/ui overlays                   |
| `Select`, `Checkbox`, `Switch` | shadcn/ui form inputs                |
| `Tabs`, `Command`, `Calendar`  | shadcn/ui advanced components        |
| `Form`                         | React Hook Form + shadcn integration |
| `Toast`, `Toaster`, `Sonner`   | Notification systems                 |

---

## Naming Conventions

### File Names

- **kebab-case**: `coach-card.tsx`, `booking-flow.tsx`
- **Suffix patterns**:
  - `-form.tsx`: Form components with validation
  - `-list.tsx`: Collection/list displays
  - `-card.tsx`: Card-style display items
  - `-dialog.tsx`: Modal dialogs
  - `-content.tsx`: Main content areas

### Component Names

- **PascalCase**: `CoachCard`, `BookingFlow`
- Match file name (kebab → PascalCase)
- Suffix patterns match file suffixes

### Export Style

```typescript
// Named export (preferred)
export function CoachCard({ ... }: CoachCardProps) { }

// forwardRef (for UI primitives)
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...)
Button.displayName = 'Button';
export { Button };
```

---

## Prop Patterns

### Interface Naming

Props interfaces use `{ComponentName}Props` convention:

```typescript
interface CoachCardProps {
  name: string;
  avatarUrl: string | null;
  slug: string;
}

export function CoachCard({ name, avatarUrl, slug }: CoachCardProps) {}
```

### Common Prop Patterns

#### Initial Data (Server → Client Hydration)

```typescript
interface MyComponentProps {
  initialData: {
    // ... pre-fetched data
  };
}
```

Used for server component data passed to client components.

#### Callback Props

```typescript
interface SessionCardProps {
  onMarkComplete?: (sessionId: number) => Promise<void>;
  onCancel?: (sessionId: number, reason: string) => Promise<void>;
}
```

Optional callbacks for parent-controlled actions.

#### Boolean Flags

```typescript
interface SessionCardProps {
  isPast?: boolean; // Default: false
  isCancelled?: boolean; // Default: false
}
```

Use `?` for optional with sensible defaults.

#### Entity References

```typescript
interface BookingFlowProps {
  coach: CoachBookingData; // Typed entity
  slug: string; // URL identifier
}
```

Import types from actions or schema files.

---

## Client vs Server Components

### 'use client' Directive

Most feature components are client components due to:

- Form state with React Hook Form
- Browser APIs (timezone detection, navigation)
- Interactive UI (dropdowns, modals, toggles)

```typescript
'use client';

import { useState } from 'react';
// ...
```

### Server Components

Server components are typically:

- Page layouts (`page.tsx`)
- Data-fetching wrappers
- Static content

Data flows: **Server fetches** → **Client renders**

---

## Integration with Server Actions

Components call server actions for mutations:

```typescript
import { saveAvailabilitySettings } from '@/app/(dashboard)/dashboard/availability/actions';

async function handleSave() {
  const result = await saveAvailabilitySettings(data);
  if (result.success) {
    toast({ title: 'Saved!' });
  } else {
    toast({ variant: 'destructive', title: result.error });
  }
}
```

Actions return `{ success: true; data: T }` or `{ success: false; error: string }`.

---

## Styling

### Tailwind CSS

All styling uses Tailwind utility classes:

```typescript
<Card className="transition-all hover:border-primary/30 hover:shadow-md">
```

### shadcn/ui Integration

Use variant props for consistent styling:

```typescript
<Button variant="destructive" size="sm">Cancel</Button>
<Badge variant="secondary">Draft</Badge>
```

### Responsive Design

Mobile-first with `sm:`, `md:`, `lg:` breakpoints:

```typescript
<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
```

---

## Type Safety

### Strict TypeScript

All components are fully typed:

- Props interfaces required
- No `any` types
- Explicit return types not required (inferred)

### Shared Types

Import types from centralized locations:

```typescript
import type { SessionType } from '@/db/schema';
import type { CoachBookingData } from '@/app/(public)/coaches/[slug]/book/actions';
```

---

## Adding New Components

1. **Choose the right folder** based on feature domain
2. **Follow naming conventions** for files and exports
3. **Define Props interface** with JSDoc if complex
4. **Add 'use client'** if using hooks or browser APIs
5. **Use shadcn/ui primitives** from `ui/` folder
6. **Call server actions** for data mutations
7. **Add to barrel export** if folder has `index.ts`
