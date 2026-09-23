import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { InstancedMesh } from 'three';
import type { Plan } from '../../sim/commands';
import type { Point } from '../../sim/types';
import { commitInstances, createInstanced, transform } from '../instancing';
import { PALETTE } from '../palette';

function outline(color: number, thickness: number): Group {
  const material = new MeshBasicMaterial({ color });
  const group = new Group();
  const horizontal = new BoxGeometry(1 + thickness, 0.05, thickness);
  const vertical = new BoxGeometry(thickness, 0.05, 1 + thickness);
  for (const [geometry, x, z] of [
    [horizontal, 0, -0.5],
    [horizontal, 0, 0.5],
    [vertical, -0.5, 0],
    [vertical, 0.5, 0],
  ] as const) {
    const bar = new Mesh(geometry, material);
    bar.position.set(x, 0.03, z);
    group.add(bar);
  }
  group.visible = false;
  return group;
}

/** Ghost preview of a pending command, hover highlight and selection outline. */
export class OverlayLayer {
  readonly group = new Group();
  private readonly ghost: InstancedMesh;
  private readonly hover: Mesh;
  private readonly selection = outline(PALETTE.selection, 0.07);
  private readonly color = new Color();

  constructor(capacity: number) {
    this.ghost = createInstanced(
      new BoxGeometry(0.96, 0.1, 0.96).translate(0, 0.05, 0),
      new MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
      capacity,
    );
    this.ghost.renderOrder = 5;

    this.hover = new Mesh(
      new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({
        color: PALETTE.hover,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    this.hover.visible = false;

    this.group.add(this.ghost, this.hover, this.selection);
  }

  /** Green tiles will be built, red ones block the command (all red when it cannot run). */
  setPlan(plan: Plan | null): void {
    if (!plan) {
      commitInstances(this.ghost, 0);
      return;
    }
    plan.tiles.forEach((t, n) => {
      this.ghost.setMatrixAt(n, transform(t.x + 0.5, 0.02, t.y + 0.5));
      const good = plan.valid && t.ok;
      this.ghost.setColorAt(n, this.color.setHex(good ? PALETTE.ghostOk : PALETTE.ghostBad));
    });
    commitInstances(this.ghost, plan.tiles.length);
  }

  setHover(p: Point | null): void {
    this.hover.visible = p !== null;
    if (p) this.hover.position.set(p.x + 0.5, 0.05, p.y + 0.5);
  }

  setSelection(p: Point | null): void {
    this.selection.visible = p !== null;
    if (p) this.selection.position.set(p.x + 0.5, 0, p.y + 0.5);
  }
}
