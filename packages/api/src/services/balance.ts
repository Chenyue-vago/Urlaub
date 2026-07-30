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
  /** Sum of workDays of pending+approved rows already flagged isCarryOver — how
   *  much of `carryOver` is already spent. Bounds further carry-over draws. */
  carryOverUsed: number;
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

  // Prior-year carry-over into THIS year. Carry-over does not chain, so the
  // amount rolling in is the prior year's UNUSED BASE allowance. Computing that
  // correctly needs the prior year's own carry-in (requests consume carry-over
  // first), so we recurse one year back — bounded by the employment start year,
  // before which there is no entitlement and nothing to carry. When no
  // employment start date is set there is no defined history to walk, so we only
  // look one year back and treat its carry-in as 0 (no chaining anyway).
  const startYear = user.employmentStartDate?.getUTCFullYear();
  let carryOver = 0;
  if (startYear === undefined || year > startYear) {
    const prevRows = await db.leaveRequest.findMany({
      where: { userId, year: year - 1, status: { in: [...RESERVING_STATUSES] } },
    });
    const prevCarryIn =
      startYear !== undefined && year - 1 > startYear
        ? (await getBalance(db, userId, year - 1)).carryOver
        : 0;
    carryOver = calculateCarryOver(
      prevRows.map(toRecord),
      year - 1,
      empStart,
      config,
      prevCarryIn
    );
  }

  // Usage this year (single pool, no type distinction).
  const rows = await db.leaveRequest.findMany({
    where: { userId, year, status: { in: [...RESERVING_STATUSES] } },
  });
  const used = rows.reduce((sum, row) => sum + Number(row.workDays), 0);
  const carryOverUsed = rows.reduce(
    (sum, row) => (row.isCarryOver ? sum + Number(row.workDays) : sum),
    0
  );

  return {
    year,
    total,
    carryOver,
    used,
    carryOverUsed,
    available: total + carryOver - used,
  };
}
