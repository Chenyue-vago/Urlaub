import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { registerErrorHandler } from "./lib/errors.js";
import { ClerkAuthenticator } from "./auth/clerk.js";
import type { Authenticator } from "./auth/types.js";

export interface BuildServerOptions {
  authenticator?: Authenticator;
}

export function buildServer(opts: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: env.WEB_ORIGIN });

  app.decorate("authenticator", opts.authenticator ?? new ClerkAuthenticator());

  registerErrorHandler(app);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}

export async function start(): Promise<void> {
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
