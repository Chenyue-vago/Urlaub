import { describe, expect, it } from "vitest";
import { countWorkDaysByYear } from "@urlaub/shared";
import { makeSettings, makeUser, prisma } from "./helpers/factories.js";
import { createLeave } from "../src/services/leave.js";
import { getBalance } from "../src/services/balance.js";
import { AppError } from "../src/lib/errors.js";

describe("createLeave", () => {
  it("member request within balance → pending rows, balance reserved", async () => {
    const user = await makeUser({ employmentStartDate: "2025-01-01" });
    const group = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2025-03-04",
      endDate: "2025-03-05",
      type: "statutory",
      reason: "spring break",
    });

    expect(group).toHaveLength(1);
    expect(group[0].status).toBe("pending");
    expect(group[0].userId).toBe(user.id);
    expect(Number(group[0].workDays)).toBe(2);
    expect(group[0].decidedById).toBeNull();

    const bal = await getBalance(prisma, user.id, 2025);
    expect(bal.statutory.used).toBe(2);
    expect(bal.statutory.available).toBe(18);
  });

  it("request exceeding available → throws insufficient_balance, nothing created", async () => {
    await makeSettings({ statutoryDays: 2 });
    const user = await makeUser({ employmentStartDate: "2025-01-01" });

    await expect(
      createLeave({
        actor: { id: user.id, role: "member" },
        startDate: "2025-03-04",
        endDate: "2025-03-06", // 3 workdays > 2 available
        type: "statutory",
        reason: "too long",
      })
    ).rejects.toMatchObject({ code: "insufficient_balance", status: 409 });

    const count = await prisma.leaveRequest.count();
    expect(count).toBe(0);
  });

  it("cross-year request → 2 rows sharing groupId, correct per-year workDays", async () => {
    const user = await makeUser({ employmentStartDate: "2020-01-01" });
    const group = await createLeave({
      actor: { id: user.id, role: "member" },
      startDate: "2025-12-29",
      endDate: "2026-01-03",
      type: "statutory",
      reason: "new year",
    });

    const segments = countWorkDaysByYear("2025-12-29", "2026-01-03", "BW");
    expect(segments).toHaveLength(2);

    expect(group).toHaveLength(2);
    const gid = group[0].groupId;
    expect(group.every((r) => r.groupId === gid)).toBe(true);

    const byYear = new Map(group.map((r) => [r.year, r]));
    for (const seg of segments) {
      const row = byYear.get(seg.year)!;
      expect(row).toBeDefined();
      expect(Number(row.workDays)).toBe(seg.days);
    }

    // both years are charged
    expect((await getBalance(prisma, user.id, 2025)).statutory.used).toBe(
      segments.find((s) => s.year === 2025)!.days
    );
    expect((await getBalance(prisma, user.id, 2026)).statutory.used).toBe(
      segments.find((s) => s.year === 2026)!.days
    );
  });

  it("admin create for another user → approved rows with decidedById=admin", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser({ role: "member", employmentStartDate: "2020-01-01" });

    const group = await createLeave({
      actor: { id: admin.id, role: "admin" },
      targetUserId: member.id,
      startDate: "2025-04-01",
      endDate: "2025-04-02",
      type: "contractual",
      reason: "recorded by admin",
    });

    expect(group).toHaveLength(1);
    expect(group[0].userId).toBe(member.id);
    expect(group[0].status).toBe("approved");
    expect(group[0].decidedById).toBe(admin.id);
    expect(group[0].decidedAt).not.toBeNull();

    const audit = await prisma.auditLog.findMany({ where: { action: "record_leave" } });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorId).toBe(admin.id);
  });

  it("member cannot create leave for another user → forbidden", async () => {
    const a = await makeUser({ role: "member" });
    const b = await makeUser({ role: "member" });
    await expect(
      createLeave({
        actor: { id: a.id, role: "member" },
        targetUserId: b.id,
        startDate: "2025-05-05",
        endDate: "2025-05-06",
        type: "statutory",
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("concurrency: two parallel requests that together exceed balance → exactly one succeeds", async () => {
    await makeSettings({ statutoryDays: 3 });
    const user = await makeUser({ employmentStartDate: "2025-01-01" });

    const mk = (start: string, end: string) =>
      createLeave({
        actor: { id: user.id, role: "member" },
        startDate: start,
        endDate: end,
        type: "statutory",
        reason: "race",
      });

    // Each is 2 workdays; together 4 > 3 available.
    const results = await Promise.allSettled([
      mk("2025-03-04", "2025-03-05"),
      mk("2025-03-11", "2025-03-12"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const bal = await getBalance(prisma, user.id, 2025);
    expect(bal.statutory.used).toBeLessThanOrEqual(3); // never over-allocated
    expect(bal.statutory.used).toBe(2);
  });
});
