import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "../queryClient";
import { getMe, updateMe, type UpdateMePayload } from "../services/me";
import { useApi } from "./useApi";

export const meQueryKey = ["me"] as const;

export function useMe() {
  const api = useApi();
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => getMe(api),
  });
}

export function useUpdateMe() {
  const api = useApi();
  return useMutation({
    mutationFn: (payload: UpdateMePayload) => updateMe(api, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}
