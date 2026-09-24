import { Color } from 'three';
import type { ServiceType, Tile } from '../sim/types';

export type OverlayId =
  'landValue' | 'pollution' | 'crime' | 'police' | 'fire' | 'school' | 'power';

interface Stop {
  at: number;
  color: number;
}

/** One entry of an overlay's legend: a gradient between stops, or plain swatches. */
export type Legend =
  | { kind: 'ramp'; stops: readonly Stop[]; low: string; high: string }
  | { kind: 'swatches'; items: readonly { color: number; label: string }[] };

export interface OverlayDef {
  id: OverlayId;
  label: string;
  legend: Legend;
}

const LAND_VALUE: readonly Stop[] = [
  { at: 0, color: 0xd64545 },
  { at: 50, color: 0xf2c14e },
  { at: 100, color: 0x3ddc84 },
];
const POLLUTION: readonly Stop[] = [
  { at: 0, color: 0xb7e39b },
  { at: 40, color: 0xe8d25a },
  { at: 100, color: 0x5e3b1f },
];
const CRIME: readonly Stop[] = [
  { at: 0, color: 0xf5e6c4 },
  { at: 50, color: 0xf08a3c },
  { at: 100, color: 0xa3182a },
];
const COVERAGE: Record<Exclude<ServiceType, 'park'>, { area: number; building: number }> = {
  police: { area: 0x5b93e6, building: 0x1d4ca8 },
  fire: { area: 0xf07a5a, building: 0xa3182a },
  school: { area: 0xc49be8, building: 0x6e33a6 },
};
const POWER = { on: 0xffd84d, off: 0xe24b4b };

/** The data overlays, in the order the O key cycles through them. */
export const OVERLAYS: readonly OverlayDef[] = [
  {
    id: 'landValue',
    label: 'Land value',
    legend: { kind: 'ramp', stops: LAND_VALUE, low: 'Low', high: 'High' },
  },
  {
    id: 'pollution',
    label: 'Pollution',
    legend: { kind: 'ramp', stops: POLLUTION, low: 'Clean', high: 'Heavy' },
  },
  { id: 'crime', label: 'Crime', legend: { kind: 'ramp', stops: CRIME, low: 'Low', high: 'High' } },
  ...(['police', 'fire', 'school'] as const).map((service) => ({
    id: service,
    label: { police: 'Police', fire: 'Fire', school: 'School' }[service],
    legend: {
      kind: 'swatches' as const,
      items: [
        { color: COVERAGE[service].area, label: 'Covered' },
        { color: COVERAGE[service].building, label: 'Station' },
      ],
    },
  })),
  {
    id: 'power',
    label: 'Power',
    legend: {
      kind: 'swatches',
      items: [
        { color: POWER.on, label: 'Powered' },
        { color: POWER.off, label: 'No power' },
      ],
    },
  },
];

const scratch = new Color();
const next = new Color();

function ramp(stops: readonly Stop[], value: number): number {
  for (let s = 1; s < stops.length; s++) {
    if (value <= stops[s].at) {
      const from = stops[s - 1];
      const t = (value - from.at) / (stops[s].at - from.at);
      return scratch.setHex(from.color).lerp(next.setHex(stops[s].color), t).getHex();
    }
  }
  return stops[stops.length - 1].color;
}

function needsPower(tile: Readonly<Tile>): boolean {
  if (tile.kind === 'service') return tile.service !== 'park';
  return tile.kind === 'zone';
}

/** Tint for a tile under an overlay, or null to leave it untinted. */
export function overlayColor(id: OverlayId, tile: Readonly<Tile>): number | null {
  switch (id) {
    case 'landValue':
      return tile.kind === 'road' ? null : ramp(LAND_VALUE, tile.landValue);
    case 'pollution':
      return tile.pollution > 0 && tile.kind !== 'road' ? ramp(POLLUTION, tile.pollution) : null;
    case 'crime':
      return tile.crime > 0 && tile.kind !== 'road' ? ramp(CRIME, tile.crime) : null;
    case 'police':
    case 'fire':
    case 'school':
      if (tile.kind === 'service' && tile.service === id) return COVERAGE[id].building;
      return tile.coverage[id] && tile.kind !== 'road' ? COVERAGE[id].area : null;
    case 'power':
      if (tile.powered && (tile.hasLine || tile.kind === 'powerPlant' || needsPower(tile))) {
        return POWER.on;
      }
      return needsPower(tile) ? POWER.off : null;
  }
}
