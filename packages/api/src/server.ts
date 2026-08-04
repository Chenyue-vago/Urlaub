import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { Sentry, initSentry } from "./sentry.js";
import { registerErrorHandler } from "./lib/errors.js";
import { ClerkAuthenticator } from "./auth/clerk.js";
import type { Authenticator } from "./auth/types.js";
import { ClerkInviter, type Inviter } from "./auth/inviter.js";
import { meRoutes } from "./routes/me.js";
import { leaveRoutes } from "./routes/leave.js";
import { balanceRoutes } from "./routes/balance.js";
import { calendarRoutes } from "./routes/calendar.js";
import { adminRoutes } from "./routes/admin.js";

export interface BuildServerOptions {
  authenticator?: Authenticator;
  inviter?: Inviter;
}

export function buildServer(opts: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: env.WEB_ORIGIN });

  app.decorate("authenticator", opts.authenticator ?? new ClerkAuthenticator());
  app.decorate("inviter", opts.inviter ?? new ClerkInviter());

  // When Sentry is initialised (real startup with a DSN), let it capture
  // unhandled errors before our own handler turns them into a 500 response.
  if (env.SENTRY_DSN) {
    Sentry.setupFastifyErrorHandler(app);
  }
  registerErrorHandler(app);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(meRoutes);
  app.register(leaveRoutes);
  app.register(balanceRoutes);
  app.register(calendarRoutes);
  app.register(adminRoutes);

  return app;
}

export async function start(): Promise<void> {
  initSentry(); // before buildServer so instrumentation wraps the app
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
