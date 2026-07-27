import { describe, expect, it } from "vitest";
import { makeSettings, makeUser, makeLeave, prisma } from "./helpers/factories.js";
import { decideLeave, cancelLeave } from "../src/services/leave.js";

// Audit rows for leave decisions snapshot the vacation dates at write time, so
// the admin audit-log detail can show "who did what, on which dates" even if
// the underlying group later changes.
describe("leave decision audit metadata carries a date snapshot", () => {
  async function pendingGroup(userId: string, start: string, end: string) {
    await makeSettings({ totalDays: 30 });
    return makeLeave({ userId, start, end, status: "pending", year: Number(start.slice(0, 4)) });
  }

  it("approve_leave metadata includes startDate and endDate", async () => {
    const member = await makeUser({ employmentStartDate: "2020-01-01" });
    const admin = await makeUser({ role: "admin" });
    const g = await pendingGroup(member.id, "2099-08-03", "2099-08-07");

    await decideLeave({ actor: { id: admin.id, role: "admin" }, groupId: g.groupId, action: "approve" });

    const audit = await prisma.auditLog.findFirst({ where: { action: "approve_leave", targetId: g.groupId } });
    const md = audit!.metadata as Record<string, unknown>;
    expect(md.startDate).toBe("2099-08-03");
    expect(md.endDate).toBe("2099-08-07");
    expect(md.targetUserId).toBe(member.id);
  });

  it("reject_leave metadata includes dates and the note", async () => {
    const member = await makeUser({ employmentStartDate: "2020-01-01" });
    const admin = await makeUser({ role: "admin" });
    const g = await pendingGroup(member.id, "2099-09-07", "2099-09-11");

    await decideLeave({ actor: { id: admin.id, role: "admin" }, groupId: g.groupId, action: "reject", note: "no cover" });

    const audit = await prisma.auditLog.findFirst({ where: { action: "reject_leave", targetId: g.groupId } });
    const md = audit!.metadata as Record<string, unknown>;
    expect(md.startDate).toBe("2099-09-07");
    expect(md.endDate).toBe("2099-09-11");
    expect(md.note).toBe("no cover");
  });

  it("cancel_leave metadata includes startDate and endDate", async () => {
    const member = await makeUser({ employmentStartDate: "2020-01-01" });
    const g = await pendingGroup(member.id, "2099-10-05", "2099-10-09");

    await cancelLeave({ actor: { id: member.id, role: "member" }, groupId: g.groupId });

    const audit = await prisma.auditLog.findFirst({ where: { action: "cancel_leave", targetId: g.groupId } });
    const md = audit!.metadata as Record<string, unknown>;
    expect(md.startDate).toBe("2099-10-05");
    expect(md.endDate).toBe("2099-10-09");
  });

  it("cross-year group snapshots earliest start and latest end", async () => {
    const member = await makeUser({ employmentStartDate: "2020-01-01" });
    const admin = await makeUser({ role: "admin" });
    const gid = "xy-group";
    await makeLeave({ userId: member.id, start: "2099-12-28", end: "2099-12-31", status: "pending", year: 2099, groupId: gid });
    await makeLeave({ userId: member.id, start: "2100-01-01", end: "2100-01-05", status: "pending", year: 2100, groupId: gid });

    await decideLeave({ actor: { id: admin.id, role: "admin" }, groupId: gid, action: "approve" });

    const audit = await prisma.auditLog.findFirst({ where: { action: "approve_leave", targetId: gid } });
    const md = audit!.metadata as Record<string, unknown>;
    expect(md.startDate).toBe("2099-12-28");
    expect(md.endDate).toBe("2100-01-05");
  });
});
