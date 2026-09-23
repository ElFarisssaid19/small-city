import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { TOOLS } from '../game/tools';
import type { CityView } from '../render/view';

const PAN_STEP_PX = 60;
const ZOOM_STEP = 1.2;

/**
 * Keyboard shortcuts:
 * Q / E rotate, arrows pan, + / − zoom, 1–8 tools, Space pause, Esc cancel.
 */
export class KeyboardInput {
  constructor(
    private readonly view: CityView,
    private readonly bus: EventBus<GameEvents>,
    private readonly cancelDrag: () => void,
  ) {
    window.addEventListener('keydown', this.onKey);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;

    const rig = this.view.rig;
    const tool = TOOLS.find((t) => t.key === e.key);
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
