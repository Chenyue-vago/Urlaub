import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "../../i18n";
import { TeamCalendar } from "./TeamCalendar";
import type { CalendarEntry } from "../../services/calendar";

function entry(partial: Partial<CalendarEntry>): CalendarEntry {
  return {
    id: "e1",
    userId: "u1",
    userDisplayName: "Anna",
    startDate: "2026-07-06",
    endDate: "2026-07-08",
    type: "statutory",
    status: "approved",
    ...partial,
  };
}

function renderCal(entries: CalendarEntry[]) {
  return render(
    <LanguageProvider>
      {/* July 2026: month index 6 */}
      <TeamCalendar entries={entries} year={2026} month={6} />
    </LanguageProvider>
  );
}

describe("TeamCalendar", () => {
  it("renders a day cell for every day of the month", () => {
    renderCal([]);
    // July has 31 days
    expect(screen.getByTestId("day-2026-07-01")).toBeInTheDocument();
    expect(screen.getByTestId("day-2026-07-31")).toBeInTheDocument();
    expect(screen.queryByTestId("day-2026-07-32")).not.toBeInTheDocument();
  });

  it("lists a person on each day within their leave span (inclusive)", () => {
    renderCal([entry({ userDisplayName: "Anna", startDate: "2026-07-06", endDate: "2026-07-08" })]);
    for (const day of ["06", "07", "08"]) {
      const cell = screen.getByTestId(`day-2026-07-${day}`);
      expect(within(cell).getByText("Anna")).toBeInTheDocument();
    }
    // day 05 and 09 must NOT list Anna
    expect(within(screen.getByTestId("day-2026-07-05")).queryByText("Anna")).toBeNull();
    expect(within(screen.getByTestId("day-2026-07-09")).queryByText("Anna")).toBeNull();
  });

  it("shows multiple people on the same day", () => {
    renderCal([
      entry({ id: "e1", userId: "u1", userDisplayName: "Anna", startDate: "2026-07-10", endDate: "2026-07-10" }),
      entry({ id: "e2", userId: "u2", userDisplayName: "Ben", startDate: "2026-07-10", endDate: "2026-07-10" }),
    ]);
    const cell = screen.getByTestId("day-2026-07-10");
    expect(within(cell).getByText("Anna")).toBeInTheDocument();
    expect(within(cell).getByText("Ben")).toBeInTheDocument();
  });

  it("clips leave spans that start before or end after the visible month", () => {
    renderCal([entry({ userDisplayName: "Clara", startDate: "2026-06-28", endDate: "2026-07-02" })]);
    expect(within(screen.getByTestId("day-2026-07-01")).getByText("Clara")).toBeInTheDocument();
    expect(within(screen.getByTestId("day-2026-07-02")).getByText("Clara")).toBeInTheDocument();
    expect(within(screen.getByTestId("day-2026-07-03")).queryByText("Clara")).toBeNull();
  });
});
