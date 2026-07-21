import { describe, expect, it } from "vitest";
import { makeUser, makeLeave } from "./helpers/factories.js";
import { buildTestApp, bearer } from "./helpers/app.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * These lock the HTTP wire shape against @urlaub/shared's DTOs: exact key sets,
 * date-only fields as "YYYY-MM-DD" (not full timestamps), and workDays as a
 * number. A field rename on either side would fail here (and at compile time).
 */
describe("wire contracts", () => {
  it("GET /me matches MeDTO (employmentStartDate is date-only)", async () => {
    const user = await makeUser({ employmentStartDate: "2020-03-15", displayName: "Zoe" });
    const { app, tokenFor } = await buildTestApp([user]);
    const res = await app.inject({ method: "GET", url: "/me", headers: bearer(tokenFor(user)) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual(
      [
        "clerkId",
        "createdAt",
        "displayName",
        "email",
        "employmentStartDate",
        "id",
        "isActive",
        "region",
        "role",
      ].sort()
    );
    expect(body.employmentStartDate).toMatch(ISO_DATE);
    expect(body.createdAt).toMatch(ISO_TS);
  });

  it("GET /leave-requests rows are LeaveRequestDTO (date-only dates, numeric workDays)", async () => {
    const user = await makeUser({});
    const { app, tokenFor } = await buildTestApp([user]);
    await makeLeave({ userId: user.id, start: "2026-06-01", end: "2026-06-03", status: "approved" });

    const res = await app.inject({
      method: "GET",
      url: "/leave-requests?year=2026",
      headers: bearer(tokenFor(user)),
    });
    expect(res.statusCode).toBe(200);
    const [row] = res.json();
    expect(row.startDate).toMatch(ISO_DATE);
    expect(row.endDate).toMatch(ISO_DATE);
    expect(typeof row.workDays).toBe("number");
    expect(row.createdAt).toMatch(ISO_TS);
  });

  it("GET /calendar entries are CalendarEntryDTO (userDisplayName + date-only)", async () => {
    const user = await makeUser({ displayName: "Cal Person" });
    const { app, tokenFor } = await buildTestApp([user]);
    await makeLeave({ userId: user.id, start: "2026-06-01", end: "2026-06-03", status: "approved" });

    const res = await app.inject({
      method: "GET",
      url: "/calendar?from=2026-05-01&to=2026-07-01",
      headers: bearer(tokenFor(user)),
    });
    expect(res.statusCode).toBe(200);
    const [entry] = res.json();
    expect(Object.keys(entry).sort()).toEqual(
      ["endDate", "id", "startDate", "status", "type", "userDisplayName", "userId"].sort()
    );
    expect(entry.userDisplayName).toBe("Cal Person");
    expect(entry.startDate).toMatch(ISO_DATE);
    expect(entry.endDate).toMatch(ISO_DATE);
  });

  it("GET /admin/audit-log is AuditLogPageDTO ({ items, nextCursor })", async () => {
    const admin = await makeUser({ role: "admin" });
    const { app, tokenFor } = await buildTestApp([admin]);
    await app.inject({
      method: "PATCH",
      url: "/settings",
      headers: bearer(tokenFor(admin)),
      payload: { statutoryDays: 21 },
    });

    const res = await app.inject({
      method: "GET",
      url: "/admin/audit-log",
      headers: bearer(tokenFor(admin)),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual(["items", "nextCursor"].sort());
    expect(Array.isArray(body.items)).toBe(true);
    const [entry] = body.items;
    expect(Object.keys(entry).sort()).toEqual(
      ["action", "actorId", "createdAt", "id", "metadata", "targetId", "targetType"].sort()
    );
    expect(entry.createdAt).toMatch(ISO_TS);
  });
});
