import Link from 'next/link';
import type { Route } from 'next';
import type { Creneau } from '@prisma/client';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { EQUIPEMENT_TYPE_LABELS } from '@/lib/constants/equipement-labels';
import type { TourneeCreneauInfo, TourneeEquipementCard } from '@/types/releve';

/**
 * Carte tournee : 1 equipement, 3 creneaux (MATIN/MIDI/SOIR) en
 * boutons tactiles "gants" (h-20+, full width, contrastes nets) pour
 * usage tablette en environnement froid (US-REL-001).
 *
 * Etats par creneau :
 *   - DONE      : check or, lien lecture seule (vue releve)
 *   - ALERTE    : badge or plein, lien vers la vue releve avec
 *                 mise en avant.
 *   - MISSING   : bouton primaire vers /releves/saisie/<id>/<creneau>.
 *
 * Le `currentCreneau` (heure courante) est mis en avant si MISSING
 * (border or + badge "Maintenant"). Aucun "use client" : Server
 * Component pur. Toute interactivite passe par <Link>.
 *
 * data-testid :
 *   - tournee-card-<equipementId>
 *   - tournee-creneau-<equipementId>-<creneau>
 */
interface TourneeCardProps {
  readonly card: TourneeEquipementCard;
  readonly currentCreneau: Creneau | null;
}

interface CreneauButtonProps {
  readonly equipementId: string;
  readonly info: TourneeCreneauInfo;
  readonly isCurrent: boolean;
}

const BUTTON_BASE =
  'flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border px-4 text-[11px] font-medium uppercase tracking-[0.2em] transition-colors';

function buttonClassesFor(
  info: TourneeCreneauInfo,
  isCurrent: boolean
): string {
  if (info.status === 'ALERTE') {
    return `${BUTTON_BASE} border-mg-or bg-mg-or text-mg-noir`;
  }
  if (info.status === 'DONE') {
    return `${BUTTON_BASE} border-mg-or/40 bg-transparent text-mg-or`;
  }
  // MISSING
  const emphasis = isCurrent
    ? 'border-mg-or text-mg-noir'
    : 'border-mg-noir/30 text-mg-noir';
  return `${BUTTON_BASE} ${emphasis} bg-transparent hover:bg-mg-noir/[0.04]`;
}

function CreneauButton({ equipementId, info, isCurrent }: CreneauButtonProps) {
  const classes = buttonClassesFor(info, isCurrent);
  const testid = `tournee-creneau-${equipementId}-${info.creneau}`;
  // En Phase 2, les routes /releves/* sont implementees. Pour l'instant
  // les liens pointent vers les paths cibles - inoffensif tant que la
  // page n'est pas creee (Next.js 404 sans casser le SC).
  //
  // `typedRoutes` (next.config) impose un type Route strict ; les
  // segments dynamiques `[equipementId]/[creneau]` n'existent pas encore
  // dans le filesystem, donc on cast vers `Route` (seul moyen propre
  // pendant la Phase 1 ou les pages ne sont pas creees).
  const href = (
    info.status === 'MISSING'
      ? `/releves/saisie/${equipementId}/${info.creneau}`
      : `/releves/${info.releveId ?? ''}`
  ) as Route;
  return (
    <Link
      href={href}
      className={classes}
      data-testid={testid}
      aria-label={`${CRENEAU_LABELS[info.creneau]} - ${info.status.toLowerCase()}`}
    >
      <span>{CRENEAU_LABELS[info.creneau]}</span>
      {info.status === 'MISSING' && isCurrent ? (
        <span className="text-[9px] font-normal tracking-[0.3em] text-mg-or">
          Maintenant
        </span>
      ) : null}
      {info.status !== 'MISSING' && info.temperature !== null ? (
        <span className="text-[12px] font-light tracking-normal">
          {info.temperature.toFixed(1)} degC
        </span>
      ) : null}
    </Link>
  );
}

export function TourneeCard({ card, currentCreneau }: TourneeCardProps) {
  return (
    <article
      data-testid={`tournee-card-${card.equipementId}`}
      className="flex flex-col gap-4 rounded-lg border border-mg-noir/10 bg-white p-6"
    >
      <header className="flex flex-col gap-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or">
          {EQUIPEMENT_TYPE_LABELS[card.type]}
        </p>
        <h2 className="text-lg font-light tracking-wide text-mg-noir">
          {card.equipementNom}
        </h2>
        <p className="text-[11px] uppercase tracking-[0.2em] text-mg-noir/50">
          {card.boutiqueNom} &middot; Seuils {card.seuilMin.toFixed(1)} /{' '}
          {card.seuilMax.toFixed(1)} degC
        </p>
      </header>
      <div className="grid grid-cols-3 gap-3">
        {card.creneaux.map((info) => (
          <CreneauButton
            key={info.creneau}
            equipementId={card.equipementId}
            info={info}
            isCurrent={currentCreneau === info.creneau}
          />
        ))}
      </div>
    </article>
  );
}
