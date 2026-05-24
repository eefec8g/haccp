# Security Audit Guidelines - Procedures detaillees

Guide operationnel pour l'audit de securite white-box de l'application HACCP Maison Givre.

---

## PROCEDURE PAR DOMAINE

### 1. Controle d'acces et immutabilite des releves

#### 1.1 Verifier l'immutabilite des releves

```bash
# Verifier qu'aucune route ne fait update/delete sur la table releves
grep -rn "releve.update\|releve.delete\|releves.update\|releves.delete" src/
```

**Check** : aucun resultat attendu hors d'un middleware Prisma qui BLOQUE ces operations.

Verifier aussi le middleware Prisma global (`src/lib/prisma.ts`) :

- Action `update` sur modele `Releve` -> throw
- Action `delete` sur modele `Releve` -> throw
- Seul `create` doit etre autorise (avec eventuel `annule_par_id`)

#### 1.2 Verifier chaque endpoint API mutation (POST/PATCH/DELETE)

Pour CHAQUE fichier dans `src/app/api/**/route.ts` :

1. Le handler appelle-t-il `auth()` en premier ?
2. Verifie-t-il `session.user.id` avant d'agir ?
3. Si le body contient un `userId`, est-il compare a `session.user.id` ?
4. Le `created_at` est-il genere SERVEUR-SIDE (jamais accepter du client) ?

**Pattern IDOR a detecter** :

```typescript
// VULNERABLE - Accepte un userId arbitraire dans le body
const { userId, congelateurId, temperature } = body;
await db.releve.create({ data: { userId, congelateurId, temperature } });

// SECURISE - userId vient toujours de la session
await db.releve.create({
  data: {
    userId: session.user.id,
    congelateurId,
    temperature,
    createdAt: new Date(), // serveur, jamais du client
  },
});
```

#### 1.3 Verifier les restrictions par role

**Sur les pages** (middleware.ts) :

- `SALARIE_ALLOWED_ROUTES` : `/releves`, `/profile`
- `RESPONSABLE_ALLOWED_ROUTES` : ajoute `/historique`, `/exports`, `/alertes`
- `ADMIN_ONLY_ROUTES` : `/admin/users`, `/admin/congelateurs`

**Sur les API** (middleware.ts) :

- Salarie ne peut acceder qu'aux endpoints `GET /api/releves/today`, `POST /api/releves`
- L'export (`/api/exports`) exige role `RESPONSABLE` ou `ADMIN`
- Le CRUD users/congelateurs exige role `ADMIN`

#### 1.4 Verifier les services de donnees

Pour chaque service dans `src/lib/services/` :

- Les requetes `Releve.findMany` filtrent-elles correctement par periode et role ?
- Un salarie peut-il lire des releves d'autres salaries ? (autorise pour le jour, refuse au-dela)
- Les exports sont-ils bornes (pas de findMany sans limit) ?

---

### 2. Authentification

#### 2.1 Middleware API auth

```bash
# Verifier que les routes API non-publiques exigent l'auth
cat src/middleware.ts
```

**Check** :

- Il existe un `PUBLIC_API_ROUTES` (allowlist explicite)
- Les routes `/api/auth/`, `/api/stripe/webhooks`, `/api/cron/` sont dans l'allowlist
- Toutes les autres retournent 401 si `!isLoggedIn`

**Pattern dangereux** :

```typescript
// VULNERABLE - Toutes les API passent sans auth
if (isApiRoute) {
  return NextResponse.next();
}

// SECURISE - Seules les routes publiques passent
if (isApiRoute && !isPublicApi && !isLoggedIn) {
  return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
}
```

#### 2.2 Socket.IO auth

```bash
cat src/lib/socket.ts
```

**Check** :

- `socketServer.use(authenticateSocket)` est present AVANT `socketServer.on('connection')`
- `authenticateSocket` decode le JWT (pas juste une validation de string)
- Le `userId` est extrait du token decode, pas du client
- `handleJoinUserRoom` verifie que `userId === socket.data.userId`

#### 2.3 Cron auth

```bash
grep -rn "CRON_SECRET" src/ --include="*.ts"
```

**Check** : Chaque endpoint `/api/cron/` verifie `Authorization: Bearer ${CRON_SECRET}`

#### 2.4 Webhook auth

```bash
cat src/app/api/stripe/webhooks/route.ts
```

**Check** : Utilise `stripe.webhooks.constructEvent(body, sig, webhookSecret)`

