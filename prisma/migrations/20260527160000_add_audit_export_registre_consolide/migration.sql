-- Epic REGISTRE (US-REG-001) - Ajout de la valeur enum `EXPORT_REGISTRE_CONSOLIDE`
-- a `AuditAction` pour tracer la generation du registre journalier consolide
-- sur periode (audit DDPP). On reutilise `AuditEntityType.EXPORT` deja en place
-- (ajoute par la migration `20260527000000_add_audit_export_enum`).
--
-- Pourquoi un AuditAction dedie (et pas `EXPORT`) ? Permettre a un audit DDPP
-- de distinguer (a) les exports CSV/PDF journaliers (`AuditAction.EXPORT`)
-- des (b) registres consolides multi-jours (`EXPORT_REGISTRE_CONSOLIDE`), qui
-- ont un cout serveur (pdfmake 31 j) et un usage compliance distincts.
--
-- Note PostgreSQL : `ALTER TYPE ... ADD VALUE` est non-transactionnel et
-- ne peut pas etre rollback. Si la migration echoue apres l'ALTER, le
-- type contient deja la valeur (sans dommage : les anciennes lignes
-- restent valides puisque l'enum est compatible ascendant).

ALTER TYPE "AuditAction" ADD VALUE 'EXPORT_REGISTRE_CONSOLIDE';
