// The Twin Blade on the board: his two blades' cuts crossing on the foe, the
// Riposte's crossed guard and the shears that answer it, and Thousand Cuts,
// a blink of light from foe to foe leaving a cross on each, every cross
// bursting together at the end. The long blade draws in the palette, the
// shoto in its deepest colour (as in ultimate/twin.ts), so a skin's recolour
// carries both.

import { arc, CHEST, dither, dot as pDot, easeOut, lerp, line as pLine, mix, star, tail, type Cast, type Kit, type Pal, type Pt, type Px, type Stage } from '../paint';

/** Pixels put through this fade out in a dither checker, so everything stays crisp. */
const fade = (px: Px, a: number): Px => (a >= 1 ? px : { put: (x, y, c) => void (a > 0 && dither(x, y) < a && px.put(x, y, c, 1)) });
const line = (px: Px, x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void => pLine(fade(px, a), x0, y0, x1, y1, c);
const dot = (px: Px, x: number, y: number, c: number, a = 1): void => pDot(fade(px, a), x, y, c, 1, 1);

/** The shoto's colours, from the palette's deepest. */
const shotoOf = (p: Pal): Pal => {
  const d = p.deep;
  const core = mix(d, 0xffffff, 0.88);
  const hot = mix(d, 0xffffff, 0.45);
  const deep = mix(d, 0x000000, 0.45);
  return { core, hot, mid: d, deep, light: d, tints: [core, hot, d, deep] };
};

/** One crisp cut across a point: a white edge with the blade's colour just under it, drawn out, then eaten from the tail. */
function cutAcross(s: Stage, x: number, y: number, r: number, th: number, p: Pal, dur: number, wait = 0): void {
  const ux = Math.cos(th) * r;
  const uy = Math.sin(th) * r * 0.8;
  s.add(
    dur,
    (L, k) => {
      const head = easeOut(Math.min(1, k / 0.35));
      const back = Math.max(0, (k - 0.35) / 0.65);
      const x0 = lerp(x - ux, x + ux, back);
      const y0 = lerp(y - uy, y + uy, back);
      const x1 = lerp(x - ux, x + ux, head);
      const y1 = lerp(y - uy, y + uy, head);
      line(L.air, x0, y0 + 1, x1, y1 + 1, p.mid, tail(k, 0.5));
      line(L.air, x0, y0, x1, y1, k < 0.4 ? 0xffffff : p.hot, tail(k, 0.5));
      if (k < 0.4) L.light(x1, y1, 16, p.light, 0.6);
    },
    wait,
  );
}

/** Each blow: the long blade one way and the shoto across it a beat later; the X-cut (heavy) a bigger cross with a flash at its heart. */
function twinCut(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const sh = shotoOf(p);
  const x = at.x;
  const y = at.y - CHEST;
  const flip = from.x <= at.x ? 1 : -1;
  const th = flip * (0.7 + Math.random() * 0.3);
  const r = heavy ? 11 : 8;
  cutAcross(s, x, y, r, -th, p, heavy ? 0.26 : 0.18);
  cutAcross(s, x, y, heavy ? r : r - 2, th, sh, heavy ? 0.26 : 0.18, heavy ? 0.02 : 0.07);
  if (heavy) {
    s.add(0.2, (L, k) => star(L.air, x, y, Math.round(5 * (1 - k)) + 1, p, 1), 0.06);
    s.sparks(at.x, at.y, 7, [0xffffff, p.hot, sh.hot], { speed: 34, up: 16, z: CHEST, life: 0.3 });
  } else s.sparks(at.x, at.y, 3, [0xffffff, flip > 0 ? p.hot : sh.hot], { speed: 26, up: 12, z: CHEST, life: 0.24 });
}

/** The Riposte: the crossed blades glinting before him, then the shears flung open round him. */
const riposte = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const sh = shotoOf(p);
    const x = c.from.x;
    const y = c.from.y - CHEST;
    s.add(c.lead, (L, k) => {
      const r = 3 + 4 * easeOut(k * 2);
      line(L.air, x - r, y + r * 0.6, x + r, y - r * 0.6, p.hot);
      line(L.air, x + r, y + r * 0.6, x - r, y - r * 0.6, sh.hot);
      dot(L.air, x, y, 0xffffff);
      L.light(x, y, 20, p.light, 0.5);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const sh = shotoOf(p);
    const x = c.from.x;
    const y = c.from.y - CHEST + 2;
    // The clang: a star at the crossing; then both blades sweep out round him, one each way.
    s.add(0.18, (L, k) => {
      star(L.air, x, y - 2, Math.round(6 * (1 - k)) + 1, p, 1);
      L.light(x, y, 44, p.light, 1 - k);
    });
    const R = Math.max(14, c.r);
    s.add(0.3, (L, k) => {
      const sweep = easeOut(Math.min(1, k / 0.5)) * 2.6;
      const a = tail(k, 0.5);
      arc(fade(L.air, a), x, y, R, 1.6, -Math.PI / 2, -Math.PI / 2 + sweep, p, 1);
      arc(fade(L.air, a), x, y, R - 2, 1.4, -Math.PI / 2, -Math.PI / 2 - sweep, sh, 1);
    }, 0.04);
    for (const h of c.hits) {
      cutAcross(s, h.x, h.y - CHEST, 7, -0.8, p, 0.2, 0.08);
      cutAcross(s, h.x, h.y - CHEST, 7, 0.8, sh, 0.2, 0.1);
      s.sparks(h.x, h.y, 5, [0xffffff, p.hot, sh.hot], { speed: 30, up: 14, z: CHEST, life: 0.28 });
    }
  },
};

/** Thousand Cuts: he bows and is gone in a flash; a line of light hops from foe to foe, a cross on each, and every cross bursts at the end. */
const thousandCuts = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const sh = shotoOf(p);
    s.add(c.lead, (L, k, t) => {
      // Motes of both blades drawn in to him.
      for (let i = 0; i < 6; i++) {
        const th = (i / 6) * Math.PI * 2 - t * 5;
        const d = 16 * (1 - easeOut(k)) + 2;
        dot(L.air, c.from.x + Math.cos(th) * d, c.from.y - 10 + Math.sin(th) * d * 0.5, i % 2 ? sh.hot : p.hot, 0.5 + k * 0.5);
      }
      L.light(c.from.x, c.from.y - 10, 20 + 20 * k, p.light, 0.6 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const sh = shotoOf(p);
    const home = { x: c.from.x, y: c.from.y - CHEST };
    const foes = (c.path.length ? c.path : c.hits.length ? c.hits : [c.at]).map((h) => ({ x: h.x, y: h.y - CHEST }));
    const HOP = 0.08;
    const route = [home, ...foes, home];
    route.slice(1).forEach((b, i) => {
      const a = route[i];
      const col = i % 2 ? sh : p;
      s.add(
        0.24,
        (L, k) => {
          const reach = easeOut(Math.min(1, k / 0.25));
          const back = Math.max(0, (k - 0.25) / 0.75);
          const fa = 1 - back;
          const x0 = lerp(a.x, b.x, back);
          const y0 = lerp(a.y, b.y, back);
          const x1 = lerp(a.x, b.x, reach);
          const y1 = lerp(a.y, b.y, reach);
          line(L.air, x0, y0 + 1, x1, y1 + 1, col.mid, fa);
          line(L.air, x0, y0, x1, y1, k < 0.3 ? 0xffffff : col.core, fa);
          if (k < 0.25) L.light(x1, y1, 20, col.light, 0.8);
        },
        i * HOP,
      );
    });
    // A cross on each foe as he passes, held until the burst.
    const burst = route.length * HOP + 0.12;
    foes.forEach((f, i) => {
      s.add(
        burst - i * HOP,
        (L, k) => {
          const r = 4 * easeOut(Math.min(1, k * 6));
          line(L.air, f.x - r, f.y - r, f.x + r, f.y + r, p.hot);
          line(L.air, f.x - r, f.y + r, f.x + r, f.y - r, sh.hot);
        },
        (i + 1) * HOP,
      );
    });
    // Then every cross bursts at once.
    s.add(0.01, () => {}, burst, () => {
      for (const f of foes) {
        cutAcross(s, f.x, f.y, 10, -0.75, p, 0.26);
        cutAcross(s, f.x, f.y, 10, 0.75, sh, 0.26);
        s.add(0.2, (L, k) => star(L.air, f.x, f.y, Math.round(5 * (1 - k)) + 1, p, 1));
        s.sparks(f.x, f.y + CHEST, 6, [0xffffff, p.hot, sh.hot], { speed: 34, up: 16, z: CHEST, life: 0.3 });
      }
      s.shake(170, 0.004, foes[0] ? { x: foes[0].x, y: foes[0].y + CHEST } : undefined);
    });
  },
};

export const TWIN_KITS: Record<string, Kit> = {
  'jedi.twin': { melee: twinCut, skill: riposte, ult: thousandCuts },
};
