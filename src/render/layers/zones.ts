import { BoxGeometry, Color, Group, MeshLambertMaterial, PlaneGeometry } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SimState, Tile } from '../../sim/types';
import { commitInstances, createInstanced, paint, tileHash, transform } from '../instancing';
import { BUILDING, PALETTE } from '../palette';

interface BuildingShape {
  height: number;
  footprint: number;
  color: number;
}

const LOT_SIZE = 0.94;
const BORDER_WIDTH = 0.05;
/** How much of the zone colour an empty lot's fill keeps; the border carries the rest. */
const EMPTY_LOT_TINT = 0.35;

/** Size and colour of the box on a developed or abandoned lot, or null if there is none. */
export function buildingShape(tile: Readonly<Tile>, index: number): BuildingShape | null {
  if (tile.kind !== 'zone' || tile.zone === null) return null;
  if ((tile.stage !== 'developed' && tile.stage !== 'abandoned') || tile.level < 1) return null;
  const level = tile.level - 1;
  const variety = 0.85 + tileHash(index) * 0.3;
  return {
    height: BUILDING.height[tile.zone][level] * variety,
    footprint: BUILDING.footprint[tile.zone][level],
    color: tile.stage === 'abandoned' ? PALETTE.abandoned : PALETTE.building[tile.zone][level],
  };
}

/** Height of whatever stands on a zone tile, for placing icons above it. */
export function structureHeight(tile: Readonly<Tile>, index: number): number {
  if (tile.kind === 'zone' && tile.stage === 'construction') return BUILDING.scaffoldHeight;
  return buildingShape(tile, index)?.height ?? 0;
}

/** A thin square frame lying on the ground, one tile wide. */
function borderGeometry(): BufferGeometry {
  const half = LOT_SIZE / 2 - BORDER_WIDTH / 2;
  const along = new BoxGeometry(LOT_SIZE, 0.012, BORDER_WIDTH);
  const across = new BoxGeometry(BORDER_WIDTH, 0.012, LOT_SIZE - 2 * BORDER_WIDTH);
  const parts = [
    along.clone().translate(0, 0, -half),
    along.translate(0, 0, half),
    across.clone().translate(-half, 0, 0),
    across.translate(half, 0, 0),
  ];
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

/** A concrete slab with corner posts and two rings of rails. */
function scaffoldGeometry(): BufferGeometry {
  const h = BUILDING.scaffoldHeight;
  const reach = 0.33;
  const post = 0.045;
  const parts: BufferGeometry[] = [
    paint(new BoxGeometry(0.8, 0.05, 0.8).translate(0, 0.025, 0), PALETTE.slab),
  ];
  for (const x of [-reach, reach]) {
    for (const z of [-reach, reach]) {
      parts.push(
        paint(new BoxGeometry(post, h, post).translate(x, h / 2, z), PALETTE.construction),
      );
    }
  }
  for (const y of [h * 0.55, h]) {
    for (const side of [-reach, reach]) {
      const rail = 2 * reach + post;
      parts.push(
        paint(new BoxGeometry(rail, post, post).translate(0, y, side), PALETTE.construction),
        paint(new BoxGeometry(post, post, rail).translate(side, y, 0), PALETTE.construction),
      );
    }
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

/**
 * Zone tiles by stage: an empty lot is a faintly tinted tile with a border in the
 * zone colour, a construction site is a low scaffold, and a developed building is
 * a box sized by level. Colours are set per instance.
 */
export class ZoneLayer {
  readonly group = new Group();
  private readonly lots: InstancedMesh;
  private readonly borders: InstancedMesh;
  private readonly scaffolds: InstancedMesh;
  private readonly buildings: InstancedMesh;
  private readonly color = new Color();
  private readonly accent = new Color();
  private readonly ground = new Color(PALETTE.ground);

  constructor(capacity: number) {
    this.lots = createInstanced(
      new PlaneGeometry(LOT_SIZE, LOT_SIZE).rotateX(-Math.PI / 2),
      new MeshLambertMaterial(),
      capacity,
    );
    this.lots.receiveShadow = true;

    this.borders = createInstanced(borderGeometry(), new MeshLambertMaterial(), capacity);

    this.scaffolds = createInstanced(
      scaffoldGeometry(),
      new MeshLambertMaterial({ vertexColors: true }),
      capacity,
    );
    this.scaffolds.castShadow = true;
    this.scaffolds.receiveShadow = true;

    this.buildings = createInstanced(
      new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new MeshLambertMaterial(),
      capacity,
    );
    this.buildings.castShadow = true;
    this.buildings.receiveShadow = true;

    this.group.add(this.lots, this.borders, this.scaffolds, this.buildings);
  }

  update(state: Readonly<SimState>): void {
    let lots = 0;
    let borders = 0;
    let scaffolds = 0;
    let buildings = 0;
    state.tiles.forEach((tile, i) => {
      if (tile.kind !== 'zone' || tile.zone === null) return;
      const x = (i % state.width) + 0.5;
      const z = Math.floor(i / state.width) + 0.5;

      this.color.setHex(PALETTE.lot[tile.zone]);
      if (tile.stage === 'empty') {
        this.color.lerp(this.ground, 1 - EMPTY_LOT_TINT);
        this.borders.setMatrixAt(borders, transform(x, 0.018, z));
        this.borders.setColorAt(borders++, this.accent.setHex(PALETTE.building[tile.zone][0]));
      }
      this.lots.setMatrixAt(lots, transform(x, 0.012, z));
      this.lots.setColorAt(lots++, this.color);

      if (tile.stage === 'construction') {
        this.scaffolds.setMatrixAt(scaffolds++, transform(x, 0, z));
        return;
      }
      const shape = buildingShape(tile, i);
      if (!shape) return;
      const { footprint, height } = shape;
      this.buildings.setMatrixAt(buildings, transform(x, 0, z, 0, footprint, height, footprint));
      this.buildings.setColorAt(buildings++, this.color.setHex(shape.color));
    });
    commitInstances(this.lots, lots);
    commitInstances(this.borders, borders);
    commitInstances(this.scaffolds, scaffolds);
    commitInstances(this.buildings, buildings);
  }
}
