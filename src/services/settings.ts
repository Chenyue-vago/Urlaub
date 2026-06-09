import { supabase } from '../lib/supabase';
import { AppSettings } from '../types';

interface SettingsRow {
  id: number;
  statutory_days: number;
  contractual_days: number;
  carry_over_deadline: string;
  updated_at: string;
}

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  const row = data as SettingsRow;
  return {
    statutoryDays: row.statutory_days,
    contractualDays: row.contractual_days,
    carryOverDeadline: row.carry_over_deadline,
  };
}

export async function updateSettings(settings: AppSettings): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .update({
      statutory_days: settings.statutoryDays,
      contractual_days: settings.contractualDays,
      carry_over_deadline: settings.carryOverDeadline,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) throw error;
}
