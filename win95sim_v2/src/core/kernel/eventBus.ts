export type EventHandler<TPayload = unknown> = (payload: TPayload) => void;

export interface EventBus {
  emit<TPayload>(type: string, payload: TPayload): void;
  on<TPayload>(type: string, handler: EventHandler<TPayload>): () => void;
  once<TPayload>(type: string, handler: EventHandler<TPayload>): () => void;
}

/**
 * Lightweight publish/subscribe implementation. The API is intentionally
 * small so it can be proxied across workers or service boundaries in
 * later phases without rewriting call sites.
 */
export function createEventBus(): EventBus {
  const listeners = new Map<string, Set<EventHandler<unknown>>>();

  function getListeners(type: string) {
    let bucket = listeners.get(type);
    if (!bucket) {
      bucket = new Set();
      listeners.set(type, bucket);
    }

    return bucket;
  }

  function remove(type: string, handler: EventHandler<unknown>) {
    const bucket = listeners.get(type);
    if (!bucket) {
      return;
    }

    bucket.delete(handler);
    if (bucket.size === 0) {
      listeners.delete(type);
    }
  }

  return {
    emit(type, payload) {
      const bucket = listeners.get(type);
      if (!bucket) {
        return;
      }

      bucket.forEach((handler) => {
        handler(payload);
      });
    },
    on(type, handler) {
      const bucket = getListeners(type);
      bucket.add(handler as EventHandler<unknown>);
      return () => remove(type, handler as EventHandler<unknown>);
    },
    once(type, handler) {
      const bucket = getListeners(type);
      const onceHandler: EventHandler<unknown> = (payload) => {
        remove(type, onceHandler);
        handler(payload as never);
      };
      bucket.add(onceHandler);
      return () => remove(type, onceHandler);
    },
  };
}

export default createEventBus;
