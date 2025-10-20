import { createEventBus } from '@core/kernel/eventBus';
import { DialogAction, DialogController, DialogState } from './types';

export interface DialogControllerOptions<Context> {
  id: string;
  title: string;
  actions: DialogAction[];
}

interface DialogActionEvent<Context> {
  id: string;
  context: Context | undefined;
}

export function createDialogController<Context>(
  options: DialogControllerOptions<Context>,
): DialogController<Context> {
  const { id, title, actions } = options;
  if (!id) {
    throw new Error('Dialog controller requires an id');
  }
  if (actions.length === 0) {
    throw new Error('Dialog controller requires at least one action');
  }

  const bus = createEventBus();
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const defaultAction = actions.find((action) => action.isDefault) ?? actions.find((action) => action.role === 'primary') ?? actions[0];
  const state: DialogState<Context> = {
    id,
    title,
    isOpen: false,
    activeActionId: defaultAction.id,
  };

  function emitAction(actionId: string): DialogState<Context> {
    const action = actionsById.get(actionId);
    if (!action) {
      throw new Error(`Unknown dialog action: ${actionId}`);
    }
    state.activeActionId = actionId;
    bus.emit<DialogActionEvent<Context>>('dialog:action', { id: actionId, context: state.context });
    state.isOpen = false;
    return { ...state };
  }

  const controller: DialogController<Context> = {
    getState() {
      return { ...state };
    },
    open(context) {
      state.context = context;
      state.isOpen = true;
      state.activeActionId = defaultAction.id;
      return { ...state };
    },
    close() {
      state.isOpen = false;
      return { ...state };
    },
    trigger(actionId) {
      if (!state.isOpen) {
        state.isOpen = true;
      }
      return emitAction(actionId);
    },
    triggerDefault() {
      const actionId = state.activeActionId ?? defaultAction.id;
      return emitAction(actionId);
    },
    onAction(handler) {
      return bus.on('dialog:action', (event) => handler(event.id, event.context));
    },
  };

  return controller;
}
