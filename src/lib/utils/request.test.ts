import { describe, it, expect } from 'vitest';
import { getClientIp } from './request';

function makeHeaders(entries: Record<string, string> = {}): Headers {
  const h = new Headers();
  for (const [key, value] of Object.entries(entries)) {
    h.set(key, value);
  }
  return h;
}

describe('[getClientIp]', () => {
  it('should prefer x-vercel-forwarded-for over any other header (non-spoofable)', () => {
    const headers = makeHeaders({
      'x-vercel-forwarded-for': '203.0.113.10',
      'x-real-ip': '10.0.0.1',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    });

    expect(getClientIp(headers)).toBe('203.0.113.10');
  });

  it('should fallback to x-real-ip when x-vercel-forwarded-for is absent', () => {
    const headers = makeHeaders({
      'x-real-ip': '10.0.0.42',
      'x-forwarded-for': '1.2.3.4',
    });

    expect(getClientIp(headers)).toBe('10.0.0.42');
  });

  it('should fallback to the first IP of x-forwarded-for when no other header is set', () => {
    const headers = makeHeaders({
      'x-forwarded-for': '9.9.9.9, 10.0.0.1',
    });

    expect(getClientIp(headers)).toBe('9.9.9.9');
  });

  it('should return "unknown" when no IP-related header is present', () => {
    const headers = makeHeaders({});

    expect(getClientIp(headers)).toBe('unknown');
  });
});
