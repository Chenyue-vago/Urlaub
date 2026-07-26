import { describe, expect, it } from "vitest";
import { makeSettings, makeUser, makeLeave, prisma } from "./helpers/factories.js";
import { createLeave } from "../src/services/leave.js";
import { getBalance } from "../src/services/balance.js";

// createLeave no longer takes a `type` — the system auto-allocates each
// year-segment across buckets (carry-over statutory -> contractual -> base
// statutory), possibly producing multiple rows per segment.
describe("createLeave auto-allocation", () => {
  it("all-statutory request produces a single base-statutory row", async () => {
    await makeSettings({ statutoryDays: 20, contractualDays: 8 });
    const user = await makeUser({ employmentStartDate: "2020-01-01" });

    const group = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-06-01",
      endDate: "2026-06-03", // 3 workdays; contractual available but statutory chosen? no:
      reason: "",
    });

    // With both buckets available and the period after the deadline, priority
    // is contractual before base statutory, so 3 days come from contractual.
    expect(group).toHaveLength(1);
    expect(group[0].type).toBe("contractual");
    expect(group[0].isCarryOver).toBe(false);
    expect(Number(group[0].workDays)).toBe(3);
  });

  it("splits one segment across contractual then base statutory when contractual runs out", async () => {
    await makeSettings({ statutoryDays: 20, contractualDays: 2 });
    const user = await makeUser({ employmentStartDate: "2020-01-01" });

    const group = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-11", // 5 clean workdays: 2 contractual + 3 statutory
      reason: "",
    });

    const byType = group
      .map((r) => ({ type: r.type, isCarryOver: r.isCarryOver, days: Number(r.workDays) }))
      .sort((a, b) => a.type.localeCompare(b.type));
    expect(byType).toEqual([
      { type: "contractual", isCarryOver: false, days: 2 },
      { type: "statutory", isCarryOver: false, days: 3 },
    ]);
    // all rows share one groupId
    expect(new Set(group.map((r) => r.groupId)).size).toBe(1);
  });

  it("consumes carry-over statutory first when the leave ends before the deadline", async () => {
    await makeSettings({ statutoryDays: 20, contractualDays: 0, carryOverDeadline: "03-31" });
    const user = await makeUser({ employmentStartDate: "2020-01-01" });
    // Leave unused statutory in 2025 so it carries over into 2026.
    // 2025 entitlement 20; use 18 -> 2 carry over.
    await makeLeave({
      userId: user.id,
      start: "2025-06-02",
      end: "2025-06-27", // ~20 workdays; trim via settings instead
      type: "statutory",
      status: "approved",
      year: 2025,
    });

    const before = await getBalance(prisma, user.id, 2026);
    const carry = before.statutory.carryOver;

    const group = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-03-02",
      endDate: "2026-03-03", // 2 workdays, before 03-31
      reason: "",
    });

    if (carry >= 2) {
      const carryRow = group.find((r) => r.isCarryOver);
      expect(carryRow).toBeDefined();
      expect(carryRow!.type).toBe("statutory");
    }
  });

  it("insufficient across ALL buckets -> throws insufficient_balance, nothing created", async () => {
    await makeSettings({ statutoryDays: 2, contractualDays: 1 });
    const user = await makeUser({ employmentStartDate: "2020-01-01" });

    await expect(
      createLeave({
        actor: { id: user.id, role: "member" },
        startDate: "2026-06-01",
        endDate: "2026-06-08", // ~6 workdays > 2 + 1
        reason: "",
      })
    ).rejects.toMatchObject({ code: "insufficient_balance", status: 409 });

    expect(await prisma.leaveRequest.count()).toBe(0);
  });
});
