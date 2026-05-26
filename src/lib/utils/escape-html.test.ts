import { describe, it, expect } from 'vitest';
import { escapeHtml } from './escape-html';

describe('[escapeHtml]', () => {
  it('should escape ampersand first to avoid double-escaping', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape angle brackets and quotes', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape single quotes (attribute context)', () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
  });

  it('should leave a safe string untouched', () => {
    expect(escapeHtml('Alice Dupont')).toBe('Alice Dupont');
  });

  it('should handle an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
