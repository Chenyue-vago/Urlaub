import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "../queryClient";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveRequest,
  listLeaveRequests,
  rejectLeaveRequest,
  type CreateLeaveRequestPayload,
  type ListLeaveRequestsParams,
} from "../services/leave";
import { useApi } from "./useApi";

export const leaveListQueryKey = (params: ListLeaveRequestsParams) =>
  ["leave-requests", params] as const;
export const leaveDetailQueryKey = (id: string) => ["leave-requests", "detail", id] as const;
export const balanceQueryKey = (params: { year?: number; userId?: string }) =>
  ["balance", params] as const;

function invalidateLeaveQueries() {
  queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
  queryClient.invalidateQueries({ queryKey: ["balance"] });
  queryClient.invalidateQueries({ queryKey: ["calendar"] });
  // Approvals/rejections/cancellations/creations all write an audit row, so
  // refresh the admin audit log too.
  queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
}

export function useLeaveRequests(params: ListLeaveRequestsParams = {}) {
  const api = useApi();
  return useQuery({
    queryKey: leaveListQueryKey(params),
    queryFn: () => listLeaveRequests(api, params),
  });
}

export function useLeaveRequest(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: leaveDetailQueryKey(id ?? ""),
    queryFn: () => getLeaveRequest(api, id as string),
    enabled: Boolean(id),
  });
}

export function useCreateLeaveRequest() {
  const api = useApi();
  return useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) => createLeaveRequest(api, payload),
    onSuccess: invalidateLeaveQueries,
  });
}

export function useCancelLeaveRequest() {
  const api = useApi();
  return useMutation({
    mutationFn: (id: string) => cancelLeaveRequest(api, id),
    onSuccess: invalidateLeaveQueries,
  });
}

export function useApproveLeaveRequest() {
  const api = useApi();
  return useMutation({
    mutationFn: (id: string) => approveLeaveRequest(api, id),
    onSuccess: invalidateLeaveQueries,
  });
}

export function useRejectLeaveRequest() {
  const api = useApi();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectLeaveRequest(api, id, note),
    onSuccess: invalidateLeaveQueries,
  });
}
