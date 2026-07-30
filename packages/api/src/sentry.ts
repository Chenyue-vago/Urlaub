import * as Sentry from "@sentry/node";
import { env } from "./env.js";

/**
 * Initialise Sentry error + performance tracking for the API.
 *
 * No-ops when SENTRY_DSN is unset (local dev, tests, CI) so those environments
 * never talk to Sentry and never fail for a missing DSN. Called once at real
 * startup, BEFORE the Fastify app is built, so Sentry's auto-instrumentation
 * can wrap the HTTP layer.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    // Performance tracing: sample a fraction of requests as transactions.
    // 1.0 = 100% — fine at 10 users; dial down if volume ever grows.
    tracesSampleRate: 1.0,
    // Don't send request bodies / headers that may carry tokens.
    sendDefaultPii: false,
  });
}

export { Sentry };
