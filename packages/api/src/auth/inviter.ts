import { createClerkClient } from "@clerk/backend";
import { env } from "../env.js";

export interface Inviter {
  /** Send a Clerk invitation email to the given address. */
  invite(email: string, opts?: { role?: string }): Promise<void>;
}

declare module "fastify" {
  interface FastifyInstance {
    inviter: Inviter;
  }
}

/**
 * Real, Clerk-backed inviter. We deliberately do NOT create a local `users`
 * row here: the local row's `clerkId` is only known once the invitee actually
 * signs in via Clerk, at which point `resolveUser` (auth/context.ts) creates
 * it as `member` on first login. Pre-creating a row keyed by email would risk
 * drifting from the eventual clerkId and duplicating the "first login"
 * bootstrap logic. If the invited user should be an admin, promote them via
 * `PATCH /admin/users/:id` after their first login creates the row.
 */
export class ClerkInviter implements Inviter {
  async invite(email: string, opts: { role?: string } = {}): Promise<void> {
    const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    await clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: opts.role ? { role: opts.role } : undefined,
    });
  }
}
