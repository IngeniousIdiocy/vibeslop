import type { ModuleRegistry } from '@core/kernel/moduleRegistry';
import { getControlPanelManifest, type ControlPanelManifestEntry } from './manifest';
import type { ControlPanelApplet, ControlPanelAppletModule, ControlPanelContext } from './types';

export type ControlPanelModuleLoader = (
  request: string,
) => Promise<ControlPanelAppletModule> | ControlPanelAppletModule;

export interface RegisterControlPanelOptions {
  loader?: ControlPanelModuleLoader;
  manifest?: ControlPanelManifestEntry[];
  version?: string;
}

function ensureLoader(module: unknown): ControlPanelAppletModule {
  if (!module || typeof module !== 'object') {
    throw new Error('Control Panel applet module must export createApplet(context, manifest)');
  }

  const candidate = module as ControlPanelAppletModule;
  if (typeof candidate.createApplet !== 'function') {
    throw new Error('Control Panel applet module missing createApplet export');
  }

  return candidate;
}

async function resolveModule(
  loader: ControlPanelModuleLoader,
  moduleId: string,
): Promise<ControlPanelAppletModule> {
  const loaded = await loader(moduleId);
  return ensureLoader(loaded);
}

async function defaultLoader(moduleId: string): Promise<ControlPanelAppletModule> {
  const loaded = await import(/* @vite-ignore */ moduleId);
  return ensureLoader(loaded);
}

export async function registerControlPanelApplets(
  registry: ModuleRegistry,
  context: ControlPanelContext,
  options: RegisterControlPanelOptions = {},
): Promise<ControlPanelApplet[]> {
  const manifest = options.manifest ?? getControlPanelManifest();
  const loader = options.loader ?? defaultLoader;
  const version = options.version ?? '2.0.0';
  const registered: ControlPanelApplet[] = [];

  for (const entry of manifest) {
    const module = await resolveModule(loader, entry.module);
    const appletId = `apps/control-panel/${entry.id}`;
    const instance = module.createApplet(context, entry);
    registered.push(instance);

    registry.register({
      id: appletId,
      version,
      factory: () => instance,
    });
  }

  return registered;
}

export * from './types';
export * from './manifest';
