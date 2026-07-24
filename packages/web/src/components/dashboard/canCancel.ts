import type { LeaveRequestResponse } from '../../services/leave';

/**
 * Whether the owning member may cancel this leave record from the dashboard.
 * Mirrors the backend `cancelLeave` rule: only leave that still reserves days
 * (pending or approved) AND has not fully ended yet (endDate >= today) can be
 * cancelled — a member no longer needing an upcoming vacation can call it off
 * and get the days back. `today` is a "YYYY-MM-DD" string; ISO date strings
 * compare correctly lexicographically.
 */
export function canCancelRecord(
  record: { status: LeaveRequestResponse['status']; endDate: string },
  today: string
): boolean {
  const reserves = record.status === 'pending' || record.status === 'approved';
  return reserves && record.endDate >= today;
}

/** Local calendar date as "YYYY-MM-DD" (matches how leave dates are stored). */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
