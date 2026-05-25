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
 * Intervalle de retry apres bascule sur le fallback : on retente Upstash
 * apres ce delai pour ne pas rester definitivement degrade en cas de
 * panne transitoire (NOPERM evalsha, indispo reseau temporaire...).
 */
const UPSTASH_RETRY_INTERVAL_MS = 5 * 60 * 1000;

interface ResilientOperationArgs<T> {
  readonly opName: 'checkAndRecord' | 'peek' | 'reset';
  readonly upstashOp: () => Promise<T>;
  readonly fallbackOp: (fallback: RateLimitProvider) => Promise<T>;
}

/**
 * Enveloppe le provider Upstash d'un fallback in-memory : si une commande
 * Redis echoue (NOPERM evalsha, indispo reseau, quota...), on bascule
 * sur le store local pour ne pas bloquer l'auth.
 *
 * Strategie de recovery :
 *   - Apres bascule, on reste sur le fallback pendant `UPSTASH_RETRY_INTERVAL_MS`.
 *   - Une fois ce delai ecoule, on retente Upstash a la prochaine commande :
 *     - succes -> on revient sur Upstash et on clear le fallback (log warn)
 *     - echec  -> on reste sur le fallback et on reset le TTL.
 *
 * Note operations : chaque echec Upstash est trace via `logger.error`
 * (sans leak identifier complet via les couches superieures).
 */
function createResilientUpstashProvider(
  url: string,
  token: string
): RateLimitProvider {
  const upstash = createUpstashProvider(url, token);
  let fallback: RateLimitProvider | null = null;
  let fallbackUntilMs = 0;

  function getFallback(): RateLimitProvider {
    if (!fallback) {
      logger.warn(
        'Rate limit: Upstash command failed, switching to in-memory fallback'
      );
      fallback = createInMemoryProvider();
    }
    return fallback;
  }

  function activateFallback(): RateLimitProvider {
    fallbackUntilMs = Date.now() + UPSTASH_RETRY_INTERVAL_MS;
    return getFallback();
  }

  function clearFallback(): void {
    if (fallback) {
      logger.warn('Rate limit: switching back to Upstash');
    }
    fallback = null;
    fallbackUntilMs = 0;
  }

  function isFallbackActive(): boolean {
    return fallback !== null && Date.now() < fallbackUntilMs;
  }

  async function runResilient<T>(args: ResilientOperationArgs<T>): Promise<T> {
    if (isFallbackActive() && fallback) {
      return args.fallbackOp(fallback);
    }
    try {
      const result = await args.upstashOp();
      // Succes : si on etait sur fallback expire, on revient sur Upstash.
      if (fallback) {
        clearFallback();
      }
      return result;
    } catch (error) {
      logger.error('Upstash rate-limit command failed', {
        op: args.opName,
        cause: String(error),
      });
      return args.fallbackOp(activateFallback());
    }
  }

  return {
    checkAndRecord(
      type: RateLimitType,
      identifier: string
    ): Promise<RateLimitResult> {
      return runResilient({
        opName: 'checkAndRecord',
        upstashOp: () => upstash.checkAndRecord(type, identifier),
        fallbackOp: (fb) => fb.checkAndRecord(type, identifier),
      });
    },

    peek(type: RateLimitType, identifier: string): Promise<RateLimitResult> {
      return runResilient({
        opName: 'peek',
        upstashOp: () => upstash.peek(type, identifier),
        fallbackOp: (fb) => fb.peek(type, identifier),
      });
    },

    reset(type: RateLimitType, identifier: string): Promise<void> {
      return runResilient({
        opName: 'reset',
        upstashOp: () => upstash.reset(type, identifier),
        fallbackOp: (fb) => fb.reset(type, identifier),
      });
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

/**
 * Reservee aux tests : permet d'instancier directement le wrapper
 * resilient pour tester ses chemins de recovery sans passer par les
 * env vars.
 */
export { createResilientUpstashProvider as _createResilientUpstashProvider };
export { UPSTASH_RETRY_INTERVAL_MS as _UPSTASH_RETRY_INTERVAL_MS };
