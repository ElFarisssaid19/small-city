import type { Command } from '../sim/commands';
import type { Point, ZoneType } from '../sim/types';

export type ToolId =
  | 'select'
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'powerPlant'
  | 'powerLine'
  | 'bulldoze';

export interface ToolDef {
  id: ToolId;
  label: string;
  /** Keyboard shortcut. */
  key: string;
  /** How a drag is interpreted: a single tile, an L-shaped line, or a rectangle. */
  shape: 'point' | 'line' | 'rect';
}

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', label: 'Select', key: '1', shape: 'point' },
  { id: 'road', label: 'Road', key: '2', shape: 'line' },
  { id: 'residential', label: 'Residential', key: '3', shape: 'rect' },
  { id: 'commercial', label: 'Commercial', key: '4', shape: 'rect' },
  { id: 'industrial', label: 'Industrial', key: '5', shape: 'rect' },
  { id: 'powerPlant', label: 'Power plant', key: '6', shape: 'point' },
  { id: 'powerLine', label: 'Power line', key: '7', shape: 'line' },
  { id: 'bulldoze', label: 'Bulldoze', key: '8', shape: 'rect' },
];

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
    case 'bulldoze':
      return { type: 'bulldoze', from, to };
  }
}
