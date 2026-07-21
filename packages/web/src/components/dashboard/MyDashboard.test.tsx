import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../../lib/api";
import { LanguageProvider } from "../../i18n";
import { ToastProvider } from "../Toast";
import { MyDashboard } from "./MyDashboard";

vi.mock("../../hooks/useApi", () => ({
  useApi: () => ({}),
}));

const getMe = vi.fn();
const updateMe = vi.fn();
vi.mock("../../services/me", () => ({
  getMe: (...args: unknown[]) => getMe(...args),
  updateMe: (...args: unknown[]) => updateMe(...args),
}));

const getBalance = vi.fn();
vi.mock("../../services/balance", () => ({
  getBalance: (...args: unknown[]) => getBalance(...args),
}));

const listLeaveRequests = vi.fn();
const createLeaveRequest = vi.fn();
const cancelLeaveRequest = vi.fn();
vi.mock("../../services/leave", () => ({
  listLeaveRequests: (...args: unknown[]) => listLeaveRequests(...args),
  createLeaveRequest: (...args: unknown[]) => createLeaveRequest(...args),
  cancelLeaveRequest: (...args: unknown[]) => cancelLeaveRequest(...args),
  getLeaveRequest: vi.fn(),
  approveLeaveRequest: vi.fn(),
  rejectLeaveRequest: vi.fn(),
}));

const meResponse = {
  id: "u1",
  clerkId: "c1",
  email: "a@b.com",
  displayName: "A",
  role: "member" as const,
  region: "BW",
  employmentStartDate: "2020-01-01",
  isActive: true,
  createdAt: "2020-01-01T00:00:00.000Z",
};

const balanceResponse = {
  year: 2026,
  statutoryTotal: 20,
  contractualTotal: 8,
  statutoryUsed: 0,
  contractualUsed: 0,
  statutoryRemaining: 20,
  contractualRemaining: 8,
  carryOver: 0,
  carryOverUsed: 0,
  carryOverExpired: 0,
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ToastProvider>
          <MyDashboard />
        </ToastProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue(meResponse);
  getBalance.mockResolvedValue(balanceResponse);
  listLeaveRequests.mockResolvedValue([]);
});

async function openAndFillModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Request Vacation"));
  const startInput = screen.getByLabelText("Start date");
  const endInput = screen.getByLabelText("End date");
  await user.type(startInput, "2026-07-06");
  await user.type(endInput, "2026-07-07");
}

describe("request → status flow", () => {
  it("shows a pending badge after a successful submit", async () => {
    const user = userEvent.setup();
    const pendingRecord = {
      id: "req1",
      groupId: "g1",
      userId: "u1",
      startDate: "2026-07-06",
      endDate: "2026-07-07",
      workDays: 2,
      type: "statutory",
      year: 2026,
      isCarryOver: false,
      status: "pending",
      reason: "",
      decidedById: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
    };
    createLeaveRequest.mockResolvedValue([pendingRecord]);
    listLeaveRequests.mockResolvedValueOnce([]).mockResolvedValue([pendingRecord]);

    renderDashboard();
    await waitFor(() => expect(screen.getByText("Request Vacation")).toBeInTheDocument());

    await openAndFillModal(user);
    await user.click(screen.getByText("Submit"));

    await waitFor(() => expect(createLeaveRequest).toHaveBeenCalled());

    await waitFor(() => {
      expect(screen.getByTestId("status-badge")).toHaveTextContent("Pending");
    });
  });

  it("surfaces an error toast and adds no row when balance is insufficient", async () => {
    const user = userEvent.setup();
    createLeaveRequest.mockRejectedValue(
      new ApiError("Not enough balance", "insufficient_balance", 400)
    );

    renderDashboard();
    await waitFor(() => expect(screen.getByText("Request Vacation")).toBeInTheDocument());

    await openAndFillModal(user);
    await user.click(screen.getByText("Submit"));

    await waitFor(() => expect(createLeaveRequest).toHaveBeenCalled());

    await waitFor(() => {
      expect(
        screen.getByText("You do not have enough vacation balance for this request")
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("status-badge")).not.toBeInTheDocument();
  });
});
