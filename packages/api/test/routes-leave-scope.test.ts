import { describe, expect, it } from "vitest";
import { makeSettings, makeUser, makeLeave } from "./helpers/factories.js";
import { buildTestApp, bearer } from "./helpers/app.js";

// GET /leave-requests scoping. The default must be SAFE: an admin viewing their
// own dashboard (no userId) sees only their own rows — not everyone's. Listing
// all users' rows for approvals is opt-in via the explicit userId=all sentinel.
describe("GET /leave-requests scoping", () => {
  async function seed() {
    await makeSettings({});
    const member = await makeUser({ employmentStartDate: "2020-01-01" });
    const admin = await makeUser({ role: "admin", employmentStartDate: "2020-01-01" });
    await makeLeave({ userId: member.id, start: "2026-08-10", end: "2026-08-14", status: "approved", year: 2026 });
    await makeLeave({ userId: admin.id, start: "2026-09-07", end: "2026-09-09", status: "approved", year: 2026 });
    return { member, admin };
  }

  it("admin with NO userId sees only their OWN rows (no leak)", async () => {
    const { member, admin } = await seed();
    const { app, tokenFor } = await buildTestApp([member, admin]);

    const res = await app.inject({
      method: "GET",
      url: "/leave-requests?year=2026",
      headers: bearer(tokenFor(admin)),
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows.every((r: any) => r.userId === admin.id)).toBe(true);
    expect(rows.some((r: any) => r.userId === member.id)).toBe(false);
  });

  it("admin with userId=all sees everyone's rows (for approvals)", async () => {
    const { member, admin } = await seed();
    const { app, tokenFor } = await buildTestApp([member, admin]);

    const res = await app.inject({
      method: "GET",
      url: "/leave-requests?userId=all",
      headers: bearer(tokenFor(admin)),
    });
    expect(res.statusCode).toBe(200);
    const owners = new Set(res.json().map((r: any) => r.userId));
    expect(owners.has(member.id)).toBe(true);
    expect(owners.has(admin.id)).toBe(true);
  });

  it("admin with an explicit userId sees only that user's rows", async () => {
    const { member, admin } = await seed();
    const { app, tokenFor } = await buildTestApp([member, admin]);

    const res = await app.inject({
      method: "GET",
      url: `/leave-requests?userId=${member.id}`,
      headers: bearer(tokenFor(admin)),
    });
    const rows = res.json();
    expect(rows.every((r: any) => r.userId === member.id)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("member with userId=all still only sees their own rows (no privilege escalation)", async () => {
    const { member, admin } = await seed();
    const { app, tokenFor } = await buildTestApp([member, admin]);

    const res = await app.inject({
      method: "GET",
      url: "/leave-requests?userId=all",
      headers: bearer(tokenFor(member)),
    });
    const rows = res.json();
    expect(rows.every((r: any) => r.userId === member.id)).toBe(true);
    expect(rows.some((r: any) => r.userId === admin.id)).toBe(false);
  });
});
