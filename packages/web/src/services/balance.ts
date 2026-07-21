import type { YearlyVacationStats } from "@urlaub/shared";
import type { Api } from "../lib/api";

export interface GetBalanceParams {
  year?: number;
  userId?: string;
}

export function getBalance(
  api: Api,
  params: GetBalanceParams = {}
): Promise<YearlyVacationStats> {
  return api.apiFetch<YearlyVacationStats>("/balance", {
    method: "GET",
    query: { year: params.year, userId: params.userId },
  });
}
