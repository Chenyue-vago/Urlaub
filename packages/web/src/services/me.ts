import type { MeDTO, UserRole as SharedUserRole } from "@urlaub/shared";
import type { Api } from "../lib/api";

export type UserRole = SharedUserRole;

// The HTTP contract lives in @urlaub/shared so producer (API) and consumer
// (this client) can't drift apart silently.
export type MeResponse = MeDTO;

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
