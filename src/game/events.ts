import type { Command, Plan } from '../sim/commands';
import type { Point, SimState } from '../sim/types';
import type { ToolId } from './tools';

export interface PreviewInfo {
  plan: Plan;
  /** Pointer position in client pixels, for placing the cost label. */
  clientX: number;
  clientY: number;
}

export type NoticeTone = 'info' | 'warn' | 'error';

/**
 * Every message that crosses a layer boundary. Requests flow from input/UI to
 * the game (`command`, `speed:set` …); notifications flow back (`sim:updated` …).
 */
export interface GameEvents {
  /** Ask the simulation to change the map. */
  command: Command;
  /** A command was refused, with the reason. */
  'command:rejected': { reason: string };
  /** The simulation advanced or changed. */
  'sim:updated': Readonly<SimState>;

  'tool:changed': ToolId;
  'speed:set': number;
  'speed:toggle': void;
  'speed:changed': number;

  'preview:changed': PreviewInfo | null;
  'tile:hovered': Point | null;
  'tile:selected': Point | null;

  notice: { message: string; tone: NoticeTone };
}
