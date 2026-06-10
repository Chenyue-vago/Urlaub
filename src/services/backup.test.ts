import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup } from './backup';
import { VacationRecord } from '../types';

const record: VacationRecord = {
  id: 'abc',
  userId: 'u1',
  startDate: '2026-01-05',
  endDate: '2026-01-09',
  workDays: 5,
  description: 'Ski trip',
  type: 'statutory',
  isCarryOver: true,
  year: 2026,
  createdAt: '2026-01-01T10:00:00Z',
};

describe('buildBackup', () => {
  it('strips id, userId and createdAt from records', () => {
    const backup = buildBackup([record]);
    expect(backup.schemaVersion).toBe(2);
    expect(backup.records).toEqual([
      {
        startDate: '2026-01-05',
        endDate: '2026-01-09',
        workDays: 5,
        description: 'Ski trip',
        type: 'statutory',
        isCarryOver: true,
        year: 2026,
      },
    ]);
  });
});

describe('parseBackup', () => {
  it('round-trips a v2 backup', () => {
    const backup = buildBackup([record]);
    expect(parseBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup.records);
  });

  it('reads the legacy v1 localStorage backup format', () => {
    const legacy = {
      schemaVersion: 1,
      exportedAt: '2025-12-01T00:00:00Z',
      data: {
        urlaub_manager_data: JSON.stringify([
          {
            id: 'old-1',
            startDate: '2025-06-02',
            endDate: '2025-06-06',
            workDays: 5,
            description: 'Sommer（合同假期）',
            type: 'contractual',
            year: 2025,
            createdAt: '2025-06-01T00:00:00Z',
          },
        ]),
        urlaub_region: 'BW',
      },
    };
    expect(parseBackup(legacy)).toEqual([
      {
        startDate: '2025-06-02',
        endDate: '2025-06-06',
        workDays: 5,
        description: 'Sommer',
        type: 'contractual',
        isCarryOver: false,
        year: 2025,
      },
    ]);
  });

  it('infers carry-over from the legacy description hint', () => {
    const legacy = {
      schemaVersion: 1,
      exportedAt: '2025-12-01T00:00:00Z',
      data: {
        urlaub_manager_data: JSON.stringify([
          {
            id: 'old-2',
            startDate: '2025-02-03',
            endDate: '2025-02-03',
            workDays: 1,
            description: 'Vacation (carry-over first)',
            type: 'statutory',
            year: 2025,
            createdAt: '2025-02-01T00:00:00Z',
          },
        ]),
      },
    };
    expect(parseBackup(legacy)).toEqual([
      {
        startDate: '2025-02-03',
        endDate: '2025-02-03',
        workDays: 1,
        description: '',
        type: 'statutory',
        isCarryOver: true,
        year: 2025,
      },
    ]);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup(null)).toThrow();
    expect(() => parseBackup({ foo: 'bar' })).toThrow();
    expect(() => parseBackup({ schemaVersion: 2, records: 'nope' })).toThrow();
  });

  it('rejects records with invalid fields', () => {
    expect(() =>
      parseBackup({
        schemaVersion: 2,
        records: [{ ...record, startDate: 'not-a-date' }],
      })
    ).toThrow();
    expect(() =>
      parseBackup({
        schemaVersion: 2,
        records: [{ ...record, workDays: 0 }],
      })
    ).toThrow();
    expect(() =>
      parseBackup({
        schemaVersion: 2,
        records: [{ ...record, type: 'sick-leave' }],
      })
    ).toThrow();
  });

  it('rejects backups with no records', () => {
    expect(() => parseBackup({ schemaVersion: 2, records: [] })).toThrow();
  });
});
