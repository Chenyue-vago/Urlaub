import * as Sentry from '@sentry/react';

/**
 * Initialise Sentry error + performance tracking for the web app.
 *
 * No-ops when VITE_SENTRY_DSN is unset (local dev, tests, CI) so those never
 * talk to Sentry. The DSN is inlined at build time by Vite, so the Pages build
 * must have VITE_SENTRY_DSN set as a repo secret/variable to be active.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    integrations: [Sentry.browserTracingIntegration()],
    // Performance tracing sample rate — 100% is fine at 10 users.
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
  });
}

export { Sentry };
