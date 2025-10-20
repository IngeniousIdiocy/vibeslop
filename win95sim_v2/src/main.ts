import { createShellSession } from '@shell/boot';
import './styles/global.css';

declare global {
  interface Window {
    win95sim?: ReturnType<typeof createShellSession>;
  }
}

export function boot() {
  const session = createShellSession();
  if (typeof document !== 'undefined') {
    session.mount(document.body);
  }
  window.win95sim = session;
  return session;
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    boot();
  });
}
