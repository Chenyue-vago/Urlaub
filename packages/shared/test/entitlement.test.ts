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
  statutoryDays: 25,
  contractualDays: 5,
  carryOverDeadline: '03-31',
};

function rec(partial: Partial<VacationRecord>): VacationRecord {
  return {
    id: 'r1',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    workDays: 1,
    description: '',
    type: 'statutory',
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

describe('getYearlyEntitlement', () => {
  it('returns default config values when no employment start date', () => {
    expect(getYearlyEntitlement(2026)).toEqual({
      statutoryTotal: 20,
      contractualTotal: 8,
    });
  });

  it('returns custom config values when no employment start date', () => {
    expect(getYearlyEntitlement(2026, CUSTOM)).toEqual({
      statutoryTotal: 25,
      contractualTotal: 5,
    });
  });

  it('is pro-rated by employment start month', () => {
    const e = getYearlyEntitlement(2026, DEFAULT_ENTITLEMENT, '2026-07-01');
    expect(e.statutoryTotal).toBe(Math.ceil((20 * 6) / 12)); // 10
  });

  it('config overrides hardcoded defaults', () => {
    const e = getYearlyEntitlement(2026, { statutoryDays: 30, contractualDays: 0, carryOverDeadline: '03-31' });
    expect(e.statutoryTotal).toBe(30);
  });

  it('returns zero before employment start year', () => {
    expect(getYearlyEntitlement(2025, DEFAULT_ENTITLEMENT, '2026-07-15')).toEqual({
      statutoryTotal: 0,
      contractualTotal: 0,
    });
  });
});

describe('calculateYearlyStats', () => {
  it('uses injected config for totals', () => {
    const stats = calculateYearlyStats([], 2026, 0, undefined, CUSTOM);
    expect(stats.statutoryTotal).toBe(25);
    expect(stats.contractualTotal).toBe(5);
  });

  it('counts carry-over used only before the deadline', () => {
    const records = [
      rec({ startDate: '2026-02-01', endDate: '2026-02-01', workDays: 3, year: 2026 }),
      rec({ id: 'r2', startDate: '2026-05-01', endDate: '2026-05-01', workDays: 2, year: 2026 }),
    ];
    const stats = calculateYearlyStats(records, 2026, 4, undefined);
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
  it('uses the default 03-31 deadline when no config is given', () => {
    expect(isWithinCarryOverPeriod(2025, new Date(2026, 2, 31))).toBe(true);
    expect(isWithinCarryOverPeriod(2025, new Date(2026, 3, 1))).toBe(false);
  });

  it('respects a custom carry-over deadline from config', () => {
    const config: EntitlementConfig = { ...DEFAULT_ENTITLEMENT, carryOverDeadline: '06-30' };
    // 04-01 would already be past the default 03-31 deadline, but is still
    // within a custom 06-30 deadline.
    expect(isWithinCarryOverPeriod(2025, new Date(2026, 3, 1), config)).toBe(true);
    expect(isWithinCarryOverPeriod(2025, new Date(2026, 6, 1), config)).toBe(false);
  });
});

describe('calculateCarryOver', () => {
  it('carries over unused statutory days', () => {
    const records = [
      rec({ startDate: '2025-08-01', endDate: '2025-08-01', workDays: 15, year: 2025 }),
    ];
    // 20 statutory - 15 used = 5 carried into 2026
    expect(calculateCarryOver(records, 2025)).toBe(5);
  });
});
