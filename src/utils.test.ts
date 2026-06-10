import { describe, it, expect } from 'vitest';
import {
  getYearlyEntitlement,
  calculateYearlyStats,
  calculateCarryOver,
  DEFAULT_ENTITLEMENT,
  EntitlementConfig,
} from './utils';
import { VacationRecord } from './types';

const CUSTOM: EntitlementConfig = {
  statutoryDays: 25,
  contractualDays: 5,
  carryOverDeadline: '03-31',
};

function rec(partial: Partial<VacationRecord>): VacationRecord {
  return {
    id: 'r1',
    userId: 'u1',
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

describe('getYearlyEntitlement', () => {
  it('returns config values when no employment start date', () => {
    expect(getYearlyEntitlement(2026, undefined, CUSTOM)).toEqual({
      statutoryTotal: 25,
      contractualTotal: 5,
    });
  });

  it('defaults to 20/8 when config omitted', () => {
    expect(getYearlyEntitlement(2026)).toEqual({
      statutoryTotal: 20,
      contractualTotal: 8,
    });
  });

  it('pro-rates the start year by remaining months', () => {
    // start July 2026 -> 6 eligible months -> ceil(20*6/12)=10, ceil(8*6/12)=4
    expect(getYearlyEntitlement(2026, '2026-07-15')).toEqual({
      statutoryTotal: 10,
      contractualTotal: 4,
    });
  });

  it('returns zero before employment start year', () => {
    expect(getYearlyEntitlement(2025, '2026-07-15')).toEqual({
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
    expect(stats.carryOverUsed).toBe(3); // only the Feb record is before 03-31
    expect(stats.carryOverExpired).toBe(1); // 4 - 3
  });

  it('respects a custom carry-over deadline', () => {
    const config: EntitlementConfig = { ...DEFAULT_ENTITLEMENT, carryOverDeadline: '06-30' };
    const records = [
      rec({ startDate: '2026-05-01', endDate: '2026-05-01', workDays: 2, year: 2026 }),
    ];
    const stats = calculateYearlyStats(records, 2026, 4, undefined, config);
    expect(stats.carryOverUsed).toBe(2); // May is before 06-30 now
  });
});

describe('calculateCarryOver', () => {
  it('carries over unused statutory days', () => {
    const records = [
      rec({ startDate: '2025-08-01', endDate: '2025-08-01', workDays: 15, year: 2025 }),
    ];
    // 20 statutory - 15 used = 5 carried into 2026
    expect(calculateCarryOver(records, 2025, undefined)).toBe(5);
  });
});
