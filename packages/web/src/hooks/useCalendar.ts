import { useQuery } from "@tanstack/react-query";
import { getCalendar, type GetCalendarParams } from "../services/calendar";
import { useApi } from "./useApi";

export function useCalendar(params: GetCalendarParams) {
  const api = useApi();
  return useQuery({
    queryKey: ["calendar", params] as const,
    queryFn: () => getCalendar(api, params),
  });
}
