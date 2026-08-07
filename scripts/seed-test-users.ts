import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';

const TEST_PASSWORD = 'password';

const TEST_USERS = [
  { email: 'cliente.test@cloudflax.com', role: 'CUSTOMER' as const },
  { email: 'repartidor.test@cloudflax.com', role: 'DELIVERY' as const },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const password = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const { email, role } of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role, password },
      create: { email, password, role },
    });
    console.log(`${user.role} listo: ${user.email}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
