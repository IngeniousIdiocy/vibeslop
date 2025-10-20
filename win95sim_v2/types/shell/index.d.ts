declare namespace Win95SimShell {
  interface ShellWidgetContext {
    bus: {
      emit(type: string, payload?: unknown): void;
      on(type: string, handler: (payload: unknown) => void): () => void;
    };
  }

  interface ShellWidgetInstance {
    mount(container: HTMLElement): void;
    unmount(): void;
  }

  interface ShellWidgetRegistration {
    id: string;
    title: string;
    mount(context: ShellWidgetContext): ShellWidgetInstance;
  }

  interface TrayProvider {
    id: string;
    mount(container: HTMLElement): void;
    unmount(): void;
  }

  interface StartMenuContribution {
    id: string;
    section: string;
    items: Array<{
      id: string;
      label: string;
      command: string;
    }>;
  }

  interface ShellAPI {
    registerShellWidget(widget: ShellWidgetRegistration): void;
    registerTrayProvider(provider: TrayProvider): void;
    registerStartMenuContribution(extension: StartMenuContribution): void;
  }
}

export {};
