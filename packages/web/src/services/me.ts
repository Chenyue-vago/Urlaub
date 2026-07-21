import type { Api } from "../lib/api";

export type UserRole = "admin" | "member";

export interface MeResponse {
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

export interface UpdateMePayload {
  region?: string;
  displayName?: string;
  employmentStartDate?: string;
}

export function getMe(api: Api): Promise<MeResponse> {
  return api.apiFetch<MeResponse>("/me");
}

export function updateMe(api: Api, payload: UpdateMePayload): Promise<MeResponse> {
  return api.apiFetch<MeResponse>("/me", { method: "PATCH", body: payload });
}
