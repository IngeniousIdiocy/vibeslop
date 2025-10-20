import type { EventBus } from '@core/kernel/eventBus';

export type PrinterDriver = 'generic-text' | 'virtual-pdf';

export interface PrinterDefinition {
  id: string;
  name: string;
  driver: PrinterDriver;
  description?: string;
  isDefault?: boolean;
  capabilities?: string[];
}

export type PrintJobStatus =
  | 'queued'
  | 'printing'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface PrintJobRequest {
  printerId: string;
  documentName: string;
  content: string;
  copies?: number;
  contentType?: string;
}

export interface PrintPage {
  number: number;
  lines: string[];
}

export interface TextPrintOptions {
  documentName: string;
  text: string;
  printerId?: string;
  columns?: number;
  linesPerPage?: number;
}

export interface PrintJob {
  id: string;
  printerId: string;
  documentName: string;
  status: PrintJobStatus;
  copies: number;
  content: string;
  contentType: string;
  outputPath?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  pages?: PrintPage[];
}

export interface PrintSpoolResult {
  path: string;
  mimeType: string;
}

export interface PrintSpooler {
  write(job: PrintJob, content: string): PrintSpoolResult;
}

export interface PrintJobEvent {
  job: PrintJob;
}

export interface PrintPrinterEvent {
  action: 'installed' | 'removed' | 'updated';
  printer: PrinterDefinition;
}

export interface PrintServiceEvents {
  'print:job-submitted': PrintJobEvent;
  'print:job-updated': PrintJobEvent;
  'print:job-completed': PrintJobEvent;
  'print:job-error': PrintJobEvent;
  'print:printer-changed': PrintPrinterEvent;
}

export interface PrintService {
  listPrinters(): PrinterDefinition[];
  getPrinter(id: string): PrinterDefinition | undefined;
  installPrinter(printer: PrinterDefinition): PrinterDefinition;
  removePrinter(id: string): PrinterDefinition | undefined;
  submitJob(request: PrintJobRequest): PrintJob;
  spoolText(options: TextPrintOptions): PrintJob;
  getJob(id: string): PrintJob | undefined;
  listJobs(printerId?: string): PrintJob[];
  pauseJob(id: string): PrintJob | undefined;
  resumeJob(id: string): PrintJob | undefined;
  cancelJob(id: string): PrintJob | undefined;
  processNextJob(): PrintJob | undefined;
  processAllJobs(): PrintJob[];
  bus: EventBus;
}
