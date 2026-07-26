import type { LeaveRequestResponse } from '../../services/leave';

/**
 * Whether the owning member may cancel this leave record from the dashboard.
 * Mirrors the backend `cancelLeave` rule: only leave that still reserves days
 * (pending or approved) AND has NOT started yet (startDate strictly after
 * today) can be cancelled — once a vacation has begun (or is fully past) it
 * can no longer be called off. `today` is a "YYYY-MM-DD" string; ISO date
 * strings compare correctly lexicographically.
 */
export function canCancelRecord(
  record: { status: LeaveRequestResponse['status']; startDate: string },
  today: string
): boolean {
  const reserves = record.status === 'pending' || record.status === 'approved';
  return reserves && record.startDate > today;
}

/**
 * Whether the owning member may remove (soft-hide) this cancelled record from
 * their dashboard. Mirrors the backend hideLeaveGroup rule: only a CANCELLED
 * record that has NOT started yet can be removed — once the vacation has begun
 * or passed it stays visible so history is preserved.
 */
export function canHideRecord(
  record: { status: LeaveRequestResponse['status']; startDate: string },
  today: string
): boolean {
  return record.status === 'cancelled' && record.startDate > today;
}

/** Local calendar date as "YYYY-MM-DD" (matches how leave dates are stored). */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
