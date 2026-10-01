// Bridges, built a cell at a time like a wall (the 'bridge' part, see
// homeParts.ts), in the Everwood over its streams and ponds and in a Home
// over its pond. Each joined patch of bridge cells is one bridge, and it
// shapes itself to the cells laid, as a roof does: it runs the long way of
// its patch (east-west unless it is longer north-south), and along every run
// of cells its first cell ramps up off the bank, the middle runs flat, high
// over the water, and the last cell ramps down again. A run of one or two
// cells is a little humped footbridge.
//
// Height is drawn the game's way: a deck `h` px up is drawn `h` px higher
// than the ground under it. Feet aren't lifted, so where feet may stand is
// where the deck is drawn: an east-west bridge's walk is its cells moved up
// by the deck's height (its south face, the beam over the water, stops
// them), a north-south one's is its own cells (each run starts and ends on
// the ground). Rails along its sides stop feet; its ends are open.
//
// Plain data: no Phaser. art/bridgeArt.ts paints a bridge, world/BridgeView.ts
// stands it in the world.

/** The build grid's cell, px (homeLayout's CELL: that file uses this one, so it isn't imported from there). */
const CELL = 16;

/** How high the flat of a bridge stands over the ground, px. */
export const DECK_H = 7;
/** How long each ramp runs, px. */
export const RAMP = CELL;
/** How far feet keep in from a railed side, px. */
export const RAIL_IN = 3;

/** What lies at a point: nothing built, a deck feet may stand on, or a rail or the bridge's side (which stop them). */
export const Deck = { None: 0, Walk: 1, Stop: 2 } as const;
export type Deck = (typeof Deck)[keyof typeof Deck];

/** One bridge: its cells, which way it runs, and the box round it (in cells, inclusive). */
export interface Span {
  /** Its cells written out, so whatever shows it knows when it changed. */
  key: string;
  cells: { x: number; y: number }[];
  /** Runs north-south (else east-west). */
  ns: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A cell's name. Cells run to 65536 each way (the Everwood's grid). */
const keyOf = (cx: number, cy: number): number => cx * 65536 + cy;

/** The ramps' ease: slow off the bank, slow onto the flat. */
const ease = (t: number): number => t * t * (3 - 2 * t);

export class Bridges {
  readonly spans: Span[] = [];
  private span = new Map<number, Span>();
  /** Each cell's run along its bridge: its first and last cell on that axis. */
  private runs = new Map<number, { a: number; b: number }>();

