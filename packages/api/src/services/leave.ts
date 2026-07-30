import { randomUUID } from "node:crypto";
import { Prisma, type LeaveRequest } from "@prisma/client";
import { allocateLeaveDays, countWorkDaysByYear, type RegionCode } from "@urlaub/shared";
import { prisma } from "../db.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { getBalance, RESERVING_STATUSES } from "./balance.js";
import { loadConfig } from "./record.js";

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
  reason?: string;
}

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Earliest start / latest end of a group's rows as "YYYY-MM-DD" — snapshotted
 * into audit metadata so the audit log can show the vacation's dates. */
function groupDateRange(rows: LeaveRequest[]): { startDate: string; endDate: string } {
  const start = rows.reduce((min, r) => (r.startDate < min ? r.startDate : min), rows[0].startDate);
  const end = rows.reduce((max, r) => (r.endDate > max ? r.endDate : max), rows[0].endDate);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

/**
 * Create a leave "reservation". Splits the range into one row per calendar
 * year (sharing a single groupId), checks that every year+bucket has enough
 * available balance, and inserts atomically under Serializable isolation so
 * concurrent requests can never over-allocate. Members create pending
 * requests for themselves; admins record approved leave for anyone.
 */
export async function createLeave(input: CreateLeaveInput): Promise<LeaveRequest[]> {
  const { actor, startDate, endDate, reason = "" } = input;
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
  const status = isAdmin ? "approved" : "pending";

  const runReservation = () =>
    prisma.$transaction(
      async (tx) => {
        const config = await loadConfig(tx);

        // Reject a request whose date range intersects an existing reserving
        // (pending/approved) request for the SAME user — you cannot book the
        // same day off twice. Two ranges overlap iff each starts on/before the
        // other ends; @db.Date values are midnight, so a shared boundary day
        // counts as an overlap. Rejected/cancelled rows freed their dates and
        // are excluded. Under Serializable this SELECT is a predicate lock, so
        // two concurrent overlapping requests can't both pass: the loser aborts
        // (P2034) and, on retry, sees the winner's committed row.
        const clash = await tx.leaveRequest.findFirst({
          where: {
            userId: targetUserId,
            status: { in: [...RESERVING_STATUSES] },
            startDate: { lte: toDate(endDate) },
            endDate: { gte: toDate(startDate) },
          },
          select: { id: true },
        });
        if (clash) throw conflict("overlapping_request");

        const rows: LeaveRequest[] = [];
        const now = new Date();
        for (const seg of segments) {
          if (seg.days <= 0) continue;

          // Reservation check against the SAME tx client so the read + insert
          // are atomic (Serializable turns the read into a predicate lock).
          // The system consumes perishable carry-over first, then the base
          // 28-day pool. One segment may split into a carry-over row and a base
          // row (differing only in isCarryOver), never by leave type.
          const balance = await getBalance(tx, targetUserId, seg.year);
          // Split the available pool into its perishable carry-over part
          // (consumed first) and the base part. Carry-over still available is
          // the total carried in MINUS what earlier requests already spent from
          // it — otherwise every request would think the full carry-over is free
          // and over-draw it.
          const carryOverRemaining = Math.max(0, balance.carryOver - balance.carryOverUsed);
          const carryOverAvailable = Math.max(
            0,
            Math.min(carryOverRemaining, balance.available)
          );
          const baseAvailable = Math.max(0, balance.available - carryOverAvailable);

          const { allocations, shortfall } = allocateLeaveDays(
            seg.days,
            seg.endDate,
            { carryOverAvailable, baseAvailable },
            config
          );
          if (shortfall > 0) {
            throw conflict("insufficient_balance");
          }

          for (const alloc of allocations) {
            const row = await tx.leaveRequest.create({
              data: {
                groupId,
                userId: targetUserId,
                startDate: toDate(seg.startDate),
                endDate: toDate(seg.endDate),
                workDays: new Prisma.Decimal(alloc.days),
                isCarryOver: alloc.isCarryOver,
                year: seg.year,
                status,
                reason,
                decidedById: isAdmin ? actor.id : null,
                decidedAt: isAdmin ? now : null,
              },
            });
            rows.push(row);
          }
        }

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: isAdmin ? "record_leave" : "create_leave",
            targetType: "leave_group",
            targetId: groupId,
            metadata: {
              targetUserId,
              startDate,
              endDate,
              years: [...new Set(rows.map((r) => r.year))],
              totalWorkDays: rows.reduce((sum, r) => sum + Number(r.workDays), 0),
            },
          },
        });

        return rows;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
        maxWait: 5000,
      }
    );

  // Serializable aborts the losing side of a concurrent reservation with a
  // write-conflict (P2034). That is transient: retrying re-reads balance in a
  // fresh transaction whose snapshot now sees the winner's committed row, so
  // requests that genuinely fit still succeed. Only after exhausting retries do
  // we surface a clean 409 (never a raw 500, never an over-allocation).
  //
  // MAX_ATTEMPTS must exceed the expected concurrent contention: with N
  // simultaneous requests on the same user+year, a single request may lose up
  // to N-1 races before it is the last one standing, so 3 is too few for
  // realistic bursts. Exponential backoff with full jitter de-synchronizes the
  // retrying herd so they don't just re-collide.
  const MAX_ATTEMPTS = 6;
  for (let attempt = 1; ; attempt++) {
    try {
      return await runReservation();
    } catch (err) {
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!isConflict) throw err;
      if (attempt >= MAX_ATTEMPTS) throw conflict("concurrent_request");
      const backoffMs = Math.floor(Math.random() * (10 * 2 ** attempt)); // full jitter
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
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

    // The conditional updateMany IS the guard: only rows still `pending`
    // transition. Under two simultaneous approvals, exactly one gets
    // count > 0; the other sees count === 0 and fails — so no double write and
    // no double audit row.
    const { count } = await tx.leaveRequest.updateMany({
      where: { groupId, status: "pending" },
      data: { status: newStatus, decidedById: actor.id, decidedAt: now, decisionNote: note ?? null },
    });
    if (count === 0) throw conflict("invalid_transition");

    const range = groupDateRange(rows);
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: action === "approve" ? "approve_leave" : "reject_leave",
        targetType: "leave_group",
        targetId: groupId,
        metadata: {
          targetUserId: rows[0].userId,
          startDate: range.startDate,
          endDate: range.endDate,
          note: note ?? null,
        },
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

    if (!isAdmin) {
      // Members can only cancel a vacation that has not STARTED yet — once it
      // has begun (or is fully past) it can no longer be called off.
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
      const earliestStart = rows.reduce(
        (min, r) => (r.startDate < min ? r.startDate : min),
        rows[0].startDate
      );
      if (earliestStart <= today) throw conflict("invalid_transition");
    }

    // The conditional updateMany IS the guard: only pending/approved rows
    // transition to cancelled. Concurrent cancels can't double-write or emit a
    // second audit row — the loser sees count === 0.
    const { count } = await tx.leaveRequest.updateMany({
      where: { groupId, status: { in: ["pending", "approved"] } },
      data: { status: "cancelled" },
    });
    if (count === 0) throw conflict("invalid_transition");

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "cancel_leave",
        targetType: "leave_group",
        targetId: groupId,
        metadata: { targetUserId: ownerId, ...groupDateRange(rows) },
      },
    });

    return tx.leaveRequest.findMany({ where: { groupId }, orderBy: { year: "asc" } });
  });
}

