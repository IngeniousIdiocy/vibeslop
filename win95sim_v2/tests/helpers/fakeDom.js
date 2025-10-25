class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = Object.create(null);
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.attributes = Object.create(null);
    this.eventListeners = new Map();
  }

  appendChild(child) {
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentElement = null;
    }
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  focus() {}

  blur() {}

  closest(selector) {
    // Simple selector support for class selectors (.classname)
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      let current = this;
      while (current) {
        const classes = typeof current.className === 'string' 
          ? current.className.split(/\s+/).filter(Boolean)
          : [];
        if (classes.includes(className)) {
          return current;
        }
        current = current.parentElement;
      }
    }
    return null;
  }

  addEventListener(type, handler) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type).add(handler);
  }

  dispatchEvent(type, eventData = {}) {
    // Create a proper event object with bubbling support
    const event = {
      type,
      target: this,
      currentTarget: this,
      bubbles: eventData.bubbles !== false, // default to true
      cancelable: eventData.cancelable !== false,
      defaultPrevented: false,
      propagationStopped: false,
      immediatePropagationStopped: false,
      ...eventData,
      preventDefault() {
        if (this.cancelable) {
          this.defaultPrevented = true;
        }
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
      stopImmediatePropagation() {
        this.propagationStopped = true;
        this.immediatePropagationStopped = true;
      },
    };

    // Build the propagation path from target to root
    const path = [];
    let current = this;
    while (current) {
      path.push(current);
      current = current.parentElement;
    }

    // Capturing phase (not implemented - most tests don't need it)
    
    // Target phase + Bubbling phase
    for (const element of path) {
      if (event.propagationStopped) {
        break;
      }

      event.currentTarget = element;
      const listeners = element.eventListeners.get(type);
      if (listeners) {
        for (const handler of listeners) {
          if (event.immediatePropagationStopped) {
            break;
          }
          handler(event);
        }
      }

      // Stop bubbling if event doesn't bubble or if it's stopped
      if (!event.bubbles || event.propagationStopped) {
        break;
      }
    }

    return !event.defaultPrevented;
  }

  toggleAttribute(name, force) {
    if (force === undefined) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, name)) {
        delete this.attributes[name];
      } else {
        this.attributes[name] = '';
      }
      return;
    }

    if (force) {
      this.attributes[name] = '';
    } else {
      delete this.attributes[name];
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children.forEach((child) => {
      child.parentElement = null;
    });
    this.children = [];
  }

  get innerHTML() {
    if (this._innerHTML !== undefined) {
      return this._innerHTML;
    }
    return this.children.map((child) => child.textContent || '').join('');
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body');
  }

  createElement(tag) {
    return new FakeElement(tag);
  }
}

function withFakeDom(callback) {
  const previousDocument = global.document;
  const document = new FakeDocument();
  global.document = document;

  const restore = () => {
    if (previousDocument === undefined) {
      delete global.document;
    } else {
      global.document = previousDocument;
    }
  };

  try {
    const result = callback({ document, FakeElement });
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

module.exports = { FakeElement, FakeDocument, withFakeDom };
