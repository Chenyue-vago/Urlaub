import { calculateCarryOver, getYearlyEntitlement } from "@urlaub/shared";
import { notFound } from "../lib/errors.js";
import { type Db, employmentStart, loadConfig, toRecord } from "./record.js";

/** Statuses that "reserve" balance. Rejected/cancelled never count. */
export const RESERVING_STATUSES = ["pending", "approved"] as const;

export interface BucketBalance {
  /** Base yearly entitlement for the bucket (pro-rated for start year). */
  total: number;
  /** Sum of workDays of pending+approved rows in the year for the bucket. */
  used: number;
  /** total (+ carryOver for statutory) − used. */
  available: number;
}

export interface StatutoryBalance extends BucketBalance {
  /** Unused statutory days carried over from the previous year. */
  carryOver: number;
}

export interface Balance {
  year: number;
  statutory: StatutoryBalance;
  contractual: BucketBalance;
}

/**
 * Compute a user's leave balance for a year, per bucket (statutory /
 * contractual), reusing the shared entitlement math. Accepts any Db (the app
 * client or a transaction client) so it can run inside createLeave's tx.
 */
export async function getBalance(
  db: Db,
  userId: string,
  year: number
): Promise<Balance> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("user_not_found");

  const config = await loadConfig(db);
  const empStart = employmentStart(user.employmentStartDate);

  const entitlement = getYearlyEntitlement(year, config, empStart);

  // Prior-year carry-over (statutory only, as shared defines). Consider the
  // previous year's reserving rows the same way we count this year's usage.
  const prevRows = await db.leaveRequest.findMany({
    where: { userId, year: year - 1, status: { in: [...RESERVING_STATUSES] } },
  });
  const carryOver = calculateCarryOver(
    prevRows.map(toRecord),
    year - 1,
    empStart,
    config
  );

  // Usage this year, per bucket.
  const rows = await db.leaveRequest.findMany({
    where: { userId, year, status: { in: [...RESERVING_STATUSES] } },
  });
  let statutoryUsed = 0;
  let contractualUsed = 0;
  for (const row of rows) {
    if (row.type === "statutory") statutoryUsed += Number(row.workDays);
    else contractualUsed += Number(row.workDays);
  }

  return {
    year,
    statutory: {
      total: entitlement.statutoryTotal,
      carryOver,
      used: statutoryUsed,
      available: entitlement.statutoryTotal + carryOver - statutoryUsed,
    },
    contractual: {
      total: entitlement.contractualTotal,
      used: contractualUsed,
      available: entitlement.contractualTotal - contractualUsed,
    },
  };
}
