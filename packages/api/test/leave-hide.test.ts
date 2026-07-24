import { describe, expect, it } from "vitest";
import { makeUser, makeLeave, prisma } from "./helpers/factories.js";
import { hideLeaveGroup } from "../src/services/leave.js";

describe("hideLeaveGroup", () => {
  it("owner hides a cancelled group -> all rows hiddenByUser=true", async () => {
    const user = await makeUser({});
    const g = await makeLeave({ userId: user.id, start: "2026-08-10", end: "2026-08-14", status: "cancelled", year: 2026 });

    const rows = await hideLeaveGroup({ actor: { id: user.id, role: "member" }, groupId: g.groupId });
    expect(rows.every((r) => r.hiddenByUser)).toBe(true);

    const inDb = await prisma.leaveRequest.findMany({ where: { groupId: g.groupId } });
    expect(inDb.every((r) => r.hiddenByUser)).toBe(true);
  });

  it("hides every row of a multi-year cancelled group", async () => {
    const user = await makeUser({});
    const gid = "grp-multi";
    await makeLeave({ userId: user.id, start: "2026-12-28", end: "2026-12-31", status: "cancelled", year: 2026, groupId: gid });
    await makeLeave({ userId: user.id, start: "2027-01-01", end: "2027-01-05", status: "cancelled", year: 2027, groupId: gid });

    await hideLeaveGroup({ actor: { id: user.id, role: "member" }, groupId: gid });
    const inDb = await prisma.leaveRequest.findMany({ where: { groupId: gid } });
    expect(inDb).toHaveLength(2);
    expect(inDb.every((r) => r.hiddenByUser)).toBe(true);
  });

  it("refuses to hide a non-cancelled group (approved) -> invalid_transition", async () => {
    const user = await makeUser({});
    const g = await makeLeave({ userId: user.id, start: "2026-08-10", end: "2026-08-14", status: "approved", year: 2026 });

    await expect(
      hideLeaveGroup({ actor: { id: user.id, role: "member" }, groupId: g.groupId })
    ).rejects.toMatchObject({ code: "invalid_transition", status: 409 });

    const inDb = await prisma.leaveRequest.findFirst({ where: { groupId: g.groupId } });
    expect(inDb!.hiddenByUser).toBe(false);
  });

  it("refuses to hide a rejected group (kept for audit) -> invalid_transition", async () => {
    const user = await makeUser({});
    const g = await makeLeave({ userId: user.id, start: "2026-08-10", end: "2026-08-14", status: "rejected", year: 2026 });
    await expect(
      hideLeaveGroup({ actor: { id: user.id, role: "member" }, groupId: g.groupId })
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("forbids a non-owner from hiding someone else's group", async () => {
    const owner = await makeUser({});
    const other = await makeUser({});
    const g = await makeLeave({ userId: owner.id, start: "2026-08-10", end: "2026-08-14", status: "cancelled", year: 2026 });

    await expect(
      hideLeaveGroup({ actor: { id: other.id, role: "member" }, groupId: g.groupId })
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  it("unknown groupId -> not_found", async () => {
    const user = await makeUser({});
    await expect(
      hideLeaveGroup({ actor: { id: user.id, role: "member" }, groupId: "nope" })
    ).rejects.toMatchObject({ status: 404 });
  });
});
