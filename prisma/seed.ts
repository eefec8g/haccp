import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seed HACCP Maison Givre...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await db.user.upsert({
    where: { email: 'admin@maison-givre.fr' },
    update: {},
    create: {
      email: 'admin@maison-givre.fr',
      password: passwordHash,
      name: 'Admin Maison Givre',
      role: 'ADMIN',
    },
  });

  console.log('✅ Seed termine');
  console.log('   Admin :', admin.email, '(Password123!)');
  console.log(
    '   → Connecte-toi et cree tes boutiques / equipements / utilisateurs depuis /admin'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
