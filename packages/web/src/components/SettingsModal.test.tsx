import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "../i18n";
import { queryClient } from "../queryClient";
import { SettingsModal } from "./SettingsModal";

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

function renderIt(onClose = vi.fn()) {
  queryClient.clear();
  render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <SettingsModal onClose={onClose} />
      </LanguageProvider>
    </QueryClientProvider>
  );
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue(meResponse);
  updateMe.mockResolvedValue({ ...meResponse, employmentStartDate: "2021-06-01" });
});

describe("SettingsModal", () => {
  it("prefills the employment start date from the profile", async () => {
    renderIt();
    const input = (await screen.findByLabelText("Employment start date")) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("2020-01-01"));
  });

  it("saves the new date via PATCH /me and closes", async () => {
    const user = userEvent.setup();
    const onClose = renderIt();
    const input = (await screen.findByLabelText("Employment start date")) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("2020-01-01"));

    await user.clear(input);
    await user.type(input, "2021-06-01");
    await user.click(screen.getByText("Save"));

    await waitFor(() => expect(updateMe).toHaveBeenCalled());
    expect(updateMe.mock.calls[0][1]).toEqual({ employmentStartDate: "2021-06-01" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("cancel closes without saving", async () => {
    const user = userEvent.setup();
    const onClose = renderIt();
    await screen.findByLabelText("Employment start date");
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
    expect(updateMe).not.toHaveBeenCalled();
  });
});
