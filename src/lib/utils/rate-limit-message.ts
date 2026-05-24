const SECONDS_PER_MINUTE = 60;

/**
 * Construit le message rate-limit affiche a l'utilisateur. Le delai est
 * formate en minutes si >= 60s, sinon en secondes. Le message est generique :
 * pas d'info sur l'utilisateur (anti-enum compatible).
 */
export function buildRateLimitMessage(retryAfterSeconds: number): string {
  if (retryAfterSeconds <= 0) {
    return 'Trop de tentatives. Veuillez patienter quelques minutes.';
  }

  if (retryAfterSeconds < SECONDS_PER_MINUTE) {
    return `Trop de tentatives. Reessayez dans ${retryAfterSeconds} seconde${retryAfterSeconds > 1 ? 's' : ''}.`;
  }

  const minutes = Math.ceil(retryAfterSeconds / SECONDS_PER_MINUTE);
  return `Trop de tentatives. Reessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`;
}
