import { describe, expect, it } from "vitest";
import { makeSettings, makeUser, makeLeave, prisma } from "./helpers/factories.js";
import { createLeave } from "../src/services/leave.js";
import { getBalance } from "../src/services/balance.js";

// createLeave takes no `type` — a single 28-day pool is consumed, carry-over
// first (when the leave ends on/before the deadline), then base entitlement.
// One year-segment yields a base row and/or a carry-over row.
describe("createLeave auto-allocation (single pool)", () => {
  it("a request within the base pool produces a single non-carry-over row", async () => {
    await makeSettings({ totalDays: 28 });
    // Employment starts in the request year → no prior-year entitlement, so
    // there is zero carry-over and the request draws purely from the base pool.
    const user = await makeUser({ employmentStartDate: "2026-01-01" });

    const group = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-06-01",
      endDate: "2026-06-03", // 3 workdays
      reason: "",
    });

    expect(group).toHaveLength(1);
    expect(group[0].isCarryOver).toBe(false);
    expect(Number(group[0].workDays)).toBe(3);
  });

  it("consumes carry-over first, then base, splitting one segment into two rows", async () => {
    // Entitlement is a single 28-day pool read from global settings for every
    // year, so to carry exactly 2 days into 2026 we USE 26 of 2025's 28.
    await makeSettings({ totalDays: 28, carryOverDeadline: "12-31" });
    const user = await makeUser({ employmentStartDate: "2020-01-01" });
    await makeLeave({
      userId: user.id,
      start: "2025-06-02",
      end: "2025-06-02",
      status: "approved",
      workDays: 26, // 28 entitlement − 26 used → 2 unused carry into 2026
      year: 2025,
    });

    const before = await getBalance(prisma, user.id, 2026);
    expect(before.carryOver).toBe(2); // 2025's 2 unused days

    const group = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-11", // 5 clean workdays: 2 carry-over + 3 base
      reason: "",
    });

    const rows = group
      .map((r) => ({ isCarryOver: r.isCarryOver, days: Number(r.workDays) }))
      .sort((a, b) => Number(b.isCarryOver) - Number(a.isCarryOver));
    expect(rows).toEqual([
      { isCarryOver: true, days: 2 },
      { isCarryOver: false, days: 3 },
    ]);
    // all rows share one groupId
    expect(new Set(group.map((r) => r.groupId)).size).toBe(1);
  });

  it("does not consume carry-over when the leave ends after the deadline", async () => {
    await makeSettings({ totalDays: 2, carryOverDeadline: "06-30" });
    const user = await makeUser({ employmentStartDate: "2020-01-01" });
    await makeLeave({
      userId: user.id,
      start: "2025-06-02",
      end: "2025-06-02",
      status: "approved",
      workDays: 0,
      year: 2025,
    });
    await makeSettings({ totalDays: 28, carryOverDeadline: "06-30" });

    const group = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-09", // 3 workdays, after the 06-30 deadline
      reason: "",
    });

    // All from base — no carry-over row despite carry-over being available.
    expect(group.every((r) => r.isCarryOver === false)).toBe(true);
  });

  it("insufficient balance -> throws insufficient_balance, nothing created", async () => {
    await makeSettings({ totalDays: 3 });
    // Employment starts in the request year → no carry-over, so the only
    // capacity is the 3-day base pool.
    const user = await makeUser({ employmentStartDate: "2026-01-01" });

    await expect(
      createLeave({
        actor: { id: user.id, role: "member" },
        startDate: "2026-06-01",
        endDate: "2026-06-08", // ~6 workdays > 3
        reason: "",
      })
    ).rejects.toMatchObject({ code: "insufficient_balance", status: 409 });

    expect(await prisma.leaveRequest.count()).toBe(0);
  });
});
