/**
 * @fileoverview Dynamic Sitemap Generator
 *
 * Generates sitemap.xml for search engine indexing.
 * Includes static pages and all published coach profiles.
 *
 * @module app/sitemap
 */

import { MetadataRoute } from 'next';
import { db } from '@/db';
import { coachProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/coaches`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/specialties`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Dynamic coach profile pages
  let coachPages: MetadataRoute.Sitemap = [];
  try {
    const coaches = await db
      .select({ slug: coachProfiles.slug, updatedAt: coachProfiles.updatedAt })
      .from(coachProfiles)
      .where(eq(coachProfiles.isPublished, true));

    coachPages = coaches.map((coach) => ({
      url: `${BASE_URL}/coaches/${coach.slug}`,
      lastModified: coach.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error('Error generating sitemap coach pages:', error);
  }

  return [...staticPages, ...coachPages];
}
