export interface FindOptions {
  matchCase?: boolean;
  direction?: 'forward' | 'backward';
  wrap?: boolean;
  fromIndex?: number;
}

export interface FindResult {
  index: number;
  wrapped: boolean;
  length: number;
}

export interface ReplaceResult {
  replaced: boolean;
  index: number;
  wrapped: boolean;
}

export interface ReplaceAllResult {
  replacements: number;
}

export interface Position {
  line: number;
  column: number;
}

export interface NotepadDocument {
  load(text: string): void;
  getText(): string;
  setText(value: string): void;
  getCaret(): number;
  setCaret(index: number): number;
  getSelection(): { start: number; end: number };
  setSelection(start: number, end: number): void;
  findNext(query: string, options?: FindOptions): FindResult | undefined;
  replaceNext(query: string, replacement: string, options?: FindOptions): ReplaceResult;
  replaceAll(query: string, replacement: string, options?: Omit<FindOptions, 'direction' | 'fromIndex'>): ReplaceAllResult;
  goToLine(lineNumber: number): Position;
  getStatus(): Position;
  getLineCount(): number;
  setWordWrap(enabled: boolean): void;
  getWordWrap(): boolean;
}

interface DocumentOptions {
  wordWrap?: boolean;
  initialText?: string;
}

function normaliseOptions(options: FindOptions | undefined) {
  return {
    matchCase: options?.matchCase ?? false,
    direction: options?.direction ?? 'forward',
    wrap: options?.wrap ?? true,
    fromIndex: options?.fromIndex,
  } as Required<Pick<FindOptions, 'matchCase' | 'direction' | 'wrap'>> & { fromIndex?: number };
}

function getComparableStrings(source: string, query: string, matchCase: boolean) {
  if (matchCase) {
    return { haystack: source, needle: query };
  }
  return { haystack: source.toLowerCase(), needle: query.toLowerCase() };
}

function clampIndex(index: number, lower: number, upper: number): number {
  if (Number.isNaN(index) || !Number.isFinite(index)) {
    return lower;
  }
  return Math.min(Math.max(index, lower), upper);
}

function resolveLineStart(text: string, lineNumber: number): number {
  if (lineNumber < 1) {
    throw new Error('Line number must be >= 1');
  }
  if (text.length === 0) {
    if (lineNumber === 1) {
      return 0;
    }
    throw new Error('Line number exceeds total lines');
  }
  const lines = text.split(/\r?\n/);
  if (lineNumber > lines.length) {
    throw new Error('Line number exceeds total lines');
  }
  let index = 0;
  for (let i = 1; i < lineNumber; i += 1) {
    index += lines[i - 1].length + 1;
  }
  return index;
}

function computePosition(text: string, caret: number): Position {
  const safeCaret = clampIndex(caret, 0, text.length);
  const prefix = text.slice(0, safeCaret);
  const lines = prefix.split(/\r?\n/);
  const line = lines.length;
  const column = lines[lines.length - 1]?.length ?? 0;
  return { line, column: column + 1 };
}

