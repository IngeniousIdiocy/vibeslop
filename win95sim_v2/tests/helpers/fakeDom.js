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

  addEventListener(type, handler) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type).add(handler);
  }

  dispatchEvent(type, event = {}) {
    const listeners = this.eventListeners.get(type);
    if (!listeners) {
      return;
    }
    for (const handler of listeners) {
      handler(event);
    }
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
