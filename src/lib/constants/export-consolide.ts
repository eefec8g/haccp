/**
 * Constantes de l'Epic REGISTRE (US-REG-001).
 *
 * Le registre journalier consolide est un export PDF audit DDPP sur une
 * periode personnalisee (`dateStart`/`dateEnd`) bornee a `MAX_PERIODE_DAYS`
 * jours pour eviter (a) l'OOM serverless sur le rendu pdfmake et (b) un
 * audit avec un registre trop volumineux pour etre relu.
 *
 * Decisions Phase 0.5 :
 *   - 31 jours max (decision #1) -- couvre un mois calendaire complet.
 *   - PDF uniquement Phase 1 (decision #5).
 *   - Format paysage (decision #3) -- matrice Jours x Equipements lisible.
 *   - Signatures incluses en annexe (decision #4).
 *   - Permissions : RESPONSABLE + ADMIN (decision #6).
 *   - Rate limit 5/h (decision #7) -- cf. `rateLimit/config.ts`.
 */

/**
 * Periode maximale autorisee pour le registre consolide.
 *
 * 31 jours = 1 mois calendaire complet (cas dominant audit DDPP mensuel).
 * Borne hard cote Zod ET cote service (defense en profondeur).
 */
export const MAX_PERIODE_DAYS = 31;

/**
 * Periode minimale autorisee (`dateStart === dateEnd` = 1 jour). Garde-fou
 * pour eviter une periode "vide" (dateEnd < dateStart traite separement).
 */
export const MIN_PERIODE_DAYS = 1;

/**
 * Regex de validation des dates ISO `YYYY-MM-DD` reutilisee par les
 * schemas Zod (DRY avec `validations/export.ts`).
 */
export const CONSOLIDE_DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Nombre de creneaux attendus par jour et par equipement (matin/midi/soir).
 * Reexporte ici (et non importe de `constants/releve`) pour figer la
 * formule de `totalRelevesAttendus = jours x equipements x CRENEAUX_PAR_JOUR`
 * dans le contexte stats consolidees (l'epic releve pourrait theoriquement
 * evoluer ; la formule audit DDPP doit rester explicite et stable).
 */
export const CRENEAUX_PAR_JOUR = 3;

/**
 * Labels FR utilises dans le PDF "Registre journalier consolide" (Phase 2).
 *
 * Centralises ici (DRY) -- le pdf-builder consolide (Phase 2) les
 * consommera, mais on les fige des la Phase 1 pour ne pas disperser la
 * source de verite des libelles compliance.
 */
export const PDF_CONSOLIDE_TITLE = 'REGISTRE JOURNALIER CONSOLIDE';
export const PDF_CONSOLIDE_SUBTITLE = 'Audit DDPP HACCP -- Maison Givre';

export const PDF_CONSOLIDE_PERIODE_LABEL = 'Periode';
export const PDF_CONSOLIDE_BOUTIQUES_LABEL = 'Boutiques';
export const PDF_CONSOLIDE_STATS_SECTION_TITLE = 'Statistiques de conformite';
export const PDF_CONSOLIDE_RELEVES_SECTION_TITLE = 'Releves de temperature';
export const PDF_CONSOLIDE_ALERTES_SECTION_TITLE = 'Alertes de la periode';
export const PDF_CONSOLIDE_SIGNATURES_SECTION_TITLE = 'Signatures du registre';

export const PDF_CONSOLIDE_NO_ALERTES_LABEL =
  'Aucune alerte enregistree sur la periode.';
export const PDF_CONSOLIDE_NO_SIGNATURES_LABEL =
  'Aucune signature enregistree sur la periode.';
export const PDF_CONSOLIDE_NO_RELEVES_LABEL =
  'Aucun releve enregistre sur la periode.';

export const PDF_CONSOLIDE_STATS_TOTAL_ATTENDUS = 'Releves attendus';
export const PDF_CONSOLIDE_STATS_TOTAL_SAISIS = 'Releves saisis';
export const PDF_CONSOLIDE_STATS_MANQUANTS = 'Releves manquants';
export const PDF_CONSOLIDE_STATS_TAUX_CONFORMITE = 'Taux de conformite';
export const PDF_CONSOLIDE_STATS_TOTAL_ALERTES = 'Alertes total';
export const PDF_CONSOLIDE_STATS_ALERTES_OUVERTES = 'Alertes ouvertes';
export const PDF_CONSOLIDE_STATS_ALERTES_TRAITEES = 'Alertes traitees';
export const PDF_CONSOLIDE_STATS_TAUX_RESOLUTION = 'Taux de resolution';
export const PDF_CONSOLIDE_STATS_TOTAL_SIGNATURES = 'Signatures totales';
export const PDF_CONSOLIDE_STATS_JOURS_SIGNES = 'Jours signes';

export const PDF_CONSOLIDE_FOOTER_MENTION =
  'Document genere pour controle sanitaire (CCF EX-EXP-002 -- conservation legale 5 ans).';

/**
 * Mention de tracabilite des corrections (BL-1) -- conformite CCF.
 *
 * Le registre consolide affiche la valeur courante de chaque releve
 * (les releves annules sont filtres via `annuleParId: null` cote service).
 * Cette note signale a l'auditeur DDPP que l'historique complet des
 * corrections est consultable via le registre journalier detaille
 * (export CSV/PDF par jour) -- conformite minimale sans surcharger la
 * matrice consolidee de marqueurs visuels.
 */
export const PDF_CONSOLIDE_FOOTER_MENTION_CORRECTIONS =
  'Les valeurs presentees refletent les corrections eventuelles validees par le responsable. Historique complet disponible dans le registre journalier detaille.';
