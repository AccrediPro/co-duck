import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, and, sql } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import { COACH_CATEGORIES, findParentCategory } from '@/lib/validators/coach-onboarding';
import { SPECIALTY_COPY } from '@/lib/specialty-copy';
import { CoachCard } from '@/components/coaches/coach-card';
import { ChevronRight } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** All slugs that get static pages: 15 H&W sub-niches + 11 top-level categories */
export async function generateStaticParams() {
  const slugs: { slug: string }[] = [];
  for (const cat of COACH_CATEGORIES) {
    slugs.push({ slug: cat.slug });
    for (const sub of cat.subNiches) {
      slugs.push({ slug: sub.slug });
    }
  }
  return slugs;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const copy = SPECIALTY_COPY[slug];
  if (!copy) return { title: 'Specialty Coaches | Co-duck' };

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    openGraph: {
      title: copy.metaTitle,
      description: copy.ogDescription,
      type: 'website',
      siteName: 'Co-duck',
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.metaTitle,
      description: copy.ogDescription,
    },
    alternates: {
      canonical: `/coaches/specialty/${slug}`,
    },
  };
}

/** Resolve a slug to its label — works for both category and sub-niche slugs */
function resolveLabel(slug: string): string | null {
  for (const cat of COACH_CATEGORIES) {
    if (cat.slug === slug) return cat.label;
    const sub = cat.subNiches.find((s) => s.slug === slug);
    if (sub) return sub.label;
  }
  return null;
}

