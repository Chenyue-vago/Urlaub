import { describe, expect, it } from "vitest";
import { makeLeave, makeSettings, makeUser, prisma } from "./helpers/factories.js";
import { cancelLeave, createLeave, decideLeave } from "../src/services/leave.js";
import { getBalance } from "../src/services/balance.js";
import { AppError } from "../src/lib/errors.js";

// Transition tests assert against the single 28-day pool; pin totalDays:20 for
// stable arithmetic.
//
// Default dates are computed RELATIVE to today so the group is always in the
// future: members may only cancel a vacation that has not started yet
// (leave.ts), so a hard-coded date silently turns into a "cannot cancel a
// started vacation" failure once real time passes it — a time-bomb that broke
// CI on 2026-08-04. Keep these dynamic.
function isoDaysFromToday(days: number): string {
  const d = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function pendingGroup(
  userId: string,
  start = isoDaysFromToday(30),
  end = isoDaysFromToday(31)
) {
  await makeSettings({ totalDays: 20 });
  return createLeave({
    actor: { id: userId, role: "member" },
    startDate: start,
    endDate: end,
    reason: "trip",
  });
}

describe("decideLeave", () => {
  it("admin approve sets whole group approved and it still counts", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);

    const decided = await decideLeave({
      actor: { id: admin.id, role: "admin" },
      groupId: group[0].groupId,
      action: "approve",
      note: "ok",
    });

    expect(decided.every((r) => r.status === "approved")).toBe(true);
    expect(decided.every((r) => r.decidedById === admin.id)).toBe(true);
    expect(decided.every((r) => r.decisionNote === "ok")).toBe(true);

    // approving frees nothing — the days still count as used
    const bal = await getBalance(prisma, member.id, 2026);
    expect(bal.used).toBe(2);
  });

  it("reject frees the reserved balance", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);

    expect((await getBalance(prisma, member.id, 2026)).used).toBe(2);

    await decideLeave({
      actor: { id: admin.id, role: "admin" },
      groupId: group[0].groupId,
      action: "reject",
    });

    const bal = await getBalance(prisma, member.id, 2026);
    expect(bal.used).toBe(0);
    expect(bal.available).toBe(20);
  });

  it("member cannot approve → forbidden", async () => {
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);
    await expect(
      decideLeave({
        actor: { id: member.id, role: "member" },
        groupId: group[0].groupId,
        action: "approve",
      })
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  it("cannot approve an already-approved group → invalid_transition", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);
    const gid = group[0].groupId;
    const actor = { id: admin.id, role: "admin" as const };

    await decideLeave({ actor, groupId: gid, action: "approve" });
    await expect(
      decideLeave({ actor, groupId: gid, action: "approve" })
    ).rejects.toMatchObject({ code: "invalid_transition", status: 409 });
  });

  it("writes an audit row per decision", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);
    await decideLeave({
      actor: { id: admin.id, role: "admin" },
      groupId: group[0].groupId,
      action: "approve",
    });
    const audit = await prisma.auditLog.findMany({ where: { action: "approve_leave" } });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorId).toBe(admin.id);
    expect(audit[0].targetId).toBe(group[0].groupId);
  });
});

describe("cancelLeave", () => {
  it("member cancels own pending future group → cancelled, balance freed", async () => {
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);

    const cancelled = await cancelLeave({
      actor: { id: member.id, role: "member" },
      groupId: group[0].groupId,
    });
    expect(cancelled.every((r) => r.status === "cancelled")).toBe(true);

    const bal = await getBalance(prisma, member.id, 2026);
    expect(bal.used).toBe(0);

    const audit = await prisma.auditLog.findMany({ where: { action: "cancel_leave" } });
    expect(audit).toHaveLength(1);
  });

  it("member cannot cancel another member's group → forbidden", async () => {
    const owner = await makeUser({ employmentStartDate: "2026-01-01" });
    const other = await makeUser({});
    const group = await pendingGroup(owner.id);
    await expect(
      cancelLeave({ actor: { id: other.id, role: "member" }, groupId: group[0].groupId })
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  it("admin can cancel any group", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);
    const cancelled = await cancelLeave({
      actor: { id: admin.id, role: "admin" },
      groupId: group[0].groupId,
    });
    expect(cancelled.every((r) => r.status === "cancelled")).toBe(true);
  });

  it("cannot cancel an already-cancelled group → invalid_transition", async () => {
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);
    const actor = { id: member.id, role: "member" as const };
    await cancelLeave({ actor, groupId: group[0].groupId });
    await expect(
      cancelLeave({ actor, groupId: group[0].groupId })
    ).rejects.toMatchObject({ code: "invalid_transition", status: 409 });
  });

  it("member cannot cancel leave that has already ended → invalid_transition", async () => {
    const member = await makeUser({ employmentStartDate: "2019-01-01" });
    // A vacation entirely in the past.
    const group = await pendingGroup(member.id, "2020-03-02", "2020-03-06");
    await expect(
      cancelLeave({ actor: { id: member.id, role: "member" }, groupId: group[0].groupId })
    ).rejects.toMatchObject({ code: "invalid_transition", status: 409 });
  });

  it("member cannot cancel a vacation that has already STARTED (ongoing) → invalid_transition", async () => {
    const member = await makeUser({ employmentStartDate: "2019-01-01" });
    // Started yesterday, still ongoing -> must be locked. Insert directly so
    // the balance check doesn't interfere with the guard we're testing.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const row = await makeLeave({ userId: member.id, start: yesterday, end: tomorrow, status: "approved" });
    await expect(
      cancelLeave({ actor: { id: member.id, role: "member" }, groupId: row.groupId })
    ).rejects.toMatchObject({ code: "invalid_transition", status: 409 });
  });

  it("member CAN cancel a vacation that starts in the future", async () => {
    const member = await makeUser({ employmentStartDate: "2019-01-01" });
    const group = await pendingGroup(member.id, "2099-03-02", "2099-03-06");
    const rows = await cancelLeave({ actor: { id: member.id, role: "member" }, groupId: group[0].groupId });
    expect(rows.every((r) => r.status === "cancelled")).toBe(true);
  });

  it("unknown groupId → not_found", async () => {
    const member = await makeUser({});
    await expect(
      cancelLeave({ actor: { id: member.id, role: "member" }, groupId: "does-not-exist" })
    ).rejects.toBeInstanceOf(AppError);
  });
});
