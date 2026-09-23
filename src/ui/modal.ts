import { el } from './dom';

export interface ModalOptions {
  title: string;
  message: string;
  /** Primary button label. */
  confirmLabel?: string;
  /** Secondary button label; null hides it for a message with a single button. */
  cancelLabel?: string | null;
  /** 'danger' styles the primary button for destructive actions. */
  tone?: 'default' | 'danger';
}

/**
 * In-game replacement for the browser's confirm/alert dialogs.
 * Esc or a click outside cancels, Enter confirms (or presses the focused button),
 * Tab stays inside the dialog, and the rest of the page is inert while it is open.
 */
export class Modal {
  readonly element: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly body: HTMLElement;
  private readonly confirmButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private resolve: ((confirmed: boolean) => void) | null = null;
  private returnFocus: HTMLElement | null = null;
  private inerted: Element[] = [];

  constructor() {
    this.element = el('div', 'modal-backdrop');
    this.element.hidden = true;
    this.dialog = el('div', 'panel modal');
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'modal-title');
    this.dialog.setAttribute('aria-describedby', 'modal-message');
    this.dialog.tabIndex = -1;

    this.heading = el('h2', 'modal-title');
    this.heading.id = 'modal-title';
    this.body = el('p', 'modal-message');
    this.body.id = 'modal-message';

    this.cancelButton = el('button', 'modal-button secondary');
    this.cancelButton.type = 'button';
    this.cancelButton.addEventListener('click', () => this.close(false));
    this.confirmButton = el('button', 'modal-button primary');
    this.confirmButton.type = 'button';
    this.confirmButton.addEventListener('click', () => this.close(true));

    const actions = el('div', 'modal-actions');
    actions.append(this.cancelButton, this.confirmButton);
    this.dialog.append(this.heading, this.body, actions);
    this.element.append(this.dialog);

    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.close(false);
    });
  }

  get isOpen(): boolean {
    return this.resolve !== null;
  }

  /** Shows the dialog and resolves true if the player confirms, false otherwise. */
  ask(options: ModalOptions): Promise<boolean> {
    if (this.isOpen) this.close(false);

    this.heading.textContent = options.title;
    this.body.textContent = options.message;
    this.confirmButton.textContent = options.confirmLabel ?? 'OK';
    this.confirmButton.classList.toggle('danger', options.tone === 'danger');
    const cancelLabel = options.cancelLabel === undefined ? 'Cancel' : options.cancelLabel;
    this.cancelButton.hidden = cancelLabel === null;
    this.cancelButton.textContent = cancelLabel ?? '';

    this.returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.inerted = [...document.body.children].filter(
      (child) => child !== this.element && !child.hasAttribute('inert'),
    );
    for (const child of this.inerted) child.setAttribute('inert', '');
    this.element.hidden = false;
    window.addEventListener('keydown', this.onKey, true);
    // Focus the dialog rather than a button, so a habitual Space (pause) cannot confirm it.
    this.dialog.focus();

    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  private close(confirmed: boolean): void {
    const resolve = this.resolve;
    if (!resolve) return;
    this.resolve = null;
    this.element.hidden = true;
    window.removeEventListener('keydown', this.onKey, true);
    for (const child of this.inerted) child.removeAttribute('inert');
    this.inerted = [];
    this.returnFocus?.focus();
    resolve(confirmed);
  }

  /** Runs before any other key handler so game shortcuts stay quiet while the dialog is open. */
  private readonly onKey = (e: KeyboardEvent): void => {
    e.stopPropagation();
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close(false);
        break;
      case 'Enter':
        e.preventDefault();
        this.close(document.activeElement !== this.cancelButton);
        break;
      case 'Tab': {
        e.preventDefault();
        const buttons = [this.cancelButton, this.confirmButton].filter((b) => !b.hidden);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.shiftKey ? -1 : 1;
        buttons[(index + step + buttons.length) % buttons.length].focus();
        break;
      }
    }
  };
}
