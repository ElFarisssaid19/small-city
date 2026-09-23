import { BufferAttribute, Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, Material } from 'three';

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

/** Marks instance buffers dirty after a rebuild with `count` instances. */
export function commitInstances(mesh: InstancedMesh, count: number): void {
  mesh.count = count;
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
