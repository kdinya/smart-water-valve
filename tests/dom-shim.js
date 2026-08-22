'use strict';
/*
 * water-valve-card.js is a browser-only custom element script (no module
 * exports, relies on `window`/`document`/`customElements`/`HTMLElement`
 * globals). This shim provides just enough of those APIs to load the file
 * unmodified inside plain Node with `vm`, so the pure logic (config
 * migration, time math, valve-state resolution, the new pipe-split helper,
 * etc.) can be unit-tested without a real browser or a jsdom dependency.
 *
 * It deliberately does NOT implement enough to actually render the card
 * (no real shadow DOM query engine, no canvas 2D context) — tests that need
 * that keep to the class's plain data/logic methods and avoid calling
 * _ensureTemplate()/_render()/_drawWaterFrame().
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadCardModule() {
  const registry = new Map();

  class FakeClassList {
    constructor() { this._set = new Set(); }
    add(c) { this._set.add(c); }
    remove(c) { this._set.delete(c); }
    toggle(c, force) {
      const has = this._set.has(c);
      const next = force === undefined ? !has : !!force;
      if (next) this._set.add(c); else this._set.delete(c);
      return next;
    }
    contains(c) { return this._set.has(c); }
  }

  class FakeShadowRoot {
    constructor() { this._html = ''; }
    set innerHTML(v) { this._html = v; }
    get innerHTML() { return this._html; }
    getElementById() { return null; }
    querySelector() { return null; }
  }

  class HTMLElement {
    constructor() {
      this.style = { setProperty() {}, removeProperty() {} };
      this.classList = new FakeClassList();
      this._isConnected = false;
    }
    attachShadow(opts) {
      this._shadowRoot = new FakeShadowRoot();
      if (!opts || opts.mode === 'open') this.shadowRoot = this._shadowRoot;
      return this._shadowRoot;
    }
    addEventListener() {}
    removeEventListener() {}
    getBoundingClientRect() { return { width: 0, height: 0, left: 0, top: 0 }; }
    get isConnected() { return this._isConnected; }
  }

  class CanvasRenderingContext2D {}

  const localStorageStore = new Map();
  const localStorage = {
    getItem: (k) => (localStorageStore.has(k) ? localStorageStore.get(k) : null),
    setItem: (k, v) => localStorageStore.set(k, String(v)),
    removeItem: (k) => localStorageStore.delete(k),
  };

  const documentStub = {
    createElement: () => new HTMLElement(),
    addEventListener() {},
    removeEventListener() {},
    visibilityState: 'visible',
  };

  const customElementsStub = {
    define: (name, ctor) => registry.set(name, ctor),
    get: (name) => registry.get(name),
  };

  const sandbox = {
    console,
    HTMLElement,
    CanvasRenderingContext2D,
    localStorage,
    document: documentStub,
    customElements: customElementsStub,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
  sandbox.window = sandbox; // self-reference, like a real browser global object

  const context = vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(__dirname, '..', 'water-valve-card.js'), 'utf8');
  vm.runInContext(src, context, { filename: 'water-valve-card.js' });

  return {
    WaterValveCard: registry.get('water-valve-card'),
    WaterValveCardEditor: registry.get('water-valve-card-editor'),
  };
}

module.exports = { loadCardModule };
