import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { TOOLS } from '../game/tools';
import { OVERLAYS } from '../render/overlays';
import type { OverlayId } from '../render/overlays';
import type { CityView } from '../render/view';

const PAN_STEP_PX = 60;
const ZOOM_STEP = 1.2;

/**
 * Keyboard shortcuts: Q / E rotate, arrows pan, + / − zoom, 1–8 and P F S K
 * tools, O cycle overlays, B budget, Space pause, Esc cancel.
 */
export class KeyboardInput {
  private overlay: OverlayId | null = null;

  constructor(
    private readonly view: CityView,
    private readonly bus: EventBus<GameEvents>,
    private readonly cancelDrag: () => void,
  ) {
    window.addEventListener('keydown', this.onKey);
    bus.on('overlay:changed', (id) => {
      this.overlay = id;
    });
  }

  /** Off → each overlay in turn → off. */
  private nextOverlay(): OverlayId | null {
    const index = OVERLAYS.findIndex((o) => o.id === this.overlay);
    return index + 1 < OVERLAYS.length ? OVERLAYS[index + 1].id : null;
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;

    const rig = this.view.rig;
    const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
    if (tool) {
      this.bus.emit('tool:changed', tool.id);
      return;
    }
    switch (e.key) {
      case 'q':
      case 'Q':
        rig.rotate(-1);
        break;
      case 'e':
      case 'E':
        rig.rotate(1);
        break;
      case 'ArrowLeft':
        rig.nudge(PAN_STEP_PX, 0);
        break;
      case 'ArrowRight':
        rig.nudge(-PAN_STEP_PX, 0);
        break;
      case 'ArrowUp':
        rig.nudge(0, PAN_STEP_PX);
        break;
      case 'ArrowDown':
        rig.nudge(0, -PAN_STEP_PX);
        break;
      case '+':
      case '=':
        rig.zoomCentre(ZOOM_STEP);
        break;
      case '-':
      case '_':
        rig.zoomCentre(1 / ZOOM_STEP);
        break;
      case ' ':
        this.bus.emit('speed:toggle');
        break;
      case 'o':
      case 'O':
        this.bus.emit('overlay:changed', this.nextOverlay());
        break;
      case 'b':
      case 'B':
        this.bus.emit('budget:toggle');
        break;
      case 'Escape':
        this.cancelDrag();
        this.bus.emit('tile:selected', null);
        break;
      default:
        return;
    }
    e.preventDefault();
  };
}
