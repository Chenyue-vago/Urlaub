import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "../queryClient";
import { getMe, updateMe, type UpdateMePayload } from "../services/me";
import { useApi } from "./useApi";
import { Sentry } from "../sentry";

export const meQueryKey = ["me"] as const;

export function useMe() {
  const api = useApi();
  const query = useQuery({
    queryKey: meQueryKey,
    queryFn: () => getMe(api),
  });

  // Tag client-side errors with the signed-in user so we can see who hit them.
  // Idempotent (same value re-set); no-op when Sentry has no DSN.
  useEffect(() => {
    if (query.data) {
      Sentry.setUser({ id: query.data.id, email: query.data.email });
    }
  }, [query.data]);

  return query;
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
