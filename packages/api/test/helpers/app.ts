import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/server.js";
import type { Authenticator, AuthIdentity } from "../../src/auth/types.js";
import type { Inviter } from "../../src/auth/inviter.js";
import type { User } from "@prisma/client";
import { prisma } from "./factories.js";

const ALLOWED_DOMAIN = "@vago-solutions.ai";

/**
 * Ensure a user's email is within the allowed domain (factories.makeUser
 * defaults to @example.com, which resolveUser's domain allowlist rejects).
 * Returns the (possibly updated) user.
 */
export async function ensureAllowedEmail(user: User): Promise<User> {
  if (user.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) return user;
  return prisma.user.update({
    where: { id: user.id },
    data: { email: `${user.clerkId}${ALLOWED_DOMAIN}` },
  });
}

/** Fake authenticator: bearer token is looked up verbatim in a map. */
export function fakeAuthenticator(identities: Record<string, AuthIdentity>): Authenticator {
  return {
    async authenticate(token: string): Promise<AuthIdentity> {
      const identity = identities[token];
      if (!identity) throw new Error("unknown test token");
      return identity;
    },
  };
}

/** Fake inviter that just records every email/role it was asked to invite. */
export class FakeInviter implements Inviter {
  invited: { email: string; role?: string }[] = [];
  async invite(email: string, opts: { role?: string } = {}): Promise<void> {
    this.invited.push({ email, role: opts.role });
  }
}

/**
 * Build a real app wired with a fake authenticator that maps `user.id` (used
 * as the bearer token) to that user's identity, plus a fake inviter. Every
 * user passed in must already have a distinct email (factories.makeUser
 * gives each a unique one).
 */
export async function buildTestApp(
  users: User[],
  opts: { inviter?: Inviter } = {}
): Promise<{ app: FastifyInstance; tokenFor: (user: User) => string; inviter: Inviter }> {
  const identities: Record<string, AuthIdentity> = {};
  for (const user of users) {
    const allowed = await ensureAllowedEmail(user);
    identities[user.id] = { clerkId: allowed.clerkId, email: allowed.email };
  }
  const inviter = opts.inviter ?? new FakeInviter();
  const app = buildServer({ authenticator: fakeAuthenticator(identities), inviter });
  return { app, tokenFor: (user) => user.id, inviter };
}

export function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}
