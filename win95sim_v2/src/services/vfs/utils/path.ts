export interface PathParts {
  drive: string;
  segments: string[];
}

const DRIVE_PATTERN = /^[a-zA-Z]:/;

export function normalizePath(input: string): string {
  if (!input) {
    throw new Error('Path must be a non-empty string');
  }

  let path = input.replace(/\\/g, '/');
  if (!DRIVE_PATTERN.test(path)) {
    throw new Error(`Path must include a drive letter: ${input}`);
  }

  const drive = path.slice(0, 2).toUpperCase();
  let rest = path.slice(2);
  if (rest === '') {
    rest = '/';
  }

  if (!rest.startsWith('/')) {
    rest = `/${rest}`;
  }

  // Collapse repeated slashes and trim trailing slashes (except for root).
  const segments = rest
    .split('/')
    .filter((segment) => segment.length > 0);

  const normalized = `${drive}/${segments.join('/')}`;
  return normalized.endsWith('/') && normalized.length > 3 ? normalized.slice(0, -1) : normalized;
}

export function parts(path: string): PathParts {
  const normalized = normalizePath(path);
  const drive = normalized.slice(0, 2);
  const rest = normalized.length > 3 ? normalized.slice(3) : '';
  const segments = rest === '' ? [] : rest.split('/');
  return { drive, segments };
}

export function basename(path: string): string {
  const { segments, drive } = parts(path);
  if (segments.length === 0) {
    return `${drive}/`;
  }

  return segments[segments.length - 1];
}

export function dirname(path: string): string {
  const { segments, drive } = parts(path);
  if (segments.length <= 1) {
    return `${drive}/`;
  }

  return `${drive}/${segments.slice(0, -1).join('/')}`;
}

export function join(base: string, segment: string): string {
  if (!segment) {
    return normalizePath(base);
  }

  const normalizedBase = normalizePath(base);
  if (segment.includes(':')) {
    return normalizePath(segment);
  }

  const suffix = segment.replace(/^\\+|\/+/, '').replace(/\\/g, '/');
  const combined = normalizedBase.endsWith('/') ? `${normalizedBase}${suffix}` : `${normalizedBase}/${suffix}`;
  return normalizePath(combined);
}

export function isRoot(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.length === 3 && normalized.endsWith('/');
}

export function isDescendant(parent: string, candidate: string): boolean {
  const normalizedParent = normalizePath(parent);
  const normalizedCandidate = normalizePath(candidate);
  if (normalizedParent === normalizedCandidate) {
    return true;
  }

  if (!normalizedCandidate.startsWith(normalizedParent)) {
    return false;
  }

  if (isRoot(normalizedParent)) {
    return true;
  }

  const char = normalizedCandidate.charAt(normalizedParent.length);
  return char === '/' || char === '';
}

export function comparePathDepth(a: string, b: string): number {
  const depthA = parts(a).segments.length;
  const depthB = parts(b).segments.length;
  return depthA - depthB;
}

export function toDisplayName(path: string): string {
  const normalized = normalizePath(path);
  const { segments, drive } = parts(normalized);
  if (segments.length === 0) {
    return `${drive}`;
  }
  return segments[segments.length - 1];
}

export function parentChain(path: string): string[] {
  const { drive, segments } = parts(path);
  const chain: string[] = [`${drive}/`];
  segments.forEach((_segment, index) => {
    const entry = segments.slice(0, index + 1).join('/');
    chain.push(`${drive}/${entry}`);
  });
  return chain;
}
