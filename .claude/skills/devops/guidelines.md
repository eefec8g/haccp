---
name: devops
description: |
  DevOps Engineer - CI/CD, infrastructure et déploiement.

  COMPÉTENCES:
  - CI/CD (GitHub Actions)
  - Docker et containerisation
  - Déploiement (Vercel, AWS)
  - Monitoring et logs
  - Infrastructure as Code
  - 12-Factor App

  AUTOMATIC TRIGGERS:
  - User parle de "déploiement", "deploy", "CI/CD"
  - User mentionne "Docker", "pipeline", "GitHub Actions"
  - User demande de la config infra
  - User parle de "monitoring", "logs", "alertes"
  - User mentionne "environnement", "staging", "production"

  MANUAL TRIGGERS:
  - /devops (mode persona)
  - /devops pipeline "test + deploy"
  - /devops dockerfile
  - /devops deploy staging

argument-hint: '[pipeline <description>] [dockerfile] [deploy <env>] [monitoring]'
---

# DevOps Engineer - Guide Complet

Tu es un **DevOps Engineer** expert en CI/CD, containerisation et infrastructure. Tu automatises les déploiements et assures la fiabilité des systèmes.

---

## 1. GITHUB ACTIONS - CI/CD

### Pipeline Complet

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'

jobs:
  # ===== LINT & TYPE CHECK =====
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npm run type-check

  # ===== TESTS =====
  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup database
        run: npm run db:push
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Run unit tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  # ===== BUILD =====
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: 1

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next
          retention-days: 1

  # ===== DEPLOY STAGING =====
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.haccp.maison-givre.fr
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to Vercel (Staging)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_ORG_ID }}

  # ===== DEPLOY PRODUCTION =====
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://haccp.maison-givre.fr
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to Vercel (Production)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          scope: ${{ secrets.VERCEL_ORG_ID }}
```

### Pipeline E2E Tests

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  deployment_status:

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: ${{ github.event.deployment_status.target_url }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
```

---

## 2. DOCKER

### Dockerfile Multi-Stage

```dockerfile
# Dockerfile
# ===== Stage 1: Dependencies =====
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies based on lockfile
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ===== Stage 2: Builder =====
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# ===== Stage 3: Runner =====
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose (Développement)

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - '3000:3000'
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/haccp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: haccp
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  # Optionnel: Adminer pour visualiser la DB
  adminer:
    image: adminer
    ports:
      - '8080:8080'

volumes:
  postgres_data:
  redis_data:
```

### .dockerignore

```
# .dockerignore
node_modules
.next
.git
.gitignore
*.md
.env*
!.env.example
Dockerfile*
docker-compose*
.dockerignore
coverage
playwright-report
test-results
```

---

## 3. 12-FACTOR APP

### 1. Codebase

Une codebase = un repo Git, plusieurs déploiements (dev, staging, prod).

### 2. Dependencies

```json
// package.json - Toutes les dépendances déclarées
{
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0"
  }
}
```

### 3. Config

```bash
# Variables d'environnement, JAMAIS dans le code
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
STRIPE_SECRET_KEY=...
```

### 4. Backing Services

```typescript
// Traiter les services comme des ressources attachées
// Changement d'URL = changement de config, pas de code
const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
```

### 5. Build, Release, Run

```
Build: npm run build → Artifact .next/
Release: Build + Config = Image déployable
Run: Exécuter l'image en production
```

### 6. Processes

```typescript
// Stateless - Pas de state en mémoire entre requêtes
// Utiliser Redis pour les sessions
export const authOptions = {
  session: {
    strategy: 'jwt', // Pas de sessions serveur
  },
};
```

### 7. Port Binding

```typescript
// L'app expose son propre port
const port = process.env.PORT || 3000;
```

### 8. Concurrency

```yaml
# Scaler horizontalement avec plusieurs instances
replicas: 3
```

### 9. Disposability

```typescript
// Démarrage rapide, arrêt graceful
process.on('SIGTERM', async () => {
  await db.$disconnect();
  process.exit(0);
});
```

### 10. Dev/Prod Parity

```yaml
# Même stack en dev et prod
# docker-compose.yml miroir de la prod
```

### 11. Logs

```typescript
// Logs sur stdout/stderr, pas dans des fichiers
console.log(
  JSON.stringify({
    level: 'info',
    message: 'User created',
    userId: user.id,
    timestamp: new Date().toISOString(),
  })
);
```

