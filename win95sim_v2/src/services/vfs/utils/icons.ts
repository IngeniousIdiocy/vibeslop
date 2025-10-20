const ICON_TABLE = new Map<string, string>([
  ['directory', 'folder'],
  ['file', 'file'],
  ['shortcut', 'shortcut'],
  ['text', 'text'],
  ['image', 'image'],
  ['audio', 'audio'],
]);

export function lookupIcon(key: string): string {
  return ICON_TABLE.get(key) ?? 'file';
}

export function registerIcon(key: string, identifier: string): void {
  ICON_TABLE.set(key, identifier);
}
