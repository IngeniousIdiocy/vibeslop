let jobCounter = 0;

export interface TextPrintOptions {
  documentName: string;
  text: string;
  columns?: number;
  linesPerPage?: number;
}

export interface PrintPage {
  number: number;
  lines: string[];
}

export interface PrintJob {
  id: string;
  documentName: string;
  createdAt: number;
  pages: PrintPage[];
}

export interface PrintService {
  spoolText(options: TextPrintOptions): PrintJob;
  listJobs(): PrintJob[];
  clear(): void;
}

function wrapLine(line: string, columns: number): string[] {
  if (line.length <= columns) {
    return [line];
  }

  const wrapped: string[] = [];
  let index = 0;
  while (index < line.length) {
    wrapped.push(line.slice(index, index + columns));
    index += columns;
  }
  return wrapped;
}

function paginate(lines: string[], columns: number, linesPerPage: number): PrintPage[] {
  const normalizedLines: string[] = [];
  lines.forEach((line) => {
    wrapLine(line, columns).forEach((wrappedLine) => normalizedLines.push(wrappedLine));
  });

  const pages: PrintPage[] = [];
  let pageNumber = 1;
  for (let i = 0; i < normalizedLines.length; i += linesPerPage) {
    const pageLines = normalizedLines.slice(i, i + linesPerPage);
    pages.push({ number: pageNumber++, lines: pageLines });
  }

  if (pages.length === 0) {
    pages.push({ number: 1, lines: [] });
  }

  return pages;
}

export function createPrintService(): PrintService {
  const jobs: PrintJob[] = [];

  return {
    spoolText(options) {
      const { documentName, text, columns = 80, linesPerPage = 60 } = options;
      const rawLines = text.replace(/\r\n/g, '\n').split('\n');
      const pages = paginate(rawLines, columns, linesPerPage);
      const job: PrintJob = {
        id: `print-${++jobCounter}`,
        documentName,
        createdAt: Date.now(),
        pages,
      };
      jobs.push(job);
      return job;
    },
    listJobs() {
      return jobs.slice();
    },
    clear() {
      jobs.length = 0;
    },
  };
}
