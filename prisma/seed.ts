import { PrismaClient, TypeEquipement, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

/**
 * Cout bcrypt aligne sur `BCRYPT_ROUNDS` (src/lib/constants/auth.ts) :
 * 12 rounds, requis par EX-AUTH-005 (CCF.md).
 */
const BCRYPT_ROUNDS = 12;

/**
 * Boutique E2E stable : on `upsert` par un id deterministe pour garantir
 * l'idempotence (re-run du seed sans dupliquer la boutique ni casser les
 * rattachements). L'id reste un uuid valide pour respecter le format des
 * autres entites.
 */
const E2E_BOUTIQUE_ID = '00000000-0000-4000-8000-000000000001';

interface SeedUserSpec {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly role: UserRole;
}

interface SeedEquipementSpec {
  readonly nom: string;
  readonly type: TypeEquipement;
  readonly seuilMin: number;
  readonly seuilMax: number;
}

const ADMIN: SeedUserSpec = {
  email: 'admin@maison-givre.fr',
  password: 'AdminPass1!aaaa',
  name: 'Admin Maison Givre',
  role: UserRole.ADMIN,
};

const RESPONSABLE: SeedUserSpec = {
  email: 'resp@maison-givre.fr',
  password: 'RespPass1!aaaa',
  name: 'Responsable Maison Givre',
  role: UserRole.RESPONSABLE,
};

const SALARIE: SeedUserSpec = {
  email: 'lea@maison-givre.fr',
  password: 'Secret123!aaaa',
  name: 'Lea Salariee',
  role: UserRole.SALARIE,
};

const E2E_EQUIPEMENTS: readonly SeedEquipementSpec[] = [
  {
    nom: 'Congelo E2E',
    type: TypeEquipement.CONGELATEUR,
    seuilMin: -25,
    seuilMax: -18,
  },
  {
    nom: 'Frigo E2E',
    type: TypeEquipement.CHAMBRE_FROIDE,
    seuilMin: 0,
    seuilMax: 4,
  },
  {
    nom: 'Vitrine E2E',
    type: TypeEquipement.VITRINE,
    seuilMin: -20,
    seuilMax: -14,
  },
];

/**
 * Cree (ou met a jour) un utilisateur par email. Idempotent : un re-run
 * garantit que le compte est conforme au spec (mot de passe INCLUS), ce qui
 * est essentiel pour les comptes E2E -- un compte preexistant avec un autre
 * mot de passe (ancien seed) doit etre re-aligne, sinon le login E2E echoue
 * avec "Email ou mot de passe incorrect".
 *
 * `boutiqueSalarieId` n'est rattache que pour un SALARIE.
 */
async function upsertUser(
  spec: SeedUserSpec,
  boutiqueSalarieId: string | null
): Promise<string> {
  const passwordHash = await bcrypt.hash(spec.password, BCRYPT_ROUNDS);
  const user = await db.user.upsert({
    where: { email: spec.email },
    update: {
      password: passwordHash,
      name: spec.name,
      role: spec.role,
      actif: true,
      boutiqueSalarieId,
    },
    create: {
      email: spec.email,
      password: passwordHash,
      name: spec.name,
      role: spec.role,
      actif: true,
      boutiqueSalarieId,
    },
  });
  return user.id;
}

async function main(): Promise<void> {
  console.log('🌱 Seed HACCP Maison Givre (jeu de donnees E2E)...');

  // 1. Boutique active stable.
  const boutique = await db.boutique.upsert({
    where: { id: E2E_BOUTIQUE_ID },
    update: { nom: 'MG E2E Lyon', ville: 'Lyon', actif: true },
    create: {
      id: E2E_BOUTIQUE_ID,
      nom: 'MG E2E Lyon',
      ville: 'Lyon',
      actif: true,
    },
  });

  // 2. Utilisateurs (admin global, responsable + salarie rattaches a la
  //    boutique E2E).
  await upsertUser(ADMIN, null);
  const responsableId = await upsertUser(RESPONSABLE, null);
  await upsertUser(SALARIE, boutique.id);

  // 3. Rattachement RESPONSABLE -> boutique via la join table BoutiqueUser
  //    (idempotent : upsert sur la cle composite).
  await db.boutiqueUser.upsert({
    where: {
      boutiqueId_userId: { boutiqueId: boutique.id, userId: responsableId },
    },
    update: {},
    create: { boutiqueId: boutique.id, userId: responsableId },
  });

  // 4. Equipements actifs de la boutique E2E. Idempotents : on cible une
  //    paire (boutiqueId, nom) en supprimant les eventuels doublons
  //    crees par d'anciens runs avant de (re)creer un exemplaire unique.
  for (const spec of E2E_EQUIPEMENTS) {
    const existing = await db.equipement.findFirst({
      where: { boutiqueId: boutique.id, nom: spec.nom },
      select: { id: true },
    });
    if (existing) {
      await db.equipement.update({
        where: { id: existing.id },
        data: {
          type: spec.type,
          seuilMin: spec.seuilMin,
          seuilMax: spec.seuilMax,
          actif: true,
        },
      });
    } else {
      await db.equipement.create({
        data: {
          nom: spec.nom,
          type: spec.type,
          seuilMin: spec.seuilMin,
          seuilMax: spec.seuilMax,
          actif: true,
          boutiqueId: boutique.id,
        },
      });
    }
  }

  console.log('✅ Seed termine');
  console.log(`   Admin       : ${ADMIN.email} (${ADMIN.password})`);
  console.log(
    `   Responsable : ${RESPONSABLE.email} (${RESPONSABLE.password})`
  );
  console.log(`   Salarie     : ${SALARIE.email} (${SALARIE.password})`);
  console.log(`   Boutique    : ${boutique.nom} (${boutique.id})`);
  console.log(
    `   Equipements : ${E2E_EQUIPEMENTS.map((e) => e.nom).join(', ')}`
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
