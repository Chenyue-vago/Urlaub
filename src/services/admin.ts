import { supabase } from '../lib/supabase';
import { Profile, VacationRecord } from '../types';
import { ProfileRow, rowToProfile } from './profile';
import { VacationRow, rowToRecord } from './vacations';

// Admin-only (RLS rejects these for normal users).

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as ProfileRow[]).map(rowToProfile);
}

export async function listAllVacations(): Promise<VacationRecord[]> {
  const { data, error } = await supabase.from('vacation_records').select('*');
  if (error) throw error;
  return (data as VacationRow[]).map(rowToRecord);
}

export async function setUserRole(
  userId: string,
  role: 'user' | 'admin'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}

export async function setUserActive(
  userId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);
  if (error) throw error;
}
