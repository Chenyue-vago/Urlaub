import { createClerkClient, verifyToken } from "@clerk/backend";
import { AppError } from "../lib/errors.js";
import { env } from "../env.js";
import type { AuthIdentity, Authenticator } from "./types.js";

/**
 * Verifies a Clerk session token and resolves it to a stable identity
 * (clerkId + primary email). Session tokens don't carry the email claim by
 * default, so a second call to the Clerk backend API fetches the user.
 */
export class ClerkAuthenticator implements Authenticator {
  async authenticate(bearerToken: string): Promise<AuthIdentity> {
    if (!bearerToken) {
      throw new AppError("Unauthenticated", "unauthenticated", 401);
    }

    let clerkId: string;
    try {
      const payload = await verifyToken(bearerToken, { secretKey: env.CLERK_SECRET_KEY });
      if (!payload.sub) {
        throw new Error("token payload missing sub");
      }
      clerkId = payload.sub;
    } catch {
      throw new AppError("Unauthenticated", "unauthenticated", 401);
    }

    try {
      const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
      const user = await clerkClient.users.getUser(clerkId);
      const primaryEmail = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress;
      const email = primaryEmail ?? user.emailAddresses[0]?.emailAddress;
      if (!email) {
        throw new Error("clerk user has no email address");
      }
      return { clerkId, email };
    } catch {
      throw new AppError("Unauthenticated", "unauthenticated", 401);
    }
  }
}
