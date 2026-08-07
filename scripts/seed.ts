import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';
import { requireDevEnv } from './require-dev-env';

const PASSWORD = 'password';

const SEED_USERS = [
  { email: 'jose.guerrero@resend.dev', role: 'ADMIN' as const },
  { email: 'cliente.test@resend.dev', role: 'CUSTOMER' as const },
  { email: 'repartidor.test@resend.dev', role: 'DELIVERY' as const },
];

async function main() {
  requireDevEnv();

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const password = await bcrypt.hash(PASSWORD, 10);

  for (const { email, role } of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role, password, emailVerified: new Date() },
      create: { email, password, role, emailVerified: new Date() },
    });
    console.log(`${user.role} listo: ${user.email}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
