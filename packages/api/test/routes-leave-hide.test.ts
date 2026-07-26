import { describe, expect, it } from "vitest";
import { makeUser, makeLeave, prisma } from "./helpers/factories.js";
import { buildTestApp, bearer } from "./helpers/app.js";

describe("POST /leave-requests/:id/hide", () => {
  it("owner hides a cancelled request; it disappears from their list", async () => {
    const member = await makeUser({ employmentStartDate: "2020-01-01" });
    const row = await makeLeave({ userId: member.id, start: "2026-08-10", end: "2026-08-14", status: "cancelled", year: 2026 });
    const { app, tokenFor } = await buildTestApp([member]);

    const res = await app.inject({
      method: "POST",
      url: `/leave-requests/${row.id}/hide`,
      headers: bearer(tokenFor(member)),
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/leave-requests?year=2026", headers: bearer(tokenFor(member)) });
    expect(list.json()).toHaveLength(0);

    // row still exists in the DB (soft hide)
    const inDb = await prisma.leaveRequest.findMany({ where: { groupId: row.groupId } });
    expect(inDb).toHaveLength(1);
    expect(inDb[0].hiddenByUser).toBe(true);
  });

  it("hiding an approved request -> 409 invalid_transition", async () => {
    const member = await makeUser({ employmentStartDate: "2020-01-01" });
    const row = await makeLeave({ userId: member.id, start: "2026-08-10", end: "2026-08-14", status: "approved", year: 2026 });
    const { app, tokenFor } = await buildTestApp([member]);

    const res = await app.inject({
      method: "POST",
      url: `/leave-requests/${row.id}/hide`,
      headers: bearer(tokenFor(member)),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("invalid_transition");
  });

  it("a different member cannot hide someone else's request -> 403", async () => {
    const owner = await makeUser({ employmentStartDate: "2020-01-01" });
    const other = await makeUser({ employmentStartDate: "2020-01-01" });
    const row = await makeLeave({ userId: owner.id, start: "2026-08-10", end: "2026-08-14", status: "cancelled", year: 2026 });
    const { app, tokenFor } = await buildTestApp([owner, other]);

    const res = await app.inject({
      method: "POST",
      url: `/leave-requests/${row.id}/hide`,
      headers: bearer(tokenFor(other)),
    });
    expect(res.statusCode).toBe(403);
  });

  it("unknown id -> 404", async () => {
    const member = await makeUser({});
    const { app, tokenFor } = await buildTestApp([member]);
    const res = await app.inject({
      method: "POST",
      url: `/leave-requests/does-not-exist/hide`,
      headers: bearer(tokenFor(member)),
    });
    expect(res.statusCode).toBe(404);
  });
});
