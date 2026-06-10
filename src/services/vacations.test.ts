import { describe, it, expect, vi } from 'vitest';

// vacations.ts imports the live Supabase client (lib/supabase), which calls
// createClient() at module load. On Node < 22 that throws ("no native
// WebSocket"). These tests only cover the pure row mappers, so stub the
// client module to avoid constructing a real one.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { rowToRecord, recordToRow, VacationRow } from './vacations';
import { NewVacationRecord } from '../types';

describe('vacation row mapping', () => {
  const row: VacationRow = {
    id: 'abc',
    user_id: 'u1',
    start_date: '2026-01-05',
    end_date: '2026-01-09',
    work_days: 5,
    description: 'Ski trip',
    type: 'statutory',
    is_carry_over: true,
    year: 2026,
    created_at: '2026-01-01T10:00:00Z',
  };

  it('maps a DB row to a VacationRecord', () => {
    expect(rowToRecord(row)).toEqual({
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
    });
  });

  it('maps a NewVacationRecord to an insertable row', () => {
    const record: NewVacationRecord = {
      startDate: '2026-01-05',
      endDate: '2026-01-09',
      workDays: 5,
      description: '',
      type: 'contractual',
      isCarryOver: false,
      year: 2026,
    };
    expect(recordToRow(record, 'u1')).toEqual({
      user_id: 'u1',
      start_date: '2026-01-05',
      end_date: '2026-01-09',
      work_days: 5,
      description: '',
      type: 'contractual',
      is_carry_over: false,
      year: 2026,
    });
  });
});
