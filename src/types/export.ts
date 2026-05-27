import type { Creneau, UserRole } from '@prisma/client';

/**
 * Types de l'Epic EXPORT.
 *
 * Sources de verite :
 *   - `.claude/epic-state.md` decisions validees (lib CSV/PDF, scope, audit)
 *   - `docs/CCF.md` (registre journalier, conservation legale, audit DDPP)
 *
 * Pourquoi des interfaces dediees plutot que reutiliser `ReleveListItem` ?
 *   - Le shape CSV est plat (1 colonne = 1 champ), valeurs deja "rendues"
 *     (statut FR, OUI/NON, etc.), donc decouple du shape DB.
 *   - Le shape PDF est hierarchique (boutique > equipement > 3 creneaux +
 *     alertes du jour) : forme metier specifique au registre journalier.
 */

export type ExportFormat = 'CSV' | 'PDF';

export interface ExportRange {
  readonly dateFromISO: string;
  readonly dateToISO: string;
}

/**
 * Ligne CSV (1 ligne = 1 releve, ordre des champs fige cf. CSV_COLUMNS).
 * `temperature` est un nombre brut (le formattage en `-18.5` est applique
 * a la serialisation par csv-stringify via String()).
 */
export interface ExportCsvRow {
  readonly date: string;
  readonly creneau: Creneau;
  readonly equipementNom: string;
  readonly boutiqueNom: string;
  readonly temperature: number;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly alerteHorsSeuils: boolean;
  readonly commentaire: string | null;
  readonly signature: string;
  readonly salarieNom: string;
  readonly statut: 'ACTIF' | 'ANNULE';
  readonly motifAnnulation: string | null;
}

export interface RegistreJournalierCreneau {
  readonly creneau: Creneau;
  readonly temperature: number | null;
  readonly commentaire: string | null;
  readonly alerteHorsSeuils: boolean;
  readonly salarieNom: string | null;
  /** HH:MM Europe/Paris, derive du timestamp createdAt du releve. */
  readonly heureSaisie: string | null;
}

export interface RegistreJournalierRow {
  readonly equipementId: string;
  readonly equipementNom: string;
  readonly equipementType: string;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly creneaux: readonly RegistreJournalierCreneau[];
}

export interface RegistreJournalierAlerteEntry {
  readonly alerteId: string;
  readonly equipementNom: string;
  readonly creneau: Creneau;
  readonly temperature: number;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly status: 'OUVERTE' | 'RESOLUE' | 'IGNOREE';
  readonly commentaireResolution: string | null;
  readonly resoluParNom: string | null;
  readonly resoluAt: Date | null;
}

/**
 * Signature embarquee dans le registre journalier (US-SIG-001).
 *
 * Type minimal projete par `export.service` pour decoupler le pdf-builder
 * du shape complet `SignatureRow` (qui embarque id, boutiqueId, etc.,
 * non utiles au rendu PDF).
 */
export interface RegistreJournalierSignature {
  readonly imageUrl: string;
  readonly signataireName: string;
  readonly signataireRoleSnapshot: UserRole;
  readonly signedAt: Date;
}

/**
 * Forme "lecture" du registre journalier (page detail).
 *
 * Accessible aux 3 roles (SALARIE/RESPONSABLE/ADMIN) si la boutique est
 * dans leur scope. NE CONTIENT PAS la signature : la page detail charge
 * la signature separement via `SignatureSection` (decouplage qui evite
 * un double fetch + permet le check `canExport` sur l'export PDF
 * seulement).
 */
export interface RegistreJournalier {
  readonly dateISO: string;
  readonly boutique: {
    readonly id: string;
    readonly nom: string;
    readonly adresse: string | null;
    readonly ville: string | null;
  };
  readonly generatedBy: { readonly nom: string; readonly role: string };
  readonly generatedAt: Date;
  readonly equipements: readonly RegistreJournalierRow[];
  readonly alertes: readonly RegistreJournalierAlerteEntry[];
}

/**
 * Forme "export" du registre journalier (route PDF).
 *
 * Etend `RegistreJournalier` avec la signature manuscrite associee au
 * registre. Restreinte aux roles autorises a exporter (RESPONSABLE +
 * ADMIN) par `canExport`.
 *
 * `signature` est `null` si le registre n'est pas signe : le PDF
 * affichera alors la mention "Registre non signe" en pied de page.
 */
export interface RegistreJournalierForExport extends RegistreJournalier {
  readonly signature: RegistreJournalierSignature | null;
}

export type ExportError =
  | 'FORBIDDEN'
  | 'BOUTIQUE_NOT_FOUND'
  | 'RANGE_TOO_LARGE'
  | 'NO_DATA'
  | 'INTERNAL';
