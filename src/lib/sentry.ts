import * as Sentry from "@sentry/nextjs";

export function captureApiError(error: unknown, context?: Record<string, unknown>) {
  console.error("[API Error]", error);
  if (context) {
    Sentry.setContext("api", context);
  }
  Sentry.captureException(error);
}
