import { useQuery } from "@tanstack/react-query";
import { getBalance, type GetBalanceParams } from "../services/balance";
import { useApi } from "./useApi";
import { balanceQueryKey } from "./useLeave";

export function useBalance(params: GetBalanceParams = {}) {
  const api = useApi();
  return useQuery({
    queryKey: balanceQueryKey(params),
    queryFn: () => getBalance(api, params),
  });
}
