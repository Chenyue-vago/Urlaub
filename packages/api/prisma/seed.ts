import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { countWorkDaysByYear } from "@urlaub/shared";

// Intentionally its own PrismaClient, not the app's singleton from src/db.ts:
// this script is a standalone CLI entry point (run via `prisma db seed`), not
// part of the running server process, so it has no reason to share the
// app's connection lifecycle.
const prisma = new PrismaClient();

// Seeded users all use placeholder clerkIds (dev_*) that cannot actually sign
// in via Clerk. Their DATA (leave requests) is what populates the admin and
// timeline views for the real demo user, who authenticates via Clerk with an
// @vago-solutions.ai email and gets a `member` row created by resolveUser on
// first login. This seed is idempotent: users are upserted by email, and all
// leave_requests belonging to seeded users are wiped and recreated each run.

const ADMIN_USERS = [
  {
    clerkId: "dev_admin_founder1",
    email: "founder1@vago-solutions.ai",
    displayName: "Alex Founder",
    role: "admin" as const,
    region: "BW",
    employmentStartDate: new Date("2016-01-15"),
  },
  {
    clerkId: "dev_admin_founder2",
    email: "founder2@vago-solutions.ai",
    displayName: "Sam Founder",
    role: "admin" as const,
    region: "BW",
    employmentStartDate: new Date("2016-01-15"),
  },
  {
    clerkId: "dev_admin_assistant",
    email: "assistant@vago-solutions.ai",
    displayName: "Jamie Assistant",
    role: "admin" as const,
    region: "BW",
    employmentStartDate: new Date("2019-04-01"),
  },
];

const MEMBER_NAMES = [
  "Dana",
  "Chris",
  "Robin",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Quinn",
];

const MEMBER_USERS = MEMBER_NAMES.map((name, i) => ({
  clerkId: `dev_member_${i + 1}`,
  email: `dev${i + 1}@vago-solutions.ai`,
  displayName: `${name} Developer`,
  role: "member" as const,
  region: "BW",
  // Well in the past -> full entitlement, no proration.
  employmentStartDate: new Date(2021, i % 9, 1),
}));

const ALL_USERS = [...ADMIN_USERS, ...MEMBER_USERS];

function decimalWorkDays(days: number): Prisma.Decimal {
  return new Prisma.Decimal(days.toFixed(1));
}

