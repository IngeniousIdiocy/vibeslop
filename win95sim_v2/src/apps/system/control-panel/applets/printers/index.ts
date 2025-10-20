import type { ControlPanelApplet, ControlPanelContext, PrintersAppletSession } from '../../types';
import type { ControlPanelManifestEntry } from '../../manifest';
import type { PrinterDefinition } from '@services/print';

function normalizePrinter(definition: PrinterDefinition): PrinterDefinition {
  return {
    ...definition,
    id: definition.id.trim(),
    name: definition.name.trim(),
    driver: definition.driver,
    description: definition.description?.trim(),
    capabilities: definition.capabilities ? [...definition.capabilities] : undefined,
  };
}

export function createApplet(
  context: ControlPanelContext,
  manifest: ControlPanelManifestEntry,
): ControlPanelApplet<PrintersAppletSession> {
  const { print } = context;

  return {
    id: `control-panel/${manifest.id}`,
    title: manifest.title,
    description: manifest.description,
    category: manifest.category,
    keywords: [...manifest.keywords],
    manifest,
    open(): PrintersAppletSession {
      return {
        tabs: ['Printers', 'Ports'],
        listPrinters() {
          return print.listPrinters();
        },
        install(printer: PrinterDefinition) {
          print.installPrinter(normalizePrinter(printer));
        },
        uninstall(id: string) {
          print.removePrinter(id);
        },
        submitTestPage(printerId: string) {
          return print.submitJob({
            printerId,
            documentName: 'Windows 95 Printer Test Page',
            content: 'Windows 95 Printer Test Page\n-----------------------------\nThis is a simulated test page.',
          });
        },
        listJobs(printerId?: string) {
          return print.listJobs(printerId);
        },
        pause(jobId: string) {
          return print.pauseJob(jobId);
        },
        resume(jobId: string) {
          return print.resumeJob(jobId);
        },
        cancel(jobId: string) {
          return print.cancelJob(jobId);
        },
        dispose() {
          // Nothing to dispose yet.
        },
      };
    },
  };
}
