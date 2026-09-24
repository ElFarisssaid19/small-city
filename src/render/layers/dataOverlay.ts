import { Color, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { InstancedMesh } from 'three';
import type { SimState } from '../../sim/types';
import { commitInstances, createInstanced, transform } from '../instancing';
import { overlayColor } from '../overlays';
import type { OverlayId } from '../overlays';

/** Heat-map tint over the ground for the selected data overlay. */
export class DataOverlay {
  readonly mesh: InstancedMesh;
  private mode: OverlayId | null = null;
  private readonly color = new Color();

  constructor(capacity: number) {
    this.mesh = createInstanced(
      new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false }),
      capacity,
    );
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  get overlay(): OverlayId | null {
    return this.mode;
  }

  set overlay(id: OverlayId | null) {
    this.mode = id;
    if (id === null) this.mesh.visible = false;
  }

  update(state: Readonly<SimState>): void {
    if (this.mode === null) return;
    const mode = this.mode;
    let count = 0;
    state.tiles.forEach((tile, i) => {
      const hex = overlayColor(mode, tile);
      if (hex === null) return;
      const x = (i % state.width) + 0.5;
      const z = Math.floor(i / state.width) + 0.5;
      this.mesh.setMatrixAt(count, transform(x, 0.045, z));
      this.mesh.setColorAt(count++, this.color.setHex(hex));
    });
    commitInstances(this.mesh, count);
  }
}
