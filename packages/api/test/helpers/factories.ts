import "./env-test.js"; // side-effect: must precede the db import below
import { randomUUID } from "node:crypto";
import { countWorkDaysByYear } from "@urlaub/shared";
import type { LeaveStatus, LeaveType, Role } from "@prisma/client";
import { prisma } from "../../src/db.js";

export { prisma };

/** Truncate every table and reset identities. Call from beforeEach. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    "TRUNCATE users, leave_requests, app_settings, audit_log RESTART IDENTITY CASCADE"
  );
}

export function makeSettings(opts: {
  statutoryDays?: number;
  contractualDays?: number;
  carryOverDeadline?: string;
} = {}) {
  const data = {
    statutoryDays: opts.statutoryDays ?? 20,
    contractualDays: opts.contractualDays ?? 8,
    carryOverDeadline: opts.carryOverDeadline ?? "03-31",
  };
  return prisma.appSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
}

let userCounter = 0;

export function makeUser(opts: {
  role?: Role;
  region?: string;
  employmentStartDate?: string | Date | null;
  displayName?: string;
} = {}) {
  userCounter += 1;
  const uniq = `${Date.now()}_${userCounter}_${randomUUID().slice(0, 8)}`;
  const emp = opts.employmentStartDate;
  return prisma.user.create({
    data: {
      clerkId: `test_${uniq}`,
      email: `user_${uniq}@example.com`,
      displayName: opts.displayName ?? `User ${uniq}`,
      role: opts.role ?? "member",
      region: opts.region ?? "BW",
      employmentStartDate:
        emp == null ? null : emp instanceof Date ? emp : new Date(`${emp}T00:00:00.000Z`),
    },
  });
}

export function makeLeave(opts: {
  userId: string;
  start: string;
  end: string;
  type?: LeaveType;
  status?: LeaveStatus;
  workDays?: number;
  year?: number;
  region?: string;
  groupId?: string;
  reason?: string;
}) {
  const region = opts.region ?? "BW";
  const segments = countWorkDaysByYear(opts.start, opts.end, region as any);
  const year = opts.year ?? new Date(`${opts.start}T00:00:00.000Z`).getUTCFullYear();
  const workDays =
    opts.workDays ?? segments.reduce((sum, s) => sum + s.days, 0);
  return prisma.leaveRequest.create({
    data: {
      groupId: opts.groupId ?? randomUUID(),
      userId: opts.userId,
      startDate: new Date(`${opts.start}T00:00:00.000Z`),
      endDate: new Date(`${opts.end}T00:00:00.000Z`),
      workDays,
      type: opts.type ?? "statutory",
      year,
      status: opts.status ?? "approved",
      reason: opts.reason ?? "",
    },
  });
}
