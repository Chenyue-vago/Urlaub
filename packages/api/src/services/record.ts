import type { LeaveRequest, PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_ENTITLEMENT,
  type EntitlementConfig,
  type VacationRecord,
} from "@urlaub/shared";

/**
 * Either the app-wide Prisma client or an interactive-transaction client.
 * Balance math must be able to run inside a `$transaction` using the SAME
 * client so the reservation check and the insert are atomic.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Format a `@db.Date` value as a `YYYY-MM-DD` string (UTC, no tz drift). */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Map a persisted LeaveRequest row into the shape the shared math expects. */
export function toRecord(row: LeaveRequest): VacationRecord {
  return {
    id: row.id,
    startDate: toDateString(row.startDate),
    endDate: toDateString(row.endDate),
    workDays: Number(row.workDays),
    description: row.reason,
    type: row.type,
    isCarryOver: row.isCarryOver,
    year: row.year,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Load AppSettings (row id=1) into a shared EntitlementConfig. */
export async function loadConfig(db: Db): Promise<EntitlementConfig> {
  const settings = await db.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) return DEFAULT_ENTITLEMENT;
  return {
    statutoryDays: settings.statutoryDays,
    contractualDays: settings.contractualDays,
    carryOverDeadline: settings.carryOverDeadline,
  };
}

/** A user's employmentStartDate as a `YYYY-MM-DD` string, or undefined. */
export function employmentStart(date: Date | null | undefined): string | undefined {
  return date ? toDateString(date) : undefined;
}
