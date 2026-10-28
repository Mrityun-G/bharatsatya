import { prisma } from '../src/prisma.js';

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      institution: { select: { id: true, name: true } },
    },
    orderBy: { role: 'asc' },
  });

  const appCount = await prisma.application.count();
  const ruleCount = await prisma.validationRule.count();
  const docCount = await prisma.document.count();

  console.log('=== Database Status ===');
  console.log(`Applications: ${appCount}`);
  console.log(`Validation Rules: ${ruleCount}`);
  console.log(`Documents: ${docCount}`);
  console.log('=== Registered User Accounts ===');
  for (const u of users) {
    console.log(`[Role: ${u.role}] ${u.name} <${u.email}> - Inst: ${u.institution?.name || 'N/A'}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
