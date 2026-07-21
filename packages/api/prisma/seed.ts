import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  const users = [
    {
      clerkId: "dev_admin_1",
      email: "admin1@vago-solutions.ai",
      displayName: "Dev Admin One",
      role: "admin" as const,
      employmentStartDate: new Date("2018-01-15"),
    },
    {
      clerkId: "dev_admin_2",
      email: "admin2@vago-solutions.ai",
      displayName: "Dev Admin Two",
      role: "admin" as const,
      employmentStartDate: new Date("2019-06-01"),
    },
    {
      clerkId: "dev_admin_3",
      email: "admin3@vago-solutions.ai",
      displayName: "Dev Admin Three",
      role: "admin" as const,
    },
    {
      clerkId: "dev_member_1",
      email: "member1@vago-solutions.ai",
      displayName: "Dev Member One",
      role: "member" as const,
      employmentStartDate: new Date("2022-03-01"),
    },
    {
      clerkId: "dev_member_2",
      email: "member2@vago-solutions.ai",
      displayName: "Dev Member Two",
      role: "member" as const,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        clerkId: user.clerkId,
        displayName: user.displayName,
        role: user.role,
        employmentStartDate: user.employmentStartDate,
      },
      create: user,
    });
  }

  console.log(`Seed complete: ${users.length} users + app_settings row.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
