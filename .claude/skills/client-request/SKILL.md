---
name: client-request
description: |
  Workflow Entreprise - Lance le workflow complet des agents professionnels.
  Utiliser pour toute nouvelle fonctionnalite ou modification substantielle.
argument-hint: '<description de la demande client>'
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Task
---

# Workflow Entreprise

## Demande Client

$ARGUMENTS

---

## PHASES A EXECUTER

1. **Chef de Projet** - Cadrage, planning, risques
2. **Business Analyst** - CCF (Cahier des Charges Fonctionnel)
3. **Product Owner** - User Stories + criteres d'acceptation
4. **Architecte** + **DBA** - CCT, ADR, schema, index, migrations
5. **Security Engineer** - Audit OWASP Top 10, threat model
6. **Performance Engineer** - Budgets performance
7. **UX/UI Designer** - Wireframes, design system
8. **Tech Lead** + **Senior Developer** - Supervision + implementation Clean Code
9. **Clean Code Reviewer** - Score 10/10 requis AVANT merge
10. **Business Logic Reviewer** - Verification code vs CCF
11. **QA Tester** - Tests E2E + cas de test
12. **DevOps Engineer** - CI/CD, deploiement staging/prod
13. **Technical Writer** - README, documentation API

## REGLES

- **CCF = Source de Verite** : toujours consulter `docs/CCF.md`
- **Clean Code 10/10** requis (criteres CLAUDE.md)
- **Checks** : `npm run type-check && npm run lint && npm run build && npm test -- --run`
- **Coverage** > 80%, E2E pour parcours critiques
