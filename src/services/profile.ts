import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { RegionCode } from '../regions';

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
  region: string;
  employment_start_date: string | null;
  is_active: boolean;
  created_at: string;
}

export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    region: row.region as RegionCode,
    employmentStartDate: row.employment_start_date,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export interface ProfileUpdate {
  displayName?: string;
  region?: RegionCode;
  employmentStartDate?: string;
}

export async function updateProfile(
  userId: string,
  update: ProfileUpdate
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (update.displayName !== undefined) row.display_name = update.displayName;
  if (update.region !== undefined) row.region = update.region;
  if (update.employmentStartDate !== undefined) {
    row.employment_start_date = update.employmentStartDate;
  }
  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}
