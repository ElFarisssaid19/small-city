import { readFlag, writeFlag } from '../game/storage';
import { button, el } from './dom';

const FLAG = 'hint-zones-dismissed';

/** One-time explanation of what zones need, until the player dismisses it. */
export function createFirstHint(): HTMLElement {
  const hint = el('aside', 'panel first-hint');
  hint.setAttribute('aria-label', 'Tip');
  hint.hidden = readFlag(FLAG);
  const text = el('p', 'first-hint-text');
  text.append(
    el('strong', '', 'Zones need a road within 3 tiles and power. '),
    'Build a power plant and connect it with power lines. Start with residential: shops and factories need residents.',
  );
  const dismiss = button('first-hint-dismiss', 'Got it', () => {
    hint.hidden = true;
    writeFlag(FLAG);
  });
  const icon = el('span', 'first-hint-icon', '💡');
  icon.setAttribute('aria-hidden', 'true');
  hint.append(icon, text, dismiss);
  return hint;
}
