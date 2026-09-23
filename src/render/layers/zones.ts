import { BoxGeometry, Color, Group, MeshLambertMaterial, PlaneGeometry } from 'three';
import type { InstancedMesh } from 'three';
import type { SimState, Tile } from '../../sim/types';
import { commitInstances, createInstanced, tileHash, transform } from '../instancing';
import { BUILDING, PALETTE } from '../palette';

interface BuildingShape {
  height: number;
  footprint: number;
  color: number;
}

/** Size and colour of the box standing on a zone tile, or null for an empty lot. */
export function buildingShape(tile: Readonly<Tile>, index: number): BuildingShape | null {
  if (tile.kind !== 'zone' || tile.zone === null) return null;
  if (tile.stage === 'construction') {
    return { height: BUILDING.constructionHeight, footprint: 0.7, color: PALETTE.construction };
  }
  if ((tile.stage !== 'developed' && tile.stage !== 'abandoned') || tile.level < 1) return null;
  const level = tile.level - 1;
  const variety = 0.85 + tileHash(index) * 0.3;
  return {
    height: BUILDING.height[tile.zone][level] * variety,
    footprint: BUILDING.footprint[tile.zone][level],
    color: tile.stage === 'abandoned' ? PALETTE.abandoned : PALETTE.building[tile.zone][level],
  };
}

/** Tinted lots for every zone tile and one box per building, coloured per instance. */
export class ZoneLayer {
  readonly group = new Group();
  private readonly lots: InstancedMesh;
  private readonly buildings: InstancedMesh;
  private readonly color = new Color();

  constructor(capacity: number) {
    this.lots = createInstanced(
      new PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2),
      new MeshLambertMaterial(),
      capacity,
    );
    this.lots.receiveShadow = true;

    this.buildings = createInstanced(
      new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new MeshLambertMaterial(),
      capacity,
    );
    this.buildings.castShadow = true;
    this.buildings.receiveShadow = true;

    this.group.add(this.lots, this.buildings);
  }

  update(state: Readonly<SimState>): void {
    let lots = 0;
    let buildings = 0;
    state.tiles.forEach((tile, i) => {
      if (tile.kind !== 'zone' || tile.zone === null) return;
      const x = (i % state.width) + 0.5;
      const z = Math.floor(i / state.width) + 0.5;

      this.lots.setMatrixAt(lots, transform(x, 0.012, z));
      this.lots.setColorAt(lots++, this.color.setHex(PALETTE.lot[tile.zone]));

      const shape = buildingShape(tile, i);
      if (!shape) return;
      const { footprint, height } = shape;
      this.buildings.setMatrixAt(buildings, transform(x, 0, z, 0, footprint, height, footprint));
      this.buildings.setColorAt(buildings++, this.color.setHex(shape.color));
    });
    commitInstances(this.lots, lots);
    commitInstances(this.buildings, buildings);
  }
}
