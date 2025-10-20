import { createEventBus, EventBus } from '@core/kernel/eventBus';

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed';

export interface DownloadRequest {
  id?: string;
  url: string;
  filename: string;
  mimeType?: string;
}

export interface DownloadRecord extends DownloadRequest {
  id: string;
  status: DownloadStatus;
  receivedBytes: number;
  totalBytes?: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface DownloadResponse {
  data: ArrayBuffer | Uint8Array | string;
  totalBytes?: number;
}

export interface DownloadManagerOptions {
  fetchResource?: (request: DownloadRequest) => Promise<DownloadResponse>;
  saveFile?: (record: DownloadRecord, data: Uint8Array) => Promise<void> | void;
  idGenerator?: () => string;
}

export interface DownloadEvent {
  record: DownloadRecord;
}

export interface DownloadManager {
  start(request: DownloadRequest): Promise<DownloadRecord>;
  get(id: string): DownloadRecord | undefined;
  list(): DownloadRecord[];
  bus: EventBus;
}

let autoIncrement = 0;

function defaultIdGenerator(): string {
  autoIncrement += 1;
  return `download-${autoIncrement}`;
}

function coerceToUint8Array(data: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }

  if (data instanceof Uint8Array) {
    return data;
  }

  return new Uint8Array(data);
}

export function createDownloadManager(options: DownloadManagerOptions = {}): DownloadManager {
  const fetchResource = options.fetchResource ?? (async () => ({ data: new Uint8Array() }));
  const saveFile = options.saveFile ?? (() => {});
  const idGenerator = options.idGenerator ?? defaultIdGenerator;

  const bus = createEventBus();
  const records = new Map<string, DownloadRecord>();

  function emit(type: string, record: DownloadRecord) {
    bus.emit<DownloadEvent>(type, { record });
  }

  async function start(request: DownloadRequest): Promise<DownloadRecord> {
    const id = request.id ?? idGenerator();
    const record: DownloadRecord = {
      ...request,
      id,
      status: 'downloading',
      receivedBytes: 0,
      totalBytes: undefined,
      startedAt: Date.now(),
    };
    records.set(id, record);
    emit('download:started', { ...record });

    try {
      const response = await fetchResource(request);
      const buffer = coerceToUint8Array(response.data);
      const updated: DownloadRecord = {
        ...record,
        status: 'completed',
        receivedBytes: buffer.byteLength,
        totalBytes: response.totalBytes ?? buffer.byteLength,
        completedAt: Date.now(),
      };
      records.set(id, updated);
      emit('download:completed', { ...updated });
      await Promise.resolve(saveFile(updated, buffer));
      return updated;
    } catch (error) {
      const updated: DownloadRecord = {
        ...record,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: Date.now(),
      };
      records.set(id, updated);
      emit('download:failed', { ...updated });
      throw updated;
    }
  }

  return {
    start,
    get(id) {
      return records.get(id);
    },
    list() {
      return Array.from(records.values()).sort((a, b) => a.startedAt - b.startedAt);
    },
    bus,
  };
}
