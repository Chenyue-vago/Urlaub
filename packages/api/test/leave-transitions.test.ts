import { describe, expect, it } from "vitest";
import { makeUser, prisma } from "./helpers/factories.js";
import { cancelLeave, createLeave, decideLeave } from "../src/services/leave.js";
import { getBalance } from "../src/services/balance.js";
import { AppError } from "../src/lib/errors.js";

async function pendingGroup(userId: string, start = "2026-08-03", end = "2026-08-04") {
  return createLeave({
    actor: { id: userId, role: "member" },
    startDate: start,
    endDate: end,
    type: "statutory",
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
    expect(bal.statutory.used).toBe(2);
  });

  it("reject frees the reserved balance", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({ employmentStartDate: "2026-01-01" });
    const group = await pendingGroup(member.id);

    expect((await getBalance(prisma, member.id, 2026)).statutory.used).toBe(2);

    await decideLeave({
      actor: { id: admin.id, role: "admin" },
      groupId: group[0].groupId,
      action: "reject",
    });

    const bal = await getBalance(prisma, member.id, 2026);
    expect(bal.statutory.used).toBe(0);
    expect(bal.statutory.available).toBe(20);
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
    expect(bal.statutory.used).toBe(0);

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

  it("unknown groupId → not_found", async () => {
    const member = await makeUser({});
    await expect(
      cancelLeave({ actor: { id: member.id, role: "member" }, groupId: "does-not-exist" })
    ).rejects.toBeInstanceOf(AppError);
  });
});
