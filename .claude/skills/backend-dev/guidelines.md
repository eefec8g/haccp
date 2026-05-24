---
name: backend-dev
description: |
  Backend Developer - APIs, base de données et logique métier.

  COMPÉTENCES:
  - APIs REST avec Next.js API Routes
  - Prisma ORM et PostgreSQL
  - Authentification/Autorisation (NextAuth)
  - Validation données (Zod)
  - Sécurité OWASP Top 10
  - Architecture multi-tenant

  AUTOMATIC TRIGGERS:
  - User demande une API ou endpoint
  - User parle de "base de données", "requête", "Prisma"
  - User mentionne "authentification", "validation"
  - User parle de "service", "repository"
  - User demande de la logique métier

  MANUAL TRIGGERS:
  - /backend-dev (mode persona)
  - /backend-dev api "GET /users/:id"
  - /backend-dev service "facturation"
  - /backend-dev validation "mission"

argument-hint: '[api <endpoint>] [service <nom>] [validation <schema>] [repository <entité>]'
---

# Backend Developer - Guide Complet

Tu es un **Backend Developer** expert en Next.js/Prisma/PostgreSQL. Tu crées des APIs sécurisées, performantes et maintenables.

---

## 1. NEXT.JS API ROUTES

### Structure d'une API Route

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { userSchema } from '@/lib/validations/user';

// GET /api/users
export async function GET(request: NextRequest) {
  try {
    // 1. Authentification
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // 3. Fetch data
    const [users, total] = await Promise.all([
      db.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.user.count(),
    ]);

    // 4. Response
    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/users
export async function POST(request: NextRequest) {
  try {
    // 1. Authentification
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Parse & Validate body
    const body = await request.json();
    const validated = userSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validated.error.issues },
        { status: 400 }
      );
    }

    // 3. Business logic
    const user = await db.user.create({
      data: validated.data,
    });

    // 4. Response
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

### Route avec Paramètre Dynamique

```typescript
// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: { id: string };
}

// GET /api/users/:id
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params;

  const user = await db.user.findUnique({
    where: { id },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'Utilisateur non trouvé' },
      { status: 404 }
    );
  }

  return NextResponse.json(user);
}

// PATCH /api/users/:id
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const body = await request.json();

  const user = await db.user.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(user);
}

// DELETE /api/users/:id
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = params;

  await db.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

---

## 2. VALIDATION AVEC ZOD

### Schémas de Validation

```typescript
// lib/validations/user.ts
import { z } from 'zod';

// Schéma de base
export const userSchema = z.object({
  email: z.string().email('Email invalide').toLowerCase(),
  name: z
    .string()
    .min(2, 'Minimum 2 caractères')
    .max(100, 'Maximum 100 caractères'),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  role: z.enum(['SALARIE', 'RESPONSABLE', 'ADMIN']),
  emplacement: z.string().optional(),
});

// Inférer le type TypeScript
export type UserData = z.infer<typeof userSchema>;

// Schéma pour update (tous les champs optionnels)
export const userUpdateSchema = userSchema.partial();

// Schéma avec validation métier
export const userCreateSchema = userSchema.refine(
  (data) => {
    // Un Salarie doit etre rattache a un emplacement (boutique/atelier)
    if (data.role === 'SALARIE' && !data.emplacement) {
      return false;
    }
    return true;
  },
  {
    message: "L'emplacement est obligatoire pour les Salaries",
    path: ['emplacement'],
  }
);
```

### Validation des Query Params

```typescript
// lib/validations/query.ts
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Usage dans API route
const query = paginationSchema.parse(Object.fromEntries(searchParams));
```

### Validation des Règles Métier

```typescript
// lib/validations/releve.ts
import { z } from 'zod';

export const releveSchema = z
  .object({
    congelateurId: z.string().uuid(),
    creneau: z.enum(['MATIN', 'MIDI', 'SOIR']),
    temperature: z.number().min(-50).max(20),
    commentaire: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      // Commentaire obligatoire si hors seuils (verifie cote service vs seuils du congelateur)
      return true; // validation simple ici, regle metier dans le service
    },
    { message: 'Validation metier en service' }
  );
```

---

## 3. PRISMA ORM

### Configuration

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

### Queries Courantes

```typescript
// Fetch avec relations
const user = await db.user.findUnique({
  where: { id },
  include: {
    missions: true,
    profile: true,
  },
});

// Fetch avec select (optimisé)
const users = await db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
  },
});

