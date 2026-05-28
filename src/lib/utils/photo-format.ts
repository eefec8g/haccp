import { ALLOWED_PHOTO_MIME_TYPES } from '@/lib/constants/photo';

/**
 * Validation cote client du format d'un fichier image AVANT compression.
 *
 * La compression repose sur `<img>` + canvas : un format non decodable
 * par le navigateur (HEIC/HEIF iPhone, TIFF, fichier corrompu) echoue
 * silencieusement avec un message generique peu actionnable. On detecte
 * en amont les cas connus pour donner une consigne claire a l'operateur
 * terrain.
 *
 * Le backend n'accepte de toute facon que JPEG / PNG / WebP (verif magic
 * bytes), donc autant rejeter tot avec un message utile.
 */

export const HEIC_FORMAT_MESSAGE =
  'Les photos au format HEIC/HEIF (iPhone) ne sont pas prises en charge. ' +
  "Reglez Reglages > Appareil photo > Formats sur 'Plus compatible' (JPEG), " +
  "ou convertissez l'image en JPEG/PNG.";

export const UNSUPPORTED_FORMAT_MESSAGE =
  'Format non supporte. Utilisez une image JPEG, PNG ou WebP.';

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

/**
 * Retourne un message d'erreur FR si le format est non supporte, sinon
 * `null`. Un `file.type` vide (certains navigateurs ne renseignent pas le
 * MIME) n'est PAS rejete ici : on laisse la compression tenter le
 * decodage et echouer proprement le cas echeant.
 */
export function detectImageFormatError(file: File): string | null {
  if (isHeic(file)) {
    return HEIC_FORMAT_MESSAGE;
  }
  const allowed = ALLOWED_PHOTO_MIME_TYPES as readonly string[];
  if (file.type !== '' && !allowed.includes(file.type)) {
    return UNSUPPORTED_FORMAT_MESSAGE;
  }
  return null;
}
