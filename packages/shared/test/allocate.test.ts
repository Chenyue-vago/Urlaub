import { describe, it, expect } from 'vitest';
import { allocateLeaveDays } from '../src/allocate.js';
import { DEFAULT_ENTITLEMENT } from '../src/types.js';

const CONFIG = DEFAULT_ENTITLEMENT; // carryOverDeadline "12-31"

const AVAIL = {
  carryOverAvailable: 0,
  baseAvailable: 0,
};

describe('allocateLeaveDays (single pool: carry-over first, then base)', () => {
  it('draws from the base pool when no carry-over is available', () => {
    const { allocations, shortfall } = allocateLeaveDays(
      3,
      '2026-06-10',
      { ...AVAIL, baseAvailable: 28 },
      CONFIG
    );
    expect(shortfall).toBe(0);
    expect(allocations).toEqual([{ isCarryOver: false, days: 3 }]);
  });

  it('consumes perishable carry-over before the base pool', () => {
    // 10 days: 2 carry-over + 8 base
    const { allocations, shortfall } = allocateLeaveDays(
      10,
      '2026-06-15', // before the 12-31 deadline, so carry-over is eligible
      { carryOverAvailable: 2, baseAvailable: 28 },
      CONFIG
    );
    expect(shortfall).toBe(0);
    expect(allocations).toEqual([
      { isCarryOver: true, days: 2 },
      { isCarryOver: false, days: 8 },
    ]);
  });

  it('does not use carry-over after the deadline (period ends past it)', () => {
    const { allocations } = allocateLeaveDays(
      4,
      '2026-07-01', // after a 06-30 deadline
      { carryOverAvailable: 5, baseAvailable: 28 },
      { ...CONFIG, carryOverDeadline: '06-30' }
    );
    expect(allocations).toEqual([{ isCarryOver: false, days: 4 }]);
  });

  it('uses carry-over on the deadline day itself (<=)', () => {
    const { allocations } = allocateLeaveDays(
      1,
      '2026-12-31',
      { carryOverAvailable: 5, baseAvailable: 0 },
      CONFIG
    );
    expect(allocations).toEqual([{ isCarryOver: true, days: 1 }]);
  });

  it('omits zero-day allocations', () => {
    const { allocations } = allocateLeaveDays(
      2,
      '2026-06-01',
      { carryOverAvailable: 2, baseAvailable: 28 },
      CONFIG
    );
    // exactly fills carry-over; no base row appended
    expect(allocations).toEqual([{ isCarryOver: true, days: 2 }]);
  });

  it('reports shortfall when carry-over + base together are insufficient', () => {
    const { allocations, shortfall } = allocateLeaveDays(
      10,
      '2026-06-01',
      { carryOverAvailable: 3, baseAvailable: 4 },
      CONFIG
    );
    expect(shortfall).toBe(3); // 10 - 3 - 4
    expect(allocations).toEqual([
      { isCarryOver: true, days: 3 },
      { isCarryOver: false, days: 4 },
    ]);
  });

  it('honors a custom carry-over deadline from config', () => {
    const { allocations } = allocateLeaveDays(
      1,
      '2026-06-15',
      { carryOverAvailable: 5, baseAvailable: 0 },
      { ...CONFIG, carryOverDeadline: '06-30' } // still within deadline
    );
    expect(allocations).toEqual([{ isCarryOver: true, days: 1 }]);
  });
});
