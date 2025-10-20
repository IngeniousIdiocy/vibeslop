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
    const root = (document.body ?? document.documentElement) as HTMLElement | null;
    if (root) {
      session.mount(root);
    }
  }
  if (typeof window !== 'undefined') {
    window.win95sim = session;
  }
  return session;
}

function startSession() {
  boot();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startSession, { once: true });
  } else {
    startSession();
  }
}
