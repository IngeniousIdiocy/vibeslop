export type DialogActionRole = 'primary' | 'secondary';

export interface DialogAction {
  id: string;
  label: string;
  role?: DialogActionRole;
  isDefault?: boolean;
  accelerator?: string;
}

export interface DialogState<Context = unknown> {
  id: string;
  title: string;
  isOpen: boolean;
  context?: Context;
  activeActionId?: string;
}

export interface DialogController<Context = unknown> {
  getState(): DialogState<Context>;
  open(context?: Context): DialogState<Context>;
  close(reason?: string): DialogState<Context>;
  trigger(actionId: string): DialogState<Context>;
  triggerDefault(): DialogState<Context>;
  onAction(handler: (actionId: string, context: Context | undefined) => void): () => void;
}