  constructor(cells: Iterable<{ x: number; y: number }>) {
    const all = new Set<number>();
    for (const c of cells) all.add(keyOf(c.x, c.y));
    // Each joined patch (side by side, not corner to corner) is one bridge.
    for (const start of all) {
      if (this.span.has(start)) continue;
      const s: Span = { key: '', cells: [], ns: false, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      const stack = [start];
      this.span.set(start, s);
      while (stack.length) {
        const k = stack.pop()!;
        const x = Math.floor(k / 65536);
        const y = k % 65536;
        s.cells.push({ x, y });
        s.x0 = Math.min(s.x0, x);
        s.y0 = Math.min(s.y0, y);
        s.x1 = Math.max(s.x1, x);
        s.y1 = Math.max(s.y1, y);
        for (const n of [keyOf(x + 1, y), keyOf(x - 1, y), keyOf(x, y + 1), keyOf(x, y - 1)]) {
          if (all.has(n) && !this.span.has(n)) {
            this.span.set(n, s);
            stack.push(n);
          }
        }
      }
      s.ns = s.y1 - s.y0 > s.x1 - s.x0;
      s.cells.sort((p, q) => p.y - q.y || p.x - q.x);
      s.key = `${s.ns ? 'n' : 'e'}|${s.cells.map((c) => `${c.x},${c.y}`).join(';')}`;
      this.spans.push(s);
    }
    // The runs: along a row for an east-west bridge, a column for a north-south one.
    for (const s of this.spans) {
      for (const c of s.cells) {
        const k = keyOf(c.x, c.y);
        if (this.runs.has(k)) continue;
        const [dx, dy] = s.ns ? [0, 1] : [1, 0];
        let a = 0;
        while (this.inSpan(s, c.x - (a + 1) * dx, c.y - (a + 1) * dy)) a++;
        let b = 0;
        while (this.inSpan(s, c.x + (b + 1) * dx, c.y + (b + 1) * dy)) b++;
        const run = s.ns ? { a: c.y - a, b: c.y + b } : { a: c.x - a, b: c.x + b };
        for (let i = run.a; i <= run.b; i++) this.runs.set(s.ns ? keyOf(c.x, i) : keyOf(i, c.y), run);
      }
    }
  }

  get empty(): boolean {
    return this.spans.length === 0;
  }

  /** The bridge cell (cx, cy) belongs to, if any. */
  spanAt(cx: number, cy: number): Span | undefined {
    return this.span.get(keyOf(cx, cy));
  }

  /** Is cell (cx, cy) part of bridge `s`? */
  inSpan(s: Span, cx: number, cy: number): boolean {
    return this.span.get(keyOf(cx, cy)) === s;
  }

  /**
   * The deck's height over the ground at grid point (x, y), px, on cell
   * (cx, cy) of its bridge: rising off each end of its run, flat between.
   */
  height(s: Span, cx: number, cy: number, x: number, y: number): number {
    const run = this.runs.get(keyOf(cx, cy));
    if (!run) return 0;
    const u = (s.ns ? y : x) - run.a * CELL;
    const len = (run.b - run.a + 1) * CELL;
    const d = Math.min(u + 0.5, len - u - 0.5);
    return DECK_H * ease(Math.max(0, Math.min(1, d / RAMP)));
  }

  /** Where along its run grid point (x, y) on cell (cx, cy) is, px from the run's start, and how long the run is. */
  along(s: Span, cx: number, cy: number, x: number, y: number): { u: number; len: number } {
    const run = this.runs.get(keyOf(cx, cy))!;
    return { u: (s.ns ? y : x) - run.a * CELL, len: (run.b - run.a + 1) * CELL };
  }

  /** What is at grid point (x, y): a deck to walk on, or a rail or side that stops feet. */
  at(x: number, y: number): Deck {
    if (!this.spans.length) return Deck.None;
    const cx = Math.floor(x / CELL);
    // North-south: the deck is drawn over its own cells (see the top of the file).
    const here = this.span.get(keyOf(cx, Math.floor(y / CELL)));
    if (here?.ns) {
      const cy = Math.floor(y / CELL);
      const px = x - cx * CELL;
      if ((px < RAIL_IN && !this.inSpan(here, cx - 1, cy)) || (px >= CELL - RAIL_IN && !this.inSpan(here, cx + 1, cy))) return Deck.Stop;
      return Deck.Walk;
    }
    // East-west: the cell whose deck is drawn here, lifted up off the ground below.
    for (let cy = Math.floor(y / CELL); cy <= Math.floor((y + DECK_H + 1) / CELL); cy++) {
      const s = this.span.get(keyOf(cx, cy));
      if (!s || s.ns) continue;
      const h = this.height(s, cx, cy, x, cy * CELL + CELL / 2);
      const g = y + h;
      const top = cy * CELL;
      const bottom = top + CELL;
      if (g >= top && g < bottom) {
        if ((g - top < RAIL_IN && !this.inSpan(s, cx, cy - 1)) || (bottom - g <= RAIL_IN && !this.inSpan(s, cx, cy + 1))) return Deck.Stop;
        return Deck.Walk;
      }
      // Its south side, from the deck's edge down to the water.
      if (g >= bottom && y < bottom && !this.inSpan(s, cx, cy + 1)) return Deck.Stop;
    }
    return Deck.None;
  }
}
