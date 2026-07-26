import { describe, expect, it } from "vitest";
import { makeUser, prisma } from "./helpers/factories.js";
import { buildTestApp, bearer } from "./helpers/app.js";

describe("GET/PATCH /me", () => {
  it("GET /me returns the caller's own row", async () => {
    const user = await makeUser({ displayName: "Alice" });
    const { app, tokenFor } = await buildTestApp([user]);
    const res = await app.inject({ method: "GET", url: "/me", headers: bearer(tokenFor(user)) });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(user.id);
    expect(res.json().displayName).toBe("Alice");
  });

  it("PATCH /me updates region/displayName/employmentStartDate on own row only", async () => {
    const user = await makeUser({});
    const { app, tokenFor } = await buildTestApp([user]);
    const res = await app.inject({
      method: "PATCH",
      url: "/me",
      headers: bearer(tokenFor(user)),
      payload: { region: "BY", displayName: "New Name", employmentStartDate: "2020-01-01" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().region).toBe("BY");
    expect(res.json().displayName).toBe("New Name");
    expect(res.json().employmentStartDate).toContain("2020-01-01");

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row?.region).toBe("BY");
  });

  it("PATCH /me cannot change role/isActive/email/clerkId", async () => {
    const user = await makeUser({ role: "member" });
    const { app, tokenFor } = await buildTestApp([user]);
    const beforeEmail = (await prisma.user.findUnique({ where: { id: user.id } }))!.email;
    const res = await app.inject({
      method: "PATCH",
      url: "/me",
      headers: bearer(tokenFor(user)),
      payload: { role: "admin", isActive: false, email: "x@evil.com", clerkId: "hacked" },
    });
    // extra keys are simply ignored by the schema (not an error), but must
    // never actually change protected fields
    expect(res.statusCode).toBe(200);
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row?.role).toBe("member");
    expect(row?.isActive).toBe(true);
    expect(row?.email).toBe(beforeEmail);
    expect(row?.clerkId).toBe(user.clerkId);
  });
});
