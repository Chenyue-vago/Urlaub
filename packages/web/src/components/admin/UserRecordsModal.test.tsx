import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "../../i18n";
import { queryClient } from "../../queryClient";
import { UserRecordsModal } from "./UserRecordsModal";

vi.mock("../../hooks/useApi", () => ({ useApi: () => ({}) }));

const listLeaveRequests = vi.fn();
vi.mock("../../services/leave", () => ({
  listLeaveRequests: (...args: unknown[]) => listLeaveRequests(...args),
  getLeaveRequest: vi.fn(),
  createLeaveRequest: vi.fn(),
  cancelLeaveRequest: vi.fn(),
  hideLeaveRequest: vi.fn(),
  approveLeaveRequest: vi.fn(),
  rejectLeaveRequest: vi.fn(),
}));

function rec(over: Record<string, unknown>) {
  return {
    id: "x",
    groupId: "gx",
    userId: "u1",
    startDate: "2026-08-10",
    endDate: "2026-08-14",
    workDays: 5,
    type: "statutory",
    year: 2026,
    isCarryOver: false,
    status: "approved",
    reason: "",
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

const user = {
  id: "u1",
  clerkId: "c1",
  email: "alice@example.com",
  displayName: "Alice",
  role: "member" as const,
  region: "BW",
  employmentStartDate: "2020-01-01",
  isActive: true,
  createdAt: "2020-01-01T00:00:00.000Z",
  usage: {} as never,
};

function renderModal() {
  queryClient.clear();
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <UserRecordsModal user={user} onClose={vi.fn()} />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UserRecordsModal", () => {
  it("excludes cancelled records but keeps approved, pending, and rejected", async () => {
    listLeaveRequests.mockResolvedValue([
      rec({ id: "appr", startDate: "2026-08-10", status: "approved" }),
      rec({ id: "pend", startDate: "2026-09-10", status: "pending" }),
      rec({ id: "rej", startDate: "2026-10-10", status: "rejected", reason: "Rejected one" }),
      rec({ id: "can", startDate: "2026-11-10", status: "cancelled", reason: "Cancelled one" }),
    ]);

    renderModal();

    // rejected is kept (for audit) — its reason renders
    await waitFor(() => expect(screen.getByText("Rejected one")).toBeInTheDocument());
    // cancelled is excluded — its reason must NOT render
    expect(screen.queryByText("Cancelled one")).not.toBeInTheDocument();

    // status badges: one each for approved/pending/rejected, none for cancelled
    expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument();
  });
});
