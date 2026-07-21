import { randomUUID } from "node:crypto";
import { Prisma, type LeaveRequest, type LeaveType } from "@prisma/client";
import { countWorkDaysByYear, type RegionCode } from "@urlaub/shared";
import { prisma } from "../db.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { getBalance } from "./balance.js";

export interface Actor {
  id: string;
  role: "admin" | "member";
}

export interface CreateLeaveInput {
  actor: Actor;
  /** Defaults to actor.id. Members may only target themselves. */
  targetUserId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: LeaveType;
  reason?: string;
}

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Create a leave "reservation". Splits the range into one row per calendar
 * year (sharing a single groupId), checks that every year+bucket has enough
 * available balance, and inserts atomically under Serializable isolation so
 * concurrent requests can never over-allocate. Members create pending
 * requests for themselves; admins record approved leave for anyone.
 */
export async function createLeave(input: CreateLeaveInput): Promise<LeaveRequest[]> {
  const { actor, startDate, endDate, type, reason = "" } = input;
  const targetUserId = input.targetUserId ?? actor.id;

  const isAdmin = actor.role === "admin";
  if (!isAdmin && targetUserId !== actor.id) {
    throw forbidden("forbidden");
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw notFound("user_not_found");

  const segments = countWorkDaysByYear(startDate, endDate, target.region as RegionCode);
  if (segments.length === 0 || segments.every((s) => s.days <= 0)) {
    throw conflict("no_work_days");
  }

  const groupId = randomUUID();
  const now = new Date();
  const status = isAdmin ? "approved" : "pending";

  const created = await prisma.$transaction(
    async (tx) => {
      const rows: LeaveRequest[] = [];
      for (const seg of segments) {
        if (seg.days <= 0) continue;

        // Reservation check against the SAME tx client so the read + insert
        // are atomic (Serializable turns the read into a predicate lock).
        const balance = await getBalance(tx, targetUserId, seg.year);
        const bucket = type === "statutory" ? balance.statutory : balance.contractual;
        if (seg.days > bucket.available) {
          throw conflict("insufficient_balance");
        }

        const row = await tx.leaveRequest.create({
          data: {
            groupId,
            userId: targetUserId,
            startDate: toDate(seg.startDate),
            endDate: toDate(seg.endDate),
            workDays: new Prisma.Decimal(seg.days),
            type,
            year: seg.year,
            status,
            reason,
            decidedById: isAdmin ? actor.id : null,
            decidedAt: isAdmin ? now : null,
          },
        });
        rows.push(row);
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: isAdmin ? "record_leave" : "create_leave",
          targetType: "leave_group",
          targetId: groupId,
          metadata: {
            targetUserId,
            type,
            startDate,
            endDate,
            years: rows.map((r) => r.year),
            totalWorkDays: rows.reduce((sum, r) => sum + Number(r.workDays), 0),
          },
        },
      });

      return rows;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return created;
}

export interface DecideLeaveInput {
  actor: Actor;
  groupId: string;
  action: "approve" | "reject";
  note?: string;
}

/**
 * Approve or reject an entire pending group at once. Admin only. Rejecting
 * frees the reserved balance (rejected rows no longer count); approving keeps
 * the days counted as used.
 */
export async function decideLeave(input: DecideLeaveInput): Promise<LeaveRequest[]> {
  const { actor, groupId, action, note } = input;
  if (actor.role !== "admin") throw forbidden("forbidden");

  const newStatus = action === "approve" ? "approved" : "rejected";
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.leaveRequest.findMany({ where: { groupId } });
    if (rows.length === 0) throw notFound("leave_not_found");
    if (rows.some((r) => r.status !== "pending")) {
      throw conflict("invalid_transition");
    }

    await tx.leaveRequest.updateMany({
      where: { groupId },
      data: { status: newStatus, decidedById: actor.id, decidedAt: now, decisionNote: note ?? null },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: action === "approve" ? "approve_leave" : "reject_leave",
        targetType: "leave_group",
        targetId: groupId,
        metadata: { targetUserId: rows[0].userId, note: note ?? null },
      },
    });

    return tx.leaveRequest.findMany({ where: { groupId }, orderBy: { year: "asc" } });
  });
}

export interface CancelLeaveInput {
  actor: Actor;
  groupId: string;
}

/**
 * Cancel an entire group. Admins may cancel any group; members may cancel
 * their OWN group only while it is still pending/approved and not fully in
 * the past. Cancelled rows no longer count toward used balance.
 */
export async function cancelLeave(input: CancelLeaveInput): Promise<LeaveRequest[]> {
  const { actor, groupId } = input;
  const isAdmin = actor.role === "admin";

  return prisma.$transaction(async (tx) => {
    const rows = await tx.leaveRequest.findMany({ where: { groupId } });
    if (rows.length === 0) throw notFound("leave_not_found");

    const ownerId = rows[0].userId;
    if (!isAdmin && ownerId !== actor.id) throw forbidden("forbidden");

    if (rows.some((r) => r.status !== "pending" && r.status !== "approved")) {
      throw conflict("invalid_transition");
    }

    if (!isAdmin) {
      // Members can only cancel leave that has not fully ended yet.
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
      const latestEnd = rows.reduce((max, r) => (r.endDate > max ? r.endDate : max), rows[0].endDate);
      if (latestEnd < today) throw conflict("invalid_transition");
    }

    await tx.leaveRequest.updateMany({ where: { groupId }, data: { status: "cancelled" } });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "cancel_leave",
        targetType: "leave_group",
        targetId: groupId,
        metadata: { targetUserId: ownerId },
      },
    });

    return tx.leaveRequest.findMany({ where: { groupId }, orderBy: { year: "asc" } });
  });
}
