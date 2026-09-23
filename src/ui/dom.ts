/** Creates an element with an optional class and text content. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Creates a button that runs `onClick`, never stealing focus from the game. */
export function button(
  className: string,
  label: string,
  onClick: () => void,
  title?: string,
): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  if (title) {
    node.title = title;
    node.setAttribute('aria-label', title);
  }
  node.addEventListener('click', () => {
    onClick();
    node.blur();
  });
  return node;
}
