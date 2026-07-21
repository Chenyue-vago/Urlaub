// HTTP wire contracts shared by the API (producer) and web client (consumer).
// Both sides import these so a field rename or type drift is a COMPILE error,
// not a run-time "undefined" that only shows up when you open the page.
//
// Date conventions on the wire:
//   IsoDate      — a calendar date with no time, "YYYY-MM-DD" (Postgres @db.Date)
//   IsoTimestamp — a full instant, ISO-8601 "YYYY-MM-DDTHH:mm:ss.sssZ"
import type { VacationType } from './types.js';

/** "YYYY-MM-DD" (no time component). */
export type IsoDate = string;
/** Full ISO-8601 timestamp. */
export type IsoTimestamp = string;

export type UserRole = 'admin' | 'member';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** GET/PATCH /me */
export interface MeDTO {
  id: string;
  clerkId: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  region: string;
  employmentStartDate: IsoDate | null;
  isActive: boolean;
  createdAt: IsoTimestamp;
}

/** A single leave-request row (GET/POST /leave-requests and decisions). */
export interface LeaveRequestDTO {
  id: string;
  groupId: string;
  userId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  workDays: number;
  type: VacationType;
  year: number;
  isCarryOver: boolean;
  status: LeaveStatus;
  reason: string;
  decidedById: string | null;
  decidedAt: IsoTimestamp | null;
  decisionNote: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

/** GET /calendar — approved leave across all users; never exposes reason/note. */
export interface CalendarEntryDTO {
  id: string;
  userId: string;
  userDisplayName: string | null;
  startDate: IsoDate;
  endDate: IsoDate;
  type: VacationType;
  status: 'approved';
}

/** One row in GET /admin/audit-log. */
export interface AuditLogEntryDTO {
  id: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: IsoTimestamp;
}

/** GET /admin/audit-log (paginated). */
export interface AuditLogPageDTO {
  items: AuditLogEntryDTO[];
  nextCursor: string | null;
}
