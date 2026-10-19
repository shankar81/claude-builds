// Single right-hand side panel shared by Layers, Life, Settings, etc. Only one is open at a
// time (store.panel). Contents are produced by registered providers.

import { store } from '../core/store.js';
import { icon } from './icons.js';

export class SidePanel {
  constructor(root) {
    this.root = root;
    this.providers = new Map();
    this.root.classList.add('panel');
    this.root.innerHTML = `
      <header class="sp-head">
        <h2 class="sp-title"></h2>
        <button class="btn icon sp-close" aria-label="Close panel" title="Close (Esc)">${icon('close')}</button>
      </header>
      <div class="sp-body"></div>`;
    this.title = this.root.querySelector('.sp-title');
    this.body = this.root.querySelector('.sp-body');
    this.root.querySelector('.sp-close').addEventListener('click', () => this.close());
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && store.state.panel) this.close();
    });
    store.on('panel', (id) => this._render(id));
  }

  /** provider: { title, render(body) → optional cleanup fn, onTime?(ageMa) } */
  register(id, provider) {
    this.providers.set(id, provider);
  }

  toggle(id) {
    store.set({ panel: store.state.panel === id ? null : id });
  }

  open(id) {
    store.set({ panel: id });
  }

  close() {
    store.set({ panel: null });
  }

  refresh() {
    this._render(store.state.panel);
  }

  _render(id) {
    this.cleanup?.();
    this.cleanup = null;
    const p = id && this.providers.get(id);
    this.root.hidden = !p;
    if (!p) return;
    this.title.textContent = typeof p.title === 'function' ? p.title() : p.title;
    this.body.innerHTML = '';
    this.body.scrollTop = 0;
    this.cleanup = p.render(this.body) || null;
  }
}
