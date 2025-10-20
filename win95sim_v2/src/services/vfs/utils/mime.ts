const MIME_TABLE = new Map<string, { mime: string; icon: string }>([
  ['txt', { mime: 'text/plain', icon: 'text' }],
  ['md', { mime: 'text/markdown', icon: 'text' }],
  ['json', { mime: 'application/json', icon: 'text' }],
  ['png', { mime: 'image/png', icon: 'image' }],
  ['jpg', { mime: 'image/jpeg', icon: 'image' }],
  ['jpeg', { mime: 'image/jpeg', icon: 'image' }],
  ['gif', { mime: 'image/gif', icon: 'image' }],
  ['bmp', { mime: 'image/bmp', icon: 'image' }],
  ['wav', { mime: 'audio/wav', icon: 'audio' }],
  ['mp3', { mime: 'audio/mpeg', icon: 'audio' }],
  ['lnk', { mime: 'application/x-ms-shortcut', icon: 'shortcut' }],
]);

const DEFAULT_ENTRY = { mime: 'application/octet-stream', icon: 'file' };

export function lookupMime(path: string): { mime: string; icon: string } {
  const match = /\.([^.]+)$/.exec(path.toLowerCase());
  if (!match) {
    return DEFAULT_ENTRY;
  }

  return MIME_TABLE.get(match[1]) ?? DEFAULT_ENTRY;
}

export function registerMime(extension: string, mime: string, icon: string): void {
  MIME_TABLE.set(extension.replace(/^\./, '').toLowerCase(), { mime, icon });
}
