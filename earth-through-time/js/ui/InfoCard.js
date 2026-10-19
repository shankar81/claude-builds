// Generic info card (events, fossils, creatures). One card at a time, bottom-left above the
// timeline on desktop, a bottom sheet on phones. Content is built from a simple spec so every
// card looks consistent.

import { icon } from './icons.js';

export class InfoCard {
  constructor(container) {
    this.root = document.createElement('article');
    this.root.className = 'info-card panel';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'false');
    this.root.setAttribute('aria-labelledby', 'info-card-title');
    container.appendChild(this.root);
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.root.hidden) this.close();
    });
    this.onClose = null;
  }

  /**
   * spec: { kicker: [{text, color?, className?}], title, subtitle, figure?: HTMLElement|string,
   *         sections: [{heading?, html? | text? | list?}], sources: [], actions: [{label, icon?, onClick, primary?}] }
   */
  show(spec) {
    const r = this.root;
    r.innerHTML = '';
    const head = document.createElement('header');
    head.className = 'ic-head';
    const kick = document.createElement('div');
    kick.className = 'ic-kicker';
    for (const k of spec.kicker ?? []) {
      const s = document.createElement('span');
      s.className = k.className ?? 'chip';
      if (k.color) s.style.setProperty('--chip', k.color);
      s.textContent = k.text;
      kick.appendChild(s);
    }
    const close = document.createElement('button');
    close.className = 'btn icon ic-close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = icon('close');
    close.addEventListener('click', () => this.close());
    head.append(kick, close);
    const h = document.createElement('h2');
    h.id = 'info-card-title';
    h.className = 'ic-title';
    h.textContent = spec.title;
    r.append(head, h);
    if (spec.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'ic-sub';
      sub.textContent = spec.subtitle;
      r.appendChild(sub);
    }
    const body = document.createElement('div');
    body.className = 'ic-body';
    if (spec.figure) {
      const fig = document.createElement('figure');
      fig.className = 'ic-figure';
      if (typeof spec.figure === 'string') fig.innerHTML = spec.figure;
      else fig.appendChild(spec.figure);
      body.appendChild(fig);
    }
    for (const sec of spec.sections ?? []) {
      const div = document.createElement('section');
      if (sec.heading) {
        const hh = document.createElement('h3');
        hh.textContent = sec.heading;
        div.appendChild(hh);
      }
      if (sec.text) {
        const p = document.createElement('p');
        p.textContent = sec.text;
        div.appendChild(p);
      }
      if (sec.facts) {
        const dl = document.createElement('dl');
        dl.className = 'ic-facts';
        for (const [k, v] of sec.facts) {
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = v;
          dl.append(dt, dd);
        }
        div.appendChild(dl);
      }
      if (sec.html) div.insertAdjacentHTML('beforeend', sec.html);
      body.appendChild(div);
    }
    if (spec.sources?.length) {
      const det = document.createElement('details');
      det.className = 'ic-sources';
      det.innerHTML = '<summary>Sources</summary>';
      const ul = document.createElement('ul');
      for (const s of spec.sources) {
        const li = document.createElement('li');
        if (typeof s === 'object' && s.url) {
          const a = document.createElement('a');
          a.href = s.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = s.text;
          li.appendChild(a);
        } else li.textContent = s;
        ul.appendChild(li);
      }
      det.appendChild(ul);
      body.appendChild(det);
    }
    r.appendChild(body);
    if (spec.actions?.length) {
      const bar = document.createElement('footer');
      bar.className = 'ic-actions';
      for (const a of spec.actions) {
        const b = document.createElement('button');
        b.className = `btn${a.primary ? ' primary' : ''}`;
        b.innerHTML = `${a.icon ? icon(a.icon) : ''}<span></span>`;
        b.querySelector('span').textContent = a.label;
        b.addEventListener('click', a.onClick);
        bar.appendChild(b);
      }
      r.appendChild(bar);
    }
    r.hidden = false;
    r.scrollTop = 0;
    this.current = spec;
  }

  close() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.current = null;
    this.onClose?.();
  }

  get open() {
    return !this.root.hidden;
  }
}
