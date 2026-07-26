import { useAuth } from "@clerk/clerk-react";
import { useMemo } from "react";
import { createApi } from "../lib/api";

/**
 * Builds an Api instance bound to the current Clerk session token.
 * Shared by all the other hooks in this directory.
 */
export function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => createApi(() => getToken()), [getToken]);
}
