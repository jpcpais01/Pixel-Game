// The Ballerina's effects on the board: her pirouettes' rings of blade light
// and the kick's flung blade arc, the grand jeté's crown of steel springing
// up where she lands, and the Music Box (the box opening under her, its
// notes, the vortex of blades and the burst of steel petals). Wood, brass
// and steel keep their own colours; everything that glows takes the
// palette, so the Firebird's turns to flame.

import { angle, bump, CHEST, clamp01, dist, dot, easeIn, easeOut, FLAT, hash, impact, lerp, shock, star, type Cast, type Kit, type Pal, type Pt, type Px, type Stage } from '../paint';

/** Her tutu's height on the board, where her blades whirl. */
const WAIST = 9;
const BRASS = [0xfff0a8, 0xd8aa48, 0x8a5a14];
const LACQUER = [0xf0a0c8, 0xc86898, 0x8a3868];
const VELVET = 0x5a1238;
const STEEL = [0xf4f8ff, 0xb8c4d8, 0x6a7690];

/** A crescent of blade light round (cx, cy): from `a0` sweeping `span` radians, `r` out, its head thick and bright. */
function whip(px: Px, cx: number, cy: number, r: number, head: number, span: number, p: Pal, a = 1): void {
  const n = Math.max(8, Math.ceil(Math.abs(span) * r * 1.4));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const th = head - span * f;
    const thick = Math.max(0, (1 - f) * 2);
    for (let d = 0; d <= thick; d += 0.5) {
      const c = f < 0.12 ? p.core : f < 0.4 ? p.hot : f < 0.75 ? p.mid : p.deep;
      const x = cx + Math.cos(th) * (r - d);
      const y = cy + Math.sin(th) * (r - d) * 0.5;
      if (a < 1 && hash(Math.round(x), Math.round(y)) > a) continue;
      dot(px, x, y, c, 1);
    }
  }
}

/** A pirouette (two quick rings of blades round her) or, heavy, the kick's blade arc flung at the foe. */
function pirouette(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  if (!heavy) {
    const sense = hash(Math.round(from.x), Math.round(at.y)) < 0.5 ? 1 : -1;
    const a0 = angle(from, at);
    s.add(0.26, (L, k) => {
      const head = a0 + sense * easeOut(k) * Math.PI * 2.1;
      const fade = 1 - clamp01((k - 0.6) / 0.4);
      for (let b = 0; b < 3; b++) whip(L.air, from.x, from.y - WAIST, 12, head + (b * Math.PI * 2 * sense) / 3, sense * 1.1, p, fade);
      L.light(from.x, from.y - WAIST, 22, p.light, 0.5 * (1 - k));
    });
    s.add(0.01, () => {}, 0.1, () => impact(s, at, p, 0.6));
    return;
  }
  // The kick: a crescent bowing forward, flying from her foot to the foe.
  const th = angle(from, at);
  const dur = Math.max(0.08, dist(from, at) / 180);
  s.add(dur, (L, k) => {
    const x = lerp(from.x, at.x, k);
    const y = lerp(from.y, at.y, k) - CHEST + 3;
    const R = 6 + 2 * k;
    for (let i = 0; i <= 16; i++) {
      const f = i / 16;
      const a = th - 1.2 + f * 2.4;
      const thick = Math.sin(f * Math.PI) * 2;
      for (let d = 0; d <= thick; d += 0.5) dot(L.air, x - Math.cos(th) * R * 0.6 + Math.cos(a) * (R - d), y - Math.sin(th) * R * 0.6 + Math.sin(a) * (R - d) * 0.8, d < 0.6 ? p.core : d < 1.3 ? p.hot : p.mid, 1);
    }
    for (let t = 1; t < 6; t++) dot(L.air, x - Math.cos(th) * (R + t * 1.5), y - Math.sin(th) * (R + t * 1.5) * 0.8, p.mid, 1);
    L.light(x, y, 20, p.light, 0.6);
  }, 0, () => {
    impact(s, at, p, 1.1);
    s.sparks(at.x, at.y, 6, [p.core, p.hot, 0xffffff], { speed: 34, up: 22, life: 0.35, z: CHEST });
  });
}

/** Steel springing up from the ground in a ring round `at`: blades (flame tongues) rising, flashing and sinking. */
function crown(s: Stage, at: Pt, R: number, p: Pal, n: number, dur = 0.45): void {
  s.add(dur, (L, k) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      const u = clamp01((k - (i % 3) * 0.06) / 0.8);
      if (u <= 0 || u >= 1) continue;
      const h = 8 * bump(Math.min(1, u * 1.6));
      const bx = at.x + Math.cos(a) * R;
      const by = at.y + Math.sin(a) * R * FLAT;
      const px = Math.sin(a) < 0 ? L.ground : L.air;
      for (let d = 0; d <= h; d++) {
        const f = d / Math.max(1, h);
        dot(px, bx - 0.5 + Math.cos(a) * f, by - d, f > 0.75 ? p.core : p.hot, 1);
        if (f < 0.6) dot(px, bx + 0.5 + Math.cos(a) * f, by - d, p.mid, 1);
      }
    }
    L.light(at.x, at.y - 6, R * 2 + 12, p.light, 0.6 * (1 - k));
  });
}

