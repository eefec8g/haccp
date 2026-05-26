import nodemailer from 'nodemailer';
import { logger } from '@/lib/logger';

/**
 * Email transport core. Aligne sur le pattern C8GApp :
 *   - nodemailer SMTP par defaut (compatible Ethereal en dev/test)
 *   - bascule automatique sur l'API HTTP Resend si SMTP_HOST === 'smtp.resend.com'
 *     (plus rapide que SMTP, evite le handshake TLS sur chaque envoi serverless)
 *
 * Variables d'env (cf. .env.example) :
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE, EMAIL_FROM
 *
 * Pour tester en local : appeler `createTestAccount()` puis copier les
 * credentials dans .env (host: smtp.ethereal.email). Le `previewUrl`
 * retourne est logge en dev pour voir le rendu sans envoyer reellement.
 */

const RESEND_API_KEY = process.env.SMTP_PASSWORD;
const USE_RESEND_API =
  process.env.SMTP_HOST === 'smtp.resend.com' && !!RESEND_API_KEY;

const SMTP_TIMEOUT_MS = 10_000;

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  connectionTimeout: SMTP_TIMEOUT_MS,
  greetingTimeout: SMTP_TIMEOUT_MS,
  socketTimeout: SMTP_TIMEOUT_MS,
};

const EMAIL_FROM =
  process.env.EMAIL_FROM || 'HACCP Maison Givre <noreply@maison-givre.fr>';

export interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  readonly contentType: string;
}

export interface EmailOptions {
  // `string | string[]` : permet l'envoi groupe (ex: alerte aux responsables
  // d'une boutique). Nodemailer accepte les deux nativement, et le payload
  // Resend HTTP normalise via `Array.isArray` plus bas.
  readonly to: string | string[];
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
  readonly cc?: string | string[];
  readonly attachments?: readonly EmailAttachment[];
}

export interface SendEmailResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly previewUrl?: string;
  readonly error?: string;
}

/**
 * `nodemailer.createTransport` ouvre un pool TCP : on le memoise sur
 * `globalThis` pour eviter de re-creer un transporter par invocation
 * (utile en dev avec HMR, et en serverless avec warm starts).
 */
const globalForEmail = globalThis as unknown as {
  smtpTransporter: nodemailer.Transporter | undefined;
};

function getTransporter(): nodemailer.Transporter {
  if (!globalForEmail.smtpTransporter) {
    globalForEmail.smtpTransporter = nodemailer.createTransport(SMTP_CONFIG);
  }
  return globalForEmail.smtpTransporter;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

/**
 * `\r` / `\n` dans un subject permettent l'injection d'en-tetes SMTP.
 * On les supprime sur le subject expose dans les helpers metier.
 */
export function sanitizeEmailSubject(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

async function sendViaResendApi(
  options: EmailOptions
): Promise<SendEmailResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: Array.isArray(options.to) ? options.to : [options.to],
      cc: options.cc
        ? Array.isArray(options.cc)
          ? options.cc
          : [options.cc]
        : undefined,
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { id: string };
  return { success: true, messageId: data.id };
}

async function sendViaSmtp(options: EmailOptions): Promise<SendEmailResult> {
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: EMAIL_FROM,
    to: options.to,
    cc: options.cc,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  logger.info('Email sent via SMTP', {
    to: options.to,
    messageId: info.messageId,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
  if (previewUrl && process.env.NODE_ENV !== 'production') {
    logger.info('Email preview URL (dev)', { url: previewUrl });
  }

  return { success: true, messageId: info.messageId, previewUrl };
}

/**
 * Point d'entree unique pour l'envoi d'email.
 * Ne JAMAIS logger le contenu (HTML/text) ni les URLs qui contiennent
 * des tokens (reset password, invitation). Seul `to` et `messageId`
 * sortent dans les logs (pas de PII supplementaire).
 */
export async function sendEmail(
  options: EmailOptions
): Promise<SendEmailResult> {
  try {
    if (USE_RESEND_API) {
      const result = await sendViaResendApi(options);
      logger.info('Email sent via Resend API', {
        to: options.to,
        messageId: result.messageId,
      });
      return result;
    }

    return await sendViaSmtp(options);
  } catch (error: unknown) {
    const message = extractErrorMessage(error, 'Failed to send email');
    logger.error('Email sending failed', { to: options.to, error: message });

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Helper dev : provisionne un compte Ethereal jetable. A copier
 * dans .env (SMTP_USER/SMTP_PASSWORD) pour intercepter les mails
 * sans les remettre. Ne pas appeler en production.
 */
export async function createTestAccount(): Promise<{
  user: string;
  pass: string;
  host: string;
  port: number;
}> {
  const testAccount = await nodemailer.createTestAccount();
  return {
    user: testAccount.user,
    pass: testAccount.pass,
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
  };
}
