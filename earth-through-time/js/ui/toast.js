// Small transient notifications at the top of the screen.

export function toast(message, { action, onAction, duration = 5000 } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast panel';
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  if (action) {
    const b = document.createElement('button');
    b.className = 'btn toast-action';
    b.textContent = action;
    b.addEventListener('click', () => {
      onAction?.();
      el.remove();
    });
    el.appendChild(b);
  }
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => el.remove(), duration);
  return el;
}
