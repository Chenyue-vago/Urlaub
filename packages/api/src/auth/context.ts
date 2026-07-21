import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import type { AuthIdentity, Authenticator } from "./types.js";

const ALLOWED_DOMAIN = "@vago-solutions.ai";

declare module "fastify" {
  interface FastifyInstance {
    authenticator: Authenticator;
  }
  interface FastifyRequest {
    user?: User;
  }
}

/**
 * Upserts the local User row for a verified Clerk identity.
 *
 * - Enforces the email domain allowlist as defense in depth (even though the
 *   Clerk instance should already restrict sign-ups to the domain).
 * - Never grants the `admin` role on creation — new users always start as
 *   `member`; promotion is a separate, explicit admin action (M5+).
 * - Rejects deactivated accounts even though their row already exists.
 */
export async function resolveUser(identity: AuthIdentity): Promise<User> {
  if (!identity.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    throw new AppError(
      "Email domain is not allowed",
      "email_domain_not_allowed",
      403
    );
  }

  const existing = await prisma.user.findUnique({ where: { clerkId: identity.clerkId } });

  const user = existing
    ? await prisma.user.update({
        where: { clerkId: identity.clerkId },
        data: { email: identity.email },
      })
    : await prisma.user.create({
        data: {
          clerkId: identity.clerkId,
          email: identity.email,
          displayName: identity.email.split("@")[0],
          role: "member",
        },
      });

  if (!user.isActive) {
    throw new AppError("Account is deactivated", "account_deactivated", 403);
  }

  return user;
}

function extractBearerToken(req: FastifyRequest): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError("Unauthenticated", "unauthenticated", 401);
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new AppError("Unauthenticated", "unauthenticated", 401);
  }
  return token;
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(req);
  const identity = await req.server.authenticator.authenticate(token);
  req.user = await resolveUser(identity);
}

export async function requireAdmin(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (req.user?.role !== "admin") {
    throw new AppError("Forbidden", "forbidden", 403);
  }
}
