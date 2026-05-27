import { escapeHtml } from '@/lib/utils/escape-html';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { formatDateShort } from '@/lib/utils/dates';
import { formatTemperature } from '@/lib/utils/format-temperature';
import type { Creneau } from '@prisma/client';
import { sendEmail } from './emailService';

/**
 * Email d'alerte temperature (Epic ALERTE - declenche par RELEVE).
 *
 * Pourquoi un fichier separe ?
 *   - SRP (Clean Code #3) : un service email = un concern metier.
 *   - Permet le mock indpendant dans les tests de releve.service.
 *
 * Best-effort : en cas d'echec transport on retourne un Result error
 * que le caller fire-and-forget peut juste logger. La latence ne doit
 * jamais retarder la reponse de saisie (ENF-1 < 10s, decision #2).
 */

export type AlerteEmailResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: string };

interface AlerteEmailFields {
  readonly equipementNom: string;
  readonly boutiqueNom: string;
  readonly creneau: Creneau;
  readonly dateISO: string;
  readonly temperature: number;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly commentaire: string | null;
  readonly alerteUrl: string;
}

interface SendAlerteEmailArgs extends AlerteEmailFields {
  readonly recipients: readonly string[];
}

function buildAlerteEmailHtml(fields: AlerteEmailFields): string {
  const safeEquipement = escapeHtml(fields.equipementNom);
  const safeBoutique = escapeHtml(fields.boutiqueNom);
  const safeCreneau = escapeHtml(CRENEAU_LABELS[fields.creneau]);
  const safeDate = escapeHtml(formatDateShort(fields.dateISO));
  const safeTemperature = escapeHtml(formatTemperature(fields.temperature));
  const safeSeuils = escapeHtml(
    `${fields.seuilMin.toFixed(1)} degC / ${fields.seuilMax.toFixed(1)} degC`
  );
  const safeCommentaire = fields.commentaire
    ? escapeHtml(fields.commentaire)
    : '';
  const safeUrl = escapeHtml(fields.alerteUrl);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Maison Givre</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <!--[if !mso]><!-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F7F4EF;font-family:Montserrat, 'Segoe UI', system-ui, sans-serif;color:#0D0D0D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F7F4EF;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#FFFFFF;">
          <tr>
            <td style="padding:40px 32px;text-align:center;">
              <p style="margin:0;color:#0D0D0D;font-size:22px;font-weight:300;letter-spacing:0.3em;">MAISON GIVRE</p>
              <div style="margin:16px auto;width:60px;height:1px;background-color:#C6A46C;line-height:1px;font-size:0;">&nbsp;</div>
              <p style="margin:0;color:#C6A46C;font-size:10px;font-weight:400;letter-spacing:0.3em;">ALERTE TEMPERATURE</p>

              <h1 style="margin:36px 0 0;color:#0D0D0D;font-size:14px;font-weight:400;letter-spacing:0.3em;text-transform:uppercase;">${safeEquipement} &middot; ${safeBoutique}</h1>
              <div style="margin:24px auto;width:40px;height:1px;background-color:#C6A46C;line-height:1px;font-size:0;">&nbsp;</div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;">
                <tr>
                  <td style="padding:8px 0;color:#0D0D0D;opacity:0.6;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-align:left;">Releve</td>
                  <td style="padding:8px 0;color:#0D0D0D;font-size:13px;text-align:right;">${safeDate} &middot; ${safeCreneau}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#0D0D0D;opacity:0.6;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-align:left;">Temperature</td>
                  <td style="padding:8px 0;color:#0D0D0D;font-size:13px;text-align:right;font-weight:600;">${safeTemperature}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#0D0D0D;opacity:0.6;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-align:left;">Seuils</td>
                  <td style="padding:8px 0;color:#0D0D0D;font-size:13px;text-align:right;">${safeSeuils}</td>
                </tr>
              </table>

              ${
                safeCommentaire
                  ? `<p style="margin:0 0 32px;color:#0D0D0D;font-size:13px;line-height:1.7;font-weight:300;font-style:italic;">"${safeCommentaire}"</p>`
                  : ''
              }

              <a href="${safeUrl}" style="display:inline-block;background-color:#0D0D0D;color:#F7F4EF;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:500;letter-spacing:0.3em;text-transform:uppercase;border:1px solid #0D0D0D;">
                Voir l'alerte
              </a>

              <div style="margin:48px auto 0;width:40px;height:1px;background-color:#C6A46C;line-height:1px;font-size:0;">&nbsp;</div>
              <p style="margin:24px 0 0;color:#0D0D0D;opacity:0.5;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;">
                Maison Givre &middot; Glacier Artisan
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAlerteEmailText(fields: AlerteEmailFields): string {
  const lines = [
    'MAISON GIVRE',
    'ALERTE TEMPERATURE',
    '─────',
    '',
    `Equipement : ${fields.equipementNom}`,
    `Boutique   : ${fields.boutiqueNom}`,
    `Releve     : ${formatDateShort(fields.dateISO)} - ${CRENEAU_LABELS[fields.creneau]}`,
    `Temperature: ${formatTemperature(fields.temperature)}`,
    `Seuils     : ${fields.seuilMin.toFixed(1)} degC / ${fields.seuilMax.toFixed(1)} degC`,
  ];
  if (fields.commentaire) {
    lines.push('', `Commentaire: ${fields.commentaire}`);
  }
  lines.push('', "Voir l'alerte :", fields.alerteUrl, '', '—', 'Maison Givre');
  return lines.join('\n');
}

function buildSubject(equipementNom: string, boutiqueNom: string): string {
  return `Maison Givre - Alerte temperature : ${equipementNom} a ${boutiqueNom}`;
}

/**
 * Envoie l'email d'alerte aux destinataires (responsables/admins).
 * Si la liste est vide, retourne success sans appeler le transport (aucun
 * destinataire = pas d'erreur metier, juste rien a faire).
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

export async function sendAlerteEmail({
  recipients,
  ...fields
}: SendAlerteEmailArgs): Promise<AlerteEmailResult> {
  if (recipients.length === 0) {
    return { success: true };
  }
  try {
    const result = await sendEmail({
      to: [...recipients],
      subject: buildSubject(fields.equipementNom, fields.boutiqueNom),
      html: buildAlerteEmailHtml(fields),
      text: buildAlerteEmailText(fields),
    });
    if (!result.success) {
      return { success: false, error: result.error ?? 'Unknown error' };
    }
    return { success: true };
  } catch (error: unknown) {
    // Best-effort : la latence email ne doit JAMAIS bloquer la saisie
    // (ENF-1 < 10s). On encapsule un throw eventuel du transport (ex:
    // erreur reseau imprevue) dans le Result pour que le caller
    // fire-and-forget puisse juste logger sans crash de la requete.
    return { success: false, error: toErrorMessage(error) };
  }
}
