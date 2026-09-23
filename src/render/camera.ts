import { MathUtils, OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';

const CAMERA = {
  /** World units visible vertically at zoom 1. */
  viewHeight: 26,
  minZoom: 0.6,
  maxZoom: 4,
  /** True isometric elevation (≈35.26°). */
  pitch: Math.atan(1 / Math.SQRT2),
  distance: 80,
  /** Share of the remaining rotation covered per second-equivalent frame (exponential ease). */
  rotateEase: 12,
} as const;

const GROUND = new Plane(new Vector3(0, 1, 0), 0);

/**
 * Isometric-style orthographic camera orbiting a ground target.
 * Pan and zoom keep the ground point under the pointer fixed; rotation snaps
 * to 90° steps with a short ease. The target is clamped to the map.
 */
export class CameraRig {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private readonly target = new Vector3();
  private zoom = 1.3;
  private step = 0;
  private yaw: number;
  private targetYaw: number;
  private aspect = 1;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();

  private bounds = { width: 1, height: 1 };

  constructor(private readonly element: HTMLElement) {
    this.yaw = this.targetYaw = Math.PI / 4;
    this.apply();
  }

  /** Sets the map size the target is clamped to and recentres on it. */
  setBounds(width: number, height: number): void {
    this.bounds = { width, height };
    this.target.set(width / 2, 0, height / 2);
    this.apply();
  }

  /** Quarter turns applied so far, 0..3. */
  get rotationStep(): number {
    return this.step;
  }

  resize(width: number, height: number): void {
    this.aspect = width / Math.max(height, 1);
    this.apply();
  }

  /** Rotates the view by 90° steps (+1 = clockwise). */
  rotate(direction: 1 | -1): void {
    this.step = (this.step + direction + 4) % 4;
    this.targetYaw += (direction * Math.PI) / 2;
  }

  /** Moves the view so the ground under `from` ends up under `to` (screen pixels). */
  pan(from: Vector2, to: Vector2): void {
    const a = this.groundAt(from.x, from.y);
    const b = this.groundAt(to.x, to.y);
    if (!a || !b) return;
    this.target.add(a.sub(b));
    this.apply();
  }

  /** Pans by a screen offset in pixels, as if dragging the map from the view centre. */
  nudge(dx: number, dy: number): void {
    const centre = this.centre();
    this.pan(centre, new Vector2(centre.x + dx, centre.y + dy));
  }

  /** Zooms about the view centre. */
  zoomCentre(factor: number): void {
    this.zoomBy(factor, this.centre());
  }

  private centre(): Vector2 {
    const rect = this.element.getBoundingClientRect();
    return new Vector2(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  /** Multiplies the zoom by `factor`, keeping the ground under `focus` in place. */
  zoomBy(factor: number, focus: Vector2): void {
    const before = this.groundAt(focus.x, focus.y);
    this.zoom = MathUtils.clamp(this.zoom * factor, CAMERA.minZoom, CAMERA.maxZoom);
    this.apply();
    const after = this.groundAt(focus.x, focus.y);
    if (before && after) {
      this.target.add(before.sub(after));
      this.apply();
    }
  }

  /** Advances the rotation ease. Returns true while the camera is moving. */
  update(dtSeconds: number): boolean {
    const remaining = this.targetYaw - this.yaw;
    if (Math.abs(remaining) < 1e-4) return false;
    const t = 1 - Math.exp(-CAMERA.rotateEase * dtSeconds);
    this.yaw = Math.abs(remaining) < 1e-3 ? this.targetYaw : this.yaw + remaining * t;
    this.apply();
    return true;
  }

  /** Ground-plane point under a client-space pixel, or null if the ray misses. */
  groundAt(clientX: number, clientY: number): Vector3 | null {
    const rect = this.element.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(GROUND, new Vector3());
  }

  private apply(): void {
    this.target.x = MathUtils.clamp(this.target.x, 0, this.bounds.width);
    this.target.z = MathUtils.clamp(this.target.z, 0, this.bounds.height);

    const halfHeight = CAMERA.viewHeight / 2 / this.zoom;
    const cam = this.camera;
    cam.left = -halfHeight * this.aspect;
    cam.right = halfHeight * this.aspect;
    cam.top = halfHeight;
    cam.bottom = -halfHeight;
    cam.updateProjectionMatrix();

    const horizontal = Math.cos(CAMERA.pitch) * CAMERA.distance;
    cam.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      Math.sin(CAMERA.pitch) * CAMERA.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
  }
}
