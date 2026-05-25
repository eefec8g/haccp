import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { getClientIp } from './rate-limit';

function makeRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (key: string): string | null => headers[key.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe('[api/rate-limit] getClientIp', () => {
  it('should return x-vercel-forwarded-for first IP when present (non spoofable)', () => {
    const request = makeRequest({
      'x-vercel-forwarded-for': '1.2.3.4, 10.0.0.1',
      'x-forwarded-for': '9.9.9.9',
    });
    expect(getClientIp(request)).toBe('1.2.3.4');
  });

  it('should fallback to x-real-ip when no Vercel header', () => {
    const request = makeRequest({
      'x-real-ip': '5.6.7.8',
      'x-forwarded-for': '9.9.9.9',
    });
    expect(getClientIp(request)).toBe('5.6.7.8');
  });

  it('should use the first IP of x-forwarded-for when only XFF is set', () => {
    const request = makeRequest({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' });
    expect(getClientIp(request)).toBe('9.9.9.9');
  });

  it('should return "unknown" when no proxy headers are present', () => {
    const request = makeRequest({});
    expect(getClientIp(request)).toBe('unknown');
  });
});
