import {
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from 'three';
import type { InstancedMesh } from 'three';
import type { SimState } from '../../sim/types';
import { commitInstances, createInstanced, tileHash, transform } from '../instancing';
import { PALETTE } from '../palette';

const FLAMES_PER_FIRE = 3;
const PUFFS_PER_FIRE = 4;
/** Seconds for a smoke puff to rise to the top and start over. */
const SMOKE_CYCLE = 2.4;
const SMOKE_RISE = 1.3;

interface Fire {
  x: number;
  z: number;
  top: number;
  phase: number;
}

/**
 * Flickering flame cones and rising smoke puffs over burning buildings.
 * Flames are unlit so they glow; smoke puffs grow as they rise and shrink
 * away at the top instead of fading (instances share one opacity).
 */
export class FireLayer {
  readonly group = new Group();
  private readonly flames: InstancedMesh[];
  private readonly smoke: InstancedMesh;
  private fires: Fire[] = [];

  constructor(capacity: number) {
    const flame = new ConeGeometry(0.1, 0.34, 6).translate(0, 0.17, 0);
    this.flames = PALETTE.flame.map((color) => {
      const mesh = createInstanced(flame, new MeshBasicMaterial({ color }), capacity);
      this.group.add(mesh);
      return mesh;
    });
    this.smoke = createInstanced(
      new IcosahedronGeometry(0.12, 0),
      new MeshLambertMaterial({ color: PALETTE.smoke, transparent: true, opacity: 0.7 }),
      capacity * PUFFS_PER_FIRE,
    );
    this.group.add(this.smoke);
  }

  /** `heightAt` gives the height of the structure on a tile, so flames sit on its roof. */
  update(state: Readonly<SimState>, heightAt: (index: number) => number): void {
    this.fires = [];
    state.tiles.forEach((tile, i) => {
      if (tile.fire <= 0) return;
      const x = (i % state.width) + 0.5;
      const z = Math.floor(i / state.width) + 0.5;
      this.fires.push({ x, z, top: heightAt(i), phase: tileHash(i) * 10 });
    });
  }

  frame(now: number): void {
    const t = now / 1000;
    const counts = this.flames.map(() => 0);
    let puffs = 0;
    for (const fire of this.fires) {
      for (let f = 0; f < FLAMES_PER_FIRE; f++) {
        const angle = (f / FLAMES_PER_FIRE) * Math.PI * 2 + fire.phase;
        const flicker = 0.75 + 0.35 * Math.sin(t * 11 + fire.phase + f * 2.1);
        const mesh = f % this.flames.length;
        this.flames[mesh].setMatrixAt(
          counts[mesh]++,
          transform(
            fire.x + Math.cos(angle) * 0.14,
            fire.top,
            fire.z + Math.sin(angle) * 0.14,
            0,
            1,
            flicker * (1.2 - f * 0.15),
            1,
          ),
        );
      }
      for (let p = 0; p < PUFFS_PER_FIRE; p++) {
        const age =
          ((t + fire.phase + (p * SMOKE_CYCLE) / PUFFS_PER_FIRE) % SMOKE_CYCLE) / SMOKE_CYCLE;
        const size = age < 0.8 ? 0.6 + age * 1.4 : (1 - age) * 8.6;
        this.smoke.setMatrixAt(
          puffs++,
          transform(
            fire.x + Math.sin(age * 5 + p) * 0.08,
            fire.top + 0.3 + age * SMOKE_RISE,
            fire.z + age * 0.2,
            0,
            size,
            size,
            size,
          ),
        );
      }
    }
    this.flames.forEach((mesh, m) => commitInstances(mesh, counts[m]));
    commitInstances(this.smoke, puffs);
  }
}