---

### 3. Cryptographie

#### 3.1 Detecter Math.random()

```bash
grep -rn "Math\.random" src/ --include="*.ts" --include="*.tsx"
```

**Si trouve dans** : generation de tokens, mots de passe, codes -> CRITICAL
**Si trouve dans** : UI animations, identifiants non-securitaires -> OK

#### 3.2 Verifier le hachage

```bash
grep -rn "hash\|bcrypt\|argon2\|BCRYPT_ROUNDS" src/ --include="*.ts"
```

**Check** : bcrypt avec >= 10 rounds (12 recommande)

#### 3.3 Verifier la generation de tokens

```bash
grep -rn "randomBytes\|generateToken\|generateValidation" src/ --include="*.ts"
```

**Check** : `crypto.randomBytes()` avec >= 32 bytes

#### 3.4 Verifier les secrets

```bash
# Chercher des secrets potentiels hardcodes
grep -rn "sk_\|whsec_\|secret.*=.*['\"]" src/ --include="*.ts" | grep -v ".env\|process.env\|test\|mock"
```

---

### 4. Fuites d'informations

#### 4.1 Tokens dans les logs

```bash
grep -rn "logger\.\(info\|warn\|error\|debug\)" src/ --include="*.ts" | grep -i "token\|password\|secret\|link.*reset\|resetLink"
```

**Exceptions OK** : `{ type: input.type }` (le type de notification, pas un token)

#### 4.2 Error messages exposes

```bash
# Trouver les error.message retournes aux clients
grep -rn "error\.message" src/app/api/ --include="*.ts"
```

**Pattern dangereux** :

```typescript
// VULNERABLE - Expose les details internes
return NextResponse.json({ error: error.message }, { status: 500 });

// SECURISE - Message generique
logger.error('Operation failed', { error: error.message });
return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
```

#### 4.3 Preview URLs dans les reponses

```bash
grep -rn "previewUrl\|emailPreview" src/app/api/ --include="*.ts"
```

**Check** : Aucune URL Ethereal dans les reponses JSON (seulement dans les logs cote serveur)

#### 4.4 User enumeration

Verifier que ces endpoints retournent le MEME message pour "email existe" et "email n'existe pas" :

