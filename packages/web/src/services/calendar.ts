import type { VacationType } from "@urlaub/shared";
import type { Api } from "../lib/api";
import type { LeaveStatus } from "./leave";

export interface CalendarEntry {
  id: string;
  userId: string;
  userDisplayName: string | null;
  startDate: string;
  endDate: string;
  type: VacationType;
  status: LeaveStatus;
}

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
