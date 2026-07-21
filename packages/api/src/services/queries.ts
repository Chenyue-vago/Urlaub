import type { LeaveRequest } from "@prisma/client";
import { prisma } from "../db.js";
import { getBalance } from "./balance.js";
import type { Db } from "./record.js";

/** List leave requests, optionally scoped to a single user and/or year. */
export async function listLeaveRequests(opts: {
  userId?: string;
  year?: number;
}): Promise<LeaveRequest[]> {
  return prisma.leaveRequest.findMany({
    where: {
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.year ? { year: opts.year } : {}),
    },
    orderBy: [{ startDate: "desc" }],
  });
}

/** All rows sharing a groupId, given any single row id in that group. */
export async function getLeaveGroupByRowId(
  id: string
): Promise<{ row: LeaveRequest; group: LeaveRequest[] } | null> {
  const row = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!row) return null;
  const group = await prisma.leaveRequest.findMany({
    where: { groupId: row.groupId },
    orderBy: { year: "asc" },
  });
  return { row, group };
}

export interface CalendarEntry {
  userId: string;
  displayName: string | null;
  startDate: Date;
  endDate: Date;
  type: string;
  status: "approved";
}

/**
 * Approved leave for ALL users overlapping [from, to]. Deliberately excludes
 * `reason`/`decisionNote` — this is a team-visible timeline, not the detail
 * view.
 */
export async function listCalendar(from: Date, to: Date): Promise<CalendarEntry[]> {
  const rows = await prisma.leaveRequest.findMany({
    where: {
      status: "approved",
      startDate: { lte: to },
      endDate: { gte: from },
    },
    include: { user: { select: { displayName: true } } },
    orderBy: { startDate: "asc" },
  });

  return rows.map((row) => ({
    userId: row.userId,
    displayName: row.user.displayName,
    startDate: row.startDate,
    endDate: row.endDate,
    type: row.type,
    status: "approved" as const,
  }));
}

/** Count active admins — used by the last-admin guard. */
export async function countActiveAdmins(db: Db = prisma): Promise<number> {
  return db.user.count({ where: { role: "admin", isActive: true } });
}

/** All users plus a lightweight current-year usage summary each. */
export async function listUsersWithUsage(year: number) {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return Promise.all(
    users.map(async (user) => {
      const balance = await getBalance(prisma, user.id, year);
      return { ...user, usage: balance };
    })
  );
}

export async function listAuditLog(opts: { limit: number; cursor?: string }) {
  const rows = await prisma.auditLog.findMany({
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
  });
  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { rows: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
}
