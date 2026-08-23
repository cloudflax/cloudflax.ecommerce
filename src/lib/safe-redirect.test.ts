import { describe, expect, it } from 'vitest';
import { isSafeRedirect } from './safe-redirect';

const BASE = 'http://cloudflax.test';

describe('isSafeRedirect', () => {
  it.each([
    null,
    '',
    '//e.com',
    '/\\e.com',
    '/\\/e.com',
    '/%09/e.com',
    '/%2F%2Fe.com',
    'https://e.com',
    'http://e.com/admin',
    'javascript:alert(1)',
    'http://localhost@e.com',
  ])('rejects %s', (url) => {
    expect(isSafeRedirect(url, BASE)).toBe(false);
  });

  it.each(['/admin', '/account?tab=1', '/', '/delivery?order=42'])('accepts %s', (url) => {
    expect(isSafeRedirect(url, BASE)).toBe(true);
  });
});
