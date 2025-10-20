import type { TaskButton } from '@apps/shell/taskbar';

export interface TaskbarViewOptions {
  onStartToggle(): void;
  onTaskSelected(id: string): void;
}

export interface TaskbarView {
  element: HTMLElement;
  setButtons(buttons: TaskButton[]): void;
  setStartMenuOpen(open: boolean): void;
  isStartButton(target: EventTarget | null): boolean;
}

export function createTaskbarView(options: TaskbarViewOptions): TaskbarView {
  const element = document.createElement('div');
  element.className = 'taskbar';

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'taskbar__start';
  startButton.innerHTML = `
    <img class="taskbar__start-icon" src="assets/icons/w98_windows.ico" alt="" aria-hidden="true" />
    <span class="taskbar__start-label">Start</span>
  `;
  startButton.addEventListener('click', () => options.onStartToggle());

  const tasksContainer = document.createElement('div');
  tasksContainer.className = 'taskbar__tasks';

  const tray = document.createElement('div');
  tray.className = 'taskbar__tray';

  const clock = document.createElement('div');
  clock.className = 'taskbar__clock';
  clock.setAttribute('role', 'timer');
  clock.setAttribute('aria-live', 'polite');

  const volumeIcon = document.createElement('img');
  volumeIcon.className = 'taskbar__tray-icon';
  volumeIcon.src = 'assets/icons/w98_loudspeaker_wave.ico';
  volumeIcon.alt = 'Volume';

  const networkIcon = document.createElement('img');
  networkIcon.className = 'taskbar__tray-icon';
  networkIcon.src = 'assets/icons/w98_network_normal_two_pcs.ico';
  networkIcon.alt = 'Network status';

  tray.appendChild(volumeIcon);
  tray.appendChild(networkIcon);
  tray.appendChild(clock);

  element.appendChild(startButton);
  element.appendChild(tasksContainer);
  element.appendChild(tray);

  function setButtons(buttons: TaskButton[]) {
    tasksContainer.innerHTML = '';
    buttons.forEach((button) => {
      const taskButton = document.createElement('button');
      taskButton.type = 'button';
      let className = 'taskbar__button';
      taskButton.dataset.id = button.id;
      taskButton.dataset.state = button.state;
      taskButton.textContent = button.title;
      if (button.state === 'active') {
        className += ' taskbar__button--active';
      } else if (button.state === 'minimized') {
        className += ' taskbar__button--minimized';
      }
      taskButton.className = className;
      taskButton.addEventListener('click', () => options.onTaskSelected(button.id));
      tasksContainer.appendChild(taskButton);
    });
  }

  function setStartMenuOpen(open: boolean) {
    startButton.dataset.active = open ? 'true' : 'false';
    startButton.setAttribute('aria-pressed', open ? 'true' : 'false');
  }

  function isStartButton(target: EventTarget | null): boolean {
    return target instanceof Node ? startButton.contains(target) : false;
  }

  const updateClock = () => {
    const now = new Date();
    let hours = now.getHours() % 12;
    if (hours === 0) {
      hours = 12;
    }
    const minutes = now.getMinutes().toString().padStart(2, '0');
    clock.textContent = `${hours}:${minutes}`;
  };

  updateClock();
  if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
    window.setInterval(updateClock, 60_000);
  }

  return {
    element,
    setButtons,
    setStartMenuOpen,
    isStartButton,
  };
}
