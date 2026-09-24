import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../sim/config';
import { SERVICE_TYPES } from '../../sim/types';
import type { ServiceType, SimState } from '../../sim/types';
import { BatchSet, paint, transform } from '../instancing';
import { PARK_MODELS } from '../models/catalog';
import type { LoadedModel, ModelLibrary } from '../models/library';
import { PALETTE } from '../palette';
import { buildingFacing, coordHash, facingYaw } from '../placementRules';

/** A painted box whose base sits at `y`, centred on (x, z). Units are tiles. */
function block(
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
): BufferGeometry {
  return paint(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), color);
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

interface ServiceModel {
  geometry: BufferGeometry;
  /** Height of the roof, where the badge lies. */
  roof: number;
  /** Tallest point, for icons floating above. */
  height: number;
  badgeSize: number;
}

/** Clean low-poly stand-ins (front is +z, like the kit models) with a coloured roof. */
function buildModels(): Record<Exclude<ServiceType, 'park'>, ServiceModel> {
  const { police, fire, school } = PALETTE.services;
  return {
    police: {
      geometry: merge([
        block(0.78, 0.42, 0.62, police.wall),
        block(0.84, 0.07, 0.68, police.roof, 0, 0.42),
        block(0.32, 0.04, 0.14, police.roof, 0, 0.26, 0.37),
        block(0.16, 0.22, 0.02, PALETTE.door, 0, 0, 0.315),
        block(0.14, 0.1, 0.02, PALETTE.window, -0.24, 0.2, 0.315),
        block(0.14, 0.1, 0.02, PALETTE.window, 0.24, 0.2, 0.315),
        block(0.08, 0.05, 0.05, 0xe23b3b, -0.05, 0.49, -0.2),
        block(0.08, 0.05, 0.05, 0x3b6be2, 0.05, 0.49, -0.2),
      ]),
      roof: 0.49,
      height: 0.54,
      badgeSize: 0.34,
    },
    fire: {
      geometry: merge([
        block(0.8, 0.46, 0.66, fire.wall),
        block(0.86, 0.07, 0.72, fire.roof, 0, 0.46),
        block(0.26, 0.3, 0.02, PALETTE.door, -0.18, 0, 0.335),
        block(0.26, 0.3, 0.02, PALETTE.door, 0.18, 0, 0.335),
        block(0.16, 0.3, 0.16, fire.roof, 0.28, 0.53, -0.2),
      ]),
      roof: 0.53,
      height: 0.83,
      badgeSize: 0.3,
    },
    school: {
      geometry: merge([
        block(1.7, 0.5, 0.8, school.wall, 0, 0, -0.35),
        block(1.76, 0.07, 0.86, school.roof, 0, 0.5, -0.35),
        block(1.4, 0.1, 0.02, PALETTE.window, 0, 0.25, 0.055),
        block(0.22, 0.26, 0.02, PALETTE.door, 0.35, 0, 0.055),
        block(0.7, 0.42, 0.8, school.wall, -0.5, 0, 0.45),
        block(0.76, 0.07, 0.86, school.roof, -0.5, 0.42, 0.45),
        block(0.9, 0.02, 0.8, PALETTE.playground, 0.45, 0, 0.45),
        block(0.03, 0.75, 0.03, 0xdddddd, 0.82, 0, 0.8),
        block(0.2, 0.11, 0.01, 0xd33b3b, 0.92, 0.62, 0.8),
      ]),
      roof: 0.57,
      height: 0.75,
      badgeSize: 0.5,
    },
  };
}

/** A round badge with a white glyph: shield for police, flame for fire, book for schools. */
function drawBadge(service: Exclude<ServiceType, 'park'>): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = PALETTE.services[service].badge;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (service === 'police') {
      ctx.moveTo(32, 12);
      ctx.lineTo(48, 18);
      ctx.quadraticCurveTo(48, 42, 32, 52);
      ctx.quadraticCurveTo(16, 42, 16, 18);
    } else if (service === 'fire') {
      ctx.moveTo(32, 10);
      ctx.bezierCurveTo(46, 24, 48, 34, 44, 44);
      ctx.bezierCurveTo(40, 52, 24, 52, 20, 44);
      ctx.bezierCurveTo(16, 34, 22, 28, 26, 22);
      ctx.bezierCurveTo(26, 30, 30, 32, 32, 32);
      ctx.bezierCurveTo(30, 24, 32, 16, 32, 10);
    } else {
      ctx.moveTo(14, 18);
      ctx.lineTo(31, 22);
      ctx.lineTo(31, 48);
      ctx.lineTo(14, 44);
      ctx.moveTo(50, 18);
      ctx.lineTo(33, 22);
      ctx.lineTo(33, 48);
      ctx.lineTo(50, 44);
    }
    ctx.closePath();
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Procedural fallback tree when the kit trees did not load. */
function fallbackTree(): BufferGeometry {
  return merge([
    paint(new CylinderGeometry(0.03, 0.04, 0.2, 6).translate(0, 0.1, 0), PALETTE.pole),
    paint(new ConeGeometry(0.14, 0.4, 7).translate(0, 0.38, 0), PALETTE.services.park.roof),
  ]);
}

