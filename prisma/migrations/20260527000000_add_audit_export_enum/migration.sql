-- Epic EXPORT - Ajout des valeurs enum EXPORT pour AuditAction/AuditEntityType.
-- Avant ce patch, `logExportSuccess` encodait l'export comme `action: 'CREATE'`
-- + `entityType: 'USER'` + `metadata.kind: 'EXPORT'`. Probleme : un audit DDPP
-- qui filtrait `entityType=USER` melangeait creations de comptes ET exports.
--
-- Cette migration introduit une semantique propre :
--   - `AuditAction.EXPORT` : action explicite (l'export n'est ni un CREATE
--     ni un UPDATE au sens "mutation d'entite").
--   - `AuditEntityType.EXPORT` : type d'entite distinct. Comme un export
--     n'est pas une entite stockee, `entityId` recoit un UUID genere
--     cote service (`crypto.randomUUID()`) -- documente dans
--     `export.service.ts#logExportSuccess`.
--
-- Note PostgreSQL : `ALTER TYPE ... ADD VALUE` est non-transactionnel et
-- ne peut pas etre rollback. Si la migration echoue apres l'ALTER, le
-- type contient deja la valeur (sans dommage : les anciennes lignes
-- restent valides puisque l'enum est compatible ascendant).

ALTER TYPE "AuditAction" ADD VALUE 'EXPORT';

ALTER TYPE "AuditEntityType" ADD VALUE 'EXPORT';
