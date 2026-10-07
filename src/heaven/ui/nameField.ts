// The creator's name plate takes typing through a real page input laid
// exactly over it but invisible: the browser focuses it on a tap and phones
// bring up their own keyboard, while the plate itself draws the letters in
// the pixel font (the scene reads `value`, `focused` and the caret).

/** Names as the room server takes them (see cleanName in profile.ts). */
export const NAME_MAX = 16;

export class NameField {
  readonly input: HTMLInputElement;
  focused = false;

  constructor(initial: string, onChange: () => void) {
    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = NAME_MAX;
    el.value = initial.slice(0, NAME_MAX);
    el.autocomplete = 'off';
    el.spellcheck = false;
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'words');
    el.setAttribute('aria-label', 'Name');
    el.setAttribute('enterkeyhint', 'done');
    // 16px keeps iPhones from zooming the page in on focus; transparent text and caret, the plate draws its own.
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '5',
      margin: '0',
      padding: '0',
      border: '0',
      outline: 'none',
      background: 'transparent',
      color: 'transparent',
      caretColor: 'transparent',
      fontSize: '16px',
      opacity: '0.01',
      cursor: 'text',
      left: '-1000px',
      top: '0',
      width: '1px',
      height: '1px',
    } satisfies Partial<CSSStyleDeclaration>);
    // Typing mustn't reach the game's own keys.
    for (const t of ['keydown', 'keyup', 'keypress']) el.addEventListener(t, (e) => e.stopPropagation());
    el.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === 'Escape') el.blur();
    });
    el.addEventListener('input', () => {
      // Only what a name may hold, as it's typed (the final tidy is cleanName's, on Done).
      const v = el.value.replace(/[^\w .'-]/g, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '').slice(0, NAME_MAX);
      if (v !== el.value) el.value = v;
      onChange();
    });
    el.addEventListener('focus', () => {
      this.focused = true;
      onChange();
    });
    el.addEventListener('blur', () => {
      this.focused = false;
      onChange();
    });
    document.body.append(el);
    this.input = el;
  }

  get value(): string {
    return this.input.value;
  }

  /** Lay the input over the plate: a rectangle in page (CSS) pixels. */
  place(left: number, top: number, width: number, height: number): void {
    Object.assign(this.input.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  }

  blur(): void {
    this.input.blur();
  }

  destroy(): void {
    this.input.remove();
  }
}
