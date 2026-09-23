import {
  CanvasTexture,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  Matrix4,
} from 'three';
import type { Camera, InstancedMesh } from 'three';
import type { SimState } from '../../sim/types';
import { commitInstances, createInstanced } from '../instancing';
import { PALETTE } from '../palette';
import { buildingShape } from './zones';

const FLASH_MS = 450;

function drawBolt(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(20, 20, 28, 0.85)';
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `#${PALETTE.unpowered.toString(16).padStart(6, '0')}`;
    ctx.beginPath();
    ctx.moveTo(36, 8);
    ctx.lineTo(18, 36);
    ctx.lineTo(30, 36);
    ctx.lineTo(26, 56);
    ctx.lineTo(46, 26);
    ctx.lineTo(34, 26);
    ctx.closePath();
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Flashing lightning-bolt badges above zone tiles that have no power. */
export class UnpoweredIcons {
  readonly mesh: InstancedMesh;
  private positions: Vector3[] = [];
  private readonly matrix = new Matrix4();
  private readonly scale = new Vector3(1, 1, 1);

  constructor(capacity: number) {
    this.mesh = createInstanced(
      new PlaneGeometry(0.46, 0.46),
      new MeshBasicMaterial({ map: drawBolt(), transparent: true, depthTest: false }),
      capacity,
    );
    this.mesh.renderOrder = 10;
  }

  update(state: Readonly<SimState>): void {
    this.positions = [];
    state.tiles.forEach((tile, i) => {
      if (tile.kind !== 'zone' || tile.powered) return;
      const top = buildingShape(tile, i)?.height ?? 0;
      const x = i % state.width;
      const z = Math.floor(i / state.width);
      this.positions.push(new Vector3(x + 0.5, top + 0.4, z + 0.5));
    });
  }

  /** Billboards the badges toward the camera and blinks them. */
  frame(now: number, camera: Camera): void {
    const visible = this.positions.length > 0 && Math.floor(now / FLASH_MS) % 2 === 0;
    this.mesh.visible = visible;
    if (!visible) return;
    this.positions.forEach((p, n) => {
      this.mesh.setMatrixAt(n, this.matrix.compose(p, camera.quaternion, this.scale));
    });
    commitInstances(this.mesh, this.positions.length);
  }
}
