import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "../queryClient";
import {
  getAuditLog,
  getSettings,
  inviteUser,
  listUsers,
  updateSettings,
  updateUser,
  type AuditLogParams,
  type InviteUserPayload,
  type UpdateSettingsPayload,
  type UpdateUserPayload,
} from "../services/admin";
import { useApi } from "./useApi";

export const adminUsersQueryKey = ["admin", "users"] as const;
export const settingsQueryKey = ["settings"] as const;
export const auditLogQueryKey = (params: AuditLogParams) =>
  ["admin", "audit-log", params] as const;

export function useAdminUsers() {
  const api = useApi();
  return useQuery({
    queryKey: adminUsersQueryKey,
    queryFn: () => listUsers(api),
  });
}

export function useInviteUser() {
  const api = useApi();
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(api, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}

export function useUpdateUser() {
  const api = useApi();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      updateUser(api, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
      // Role changes / (de)activations are audited — refresh the log.
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
    },
  });
}

export function useSettings() {
  const api = useApi();
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: () => getSettings(api),
  });
}

export function useUpdateSettings() {
  const api = useApi();
  return useMutation({
    mutationFn: (payload: UpdateSettingsPayload) => updateSettings(api, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKey });
    },
  });
}

export function useAuditLog(params: AuditLogParams = {}) {
  const api = useApi();
  return useQuery({
    queryKey: auditLogQueryKey(params),
    queryFn: () => getAuditLog(api, params),
  });
}
