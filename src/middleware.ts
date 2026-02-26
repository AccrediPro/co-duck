import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  resolveMiddlewareRateLimit,
  rateLimitByIp,
  extractIp,
} from '@/lib/rate-limit';

// Define routes that require authentication
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Rate-limit all API routes before any further processing
  if (req.nextUrl.pathname.startsWith('/api')) {
    const { config, prefix } = resolveMiddlewareRateLimit(req.nextUrl.pathname);
    const ip = extractIp(req, req.ip);
    const result = rateLimitByIp(ip, config, prefix);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: result.message,
          },
        },
        { status: 429, headers: result.headers }
      );
    }
  }

  // Protect dashboard routes - require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
