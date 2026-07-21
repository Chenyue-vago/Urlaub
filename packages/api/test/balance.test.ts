import { describe, expect, it } from "vitest";
import { makeLeave, makeSettings, makeUser, prisma } from "./helpers/factories.js";
import { getBalance } from "../src/services/balance.js";

describe("balance service", () => {
  it("returns full entitlement when there are no leaves", async () => {
    // Started this year → no prior-year entitlement to carry over.
    const user = await makeUser({ employmentStartDate: "2025-01-01" });
    const bal = await getBalance(prisma, user.id, 2025);

    expect(bal.year).toBe(2025);
    expect(bal.statutory.total).toBe(20);
    expect(bal.statutory.carryOver).toBe(0);
    expect(bal.statutory.used).toBe(0);
    expect(bal.statutory.available).toBe(20);
    expect(bal.contractual.total).toBe(8);
    expect(bal.contractual.used).toBe(0);
    expect(bal.contractual.available).toBe(8);
  });

  it("counts only pending + approved toward used; ignores rejected/cancelled", async () => {
    const user = await makeUser({ employmentStartDate: "2025-01-01" });
    await makeLeave({ userId: user.id, start: "2025-03-03", end: "2025-03-05", type: "statutory", status: "approved", workDays: 3, year: 2025 });
    await makeLeave({ userId: user.id, start: "2025-04-07", end: "2025-04-08", type: "statutory", status: "pending", workDays: 2, year: 2025 });
    await makeLeave({ userId: user.id, start: "2025-05-05", end: "2025-05-09", type: "statutory", status: "rejected", workDays: 5, year: 2025 });
    await makeLeave({ userId: user.id, start: "2025-06-02", end: "2025-06-05", type: "statutory", status: "cancelled", workDays: 4, year: 2025 });
    await makeLeave({ userId: user.id, start: "2025-07-01", end: "2025-07-01", type: "contractual", status: "approved", workDays: 1, year: 2025 });

    const bal = await getBalance(prisma, user.id, 2025);

    expect(bal.statutory.used).toBe(5); // 3 approved + 2 pending only
    expect(bal.statutory.available).toBe(15);
    expect(bal.contractual.used).toBe(1);
    expect(bal.contractual.available).toBe(7);
  });

  it("flows prior-year carry-over (statutory only) into the current year", async () => {
    const user = await makeUser({});
    // Used 5 statutory days in 2024 → 15 remaining carries into 2025.
    await makeLeave({ userId: user.id, start: "2024-03-03", end: "2024-03-07", type: "statutory", status: "approved", workDays: 5, year: 2024 });

    const bal = await getBalance(prisma, user.id, 2025);

    expect(bal.statutory.carryOver).toBe(15);
    expect(bal.statutory.total).toBe(20);
    expect(bal.statutory.available).toBe(35); // 20 + 15 carryOver - 0 used
    // carry-over is statutory only; contractual unaffected
    expect(bal.contractual.available).toBe(8);
  });

  it("pro-rates entitlement via employmentStartDate (from shared)", async () => {
    const user = await makeUser({ employmentStartDate: "2025-07-01" });
    const bal = await getBalance(prisma, user.id, 2025);

    // 6 eligible months → ceil(20*6/12)=10, ceil(8*6/12)=4
    expect(bal.statutory.total).toBe(10);
    expect(bal.contractual.total).toBe(4);
    expect(bal.statutory.carryOver).toBe(0); // no 2024 entitlement to carry
    expect(bal.statutory.available).toBe(10);
    expect(bal.contractual.available).toBe(4);
  });

  it("respects custom AppSettings", async () => {
    await makeSettings({ statutoryDays: 24, contractualDays: 6 });
    const user = await makeUser({ employmentStartDate: "2025-01-01" });
    const bal = await getBalance(prisma, user.id, 2025);
    expect(bal.statutory.total).toBe(24);
    expect(bal.contractual.total).toBe(6);
  });
});
