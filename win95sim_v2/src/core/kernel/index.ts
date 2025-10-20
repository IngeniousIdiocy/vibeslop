export * from './eventBus';
export * from './moduleRegistry';

export interface KernelContext {
  registry: import('./moduleRegistry').ModuleRegistry;
  bus: import('./eventBus').EventBus;
}
