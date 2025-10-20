export interface FocusTrap {
  register(element: HTMLElement): void;
  unregister(element: HTMLElement): void;
  activate(): HTMLElement | undefined;
  deactivate(): void;
  focusNext(): HTMLElement | undefined;
  focusPrevious(): HTMLElement | undefined;
  getFocusedElement(): HTMLElement | undefined;
}

function markFocused(target: HTMLElement | undefined) {
  if (!target) {
    return;
  }
  target.setAttribute('data-dialog-focus', 'true');
}

function clearFocused(target: HTMLElement | undefined) {
  if (!target) {
    return;
  }
  target.toggleAttribute('data-dialog-focus', false);
}

export function createFocusTrap(): FocusTrap {
  const elements: HTMLElement[] = [];
  let currentIndex = -1;

  function focusAt(index: number): HTMLElement | undefined {
    if (elements.length === 0) {
      currentIndex = -1;
      return undefined;
    }

    const boundedIndex = ((index % elements.length) + elements.length) % elements.length;
    const nextElement = elements[boundedIndex];
    const previous = elements[currentIndex];
    clearFocused(previous);
    currentIndex = boundedIndex;
    markFocused(nextElement);
    return nextElement;
  }

  return {
    register(element) {
      if (!elements.includes(element)) {
        element.setAttribute('tabindex', element.getAttribute('tabindex') ?? '0');
        elements.push(element);
      }
    },
    unregister(element) {
      const index = elements.indexOf(element);
      if (index !== -1) {
        elements.splice(index, 1);
        if (currentIndex >= elements.length) {
          currentIndex = elements.length - 1;
        }
      }
      clearFocused(element);
    },
    activate() {
      return focusAt(0);
    },
    deactivate() {
      clearFocused(elements[currentIndex]);
      currentIndex = -1;
    },
    focusNext() {
      if (currentIndex === -1) {
        return focusAt(0);
      }
      return focusAt(currentIndex + 1);
    },
    focusPrevious() {
      if (currentIndex === -1) {
        return focusAt(elements.length - 1);
      }
      return focusAt(currentIndex - 1);
    },
    getFocusedElement() {
      if (currentIndex === -1) {
        return undefined;
      }
      return elements[currentIndex];
    },
  };
}