- `POST /api/auth/login` -> "Email ou mot de passe incorrect" (pas "Email non trouve")
- `POST /api/auth/forgot-password` -> "Si un compte existe..." (message generique)
- `POST /api/auth/register` -> OK de dire "email deja utilise" (aide l'UX)

---

### 5. Validation des entrees

#### 5.1 Zod sur chaque endpoint

```bash
# Lister les endpoints sans validation Zod
for file in $(find src/app/api -name "route.ts"); do
  if ! grep -q "safeParse\|parse(" "$file"; then
    echo "MISSING VALIDATION: $file"
  fi
done
```

#### 5.2 SQL injection

```bash
grep -rn "executeRawUnsafe\|queryRaw" src/ --include="*.ts"
```

Pour chaque occurrence, verifier qu'une regex valide l'input AVANT l'execution.

#### 5.3 HTML injection dans les emails

```bash
cat src/lib/services/emailService.ts
```

**Check** : `escapeHtml()` est appelee sur TOUTES les valeurs utilisateur avant insertion dans le HTML.

---

### 6. Rate limiting

#### 6.1 Store en memoire

```bash
grep -rn "new Map\|Map<" src/lib/services/rateLimit* --include="*.ts"
```

**Si `Map` en memoire** :

- OK pour developpement
- MEDIUM pour production (ne survit pas aux redemarrages, ne partage pas entre instances)
- Verifier qu'un plan de migration Redis existe (issue #165 ou equivalent)

#### 6.2 IP spoofing

```bash
grep -rn "x-forwarded-for\|getClientIdentifier" src/ --include="*.ts"
```

**Check** : En production Vercel, utiliser `x-vercel-forwarded-for` (header verifie)

---

### 7. Headers de securite

```bash
cat next.config.ts
```

**Checklist headers** :

| Header                      | Valeur attendue                                | Critique?        |
| --------------------------- | ---------------------------------------------- | ---------------- |
| `X-Frame-Options`           | `DENY`                                         | Oui              |
| `X-Content-Type-Options`    | `nosniff`                                      | Oui              |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Oui              |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Oui              |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Non              |
| `Content-Security-Policy`   | Au minimum `default-src 'self'`                | Non (recommande) |
| `poweredByHeader`           | `false` dans next.config                       | Oui              |

---

### 8. Configuration et CI/CD

#### 8.1 Secrets GitHub Actions

```bash
cat .github/workflows/*.yml
```

**Check** : Toutes les valeurs sensibles utilisent `${{ secrets.XXX }}`, jamais de valeurs en dur.

#### 8.2 .env.example complet

```bash
# Comparer les variables utilisees vs documentees
grep -rn "process\.env\." src/ --include="*.ts" | grep -oP "process\.env\.\K[A-Z_]+" | sort -u > /tmp/env_used.txt
grep "=" .env.example | grep -oP "^[A-Z_]+" | sort -u > /tmp/env_documented.txt
diff /tmp/env_used.txt /tmp/env_documented.txt
```

#### 8.3 Scripts securises

```bash
# Chercher des PII hardcodes dans les scripts
grep -rn "@\|\.com\|\.fr\|password\s*=" scripts/ --include="*.ts"
```

**Check** : Les scripts acceptent les parametres en CLI, pas de valeurs hardcodees.

---

### 9. RGPD

#### 9.1 Data minimization

Pour chaque endpoint GET, verifier que les `select` Prisma ne retournent que les champs necessaires :

```bash
grep -rn "findMany\|findUnique\|findFirst" src/app/api/ --include="*.ts" -A 5 | grep -v "select"
```

Si pas de `select`, tous les champs sont retournes (y compris potentiellement `passwordHash`).

#### 9.2 PII dans les logs

```bash
grep -rn "logger\.\(info\|warn\|error\)" src/ --include="*.ts" | grep -i "email\|phone\|name\|address\|siret"
```

**Acceptable** : `{ email: 'user@...' }` pour les logs d'audit
**Non acceptable** : `{ input }` ou `{ user }` (tout l'objet)

---

## SCORING CVSS SIMPLIFIE

| Score    | Severite     | Criteres                                                                     |
| -------- | ------------ | ---------------------------------------------------------------------------- |
| 9.0-10.0 | **Critical** | Fuite de donnees cross-tenant, execution de code, contournement auth complet |
| 7.0-8.9  | **High**     | Secrets exposes, IDOR, auth manquante sur endpoint sensible, crypto faible   |
| 4.0-6.9  | **Medium**   | Headers manquants, rate limiting inefficace, CSRF, info leak mineur          |
| 0.1-3.9  | **Low**      | PII dans scripts dev, config manquante, logging verbeux                      |

---

## PATTERNS SPECIFIQUES HACCP APP

### Releves immuables : verifier le middleware Prisma

```typescript
// SECURISE - middleware Prisma global qui bloque update/delete
db.$use(async (params, next) => {
  if (
    params.model === 'Releve' &&
    ['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)
  ) {
    throw new Error(
      `Operation ${params.action} interdite sur Releve (immuabilite HACCP)`
    );
  }
  return next(params);
});
```

A verifier : aucune route API ne contourne ce middleware via `$executeRaw` ou `$queryRaw`.

### Salarie ne lit pas l'historique au-dela du jour

Verifier que `GET /api/releves` filtre par `date >= today` quand `session.role === 'SALARIE'` :

```typescript
const where =
  session.role === 'SALARIE' ? { date: { gte: startOfToday() } } : {}; // RESPONSABLE/ADMIN voient tout
```

JAMAIS de `findMany({})` sans filtre selon le role.

### Timestamp serveur-side obligatoire

Verifier que `created_at` et `date` du releve sont GENERES serveur, jamais lus depuis le body :

```typescript
// VULNERABLE - accepte date du client (peut etre falsifiee)
const { temperature, date } = body;

// SECURISE - date generee serveur
const date = new Date();
const { temperature, congelateurId, creneau } = body;
```

### Permissions admin

Verifier que les endpoints `/api/admin/*` exigent `role === 'ADMIN'` et retournent 403 pour SALARIE et RESPONSABLE.

---

## DEPENDANCES A AUDITER

```bash
# Audit npm
npm audit --audit-level=high

# Verifier les versions outdated avec CVE connues
npm outdated
```

Verifier specifiquement :

- `next` : CVE connues?
- `next-auth` : version avec failles de JWT?
- `bcryptjs` : version saine?
- `stripe` : version a jour?
- `nodemailer` : pas de SMTP injection?
