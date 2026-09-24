import { BufferAttribute, Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, Group, Material } from 'three';

/** An instanced mesh sized for the worst case, starting empty. */
export function createInstanced(
  geometry: BufferGeometry,
  material: Material,
  capacity: number,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(capacity, 1));
  mesh.count = 0;
  // Instances change every tick and the whole map is usually on screen.
  mesh.frustumCulled = false;
  return mesh;
}

/** Marks instance buffers dirty after a rebuild with `count` instances; empty meshes are skipped. */
export function commitInstances(mesh: InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.visible = count > 0;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** Paints every vertex of a geometry one colour, for merging into vertex-coloured meshes. */
export function paint(geometry: BufferGeometry, hex: number): BufferGeometry {
  const color = new Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

const UP = new Vector3(0, 1, 0);
const position = new Vector3();
const rotation = new Quaternion();
const scale = new Vector3();
const matrix = new Matrix4();

/** Scratch transform: translation, rotation about the vertical axis, and scale. */
export function transform(
  x: number,
  y: number,
  z: number,
  yaw = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): Matrix4 {
  position.set(x, y, z);
  rotation.setFromAxisAngle(UP, yaw);
  scale.set(sx, sy, sz);
  return matrix.compose(position, rotation, scale);
}

/** Stable pseudo-random value in [0, 1) for a tile index, for purely visual variety. */
export function tileHash(index: number): number {
  let h = Math.imul(index ^ 0x5bd1e995, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x165667b1);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

export interface BatchOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * An instanced mesh that is refilled from scratch on every rebuild and grows
 * (by recreating the mesh at twice the size) when it runs out of room, so each
 * model only pays for the instances it actually uses.
 */
export class InstanceBatch {
  private mesh: InstancedMesh;
  private count = 0;

  constructor(
    private readonly group: Group,
    private readonly geometry: BufferGeometry,
    private readonly material: Material,
    private readonly options: BatchOptions = {},
  ) {
    this.mesh = this.create(16);
  }

  begin(): void {
    this.count = 0;
  }

  add(matrix: Matrix4): void {
    if (this.count === this.mesh.instanceMatrix.count) this.grow();
    this.mesh.setMatrixAt(this.count++, matrix);
  }

  end(): void {
    commitInstances(this.mesh, this.count);
  }

  private create(capacity: number): InstancedMesh {
    const mesh = createInstanced(this.geometry, this.material, capacity);
    mesh.castShadow = this.options.castShadow ?? false;
    mesh.receiveShadow = this.options.receiveShadow ?? false;
    this.group.add(mesh);
    return mesh;
  }

  private grow(): void {
    const old = this.mesh;
    this.mesh = this.create(old.instanceMatrix.count * 2);
    this.mesh.instanceMatrix.array.set(old.instanceMatrix.array);
    this.group.remove(old);
    old.dispose();
  }
}

/** Instance batches created on first use, one per key (for example model part and style). */
export class BatchSet {
  private readonly batches = new Map<string, InstanceBatch>();

  constructor(
    private readonly group: Group,
    private readonly options: BatchOptions = {},
  ) {}

  begin(): void {
    for (const batch of this.batches.values()) batch.begin();
  }

  get(key: string, geometry: BufferGeometry, material: Material): InstanceBatch {
    let batch = this.batches.get(key);
    if (!batch) {
      batch = new InstanceBatch(this.group, geometry, material, this.options);
      this.batches.set(key, batch);
    }
    return batch;
  }

  end(): void {
    for (const batch of this.batches.values()) batch.end();
  }
}
