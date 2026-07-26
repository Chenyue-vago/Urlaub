import { EntitlementConfig, DEFAULT_ENTITLEMENT } from './types.js';

export interface BucketAvailability {
  /** Prior-year statutory days carried over, still available this year. */
  carryOverAvailable: number;
  /** Contractual entitlement remaining this year. */
  contractualAvailable: number;
  /** Base (non-carry-over) statutory entitlement remaining this year. */
  statutoryAvailable: number;
}

export interface Allocation {
  type: 'statutory' | 'contractual';
  isCarryOver: boolean;
  days: number;
}

/**
 * Split `days` (the work-days of one calendar-year segment) across the three
 * balance buckets in the order that is best for the employee — soonest-to-
 * expire first, so use-it-or-lose-it days are never wasted:
 *
 *   1. carried-over statutory  (expires on the carry-over deadline, e.g. 03-31)
 *      — only when the leave ends on/before that deadline
 *   2. contractual             (expires at year end, cannot carry over)
 *   3. base statutory          (least perishable; itself can carry over)
 *
 * Returns the non-zero allocations and any `shortfall` (days that no bucket
 * could cover — the caller turns this into an insufficient-balance error).
 * Pure: no I/O, deterministic in its inputs.
 */
export function allocateLeaveDays(
  days: number,
  periodEndDate: string, // "YYYY-MM-DD"
  avail: BucketAvailability,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): { allocations: Allocation[]; shortfall: number } {
  const allocations: Allocation[] = [];
  let remaining = days;

  // The carry-over deadline is a date within the segment's own year.
  const year = periodEndDate.slice(0, 4);
  const carryOverDeadline = `${year}-${config.carryOverDeadline}`;
  const carryOverEligible = periodEndDate <= carryOverDeadline;

  // 1) Carried-over statutory (most perishable), only if the leave ends before
  //    the deadline.
  if (carryOverEligible && avail.carryOverAvailable > 0) {
    const take = Math.min(avail.carryOverAvailable, remaining);
    if (take > 0) {
      allocations.push({ type: 'statutory', isCarryOver: true, days: take });
      remaining -= take;
    }
  }

  // 2) Contractual next.
  if (avail.contractualAvailable > 0 && remaining > 0) {
    const take = Math.min(avail.contractualAvailable, remaining);
    if (take > 0) {
      allocations.push({ type: 'contractual', isCarryOver: false, days: take });
      remaining -= take;
    }
  }

  // 3) Base statutory last.
  if (avail.statutoryAvailable > 0 && remaining > 0) {
    const take = Math.min(avail.statutoryAvailable, remaining);
    if (take > 0) {
      allocations.push({ type: 'statutory', isCarryOver: false, days: take });
      remaining -= take;
    }
  }

  return { allocations, shortfall: Math.max(0, remaining) };
}
