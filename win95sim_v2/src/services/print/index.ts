import { createEventBus } from '@core/kernel/eventBus';
import {
  PrintJob,
  PrintJobRequest,
  PrintService,
  PrintSpooler,
  PrinterDefinition,
  PrintSpoolResult,
  TextPrintOptions,
  PrintPage,
} from './types';
import { createMemorySpooler } from './spooler';

export interface CreatePrintServiceOptions {
  printers?: PrinterDefinition[];
  spooler?: PrintSpooler;
  now?: () => number;
  autoProcess?: boolean;
}

const DEFAULT_PRINTERS: PrinterDefinition[] = [
  {
    id: 'printer:generic-text',
    name: 'Generic / Text Only',
    driver: 'generic-text',
    description: 'Renders plain text output for debugging layouts.',
    isDefault: true,
    capabilities: ['text', 'monochrome'],
  },
  {
    id: 'printer:virtual-pdf',
    name: 'WinPrint PDF Writer',
    driver: 'virtual-pdf',
    description: 'Generates PDF output in the virtual spool folder.',
    capabilities: ['text', 'graphics', 'pdf'],
  },
];

interface InternalJobRecord extends PrintJob {
  _queueIndex: number;
}

function wrapLine(line: string, columns: number): string[] {
  if (line.length <= columns) {
    return [line];
  }

  const segments: string[] = [];
  for (let index = 0; index < line.length; index += columns) {
    segments.push(line.slice(index, index + columns));
  }
  return segments;
}

function paginateLines(lines: string[], columns: number, linesPerPage: number): PrintPage[] {
  const normalized: string[] = [];
  lines.forEach((line) => {
    wrapLine(line, columns).forEach((segment) => normalized.push(segment));
  });

  if (normalized.length === 0) {
    return [{ number: 1, lines: [] }];
  }

  const pages: PrintPage[] = [];
  for (let index = 0; index < normalized.length; index += linesPerPage) {
    const slice = normalized.slice(index, index + linesPerPage);
    pages.push({ number: pages.length + 1, lines: slice });
  }

  return pages;
}

