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

  const boutique = await db.boutique.upsert({
    where: { id: 'boutique-paris-11' },
    update: {},
    create: {
      id: 'boutique-paris-11',
      nom: 'MG Paris 11',
      adresse: '12 rue Oberkampf',
      ville: 'Paris',
    },
  });

  const responsable = await db.user.upsert({
    where: { email: 'karim@maison-givre.fr' },
    update: {},
    create: {
      email: 'karim@maison-givre.fr',
      password: passwordHash,
      name: 'Karim Responsable',
      role: 'RESPONSABLE',
    },
  });

  await db.boutiqueUser.upsert({
    where: {
      boutiqueId_userId: { boutiqueId: boutique.id, userId: responsable.id },
    },
    update: {},
    create: { boutiqueId: boutique.id, userId: responsable.id },
  });

  const salarie = await db.user.upsert({
    where: { email: 'lea@maison-givre.fr' },
    update: {},
    create: {
      email: 'lea@maison-givre.fr',
      password: passwordHash,
      name: 'Lea Salariee',
      role: 'SALARIE',
      boutiqueSalarieId: boutique.id,
    },
  });

  await db.equipement.upsert({
    where: { id: 'cgl-01' },
    update: {},
    create: {
      id: 'cgl-01',
      nom: 'CGL-01',
      type: 'CONGELATEUR',
      seuilMin: -25,
      seuilMax: -18,
      boutiqueId: boutique.id,
    },
  });

  await db.equipement.upsert({
    where: { id: 'vit-01' },
    update: {},
    create: {
      id: 'vit-01',
      nom: 'Vitrine 01',
      type: 'VITRINE',
      seuilMin: -18,
      seuilMax: -10,
      boutiqueId: boutique.id,
    },
  });

  console.log('✅ Seed termine');
  console.log('   Admin       :', admin.email, '(Password123!)');
  console.log('   Responsable :', responsable.email, '(Password123!)');
  console.log('   Salarie     :', salarie.email, '(Password123!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
