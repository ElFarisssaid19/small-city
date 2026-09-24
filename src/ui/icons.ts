import type { ToolId } from '../game/tools';

/** Minimal 24×24 line icons for the toolbar, drawn with currentColor. */
const PATHS: Record<ToolId, string> = {
  select: 'M6 3l12 9-5.5 1.2L15 20l-2.4 1-2.6-6.6L6 18z',
  road: 'M8 2 4 22M16 2l4 20M12 3v3M12 10v4M12 18v3',
  residential: 'M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6',
  commercial: 'M4 21V7h9v14M13 21V3h7v18M7 10h3M7 14h3M16 7h2M16 11h2M16 15h2',
  industrial: 'M3 21V11l6 3v-3l6 3V5h4v16zM7 17h2M12 17h2',
  powerPlant: 'M13 2 4 14h7l-1 8 9-12h-7z',
  powerLine: 'M12 2 6 22M12 2l6 20M7 7h10M5 12h14M9 17h6',
  bulldoze: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  police: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4',
  fire: 'M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z',
  school: 'M3 9l9-5 9 5-9 5zM7 11.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5M21 9v6',
  park: 'M12 3a5 5 0 0 1 4 8 4 4 0 0 1-3 7h-2a4 4 0 0 1-3-7 5 5 0 0 1 4-8zM12 12v9M9 21h6',
};

/** Icons for the toolbar categories and the overlay button. */
const EXTRA: Record<string, string> = {
  zones: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  infrastructure: 'M8 2 4 22M16 2l4 20M12 3v3M12 10v4M12 18v3',
  services: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  overlay: 'M12 4 2 9l10 5 10-5zM2 14l10 5 10-5',
};

export function extraIcon(name: keyof typeof EXTRA): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${EXTRA[name]}"/></svg>`;
}

export function toolIcon(tool: ToolId): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[tool]}"/></svg>`;
}
