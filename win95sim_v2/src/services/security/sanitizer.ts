export interface SanitizerConfig {
  /**
   * Allowed URI schemes for URL-bearing attributes. Relative URLs are always permitted.
   */
  allowedSchemes?: string[];
  /**
   * Attributes that should be preserved even if they resemble event handlers.
   */
  safeEventAttributes?: string[];
}

export interface SanitizeResult {
  html: string;
  removedElements: string[];
  strippedAttributes: string[];
  blockedProtocols: string[];
}

const SCRIPT_TAG_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const ATTRIBUTE_PATTERN = /(href|src|action)\s*=\s*("([^"]*)"|'([^']*)')/gi;

const DEFAULT_ALLOWED_SCHEMES = ['http', 'https', 'data', 'mailto'];

function extractScheme(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return null;
  }

  const protocolMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.exec(trimmed);
  if (!protocolMatch) {
    return null;
  }

  return protocolMatch[0].slice(0, -1).toLowerCase();
}

function shouldPreserveAttribute(attribute: string, safeEventAttributes: string[]): boolean {
  return safeEventAttributes.some((candidate) => candidate.toLowerCase() === attribute.toLowerCase());
}

export function sanitizeHtml(input: string, config: SanitizerConfig = {}): SanitizeResult {
  const allowedSchemes = config.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES;
  const safeEventAttributes = config.safeEventAttributes ?? [];

  const removedElements: string[] = [];
  const strippedAttributes: string[] = [];
  const blockedProtocols: string[] = [];

  let html = input.replace(SCRIPT_TAG_PATTERN, (match) => {
    removedElements.push(match);
    return '';
  });

  html = html.replace(EVENT_HANDLER_PATTERN, (match) => {
    const attribute = match.trim().split('=')[0];
    if (shouldPreserveAttribute(attribute, safeEventAttributes)) {
      return match;
    }

    strippedAttributes.push(attribute);
    return '';
  });

  html = html.replace(
    ATTRIBUTE_PATTERN,
    (match, attr: string, _full: string, doubleValue?: string, singleValue?: string) => {
      const value = doubleValue ?? singleValue ?? '';
      const quote = doubleValue !== undefined ? '"' : "'";
      const scheme = extractScheme(value);
      if (!scheme || allowedSchemes.includes(scheme)) {
        return `${attr}=${quote}${value}${quote}`;
      }

      blockedProtocols.push(`${attr}:${scheme}`);
      strippedAttributes.push(attr);
      const safeValue = value.startsWith('/') ? value : '#';
      return `${attr}=${quote}${safeValue}${quote}`;
    },
  );

  return {
    html,
    removedElements,
    strippedAttributes,
    blockedProtocols,
  };
}
