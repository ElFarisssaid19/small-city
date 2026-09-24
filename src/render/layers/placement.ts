import { Color, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { InstancedMesh } from 'three';
import { forEachNeighbour } from '../../sim/grid';
import { conductsPower } from '../../sim/power';
import type { SimState, Tile } from '../../sim/types';
import { commitInstances, createInstanced, transform } from '../instancing';
import { PALETTE } from '../palette';

function isLive(tile: Readonly<Tile>): boolean {
  return tile.powered && conductsPower(tile);
}

/**
 * Placement guide for zoning: on every tile a zone could go, shows whether a
 * road is within reach and whether power is there (the tile is powered, or it
 * touches something powered, which a new zone would conduct from).
 */
export class PlacementOverlay {
  readonly mesh: InstancedMesh;
  private readonly color = new Color();

  constructor(capacity: number) {
    this.mesh = createInstanced(
      new PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false }),
      capacity,
    );
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  get visible(): boolean {
    return this.mesh.visible;
  }

  set visible(value: boolean) {
    this.mesh.visible = value;
  }

  update(state: Readonly<SimState>): void {
    if (!this.mesh.visible) return;
    const { tiles, width } = state;
    let count = 0;
    tiles.forEach((tile, i) => {
      if (tile.kind !== 'empty' && tile.kind !== 'zone') return;
      let power = isLive(tile);
      if (!power) forEachNeighbour(state, i, (j) => (power ||= isLive(tiles[j])));
      const road = tile.roadAccess;
      if (!road && !power) return;

      const hex =
        road && power ? PALETTE.overlay.both : road ? PALETTE.overlay.road : PALETTE.overlay.power;
      this.mesh.setMatrixAt(count, transform((i % width) + 0.5, 0.03, Math.floor(i / width) + 0.5));
      this.mesh.setColorAt(count++, this.color.setHex(hex));
    });
    commitInstances(this.mesh, count);
  }
}
