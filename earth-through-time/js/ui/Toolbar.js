// Top-right toolbar. Features register buttons with `toolbar.add({...})`.

import { icon } from './icons.js';

export class Toolbar {
  constructor(root) {
    this.root = root;
    this.buttons = new Map();
  }

  /**
   * @param {{id: string, icon: string, label: string, onClick: Function, toggle?: boolean, order?: number}} opts
   */
  add({ id, icon: iconName, label, onClick, toggle = false, order = 50 }) {
    const btn = document.createElement('button');
    btn.className = 'btn icon tool';
    btn.dataset.id = id;
    btn.dataset.order = String(order);
    btn.title = label;
    btn.setAttribute('aria-label', label);
    if (toggle) btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `${icon(iconName)}<span class="tool-label">${label}</span>`;
    btn.addEventListener('click', () => onClick(btn));
    const after = [...this.root.children].find((c) => Number(c.dataset.order) > order);
    this.root.insertBefore(btn, after ?? null);
    this.buttons.set(id, btn);
    return btn;
  }

  setPressed(id, pressed) {
    this.buttons.get(id)?.setAttribute('aria-pressed', String(!!pressed));
  }

  setIcon(id, iconName) {
    const btn = this.buttons.get(id);
    if (btn) btn.firstElementChild.outerHTML = icon(iconName);
  }
}
