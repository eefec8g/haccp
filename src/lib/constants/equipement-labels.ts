import type { TypeEquipement } from '@prisma/client';

/**
 * Libelles francais pour les types d'equipement, centralises pour
 * eviter les duplications dans les pages admin et les formulaires
 * (DRY, Clean Code #4). Source de verite unique.
 */
export const EQUIPEMENT_TYPE_LABELS: Readonly<Record<TypeEquipement, string>> =
  {
    CONGELATEUR: 'Congelateur',
    VITRINE: 'Vitrine refrigeree',
    CHAMBRE_FROIDE: 'Chambre froide',
    AUTRE: 'Autre',
  } as const;
