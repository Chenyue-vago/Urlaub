import { EntitlementConfig, DEFAULT_ENTITLEMENT } from './types.js';

export interface BucketAvailability {
  /** Prior-year days carried over, still available this year (perishable). */
  carryOverAvailable: number;
  /** Base entitlement remaining this year. */
  baseAvailable: number;
}

export interface Allocation {
  /** True when these days consume perishable carry-over from the prior year. */
  isCarryOver: boolean;
  days: number;
}

/**
 * Split `days` (the work-days of one calendar-year segment) across the single
 * 28-day pool, consuming perishable carry-over first so use-it-or-lose-it days
 * are never wasted:
 *
 *   1. carried-over days — expire on the carry-over deadline (default 12-31 of
 *      the segment's own year); only usable when the leave ends on/before it
 *   2. base entitlement  — the current year's allowance
 *
 * A segment yields at most two allocations (a carry-over row and/or a base
 * row). Returns the non-zero allocations and any `shortfall` (days neither
 * source could cover — the caller turns this into an insufficient-balance
 * error). Pure: no I/O, deterministic in its inputs.
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

  // 1) Perishable carry-over first, only if the leave ends on/before the deadline.
  if (carryOverEligible && avail.carryOverAvailable > 0) {
    const take = Math.min(avail.carryOverAvailable, remaining);
    if (take > 0) {
      allocations.push({ isCarryOver: true, days: take });
      remaining -= take;
    }
  }

  // 2) Base entitlement.
  if (avail.baseAvailable > 0 && remaining > 0) {
    const take = Math.min(avail.baseAvailable, remaining);
    if (take > 0) {
      allocations.push({ isCarryOver: false, days: take });
      remaining -= take;
    }
  }

  return { allocations, shortfall: Math.max(0, remaining) };
}
