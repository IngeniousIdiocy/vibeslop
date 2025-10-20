import type { DisplayService, DisplayState, ScalingMode } from '@services/display';
import type { SettingsService } from '@services/settings';
import type { PrintService } from '@services/print';
import type { ControlPanelManifestEntry } from './manifest';

export interface ControlPanelContext {
  display: DisplayService;
  settings: SettingsService;
  print: PrintService;
}

export interface ControlPanelAppletSession {
  tabs: string[];
  dispose(): void;
}

export interface DisplayAppletSession extends ControlPanelAppletSession {
  state: {
    applied: DisplayState;
    pending: DisplayState;
  };
  previewResolution(width: number, height: number): void;
  setScalingMode(mode: ScalingMode): void;
  toggleIntegerScale(enabled: boolean): void;
  apply(): void;
  cancel(): void;
}

export interface DateTimeAppletSession extends ControlPanelAppletSession {
  getOffsetMinutes(): number;
  setOffsetMinutes(minutes: number): void;
  apply(): void;
  reset(): void;
}

export interface InputAppletSession extends ControlPanelAppletSession {
  getRepeatRate(): number;
  setRepeatRate(rate: number): void;
  getDelay(): number;
  setDelay(delay: number): void;
  apply(): void;
  reset(): void;
}

export interface MouseAppletSession extends ControlPanelAppletSession {
  getPointerSpeed(): number;
  setPointerSpeed(speed: number): void;
  getDoubleClickSpeed(): number;
  setDoubleClickSpeed(speed: number): void;
  apply(): void;
  reset(): void;
}

export interface SoundsAppletSession extends ControlPanelAppletSession {
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  getScheme(): string;
  setScheme(scheme: string): void;
  preview(event: string): string | null;
  apply(): void;
  reset(): void;
}

export interface PrintersAppletSession extends ControlPanelAppletSession {
  listPrinters(): ReturnType<ControlPanelContext['print']['listPrinters']>;
  install(printer: Parameters<ControlPanelContext['print']['installPrinter']>[0]): void;
  uninstall(id: string): void;
  submitTestPage(printerId: string): ReturnType<ControlPanelContext['print']['submitJob']>;
  listJobs(printerId?: string): ReturnType<ControlPanelContext['print']['listJobs']>;
  pause(jobId: string): ReturnType<ControlPanelContext['print']['pauseJob']>;
  resume(jobId: string): ReturnType<ControlPanelContext['print']['resumeJob']>;
  cancel(jobId: string): ReturnType<ControlPanelContext['print']['cancelJob']>;
}

export interface ControlPanelApplet<TSession extends ControlPanelAppletSession = ControlPanelAppletSession> {
  id: string;
  title: string;
  description?: string;
  category: string;
  keywords: string[];
  manifest: ControlPanelManifestEntry;
  open(): TSession;
}

export interface ControlPanelAppletModule<TSession extends ControlPanelAppletSession = ControlPanelAppletSession> {
  createApplet(context: ControlPanelContext, manifest: ControlPanelManifestEntry): ControlPanelApplet<TSession>;
}