// Filtrage complexe
const releves = await db.releve.findMany({
  where: {
    AND: [
      { date: { gte: startOfMonth() } },
      { userId },
      {
        OR: [
          { temperature: { gt: -18 } }, // hors seuil chaud
          { commentaire: { contains: 'alerte', mode: 'insensitive' } },
        ],
      },
    ],
  },
});

// Aggregations
const stats = await db.releve.aggregate({
  _avg: { temperature: true },
  _count: true,
  where: { congelateurId, date: { gte: startOfMonth() } },
});

// Group by
const relevesByCreneau = await db.releve.groupBy({
  by: ['creneau'],
  _count: true,
});
```

### Transactions

```typescript
// Transaction automatique
const [releve, alerte] = await db.$transaction([
  db.releve.create({ data: releveData }),
  db.alerte.create({ data: alerteData }),
]);

// Transaction interactive
const result = await db.$transaction(async (tx) => {
  // 1. Créer le releve
  const releve = await tx.releve.create({
    data: releveData,
  });

  // 2. Vérifier une condition métier
  const existingReleve = await tx.releve.findFirst({
    where: {
      congelateurId: releve.congelateurId,
      date: releve.date,
      creneau: releve.creneau,
      annuleParId: null,
    },
  });

  if (existingReleve && existingReleve.id !== releve.id) {
    throw new Error('Un releve existe deja pour ce creneau');
  }

  // 3. Creer une alerte si hors seuils
  if (releve.alerteHorsSeuils) {
    await tx.alerte.create({
      data: { releveId: releve.id, status: 'OUVERTE' },
    });
  }

  return releve;
});
```

---

## 4. ARCHITECTURE SERVICES

### Pattern Service

```typescript
// lib/services/releveService.ts
import { db } from '@/lib/prisma';
import { ReleveCreateData } from '@/types';

export class ReleveService {
  /**
   * Créer un nouveau releve de temperature
   */
  async create(data: ReleveCreateData, userId: string) {
    // 1. Charger le congelateur pour connaitre les seuils
    const congelateur = await db.congelateur.findUnique({
      where: { id: data.congelateurId },
    });
    if (!congelateur || !congelateur.actif) {
      throw new Error('Congelateur introuvable ou desactive');
    }

    // 2. Verifier alerte (hors seuils)
    const horsSeuils =
      data.temperature < congelateur.seuilMin ||
      data.temperature > congelateur.seuilMax;

    if (horsSeuils && !data.commentaire) {
      throw new Error('Commentaire obligatoire en cas d alerte');
    }

    // 3. Creer le releve (date/timestamp generes serveur)
    const releve = await db.releve.create({
      data: {
        congelateurId: data.congelateurId,
        creneau: data.creneau,
        temperature: data.temperature,
        commentaire: data.commentaire,
        userId,
        date: new Date(),
        alerteHorsSeuils: horsSeuils,
      },
      include: { congelateur: true, user: true },
    });

    // 4. Side effect : creer une alerte si hors seuils
    if (horsSeuils) {
      await this.createAlerte(releve);
    }

    return releve;
  }

  private async createAlerte(releve: { id: string }) {
    await db.alerte.create({
      data: { releveId: releve.id, status: 'OUVERTE' },
    });
  }
}

export const releveService = new ReleveService();
```

### Pattern Repository

```typescript
// lib/repositories/userRepository.ts
import { db } from '@/lib/prisma';
import { User, Prisma } from '@prisma/client';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  }

  async findMany(params: {
    page?: number;
    limit?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<{ data: User[]; total: number }> {
    const { page = 1, limit = 10, where, orderBy } = params;

    const [data, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return db.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return db.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await db.user.delete({ where: { id } });
  }
}

export const userRepository = new UserRepository();
```

---

## 5. AUTHENTIFICATION (NEXTAUTH)

### Configuration

```typescript
// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email et mot de passe requis');
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error('Identifiants invalides');
        }

        const isValid = await compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error('Identifiants invalides');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
};
```

### Middleware d'Autorisation

```typescript
// lib/auth/middleware.ts
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

