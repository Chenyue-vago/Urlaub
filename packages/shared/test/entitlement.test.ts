import { describe, it, expect } from 'vitest';
import {
  getYearlyEntitlement,
  calculateYearlyStats,
  calculateCarryOver,
  countWorkDays,
  countWorkDaysByYear,
  isWithinCarryOverPeriod,
} from '../src/entitlement.js';
import { DEFAULT_ENTITLEMENT, EntitlementConfig, VacationRecord } from '../src/types.js';

const CUSTOM: EntitlementConfig = {
  totalDays: 30,
  carryOverDeadline: '12-31',
};

function rec(partial: Partial<VacationRecord>): VacationRecord {
  return {
    id: 'r1',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    workDays: 1,
    description: '',
    year: 2026,
    createdAt: '2026-06-01T00:00:00Z',
    ...partial,
  };
}

describe('countWorkDaysByYear', () => {
  it('returns one segment per year for a cross-year split', () => {
    const segs = countWorkDaysByYear('2025-12-29', '2026-01-03', 'BW');
    expect(segs.map(s => s.year)).toEqual([2025, 2026]);
  });

  it('returns a single segment when start/end are in the same year', () => {
    const segs = countWorkDaysByYear('2026-06-01', '2026-06-05', 'BW');
    expect(segs.map(s => s.year)).toEqual([2026]);
  });
});

describe('countWorkDays / public holiday exclusion', () => {
  it('excludes a fixed-date public holiday that falls on a weekday (Tag der Deutschen Einheit, 2025-10-03 is a Friday)', () => {
    // 2025-09-29 (Mon) .. 2025-10-03 (Fri): 5 calendar weekdays, no weekend in
    // between, but Oct 3 is a BW public holiday, so only 4 should count.
    const plainWeekdays = 5;
    const days = countWorkDays('2025-09-29', '2025-10-03', 'BW');
    expect(days).toBe(plainWeekdays - 1);
    expect(days).toBe(4);
  });

  it('excludes a fixed-date public holiday across a year boundary (New Year\'s Day, 2026-01-01 is a Thursday)', () => {
    // 2025-12-30 (Tue) .. 2026-01-02 (Fri): 4 calendar weekdays, no weekend in
    // between, but Jan 1 is a public holiday everywhere, so only 3 should count.
    const plainWeekdays = 4;
    const days = countWorkDays('2025-12-30', '2026-01-02', 'BW');
    expect(days).toBe(plainWeekdays - 1);
    expect(days).toBe(3);

    const segs = countWorkDaysByYear('2025-12-30', '2026-01-02', 'BW');
    expect(segs.map(s => s.year)).toEqual([2025, 2026]);
    // 2025-12-30, 2025-12-31 both count; 2026-01-01 (holiday) excluded, 2026-01-02 counts.
    expect(segs.find(s => s.year === 2025)!.days).toBe(2);
    expect(segs.find(s => s.year === 2026)!.days).toBe(1);
  });
});

describe('getYearlyEntitlement (single 28-day pool)', () => {
  it('returns the default total (28) when no employment start date', () => {
    expect(getYearlyEntitlement(2026)).toEqual({ total: 28 });
  });

  it('returns the custom total when no employment start date', () => {
    expect(getYearlyEntitlement(2026, CUSTOM)).toEqual({ total: 30 });
  });

  it('is pro-rated by employment start month', () => {
    const e = getYearlyEntitlement(2026, DEFAULT_ENTITLEMENT, '2026-07-01');
    expect(e.total).toBe(Math.ceil((28 * 6) / 12)); // 14
  });

  it('config overrides hardcoded defaults', () => {
    const e = getYearlyEntitlement(2026, { totalDays: 30, carryOverDeadline: '12-31' });
    expect(e.total).toBe(30);
  });

  it('returns zero before employment start year', () => {
    expect(getYearlyEntitlement(2025, DEFAULT_ENTITLEMENT, '2026-07-15')).toEqual({ total: 0 });
  });
});

