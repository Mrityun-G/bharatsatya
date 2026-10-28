import { PrismaClient } from './generated/prisma/index.js';

// Rule re-evaluation rewrites every finding inside one transaction. Against a hosted
// database each statement is a network round trip, so Prisma's 5 s default is too short.
export const prisma = new PrismaClient({
  transactionOptions: { maxWait: 10_000, timeout: 60_000 },
});
export default prisma;
