import { expect, test } from "vitest";
import { ClerkAuthenticator } from "../src/auth/clerk.js";
import type { Authenticator, AuthIdentity } from "../src/auth/types.js";

test("ClerkAuthenticator throws unauthenticated on a malformed token", async () => {
  const authenticator = new ClerkAuthenticator();
  await expect(authenticator.authenticate("not-a-real-token")).rejects.toMatchObject({
    code: "unauthenticated",
    status: 401,
  });
});

test("ClerkAuthenticator throws unauthenticated on an empty token", async () => {
  const authenticator = new ClerkAuthenticator();
  await expect(authenticator.authenticate("")).rejects.toMatchObject({
    code: "unauthenticated",
    status: 401,
  });
});

test("fake authenticator shape satisfies the Authenticator interface", async () => {
  const fake: Authenticator = {
    async authenticate(token: string): Promise<AuthIdentity> {
      return { clerkId: `clerk_${token}`, email: `${token}@vago-solutions.ai` };
    },
  };
  const identity = await fake.authenticate("abc");
  expect(identity).toEqual({ clerkId: "clerk_abc", email: "abc@vago-solutions.ai" });
});
