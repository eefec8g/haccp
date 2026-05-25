/**
 * Echappe les caracteres HTML dangereux dans une chaine destinee a etre
 * interpolee dans du markup. Defense en profondeur contre les XSS quand
 * une variable d'origine utilisateur (ou meme controlee serveur)
 * arrive dans un template HTML construit par concatenation.
 *
 * On echappe les 5 caracteres reconnus par OWASP comme contexte HTML :
 *   - `&` (doit etre traite EN PREMIER pour ne pas double-echapper)
 *   - `<` et `>` (frontieres de balise)
 *   - `"` et `'` (frontieres d'attribut)
 *
 * Note : pour des URLs ou des chaines de contexte JS/CSS, utiliser un
 * helper dedie (encodeURI*, JSON.stringify, etc.). Ce helper est
 * specifique au contexte HTML body/attribute.
 */
const ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
} as const;

const ESCAPE_REGEX = /[&<>"']/g;

export function escapeHtml(value: string): string {
  return value.replace(ESCAPE_REGEX, (char) => ESCAPE_MAP[char] ?? char);
}
