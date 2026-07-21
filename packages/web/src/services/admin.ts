import type { EntitlementConfig } from "@urlaub/shared";
import type { Api } from "../lib/api";
import type { UserRole } from "./me";

export interface AdminUser {
  id: string;
  clerkId: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  region: string;
  employmentStartDate: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface InviteUserPayload {
  email: string;
  role?: UserRole;
}

export interface UpdateUserPayload {
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdateSettingsPayload {
  statutoryDays?: number;
  contractualDays?: number;
  carryOverDeadline?: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogParams {
  limit?: number;
  cursor?: string;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  nextCursor?: string | null;
}

export function listUsers(api: Api): Promise<AdminUser[]> {
  return api.apiFetch<AdminUser[]>("/admin/users");
}

export function inviteUser(api: Api, payload: InviteUserPayload): Promise<AdminUser> {
  return api.apiFetch<AdminUser>("/admin/users/invite", { method: "POST", body: payload });
}

export function updateUser(
  api: Api,
  id: string,
  payload: UpdateUserPayload
): Promise<AdminUser> {
  return api.apiFetch<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: payload });
}

export function getSettings(api: Api): Promise<EntitlementConfig> {
  return api.apiFetch<EntitlementConfig>("/settings");
}

export function updateSettings(
  api: Api,
  payload: UpdateSettingsPayload
): Promise<EntitlementConfig> {
  return api.apiFetch<EntitlementConfig>("/settings", { method: "PATCH", body: payload });
}

export function getAuditLog(
  api: Api,
  params: AuditLogParams = {}
): Promise<AuditLogResponse> {
  return api.apiFetch<AuditLogResponse>("/admin/audit-log", {
    method: "GET",
    query: { limit: params.limit, cursor: params.cursor },
  });
}
