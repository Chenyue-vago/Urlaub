import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "../../i18n";
import { queryClient } from "../../queryClient";
import { AuditLog } from "./AuditLog";

vi.mock("../../hooks/useApi", () => ({ useApi: () => ({}) }));

const getAuditLog = vi.fn();
const listUsers = vi.fn();
vi.mock("../../services/admin", () => ({
  getAuditLog: (...a: unknown[]) => getAuditLog(...a),
  listUsers: (...a: unknown[]) => listUsers(...a),
  inviteUser: vi.fn(),
  updateUser: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

const users = [
  { id: "u_zhou", clerkId: "c1", email: "zhou@vago-solutions.ai", displayName: "Zhou", role: "member", region: "BW", employmentStartDate: "2020-01-01", isActive: true, createdAt: "2020-01-01T00:00:00.000Z" },
  { id: "u_admin", clerkId: "c2", email: "admin@vago-solutions.ai", displayName: "Admin", role: "admin", region: "BW", employmentStartDate: "2020-01-01", isActive: true, createdAt: "2020-01-01T00:00:00.000Z" },
];

const cancelEntry = {
  id: "audit1",
  actorId: "u_zhou",
  action: "cancel_leave",
  targetType: "leave_group",
  targetId: "g1",
  metadata: { targetUserId: "u_zhou", startDate: "2026-08-10", endDate: "2026-08-14" },
  createdAt: "2026-07-26T10:00:00.000Z",
};

function renderLog() {
  queryClient.clear();
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuditLog />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listUsers.mockResolvedValue(users);
  getAuditLog.mockResolvedValue({ items: [cancelEntry], nextCursor: null });
});

describe("AuditLog detail expand", () => {
  it("clicking a row reveals a readable detail sentence with names and dates", async () => {
    const user = userEvent.setup();
    renderLog();

    // Collapsed initially: action label shows, detail not yet
    const row = await screen.findByText("cancel_leave");
    expect(screen.queryByTestId("audit-detail")).not.toBeInTheDocument();

    await user.click(row);

    await waitFor(() => expect(screen.getByTestId("audit-detail")).toBeInTheDocument());
    const detail = screen.getByTestId("audit-detail");
    expect(detail.textContent).toContain("Zhou");
    expect(detail.textContent).toContain("2026-08-10");
    expect(detail.textContent).toContain("2026-08-14");
    expect(detail.textContent?.toLowerCase()).toContain("cancelled");
  });
});
