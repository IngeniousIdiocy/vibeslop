export interface ProxyValidationResult {
  valid: boolean;
  normalized?: string;
  reason?: string;
}

function ensureTrailingSlash(url: URL): URL {
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url;
}

export function validateProxyUrl(input: string): ProxyValidationResult {
  if (!input || input.trim().length === 0) {
    return { valid: false, reason: 'empty' };
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch (error) {
    return { valid: false, reason: 'invalid-url' };
  }

  const protocol = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (protocol !== 'http' && protocol !== 'https') {
    return { valid: false, reason: 'invalid-protocol' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'credentials-not-allowed' };
  }

  ensureTrailingSlash(parsed);

  return { valid: true, normalized: parsed.toString() };
}

export function buildProxiedUrl(proxyBase: string, targetUrl: string): string {
  const validation = validateProxyUrl(proxyBase);
  if (!validation.valid || !validation.normalized) {
    throw new Error(`Invalid proxy base: ${validation.reason ?? 'unknown'}`);
  }

  const encodedTarget = encodeURIComponent(targetUrl);
  return `${validation.normalized}${encodedTarget}`;
}

export function isProxyEnabled(proxyBase: string | undefined | null): boolean {
  if (!proxyBase) {
    return false;
  }
  const result = validateProxyUrl(proxyBase);
  return result.valid;
}
