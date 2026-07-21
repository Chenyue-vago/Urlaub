import { describe, expect, it } from "vitest";
import { makeUser, prisma } from "./helpers/factories.js";
import { buildTestApp, bearer, FakeInviter } from "./helpers/app.js";

describe("admin routes", () => {
  it("PATCH /admin/users/:id last-admin guard -> 409 last_admin (demote and deactivate)", async () => {
    const admin = await makeUser({ role: "admin" });
    const { app, tokenFor } = await buildTestApp([admin]);

    const demote = await app.inject({
      method: "PATCH",
      url: `/admin/users/${admin.id}`,
      headers: bearer(tokenFor(admin)),
      payload: { role: "member" },
    });
    expect(demote.statusCode).toBe(409);
    expect(demote.json().code).toBe("last_admin");

    const deactivate = await app.inject({
      method: "PATCH",
      url: `/admin/users/${admin.id}`,
      headers: bearer(tokenFor(admin)),
      payload: { isActive: false },
    });
    expect(deactivate.statusCode).toBe(409);
    expect(deactivate.json().code).toBe("last_admin");
  });

  it("allows demoting an admin when another active admin remains", async () => {
    const admin1 = await makeUser({ role: "admin" });
    const admin2 = await makeUser({ role: "admin" });
    const { app, tokenFor } = await buildTestApp([admin1, admin2]);

    const res = await app.inject({
      method: "PATCH",
      url: `/admin/users/${admin1.id}`,
      headers: bearer(tokenFor(admin2)),
      payload: { role: "member" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("member");

    const audit = await prisma.auditLog.findMany({ where: { action: "change_role" } });
    expect(audit).toHaveLength(1);
  });

  it("PATCH /settings admin only; carryOverDeadline format validation", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({});
    const { app, tokenFor } = await buildTestApp([admin, member]);

    const memberRes = await app.inject({
      method: "PATCH",
      url: "/settings",
      headers: bearer(tokenFor(member)),
      payload: { statutoryDays: 25 },
    });
    expect(memberRes.statusCode).toBe(403);

    const badFormat = await app.inject({
      method: "PATCH",
      url: "/settings",
      headers: bearer(tokenFor(admin)),
      payload: { carryOverDeadline: "13-99-00" },
    });
    expect(badFormat.statusCode).toBe(400);

    const good = await app.inject({
      method: "PATCH",
      url: "/settings",
      headers: bearer(tokenFor(admin)),
      payload: { carryOverDeadline: "06-30", statutoryDays: 25 },
    });
    expect(good.statusCode).toBe(200);
    expect(good.json().carryOverDeadline).toBe("06-30");
    expect(good.json().statutoryDays).toBe(25);
  });

  it("GET /settings readable by a member", async () => {
    const member = await makeUser({});
    const { app, tokenFor } = await buildTestApp([member]);
    const res = await app.inject({
      method: "GET",
      url: "/settings",
      headers: bearer(tokenFor(member)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().statutoryDays).toBe(20);
  });

  it("POST /admin/users/invite calls the fake inviter; non-admin -> 403", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({});
    const inviter = new FakeInviter();
    const { app, tokenFor } = await buildTestApp([admin, member], { inviter });

    const forbiddenRes = await app.inject({
      method: "POST",
      url: "/admin/users/invite",
      headers: bearer(tokenFor(member)),
      payload: { email: "newperson@vago-solutions.ai" },
    });
    expect(forbiddenRes.statusCode).toBe(403);

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/invite",
      headers: bearer(tokenFor(admin)),
      payload: { email: "newperson@vago-solutions.ai" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ invited: "newperson@vago-solutions.ai" });
    expect(inviter.invited).toEqual([{ email: "newperson@vago-solutions.ai", role: undefined }]);
  });

  it("POST /admin/users/invite rejects a non-allowed email domain", async () => {
    const admin = await makeUser({ role: "admin" });
    const { app, tokenFor } = await buildTestApp([admin]);
    const res = await app.inject({
      method: "POST",
      url: "/admin/users/invite",
      headers: bearer(tokenFor(admin)),
      payload: { email: "someone@gmail.com" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /admin/users lists users with usage; non-admin -> 403", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({});
    const { app, tokenFor } = await buildTestApp([admin, member]);

    const forbiddenRes = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: bearer(tokenFor(member)),
    });
    expect(forbiddenRes.statusCode).toBe(403);

    const res = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: bearer(tokenFor(admin)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBe(2);
    expect(res.json()[0].usage).toBeDefined();
  });

  it("GET /admin/audit-log is paginated, newest first, admin only", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({});
    const { app, tokenFor } = await buildTestApp([admin, member]);

    const forbiddenRes = await app.inject({
      method: "GET",
      url: "/admin/audit-log",
      headers: bearer(tokenFor(member)),
    });
    expect(forbiddenRes.statusCode).toBe(403);

    await app.inject({
      method: "PATCH",
      url: "/settings",
      headers: bearer(tokenFor(admin)),
      payload: { statutoryDays: 22 },
    });
    await app.inject({
      method: "PATCH",
      url: "/settings",
      headers: bearer(tokenFor(admin)),
      payload: { statutoryDays: 23 },
    });

    const res = await app.inject({
      method: "GET",
      url: "/admin/audit-log?limit=1",
      headers: bearer(tokenFor(admin)),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].metadata.statutoryDays).toBe(23);
    expect(body.nextCursor).toBeTruthy();
  });
});
