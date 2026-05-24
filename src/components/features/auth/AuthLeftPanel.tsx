/**
 * Panneau gauche des pages auth (Server Component).
 *
 * Affiche le slogan, une illustration metier (congelateur + thermometre)
 * et des trust badges HACCP. Visible uniquement >= lg (split layout).
 *
 * Le composant est pur (pas d'interactivite) -> garde le statut SC
 * pour ne pas hydrater inutilement la moitie gauche de l'ecran.
 */
function ColdStorageIllustration() {
  return (
    <svg
      viewBox="0 0 500 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-sm drop-shadow-xl"
      aria-hidden="true"
    >
      {/* Carte principale - congelateur */}
      <rect
        x="60"
        y="40"
        width="380"
        height="320"
        rx="20"
        fill="white"
        fillOpacity="0.18"
      />
      <rect
        x="60"
        y="40"
        width="380"
        height="320"
        rx="20"
        stroke="white"
        strokeOpacity="0.25"
        strokeWidth="2"
      />

      {/* Sequence de portes de congelateur */}
      <rect
        x="80"
        y="60"
        width="160"
        height="140"
        rx="12"
        fill="white"
        fillOpacity="0.12"
      />
      <rect
        x="80"
        y="60"
        width="160"
        height="140"
        rx="12"
        stroke="white"
        strokeOpacity="0.3"
      />
      <rect
        x="260"
        y="60"
        width="160"
        height="140"
        rx="12"
        fill="white"
        fillOpacity="0.12"
      />
      <rect
        x="260"
        y="60"
        width="160"
        height="140"
        rx="12"
        stroke="white"
        strokeOpacity="0.3"
      />

      {/* Poignees */}
      <rect
        x="220"
        y="120"
        width="6"
        height="32"
        rx="3"
        fill="white"
        fillOpacity="0.5"
      />
      <rect
        x="400"
        y="120"
        width="6"
        height="32"
        rx="3"
        fill="white"
        fillOpacity="0.5"
      />

      {/* Flocons de neige */}
      <SnowflakeShape cx={155} cy={120} />
      <SnowflakeShape cx={335} cy={120} />

      {/* Carte du bas - releve en cours */}
      <rect
        x="80"
        y="220"
        width="340"
        height="120"
        rx="14"
        fill="white"
        fillOpacity="0.15"
      />
      <rect
        x="80"
        y="220"
        width="340"
        height="120"
        rx="14"
        stroke="white"
        strokeOpacity="0.25"
      />

      {/* Thermometre */}
      <rect
        x="105"
        y="245"
        width="14"
        height="70"
        rx="7"
        fill="white"
        fillOpacity="0.25"
      />
      <circle cx="112" cy="320" r="14" fill="#5D87FF" fillOpacity="0.8" />
      <rect x="109" y="260" width="8" height="55" rx="4" fill="#5D87FF" />

      {/* Lecture temperature */}
      <rect
        x="140"
        y="248"
        width="90"
        height="10"
        rx="4"
        fill="white"
        fillOpacity="0.3"
      />
      <rect
        x="140"
        y="268"
        width="140"
        height="22"
        rx="6"
        fill="#13DEB9"
        fillOpacity="0.7"
      />
      <rect
        x="140"
        y="300"
        width="60"
        height="8"
        rx="3"
        fill="white"
        fillOpacity="0.25"
      />

      {/* Trois creneaux : matin / midi / soir */}
      <circle cx="320" cy="270" r="18" fill="#FFAE1F" fillOpacity="0.7" />
      <circle cx="360" cy="270" r="18" fill="#5D87FF" fillOpacity="0.7" />
      <circle cx="400" cy="270" r="18" fill="#13DEB9" fillOpacity="0.7" />
      <rect
        x="305"
        y="300"
        width="30"
        height="6"
        rx="3"
        fill="white"
        fillOpacity="0.3"
      />
      <rect
        x="345"
        y="300"
        width="30"
        height="6"
        rx="3"
        fill="white"
        fillOpacity="0.3"
      />
      <rect
        x="385"
        y="300"
        width="30"
        height="6"
        rx="3"
        fill="white"
        fillOpacity="0.3"
      />
    </svg>
  );
}

interface SnowflakeShapeProps {
  readonly cx: number;
  readonly cy: number;
}

function SnowflakeShape({ cx, cy }: SnowflakeShapeProps) {
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      stroke="white"
      strokeOpacity="0.7"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="0" y1="-22" x2="0" y2="22" />
      <line x1="-22" y1="0" x2="22" y2="0" />
      <line x1="-15" y1="-15" x2="15" y2="15" />
      <line x1="-15" y1="15" x2="15" y2="-15" />
    </g>
  );
}

interface TrustBadgeProps {
  readonly label: string;
}

function TrustBadge({ label }: TrustBadgeProps) {
  return (
    <span className="rounded-full bg-white/15 px-4 py-2 text-sm text-white/85 backdrop-blur-sm">
      {label}
    </span>
  );
}

const PANEL_GRADIENT =
  'radial-gradient(circle at 25% 30%, #4d7be8 0%, #2a3547 55%, #1f2a3a 100%)';

export function AuthLeftPanel() {
  return (
    <aside
      className="relative hidden flex-col items-center justify-center gap-10 overflow-hidden px-12 lg:flex lg:w-7/12"
      style={{ background: PANEL_GRADIENT }}
      data-testid="auth-left-panel"
    >
      <div className="relative z-10 max-w-md text-center">
        <h1 className="text-3xl font-bold leading-tight text-white">
          Tracabilite HACCP en 1 clic
        </h1>
        <p className="mt-3 text-base leading-relaxed text-white/80">
          Vos releves de temperature matin, midi, soir. Conformite Maison Givre,
          historique tracable, alertes immediates.
        </p>
      </div>

      <div className="animate-[float_6s_ease-in-out_infinite] relative z-10">
        <ColdStorageIllustration />
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-3">
        <TrustBadge label="Saisie en moins de 5s" />
        <TrustBadge label="Audit sanitaire pret" />
        <TrustBadge label="Norme HACCP -18 degC" />
      </div>

      {/* Cercles decoratifs */}
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/8"
      />
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/8"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-1/3 right-1/4 h-28 w-28 rounded-full bg-white/5"
      />
    </aside>
  );
}
