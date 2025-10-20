import { createEventBus, EventBus } from '@core/kernel/eventBus';

export type MenuItemType = 'command' | 'separator' | 'submenu';

export interface MenuCommandContext {
  source?: string;
  data?: Record<string, unknown>;
}

export interface MenuCommand {
  id: string;
  label: string;
  accelerator?: string;
  run(context: MenuCommandContext): void;
}

export interface MenuCommandRegistry {
  bus: EventBus;
  register(command: MenuCommand): void;
  unregister(id: string): void;
  execute(id: string, context?: MenuCommandContext): void;
  get(id: string): MenuCommand | undefined;
  list(): MenuCommand[];
}

export interface MenuSchemaItem {
  id: string;
  type?: MenuItemType;
  label?: string;
  accelerator?: string;
  command?: string;
  children?: MenuSchemaItem[];
  items?: MenuSchemaItem[];
}

export interface MenuSchema {
  id: string;
  items: MenuSchemaItem[];
}

export interface RealizedMenuItem {
  id: string;
  type: MenuItemType;
  label?: string;
  accelerator?: string;
  command?: string;
  children?: RealizedMenuItem[];
}

export interface RealizedMenu {
  id: string;
  items: RealizedMenuItem[];
  execute(commandId: string, context?: MenuCommandContext): void;
}

export function createMenuCommandRegistry(): MenuCommandRegistry {
  const commands = new Map<string, MenuCommand>();
  const bus = createEventBus();

  return {
    bus,
    register(command) {
      if (commands.has(command.id)) {
        throw new Error(`Command ${command.id} already registered`);
      }
      commands.set(command.id, command);
      bus.emit('menu:command-registered', { command });
    },
    unregister(id) {
      if (commands.delete(id)) {
        bus.emit('menu:command-unregistered', { id });
      }
    },
    execute(id, context = {}) {
      const command = commands.get(id);
      if (!command) {
        throw new Error(`Unknown command ${id}`);
      }
      command.run({ source: context.source, data: context.data ?? {} });
      bus.emit('menu:command-executed', { id, context });
    },
    get(id) {
      return commands.get(id);
    },
    list() {
      return Array.from(commands.values());
    },
  };
}

function normalizeItem(item: MenuSchemaItem): RealizedMenuItem {
  const children = item.children ?? item.items;
  const type: MenuItemType = item.type ?? (children && children.length ? 'submenu' : 'command');
  return {
    id: item.id,
    type,
    label: item.label,
    accelerator: item.accelerator,
    command: item.command,
    children: children?.map(normalizeItem),
  };
}

export function realizeMenu(schema: MenuSchema, registry: MenuCommandRegistry): RealizedMenu {
  const items = schema.items.map(normalizeItem);

  return {
    id: schema.id,
    items,
    execute(commandId, context = {}) {
      registry.execute(commandId, context);
    },
  };
}
