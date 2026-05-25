import type {
  RateLimitProvider,
  RateLimitResult,
  RateLimitType,
} from './types';
import { createUpstashProvider } from './upstashProvider';
import { createInMemoryProvider } from './inMemoryProvider';
import { logger } from '@/lib/logger';

let cachedProvider: RateLimitProvider | null = null;

/**
 * Enveloppe le provider Upstash d'un fallback in-memory : si une commande
 * Redis echoue (NOPERM evalsha, indispo reseau, quota...), on bascule
 * silencieusement sur le store local pour ne pas bloquer l'auth.
 *
 * Note operations : une bascule reste tracee dans les logs serveur
 * pour declencher une alerte ops, sans leak identifier complet.
 */
function createResilientUpstashProvider(
  url: string,
  token: string
): RateLimitProvider {
  const upstash = createUpstashProvider(url, token);
  let fallback: RateLimitProvider | null = null;

  function getFallback(): RateLimitProvider {
    if (!fallback) {
      logger.warn(
        'Rate limit: Upstash command failed, switching to in-memory fallback'
      );
      fallback = createInMemoryProvider();
    }
    return fallback;
  }

  return {
    async checkAndRecord(
      type: RateLimitType,
      identifier: string
    ): Promise<RateLimitResult> {
      if (fallback) {
        return fallback.checkAndRecord(type, identifier);
      }
      try {
        return await upstash.checkAndRecord(type, identifier);
      } catch {
        return getFallback().checkAndRecord(type, identifier);
      }
    },

    async peek(
      type: RateLimitType,
      identifier: string
    ): Promise<RateLimitResult> {
      if (fallback) {
        return fallback.peek(type, identifier);
      }
      try {
        return await upstash.peek(type, identifier);
      } catch {
        return getFallback().peek(type, identifier);
      }
    },

    async reset(type: RateLimitType, identifier: string): Promise<void> {
      if (fallback) {
        return fallback.reset(type, identifier);
      }
      try {
        return await upstash.reset(type, identifier);
      } catch {
        return getFallback().reset(type, identifier);
      }
    },
  };
}

/**
 * Retourne le provider rate-limit cache pour la duree de vie du
 * runtime. La selection se fait au premier appel selon les env vars :
 *
 *   - UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN presents
 *     -> Upstash distribue + fallback in-memory si commande Redis KO
 *   - sinon -> in-memory direct + warning explicit
 *
 * Pas de throw : sur un environnement degrade (Vercel sans env vars
 * Redis), on prefere un rate-limit best-effort plutot que casser
 * tout le flux d'authentification.
 */
export function getRateLimitProvider(): RateLimitProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    cachedProvider = createResilientUpstashProvider(url, token);
  } else {
    logger.warn('Rate limit: Redis not configured, using in-memory provider');
    cachedProvider = createInMemoryProvider();
  }

  return cachedProvider;
}

/**
 * Reservee aux tests : reset le singleton pour pouvoir tester les
 * branches de selection avec differents env vars.
 */
export function _resetProvider(): void {
  cachedProvider = null;
}
