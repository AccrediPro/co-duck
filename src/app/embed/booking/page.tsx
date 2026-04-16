/**
 * Public booking embed — rendered inside an iframe by /widget.js.
 *
 * Query params:
 *   coach    (required) coach slug
 *   session  (optional) preselected sessionType.id
 *   theme    (optional) "light" | "dark" (default light)
 *   primary  (optional) hex color override for --primary
 *   parent   (optional) parent-page origin (used for postMessage)
 */
import type { Metadata } from 'next';
import { getCoachForBooking } from '@/app/(public)/coaches/[slug]/book/actions';
import { EmbedBookingUi } from './embed-ui';

export const metadata: Metadata = {
  title: 'Book a session',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    coach?: string;
    session?: string;
    theme?: string;
    primary?: string;
    parent?: string;
  }>;
}

export default async function EmbedBookingPage({ searchParams }: PageProps) {
  const {
    coach: slug,
    session: sessionId,
    theme: themeParam,
    primary,
    parent: parentOrigin,
  } = await searchParams;

  if (!slug) {
    return (
      <EmbedError message='Missing coach slug. Add a data-coach="<slug>" attribute to the widget div.' />
    );
  }

  const result = await getCoachForBooking(slug);

  if (!result.success) {
    return <EmbedError message="This coach is not available for booking." />;
  }

  const theme = themeParam === 'dark' ? 'dark' : 'light';
  const accent = sanitizeHexColor(primary);

  return (
    <EmbedBookingUi
      coach={result.data}
      slug={slug}
      preselectedSessionId={sessionId ?? null}
      theme={theme}
      accent={accent}
      parentOrigin={parentOrigin ?? null}
    />
  );
}

function EmbedError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        {message}
      </div>
    </div>
  );
}

/** Reject anything that isn't a safe 3-or-6-digit hex color. */
function sanitizeHexColor(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : null;
}
