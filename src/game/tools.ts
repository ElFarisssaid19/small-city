import type { Command } from '../sim/commands';
import type { Point, ServiceType, ZoneType } from '../sim/types';

export type ToolId =
  | 'select'
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'powerPlant'
  | 'powerLine'
  | ServiceType
  | 'bulldoze';

/** Toolbar groups, so the bar stays short enough for phones. */
export type ToolCategory = 'select' | 'zones' | 'infrastructure' | 'services' | 'bulldoze';

export interface ToolDef {
  id: ToolId;
  label: string;
  category: ToolCategory;
  /** Keyboard shortcut. */
  key: string;
  /** How a drag is interpreted: a single tile, an L-shaped line, or a rectangle. */
  shape: 'point' | 'line' | 'rect';
}

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', label: 'Select', category: 'select', key: '1', shape: 'point' },
  { id: 'residential', label: 'Residential', category: 'zones', key: '3', shape: 'rect' },
  { id: 'commercial', label: 'Commercial', category: 'zones', key: '4', shape: 'rect' },
  { id: 'industrial', label: 'Industrial', category: 'zones', key: '5', shape: 'rect' },
  { id: 'road', label: 'Road', category: 'infrastructure', key: '2', shape: 'line' },
  { id: 'powerPlant', label: 'Power plant', category: 'infrastructure', key: '6', shape: 'point' },
  { id: 'powerLine', label: 'Power line', category: 'infrastructure', key: '7', shape: 'line' },
  { id: 'police', label: 'Police', category: 'services', key: 'p', shape: 'point' },
  { id: 'fire', label: 'Fire station', category: 'services', key: 'f', shape: 'point' },
  { id: 'school', label: 'School', category: 'services', key: 's', shape: 'point' },
  { id: 'park', label: 'Park', category: 'services', key: 'k', shape: 'point' },
  { id: 'bulldoze', label: 'Bulldoze', category: 'bulldoze', key: '8', shape: 'rect' },
];

export const CATEGORIES: readonly { id: ToolCategory; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'zones', label: 'Zones' },
  { id: 'infrastructure', label: 'Infra' },
  { id: 'services', label: 'Services' },
  { id: 'bulldoze', label: 'Bulldoze' },
];

export function toolDef(id: ToolId): ToolDef {
  return TOOLS.find((t) => t.id === id) ?? TOOLS[0];
}

export function isServiceTool(tool: ToolId): tool is ServiceType {
  return tool === 'police' || tool === 'fire' || tool === 'school' || tool === 'park';
}

export function isZoneTool(tool: ToolId): tool is ZoneType {
  return tool === 'residential' || tool === 'commercial' || tool === 'industrial';
}

/** The command a tool issues for a drag from `from` to `to`; null for the select tool. */
export function commandFor(tool: ToolId, from: Point, to: Point): Command | null {
  switch (tool) {
    case 'select':
      return null;
    case 'road':
      return { type: 'placeRoad', from, to };
    case 'powerLine':
      return { type: 'placePowerLine', from, to };
    case 'residential':
    case 'commercial':
    case 'industrial':
      return { type: 'placeZone', zone: tool, from, to };
    case 'powerPlant':
      return { type: 'placePowerPlant', at: to };
    case 'police':
    case 'fire':
    case 'school':
    case 'park':
      return { type: 'placeService', service: tool, at: to };
    case 'bulldoze':
      return { type: 'bulldoze', from, to };
  }
}
