import { createEventBus, EventBus } from '@core/kernel/eventBus';
import { SettingsService } from '@services/settings';

export interface DiagnosticsEvent {
  event: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface DiagnosticsFlushResult {
  events: DiagnosticsEvent[];
  dropped: number;
  optedIn: boolean;
}

export interface DiagnosticsService {
  log(event: string, payload?: Record<string, unknown>): void;
  flush(): Promise<DiagnosticsFlushResult>;
  isOptedIn(): boolean;
  configureTransport(transport: DiagnosticsTransport | undefined): void;
  bus: EventBus;
}

export type DiagnosticsTransport = (events: DiagnosticsEvent[]) => Promise<void> | void;

export interface DiagnosticsServiceOptions {
  settings?: SettingsService;
  preferenceKey?: string;
  transport?: DiagnosticsTransport;
  clock?: () => Date;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true' || value === '1';
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return false;
}

export function createDiagnosticsService(options: DiagnosticsServiceOptions = {}): DiagnosticsService {
  const { settings, preferenceKey = 'telemetry.optIn', transport, clock = () => new Date() } = options;
  const bus = createEventBus();
  const queue: DiagnosticsEvent[] = [];
  let dropped = 0;
  let activeTransport: DiagnosticsTransport | undefined = transport;

  let optedIn = toBoolean(settings?.get(preferenceKey, false));

  if (settings) {
    settings.watch(preferenceKey, (event) => {
      optedIn = toBoolean(event.value);
      if (!optedIn) {
        queue.length = 0;
      }
      bus.emit('diagnostics:opt-in-changed', { optedIn });
    });
  }

  function log(event: string, payload?: Record<string, unknown>) {
    const entry: DiagnosticsEvent = {
      event,
      payload,
      timestamp: clock().toISOString(),
    };

    if (!optedIn) {
      dropped += 1;
      bus.emit('diagnostics:dropped', { event: entry });
      return;
    }

    queue.push(entry);
    bus.emit('diagnostics:logged', { event: entry });
  }

  async function flush(): Promise<DiagnosticsFlushResult> {
    const events = queue.splice(0, queue.length);
    const droppedCount = dropped;
    dropped = 0;

    if (events.length && activeTransport) {
      await activeTransport(events);
    }

    const result: DiagnosticsFlushResult = { events, dropped: droppedCount, optedIn };
    bus.emit('diagnostics:flushed', result);
    return result;
  }

  return {
    log,
    flush,
    isOptedIn() {
      return optedIn;
    },
    configureTransport(next) {
      activeTransport = next;
    },
    bus,
  };
}
