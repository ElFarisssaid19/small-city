import {
  CanvasTexture,
  Group,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Camera, InstancedMesh } from 'three';
import { missingRequirement } from '../../sim/zones';
import type { Requirement } from '../../sim/zones';
import type { SimState } from '../../sim/types';
import { commitInstances, createInstanced, tileHash } from '../instancing';
import { PALETTE } from '../palette';

const FLASH_MS = 450;
const BOB_HEIGHT = 0.07;
const BOB_MS = 600;
const REQUIREMENTS: readonly Requirement[] = ['road', 'power', 'demand'];

function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** Draws the glyph for one requirement inside a dark disc with a coloured ring. */
function drawIcon(requirement: Requirement): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const ring = css(PALETTE.requirement[requirement]);
    ctx.fillStyle = 'rgba(20, 22, 30, 0.9)';
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = ring;
    ctx.stroke();
    ctx.fillStyle = ring;
    ctx.strokeStyle = ring;
    ctx.lineCap = 'round';

    if (requirement === 'power') {
      ctx.beginPath();
      ctx.moveTo(36, 10);
      ctx.lineTo(19, 36);
      ctx.lineTo(30, 36);
      ctx.lineTo(26, 54);
      ctx.lineTo(45, 27);
      ctx.lineTo(34, 27);
      ctx.closePath();
      ctx.fill();
    } else if (requirement === 'road') {
      // A road narrowing into the distance, with a dashed centre line.
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, 50);
      ctx.lineTo(27, 15);
      ctx.moveTo(44, 50);
      ctx.lineTo(37, 15);
      ctx.stroke();
      ctx.fillStyle = '#f4f1e6';
      for (const [y, h] of [
        [16, 6],
        [27, 7],
        [39, 9],
      ]) {
        ctx.fillRect(30.5, y, 3, h);
      }
    } else {
      // A falling bar chart: nobody wants to build here right now.
      for (const [x, h] of [
        [17, 24],
        [28, 16],
        [39, 8],
      ]) {
        ctx.fillRect(x, 48 - h, 8, h);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillRect(15, 49, 34, 3);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

interface Icon {
  position: Vector3;
  /** Empty lots float gently; buildings at risk of abandonment blink. */
  blinking: boolean;
  phase: number;
}

/**
 * Billboard badges above zone tiles showing the first missing requirement
 * (road, then power, then demand), as decided by the simulation.
 */
export class RequirementIcons {
  readonly group = new Group();
  private readonly meshes = new Map<Requirement, InstancedMesh>();
  private icons = new Map<Requirement, Icon[]>();
  private readonly matrix = new Matrix4();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly lifted = new Vector3();

  constructor(capacity: number) {
    const geometry = new PlaneGeometry(0.46, 0.46);
    for (const requirement of REQUIREMENTS) {
      const mesh = createInstanced(
        geometry,
        new MeshBasicMaterial({ map: drawIcon(requirement), transparent: true, depthTest: false }),
        capacity,
      );
      mesh.renderOrder = 10;
      this.meshes.set(requirement, mesh);
      this.group.add(mesh);
    }
  }

  /** `heightAt` gives the height of the structure on a tile, so badges float just above it. */
  update(state: Readonly<SimState>, heightAt: (index: number) => number): void {
    this.icons = new Map(REQUIREMENTS.map((r) => [r, []]));
    state.tiles.forEach((tile, i) => {
      const requirement = missingRequirement(state, tile);
      if (!requirement) return;
      const x = (i % state.width) + 0.5;
      const z = Math.floor(i / state.width) + 0.5;
      this.icons.get(requirement)?.push({
        position: new Vector3(x, heightAt(i) + 0.42, z),
        blinking: tile.stage !== 'empty',
        phase: tileHash(i) * Math.PI * 2,
      });
    });
  }

  /** Faces the badges toward the camera, bobs the floating ones and blinks the rest. */
  frame(now: number, camera: Camera): void {
    const blinkOn = Math.floor(now / FLASH_MS) % 2 === 0;
    for (const [requirement, mesh] of this.meshes) {
      let count = 0;
      for (const icon of this.icons.get(requirement) ?? []) {
        if (icon.blinking && !blinkOn) continue;
        this.lifted.copy(icon.position);
        if (!icon.blinking) this.lifted.y += Math.sin(now / BOB_MS + icon.phase) * BOB_HEIGHT;
        mesh.setMatrixAt(count++, this.matrix.compose(this.lifted, camera.quaternion, this.scale));
      }
      commitInstances(mesh, count);
    }
  }
}
