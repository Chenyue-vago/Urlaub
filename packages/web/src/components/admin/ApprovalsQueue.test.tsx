import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "../../i18n";
import { ToastProvider } from "../Toast";
import { queryClient } from "../../queryClient";
import { ApprovalsQueue } from "./ApprovalsQueue";

vi.mock("../../hooks/useApi", () => ({
  useApi: () => ({}),
}));

const listLeaveRequests = vi.fn();
const approveLeaveRequest = vi.fn();
const rejectLeaveRequest = vi.fn();
vi.mock("../../services/leave", () => ({
  listLeaveRequests: (...args: unknown[]) => listLeaveRequests(...args),
  approveLeaveRequest: (...args: unknown[]) => approveLeaveRequest(...args),
  rejectLeaveRequest: (...args: unknown[]) => rejectLeaveRequest(...args),
  getLeaveRequest: vi.fn(),
  createLeaveRequest: vi.fn(),
  cancelLeaveRequest: vi.fn(),
}));

const listUsers = vi.fn();
vi.mock("../../services/admin", () => ({
  listUsers: (...args: unknown[]) => listUsers(...args),
  inviteUser: vi.fn(),
  updateUser: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getAuditLog: vi.fn(),
}));

const pendingRecord = {
  id: "req1",
  groupId: "g1",
  userId: "u1",
  startDate: "2026-08-10",
  endDate: "2026-08-14",
  workDays: 5,
  type: "statutory" as const,
  year: 2026,
  isCarryOver: false,
  status: "pending" as const,
  reason: "Summer trip",
  decidedById: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
};

const adminUser = {
  id: "u1",
  clerkId: "c1",
  email: "alice@example.com",
  displayName: "Alice Doe",
  role: "member" as const,
  region: "BW",
  employmentStartDate: "2020-01-01",
  isActive: true,
  createdAt: "2020-01-01T00:00:00.000Z",
};

function renderQueue() {
  queryClient.clear();
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ToastProvider>
          <ApprovalsQueue />
        </ToastProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listLeaveRequests.mockResolvedValue([pendingRecord]);
  listUsers.mockResolvedValue([adminUser]);
});

describe("ApprovalsQueue", () => {
  it("shows the requester name and dates for a pending group", async () => {
    renderQueue();
    await waitFor(() => expect(screen.getByText("Alice Doe")).toBeInTheDocument());
    expect(screen.getByText(/10\.08\.2026/)).toBeInTheDocument();
    expect(screen.getByText(/14\.08\.2026/)).toBeInTheDocument();
  });

  it("calls approve with the request id when clicking Approve", async () => {
    const user = userEvent.setup();
    approveLeaveRequest.mockResolvedValue({ ...pendingRecord, status: "approved" });
    renderQueue();

    await waitFor(() => expect(screen.getByText("Alice Doe")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => expect(approveLeaveRequest).toHaveBeenCalledWith(expect.anything(), "req1"));
  });

  it("does not call reject when the note prompt is empty", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("");
    renderQueue();

    await waitFor(() => expect(screen.getByText("Alice Doe")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /reject/i }));

    expect(rejectLeaveRequest).not.toHaveBeenCalled();
  });

  it("calls reject with the note when provided", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Not enough coverage");
    rejectLeaveRequest.mockResolvedValue({ ...pendingRecord, status: "rejected" });
    renderQueue();

    await waitFor(() => expect(screen.getByText("Alice Doe")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() =>
      expect(rejectLeaveRequest).toHaveBeenCalledWith(expect.anything(), "req1", "Not enough coverage")
    );
  });
});
