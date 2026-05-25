import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('[logger]', () => {
  it('should forward info() to console.info with the meta object when provided', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logger.info('hello', { userId: 'u1' });

    expect(spy).toHaveBeenCalledWith('hello', { userId: 'u1' });
  });

  it('should forward info() to console.info without meta when omitted', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logger.info('just text');

    expect(spy).toHaveBeenCalledWith('just text');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should forward warn() to console.warn with the meta object when provided', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logger.warn('careful', { code: 42 });

    expect(spy).toHaveBeenCalledWith('careful', { code: 42 });
  });

  it('should forward error() to console.error with the meta object when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.error('boom', { err: 'reason' });

    expect(spy).toHaveBeenCalledWith('boom', { err: 'reason' });
  });

  it('should forward error() to console.error without meta when omitted', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.error('boom');

    expect(spy).toHaveBeenCalledWith('boom');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
