import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../i18n";
import { PublicHolidays } from "./PublicHolidays";

function renderIt(year = 2026, region: "NW" = "NW") {
  return render(
    <LanguageProvider>
      <PublicHolidays year={year} region={region} />
    </LanguageProvider>
  );
}

describe("PublicHolidays", () => {
  it("renders a titled list of the state's public holidays for the year", () => {
    renderIt(2026, "NW");
    // Heading mentions the year and the (English default) region name.
    const heading = screen.getByRole("heading");
    expect(heading.textContent).toMatch(/2026/);
    expect(heading.textContent).toMatch(/North Rhine-Westphalia/);
  });

  it("includes New Year's Day (a stable public holiday) as a dated card", () => {
    renderIt(2026, "NW");
    expect(screen.getByTestId("holiday-2026-01-01")).toBeInTheDocument();
  });

  it("renders more than one holiday card", () => {
    renderIt(2026, "NW");
    const cards = screen.getAllByTestId(/^holiday-\d{4}-\d{2}-\d{2}$/);
    expect(cards.length).toBeGreaterThan(1);
  });
});