export function createNotepadDocument(options: DocumentOptions = {}): NotepadDocument {
  let text = options.initialText ?? '';
  let caret = 0;
  let selection = { start: 0, end: 0 };
  let wordWrap = options.wordWrap ?? false;

  function setSelectionInternal(start: number, end: number) {
    const safeStart = clampIndex(start, 0, text.length);
    const safeEnd = clampIndex(end, safeStart, text.length);
    selection = { start: safeStart, end: safeEnd };
    caret = safeEnd;
  }

  return {
    load(value) {
      text = value;
      caret = 0;
      selection = { start: 0, end: 0 };
    },
    getText() {
      return text;
    },
    setText(value) {
      text = value;
      caret = clampIndex(caret, 0, text.length);
      selection = { start: caret, end: caret };
    },
    getCaret() {
      return caret;
    },
    setCaret(index) {
      caret = clampIndex(index, 0, text.length);
      selection = { start: caret, end: caret };
      return caret;
    },
    getSelection() {
      return { ...selection };
    },
    setSelection(start, end) {
      setSelectionInternal(start, end);
    },
    findNext(query, rawOptions) {
      if (!query) {
        return undefined;
      }
      const { matchCase, direction, wrap, fromIndex } = normaliseOptions(rawOptions);
      const { haystack, needle } = getComparableStrings(text, query, matchCase);
      const startIndex = fromIndex !== undefined ? clampIndex(fromIndex, 0, text.length) : caret;

      if (direction === 'backward') {
        const searchRegion = haystack.slice(0, startIndex);
        let index = searchRegion.lastIndexOf(needle);
        let wrapped = false;
        if (index === -1 && wrap) {
          index = haystack.lastIndexOf(needle);
          wrapped = index !== -1;
        }
        if (index === -1) {
          return undefined;
        }
        setSelectionInternal(index, index + needle.length);
        caret = selection.start;
        return { index, wrapped, length: needle.length };
      }

      let index = haystack.indexOf(needle, startIndex);
      let wrapped = false;
      if (index === -1 && wrap) {
        index = haystack.indexOf(needle, 0);
        wrapped = index !== -1;
      }
      if (index === -1) {
        return undefined;
      }
      setSelectionInternal(index, index + needle.length);
      return { index, wrapped, length: needle.length };
    },
    replaceNext(query, replacement, options) {
      if (!query) {
        return { replaced: false, index: -1, wrapped: false };
      }

      const { matchCase } = normaliseOptions(options);
      const selectedText = text.slice(selection.start, selection.end);
      const selectionMatches =
        selection.end > selection.start &&
        (matchCase ? selectedText === query : selectedText.toLowerCase() === query.toLowerCase());

      let result: FindResult | undefined;
      if (selectionMatches) {
        result = { index: selection.start, length: query.length, wrapped: false };
      } else {
        result = this.findNext(query, options);
      }

      if (!result) {
        return { replaced: false, index: -1, wrapped: false };
      }

      const before = text.slice(0, selection.start);
      const after = text.slice(selection.end);
      text = `${before}${replacement}${after}`;
      const newCaret = selection.start + replacement.length;
      setSelectionInternal(newCaret, newCaret);
      return { replaced: true, index: result.index, wrapped: result.wrapped };
    },
    replaceAll(query, replacement, options) {
      if (!query) {
        return { replacements: 0 };
      }
      const { matchCase } = normaliseOptions(options);
      const { haystack, needle } = getComparableStrings(text, query, matchCase);
      if (needle.length === 0) {
        return { replacements: 0 };
      }
      let index = haystack.indexOf(needle, 0);
      if (index === -1) {
        return { replacements: 0 };
      }
      let replacements = 0;
      let lastIndex = 0;
      const pieces: string[] = [];
      while (index !== -1) {
        pieces.push(text.slice(lastIndex, index));
        pieces.push(replacement);
        replacements += 1;
        lastIndex = index + needle.length;
        index = haystack.indexOf(needle, lastIndex);
      }
      pieces.push(text.slice(lastIndex));
      text = pieces.join('');
      const safeCaret = clampIndex(caret, 0, text.length);
      setSelectionInternal(safeCaret, safeCaret);
      return { replacements };
    },
    goToLine(lineNumber) {
      const index = resolveLineStart(text, lineNumber);
      setSelectionInternal(index, index);
      return computePosition(text, index);
    },
    getStatus() {
      return computePosition(text, caret);
    },
    getLineCount() {
      if (text.length === 0) {
        return 1;
      }
      return text.replace(/\r\n/g, '\n').split('\n').length;
    },
    setWordWrap(enabled) {
      wordWrap = !!enabled;
    },
    getWordWrap() {
      return wordWrap;
    },
  };
}