describe('calculateYearlyStats (single pool)', () => {
  it('uses injected config for the total', () => {
    const stats = calculateYearlyStats([], 2026, 0, undefined, CUSTOM);
    expect(stats.total).toBe(30);
  });

  it('adds carry-over on top of the yearly total', () => {
    // 28 base + 5 carried in = 33 available. Use 6 days before the deadline, so
    // all 5 carried-in days are consumed (none expire) plus 1 base day.
    const records = [rec({ workDays: 6, year: 2026 })];
    const stats = calculateYearlyStats(records, 2026, 5);
    expect(stats.total).toBe(28);
    expect(stats.carryOver).toBe(5);
    expect(stats.carryOverUsed).toBe(5);
    expect(stats.carryOverExpired).toBe(0);
    expect(stats.used).toBe(6);
    expect(stats.remaining).toBe(33 - 6); // 27
  });

  it('counts carry-over used only before the deadline (default 12-31)', () => {
    // Carried-in days must be consumed by Dec 31; a request dated in the
    // following year does not draw down THIS year's carry-over.
    const records = [
      rec({ startDate: '2026-06-01', endDate: '2026-06-01', workDays: 3, year: 2026 }),
    ];
    const stats = calculateYearlyStats(records, 2026, 4);
    expect(stats.carryOverUsed).toBe(3);
    expect(stats.carryOverExpired).toBe(1);
  });

  it('respects a custom carry-over deadline', () => {
    const config: EntitlementConfig = { ...DEFAULT_ENTITLEMENT, carryOverDeadline: '06-30' };
    const records = [
      rec({ startDate: '2026-05-01', endDate: '2026-05-01', workDays: 2, year: 2026 }),
    ];
    const stats = calculateYearlyStats(records, 2026, 4, undefined, config);
    expect(stats.carryOverUsed).toBe(2);
  });
});

describe('isWithinCarryOverPeriod', () => {
  it('uses the default 12-31 deadline when no config is given', () => {
    // Carried from 2025 → usable through 2026-12-31.
    expect(isWithinCarryOverPeriod(2025, new Date(2026, 11, 31))).toBe(true);
    expect(isWithinCarryOverPeriod(2025, new Date(2027, 0, 1))).toBe(false);
  });

  it('respects a custom carry-over deadline from config', () => {
    const config: EntitlementConfig = { ...DEFAULT_ENTITLEMENT, carryOverDeadline: '06-30' };
    expect(isWithinCarryOverPeriod(2025, new Date(2026, 5, 30), config)).toBe(true);
    expect(isWithinCarryOverPeriod(2025, new Date(2026, 6, 1), config)).toBe(false);
  });
});

describe('calculateCarryOver', () => {
  it('carries over all unused days (no type distinction)', () => {
    const records = [
      rec({ startDate: '2025-08-01', endDate: '2025-08-01', workDays: 15, year: 2025 }),
    ];
    // 28 total - 15 used = 13 carried into the next year.
    expect(calculateCarryOver(records, 2025)).toBe(13);
  });

  it('does NOT chain carry-over: only the base allowance can roll forward', () => {
    // 2026 has 28 base + 9 carried in from 2025, and 21 days are used.
    // Requests consume carry-over first, so the 9 carried-in days are used up
    // and 12 base days are used. Only the base leftover (28 - 12 = 16) rolls
    // into 2027 — the carried-in days do NOT chain forward.
    const records = [
      rec({ startDate: '2026-06-01', endDate: '2026-06-01', workDays: 21, year: 2026 }),
    ];
    expect(calculateCarryOver(records, 2026, undefined, DEFAULT_ENTITLEMENT, 9)).toBe(16);
  });

  it('carried-in days unused by the deadline expire, not carry forward', () => {
    // 28 base + 9 carried in; only 5 days used. Carry-over-first consumes 5 of
    // the 9 carried-in (4 expire), base untouched → 28 base rolls to next year.
    const records = [
      rec({ startDate: '2026-06-01', endDate: '2026-06-01', workDays: 5, year: 2026 }),
    ];
    expect(calculateCarryOver(records, 2026, undefined, DEFAULT_ENTITLEMENT, 9)).toBe(28);
  });
});
