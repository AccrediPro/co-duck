# AccrediPro CoachHub Platform Walkthrough Guide

A comprehensive visual guide to all features of the AccrediPro CoachHub coaching platform.

## Table of Contents

1. [Homepage](#1-homepage)
2. [Browse Coaches](#2-browse-coaches)
3. [Coach Profile](#3-coach-profile)
4. [Specialties](#4-specialties)
5. [About Page](#5-about-page)
6. [Contact Page](#6-contact-page)
7. [Booking Flow](#7-booking-flow)
8. [Dashboard](#8-dashboard)

---

## 1. Homepage

The homepage introduces visitors to the platform with a hero section, features, and featured coaches.

![Homepage](screenshots/01-homepage.png)

### Key Elements

| Section                            | Description                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| **Hero**                           | "Find Your Perfect Coach" headline with CTA buttons                          |
| **Why Choose AccrediPro CoachHub** | 3 value propositions (Expert Coaches, Flexible Scheduling, Secure & Private) |
| **How It Works**                   | 3-step process (Browse, Book, Achieve)                                       |
| **Featured Coaches**               | Showcase of top coaches with quick links                                     |
| **Become a Coach CTA**             | Invitation for coaches to join the platform                                  |
| **Footer**                         | Navigation links, newsletter signup, social media                            |

### User Actions

- Click "Find a Coach" to browse coaches
- Click "Become a Coach" to sign up as a coach
- Browse featured coaches directly from homepage

---

## 2. Browse Coaches

The coaches listing page allows visitors to search and filter coaches.

![Coaches List](screenshots/02-coaches-list.png)

### Features

| Feature              | Description                                               |
| -------------------- | --------------------------------------------------------- |
| **Search**           | Search by name, headline, or bio                          |
| **Specialty Filter** | Filter by coaching specialty (12 options)                 |
| **Price Filter**     | Set min/max price range                                   |
| **Sort Options**     | Newest, Price Low-High, Price High-Low                    |
| **Coach Cards**      | Shows avatar, name, headline, specialties, starting price |

### URL Parameters

- `?q=Sarah` - Search query
- `?specialties=Career+Coaching` - Filter by specialty
- `?sort=price_low` - Sort order
- `?minPrice=100&maxPrice=500` - Price range

---

## 3. Coach Profile

Individual coach profiles show detailed information and booking options.

![Coach Profile](screenshots/03-coach-profile.png)

### Sections

| Section                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| **Header**             | Avatar, name, headline, timezone, action buttons |
| **About**              | Full bio and coaching philosophy                 |
| **Specialties**        | Tags showing areas of expertise                  |
| **Availability**       | Timezone, next available slot, general hours     |
| **Sessions & Pricing** | Available session types with duration and price  |
| **Share**              | Copy profile link button                         |

### Session Types Example

- Discovery Call - 30 min - $0 (free intro)
- Executive Coaching - 60 min - $200
- Deep Dive Intensive - 90 min - $285

---

## 4. Specialties

Browse all coaching specialties with coach counts.

![Specialties](screenshots/06-specialties.png)

### Available Specialties

| Specialty             | Description                             |
| --------------------- | --------------------------------------- |
| Life Coaching         | Balance, goals, life vision             |
| Career Coaching       | Transitions, professional growth        |
| Health & Wellness     | Habits, wellbeing, health goals         |
| Executive Coaching    | Leadership, decision-making             |
| Relationship Coaching | Communication, connections              |
| Business Coaching     | Scaling, growth, operations             |
| Leadership Coaching   | Team leadership, organizational success |
| Mindset & Motivation  | Beliefs, resilience, potential          |
| Financial Coaching    | Money management, wealth                |
| Parenting Coaching    | Family, parenting challenges            |
| Spiritual Coaching    | Inner journey, purpose                  |
| Performance Coaching  | Peak results, optimization              |

### Actions

- Click any specialty card to see filtered coaches
- "Browse All Coaches" button to see all
- "Get Recommendations" links to contact form

---

## 5. About Page

Company information and platform values.

![About Page](screenshots/04-about.png)

### Content Sections

| Section                     | Content                                                        |
| --------------------------- | -------------------------------------------------------------- |
| **Hero**                    | Mission statement and tagline                                  |
| **Stats**                   | 1,000+ clients, 100+ coaches, 10,000+ sessions, 4.9/5 rating   |
| **Mission**                 | Detailed mission statement                                     |
| **Values**                  | Purpose-Driven, Client-Centered, Community-Focused, Excellence |
| **Journey**                 | Company timeline (2023 Founded, 2024 Growth, 2025 Evolution)   |
| **What Makes Us Different** | 6 differentiators with checkmarks                              |
| **CTA**                     | "Find a Coach" and "Contact Us" buttons                        |

---

## 6. Contact Page

Contact form and FAQ section.

![Contact Page](screenshots/05-contact.png)

### Contact Options

| Method            | Details                         |
| ----------------- | ------------------------------- |
| **Email**         | support@accredipro-coachhub.com |
| **Location**      | San Francisco, CA               |
| **Response Time** | Within 24 hours (Mon-Fri)       |

### Form Fields

- Name (required)
- Email (required)
- Subject (dropdown: General, Booking, Technical, Feedback, Partnership, Other)
- Message (required, 1000 char limit with counter)

### FAQ Topics

1. How do I find the right coach for me?
2. What if I'm not satisfied with my session?
3. How do I become a coach on the platform?
4. Are the sessions confidential?
5. What payment methods do you accept?
6. Can I reschedule or cancel a session?

---

## 7. Booking Flow

Multi-step booking process for scheduling sessions.

![Booking Flow](screenshots/08-booking.png)

### Steps

| Step                       | Description                         |
| -------------------------- | ----------------------------------- |
| **1. Select Session Type** | Choose from available session types |
| **2. Pick Date & Time**    | Select from coach's available slots |
| **3. Confirm & Pay**       | Review booking and complete payment |

### Booking Page Elements

- Coach info header with "Back to Profile" link
- Progress indicator (1-2-3 steps)
- Session type cards with duration and price
- Booking summary sidebar
- Continue button (disabled until selection made)

### Payment

- Stripe integration for secure payments
- Support for cards, Apple Pay, Google Pay
- 10% platform fee on paid sessions

---

## 8. Dashboard

Authenticated user dashboard for coaches and clients.

![Dashboard](screenshots/09-dashboard.png)

### Navigation Menu

| Page             | Description                                 |
| ---------------- | ------------------------------------------- |
| **Overview**     | Dashboard home with stats and quick actions |
| **Profile**      | Edit coach profile information              |
| **Sessions**     | View and manage upcoming/past sessions      |
| **Availability** | Set weekly schedule and date overrides      |
| **Payments**     | View payment history and earnings           |
| **Messages**     | Chat with clients/coaches                   |
| **Settings**     | Account settings and preferences            |

### Dashboard Cards (Coach View)

- **Profile Status** - Published/Draft status with completion percentage
- **Profile Views** - Analytics (coming soon)
- **Upcoming Sessions** - Count for next 7 days

### Quick Actions

- Edit Profile button
- View Public Profile button

---

## Authentication

### Sign In

- Clerk-powered authentication
- Social login options (Apple, Facebook, Google)
- Email/password login
- Split-screen layout with benefits on left (desktop)

### Sign Up

- Same Clerk authentication
- Choose role: Client or Coach
- Benefits displayed during signup
- Email verification required

---

## Mobile Responsiveness

All pages are fully responsive:

| Breakpoint            | Layout Changes                                   |
| --------------------- | ------------------------------------------------ |
| **Mobile (375px)**    | Single column, hamburger menu, stacked elements  |
| **Tablet (768px)**    | 2-column grids, expanded navigation              |
| **Desktop (1024px+)** | Full layout with sidebars and multi-column grids |

---

## Legal Pages

### Terms of Service (`/terms`)

- 12 accordion sections
- Table of contents sidebar (desktop)
- Back-to-top button
- Print functionality

### Privacy Policy (`/privacy`)

- 12 accordion sections
- Same layout as Terms
- GDPR/CCPA compliant information

---

## Error Handling

### 404 Page

- Custom "Page Not Found" design
- "Go Home" button
- "Browse Coaches" button
- Contact link for help

---

## Tech Stack Reference

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | Next.js 14, React, TypeScript      |
| Styling  | Tailwind CSS, shadcn/ui            |
| Database | PostgreSQL (Supabase), Drizzle ORM |
| Auth     | Clerk                              |
| Payments | Stripe Connect                     |
| Hosting  | Vercel (recommended)               |

---

## Related Documentation

- [README.md](../README.md) - Project setup and overview
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [API.md](API.md) - API endpoint documentation
- [src/db/README.md](../src/db/README.md) - Database schema
- [src/components/README.md](../src/components/README.md) - Component catalog