/** Fetch coaches matching this specialty slug */
async function getCoachesForSpecialty(slug: string) {
  // Determine if this is a sub-niche slug or a top-level category slug
  const parentCat = findParentCategory(slug);
  const cat = COACH_CATEGORIES.find((c) => c.slug === slug);

  let categoryLabel: string;
  let subNicheLabel: string | null = null;

  if (parentCat) {
    // It's a sub-niche
    categoryLabel = parentCat.label;
    const sub = parentCat.subNiches.find((s) => s.slug === slug);
    subNicheLabel = sub?.label ?? null;
  } else if (cat) {
    // It's a top-level category
    categoryLabel = cat.label;
  } else {
    return [];
  }

  const coaches = await db
    .select({
      userId: coachProfiles.userId,
      slug: coachProfiles.slug,
      headline: coachProfiles.headline,
      specialties: coachProfiles.specialties,
      currency: coachProfiles.currency,
      sessionTypes: coachProfiles.sessionTypes,
      averageRating: coachProfiles.averageRating,
      reviewCount: coachProfiles.reviewCount,
      verificationStatus: coachProfiles.verificationStatus,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(
      and(
        eq(coachProfiles.isPublished, true),
        subNicheLabel
          ? sql`EXISTS (
              SELECT 1 FROM jsonb_array_elements(${coachProfiles.specialties}::jsonb) elem
              WHERE elem->>'category' = ${categoryLabel}
                AND elem->'subNiches' @> ${JSON.stringify([subNicheLabel])}::jsonb
            )`
          : sql`EXISTS (
              SELECT 1 FROM jsonb_array_elements(${coachProfiles.specialties}::jsonb) elem
              WHERE elem->>'category' = ${categoryLabel}
            )`
      )
    )
    .limit(12);

  return coaches;
}

/** FAQ Accordion — server component using details/summary for zero-JS */
function FaqAccordion({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <details key={i} className="group rounded-lg border bg-card px-5 py-4 open:shadow-sm">
          <summary className="cursor-pointer list-none text-sm font-medium leading-snug text-foreground marker:hidden">
            <span className="flex items-center justify-between gap-3">
              {faq.question}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}

export default async function SpecialtyLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const copy = SPECIALTY_COPY[slug];

  if (!copy) {
    notFound();
  }

  const label = resolveLabel(slug);
  const parentCat = findParentCategory(slug);
  const coaches = await getCoachesForSpecialty(slug);

  // For breadcrumb: either top-level or sub-niche under Health & Wellness
  const breadcrumbs = [
    { label: 'Find a Coach', href: '/coaches' },
    ...(parentCat
      ? [
          { label: parentCat.label, href: `/coaches/specialty/${parentCat.slug}` },
          { label: copy.h1, href: `/coaches/specialty/${slug}` },
        ]
      : [{ label: copy.h1, href: `/coaches/specialty/${slug}` }]),
  ];

  // Related sub-niches (only for H&W sub-niches)
  const relatedSubNiches = parentCat?.subNiches.filter((s) => s.slug !== slug).slice(0, 6) ?? [];

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {i < breadcrumbs.length - 1 ? (
                <Link href={crumb.href} className="transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Hero */}
      <div className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-bold leading-tight text-burgundy-dark">{copy.h1}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{copy.ogDescription}</p>
        <Link
          href={
            parentCat
              ? `/coaches?category=${parentCat.slug}&sub=${slug}`
              : `/coaches?category=${slug}`
          }
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Browse all {label} coaches
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Body Copy */}
      <section className="mb-12 max-w-3xl">
        <div className="prose prose-neutral max-w-none text-sm leading-relaxed">
          {copy.body.split('\n\n').map((paragraph, i) => {
            // Detect bold headings: **text**
            if (paragraph.startsWith('**') && paragraph.includes('**\n')) {
              const [boldPart, ...rest] = paragraph.split('\n');
              const heading = boldPart.replace(/\*\*/g, '');
              return (
                <div key={i}>
                  <h2 className="mb-2 mt-6 text-base font-semibold text-foreground">{heading}</h2>
                  <p className="text-muted-foreground">{rest.join('\n')}</p>
                </div>
              );
            }
            // Inline bold inside paragraph
            if (paragraph.includes('**')) {
              const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i} className="mb-4 text-muted-foreground">
                  {parts.map((part, j) =>
                    part.startsWith('**') && part.endsWith('**') ? (
                      <strong key={j} className="font-semibold text-foreground">
                        {part.slice(2, -2)}
                      </strong>
                    ) : (
                      part
                    )
                  )}
                </p>
              );
            }
            return (
              <p key={i} className="mb-4 text-muted-foreground">
                {paragraph}
              </p>
            );
          })}
        </div>
      </section>

      {/* Coach Listings */}
      <section className="mb-12">
        <h2 className="mb-5 text-2xl font-bold text-foreground">
          {coaches.length > 0
            ? `${label} Coaches on Co-duck`
            : `Be the first ${label} coach on Co-duck`}
        </h2>
        {coaches.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map((coach) => (
                <CoachCard
                  key={coach.userId}
                  slug={coach.slug}
                  name={coach.name || 'Coach'}
                  avatarUrl={coach.avatarUrl}
                  headline={coach.headline}
                  specialties={coach.specialties}
                  sessionTypes={coach.sessionTypes}
                  currency={coach.currency}
                  averageRating={coach.averageRating}
                  reviewCount={coach.reviewCount}
                  isVerified={coach.verificationStatus === 'verified'}
                />
              ))}
            </div>
            {coaches.length >= 12 && (
              <div className="mt-6 text-center">
                <Link
                  href={
                    parentCat
                      ? `/coaches?category=${parentCat.slug}&sub=${slug}`
                      : `/coaches?category=${slug}`
                  }
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all {label} coaches →
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-8 text-center">
            <p className="text-muted-foreground">
              No {label} coaches listed yet. Check back soon — we&apos;re growing.
            </p>
            <Link
              href="/coaches"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Browse all coaches →
            </Link>
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="mb-12 max-w-2xl">
        <h2 className="mb-5 text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
        <FaqAccordion faqs={copy.faqs} />
      </section>

      {/* Related Sub-niches (for H&W sub-niche pages) */}
      {relatedSubNiches.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Related Health & Wellness Specialties
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedSubNiches.map((sub) => (
              <Link
                key={sub.slug}
                href={`/coaches/specialty/${sub.slug}`}
                className="rounded-full border bg-background px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {sub.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA for coaches */}
      <section className="rounded-2xl bg-muted/40 px-8 py-10 text-center">
        <h2 className="text-xl font-bold text-foreground">Are you a {label} coach?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Join Co-duck and connect with clients who are specifically looking for your expertise.
        </p>
        <Link
          href="/sign-up?role=coach"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Apply as a Coach →
        </Link>
      </section>
    </div>
  );
}
