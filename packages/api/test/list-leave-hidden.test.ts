import { describe, expect, it } from "vitest";
import { makeUser, makeLeave, prisma } from "./helpers/factories.js";
import { listLeaveRequests } from "../src/services/queries.js";

describe("listLeaveRequests excludes soft-hidden rows", () => {
  it("does not return rows with hiddenByUser=true", async () => {
    const user = await makeUser({});
    const visible = await makeLeave({ userId: user.id, start: "2026-08-10", end: "2026-08-14", status: "cancelled", year: 2026 });
    const hidden = await makeLeave({ userId: user.id, start: "2026-09-10", end: "2026-09-14", status: "cancelled", year: 2026 });
    await prisma.leaveRequest.updateMany({ where: { groupId: hidden.groupId }, data: { hiddenByUser: true } });

    const rows = await listLeaveRequests({ userId: user.id });
    const gids = rows.map((r) => r.groupId);
    expect(gids).toContain(visible.groupId);
    expect(gids).not.toContain(hidden.groupId);
  });

  it("rejected rows are still returned (not hidden)", async () => {
    const user = await makeUser({});
    const rejected = await makeLeave({ userId: user.id, start: "2026-08-10", end: "2026-08-14", status: "rejected", year: 2026 });
    const rows = await listLeaveRequests({ userId: user.id });
    expect(rows.map((r) => r.groupId)).toContain(rejected.groupId);
  });
});
