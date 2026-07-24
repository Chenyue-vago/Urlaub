import { describe, expect, it } from "vitest";
import { makeSettings, makeUser, prisma } from "./helpers/factories.js";
import { createLeave } from "../src/services/leave.js";

// A user must not be able to book the same day off twice. createLeave rejects a
// request whose date range intersects an existing pending/approved request for
// the same user. Rejected/cancelled requests free their dates for re-use.
describe("createLeave overlap guard", () => {
  async function member() {
    await makeSettings({ statutoryDays: 30, contractualDays: 10 });
    return makeUser({ employmentStartDate: "2020-01-01" });
  }

  it("rejects a request fully inside an existing pending request", async () => {
    const user = await member();
    await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-08-10",
      endDate: "2026-08-21",
      reason: "big trip",
    });

    await expect(
      createLeave({
        actor: { id: user.id, role: "member" },
        startDate: "2026-08-17",
        endDate: "2026-08-21",
        reason: "overlaps",
      })
    ).rejects.toMatchObject({ code: "overlapping_request", status: 409 });

    // the overlapping second request created nothing
    const rows = await prisma.leaveRequest.findMany({ where: { userId: user.id } });
    expect(new Set(rows.map((r) => r.groupId)).size).toBe(1);
  });

  it("rejects partial overlap and shared-boundary overlap", async () => {
    const user = await member();
    await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-11",
      reason: "week A",
    });

    // partial: starts inside the existing range
    await expect(
      createLeave({
        actor: { id: user.id, role: "member" },
        startDate: "2026-09-10",
        endDate: "2026-09-15",
        reason: "partial",
      })
    ).rejects.toMatchObject({ code: "overlapping_request" });

    // shared boundary day (existing ends 09-11, new starts 09-11)
    await expect(
      createLeave({
        actor: { id: user.id, role: "member" },
        startDate: "2026-09-11",
        endDate: "2026-09-14",
        reason: "touches boundary",
      })
    ).rejects.toMatchObject({ code: "overlapping_request" });
  });

  it("allows an adjacent, non-overlapping request", async () => {
    const user = await member();
    await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-11", // Mon–Fri
      reason: "week A",
    });

    // next Monday onward — no shared day
    const second = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-09-14",
      endDate: "2026-09-18",
      reason: "week B",
    });
    expect(second.length).toBeGreaterThan(0);
  });

  it("allows re-booking dates freed by a rejected/cancelled request", async () => {
    const user = await member();
    const first = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-11",
      reason: "will be cancelled",
    });
    // cancel it -> dates freed
    await prisma.leaveRequest.updateMany({
      where: { groupId: first[0].groupId },
      data: { status: "cancelled" },
    });

    const again = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-11",
      reason: "reuse freed dates",
    });
    expect(again.length).toBeGreaterThan(0);
  });

  it("does not treat a DIFFERENT user's overlapping leave as a conflict", async () => {
    const a = await member();
    const b = await makeUser({ employmentStartDate: "2020-01-01" });
    await createLeave({
      actor: { id: a.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-11",
      reason: "user A",
    });
    const bLeave = await createLeave({
      actor: { id: b.id, role: "member" },
      startDate: "2026-09-07",
      endDate: "2026-09-11",
      reason: "user B same dates",
    });
    expect(bLeave.length).toBeGreaterThan(0);
  });
});
