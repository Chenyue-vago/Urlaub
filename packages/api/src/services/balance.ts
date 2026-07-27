import { calculateCarryOver, getYearlyEntitlement } from "@urlaub/shared";
import { notFound } from "../lib/errors.js";
import { type Db, employmentStart, loadConfig, toRecord } from "./record.js";

/** Statuses that "reserve" balance. Rejected/cancelled never count. */
export const RESERVING_STATUSES = ["pending", "approved"] as const;

export interface Balance {
  year: number;
  /** Base yearly entitlement (pro-rated for the start year). */
  total: number;
  /** Unused days carried over from the previous year (perishable). */
  carryOver: number;
  /** Sum of workDays of pending+approved rows in the year. */
  used: number;
  /** total + carryOver − used. */
  available: number;
}

/**
 * Compute a user's leave balance for a year as a single 28-day pool plus
 * perishable carry-over from the prior year, reusing the shared entitlement
 * math. Accepts any Db (the app client or a transaction client) so it can run
 * inside createLeave's tx.
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

  const { total } = getYearlyEntitlement(year, config, empStart);

  // Prior-year carry-over: all unused days from last year's reserving rows.
  const prevRows = await db.leaveRequest.findMany({
    where: { userId, year: year - 1, status: { in: [...RESERVING_STATUSES] } },
  });
  const carryOver = calculateCarryOver(
    prevRows.map(toRecord),
    year - 1,
    empStart,
    config
  );

  // Usage this year (single pool, no type distinction).
  const rows = await db.leaveRequest.findMany({
    where: { userId, year, status: { in: [...RESERVING_STATUSES] } },
  });
  const used = rows.reduce((sum, row) => sum + Number(row.workDays), 0);

  return {
    year,
    total,
    carryOver,
    used,
    available: total + carryOver - used,
  };
}
