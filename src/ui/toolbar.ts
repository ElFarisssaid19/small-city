import type { EventBus } from '../core/events';
import { formatMoney } from '../core/format';
import type { GameEvents } from '../game/events';
import { CATEGORIES, TOOLS, isServiceTool, toolDef } from '../game/tools';
import type { ToolCategory, ToolDef, ToolId } from '../game/tools';
import { OVERLAYS } from '../render/overlays';
import type { OverlayId } from '../render/overlays';
import { CONFIG } from '../sim/config';
import { el } from './dom';
import { extraIcon, toolIcon } from './icons';

/** Price shown under a tool: per tile for things you drag, per building otherwise. */
function toolCost(tool: ToolDef): string | null {
  if (tool.id === 'select') return null;
  if (isServiceTool(tool.id)) return formatMoney(CONFIG.services[tool.id].cost);
  const cost = formatMoney(CONFIG.economy.costs[tool.id]);
  return tool.id === 'powerPlant' ? cost : `${cost}/tile`;
}

function toolButton(tool: ToolDef, onClick: () => void): HTMLButtonElement {
  const btn = el('button', `tool tool-${tool.id}`);
  btn.type = 'button';
  btn.title = `${tool.label} (${tool.key.toUpperCase()})`;
  btn.innerHTML = toolIcon(tool.id);
  btn.append(el('span', 'tool-label', tool.label), el('kbd', 'tool-key', tool.key.toUpperCase()));
  const cost = toolCost(tool);
  if (cost) btn.append(el('span', 'tool-cost', cost));
  btn.addEventListener('click', () => {
    onClick();
    btn.blur();
  });
  return btn;
}

/**
 * Bottom bar grouped by category (Select, Zones, Infrastructure, Services,
 * Bulldoze) plus the overlay picker. Opening a group selects the tool last used
 * in it and shows the group's tools in a drawer above the bar.
 */
export function createToolbar(bus: EventBus<GameEvents>): HTMLElement {
  const wrap = el('div', 'toolbar-wrap');
  const drawer = el('div', 'panel tool-drawer');
  drawer.setAttribute('role', 'toolbar');
  drawer.hidden = true;
  const overlays = el('div', 'panel overlay-drawer');
  overlays.setAttribute('role', 'menu');
  overlays.hidden = true;
  const bar = el('nav', 'panel toolbar');
  bar.setAttribute('aria-label', 'Tools');
  wrap.append(drawer, overlays, bar);

  let active: ToolId = 'select';
  let openCategory: ToolCategory | null = null;
  const lastTool = new Map<ToolCategory, ToolId>();
  const categoryButtons = new Map<ToolCategory, HTMLButtonElement>();

  const showDrawer = (category: ToolCategory | null) => {
    openCategory = category;
    const tools = category ? TOOLS.filter((t) => t.category === category) : [];
    drawer.hidden = tools.length < 2;
    drawer.replaceChildren(
      ...tools.map((tool) => {
        const btn = toolButton(tool, () => bus.emit('tool:changed', tool.id));
        btn.classList.toggle('active', tool.id === active);
        btn.setAttribute('aria-pressed', String(tool.id === active));
        return btn;
      }),
    );
  };

  for (const category of CATEGORIES) {
    const tools = TOOLS.filter((t) => t.category === category.id);
    const single = tools.length === 1 ? tools[0] : null;
    const btn = single
      ? toolButton(single, () => bus.emit('tool:changed', single.id))
      : el('button', `tool category category-${category.id}`);
    if (!single) {
      btn.type = 'button';
      btn.innerHTML = extraIcon(category.id);
      btn.append(el('span', 'tool-label', category.label));
      btn.setAttribute('aria-haspopup', 'true');
      btn.addEventListener('click', () => {
        btn.blur();
        overlays.hidden = true;
        if (openCategory === category.id && !drawer.hidden) {
          showDrawer(null);
          return;
        }
        const tool = lastTool.get(category.id) ?? tools[0].id;
        if (toolDef(active).category === category.id) showDrawer(category.id);
        else bus.emit('tool:changed', tool);
      });
    }
    categoryButtons.set(category.id, btn);
    bar.append(btn);
  }

  // Overlay picker: Off plus every data overlay.
  const overlayButton = el('button', 'tool overlay-button');
  overlayButton.type = 'button';
  overlayButton.title = 'Map overlays (O)';
  overlayButton.innerHTML = extraIcon('overlay');
  const overlayLabel = el('span', 'tool-label', 'Overlay');
  overlayButton.append(overlayLabel, el('kbd', 'tool-key', 'O'));
  overlayButton.setAttribute('aria-haspopup', 'menu');
  overlayButton.addEventListener('click', () => {
    overlayButton.blur();
    drawer.hidden = true;
    overlays.hidden = !overlays.hidden;
  });
  bar.append(overlayButton);

  const overlayOptions = new Map<OverlayId | null, HTMLButtonElement>();
  for (const option of [{ id: null, label: 'Off' }, ...OVERLAYS]) {
    const btn = el('button', 'overlay-option', option.label);
    btn.type = 'button';
    btn.setAttribute('role', 'menuitemradio');
    btn.addEventListener('click', () => {
      bus.emit('overlay:changed', option.id);
      overlays.hidden = true;
    });
    overlayOptions.set(option.id, btn);
    overlays.append(btn);
  }

  bus.on('tool:changed', (tool) => {
    active = tool;
    const category = toolDef(tool).category;
    lastTool.set(category, tool);
    for (const [id, btn] of categoryButtons) {
      btn.classList.toggle('active', id === category);
      btn.setAttribute('aria-pressed', String(id === category));
    }
    overlays.hidden = true;
    showDrawer(category);
  });
  bus.on('overlay:changed', (id) => {
    overlayButton.classList.toggle('active', id !== null);
    overlayLabel.textContent = OVERLAYS.find((o) => o.id === id)?.label ?? 'Overlay';
    for (const [option, btn] of overlayOptions) {
      btn.setAttribute('aria-checked', String(option === id));
      btn.classList.toggle('active', option === id);
    }
  });
  return wrap;
}
