import { expect, test } from "vitest";
import { buildServer } from "../src/server.js";
import { requireAdmin, requireAuth } from "../src/auth/context.js";
import { prisma, makeUser } from "./helpers/factories.js";
import type { Authenticator, AuthIdentity } from "../src/auth/types.js";

/** Fake authenticator: bearer token is looked up verbatim in a map. */
function fakeAuthenticator(identities: Record<string, AuthIdentity>): Authenticator {
  return {
    async authenticate(token: string): Promise<AuthIdentity> {
      const identity = identities[token];
      if (!identity) {
        throw new Error("unknown test token");
      }
      return identity;
    },
  };
}

function buildTestApp(authenticator: Authenticator) {
  const app = buildServer({ authenticator });
  app.get("/whoami", { preHandler: requireAuth }, async (req) => {
    return { user: req.user };
  });
  app.get("/admin-only", { preHandler: [requireAuth, requireAdmin] }, async () => {
    return { ok: true };
  });
  return app;
}

test("new allowlisted email upserts a member row", async () => {
  const app = buildTestApp(
    fakeAuthenticator({
      tok1: { clerkId: "clerk_new_1", email: "dev.new@vago-solutions.ai" },
    })
  );

  const res = await app.inject({
    method: "GET",
    url: "/whoami",
    headers: { authorization: "Bearer tok1" },
  });

  expect(res.statusCode).toBe(200);
  expect(res.json().user.role).toBe("member");

  const row = await prisma.user.findUnique({ where: { clerkId: "clerk_new_1" } });
  expect(row).not.toBeNull();
  expect(row?.role).toBe("member");
  expect(row?.email).toBe("dev.new@vago-solutions.ai");
});

test("email outside allowed domain is rejected, no row created", async () => {
  const app = buildTestApp(
    fakeAuthenticator({
      tok1: { clerkId: "clerk_outside", email: "x@gmail.com" },
    })
  );

  const res = await app.inject({
    method: "GET",
    url: "/whoami",
    headers: { authorization: "Bearer tok1" },
  });

  expect(res.statusCode).toBe(403);
  expect(res.json().code).toBe("email_domain_not_allowed");

  const row = await prisma.user.findUnique({ where: { clerkId: "clerk_outside" } });
  expect(row).toBeNull();
});

test("domain check is case-insensitive", async () => {
  const app = buildTestApp(
    fakeAuthenticator({
      tok1: { clerkId: "clerk_case", email: "Dev.Case@VAGO-SOLUTIONS.AI" },
    })
  );

  const res = await app.inject({
    method: "GET",
    url: "/whoami",
    headers: { authorization: "Bearer tok1" },
  });

  expect(res.statusCode).toBe(200);
});

test("deactivated user is rejected", async () => {
  const existing = await makeUser({ role: "member" });
  const email = "dev.deactivated@vago-solutions.ai";
  await prisma.user.update({ where: { id: existing.id }, data: { isActive: false, email } });

  const app = buildTestApp(
    fakeAuthenticator({
      tok1: { clerkId: existing.clerkId, email },
    })
  );

  const res = await app.inject({
    method: "GET",
    url: "/whoami",
    headers: { authorization: "Bearer tok1" },
  });

  expect(res.statusCode).toBe(403);
  expect(res.json().code).toBe("account_deactivated");
});

test("missing Authorization header is unauthenticated", async () => {
  const app = buildTestApp(fakeAuthenticator({}));
  const res = await app.inject({ method: "GET", url: "/whoami" });
  expect(res.statusCode).toBe(401);
  expect(res.json().code).toBe("unauthenticated");
});

test("requireAdmin: member is forbidden, admin is allowed", async () => {
  const member = await makeUser({ role: "member" });
  const admin = await makeUser({ role: "admin" });
  const memberEmail = "dev.member@vago-solutions.ai";
  const adminEmail = "dev.admin@vago-solutions.ai";
  await prisma.user.update({ where: { id: member.id }, data: { email: memberEmail } });
  await prisma.user.update({ where: { id: admin.id }, data: { email: adminEmail } });

  const app = buildTestApp(
    fakeAuthenticator({
      member_tok: { clerkId: member.clerkId, email: memberEmail },
      admin_tok: { clerkId: admin.clerkId, email: adminEmail },
    })
  );

  const memberRes = await app.inject({
    method: "GET",
    url: "/admin-only",
    headers: { authorization: "Bearer member_tok" },
  });
  expect(memberRes.statusCode).toBe(403);
  expect(memberRes.json().code).toBe("forbidden");

  const adminRes = await app.inject({
    method: "GET",
    url: "/admin-only",
    headers: { authorization: "Bearer admin_tok" },
  });
  expect(adminRes.statusCode).toBe(200);
});
