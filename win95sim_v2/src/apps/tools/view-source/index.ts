import { sanitizeHtml, SanitizeResult, SanitizerConfig } from '@services/security/sanitizer';

export interface ViewSourceOptions {
  sanitizerConfig?: SanitizerConfig;
}

export interface ViewSourceResult extends SanitizeResult {
  lines: string[];
}

export function renderSourceDocument(source: string, options: ViewSourceOptions = {}): ViewSourceResult {
  const result = sanitizeHtml(source, options.sanitizerConfig);
  const lines = result.html.split(/\r?\n/u);
  return {
    ...result,
    lines,
  };
}
