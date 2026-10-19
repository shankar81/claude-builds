// Inline SVG icons (original, drawn for this project). Stroke-based, 24×24 viewBox.

const svg = (body, { fill = 'none' } = {}) =>
  `<svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  play: svg('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'),
  stepBack: svg('<path d="M18 6l-8 6 8 6z" fill="currentColor"/><path d="M7 6v12"/>'),
  stepFwd: svg('<path d="M6 6l8 6-8 6z" fill="currentColor"/><path d="M17 6v12"/>'),
  zoomIn: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/>'),
  zoomOut: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M8 11h6"/>'),
  fit: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  life: svg('<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>'),
  pin: svg('<path d="M12 21s-6-6.2-6-11a6 6 0 1112 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  dive: svg('<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19c2.5 1.5 5.5 1.5 8 0s5.5-1.5 8 0"/>'),
  compare: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>'),
  tour: svg('<path d="M4 18l5-12 4 8 3-5 4 9z"/>'),
  layers: svg('<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  soundOn: svg('<path d="M4 10v4h4l5 4V6L8 10z" fill="currentColor"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>'),
  soundOff: svg('<path d="M4 10v4h4l5 4V6L8 10z" fill="currentColor"/><path d="M17 9l4 6M21 9l-4 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  fossil: svg('<path d="M12 4a8 8 0 108 8"/><path d="M12 8a4 4 0 104 4"/><path d="M12 12h8"/>'),
  event: svg('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>'),
  walk: svg('<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 3v3M9 12l3-4 3 2 3 1M12 8l-1 5"/>'),
  fly: svg('<path d="M2 13l8-2 4-7 2 1-2 6 6 1 2-2 1 1-2 4-14 2z"/>'),
  swim: svg('<path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/><path d="M6 13l4-5 5 3 3-2"/><circle cx="17" cy="6" r="1.6"/>'),
  credits: svg('<path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  sound: svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/>'),
  mute: svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 10l4 4M21 10l-4 4"/>'),
  chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),
};

export function icon(name) {
  return ICONS[name] ?? '';
}
