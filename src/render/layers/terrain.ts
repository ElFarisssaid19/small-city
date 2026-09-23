import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
} from 'three';
import { PALETTE } from '../palette';

/** Ground slab with a faint tile grid; the map spans x ∈ [0, width], z ∈ [0, height]. */
export function createTerrain(width: number, height: number): Group {
  const group = new Group();

  const ground = new Mesh(
    new PlaneGeometry(width, height).rotateX(-Math.PI / 2),
    new MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.position.set(width / 2, 0, height / 2);
  ground.receiveShadow = true;

  const slabMaterial = new MeshLambertMaterial({ color: PALETTE.ground });
  slabMaterial.color.multiplyScalar(0.72);
  const slab = new Mesh(new BoxGeometry(width, 0.8, height), slabMaterial);
  slab.position.set(width / 2, -0.401, height / 2);

  const points: number[] = [];
  for (let x = 0; x <= width; x++) points.push(x, 0, 0, x, 0, height);
  for (let z = 0; z <= height; z++) points.push(0, 0, z, width, 0, z);
  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  const grid = new LineSegments(
    gridGeometry,
    new LineBasicMaterial({
      color: PALETTE.grid,
      transparent: true,
      opacity: PALETTE.gridOpacity,
      depthWrite: false,
    }),
  );
  grid.position.y = 0.004;

  group.add(ground, slab, grid);
  return group;
}
