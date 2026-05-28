import Link from 'next/link';
import type { Route } from 'next';
import type { AlerteListItem as AlerteListItemData } from '@/lib/services/alerte.service';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { EQUIPEMENT_TYPE_LABELS } from '@/lib/constants/equipement-labels';
import { CreneauBadge } from '@/components/features/releves/CreneauBadge';
import { DateCourte } from '@/components/features/releves/DateCourte';

/**
 * Carte d'une alerte dans la liste US-ALE-001.
 *
 * Server Component pur, charte Maison Givre :
 *   - Badge "OUVERTE" en or plein sur fond noir (le plus haut niveau
 *     d'accent de la palette, marque l'urgence sans rompre la charte).
 *   - Equipement (libelle + type), boutique en sous-titre.
 *   - Date + creneau (DateCourte + CreneauBadge) en ligne info.
 *   - Temperature + seuils (rappel HACCP).
 *   - Commentaire de saisie (raison hors seuils) si renseigne.
 *   - RESPONSABLE/ADMIN : lien primaire "Resoudre" vers `/alertes/<id>`.
 *   - SALARIE (`canManage = false`) : lien secondaire "Consulter" en
 *     lecture seule (pas d'action de resolution).
 *
 * a11y :
 *   - `<article>` semantique avec aria-label "Alerte ouverte ..."
 *   - Badge OUVERTE avec role="status".
 *   - Lien d'action focusable avec ring or.
 */

interface AlerteListItemProps {
  readonly alerte: AlerteListItemData;
  /** RESPONSABLE/ADMIN : lien "Resoudre". SALARIE : lien "Consulter". */
  readonly canManage: boolean;
}

const CARD_CLASSES =
  'flex flex-col gap-4 rounded-lg border border-mg-noir/10 bg-white p-6 sm:flex-row sm:items-start sm:justify-between';
const STATUS_BADGE_CLASSES =
  'inline-flex items-center rounded-full bg-mg-noir px-3 py-1 text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const EYEBROW_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const TITLE_CLASSES = 'text-lg font-light tracking-wide text-mg-noir';
const META_CLASSES = 'text-[11px] uppercase tracking-[0.2em] text-mg-noir/50';
const TEMP_CLASSES = 'font-medium tabular-nums text-mg-noir';
const COMMENT_CLASSES =
  'border-l-2 border-mg-or/40 bg-mg-ivoire/40 px-4 py-2 text-xs font-light italic text-mg-noir/70';
/**
 * `w-full sm:w-auto` : full-width sur mobile (CTA dominant, evite la
 * cible reduite a 50% sur viewport etroit), retour a la largeur du
 * label sur sm+ pour s'aligner sur le titre + meta a droite.
 * `min-h-touch` complete pour assurer la cible tactile WCAG.
 */
const ACTION_LINK_CLASSES =
  'inline-flex min-h-touch w-full items-center justify-center bg-mg-noir px-6 py-3 text-[11px] font-light uppercase tracking-[0.3em] text-mg-ivoire transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire sm:w-auto';
/**
 * Lien lecture seule (SALARIE) : variante "outline" sobre pour signaler
 * qu'il ne declenche aucune action de resolution, tout en restant une
 * cible tactile WCAG (`min-h-touch`).
 */
const READ_LINK_CLASSES =
  'inline-flex min-h-touch w-full items-center justify-center border border-mg-noir/20 px-6 py-3 text-[11px] font-light uppercase tracking-[0.3em] text-mg-noir transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire sm:w-auto';

export function AlerteListItem({ alerte, canManage }: AlerteListItemProps) {
  const { releve } = alerte;
  const detailHref = `/alertes/${alerte.id}` as Route;
  const ariaLabel = `Alerte ouverte sur ${releve.equipementNom} a ${releve.boutiqueNom}`;
  const actionLabel = canManage ? 'Resoudre' : 'Consulter';
  return (
    <article
      className={CARD_CLASSES}
      data-testid={`alerte-item-${alerte.id}`}
      aria-label={ariaLabel}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            role="status"
            className={STATUS_BADGE_CLASSES}
            data-testid={`alerte-item-${alerte.id}-status`}
          >
            Ouverte
          </span>
          <span className={EYEBROW_CLASSES}>
            {EQUIPEMENT_TYPE_LABELS[releve.equipementType]}
          </span>
        </div>
        <h2 className={TITLE_CLASSES}>{releve.equipementNom}</h2>
        <p className={META_CLASSES}>
          {releve.boutiqueNom} &middot; Seuils {releve.seuilMin.toFixed(1)} /{' '}
          {releve.seuilMax.toFixed(1)} degC
        </p>
        <p className="flex flex-wrap items-center gap-3 text-sm font-light text-mg-noir/70">
          <DateCourte
            value={releve.dateISO}
            className="font-medium text-mg-noir"
            data-testid={`alerte-item-${alerte.id}-date`}
          />
          <CreneauBadge
            creneau={releve.creneau}
            status="ALERTE"
            data-testid={`alerte-item-${alerte.id}-creneau`}
          />
          <span className="sr-only">{CRENEAU_LABELS[releve.creneau]}</span>
          <span className={TEMP_CLASSES}>
            {releve.temperature.toFixed(1)} degC
          </span>
        </p>
        {releve.commentaire ? (
          <p
            className={COMMENT_CLASSES}
            data-testid={`alerte-item-${alerte.id}-commentaire`}
          >
            {releve.commentaire}
          </p>
        ) : null}
      </div>
      <div className="flex w-full shrink-0 items-start sm:w-auto">
        <Link
          href={detailHref}
          className={canManage ? ACTION_LINK_CLASSES : READ_LINK_CLASSES}
          data-testid={`alerte-item-${alerte.id}-resolve`}
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}
