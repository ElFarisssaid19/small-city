import { Vector2 } from 'three';
import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { commandFor } from '../game/tools';
import type { ToolId } from '../game/tools';
import type { CityView } from '../render/view';
import type { Command, Plan } from '../sim/commands';
import type { Point } from '../sim/types';

const WHEEL_ZOOM_SPEED = 0.0015;

interface Drag {
  pointerId: number;
  from: Point;
  to: Point;
  clientX: number;
  clientY: number;
}

interface Pinch {
  distance: number;
  centre: Vector2;
}

function samePoint(a: Point | null, b: Point | null): boolean {
  return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);
}

/**
 * Mouse and touch handling on the canvas.
 * - Left mouse / one finger: use the current tool (drag for lines and rectangles).
 * - Right or middle mouse / two fingers: pan. Wheel / pinch: zoom.
 * Map edits leave this layer only as `command` events on the bus.
 */
export class PointerInput {
  private tool: ToolId = 'select';
  private readonly pointers = new Map<number, Vector2>();
  private drag: Drag | null = null;
  private panPointer: number | null = null;
  private pinch: Pinch | null = null;
  private hovered: Point | null = null;
  private lastHoverClient = { x: 0, y: 0 };
  private plan: Plan | null = null;

  constructor(
    private readonly view: CityView,
    private readonly bus: EventBus<GameEvents>,
    private readonly preview: (command: Command) => Plan,
  ) {
    const canvas = view.canvas;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    bus.on('tool:changed', (tool) => {
      this.tool = tool;
      this.cancelDrag();
      this.refreshPreview();
    });
    // Money and the map change while the player drags; keep the preview honest.
    bus.on('sim:updated', () => this.refreshPreview());
  }

  /** Abandons the current drag without building anything. */
  cancelDrag(): void {
    if (!this.drag) return;
    this.drag = null;
    this.refreshPreview();
  }

  private readonly onDown = (e: PointerEvent): void => {
    this.view.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, new Vector2(e.clientX, e.clientY));

    if (e.pointerType === 'mouse') {
      if (e.button === 1 || e.button === 2) this.panPointer = e.pointerId;
      else if (e.button === 0) this.startDrag(e);
      return;
    }
    if (this.pointers.size === 1) {
      this.startDrag(e);
    } else if (this.pointers.size === 2) {
      // A second finger turns the gesture into pan / pinch-zoom.
      this.cancelDrag();
      this.pinch = this.measurePinch();
    }
  };

  private readonly onMove = (e: PointerEvent): void => {
    const last = this.pointers.get(e.pointerId);
    const now = new Vector2(e.clientX, e.clientY);
    if (last) this.pointers.set(e.pointerId, now);

    if (this.pinch && this.pointers.size >= 2) {
      const next = this.measurePinch();
      this.view.rig.pan(this.pinch.centre, next.centre);
      this.view.rig.zoomBy(next.distance / Math.max(this.pinch.distance, 1), next.centre);
      this.pinch = next;
      return;
    }
    if (last && this.panPointer === e.pointerId) {
      this.view.rig.pan(last, now);
      return;
    }
    if (this.drag && this.drag.pointerId === e.pointerId) {
      const to = this.view.pickTile(e.clientX, e.clientY, true);
      this.drag.clientX = e.clientX;
      this.drag.clientY = e.clientY;
      if (to && !samePoint(to, this.drag.to)) {
        this.drag.to = to;
        this.refreshPreview();
      } else {
        this.emitPreview();
      }
      return;
    }
    if (e.pointerType === 'mouse') this.setHover(this.view.pickTile(e.clientX, e.clientY), e);
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.panPointer === e.pointerId) this.panPointer = null;
    if (this.pointers.size < 2) this.pinch = null;

    const drag = this.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    this.drag = null;
    const command = commandFor(this.tool, drag.from, drag.to);
    if (command) this.bus.emit('command', command);
    else this.bus.emit('tile:selected', this.view.pickTile(e.clientX, e.clientY));
    this.refreshPreview();
  };

  private readonly onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.panPointer === e.pointerId) this.panPointer = null;
    if (this.pointers.size < 2) this.pinch = null;
    if (this.drag?.pointerId === e.pointerId) this.cancelDrag();
  };

  private readonly onLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && !this.drag) this.setHover(null, e);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED);
    this.view.rig.zoomBy(factor, new Vector2(e.clientX, e.clientY));
  };

  private startDrag(e: PointerEvent): void {
    const tile = this.view.pickTile(e.clientX, e.clientY);
    if (!tile) {
      if (this.tool === 'select') this.bus.emit('tile:selected', null);
      return;
    }
    this.drag = {
      pointerId: e.pointerId,
      from: tile,
      to: tile,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    this.refreshPreview();
  }

  private setHover(tile: Point | null, e: PointerEvent): void {
    const changed = !samePoint(tile, this.hovered);
    this.hovered = tile;
    this.lastHoverClient = { x: e.clientX, y: e.clientY };
    if (changed) {
      this.bus.emit('tile:hovered', tile);
      this.refreshPreview();
    } else {
      this.emitPreview();
    }
  }

  /** Recomputes the ghost for the current drag, or for the hovered tile when idle. */
  private refreshPreview(): void {
    const from = this.drag?.from ?? this.hovered;
    const to = this.drag?.to ?? this.hovered;
    const command = from && to ? commandFor(this.tool, from, to) : null;
    this.plan = command ? this.preview(command) : null;
    this.emitPreview();
  }

  private emitPreview(): void {
    if (!this.plan) {
      this.bus.emit('preview:changed', null);
      return;
    }
    const clientX = this.drag?.clientX ?? this.lastHoverClient.x;
    const clientY = this.drag?.clientY ?? this.lastHoverClient.y;
    this.bus.emit('preview:changed', { plan: this.plan, clientX, clientY });
  }

  private measurePinch(): Pinch {
    const [a, b] = [...this.pointers.values()];
    return {
      distance: a.distanceTo(b),
      centre: new Vector2((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  }
}
