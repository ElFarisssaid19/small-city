import { el } from './dom';

export interface LoadingScreen {
  element: HTMLElement;
  progress(loaded: number, total: number): void;
  /** Fades the screen out and removes it. */
  finish(): void;
}

/** Full-screen progress bar shown while the 3D models load, before the game starts. */
export function createLoadingScreen(): LoadingScreen {
  const element = el('div', 'loading');
  element.setAttribute('role', 'progressbar');
  element.setAttribute('aria-label', 'Loading 3D models');
  element.setAttribute('aria-valuemin', '0');
  const card = el('div', 'loading-card');
  const bar = el('div', 'loading-bar');
  const fill = el('div', 'loading-fill');
  const label = el('p', 'loading-label', 'Loading 3D models…');
  bar.append(fill);
  card.append(el('h1', 'loading-title', 'Small City'), bar, label);
  element.append(card);

  return {
    element,
    progress(loaded, total) {
      const share = total === 0 ? 1 : loaded / total;
      fill.style.width = `${Math.round(share * 100)}%`;
      label.textContent = `Loading 3D models… ${loaded} / ${total}`;
      element.setAttribute('aria-valuemax', String(total));
      element.setAttribute('aria-valuenow', String(loaded));
    },
    finish() {
      element.classList.add('done');
      window.setTimeout(() => element.remove(), 300);
    },
  };
}
