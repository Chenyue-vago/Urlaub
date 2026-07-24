import { describe, it, expect } from 'vitest';
import { allocateLeaveDays } from '../src/allocate.js';
import { DEFAULT_ENTITLEMENT } from '../src/types.js';

const CONFIG = DEFAULT_ENTITLEMENT; // carryOverDeadline "03-31"

const AVAIL = {
  carryOverAvailable: 0,
  contractualAvailable: 0,
  statutoryAvailable: 0,
};

describe('allocateLeaveDays', () => {
  it('draws from base statutory when only statutory is available', () => {
    const { allocations, shortfall } = allocateLeaveDays(
      3,
      '2026-06-10',
      { ...AVAIL, statutoryAvailable: 20 },
      CONFIG
    );
    expect(shortfall).toBe(0);
    expect(allocations).toEqual([{ type: 'statutory', isCarryOver: false, days: 3 }]);
  });

  it('follows priority: carry-over statutory, then contractual, then base statutory', () => {
    // 10 days: 2 carry-over + 3 contractual + 5 base statutory
    const { allocations, shortfall } = allocateLeaveDays(
      10,
      '2026-03-15', // before the 03-31 deadline, so carry-over is eligible
      { carryOverAvailable: 2, contractualAvailable: 3, statutoryAvailable: 20 },
      CONFIG
    );
    expect(shortfall).toBe(0);
    expect(allocations).toEqual([
      { type: 'statutory', isCarryOver: true, days: 2 },
      { type: 'contractual', isCarryOver: false, days: 3 },
      { type: 'statutory', isCarryOver: false, days: 5 },
    ]);
  });

  it('skips carry-over when the period ends after the deadline', () => {
    const { allocations, shortfall } = allocateLeaveDays(
      4,
      '2026-04-01', // after 03-31: carry-over not usable
      { carryOverAvailable: 5, contractualAvailable: 0, statutoryAvailable: 20 },
      CONFIG
    );
    expect(shortfall).toBe(0);
    // no carry-over bucket produced; all base statutory
    expect(allocations).toEqual([{ type: 'statutory', isCarryOver: false, days: 4 }]);
  });

  it('uses carry-over on the deadline day itself (<=)', () => {
    const { allocations } = allocateLeaveDays(
      1,
      '2026-03-31',
      { carryOverAvailable: 5, contractualAvailable: 0, statutoryAvailable: 0 },
      CONFIG
    );
    expect(allocations).toEqual([{ type: 'statutory', isCarryOver: true, days: 1 }]);
  });

  it('prefers contractual over base statutory (contractual expires at year end, cannot carry over)', () => {
    const { allocations } = allocateLeaveDays(
      2,
      '2026-06-01',
      { carryOverAvailable: 0, contractualAvailable: 5, statutoryAvailable: 5 },
      CONFIG
    );
    expect(allocations).toEqual([{ type: 'contractual', isCarryOver: false, days: 2 }]);
  });

  it('omits zero-day buckets', () => {
    const { allocations } = allocateLeaveDays(
      3,
      '2026-06-01',
      { carryOverAvailable: 0, contractualAvailable: 3, statutoryAvailable: 20 },
      CONFIG
    );
    // exactly fills contractual; no statutory row appended
    expect(allocations).toEqual([{ type: 'contractual', isCarryOver: false, days: 3 }]);
  });

  it('reports shortfall when all buckets together are insufficient', () => {
    const { allocations, shortfall } = allocateLeaveDays(
      10,
      '2026-06-01',
      { carryOverAvailable: 0, contractualAvailable: 3, statutoryAvailable: 4 },
      CONFIG
    );
    expect(shortfall).toBe(3); // 10 - 3 - 4
    // still reports what it could allocate
    expect(allocations).toEqual([
      { type: 'contractual', isCarryOver: false, days: 3 },
      { type: 'statutory', isCarryOver: false, days: 4 },
    ]);
  });

  it('honors a custom carry-over deadline from config', () => {
    const { allocations } = allocateLeaveDays(
      1,
      '2026-06-15',
      { carryOverAvailable: 5, contractualAvailable: 0, statutoryAvailable: 0 },
      { ...CONFIG, carryOverDeadline: '06-30' } // deadline pushed out
    );
    expect(allocations).toEqual([{ type: 'statutory', isCarryOver: true, days: 1 }]);
  });
});
