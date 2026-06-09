import { supabase } from '../lib/supabase';
import { NewVacationRecord, VacationRecord } from '../types';

export interface VacationRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  work_days: number;
  description: string;
  type: 'statutory' | 'contractual';
  is_carry_over: boolean;
  year: number;
  created_at: string;
}

export function rowToRecord(row: VacationRow): VacationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    startDate: row.start_date,
    endDate: row.end_date,
    workDays: Number(row.work_days),
    description: row.description,
    type: row.type,
    isCarryOver: row.is_carry_over,
    year: row.year,
    createdAt: row.created_at,
  };
}

export function recordToRow(
  record: NewVacationRecord,
  userId: string
): Omit<VacationRow, 'id' | 'created_at'> {
  return {
    user_id: userId,
    start_date: record.startDate,
    end_date: record.endDate,
    work_days: record.workDays,
    description: record.description,
    type: record.type,
    is_carry_over: record.isCarryOver ?? false,
    year: record.year,
  };
}

// RLS scopes results to the caller automatically; userId filter is for admins
// viewing a specific user's records.
export async function listVacations(userId?: string): Promise<VacationRecord[]> {
  let query = supabase
    .from('vacation_records')
    .select('*')
    .order('start_date', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as VacationRow[]).map(rowToRecord);
}

export async function createVacations(
  records: NewVacationRecord[],
  userId: string
): Promise<VacationRecord[]> {
  const rows = records.map((record) => recordToRow(record, userId));
  const { data, error } = await supabase
    .from('vacation_records')
    .insert(rows)
    .select();
  if (error) throw error;
  return (data as VacationRow[]).map(rowToRecord);
}

export async function deleteVacation(id: string): Promise<void> {
  const { error } = await supabase.from('vacation_records').delete().eq('id', id);
  if (error) throw error;
}
