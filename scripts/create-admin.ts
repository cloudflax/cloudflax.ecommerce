import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';

const ADMIN_EMAIL = 'jose.guerrero@cloudflax.com';
const ADMIN_PASSWORD = 'password';

async function main() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN', password },
    create: { email: ADMIN_EMAIL, password, role: 'ADMIN' },
  });

  console.log(`Admin listo: ${admin.email} (role: ${admin.role})`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
