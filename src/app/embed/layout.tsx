/**
 * Bare embed layout used by the booking widget iframe.
 *
 * Differences from the main app layout:
 * - No ClerkProvider (embed flow is public/guest-only).
 * - No dashboard or public-site chrome.
 * - Body keeps the same Geist fonts + globals.css so the embed visually
 *   matches the main platform.
 *
 * The outer <html> + <body> come from the root layout; Next.js requires the
 * root route group to provide them. This file is a segment layout that
 * simply renders its children inside a minimal container.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a session',
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="embed-root min-h-screen bg-transparent">{children}</div>;
}
