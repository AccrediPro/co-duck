import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1, // 10% of transactions in production
    replaysSessionSampleRate: 0, // Disable session replay by default
    replaysOnErrorSampleRate: 1.0, // Capture replay on errors
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
  });
}
