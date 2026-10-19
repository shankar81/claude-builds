// Loading overlay and fatal-error screen.

const el = () => document.getElementById('loading');

export const loading = {
  progress(fraction, text) {
    const fill = document.getElementById('loading-fill');
    const label = document.getElementById('loading-text');
    if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
    if (label && text) label.textContent = text;
    el()?.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
  },

  done() {
    const node = el();
    if (!node) return;
    node.classList.add('done');
    setTimeout(() => node.remove(), 700);
  },

  fatal(message) {
    el()?.remove();
    const div = document.createElement('div');
    div.className = 'fatal';
    div.setAttribute('role', 'alert');
    div.innerHTML = `<div><h2>Earth Through Time can't start</h2><p></p></div>`;
    div.querySelector('p').textContent = message;
    document.getElementById('app').appendChild(div);
  },
};

export function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
