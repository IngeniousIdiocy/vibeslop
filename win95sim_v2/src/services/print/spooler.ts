import { PrintJob, PrintSpoolResult, PrintSpooler } from './types';

export interface SpoolRecord extends PrintSpoolResult {
  jobId: string;
  printerId: string;
  createdAt: number;
  content: string;
}

export interface MemorySpooler extends PrintSpooler {
  read(path: string): string | undefined;
  list(): SpoolRecord[];
  clear(): void;
}

export interface MemorySpoolerOptions {
  root?: string;
  clock?: () => number;
}

function sanitize(segment: string) {
  return segment.replace(/[^a-z0-9_-]+/gi, '-');
}

export function createMemorySpooler(options: MemorySpoolerOptions = {}): MemorySpooler {
  const root = options.root ?? '/vfs/spool';
  const clock = options.clock ?? (() => Date.now());
  const records = new Map<string, SpoolRecord>();

  return {
    write(job: PrintJob, content: string): PrintSpoolResult {
      const jobSegment = `${sanitize(job.printerId)}-${sanitize(job.id)}`;
      const path = `${root}/${jobSegment}.${job.contentType.includes('pdf') ? 'pdf' : 'txt'}`;
      const record: SpoolRecord = {
        jobId: job.id,
        printerId: job.printerId,
        mimeType: job.contentType,
        path,
        content,
        createdAt: clock(),
      };
      records.set(path, record);
      return { path, mimeType: record.mimeType };
    },
    read(path) {
      return records.get(path)?.content;
    },
    list() {
      return Array.from(records.values()).sort((a, b) => a.createdAt - b.createdAt);
    },
    clear() {
      records.clear();
    },
  };
}
