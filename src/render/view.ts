import { Color, DirectionalLight, Group, HemisphereLight, Scene, WebGLRenderer } from 'three';
import type { Plan } from '../sim/commands';
import type { Point, SimState } from '../sim/types';
import { CameraRig } from './camera';
import { UnpoweredIcons } from './layers/icons';
import { OverlayLayer } from './layers/overlay';
import { PowerLayer } from './layers/power';
import { RoadLayer } from './layers/roads';
import { createTerrain } from './layers/terrain';
import { ZoneLayer } from './layers/zones';
import { PALETTE } from './palette';

interface Layers {
  root: Group;
  roads: RoadLayer;
  power: PowerLayer;
  zones: ZoneLayer;
  icons: UnpoweredIcons;
  overlay: OverlayLayer;
}

/**
 * The three.js view of a city. It reads the simulation state and redraws the
 * instanced layers whenever `state.revision` changes; it never changes the state.
 */
export class CityView {
  readonly rig: CameraRig;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly sun = new DirectionalLight(0xffffff, 2.4);
  private state: Readonly<SimState>;
  private layers: Layers;
  private drawnRevision = -1;
  private lastFrame: number | null = null;

  constructor(container: HTMLElement, state: Readonly<SimState>) {
    this.state = state;
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new Color(PALETTE.sky);
    this.scene.add(new HemisphereLight(0xeaf4ff, 0x4d5a3c, 1.6));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.rig = new CameraRig(this.renderer.domElement);
    this.layers = this.buildLayers(state);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      this.renderer.setSize(clientWidth, clientHeight);
      this.rig.resize(clientWidth, clientHeight);
    };
    new ResizeObserver(resize).observe(container);
    resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Switches to another city (new game or loaded save). */
  setState(state: Readonly<SimState>): void {
    if (state.width !== this.state.width || state.height !== this.state.height) {
      this.scene.remove(this.layers.root);
      this.layers = this.buildLayers(state);
    }
    this.state = state;
    this.drawnRevision = -1;
    this.setPlan(null);
    this.setSelection(null);
  }

  setPlan(plan: Plan | null): void {
    this.layers.overlay.setPlan(plan);
  }

  setHover(p: Point | null): void {
    this.layers.overlay.setHover(p);
  }

  setSelection(p: Point | null): void {
    this.layers.overlay.setSelection(p);
  }

  /** Tile under a client-space pixel; with `clamp`, points off the map snap to its edge. */
  pickTile(clientX: number, clientY: number, clamp = false): Point | null {
    const hit = this.rig.groundAt(clientX, clientY);
    if (!hit) return null;
    const x = Math.floor(hit.x);
    const y = Math.floor(hit.z);
    const { width, height } = this.state;
    if (clamp) {
      return { x: Math.min(Math.max(x, 0), width - 1), y: Math.min(Math.max(y, 0), height - 1) };
    }
    return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
  }

  render(now: number): void {
    const dt = this.lastFrame === null ? 0 : (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    this.rig.update(dt);

    if (this.state.revision !== this.drawnRevision) {
      const { roads, power, zones, icons } = this.layers;
      roads.update(this.state);
      power.update(this.state);
      zones.update(this.state);
      icons.update(this.state);
      this.drawnRevision = this.state.revision;
    }
    this.layers.icons.frame(now, this.rig.camera);
    this.renderer.render(this.scene, this.rig.camera);
  }

  private buildLayers(state: Readonly<SimState>): Layers {
    const { width, height } = state;
    const capacity = width * height;
    this.rig.setBounds(width, height);
    const layers: Layers = {
      root: new Group(),
      roads: new RoadLayer(capacity),
      power: new PowerLayer(capacity),
      zones: new ZoneLayer(capacity),
      icons: new UnpoweredIcons(capacity),
      overlay: new OverlayLayer(capacity),
    };
    layers.root.add(
      createTerrain(width, height),
      layers.roads.group,
      layers.power.group,
      layers.zones.group,
      layers.icons.mesh,
      layers.overlay.group,
    );
    this.scene.add(layers.root);

    // Sun from the south-west so shadows fall toward the viewer's right; the frustum covers the map.
    const reach = Math.max(width, height) * 0.75;
    this.sun.position.set(width / 2 - 16, 34, height / 2 + 20);
    this.sun.target.position.set(width / 2, 0, height / 2);
    Object.assign(this.sun.shadow.camera, {
      left: -reach,
      right: reach,
      top: reach,
      bottom: -reach,
      near: 1,
      far: 120,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    return layers;
  }
}
