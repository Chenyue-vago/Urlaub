import { describe, expect, it } from "vitest";
import { makeUser } from "./helpers/factories.js";
import { buildTestApp, bearer } from "./helpers/app.js";

describe("GET /balance", () => {
  it("member self ok", async () => {
    const member = await makeUser({ employmentStartDate: "2025-01-01" });
    const { app, tokenFor } = await buildTestApp([member]);
    const res = await app.inject({
      method: "GET",
      url: "/balance?year=2025",
      headers: bearer(tokenFor(member)),
    });
    expect(res.statusCode).toBe(200);
    // The HTTP contract is the shared flat YearlyVacationStats shape (what the
    // web StatsCards consumes), not the service's internal nested Balance.
    const body = res.json();
    expect(body.statutory).toBeUndefined();
    expect(body.statutoryTotal).toBe(20);
    expect(body.statutoryUsed).toBe(0);
    expect(body.statutoryRemaining).toBe(20);
    expect(body.contractualTotal).toBe(8);
    expect(body.carryOver).toBe(0);
  });

  it("member requesting another user's balance -> forbidden", async () => {
    const member = await makeUser({});
    const other = await makeUser({});
    const { app, tokenFor } = await buildTestApp([member, other]);
    const res = await app.inject({
      method: "GET",
      url: `/balance?userId=${other.id}`,
      headers: bearer(tokenFor(member)),
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can query any user's balance", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({ employmentStartDate: "2025-01-01" });
    const { app, tokenFor } = await buildTestApp([admin, member]);
    const res = await app.inject({
      method: "GET",
      url: `/balance?userId=${member.id}&year=2025`,
      headers: bearer(tokenFor(admin)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().statutoryTotal).toBe(20);
  });
});