export interface HideLeaveInput {
  actor: Actor;
  groupId: string;
}

/**
 * Soft-hide a CANCELLED group from its owner's dashboard. The rows stay (so
 * balance history and the audit log are untouched); list queries filter out
 * hiddenByUser rows. Only the owner may hide, and only a fully-cancelled group
 * — pending/approved/rejected can never be hidden (rejected is kept for audit).
 */
export async function hideLeaveGroup(input: HideLeaveInput): Promise<LeaveRequest[]> {
  const { actor, groupId } = input;

  return prisma.$transaction(async (tx) => {
    const rows = await tx.leaveRequest.findMany({ where: { groupId } });
    if (rows.length === 0) throw notFound("leave_not_found");

    if (rows[0].userId !== actor.id) throw forbidden("forbidden");

    // Only hide when EVERY row is cancelled. A conditional updateMany alone
    // would partially hide a mixed group, so guard explicitly first.
    if (!rows.every((r) => r.status === "cancelled")) {
      throw conflict("invalid_transition");
    }

    // A vacation that has already started (or fully passed) stays visible: you
    // can only remove a cancelled group that has not begun yet (same
    // not-yet-started rule as cancelLeave).
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const earliestStart = rows.reduce(
      (min, r) => (r.startDate < min ? r.startDate : min),
      rows[0].startDate
    );
    if (earliestStart <= today) throw conflict("invalid_transition");

    await tx.leaveRequest.updateMany({
      where: { groupId, status: "cancelled" },
      data: { hiddenByUser: true },
    });

    return tx.leaveRequest.findMany({ where: { groupId }, orderBy: { year: "asc" } });
  });
}