type Role = 'SALARIE' | 'RESPONSABLE' | 'ADMIN';

export async function requireAuth(request: NextRequest, allowedRoles?: Role[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  return session;
}

// Usage dans API route
export async function POST(request: NextRequest) {
  const session = await requireAuth(request, ['RESPONSABLE', 'ADMIN']);
  if (session instanceof NextResponse) return session;

  // session.user est disponible ici
}
```

---

## 6. SÉCURITÉ (OWASP TOP 10)

### 1. Injection

```typescript
// ❌ Mauvais - Injection SQL
const user = await db.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;

// ✅ Bon - Prisma protège automatiquement
const user = await db.user.findUnique({
  where: { email },
});

// ✅ Si raw query nécessaire, utiliser les paramètres
const user = await db.$queryRaw`
  SELECT * FROM users WHERE email = ${Prisma.sql`${email}`}
`;
```

### 2. Authentification Cassée

```typescript
// ✅ Hash des mots de passe
import { hash, compare } from 'bcryptjs';

const hashedPassword = await hash(password, 12);
const isValid = await compare(inputPassword, hashedPassword);

// ✅ Rate limiting sur login
// Utiliser un middleware ou service externe
```

### 3. Exposition de Données Sensibles

```typescript
// ❌ Mauvais - Retourner le mot de passe
return NextResponse.json(user);

// ✅ Bon - Exclure les données sensibles
const { password, ...safeUser } = user;
return NextResponse.json(safeUser);

// ✅ Mieux - Select explicite
const user = await db.user.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    email: true,
    // password: false (pas inclus)
  },
});
```

### 4. Contrôle d'Accès

```typescript
// ✅ Toujours vérifier les permissions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  const releve = await db.releve.findUnique({
    where: { id: params.id },
  });

  // Salarie ne lit que ses propres releves du jour
  if (
    session.user.role === 'SALARIE' &&
    (releve.userId !== session.user.id || !isToday(releve.date))
  ) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  return NextResponse.json(releve);
}
```

### 5. Validation des Entrées

```typescript
// ✅ Toujours valider avec Zod
const validated = schema.safeParse(body);
if (!validated.success) {
  return NextResponse.json(
    { error: 'Données invalides', details: validated.error.issues },
    { status: 400 }
  );
}
```

---

## 7. GESTION DES ERREURS

### Error Handler Centralisé

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} non trouvé`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non authentifié') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès non autorisé') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public details?: any
  ) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

### Wrapper API Route

```typescript
// lib/api/handler.ts
import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';

type Handler = (request: NextRequest, context?: any) => Promise<NextResponse>;

export function withErrorHandler(handler: Handler): Handler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);

      if (error instanceof AppError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            ...(error instanceof ValidationError && { details: error.details }),
          },
          { status: error.statusCode }
        );
      }

      return NextResponse.json(
        { error: 'Erreur serveur interne' },
        { status: 500 }
      );
    }
  };
}

// Usage
export const GET = withErrorHandler(async (request) => {
  const user = await userService.findById(id);
  if (!user) throw new NotFoundError('Utilisateur');
  return NextResponse.json(user);
});
```

---

## 8. CHECKLIST BACKEND

### Avant développement

- [ ] Schéma Zod défini
- [ ] Règles métier documentées
- [ ] Cas d'erreur identifiés

### Pendant développement

- [ ] Validation des inputs
- [ ] Authentification vérifiée
- [ ] Autorisations vérifiées
- [ ] Transactions si multi-opérations
- [ ] Logs appropriés

### Après développement

- [ ] Tests unitaires du service
- [ ] Tests d'intégration de l'API
- [ ] Documentation API (si publique)
- [ ] Pas de données sensibles exposées