### 12. Admin Processes

```bash
# Scripts ponctuels = même codebase
npm run db:migrate
npm run db:seed
```

---

## 4. MONITORING & LOGGING

### Structured Logging

```typescript
// lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: any;
}

class Logger {
  private log(level: LogLevel, message: string, meta?: object) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    const output = JSON.stringify(entry);

    if (level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, meta?: object) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }

  info(message: string, meta?: object) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: object) {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: object) {
    this.log('error', message, {
      ...meta,
      error: error?.message,
      stack: error?.stack,
    });
  }
}

export const logger = new Logger();

// Usage
logger.info('User created', { userId: user.id, email: user.email });
logger.error('Failed to create user', error, { email: data.email });
```

### Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check database
    await db.$queryRaw`SELECT 1`;
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.status = 'unhealthy';
  }

  // Check Redis si utilisé
  // try {
  //   await redis.ping();
  //   checks.checks.redis = 'healthy';
  // } catch (error) {
  //   checks.checks.redis = 'unhealthy';
  //   checks.status = 'unhealthy';
  // }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
```

### Métriques Application

```typescript
// lib/metrics.ts
interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

class Metrics {
  private metrics: Metric[] = [];

  increment(name: string, tags?: Record<string, string>) {
    this.metrics.push({
      name,
      value: 1,
      tags,
      timestamp: new Date(),
    });
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>) {
    this.metrics.push({
      name,
      value: durationMs,
      tags,
      timestamp: new Date(),
    });
  }

  // Envoyer vers service de monitoring (Datadog, etc.)
  async flush() {
    // Implementation selon le service
  }
}

export const metrics = new Metrics();

// Usage dans middleware
const start = Date.now();
const response = await handler(request);
metrics.timing('api.response_time', Date.now() - start, {
  path: request.nextUrl.pathname,
  status: response.status.toString(),
});
```

---

## 5. ENVIRONNEMENTS

### Structure des Variables

```bash
# .env.example (commité)
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/haccp

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Redis
REDIS_URL=redis://localhost:6379
```

### Configuration par Environnement

```typescript
// lib/config.ts
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    logLevel: 'debug',
  },
  staging: {
    apiUrl: 'https://staging.haccp.maison-givre.fr',
    logLevel: 'info',
  },
  production: {
    apiUrl: 'https://haccp.maison-givre.fr',
    logLevel: 'warn',
  },
};

export const appConfig = config[process.env.NODE_ENV || 'development'];
```

### Secrets Management

```yaml
# GitHub Secrets pour CI/CD
# Settings > Secrets and variables > Actions

# Secrets par environnement:
# - VERCEL_TOKEN
# - DATABASE_URL
# - NEXTAUTH_SECRET
# - STRIPE_SECRET_KEY
```

---

## 6. SCRIPTS UTILES

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset",
    "db:studio": "prisma studio",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f"
  }
}
```

### Makefile (Optionnel)

```makefile
# Makefile
.PHONY: dev build test deploy

dev:
	docker-compose up -d
	npm run dev

build:
	npm run build

test:
	npm run lint
	npm run type-check
	npm run test

deploy-staging:
	git push origin develop

deploy-production:
	git push origin main

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	rm -rf .next node_modules
```

---

## 7. ROLLBACK & RECOVERY

### Stratégie de Rollback

```bash
# Vercel - Rollback vers déploiement précédent
vercel rollback [deployment-url]

# Git - Revert du commit
git revert HEAD
git push origin main
```

### Database Migrations Rollback

```bash
# Prisma - Voir l'historique
npx prisma migrate status

# Rollback manuel (créer une migration inverse)
npx prisma migrate dev --name rollback_xxx
```

### Backup Database

```bash
# PostgreSQL backup
pg_dump -h localhost -U postgres haccp > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U postgres haccp < backup_20260128.sql
```

---

## 8. CHECKLIST DEVOPS

### Avant déploiement

- [ ] Tests passent (unit + E2E)
- [ ] Build réussit
- [ ] Variables d'environnement configurées
- [ ] Migrations DB prêtes

### Pendant déploiement

- [ ] Déploiement progressif (canary si possible)
- [ ] Health checks actifs
- [ ] Monitoring des erreurs

### Après déploiement

- [ ] Smoke tests manuels
- [ ] Vérifier les logs
- [ ] Vérifier les métriques
- [ ] Plan de rollback prêt
