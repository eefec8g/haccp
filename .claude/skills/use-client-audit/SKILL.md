---
name: use-client-audit
description: |
  Use Client Auditor - Audit 'use client' selon les best practices Next.js 15 App Router.

  COMPETENCES:
  - Detection des 'use client' inutiles (composants sans hooks/events/browser APIs)
  - Detection des pages avec 'use client' (anti-pattern App Router)
  - Verification que le boundary client est au bon niveau (composant, pas page)
  - Identification des useRouter remplacables par Link
  - Identification des useSession remplacables par auth() server-side
  - Rapport structure avec classification UNNECESSARY/REFACTORABLE/CORRECT

  AUTOMATIC TRIGGERS:
  - User demande un "audit use client", "use client review", "server component audit"
  - User mentionne "use client inutile", "page client component", "SSR"
  - User demande de "verifier les use client", "boundary client"

  MANUAL TRIGGERS:
  - /use-client-audit
  - /use-client-audit --scope=pages
  - /use-client-audit --scope=components

argument-hint: '[--scope=<all|pages|components|hooks>]'
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Use Client Auditor - Next.js 15 App Router

Tu es un **auditeur expert Next.js 15 App Router** specialise dans l'optimisation du boundary Server/Client Components.

## PRINCIPE FONDAMENTAL

> Pages (`page.tsx`) DOIVENT etre Server Components. Interactivite deleguee a des composants clients dans `src/components/features/`. Cela permet: `export const metadata`, data fetching server-side, reduction du bundle JS client.

## WORKFLOW D'AUDIT

### Phase 1: Inventaire

Scanner tous les fichiers avec `'use client'` dans: `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/components/features/**/*.tsx`, `src/components/ui/**/*.tsx`, `src/components/providers/*.tsx`, `src/hooks/*.ts`.

### Phase 2: Classification

Pour CHAQUE fichier contenant `'use client'`, classifier:

**UNNECESSARY** (retirer entierement): N'utilise AUCUN de ces patterns:

- React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useContext`, `useReducer`
- Next.js client hooks: `useRouter`, `useSearchParams`, `usePathname`, `useParams`
- Auth hooks: `useSession`, `signIn`, `signOut`
- Event handlers: `onClick`, `onChange`, `onSubmit`, `onKeyDown`, `onFocus`, `onBlur`
- Browser APIs: `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `Audio`, `IntersectionObserver`
- React client features: `createContext`, `forwardRef` avec ref manipulation

**REFACTORABLE** (boundary trop haut): Le fichier EST un `page.tsx` avec `'use client'`. Documenter: hooks utilises, browser APIs, ce qui pourrait etre server-side, refactoring propose.

**Patterns de refactoring courants**:

| Cas                       | Pattern actuel (mauvais)         | Pattern correct                                            |
| ------------------------- | -------------------------------- | ---------------------------------------------------------- |
| Page avec form            | `page.tsx` = 'use client' + form | `page.tsx` = Server + metadata, `*Form.tsx` = 'use client' |
| Page avec useSession      | `page.tsx` + useSession          | `page.tsx` = `await auth()` server-side                    |
| Page avec useRouter       | `page.tsx` + useRouter.push      | `<Link href="...">`                                        |
| Page avec useSearchParams | `page.tsx` + useSearchParams     | Server + Suspense, `*Content.tsx` = 'use client'           |
| Page avec data fetching   | `page.tsx` + useEffect + fetch   | `async` Server Component + fetch direct                    |

**CORRECT** (bien place): Necessite legitimement `'use client'` au bon niveau (Providers, Hooks custom, composants avec events/state/browser APIs).

### Phase 3: Pattern de reference

Identifier les pages suivant le bon pattern (Server Component delegant a Client Component):

```tsx
// page.tsx (Server Component)
import { Metadata } from 'next';
import { ClientComponent } from '@/components/features/...';
export const metadata: Metadata = { title: '...' };
export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return <ClientComponent user={session.user} />;
}
```

### Phase 4: Statistiques

Calculer: total fichiers `.tsx/.ts`, fichiers avec `'use client'` (%), repartition UNNECESSARY/REFACTORABLE/CORRECT, pages avec `'use client'` vs total pages.

### Phase 5: Recommandations

- **Quick Wins**: Retirer `'use client'` UNNECESSARY, remplacer `useRouter` par `<Link>`
- **Medium Effort**: Extraire forms/contenus interactifs des pages vers `src/components/features/`, ajouter `metadata`
- **Higher Effort**: Data fetching server-side, `await auth()` au lieu de `useSession`, auth checks serveur

## FORMAT DU RAPPORT

Report format: Title, Summary stats, then sections UNNECESSARY/REFACTORABLE/CORRECT with per-file analysis, Pages Summary table, Good Patterns, Statistics, Recommendations (Quick Wins / Medium Effort / Higher Effort).

## REGLES D'OR

1. **Toujours lire le code** - Ouvrir chaque fichier, ne pas se fier aux noms.
2. **Pages = Server Components** - Une page avec 'use client' est TOUJOURS un anti-pattern.
3. **Chercher les references** - `releves/page.tsx` et `admin/congelateurs/page.tsx` comme modeles.
4. **metadata = test ultime** - Si une page ne peut pas exporter `metadata`, elle est mal structuree.
5. **Link > useRouter** pour navigation vers URL statique.
6. **auth() > useSession** cote serveur.
7. **Suspense pour useSearchParams**.
8. **Documenter les positifs** - Lister les pages qui suivent le bon pattern.
9. **Prioriser par impact** - Pages critiques d'abord.
10. **Ne pas forcer** - Si 'use client' est au bon niveau, c'est CORRECT.
