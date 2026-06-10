import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAllVacations,
  listProfiles,
  setUserActive,
  setUserRole,
} from '../services/admin';

const USERS_KEY = ['admin', 'users'];
const ALL_VACATIONS_KEY = ['admin', 'vacations'];

export function useAdminUsers(enabled: boolean) {
  return useQuery({ queryKey: USERS_KEY, queryFn: listProfiles, enabled });
}

export function useAdminVacations(enabled: boolean) {
  return useQuery({
    queryKey: ALL_VACATIONS_KEY,
    queryFn: listAllVacations,
    enabled,
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'user' | 'admin' }) =>
      setUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setUserActive(userId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
