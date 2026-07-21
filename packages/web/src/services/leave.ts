import type { VacationType, LeaveRequestDTO, LeaveStatus as SharedLeaveStatus } from "@urlaub/shared";
import type { Api } from "../lib/api";

export type LeaveStatus = SharedLeaveStatus;

// HTTP contract shared with the API (see @urlaub/shared/contracts).
export type LeaveRequestResponse = LeaveRequestDTO;

export interface ListLeaveRequestsParams {
  year?: number;
  userId?: string;
}

export interface CreateLeaveRequestPayload {
  startDate: string;
  endDate: string;
  type: VacationType;
  reason?: string;
  userId?: string;
}

export function listLeaveRequests(
  api: Api,
  params: ListLeaveRequestsParams = {}
): Promise<LeaveRequestResponse[]> {
  return api.apiFetch<LeaveRequestResponse[]>("/leave-requests", {
    method: "GET",
    query: { year: params.year, userId: params.userId },
  });
}

export function createLeaveRequest(
  api: Api,
  payload: CreateLeaveRequestPayload
): Promise<LeaveRequestResponse[]> {
  return api.apiFetch<LeaveRequestResponse[]>("/leave-requests", {
    method: "POST",
    body: payload,
  });
}

export function getLeaveRequest(api: Api, id: string): Promise<LeaveRequestResponse> {
  return api.apiFetch<LeaveRequestResponse>(`/leave-requests/${id}`);
}

export function cancelLeaveRequest(api: Api, id: string): Promise<LeaveRequestResponse> {
  return api.apiFetch<LeaveRequestResponse>(`/leave-requests/${id}/cancel`, { method: "POST" });
}

export function approveLeaveRequest(api: Api, id: string): Promise<LeaveRequestResponse> {
  return api.apiFetch<LeaveRequestResponse>(`/leave-requests/${id}/approve`, { method: "POST" });
}

export function rejectLeaveRequest(
  api: Api,
  id: string,
  note: string
): Promise<LeaveRequestResponse> {
  return api.apiFetch<LeaveRequestResponse>(`/leave-requests/${id}/reject`, {
    method: "POST",
    body: { note },
  });
}
