/**
 * Callback-URL validation for post-login redirects (V1).
 *
 * `new URL` + same-origin check alone is not enough: WHATWG URL parsing
 * normalizes `\` to `/`, so `/\e.com` resolves to `//e.com` — an external
 * origin. Control characters and whitespace get stripped by URL parsers in
 * some positions too, so they are rejected before parsing, and the decoded
 * path is re-checked after.
 */
const hasControlChar = (value: string): boolean =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

export function isSafeRedirect(url: string | null, base = 'http://cloudflax.local'): url is string {
  if (!url || hasControlChar(url) || /[\\\s]/.test(url)) return false;

  let target: URL;
  try {
    target = new URL(url, base);
  } catch {
    return false;
  }

  if (target.origin !== new URL(base).origin) return false;

  // Encoded leftovers only survive in the path: `%09` decodes to a tab, `%2F%2F`
  // to a leading `//`. Reject them there instead of trusting the parser.
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(target.pathname);
  } catch {
    return false;
  }

  if (hasControlChar(decodedPath) || /[\\\s]/.test(decodedPath) || decodedPath.startsWith('//')) {
    return false;
  }

  return true;
}