/** Grand jeté: she soars in a split over to the foes, and lands in a crown of steel. */
const jete = {
  cast(s: Stage, c: Cast): void {
    // The plié: dust kicked up under her.
    s.sparks(c.from.x, c.from.y, 5, [0xd8c8a0, 0xa89878], { speed: 16, up: 8, life: 0.35, ground: true });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const a = c.from;
    const b = c.at;
    const R = Math.max(13, c.r);
    // The line of the leap: a ribbon of light arcing over.
    s.add(0.28, (L, k) => {
      const head = easeOut(Math.min(1, k / 0.7));
      const tl = clamp01((k - 0.3) / 0.7);
      for (let i = 0; i <= 18; i++) {
        const f = lerp(tl, head, i / 18);
        dot(L.air, lerp(a.x, b.x, f), lerp(a.y, b.y, f) - WAIST - Math.sin(f * Math.PI) * 16, i > 14 ? p.core : i > 7 ? p.hot : p.mid, 1);
      }
    });
    s.add(0.01, () => {}, 0.12, () => {
      crown(s, b, R, p, 12);
      shock(s, b, R + 4, p, 0.4, 1);
      s.sparks(b.x, b.y, 10, [p.core, p.hot, 0xffffff, ...STEEL], { speed: 36, up: 30, life: 0.45, z: 4 });
      s.shake(110, 0.003, b);
      for (const h of c.hits) impact(s, h, p, 0.9);
    });
  },
};

/** The music box on the board under (x, y): its front, its velvet top with the comb, the lid standing open `open` (0..1). */
function musicBox(L: { ground: Px; air: Px }, x: number, y: number, open: number, p: Pal, t: number): void {
  const W = 26;
  const D = 8;
  const x0 = Math.round(x - W / 2);
  const back = Math.round(y - D / 2);
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const rim = j === 0 || j === D - 1 || i === 0 || i === W - 1;
    L.ground.put(x0 + i, back + j, rim ? BRASS[j === D - 1 ? 0 : 1] : VELVET, 1);
  }
  for (let j = 0; j < 4; j++) for (let i = 0; i < W; i++) L.ground.put(x0 + i, back + D + j, j === 0 ? BRASS[0] : LACQUER[i < 2 ? 0 : i > W - 3 ? 2 : 1], 1);
  // The comb and the cylinder's turning pins.
  for (let i = 4; i < W - 4; i++) {
    L.ground.put(x0 + i, back + 2, (i * 5 + Math.floor(t * 14)) % 6 === 0 ? STEEL[0] : BRASS[1], 1);
    if (i % 2 === 0) L.ground.put(x0 + i, back + 4, (Math.floor(t * 9) + i) % 7 === 0 ? p.core : STEEL[1], 1);
  }
  // The lid, swung up from the back.
  const h = Math.round(10 * open);
  for (let j = 1; j <= h; j++) for (let i = 0; i < W; i++) {
    const rim = i === 0 || i === W - 1 || j === h;
    const glass = Math.hypot((i - W / 2) / 5, (j - h / 2) / Math.max(1, h * 0.35)) < 1;
    L.ground.put(x0 + i, back - j, rim ? BRASS[1] : glass ? STEEL[0] : LACQUER[2], 1);
  }
}

/** Music Box: the box opens under her and plays; she spins as a vortex of blades, then the blades burst out as petals. */
const musicBoxMove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = { x: c.from.x, y: c.from.y + 2 };
    s.add(c.lead, (L, k, t) => {
      musicBox(L, at.x, at.y, easeOut(k * 1.5), p, t);
      // Notes rising off it.
      for (let i = 0; i < 3; i++) {
        const f = (k * 2 + i / 3) % 1;
        const nx = at.x - 8 + i * 8 + Math.sin(f * 6 + i) * 2;
        const ny = at.y - 6 - f * 18;
        dot(L.air, nx, ny, p.core, 1);
        dot(L.air, nx + 1, ny, p.core, 1);
        dot(L.air, nx + 1, ny - 1, p.hot, 1);
        dot(L.air, nx + 1, ny - 2, p.hot, 1);
      }
      L.light(at.x, at.y - 6, 30, p.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = c.from;
    const R = Math.max(18, c.r);
    const spin = 0.9;
    s.add(spin, (L, k, t) => {
      musicBox(L, at.x, at.y + 2, 1 - easeIn(clamp01((k - 0.7) / 0.3)), p, t);
      const grow = easeOut(Math.min(1, k * 4));
      for (const [h, r, n] of [[2, 0.5, 4], [9, 0.75, 5], [16, 1, 6]] as const) {
        for (let b = 0; b < n; b++) whip(L.air, at.x, at.y - h, R * r * grow, t * 14 * (h === 9 ? -1 : 1) + (b / n) * Math.PI * 2, (h === 9 ? -1 : 1) * 0.8, p, 1);
      }
      L.light(at.x, at.y - WAIST, R * 2 + 10, p.light, 0.7);
    });
    // The burst: petals of steel flung out, and every foe in reach cut.
    s.add(0.01, () => {}, spin, () => {
      shock(s, at, R + 6, p, 0.45, 2);
      s.add(0.2, (L, k) => star(L.air, at.x, at.y - WAIST, Math.round(5 * (1 - k)) + 1, p, 1));
      s.sparks(at.x, at.y, 26, [p.core, p.hot, p.mid, 0xffffff, ...STEEL.slice(0, 2)], { speed: 70, up: 30, g: 120, life: 0.7, z: WAIST });
      s.shake(150, 0.004, at);
      for (const h of c.hits) impact(s, h, p, 1.1);
    });
  },
};

export const BALLERINA_AUTO: Record<string, Kit> = {
  'automaton.ballerina': { melee: pirouette, skill: jete, ult: musicBoxMove },
};