async function main() {
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      statutoryDays: 20,
      contractualDays: 8,
      carryOverDeadline: "03-31",
    },
  });

  for (const user of ALL_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        clerkId: user.clerkId,
        displayName: user.displayName,
        role: user.role,
        region: user.region,
        employmentStartDate: user.employmentStartDate,
        isActive: true,
      },
      create: {
        ...user,
        isActive: true,
      },
    });
  }

  const dbUsers = await prisma.user.findMany({
    where: { email: { in: ALL_USERS.map((u) => u.email) } },
  });
  const byEmail = new Map(dbUsers.map((u) => [u.email, u]));
  const admin = byEmail.get("founder1@vago-solutions.ai")!;
  const members = MEMBER_USERS.map((u) => byEmail.get(u.email)!);

  // Clean slate for seeded users' leave requests so re-running the seed
  // never duplicates rows.
  await prisma.leaveRequest.deleteMany({
    where: { userId: { in: dbUsers.map((u) => u.id) } },
  });

  type NewLeave = Omit<
    Prisma.LeaveRequestCreateManyInput,
    "id" | "createdAt" | "updatedAt"
  >;

  const rows: NewLeave[] = [];

  function addSingleYear(opts: {
    userId: string;
    start: string;
    end: string;
    type: "statutory" | "contractual";
    status: "approved" | "pending";
    reason: string;
    workDaysOverride?: number;
  }) {
    const groupId = randomUUID();
    const [segment] = countWorkDaysByYear(opts.start, opts.end, "BW");
    const workDays = opts.workDaysOverride ?? segment.days;
    rows.push({
      groupId,
      userId: opts.userId,
      startDate: new Date(opts.start),
      endDate: new Date(opts.end),
      workDays: decimalWorkDays(workDays),
      type: opts.type,
      year: segment.year,
      isCarryOver: false,
      status: opts.status,
      reason: opts.reason,
      decidedById: opts.status === "approved" ? admin.id : null,
      decidedAt: opts.status === "approved" ? new Date() : null,
      decisionNote: opts.status === "approved" ? "Approved for demo." : null,
    });
  }

  function addCrossYear(opts: {
    userId: string;
    start: string;
    end: string;
    type: "statutory" | "contractual";
    status: "approved" | "pending";
    reason: string;
  }) {
    const groupId = randomUUID();
    const segments = countWorkDaysByYear(opts.start, opts.end, "BW");
    for (const segment of segments) {
      rows.push({
        groupId,
        userId: opts.userId,
        startDate: new Date(segment.startDate),
        endDate: new Date(segment.endDate),
        workDays: decimalWorkDays(segment.days),
        type: opts.type,
        year: segment.year,
        isCarryOver: false,
        status: opts.status,
        reason: opts.reason,
        decidedById: opts.status === "approved" ? admin.id : null,
        decidedAt: opts.status === "approved" ? new Date() : null,
        decisionNote: opts.status === "approved" ? "Approved for demo." : null,
      });
    }
  }

  // --- Approved vacations around the current demo date (2026-07-21) ---
  addSingleYear({
    userId: members[0].id, // Dana
    start: "2026-07-06",
    end: "2026-07-10",
    type: "statutory",
    status: "approved",
    reason: "Summer trip",
  });
  addSingleYear({
    userId: members[1].id, // Chris
    start: "2026-07-13",
    end: "2026-07-17",
    type: "contractual",
    status: "approved",
    reason: "Family visit",
  });
  addSingleYear({
    userId: members[2].id, // Robin
    start: "2026-07-20",
    end: "2026-07-24",
    type: "statutory",
    status: "approved",
    reason: "Beach week",
  });
  addSingleYear({
    userId: members[3].id, // Jordan
    start: "2026-08-03",
    end: "2026-08-07",
    type: "statutory",
    status: "approved",
    reason: "Road trip",
  });
  addSingleYear({
    userId: members[4].id, // Taylor
    start: "2026-08-10",
    end: "2026-08-14",
    type: "contractual",
    status: "approved",
    reason: "Wedding",
  });
  addSingleYear({
    userId: members[5].id, // Morgan
    start: "2026-06-15",
    end: "2026-06-19",
    type: "statutory",
    status: "approved",
    reason: "City break",
  });
  // Half-day approved request to show fractional workDays rendering.
  addSingleYear({
    userId: members[6].id, // Casey
    start: "2026-07-21",
    end: "2026-07-21",
    type: "contractual",
    status: "approved",
    reason: "Doctor's appointment",
    workDaysOverride: 0.5,
  });

  // --- Pending requests for the Admin Approvals Queue ---
  addSingleYear({
    userId: members[7].id, // Riley
    start: "2026-08-24",
    end: "2026-08-28",
    type: "statutory",
    status: "pending",
    reason: "Late summer holiday",
  });
  addSingleYear({
    userId: members[8].id, // Quinn
    start: "2026-09-07",
    end: "2026-09-09",
    type: "contractual",
    status: "pending",
    reason: "Long weekend",
  });

  // Cross-year pending request, stored as two groupId-linked segments.
  addCrossYear({
    userId: members[0].id, // Dana
    start: "2026-12-30",
    end: "2027-01-06",
    type: "statutory",
    status: "pending",
    reason: "New Year's trip",
  });

  await prisma.leaveRequest.createMany({ data: rows });

  console.log(
    `Seed complete: ${ALL_USERS.length} users (3 admins, ${MEMBER_USERS.length} members), 1 app_settings row, ${rows.length} leave_requests.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
