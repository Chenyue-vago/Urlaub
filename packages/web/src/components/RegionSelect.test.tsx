import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "../i18n";
import { queryClient } from "../queryClient";
import { RegionSelect } from "./RegionSelect";

vi.mock("../hooks/useApi", () => ({ useApi: () => ({}) }));

const getMe = vi.fn();
const updateMe = vi.fn();
vi.mock("../services/me", () => ({
  getMe: (...a: unknown[]) => getMe(...a),
  updateMe: (...a: unknown[]) => updateMe(...a),
}));

const meResponse = {
  id: "u1",
  clerkId: "c1",
  email: "a@vago-solutions.ai",
  displayName: "A",
  role: "member" as const,
  region: "NW",
  employmentStartDate: "2020-01-01",
  isActive: true,
  createdAt: "2020-01-01T00:00:00.000Z",
};

function renderIt() {
  queryClient.clear();
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <RegionSelect />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue(meResponse);
  updateMe.mockResolvedValue({ ...meResponse, region: "BY" });
});

describe("RegionSelect", () => {
  it("shows the current user's region as the selected value", async () => {
    renderIt();
    const select = (await screen.findByLabelText("Region")) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("NW"));
  });

  it("PATCHes /me with the new region on change", async () => {
    const user = userEvent.setup();
    renderIt();
    const select = (await screen.findByLabelText("Region")) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("NW"));

    await user.selectOptions(select, "BY");

    await waitFor(() => expect(updateMe).toHaveBeenCalled());
    const payload = updateMe.mock.calls[0][1];
    expect(payload).toEqual({ region: "BY" });
  });
});
