/**
 * Classification d'une temperature en "bande" visuelle pour le code
 * couleur des releves (dashboard, recap tournee, etc.).
 *
 *   - `COLD`   : < 0 degC  -> bleu (regime froid normal d'un congelateur)
 *   - `NORMAL` : 0 a 20 degC inclus -> neutre
 *   - `HIGH`   : > 20 degC -> rouge (temperature anormalement haute)
 *
 * Independant des seuils metier de chaque equipement (qui pilotent les
 * alertes) : c'est un simple repere visuel de lecture rapide demande
 * par le terrain.
 */
export type TemperatureBand = 'COLD' | 'NORMAL' | 'HIGH';

const COLD_STRICT_MAX = 0;
const HIGH_STRICT_MIN = 20;

export function getTemperatureBand(
  temperature: number | null | undefined
): TemperatureBand | null {
  if (temperature === null || temperature === undefined) {
    return null;
  }
  if (temperature < COLD_STRICT_MAX) {
    return 'COLD';
  }
  if (temperature > HIGH_STRICT_MIN) {
    return 'HIGH';
  }
  return 'NORMAL';
}
