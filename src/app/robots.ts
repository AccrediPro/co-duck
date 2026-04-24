/**
 * @fileoverview Robots.txt Generator
 *
 * Controls search engine crawling behavior.
 *
 * @module app/robots
 */

import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/api/', '/onboarding/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
