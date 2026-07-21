import type { CalendarEntryDTO } from "@urlaub/shared";
import type { Api } from "../lib/api";

// HTTP contract shared with the API (see @urlaub/shared/contracts).
export type CalendarEntry = CalendarEntryDTO;

export interface GetCalendarParams {
  from: string;
  to: string;
}

export function getCalendar(api: Api, params: GetCalendarParams): Promise<CalendarEntry[]> {
  return api.apiFetch<CalendarEntry[]>("/calendar", {
    method: "GET",
    query: { from: params.from, to: params.to },
  });
}
