import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppSettings } from '../types';
import { getSettings, updateSettings } from '../services/settings';
import { DEFAULT_ENTITLEMENT, EntitlementConfig } from '../utils';

const KEY = ['settings'];

// `enabled` gates the query until the user is authenticated —
// app_settings RLS rejects anonymous reads.
export function useSettings(enabled: boolean = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: getSettings,
    staleTime: 5 * 60_000,
    enabled,
  });
}

// Convenience: settings as EntitlementConfig with safe fallback while loading
export function useEntitlementConfig(enabled: boolean = true): EntitlementConfig {
  const { data } = useSettings(enabled);
  if (!data) return DEFAULT_ENTITLEMENT;
  return {
    statutoryDays: data.statutoryDays,
    contractualDays: data.contractualDays,
    carryOverDeadline: data.carryOverDeadline,
  };
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: AppSettings) => updateSettings(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
