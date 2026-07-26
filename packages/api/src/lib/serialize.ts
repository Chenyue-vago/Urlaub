// Serializers that map internal Prisma rows to the shared HTTP wire contracts.
// Every route response goes through one of these so the JSON shape is enforced
// by the compiler against @urlaub/shared, and dates/decimals are normalized:
//   - @db.Date columns  -> "YYYY-MM-DD" (IsoDate), never a full timestamp
//   - Decimal columns   -> number
//   - timestamp columns -> ISO string
import type { User, LeaveRequest, AuditLog } from "@prisma/client";
import type {
  MeDTO,
  LeaveRequestDTO,
  CalendarEntryDTO,
  AuditLogEntryDTO,
  UserRole,
  LeaveStatus,
} from "@urlaub/shared";
import type { VacationType } from "@urlaub/shared";

/** A Date (or date-like) to a calendar date "YYYY-MM-DD". */
export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toMeDTO(user: User): MeDTO {
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    displayName: user.displayName,
    role: user.role as UserRole,
    region: user.region,
    employmentStartDate: user.employmentStartDate ? toDateOnly(user.employmentStartDate) : null,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toLeaveRequestDTO(row: LeaveRequest): LeaveRequestDTO {
  return {
    id: row.id,
    groupId: row.groupId,
    userId: row.userId,
    startDate: toDateOnly(row.startDate),
    endDate: toDateOnly(row.endDate),
    workDays: Number(row.workDays),
    type: row.type as VacationType,
    year: row.year,
    isCarryOver: row.isCarryOver,
    status: row.status as LeaveStatus,
    reason: row.reason,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCalendarEntryDTO(
  row: LeaveRequest & { user: { displayName: string | null } }
): CalendarEntryDTO {
  return {
    id: row.id,
    userId: row.userId,
    userDisplayName: row.user.displayName,
    startDate: toDateOnly(row.startDate),
    endDate: toDateOnly(row.endDate),
    type: row.type as VacationType,
    status: "approved",
  };
}

export function toAuditLogEntryDTO(row: AuditLog): AuditLogEntryDTO {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
