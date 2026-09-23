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
};

export function toolIcon(tool: ToolId): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[tool]}"/></svg>`;
}