/**
 * Police and fire stations, schools and parks. Buildings are procedural
 * low-poly blocks facing their nearest road with a badge on the roof; parks
 * are a lawn with kit trees and a stepping-stone path.
 */
export class ServiceLayer {
  readonly group = new Group();
  private readonly batches: BatchSet;
  private readonly models = buildModels();
  private readonly buildingMaterial = new MeshLambertMaterial({ vertexColors: true });
  private readonly badges = new Map<ServiceType, Material>();
  private readonly badgeGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly lawn = block(0.94, 0.03, 0.94, PALETTE.services.park.wall);
  private readonly trees: LoadedModel[];
  private readonly path: LoadedModel | null;
  private readonly treeFallback = fallbackTree();
  private readonly heights: Float32Array;

  constructor(capacity: number, library: ModelLibrary) {
    this.heights = new Float32Array(capacity);
    this.batches = new BatchSet(this.group, { castShadow: true, receiveShadow: true });
    this.trees = PARK_MODELS.trees
      .map((id) => library.get(id))
      .filter((m): m is LoadedModel => m !== undefined);
    this.path = library.get(PARK_MODELS.path) ?? null;
    for (const service of SERVICE_TYPES) {
      if (service === 'park') continue;
      this.badges.set(
        service,
        new MeshBasicMaterial({ map: drawBadge(service), transparent: true, depthWrite: false }),
      );
    }
  }

  /** Height of the service building on tile `index` as last drawn. */
  heightAt(index: number): number {
    return this.heights[index] ?? 0;
  }

  update(state: Readonly<SimState>): void {
    const { tiles, width } = state;
    this.heights.fill(0);
    this.batches.begin();
    tiles.forEach((tile, i) => {
      if (tile.kind !== 'service' || tile.service === null || tile.anchor !== i) return;
      const x = i % width;
      const y = (i - x) / width;
      const half = CONFIG.services[tile.service].size / 2;
      const cx = x + half;
      const cz = y + half;
      if (tile.service === 'park') {
        this.addPark(x, y, cx, cz);
        return;
      }
      const model = this.models[tile.service];
      const yaw = facingYaw(buildingFacing(state, x, y));
      this.batches
        .get(`service:${tile.service}`, model.geometry, this.buildingMaterial)
        .add(transform(cx, 0, cz, yaw));
      const badge = this.badges.get(tile.service);
      if (badge) {
        const s = model.badgeSize;
        this.batches
          .get(`badge:${tile.service}`, this.badgeGeometry, badge)
          .add(transform(cx, model.roof + 0.005, cz, yaw, s, 1, s));
      }
      this.heights[i] = model.height;
    });
    this.batches.end();
  }

  private addPark(x: number, y: number, cx: number, cz: number): void {
    this.batches.get('park:lawn', this.lawn, this.buildingMaterial).add(transform(cx, 0, cz));
    const turn = (coordHash(x, y, 31) % 4) * (Math.PI / 2);
    if (this.path) {
      this.addModel(this.path, transform(cx, 0.03, cz, turn, 1.4, 1, 1.4));
    }
    const spots = [
      [-0.28, -0.26, 1.3],
      [0.3, -0.18, 1.0],
      [-0.2, 0.3, 1.1],
      [0.26, 0.3, 1.25],
    ] as const;
    spots.forEach(([dx, dz, scale], n) => {
      // Rotate the layout with the park so neighbouring parks differ.
      const rx = Math.cos(turn) * dx - Math.sin(turn) * dz;
      const rz = Math.sin(turn) * dx + Math.cos(turn) * dz;
      const tree = this.trees[(coordHash(x, y, n) >>> 3) % Math.max(this.trees.length, 1)];
      const matrix = transform(cx + rx, 0.03, cz + rz, turn, scale, scale, scale);
      if (tree) this.addModel(tree, matrix);
      else this.batches.get('park:tree', this.treeFallback, this.buildingMaterial).add(matrix);
    });
  }

  private addModel(model: LoadedModel, matrix: ReturnType<typeof transform>): void {
    model.parts.forEach((part, p) => {
      this.batches.get(`${model.id}#${p}`, part.geometry, part.material).add(matrix);
    });
  }
}
