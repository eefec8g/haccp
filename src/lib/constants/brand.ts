/**
 * Charte de marque Maison Givre - constantes partagees par la vitrine.
 *
 * Maison Givre est un glacier artisan francais fonde en 1933, maison
 * familiale 3 generations. Deux boutiques : Lyon et Strasbourg.
 * La vitrine publique communique l'elegance, l'authenticite et le
 * savoir-faire de la marque.
 *
 * Ces constantes sont la SEULE source de verite pour les chaines visibles
 * de la vitrine. Toute modification de copywriting passe par ce fichier.
 */

/** Couleurs officielles Maison Givre. Toute autre couleur est interdite. */
export const BRAND_COLORS = {
  /** Fond principal, packaging clair. */
  ivoire: '#F7F4EF',
  /** Texte sur ivoire, fond des sections fortes. */
  noir: '#0D0D0D',
  /** Accents : traits, monogramme, liserets. */
  or: '#C6A46C',
  /** Variation chaude pour hover/focus. */
  orLight: '#D4B584',
  /** Variation foncee pour bordures fines. */
  orDark: '#9E834A',
} as const;

export type BrandColor = keyof typeof BRAND_COLORS;

/** Wordmark principal. CAPITALES, jamais minuscule. */
export const BRAND_NAME = 'MAISON GIVRE' as const;

/** Sous-titre signature. */
export const BRAND_TAGLINE = 'GLACIER ARTISAN' as const;

/** Mention heritage, toujours encadree de points or. */
export const BRAND_HERITAGE = 'DEPUIS 1933' as const;

/** Annee de fondation, pour calculs (copyright, anciennete). */
export const BRAND_FOUNDING_YEAR = 1933 as const;

/** 3 mots-cles manifest affiches sur la section valeurs. */
export const BRAND_KEYWORDS = [
  'ELEGANCE',
  'AUTHENTICITE',
  'SAVOIR-FAIRE',
] as const;

/** Tagline officielle (texte complet, ne pas reformuler). */
export const BRAND_STORY =
  "Maison familiale depuis trois generations, nous selectionnons les meilleurs ingredients et perpetuons chaque jour l'art du glacier avec passion et exigence.";

/** Clefs des pictogrammes des piliers (SVG inline dans PiliersSection). */
export type PillarIconKey = 'feuille' | 'fouet' | 'montagne' | 'flocon';

export interface BrandPillar {
  readonly id: string;
  readonly iconKey: PillarIconKey;
  readonly title: string;
  readonly description: string;
}

/** Les 4 piliers de marque, affiches en grille sur fond noir profond. */
export const BRAND_PILLARS: readonly BrandPillar[] = [
  {
    id: 'ingredients',
    iconKey: 'feuille',
    title: 'INGREDIENTS SELECTIONNES',
    description:
      'Fruits, laits et chocolats choisis aupres de producteurs partenaires, pour une qualite irreprochable.',
  },
  {
    id: 'fabrication',
    iconKey: 'fouet',
    title: 'FABRICATION ARTISANALE',
    description:
      'Chaque parfum est elabore a la main dans notre atelier, sans concession sur le temps de repos.',
  },
  {
    id: 'savoir-faire',
    iconKey: 'montagne',
    title: 'SAVOIR-FAIRE FRANCAIS',
    description:
      'Une transmission de gestes et de recettes perpetuee depuis 1933, generation apres generation.',
  },
  {
    id: 'exception',
    iconKey: 'flocon',
    title: "GLACES & SORBETS D'EXCEPTION",
    description:
      "Des creations d'auteur, equilibrees et raffinees, pensees pour les tables d'exception.",
  },
];

/** Glacier actuel, 3e generation. Son pere a fonde la maison en 1933. */
export const BRAND_FOUNDER_NAME = 'Jean-Marc' as const;

/** Intro de l'histoire (mise en valeur grande typographie). */
export const BRAND_HISTORY_INTRO = {
  line1: "Chez Maison Givre, la glace n'est pas un produit.",
  line2: "C'est une histoire de famille.",
} as const;

/**
 * Texte officiel "Notre histoire" (a reprendre VERBATIM, source : maquette
 * Maison Givre fournie par le user). Decoupage par paragraphes pour la
 * mise en page typographique (chaque \n logique = saut de ligne).
 */
export const BRAND_HISTORY_PARAGRAPHS: readonly string[] = [
  "Tout commence en 1933, lorsque le pere de Jean-Marc fabriquait deja ses premieres glaces, avec ce qu'il avait de plus precieux : du lait frais, des fruits de saison... et du temps.",
  "Aujourd'hui, Jean-Marc perpetue ce savoir-faire avec la meme exigence. Dans son atelier, il possede sa propre machine, comme a l'epoque, pour maitriser chaque etape de fabrication.",
  "Ici, rien n'est laisse au hasard : aucun colorant, aucun additif, aucun compromis.",
  'Les fruits sont selectionnes un a un, selon les saisons, pour offrir des glaces sinceres, naturelles... et profondement gourmandes.',
];

/** Conclusion poetique de la section histoire. */
export const BRAND_HISTORY_OUTRO = {
  line1: 'Chaque boule raconte une histoire.',
  line2: 'Chaque parfum est une signature.',
} as const;

/** Boutique Maison Givre (point de vente physique). */
export interface BrandBoutique {
  readonly id: string;
  readonly name: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
}

/** Les 2 boutiques Maison Givre. */
export const BRAND_BOUTIQUES: readonly BrandBoutique[] = [
  {
    id: 'lyon',
    name: 'BOUTIQUE LYON',
    street: '26 rue Victor Hugo',
    postalCode: '69002',
    city: 'LYON',
  },
  {
    id: 'strasbourg',
    name: 'BOUTIQUE STRASBOURG',
    street: '13 rue des Freres',
    postalCode: '67000',
    city: 'STRASBOURG',
  },
];

/** Coordonnees / contact affichees sur la section CTA. */
export const BRAND_CONTACT = {
  email: 'contact@maison-givre.fr',
  instagram: '@maisongivre',
} as const;

/** Liens de navigation principale de la vitrine (ancres internes). */
export interface BrandNavLink {
  readonly label: string;
  readonly href: string;
  readonly testid: string;
}

export const BRAND_NAV_LINKS: readonly BrandNavLink[] = [
  { label: 'Maison', href: '#hero', testid: 'landing-nav-hero' },
  {
    label: 'Savoir-faire',
    href: '#savoir-faire',
    testid: 'landing-nav-savoir-faire',
  },
  {
    label: 'Notre histoire',
    href: '#histoire',
    testid: 'landing-nav-histoire',
  },
  { label: 'Contact', href: '#contact', testid: 'landing-nav-contact' },
];
