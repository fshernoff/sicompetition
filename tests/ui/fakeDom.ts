// A small stand-in for the DOM, enough for the report's renderer and the rail's (createElement, text, classes, inline
// styles, hidden, attributes, children),
// so what the page puts on screen, in its order, is tested under node with no browser and no DOM library (G6, row 6:
// a model test alone could pass with nothing changed on screen).

export class FakeElement {
  readonly tagName: string;
  readonly ownerDocument: FakeDocument;
  childNodes: (FakeElement | string)[] = [];
  className = '';
  hidden = false;
  /** The inline style properties a renderer writes (the rail's bar widths and marks). */
  readonly style: Record<string, string> = {};
  readonly attributes = new Map<string, string>();

  constructor(tag: string, doc: FakeDocument) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
  }

  get classList(): {
    add: (...names: string[]) => void;
    remove: (...names: string[]) => void;
    toggle: (name: string, force?: boolean) => boolean;
    contains: (name: string) => boolean;
  } {
    const names = (): string[] => this.className.split(/\s+/).filter((x) => x !== '');
    const add = (...add: string[]): void => {
      this.className = [...new Set([...names(), ...add])].join(' ');
    };
    const remove = (...gone: string[]): void => {
      this.className = names()
        .filter((n) => !gone.includes(n))
        .join(' ');
    };
    return {
      add,
      remove,
      toggle: (name: string, force?: boolean) => {
        const on = force ?? !names().includes(name);
        if (on) add(name);
        else remove(name);
        return on;
      },
      contains: (name: string) => names().includes(name),
    };
  }

  get textContent(): string {
    return this.childNodes.map((c) => (typeof c === 'string' ? c : c.textContent)).join('');
  }

  set textContent(text: string) {
    this.childNodes = text === '' ? [] : [text];
  }

  /** Markup (the icons) is not text: it replaces the children and adds none. */
  set innerHTML(_markup: string) {
    this.childNodes = [];
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  append(...nodes: (FakeElement | string)[]): void {
    this.childNodes.push(...nodes);
  }

  appendChild(node: FakeElement): FakeElement {
    this.childNodes.push(node);
    return node;
  }

  replaceChildren(...nodes: (FakeElement | string)[]): void {
    this.childNodes = [...nodes];
  }

  /** Every element under this one, depth first, in document order. */
  descendants(): FakeElement[] {
    return this.childNodes.flatMap((c) => (typeof c === 'string' ? [] : [c, ...c.descendants()]));
  }

  /** The elements under this one with this tag and, if given, this class. */
  find(tag: string, cls?: string): FakeElement[] {
    return this.descendants().filter((e) => e.tagName === tag.toUpperCase() && (cls === undefined || e.classList.contains(cls)));
  }
}

export class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }
}

/** A fresh element of `tag` in a fresh document, typed as the DOM element the renderer takes. */
export function fakeElement<T>(tag: string): { el: FakeElement; as: T } {
  const el = new FakeDocument().createElement(tag);
  return { el, as: el as unknown as T };
}
