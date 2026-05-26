/**
 * Logger minimal HACCP.
 *
 * Wrapper console qui peut etre etendu plus tard (Sentry / Pino / Datadog)
 * sans modifier les call sites. API symetrique avec C8GApp pour faciliter
 * le partage de code entre les deux projets (meme service rate-limit).
 *
 * Pourquoi un wrapper plutot que `console.*` direct :
 *   - point d'extension unique (transport, niveaux, redaction PII)
 *   - meta structure (objet) pour faciliter le scraping ELK/Loki
 *   - testable (spy unique sur `logger.warn` au lieu d'eparpiller les
 *     spies sur console.warn dans chaque test)
 */
type LogMeta = Readonly<Record<string, unknown>>;

interface Logger {
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

/* eslint-disable no-console -- logger is the legitimate central wrapper for console output */
export const logger: Logger = {
  info(message, meta) {
    if (meta) {
      console.info(message, meta);
    } else {
      console.info(message);
    }
  },
  warn(message, meta) {
    if (meta) {
      console.warn(message, meta);
    } else {
      console.warn(message);
    }
  },
  error(message, meta) {
    if (meta) {
      console.error(message, meta);
    } else {
      console.error(message);
    }
  },
};
