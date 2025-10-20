export interface ModuleDescriptor<TExports> {
  id: string;
  version?: string;
  factory: () => TExports;
}

export interface ModuleRegistry {
  register<T>(descriptor: ModuleDescriptor<T>): void;
  resolve<T>(id: string): T;
  has(id: string): boolean;
  list(): string[];
}

interface ModuleRecord<T> {
  descriptor: ModuleDescriptor<T>;
  instance?: T;
}

/**
 * Creates an in-memory module registry used by the shell runtime to
 * coordinate services, features, and applications. The registry ensures
 * that a module id can only be registered once so phase teams avoid
 * runtime collisions while integrating in parallel.
 */
export function createModuleRegistry(): ModuleRegistry {
  const modules = new Map<string, ModuleRecord<unknown>>();

  function ensureIdIsAvailable(id: string) {
    if (modules.has(id)) {
      throw new Error(`Module with id "${id}" is already registered`);
    }
  }

  return {
    register<T>(descriptor: ModuleDescriptor<T>) {
      if (!descriptor.id) {
        throw new Error('Module descriptor must include an id');
      }

      ensureIdIsAvailable(descriptor.id);
      modules.set(descriptor.id, {
        descriptor,
      });
    },
    resolve<T>(id: string): T {
      const record = modules.get(id);
      if (!record) {
        throw new Error(`Module with id "${id}" has not been registered`);
      }

      if (record.instance === undefined) {
        record.instance = (record.descriptor.factory as () => unknown)();
      }

      return record.instance as T;
    },
    has(id: string) {
      return modules.has(id);
    },
    list() {
      return Array.from(modules.keys()).sort();
    },
  };
}
