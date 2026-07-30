import { describe, expect, it } from "vitest";
import { makeLeave, makeSettings, makeUser, prisma } from "./helpers/factories.js";
import { getBalance } from "../src/services/balance.js";

describe("balance service (single 28-day pool)", () => {
  it("returns full entitlement when there are no leaves", async () => {
    // Started this year → no prior-year entitlement to carry over.
    const user = await makeUser({ employmentStartDate: "2025-01-01" });
    const bal = await getBalance(prisma, user.id, 2025);

    expect(bal.year).toBe(2025);
    expect(bal.total).toBe(28);
    expect(bal.carryOver).toBe(0);
    expect(bal.used).toBe(0);
    expect(bal.available).toBe(28);
  });

  it("counts only pending + approved toward used; ignores rejected/cancelled", async () => {
    const user = await makeUser({ employmentStartDate: "2025-01-01" });
    await makeLeave({ userId: user.id, start: "2025-03-03", end: "2025-03-05", status: "approved", workDays: 3, year: 2025 });
    await makeLeave({ userId: user.id, start: "2025-04-07", end: "2025-04-08", status: "pending", workDays: 2, year: 2025 });
    await makeLeave({ userId: user.id, start: "2025-05-05", end: "2025-05-09", status: "rejected", workDays: 5, year: 2025 });
    await makeLeave({ userId: user.id, start: "2025-06-02", end: "2025-06-05", status: "cancelled", workDays: 4, year: 2025 });
    await makeLeave({ userId: user.id, start: "2025-07-01", end: "2025-07-01", status: "approved", workDays: 1, year: 2025 });

    const bal = await getBalance(prisma, user.id, 2025);

    expect(bal.used).toBe(6); // 3 + 2 + 1 (approved/pending); rejected+cancelled ignored
    expect(bal.available).toBe(22); // 28 - 6
  });

  it("flows all prior-year unused days into the current year as carry-over", async () => {
    const user = await makeUser({});
    // Used 5 days in 2024 → 23 remaining carries into 2025 (no type distinction).
    await makeLeave({ userId: user.id, start: "2024-03-03", end: "2024-03-07", status: "approved", workDays: 5, year: 2024 });

    const bal = await getBalance(prisma, user.id, 2025);

    expect(bal.carryOver).toBe(23);
    expect(bal.total).toBe(28);
    expect(bal.available).toBe(51); // 28 + 23 carryOver - 0 used
  });

  it("pro-rates entitlement via employmentStartDate (from shared)", async () => {
    const user = await makeUser({ employmentStartDate: "2025-07-01" });
    const bal = await getBalance(prisma, user.id, 2025);

    // 6 eligible months → ceil(28*6/12) = 14
    expect(bal.total).toBe(14);
    expect(bal.carryOver).toBe(0); // no 2024 entitlement to carry
    expect(bal.available).toBe(14);
  });

  it("respects custom AppSettings", async () => {
    await makeSettings({ totalDays: 30 });
    const user = await makeUser({ employmentStartDate: "2025-01-01" });
    const bal = await getBalance(prisma, user.id, 2025);
    expect(bal.total).toBe(30);
  });
});
