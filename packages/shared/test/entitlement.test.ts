import { describe, it, expect } from 'vitest';
import {
  getYearlyEntitlement,
  calculateYearlyStats,
  calculateCarryOver,
  countWorkDaysByYear,
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

describe('calculateCarryOver', () => {
  it('carries over unused statutory days', () => {
    const records = [
      rec({ startDate: '2025-08-01', endDate: '2025-08-01', workDays: 15, year: 2025 }),
    ];
    // 20 statutory - 15 used = 5 carried into 2026
    expect(calculateCarryOver(records, 2025)).toBe(5);
  });
});