export function createPrintService(options: CreatePrintServiceOptions = {}): PrintService {
  const now = options.now ?? (() => Date.now());
  const bus = createEventBus();
  const spooler = options.spooler ?? createMemorySpooler();
  const printers = new Map<string, PrinterDefinition>();
  const jobs = new Map<string, InternalJobRecord>();
  const queue: string[] = [];
  let jobCounter = 0;

  function emit(type: string, payload: unknown) {
    bus.emit(type, payload);
  }

  function cloneJob(job: InternalJobRecord): PrintJob {
    const { _queueIndex, ...rest } = job;
    return { ...rest };
  }

  function ensurePrinter(id: string) {
    const printer = printers.get(id);
    if (!printer) {
      throw new Error(`Printer with id "${id}" is not installed`);
    }
    return printer;
  }

  function installDefaults() {
    for (const printer of options.printers ?? DEFAULT_PRINTERS) {
      installPrinter(printer);
    }
  }

  function installPrinter(printer: PrinterDefinition): PrinterDefinition {
    if (printers.has(printer.id)) {
      throw new Error(`Printer with id "${printer.id}" is already installed`);
    }

    printers.set(printer.id, { ...printer });
    emit('print:printer-changed', { action: 'installed', printer: { ...printer } });
    return getPrinter(printer.id)!;
  }

  function removePrinter(id: string): PrinterDefinition | undefined {
    const existing = printers.get(id);
    if (!existing) {
      return undefined;
    }

    printers.delete(id);
    for (const job of jobs.values()) {
      if (job.printerId === id && job.status !== 'completed' && job.status !== 'cancelled') {
        job.status = 'cancelled';
        job.updatedAt = now();
        emit('print:job-updated', { job: cloneJob(job) });
      }
    }
    emit('print:printer-changed', { action: 'removed', printer: { ...existing } });
    return { ...existing };
  }

  function getPrinter(id: string) {
    const printer = printers.get(id);
    return printer ? { ...printer } : undefined;
  }

  function resolvePrinterId(preferred?: string): string {
    if (preferred) {
      return ensurePrinter(preferred).id;
    }
    const defaultPrinter = Array.from(printers.values()).find((entry) => entry.isDefault);
    if (defaultPrinter) {
      return defaultPrinter.id;
    }
    const first = printers.values().next().value;
    if (!first) {
      throw new Error('No printers are installed');
    }
    return first.id;
  }

  function listPrinters() {
    return Array.from(printers.values())
      .map((printer) => ({ ...printer }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function enqueue(job: InternalJobRecord) {
    job._queueIndex = queue.push(job.id) - 1;
  }

  function takeNextQueuedJob(): InternalJobRecord | undefined {
    while (queue.length) {
      const jobId = queue.shift();
      if (!jobId) {
        continue;
      }
      const job = jobs.get(jobId);
      if (!job) {
        continue;
      }
      if (job.status !== 'queued') {
        continue;
      }
      job._queueIndex = -1;
      return job;
    }
    return undefined;
  }

  function markUpdated(job: InternalJobRecord, event: 'print:job-updated' | 'print:job-completed' | 'print:job-error') {
    job.updatedAt = now();
    emit(event, { job: cloneJob(job) });
  }

  function processJob(job: InternalJobRecord): InternalJobRecord {
    if (job.status !== 'queued') {
      return job;
    }

    job.status = 'printing';
    markUpdated(job, 'print:job-updated');

    try {
      const result: PrintSpoolResult = spooler.write(job, job.content);
      job.outputPath = result.path;
      job.status = 'completed';
      job.completedAt = now();
      markUpdated(job, 'print:job-completed');
    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : String(error);
      markUpdated(job, 'print:job-error');
    }

    return job;
  }

  function processNextJob(): PrintJob | undefined {
    const job = takeNextQueuedJob();
    if (!job) {
      return undefined;
    }
    const processed = processJob(job);
    return cloneJob(processed);
  }

  function processAllJobs(): PrintJob[] {
    const results: PrintJob[] = [];
    let job: PrintJob | undefined;
    while ((job = processNextJob())) {
      results.push(job);
    }
    return results;
  }

  function submitJob(request: PrintJobRequest): PrintJob {
    ensurePrinter(request.printerId);
    const createdAt = now();
    const job: InternalJobRecord = {
      id: `job-${++jobCounter}`,
      printerId: request.printerId,
      documentName: request.documentName,
      copies: request.copies ?? 1,
      content: request.content,
      contentType: request.contentType ?? 'text/plain',
      status: 'queued',
      outputPath: undefined,
      error: undefined,
      createdAt,
      updatedAt: createdAt,
      completedAt: undefined,
      _queueIndex: -1,
    };

    jobs.set(job.id, job);
    enqueue(job);
    emit('print:job-submitted', { job: cloneJob(job) });

    if (options.autoProcess !== false) {
      processAllJobs();
    }

    return cloneJob(job);
  }

  function spoolText(options: TextPrintOptions): PrintJob {
    const printerId = resolvePrinterId(options.printerId);
    const rawText = options.text.replace(/\r\n/g, '\n');
    const lines = rawText.split('\n');
    const pages = paginateLines(lines, options.columns ?? 80, options.linesPerPage ?? 60);
    const job = submitJob({
      printerId,
      documentName: options.documentName,
      content: rawText,
      contentType: 'text/plain',
      copies: 1,
    });
    const record = jobs.get(job.id);
    if (record) {
      record.pages = pages;
      return cloneJob(record);
    }

    return { ...job, pages };
  }

  function getJob(id: string) {
    const job = jobs.get(id);
    return job ? cloneJob(job) : undefined;
  }

  function listJobs(printerId?: string) {
    const items = Array.from(jobs.values())
      .filter((job) => !printerId || job.printerId === printerId)
      .map((job) => cloneJob(job));
    return items.sort((a, b) => a.createdAt - b.createdAt);
  }

  function updateQueue(job: InternalJobRecord) {
    if (job.status === 'queued' && job._queueIndex === -1) {
      enqueue(job);
    }
  }

  function pauseJob(id: string) {
    const job = jobs.get(id);
    if (!job) {
      return undefined;
    }
    if (job.status === 'queued' || job.status === 'printing') {
      job.status = 'paused';
      markUpdated(job, 'print:job-updated');
    }
    return cloneJob(job);
  }

  function resumeJob(id: string) {
    const job = jobs.get(id);
    if (!job) {
      return undefined;
    }
    if (job.status === 'paused') {
      job.status = 'queued';
      markUpdated(job, 'print:job-updated');
      updateQueue(job);
      if (options.autoProcess !== false) {
        processAllJobs();
      }
    }
    return cloneJob(job);
  }

  function cancelJob(id: string) {
    const job = jobs.get(id);
    if (!job) {
      return undefined;
    }
    if (job.status === 'queued' || job.status === 'paused') {
      job.status = 'cancelled';
      markUpdated(job, 'print:job-updated');
    }
    return cloneJob(job);
  }

  installDefaults();

  return {
    listPrinters,
    getPrinter,
    installPrinter,
    removePrinter,
    submitJob,
    spoolText,
    getJob,
    listJobs,
    pauseJob,
    resumeJob,
    cancelJob,
    processNextJob,
    processAllJobs,
    bus,
  };
}

export type { PrintJob, PrintJobRequest, PrintService, PrinterDefinition } from './types';
export { createMemorySpooler } from './spooler';
export type { MemorySpooler, SpoolRecord } from './spooler';
