// The Forge on the west of the Runestone Clearing (see world/forgeLayout.ts):
// a smithy of the plaza's own fieldstone, timber-framed above, under a roof of
// sooty clay tiles with a great stone chimney. Walk in and the roof lifts off
// a warm, firelit workshop.
//
// Inside, painted on the ground in one piece: the back wall of rough stone
// blackened by years of smoke, the chimney breast of red brick coming down
// into a copper hood over the hearth, a shield and crossed hammers on the
// wall, a tool rack with tongs, hammers and files, and a shelf where the boss
// materials glow in their sets' colours; a floor of packed earth with worn
// flagstones round the anvil and out to the door, soot and ash and a few
// stray embers by the hearth, the coal heap with its shovel.
//
// Standing on it, as sprites: the hearth with its coal bed and flames (which
// flare when the bellows blow), the bellows, Brenna hammering a glowing bar
// on her anvil, and the quench trough. Outside by the door, a water barrel
// and a grindstone.
//
// Sizes against a hero (about 14 x 28 px): the hearth's top is waist high,
// the anvil's face a little lower, the door a head taller than they are.

import { mix } from './bitmap';
import { pixelCanvas } from './canvas';
import { hash2 } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type RenderedFrame, type Vec3 } from './pixel';
import { BUSH, FIELDSTONE, GEM_FLOWER_GOLD, GEM_FLOWER_PINK, HEARTH, IRON, OAK, doorway } from './sanctum';
import { fbm } from './spirit';
import { F_ANVIL, F_CAP, F_DOOR_HW, F_FLOOR, F_FRONT, F_HEARTH, F_SHELF, F_SIDE, FG_EXT_H, FG_EXT_W, FG_H, FG_W } from '../world/forgeLayout';
import { FORGE_SETS, MAT_SIZE } from '../game/forge';
import type { SetId } from '../game/gear';

type N3 = [number, number, number];
const ramp = (...c: string[]): RGB[] => c.map(hex);
const UP: N3 = [0, 0, 1];
const FACE: N3 = [0, -0.5, 0.86];
const front = (t: number): Vec3 => ({ x: t * 0.35, y: -0.4, z: 0.85 });
const top = (t = 0): Vec3 => ({ x: t * 0.2, y: 0.75, z: 0.65 });
const FACE_V: Vec3 = { x: 0, y: -0.4, z: 0.9 };
const FLAT_N: Vec3 = { x: 0, y: 0, z: 1 };

// ---------------------------------------------------------------- Materials

const INK = hex('#0e0a08');
const HEARTHSTONE: Material = { ramp: ramp('#141110', '#1f1a17', '#2a231f', '#372e28', '#453a32', '#55483d', '#685849'), outline: INK, outlineLit: hex('#2a221c') };
const BRICK: Material = { ramp: ramp('#1e0c08', '#30140d', '#461c12', '#5e2618', '#78321f', '#924028', '#a85234'), outline: hex('#120604'), outlineLit: hex('#3a1a10') };
const COALS: Material = { ramp: ramp('#1a0804', '#4a1406', '#8a2a08', '#d05a10', '#ff9a2a', '#ffd070', '#fff4c8'), outline: hex('#0a0302'), emissive: 0.95, noAO: true, noOutline: true };
const FLAME: Material = { ramp: ramp('#8a1e04', '#d04a0a', '#ff8a1a', '#ffc24a', '#fff0b0'), outline: hex('#300800'), emissive: 1, noAO: true, noOutline: true };
const CHAR: Material = { ramp: ramp('#070606', '#0e0c0b', '#171412', '#221e1b', '#2e2925', '#3c3631'), outline: hex('#040303') };
const LEATHER: Material = { ramp: ramp('#1a0e08', '#2a170c', '#3e2312', '#54311a', '#6c4224', '#855530'), outline: hex('#0c0604'), outlineLit: hex('#2c1a0e') };
const TAN: Material = { ramp: ramp('#2e1a0c', '#4a2c14', '#6a421e', '#8c5a2a', '#ac7438', '#c8904c'), outline: hex('#140a04'), outlineLit: hex('#3a2410') };
const STUMP: Material = { ramp: ramp('#1e130c', '#2e1d12', '#42291a', '#583824', '#6e4930', '#86603e'), outline: hex('#0c0704') };
const RINGS: Material = { ramp: ramp('#3a2616', '#4a3220', '#654530', '#825c3e', '#9c7450', '#b48c62'), outline: hex('#0c0704') };
const WATER: Material = { ramp: ramp('#050d16', '#0a1826', '#102436', '#183248', '#22445e', '#2e5a76', '#5a8aa6'), outline: hex('#03070c'), shine: true, noAO: true };
const SKIN: Material = { ramp: ramp('#4a2418', '#7a3e28', '#a8603c', '#c8845a', '#e2a67a', '#f4c89e'), outline: hex('#1e0c06'), outlineLit: hex('#3a1a0e') };
const HAIR: Material = { ramp: ramp('#140806', '#260e0a', '#3c1610', '#561e14', '#70281a', '#8c3622'), outline: hex('#0a0403'), outlineLit: hex('#2a100a') };
const KERCHIEF: Material = { ramp: ramp('#2a0606', '#4a0c0a', '#6e1410', '#962018', '#b83024', '#d44a36'), outline: hex('#140202') };
const SHIRT: Material = { ramp: ramp('#121614', '#1c221e', '#28302a', '#343e36', '#424e44', '#526054'), outline: INK, outlineLit: hex('#22281f') };
const TROUSER: Material = { ramp: ramp('#120e0c', '#1c1612', '#28201a', '#342a22', '#40342a'), outline: INK };
const BRASS: Material = { ramp: ramp('#3a2408', '#6a4414', '#9e6c24', '#d09c3c', '#f0c864', '#fff0b0'), outline: hex('#1a0e02'), shine: true };
const LENS: Material = { ramp: ramp('#10262a', '#1c4448', '#2e6a6a', '#58a6a0', '#a8e6dc'), outline: hex('#061012'), shine: true, emissive: 0.25 };
const HOT: Material = { ramp: ramp('#6a1a04', '#b0400a', '#f08020', '#ffc050', '#fff0c0'), outline: hex('#2a0802'), emissive: 0.9, noAO: true };
const EYE: Material = { ramp: ramp('#0a0606', '#1a1210'), outline: INK, noAO: true, noOutline: true };
const WOOD: Material = { ramp: ramp('#1c120b', '#2a1b10', '#3c2716', '#50351e', '#664528', '#7e5834', '#966c42'), outline: hex('#0c0704'), outlineLit: hex('#2a1a0e') };
const COPPER: Material = { ramp: ramp('#2a1208', '#45200e', '#673217', '#8c4822', '#b3622f', '#d68446', '#f0ac6a'), outline: hex('#140804'), outlineLit: hex('#4a2410'), shine: true };
const ROOF_TILE: Material = { ramp: ramp('#1a0c09', '#2a130d', '#3c1c13', '#50261a', '#643121', '#7a3d29', '#8f4b33', '#a65c40'), outline: hex('#0c0504'), outlineLit: hex('#321810') };
const PLASTER: Material = { ramp: ramp('#2e261e', '#44392d', '#5c4d3d', '#766450', '#8e7a62', '#a69076', '#bca68a'), outline: hex('#16100a') };
const SOOTY: Material = { ramp: ramp('#0c0a0a', '#151212', '#1f1a19', '#2a2422', '#36302c'), outline: hex('#060404') };
const STEEL: Material = { ramp: ramp('#1a1c24', '#2c303c', '#444a5a', '#646c80', '#9098ac', '#c8d0e0', '#f4f8ff'), outline: hex('#08090e'), shine: true };
const GRIT: Material = { ramp: ramp('#2a2622', '#3c3630', '#524a42', '#6a6056', '#82776a', '#9a8e7e'), outline: hex('#12100e') };

/** Each material's look for its icon and its jar on the Forge's shelf. */
const MAT_LOOK: Record<SetId, { body: Material; glow: RGB }> = {
  wraith: { body: { ramp: ramp('#0a3a38', '#12605a', '#1e8c82', '#3ab8aa', '#6ae0d0', '#b4fff0'), outline: hex('#041c1c'), emissive: 0.55, noAO: true }, glow: [106, 244, 220] },
  ember: { body: { ramp: ramp('#7a1a04', '#c0420a', '#ff8a1e', '#ffc860', '#fff4c8'), outline: hex('#2a0802'), emissive: 1, noAO: true, noOutline: true }, glow: [255, 160, 64] },
  spore: { body: { ramp: ramp('#3a0a2a', '#621446', '#8c2266', '#b8388a', '#e05aac', '#ff90d0'), outline: hex('#1a0412'), emissive: 0.3 }, glow: [255, 120, 224] },
  geode: { body: { ramp: ramp('#1e0a3a', '#34145e', '#502490', '#7040c0', '#9a6ae8', '#c8a8ff', '#f0e4ff'), outline: hex('#0e0420'), shine: true, emissive: 0.3 }, glow: [196, 156, 255] },
  astral: { body: { ramp: ramp('#1a2a6a', '#2c48a0', '#4a70d8', '#7ea0ff', '#b8ccff', '#f0f4ff'), outline: hex('#0a1030'), emissive: 0.7, shine: true, noAO: true }, glow: [154, 180, 255] },
};
const ROCK: Material = { ramp: ramp('#100a0a', '#1c1414', '#2a1e1c', '#382a26', '#48362e', '#5a463a'), outline: hex('#060404') };
const SPOT: Material = { ramp: ramp('#ff9ae0', '#ffe0f6'), outline: hex('#1a0412'), emissive: 1, noAO: true, noOutline: true };
const STEM: Material = { ramp: ramp('#4a3a42', '#7a6470', '#a8929c', '#d4c4ca'), outline: hex('#1a1216') };

// ---------------------------------------------------------------- Boss materials

/**
 * A boss material, 16x16, drawn in the middle of `c` at (ox, oy): the Hollow
 * Queen's torn, glowing veil; the Elementinho's molten core in a cracked black
 * shell; the Sporemother's heart, a fat cap spotted with light; a shard of
 * Amethrax's amethyst; a fallen star of the Astral Warden's.
 */
function drawMat(c: PixelCanvas, set: SetId, ox: number, oy: number, s = 1): void {
  const m = MAT_LOOK[set].body;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  if (set === 'wraith') {
    // A veil caught mid-drift: a hood at the top, falling in folds to a ragged hem that curls away.
    c.part();
    c.shape(Y(2), Y(14), (y) => {
      const u = (y - Y(2)) / (12 * s);
      const sway = Math.sin(u * 3.2) * 1.4 * s;
      const hw = (2.4 + u * 4.2) * s;
      return [X(8) - hw + sway, X(8) + hw + sway];
    }, m, (_x, _y, t, u) => sphere(t * 0.9, 0.4 - u * 0.6, 1));
    // Folds, and the ragged hem torn into tongues.
    for (let y = Math.round(Y(6)); y <= Y(14); y++) {
      c.shade(X(6) + Math.sin(((y - Y(2)) / (12 * s)) * 3.2) * 1.4 * s, y, -1);
      c.shade(X(10) + Math.sin(((y - Y(2)) / (12 * s)) * 3.2) * 1.4 * s, y, -1);
    }
    for (let x = Math.round(X(2)); x <= X(14); x++) if (hash2(x, 3, 701) > 0.5) for (let y = Y(13); y <= Y(14); y++) c.erase(x, y);
    // The empty hood: two cold eyes in the dark.
    c.part();
    c.ellipse(X(8), Y(5), 2.3 * s, 2 * s, SOOTY, { flatten: 0.6 });
    c.px(X(7), Y(5), m, sphere(0, 0), { glow: 1, bias: 3 });
    c.px(X(9), Y(5), m, sphere(0, 0), { glow: 1, bias: 3 });
    for (const [x, y] of [
      [2, 9],
      [14, 6],
      [13, 13],
    ]) c.spark(X(x), Y(y), [180, 255, 240], 0.8);
  } else if (set === 'ember') {
    // A lump of black rock split open on the fire inside.
    c.part();
    c.ellipse(X(8), Y(9), 5.6 * s, 5 * s, ROCK);
    c.part();
    for (let y = Math.round(Y(4)); y <= Y(14); y++) {
      for (let x = Math.round(X(2.5)); x <= X(13.5); x++) {
        const dx = (x + 0.5 - X(8)) / (5.6 * s);
        const dy = (y + 0.5 - Y(9)) / (5 * s);
        const r = Math.hypot(dx, dy);
        if (r > 1) continue;
        // Cracks: lines of fire across the shell, the heart of it molten.
        const crack = Math.abs(Math.sin(dx * 5.5 + dy * 2.2) + Math.cos(dy * 6.1 - dx * 1.4) * 0.7) < 0.28;
        if (r < 0.42 || (crack && r < 0.95)) c.px(x, y, m, sphere(dx, dy), { bias: r < 0.25 ? 2 : r < 0.42 ? 1 : 0 });
      }
    }
    c.spark(X(8), Y(2), [255, 200, 100], 0.9);
    c.spark(X(12), Y(3), [255, 150, 60], 0.7);
  } else if (set === 'spore') {
    // A fat, heart-shaped cap on a stub of stem, spotted with light.
    c.part();
    c.capsule(X(8), Y(10), X(8), Y(14), 1.8 * s, 2.2 * s, STEM);
    c.part();
    c.shape(Y(3), Y(11), (y) => {
      const u = (y - Y(3)) / (8 * s);
      const hw = (4 + Math.sin(u * Math.PI) * 2.8) * s;
      return [X(8) - hw, X(8) + hw];
    }, m, (_x, _y, t, u) => sphere(t * 0.9, 0.6 - u * 0.9, 1));
    // The notch at the top that makes it a heart.
    c.erase(X(8), Y(3));
    c.erase(X(7.4), Y(3));
    c.shade(X(8), Y(4), -1);
    c.part();
    for (const [x, y, r] of [
      [5.5, 6, 1],
      [10, 5, 1.2],
      [8, 8.5, 1],
      [11.5, 8.5, 0.8],
      [4.5, 9, 0.7],
    ]) c.ellipse(X(x), Y(y), r * s, r * s, SPOT, { glow: 0.9 });
    c.spark(X(3), Y(3), [255, 150, 230], 0.8);
    c.spark(X(13), Y(12), [255, 200, 240], 0.6);
  } else if (set === 'geode') {
    // Three amethyst points from one root, the middle one tallest.
    for (const [bx, tx, ty, hw] of [
      [5, 3.5, 5, 2.2],
      [11, 12.5, 4.5, 2.2],
      [8, 8, 1, 2.8],
    ]) {
      c.part();
      c.shape(Y(ty), Y(14), (y) => {
        const u = (y - Y(ty)) / (Y(14) - Y(ty));
        const cx = X(tx) + (X(bx) - X(tx)) * u;
        const w = Math.min(u * 3, 1) * hw * s;
        return w > 0.3 ? [cx - w, cx + w] : null;
      }, m, (_x, _y, t) => ({ x: t < 0 ? -0.6 : 0.5, y: 0.3, z: 0.75 }), { bias: tx === 8 ? 1 : 0 });
    }
    c.spark(X(8), Y(1), [255, 240, 255], 1);
    c.spark(X(4), Y(8), [220, 190, 255], 0.6);
  } else {
    // A five-pointed star, its heart white-hot.
    c.part();
    for (let y = Math.round(Y(1)); y <= Y(15); y++) {
      for (let x = Math.round(X(1)); x <= X(15); x++) {
        const dx = x + 0.5 - X(8);
        const dy = y + 0.5 - Y(8.6);
        const a = Math.atan2(dy, dx) + Math.PI / 2;
        const r = Math.hypot(dx, dy) / s;
        const k = Math.cos(((((a / (Math.PI * 2)) * 5) % 1) + 1) % 1 * Math.PI * 2);
        const edge = 3.2 + 3.6 * Math.max(0, k) ** 2.2;
        if (r > edge) continue;
        c.px(x, y, m, sphere((dx / 7) * 0.8, (dy / 7) * 0.8), { bias: r < 1.6 ? 2 : r < 3 ? 1 : 0 });
      }
    }
    c.spark(X(2), Y(2), [220, 230, 255], 0.9);
    c.spark(X(14), Y(13), [200, 215, 255], 0.7);
    c.spark(X(13), Y(3), [255, 255, 255], 0.5);
  }
}

/** A frame flattened for the UI and the ground: its colours with its glow added in. */
function flatten(r: RenderedFrame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let i = 0; i < r.w * r.h * 4; i += 4) {
    const a = Math.max(r.diffuse[i + 3], r.emissive[i + 3]);
    if (!a) continue;
    for (let k = 0; k < 3; k++) out[i + k] = Math.min(255, r.diffuse[i + k] + r.emissive[i + k] * 0.6);
    out[i + 3] = 255;
  }
  return out;
}

/** Each boss material as `mat_<set>`: 16x16 and flat, for its drop on the ground and its icon in the Forge. */
export function materialIcons(): { set: SetId; canvas: HTMLCanvasElement }[] {
  return FORGE_SETS.map((set) => {
    const c = new PixelCanvas(MAT_SIZE, MAT_SIZE);
    drawMat(c, set, 0, 0);
    return { set, canvas: pixelCanvas(MAT_SIZE, MAT_SIZE, flatten(c.render())) };
  });
}

// ---------------------------------------------------------------- The hall

export interface ForgeArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

/** The smithy's hall, painted in one piece: FG_W x FG_H. */
export function forgeHall(): ForgeArt {
  const W = FG_W;
  const H = FG_H;
  const N = W * H;
  const diffuse = new Uint8ClampedArray(N * 4);
  const normal = new Uint8ClampedArray(N * 4);
  const emissive = new Uint8ClampedArray(N * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const put = (x: number, y: number, c: RGB, n: N3, glow?: RGB, gk = 0) => {
    const o = (y * W + x) * 4;
    diffuse[o] = c[0];
    diffuse[o + 1] = c[1];
    diffuse[o + 2] = c[2];
    diffuse[o + 3] = 255;
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    normal[o] = Math.round((n[0] / l) * 127.5 + 127.5);
    normal[o + 1] = Math.round((n[1] / l) * 127.5 + 127.5);
    normal[o + 2] = Math.round((n[2] / l) * 127.5 + 127.5);
    normal[o + 3] = 255;
    if (glow && gk > 0) {
      emissive[o] = Math.min(255, emissive[o] + glow[0] * gk);
      emissive[o + 1] = Math.min(255, emissive[o + 1] + glow[1] * gk);
      emissive[o + 2] = Math.min(255, emissive[o + 2] + glow[2] * gk);
      emissive[o + 3] = 255;
    }
  };
  const shadeOf = (n: N3) => (n[0] * L.x + n[1] * L.y + n[2] * L.z) / ((Math.hypot(n[0], n[1], n[2]) || 1) * Ll);
  const pick = (r: RGB[], idx: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(idx)))];
  const WALL_IN = ramp('#110d0b', '#1a1411', '#241c17', '#30251e', '#3c3026', '#4a3c30', '#5a4a3b', '#6c5a48');
  const EARTH = ramp('#0f0a07', '#18110c', '#221811', '#2d2016', '#3a2a1d', '#473424', '#56402c');
  const FLAGS = ramp('#16120f', '#211b17', '#2c251f', '#383029', '#453b33', '#534840', '#63574c');
  const CAPS = ramp('#141110', '#1f1a17', '#2b2420', '#382f29', '#463b33', '#554840', '#66574c');
  const BRICKS = BRICK.ramp;
  const COPPERS = COPPER.ramp;
  const EMBER: RGB = [255, 140, 50];
  const FIRE: RGB = [255, 170, 80];
  const hx = F_HEARTH.x;
  const doorL = W / 2 - F_DOOR_HW;
  const doorR = W / 2 + F_DOOR_HW;
  /** The flagstones: round the anvil where the smith works, and a path out to the door. */
  const paved = (x: number, y: number) => {
    const ax = (x + 0.5 - F_ANVIL.x) / 30;
    const ay = (y + 0.5 - (F_ANVIL.y - 4)) / 20;
    const wob = (fbm(x, y, 6, 811, 2) - 0.5) * 0.35;
    if (ax * ax + ay * ay < 1 + wob) return true;
    return y > F_ANVIL.y && Math.abs(x + 0.5 - W / 2) < 13 + wob * 10;
  };
  /** Irregular flagstones: the nearest of a jittered grid of points, grout where two are near as close. */
  const flag = (x: number, y: number) => {
    const gx = Math.floor(x / 9);
    const gy = Math.floor(y / 7);
    let d1 = 1e9;
    let d2 = 1e9;
    let id = 0;
    for (let j = gy - 1; j <= gy + 1; j++) {
      for (let i = gx - 1; i <= gx + 1; i++) {
        const px = (i + 0.2 + hash2(i, j, 813) * 0.6) * 9;
        const py = (j + 0.2 + hash2(i, j, 815) * 0.6) * 7;
        const d = Math.hypot((x + 0.5 - px) * 0.78, y + 0.5 - py);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = i * 131 + j;
        } else if (d < d2) d2 = d;
      }
    }
    return { edge: d2 - d1, id };
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inX = x >= F_SIDE && x < W - F_SIDE;

      // ---- The north wall's face: rough stone, blackened toward the top and round the chimney.
      if (inX && y >= F_CAP && y < F_FLOOR) {
        const yy = y - F_CAP;
        const hgt = F_FLOOR - F_CAP;
        const dxh = x + 0.5 - hx;
        // The chimney breast in brick, from the ceiling down to the hood.
        if (Math.abs(dxh) < 12 && y < 31) {
          const row = Math.floor(yy / 3);
          const off = row % 2 ? 3 : 0;
          const mortar = yy % 3 === 2 || (x + off) % 6 === 0;
          const edge = Math.abs(dxh) > 11;
          const soot = Math.max(0, 1 - yy / 22) * 1.6 + (fbm(x, y, 5, 821, 2) - 0.5);
          if (mortar) put(x, y, pick(BRICKS, 0.6), FACE);
          else put(x, y, pick(BRICKS, 3 + (hash2(Math.floor((x + off) / 6), row, 823) - 0.5) * 1.4 - soot + (edge ? -1 : 0) + (yy % 3 === 0 ? 0.6 : 0)), edge ? [Math.sign(dxh) * 0.6, -0.3, 0.75] : FACE);
          continue;
        }
        // The copper hood, flaring out over the hearth, the fire's light on its lower rim.
        const hoodT = (y - 31) / 15;
        if (y >= 31 && y < 46 && Math.abs(dxh) < 12 + hoodT * 9) {
          const hw = 12 + hoodT * 9;
          const t = dxh / hw;
          const rim = y >= 43;
          const rivet = (y === 33 || y === 41) && Math.round(dxh) % 5 === 0 && Math.abs(dxh) < hw - 1;
          const n: N3 = rim ? [t * 0.5, -0.7, 0.6] : [t * 0.75, 0.15 - hoodT * 0.3, 0.7];
          let idx = 3.2 + shadeOf(n) * 1.8 + (fbm(x, y, 4, 825, 2) - 0.5) * 0.8;
          if (rim) idx += y === 43 ? 1.5 : -0.4;
          if (rivet) idx += 2;
          // Verdigris and soot in streaks down it.
          const streak = fbm(x * 3, y * 0.4, 6, 827, 2);
          if (streak > 0.64) idx -= 1.6;
          const fireLit = Math.max(0, hoodT - 0.25) ** 1.5;
          put(x, y, pick(COPPERS, idx), n, FIRE, fireLit * 0.35 + (rim ? 0.12 : 0));
          continue;
        }
        // Below the hood and behind the hearth: the wall black with soot, lit from the fire below.
        if (y >= 46 && Math.abs(dxh) < 22) {
          put(x, y, pick(WALL_IN, 0.5 + hash2(x, y, 829) * 0.8), FACE, EMBER, (y - 45) * 0.05);
          continue;
        }
        // Courses of rough-cut stone.
        const row = Math.floor(yy / 7);
        const off = Math.floor(hash2(row, 0, 831) * 11);
        const bw = 11 + Math.floor(hash2(Math.floor((x + off) / 13), row, 833) * 3) * 2;
        const lx = (x + off) % bw;
        const ly = yy % 7;
        let n = FACE;
        let idx = 3 + (hash2(Math.floor((x + off) / bw), row, 835) - 0.5) * 1.3 + (fbm(x, y, 5, 837, 2) - 0.5) * 0.9;
        if (ly === 6 || lx === 0) idx = 0.7;
        else if (ly === 0) {
          n = [0, 0.3, 0.95];
          idx += 0.7;
        } else if (lx === 1) idx += 0.4;
        // Soot: heavy under the ceiling and spreading out from the chimney.
        idx -= Math.max(0, 1 - yy / 16) * 1.2 + Math.max(0, 1 - Math.abs(dxh) / 34) * 1.1;
        // The floor's shadow along the wall's foot.
        if (yy > hgt - 3) idx -= (yy - hgt + 3) * 0.5;
        // The fire's glow reaching up the wall either side of the hood.
        const lit = Math.max(0, 1 - Math.hypot(dxh / 34, (y - 50) / 20));
        put(x, y, pick(WALL_IN, idx + shadeOf(n) * 0.5 + lit * 0.9), n, EMBER, lit * lit * 0.08);
        continue;
      }

      // ---- The floor, and the doorway through the south wall.
      const inFloor = inX && y >= F_FLOOR && y < F_FRONT;
      const inDoor = x >= doorL && x < doorR && y >= F_FRONT;
      if (inFloor || inDoor) {
        if (inDoor) {
          // An oak sill, then daylight spilling in over it.
          const jamb = x < doorL + 2 || x >= doorR - 2;
          const k = (y - F_FRONT) / (H - F_FRONT);
          if (y === F_FRONT || y === F_FRONT + 1) put(x, y, pick(WOOD.ramp, y === F_FRONT ? 5 : 3), y === F_FRONT ? [0, 0.5, 0.86] : UP);
          else if (jamb) put(x, y, pick(WOOD.ramp, 2), UP);
          else put(x, y, pick(FLAGS, 3.4 + k * 1.2 + hash2(x, y, 841) * 0.6), UP);
          continue;
        }
        const fy = y - F_FLOOR;
        const side = Math.min(x - F_SIDE, W - F_SIDE - 1 - x, F_FRONT - 1 - y);
        // Soot and ash spread from the hearth, and its glow on the floor.
        const hd = Math.hypot((x + 0.5 - hx) / 30, (y - F_HEARTH.y + 4) / 16);
        const ash = Math.max(0, 1 - hd) * 1.4;
        const glow = Math.max(0, 1 - Math.hypot((x + 0.5 - hx) / 26, (y - F_HEARTH.y) / 14));
        let c: RGB;
        let n: N3 = UP;
        if (paved(x, y)) {
          const f = flag(x, y);
          if (f.edge < 0.9) c = pick(FLAGS, 0.6 + hash2(x, y, 843) * 0.6);
          else {
            // Each stone its own tone, worn smooth and paler in the middle of the path.
            let idx = 3 + (hash2(f.id, 7, 845) - 0.5) * 1.6 + (fbm(x, y, 3, 847, 2) - 0.5) * 0.8;
            if (f.edge < 1.6) {
              n = [0, 0.35, 0.94];
              idx += 0.5;
            }
            if (Math.abs(x + 0.5 - W / 2) < 6 && y > F_ANVIL.y) idx += 0.5;
            c = pick(FLAGS, idx - ash - (side < 6 ? (6 - side) / 3 : 0));
          }
        } else {
          // Packed earth, scuffed, darker along the walls.
          let idx = 3 + (fbm(x, y, 7, 849, 3) - 0.5) * 1.6 + (hash2(x, y, 851) - 0.5) * 0.7 - ash;
          if (side < 8) idx -= (8 - side) / 3.5;
          if (fy < 5) idx -= (5 - fy) / 2;
          c = pick(EARTH, idx);
        }
        // Scale from the anvil: a few flecks of dark iron round it.
        const nearAnvil = Math.hypot(x + 0.5 - F_ANVIL.x, (y - F_ANVIL.y + 3) * 1.4);
        if (nearAnvil < 20 && hash2(x, y, 853) > 0.93) c = mix(c, [20, 22, 30], 0.7);
        // Stray embers by the hearth.
        const ember = hd < 0.85 && hash2(x, y, 855) > 0.985;
        put(x, y, ember ? mix(c, EMBER, 0.6) : mix(c, [120, 60, 24], glow * 0.18), n, ember ? EMBER : FIRE, ember ? 0.7 : glow * glow * 0.06);
        continue;
      }

      // ---- The walls' tops all round: cut stone, their inner edges catching the light.
      const inner = (x === F_SIDE - 1 && y >= F_CAP) || (x === W - F_SIDE && y >= F_CAP) || (y === F_CAP - 1 && inX) || (y === F_FRONT && inX);
      const outer = x === 0 || x === W - 1 || y === 0 || y === H - 1;
      const jamb = y >= F_FRONT && (x === doorL - 1 || x === doorR);
      if (jamb) {
        put(x, y, pick(WOOD.ramp, 4), UP);
        continue;
      }
      const bx = Math.floor(x / 9);
      const by = Math.floor(y / 6);
      let idx = 2.8 + (hash2(bx, by, 861) - 0.5) * 1 + (fbm(x, y, 5, 863, 2) - 0.5) * 0.6;
      if (x % 9 === 0 || y % 6 === 0) idx -= 1;
      if (inner) idx += 2.2;
      if (outer) idx = 0;
      put(x, y, pick(CAPS, idx), UP);
    }
  }

  // What hangs on the walls and lies on the floor, drawn as sprites and laid over the paint.
  const props = new PixelCanvas(W, H);
  wallProps(props);
  floorProps(props);
  const r = props.render();
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (r.diffuse[o + 3]) {
      for (let k = 0; k < 4; k++) {
        diffuse[o + k] = r.diffuse[o + k];
        normal[o + k] = r.normal[o + k];
      }
    }
    if (r.emissive[o + 3]) {
      for (let k = 0; k < 3; k++) emissive[o + k] = Math.min(255, emissive[o + k] + r.emissive[o + k]);
      emissive[o + 3] = 255;
    }
  }
  return { diffuse, normal, emissive };
}

/** On the north wall: a round shield and two crossed hammers west of the hood, the tool rack and the shelf of materials to the east. */
function wallProps(c: PixelCanvas): void {
  const wall: Vec3 = { x: 0, y: -0.45, z: 0.88 };
  // West of the hood: a round shield, iron-rimmed with a boss, hung on a peg.
  const sx = 13;
  const sy = 22;
  c.part();
  c.ellipse(sx, sy, 5.2, 5.6, WOOD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6, 1) });
  c.part();
  for (let a = 0; a < Math.PI * 2; a += 0.1) c.px(sx + Math.cos(a) * 5, sy + Math.sin(a) * 5.4, IRON, sphere(Math.cos(a) * 0.7, -Math.sin(a) * 0.7));
  c.part();
  for (let y = sy - 4; y <= sy + 4; y++) c.px(sx, y, IRON, cyl(0, 0.2), { bias: -1 });
  c.part();
  c.ellipse(sx, sy, 1.6, 1.6, BRASS);
  // Crossed hammers between the shield and the hood.
  for (const s of [-1, 1]) {
    c.part();
    c.line(sx + 3 - s * 3, 8 + (s > 0 ? 0 : 0), sx + 3 + s * 3, 16, WOOD, () => wall);
    c.part();
    c.shape(7, 9, () => [sx + 3 - s * 3 - 2, sx + 3 - s * 3 + 2], IRON, (_x, y, t) => (y === 7 ? top(t) : cyl(t, 0.2)));
  }

  // East of the hood: a rack of tongs, hammers and files on pegs, the shelf of boss materials above.
  const rx = F_SHELF.x;
  const ry = 31;
  c.part();
  c.shape(ry, ry + 1, () => [rx - 1, rx + F_SHELF.w + 1], WOOD, (_x, y) => (y === ry ? top(0) : front(0)), { bias: 1 });
  // Tongs (two long jaws), a sledge, a cross-peen, a rasp, a poker with a hook.
  const hang = (x: number, draw: () => void) => {
    c.part();
    c.px(x, ry - 1, IRON, wall, { bias: 2 });
    draw();
  };
  hang(rx + 3, () => {
    c.line(rx + 2, ry + 1, rx + 1, ry + 13, IRON, () => wall);
    c.line(rx + 4, ry + 1, rx + 5, ry + 13, IRON, () => wall, { bias: -1 });
    c.part();
    c.line(rx + 2, ry + 3, rx + 4, ry + 3, IRON, () => wall, { bias: 1 });
  });
  hang(rx + 11, () => {
    c.capsule(rx + 11, ry + 1, rx + 11, ry + 11, 0.6, 0.6, WOOD);
    c.part();
    c.shape(ry + 10, ry + 13, () => [rx + 8, rx + 14], IRON, (_x, y, t) => (y === ry + 10 ? top(t) : cyl(t, 0.2)), { bias: 1 });
  });
  hang(rx + 18, () => {
    c.capsule(rx + 18, ry + 1, rx + 18, ry + 10, 0.5, 0.5, WOOD);
    c.part();
    c.shape(ry + 9, ry + 11, () => [rx + 15, rx + 21], IRON, (_x, y, t) => (y === ry + 9 ? top(t) : cyl(t, 0.2)));
    c.px(rx + 21, ry + 10, IRON, wall, { bias: 2 });
  });
  hang(rx + 25, () => {
    c.capsule(rx + 25, ry + 1, rx + 25, ry + 4, 0.7, 0.7, WOOD);
    c.part();
    for (let y = ry + 5; y <= ry + 13; y++) c.px(rx + 25, y, STEEL, cyl(0, 0.2), { bias: y % 2 ? -1 : 0 });
    c.px(rx + 26, ry + 6, STEEL, wall, { bias: -2 });
  });
  hang(rx + 32, () => {
    c.line(rx + 32, ry + 1, rx + 32, ry + 12, IRON, () => wall);
    c.px(rx + 33, ry + 12, IRON, wall);
    c.px(rx + 34, ry + 11, IRON, wall);
    c.part();
    c.ellipse(rx + 32, ry + 1.5, 1.3, 1, IRON, { flatten: 0.7 });
  });

  // The shelf, on two iron brackets, and the materials on it in little glowing heaps.
  const sy2 = F_SHELF.y;
  c.part();
  for (const bx of [rx + 3, rx + F_SHELF.w - 3]) c.line(bx, sy2 + 1, bx + (bx < rx + 10 ? 2 : -2), sy2 + 4, IRON, () => wall);
  c.part();
  c.shape(sy2 - 1, sy2 + 1, () => [rx - 1, rx + F_SHELF.w + 1], WOOD, (_x, y) => (y === sy2 - 1 ? top(0) : front(0)), { bias: 1 });
  FORGE_SETS.forEach((set, k) => {
    const mx = rx + 3 + k * 8;
    const m = MAT_LOOK[set].body;
    c.part();
    // Each at a third of its icon's size: a small bright heap, catching the eye.
    if (set === 'wraith') {
      c.shape(sy2 - 7, sy2 - 2, (y) => [mx - 1 - (y - sy2 + 7) * 0.4, mx + 2 + (y - sy2 + 7) * 0.4], m, (_x, _y, t, u) => sphere(t * 0.8, 0.4 - u, 1));
    } else if (set === 'ember') {
      c.ellipse(mx + 0.5, sy2 - 4, 2.6, 2.4, ROCK);
      c.part();
      c.px(mx, sy2 - 4, m, sphere(0, 0), { bias: 2 });
      c.px(mx + 1, sy2 - 5, m, sphere(0, 0));
      c.px(mx - 1, sy2 - 3, m, sphere(0, 0));
    } else if (set === 'spore') {
      c.px(mx + 0.5, sy2 - 2, STEM, sphere(0, 0));
      c.part();
      c.ellipse(mx + 0.5, sy2 - 4.5, 2.8, 2.2, m);
      c.part();
      c.px(mx - 1, sy2 - 5, SPOT, sphere(0, 0));
      c.px(mx + 1, sy2 - 4, SPOT, sphere(0, 0));
    } else if (set === 'geode') {
      c.shape(sy2 - 8, sy2 - 2, (y) => {
        const w = Math.min(1, (y - sy2 + 8) / 2.5) * 1.8;
        return [mx + 0.5 - w, mx + 0.5 + w];
      }, m, (_x, _y, t) => ({ x: t < 0 ? -0.6 : 0.5, y: 0.3, z: 0.75 }));
      c.part();
      c.shape(sy2 - 5, sy2 - 2, (y) => [mx - 2.5 + (sy2 - 2 - y) * 0.2, mx - 0.5], m, () => ({ x: -0.5, y: 0.3, z: 0.8 }), { bias: -1 });
    } else {
      for (const [dx, dy] of [
        [0, -6],
        [-2, -4],
        [2, -4],
        [-1, -2],
        [1, -2],
        [0, -4],
        [0, -3],
        [-1, -4],
        [1, -4],
        [0, -5],
      ]) c.px(mx + 0.5 + dx, sy2 + dy, m, sphere(dx / 3, dy / 6 + 0.6), { bias: dx === 0 && dy === -4 ? 2 : 0 });
    }
    const g = MAT_LOOK[set].glow;
    c.spark(mx + 0.5, sy2 - 9, g, 0.35);
    c.spark(mx + 0.5, sy2 - 1, g, 0.25);
  });
}

/** On the floor: the coal heap by the hearth with a shovel in it, and bar stock stacked by the east wall. */
function floorProps(c: PixelCanvas): void {
  const cx = 72;
  const cy = F_FLOOR + 5;
  c.part();
  c.ellipse(cx, cy, 9, 4.6, CHAR, { flatten: 0.7 });
  c.part();
  for (let k = 0; k < 26; k++) {
    const a = hash2(k, 1, 871) * Math.PI * 2;
    const d = Math.sqrt(hash2(k, 2, 873));
    const x = cx + Math.cos(a) * d * 7.5;
    const y = cy + Math.sin(a) * d * 3.6 - (1 - d) * 2;
    c.ellipse(x, y, 1.3, 1, CHAR, { bias: 1 + (hash2(k, 3, 875) > 0.6 ? 1 : 0) });
  }
  // The shovel stuck in it, its handle leaning on the wall.
  c.part();
  c.shape(cy - 3, cy + 1, (y) => [cx + 1 + (y - cy + 3) * 0.3, cx + 5 - (y - cy + 3) * 0.3], IRON, (_x, _y, t) => cyl(t, 0.4));
  c.part();
  c.line(cx + 3, cy - 3, cx + 7, F_FLOOR - 9, WOOD);
  c.px(cx + 7, F_FLOOR - 10, WOOD, top(0), { bias: 1 });

  // Bars of iron stock, stacked crosswise on two blocks.
  const bx = 112;
  const by = F_FLOOR + 14;
  c.part();
  for (const dy of [0, 6]) c.shape(by + dy - 1, by + dy + 1, () => [bx - 4, bx + 5], WOOD, (_x, y, t) => (y === by + dy - 1 ? top(t) : front(t)));
  for (let k = 0; k < 4; k++) {
    c.part();
    c.line(bx - 3 + k * 2.2, by - 3, bx - 3 + k * 2.2, by + 7, IRON, () => top(0), { bias: k % 2 ? -1 : 1 });
  }
}

// ---------------------------------------------------------------- The hearth, bellows and trough

export const HEARTH_W = 44;
export const HEARTH_H = 40;
/** Feet in the frame: the middle of its front's foot. */
export const HEARTH_OX = 22;
export const HEARTH_OY = 37;
export const FIRE_FRAMES = 8;

/** How hard the bellows are blowing in frame `f` (0 slack, 1 full), the fire flaring with them. */
const blow = (f: number) => 0.5 - 0.5 * Math.cos((f / FIRE_FRAMES) * Math.PI * 2);

/** The hearth, frame `f`: a waist-high block of brick under a stone slab, its bed of coals breathing and flames licking up, taller when the bellows blow. */
export function hearthFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(HEARTH_W, HEARTH_H);
  const cx = HEARTH_OX;
  const b = blow(f);
  const ph = (f / FIRE_FRAMES) * Math.PI * 2;

  // The block: a stone slab top with a raised rim, brick below.
  c.part();
  c.shape(24, 37, () => [cx - 19, cx + 19], BRICK, (_x, _y, t) => front(t * 0.6));
  for (let y = 24; y <= 37; y++) {
    const row = Math.floor((y - 24) / 3);
    for (let x = cx - 19; x < cx + 19; x++) {
      const off = row % 2 ? 3 : 0;
      if ((y - 24) % 3 === 2 || (x + off) % 6 === 0) c.shade(x, y, -2);
      else if ((y - 24) % 3 === 0) c.shade(x, y, 1);
      else if (hash2(Math.floor((x + off) / 6), row, 881) > 0.7) c.shade(x, y, -1);
    }
  }
  // The ash pit: an arched mouth in the brick, the coals' glow falling into it.
  c.part();
  for (let y = 29; y <= 37; y++) {
    for (let x = cx - 6; x < cx + 6; x++) {
      const dx = x + 0.5 - cx;
      if (y < 32 && Math.hypot(dx, y + 0.5 - 32) > 6) continue;
      const k = (y - 29) / 8;
      c.px(x, y, COALS, FACE_V, { bias: -4 + Math.round(k * 2 + b), glow: 0.15 + k * 0.3 + b * 0.15 });
    }
  }
  // Stone voussoirs round the arch.
  c.part();
  for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += 0.18) c.px(cx + Math.cos(a) * 7, 32 + Math.sin(a) * 7, HEARTHSTONE, sphere(Math.cos(a) * 0.5, -Math.sin(a) * 0.5), { bias: 1 });
  // The slab: its top seen from above, its front edge a lit lip.
  c.part();
  c.shape(12, 23, (y) => [cx - 20 + (y < 14 ? 1 : 0), cx + 20 - (y < 14 ? 1 : 0)], HEARTHSTONE, (_x, y, t) => (y >= 21 ? front(t) : top(t * 0.4)), { bias: 1 });
  // The coal bed sunk into it, breathing, hotter in the middle.
  c.part();
  for (let y = 13; y <= 21; y++) {
    for (let x = cx - 16; x <= cx + 16; x++) {
      const dx = (x + 0.5 - cx) / 15.5;
      const dy = (y + 0.5 - 17) / 4.4;
      const r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const lump = hash2(Math.floor((x + 0.5) / 2), Math.floor(y / 2), 883);
      const pulse = Math.sin(ph + lump * 9 + x * 0.3) * 0.5 + 0.5;
      const heat = (1 - r) * 3.2 + pulse * 1.2 + b * 1.4 - 0.6;
      if (lump > 0.78 && r > 0.35) c.px(x, y, CHAR, top(dx * 0.5), { bias: Math.round(pulse) });
      else c.px(x, y, COALS, top(0), { bias: Math.round(heat) - 3, glow: 0.45 + heat * 0.12 });
    }
  }
  // The bed's rim: iron, rust-dark, a tuyere pipe coming in on the west from the bellows.
  c.part();
  for (let a = 0; a < Math.PI * 2; a += 0.06) {
    const x = cx + Math.cos(a) * 16.6;
    const y = 17 + Math.sin(a) * 4.9;
    c.px(x, y, IRON, sphere(Math.cos(a) * 0.6, -Math.sin(a) * 0.8 + 0.3), { bias: Math.sin(a) > 0 ? 1 : 0 });
  }
  c.part();
  c.shape(17, 19, () => [0, cx - 16], IRON, (_x, y, t) => (y === 17 ? top(t) : cyl(0, 0.2)));

  // Flames: tongues rising from the coals, swaying, longer on each breath of the bellows.
  c.part();
  const tongues = [
    [-10, 0.55, 1.3],
    [-5, 0.8, 0.4],
    [0, 1, 2.1],
    [5, 0.75, 3.3],
    [10, 0.5, 4.6],
    [-2, 0.6, 5.2],
    [3, 0.62, 6.1],
  ];
  for (const [ox, size, seed] of tongues) {
    const len = (5 + size * 8) * (0.7 + b * 0.5) * (0.85 + 0.15 * Math.sin(ph * 2 + seed * 3));
    const base = 17 + (Math.abs(ox) / 16) * -1.5;
    const sway = Math.sin(ph + seed) * 1.4;
    for (let k = 0; k <= len; k++) {
      const u = k / len;
      const w = (1 - u) ** 0.8 * (1.3 + size * 1.2);
      const x = cx + ox + sway * u * u + Math.sin(u * 4 + ph * 2 + seed) * 0.6 * u;
      const y = base - k;
      for (let dx = -w; dx <= w; dx += 0.5) {
        const e = Math.abs(dx) / (w || 1);
        c.px(x + dx, y, FLAME, FLAT_N, { bias: Math.round((1 - e) * 2.4 + (1 - u) * 1.6) - 1, glow: 1 });
      }
    }
  }
  // Sparks leaping from the fire.
  for (let k = 0; k < 6; k++) {
    const t = (f / FIRE_FRAMES + k / 6) % 1;
    const x = cx + Math.sin(k * 4.1 + t * 3) * (4 + k * 1.5);
    const y = 12 - t * 12 * (0.7 + b * 0.6);
    c.spark(x, y, k % 2 ? [255, 210, 120] : [255, 150, 60], (1 - t) * (0.7 + b * 0.3));
  }
  return c;
}

export const BELLOWS_W = 22;
export const BELLOWS_H = 22;
export const BELLOWS_OX = 11;
export const BELLOWS_OY = 20;

/** The bellows, frame `f` (in step with the fire): on a wooden stand, their boards opening and pressing shut, pleated leather between, the nozzle into the hearth's side. */
export function bellowsFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(BELLOWS_W, BELLOWS_H);
  const cx = BELLOWS_OX;
  const open = 1 - blow(f);
  const gap = 1.5 + open * 3.5;
  // The stand: two legs and a crossbar.
  for (const lx of [cx - 6, cx + 4]) {
    c.part();
    c.capsule(lx, 12, lx, 19, 0.8, 0.9, WOOD);
  }
  c.part();
  c.shape(16, 16, () => [cx - 7, cx + 6], WOOD, () => front(0), { bias: -1 });
  // The bottom board, a teardrop pointing east to the nozzle.
  const board = (y0: number, m: Material, bias: number) => {
    c.shape(y0 - 3, y0 + 1, (y) => {
      const u = (y - y0 + 3) / 4;
      const r = 4.2 * Math.sin(Math.max(0.12, u) * Math.PI * 0.95);
      return [cx - 6 - r * 0.2, cx + 6 - (1 - Math.sin(u * Math.PI)) * 3];
    }, m, (_x, y, t) => (y < y0 ? top(t * 0.5) : front(t)), { bias });
  };
  c.part();
  board(13, WOOD, -1);
  // The leather between the boards, in pleats.
  c.part();
  const tip = cx + 6;
  c.shape(Math.round(13 - gap), 12, (y) => [cx - 7 + (13 - y) * 0.1, tip - (13 - y) * 0.9], LEATHER, (_x, _y, t) => front(t));
  for (let x = cx - 6; x < tip - 1; x += 2) for (let y = Math.round(13 - gap); y <= 12; y++) c.shade(x, y, -1);
  // The top board, riding up and down, and its handle.
  c.part();
  board(Math.round(13 - gap - 1), WOOD, 1);
  c.part();
  c.capsule(cx - 6, 10 - gap, cx - 9, 4 - gap * 0.6, 0.7, 0.7, WOOD);
  c.part();
  c.ellipse(cx - 9, 4 - gap * 0.6, 1.1, 1.1, IRON);
  // The brass nozzle, a puff of air glinting from it on the breath.
  c.part();
  c.capsule(tip - 1, 11.5, BELLOWS_W - 1, 11.5, 1.1, 0.7, BRASS);
  if (open < 0.3) c.spark(BELLOWS_W - 1, 10, [255, 200, 140], 0.5);
  return c;
}

export const TROUGH_W = 30;
export const TROUGH_H = 18;
export const TROUGH_OX = 15;
export const TROUGH_OY = 16;

/** The quench trough: a long stone box of dark water, the fire's light shivering on it (the world adds the steam). */
export function troughFrame(): PixelCanvas {
  const c = new PixelCanvas(TROUGH_W, TROUGH_H);
  const cx = TROUGH_OX;
  c.part();
  c.shape(9, 16, () => [cx - 13, cx + 13], HEARTHSTONE, (_x, _y, t) => front(t), {});
  for (let x = cx - 13; x < cx + 13; x++) {
    c.shade(x, 12, -1);
    if (hash2(x >> 2, 1, 891) > 0.6) c.shade(x, 14, -1);
  }
  c.part();
  c.shape(3, 9, () => [cx - 14, cx + 14], HEARTHSTONE, (_x, y, t) => (y === 9 ? front(t) : top(t * 0.3)), { bias: 1 });
  c.part();
  for (let y = 4; y <= 7; y++) {
    for (let x = cx - 11; x < cx + 11; x++) {
      const ripple = Math.sin(x * 0.9 + y * 2.1) * 0.5 + 0.5;
      c.px(x, y, WATER, { x: 0, y: 0.15, z: 0.99 }, { bias: y === 4 ? -2 : Math.round(ripple * 1.2) - 1 });
    }
  }
  // Glints of firelight on the water.
  for (const [x, y] of [
    [cx - 7, 5],
    [cx - 6, 5],
    [cx + 2, 6],
    [cx + 6, 5],
  ]) c.spark(x, y, [255, 170, 90], 0.45);
  // A pair of tongs resting across it.
  c.part();
  c.line(cx - 12, 2, cx + 8, 4, IRON, () => top(0), { bias: 1 });
  c.line(cx - 12, 3, cx + 8, 5, IRON, () => top(0));
  return c;
}

// ---------------------------------------------------------------- Brenna

export const SMITH_W = 44;
export const SMITH_H = 48;
/** Feet in the frame: the anvil's stump. */
export const SMITH_OX = 24;
export const SMITH_OY = 45;
export const SMITH_FRAMES = 10;
/** The frame her hammer strikes the anvil. */
export const SMITH_STRIKE = 6;
/** Where the hammer lands, in the frame. */
export const STRIKE_AT = { x: 27, y: 30 };
/** How high the hammer is in each frame, 0 on the anvil and 1 raised high. */
const SWING = [0.14, 0.4, 0.72, 0.95, 1, 0.55, 0, 0.1, 0.03, 0.06];

export const PORTRAIT_W = 30;
export const PORTRAIT_H = 38;
export const PORTRAIT_FRAMES = 6;

/**
 * Brenna the Forgemaster: broad-shouldered, sleeves rolled on strong
 * forearms, a soot-streaked leather apron over a dark shirt, heavy gloves, a
 * red kerchief over her auburn hair with its thick braid down her back, brass
 * goggles pushed up on her brow. She stands facing the room (drawn from
 * (cx, feet)), her hammer in her right hand (on the east) raised `lift` (0
 * down to 1 overhead), her tongs in her left.
 */
function brenna(c: PixelCanvas, cx: number, feet: number, lift: number, breath: number, tongs: boolean, hideLegs: boolean): void {
  const U = breath;
  const Y = (y: number) => feet - 34 + y;
  // A dip of the shoulders as the hammer comes down.
  const dip = lift < 0.2 ? (0.2 - lift) * 3 : 0;
  const S = U + dip;

  // The braid, behind her, swinging over her shoulder.
  c.part();
  c.capsule(cx - 3.5, Y(12 + S), cx - 5.5, Y(22 + S), 1.6, 1.1, HAIR);
  c.part();
  c.ellipse(cx - 5.6, Y(22.8 + S), 1.3, 1.3, KERCHIEF);
  if (!hideLegs) {
    for (const s of [-1, 1]) {
      c.part();
      c.capsule(cx + s * 2.6, Y(27), cx + s * 2.8, Y(31), 2, 1.8, TROUSER);
      c.part();
      c.ellipse(cx + s * 3, Y(32.4), 2.5, 1.5, LEATHER, { flatten: 0.8 });
    }
  }
  // Her body: a dark shirt, broad in the shoulders, the apron over it.
  c.part();
  c.shape(Math.round(Y(15 + S)), Y(28), (y) => {
    const u = (y - Y(15 + S)) / (Y(28) - Y(15 + S));
    const hw = 6.1 - u * 1.2 + Math.sin(u * Math.PI) * 0.4 + (u > 0.8 ? (u - 0.8) * 3 : 0);
    return [cx - hw, cx + hw];
  }, SHIRT, (_x, y, t) => sphere(t * 0.9, (Y(19) - y) / 12, 1));
  c.part();
  c.shape(Math.round(Y(18 + S)), Y(30), (y) => {
    const u = (y - Y(18 + S)) / (Y(30) - Y(18 + S));
    const hw = 3.6 + u * 1.8;
    return [cx - hw, cx + hw];
  }, LEATHER, (_x, _y, t) => sphere(t * 0.8, 0.1, 1));
  // Soot on the apron, its straps, a pocket with a pair of pliers in it.
  for (const [x, y] of [
    [cx - 2, 22],
    [cx + 2, 25],
    [cx - 3, 27],
    [cx + 1, 20],
  ]) c.shade(x, Y(y + S), -1);
  c.part();
  for (const s of [-1, 1]) c.capsule(cx + s * 3.4, Y(15.6 + S), cx + s * 3.2, Y(18.4 + S), 0.5, 0.5, LEATHER);
  c.part();
  c.shape(Math.round(Y(24 + S)), Math.round(Y(26 + S)), () => [cx + 0.5, cx + 3.5], LEATHER, () => front(0), { bias: 1 });
  c.px(cx + 2, Y(23 + S), IRON, front(0), { bias: 2 });
  // The belt.
  c.part();
  c.shape(Math.round(Y(22.6 + S)), Math.round(Y(22.6 + S)), () => [cx - 5.4, cx + 5.4], TROUSER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx - 3, Y(22.6 + S), BRASS, sphere(0, 0.2));

  // Her left arm (on the west): down and forward, a gloved hand on the tongs.
  const lh = { x: cx - 6.5, y: Y(26 + S) };
  c.part();
  c.capsule(cx - 5.8, Y(17 + S), cx - 7.2, Y(21 + S), 2.1, 1.9, SHIRT);
  c.part();
  c.capsule(cx - 7.2, Y(21 + S), lh.x, lh.y - 1.2, 1.8, 1.7, SKIN);
  c.part();
  c.ellipse(lh.x, lh.y, 2, 1.9, TAN);
  if (tongs) {
    c.part();
    c.line(lh.x + 1, lh.y + 0.5, STRIKE_AT.x - 4, STRIKE_AT.y - 0.5, IRON, () => top(0), { bias: 1 });
    c.line(lh.x + 1, lh.y + 1.5, STRIKE_AT.x - 4, STRIKE_AT.y + 0.5, IRON, () => top(0));
  }

  // Her head: a strong jaw, a smudge of soot on her cheek, goggles up on the kerchief.
  const hy = Y(10.8 + U);
  c.part();
  c.ellipse(cx, hy, 3.5, 3.6, SKIN);
  c.part();
  // Hair at the temples, the kerchief knotted over it.
  c.capsule(cx - 3.3, hy - 1, cx - 3.4, hy + 2.2, 1, 0.9, HAIR);
  c.capsule(cx + 3.3, hy - 1, cx + 3.4, hy + 1.6, 1, 0.9, HAIR);
  c.part();
  c.shape(Math.round(hy - 4.4), Math.round(hy - 1.2), (y) => {
    const u = (y - (hy - 4.4)) / 3.2;
    const hw = 2.6 + u * 1.3;
    return [cx - hw, cx + hw];
  }, KERCHIEF, (_x, y, t) => sphere(t * 0.8, 0.6 - (y - hy + 4) * 0.2, 1));
  c.part();
  c.ellipse(cx - 3.8, hy - 3.2, 1.2, 1, KERCHIEF);
  c.px(cx - 5, hy - 2.4, KERCHIEF, sphere(-0.5, 0));
  // The goggles: brass rims, glass catching the fire.
  c.part();
  c.shape(Math.round(hy - 2), Math.round(hy - 2), () => [cx - 3.6, cx + 3.6], LEATHER, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  for (const s of [-1, 1]) {
    c.px(cx + s * 1.5 - (s > 0 ? 1 : 0), hy - 2.6, BRASS, sphere(s * 0.4, 0.4), { bias: 1 });
    c.px(cx + s * 1.5, hy - 2.6, BRASS, sphere(s * 0.4, 0.4));
    c.px(cx + s * 1.5 - (s > 0 ? 1 : 0) + (s > 0 ? 0 : 1) * 0, hy - 1.6, LENS, sphere(0, 0.3), { glow: 0.35 });
  }
  // Eyes, brows set on the work, the soot smudge.
  c.part();
  for (const s of [-1, 1]) c.px(cx + s * 1.5 - (s > 0 ? 1 : 0), hy + 0.4, EYE, FLAT_N);
  c.shade(cx - 2.5, hy + 1.6, -1);
  c.shade(cx, hy + 2.2, -1);
  c.shade(cx + 2.2, hy + 1.5, -2);

  // Her right arm (on the east), and the hammer in it.
  const sx = cx + 5.8;
  const sy = Y(17 + S);
  // The hand swings on an arc about the shoulder: forward and down onto the anvil, or up over her head.
  const a = -Math.PI * 0.08 + lift * Math.PI * 0.86;
  const reach = 8.2;
  const hx = sx + Math.sin(a) * reach * 0.55 + (1 - lift) * 1.2;
  const hand = { x: hx, y: sy + Math.cos(a) * reach };
  const ex = (sx + hand.x) / 2 + 1.4;
  const ey = (sy + hand.y) / 2 + (lift > 0.5 ? 0 : 0.6);
  // The hammer: its haft from the hand, pointing up and back when raised, down onto the anvil when struck.
  const ha = a + Math.PI * 0.5 + (1 - lift) * 0.5;
  const head = { x: hand.x + Math.cos(ha) * -6.2, y: hand.y + Math.sin(ha) * -6.2 };
  const drawHammer = () => {
    c.part();
    c.line(hand.x, hand.y, head.x, head.y, WOOD, () => top(0), { bias: 1 });
    c.part();
    // The head, square-faced, crosswise to the haft.
    const px = -Math.sin(ha);
    const py = Math.cos(ha);
    for (let k = -2.5; k <= 2.5; k += 0.5) for (let w = -1.2; w <= 1.2; w += 0.5) c.px(head.x + px * k + Math.cos(ha) * w, head.y + py * k + Math.sin(ha) * w, IRON, sphere(px * k * 0.2, -py * k * 0.2 + 0.3), { bias: Math.abs(k) > 2 ? 1 : 0 });
  };
  // Raised, the hammer is behind her arm; down, it is in front.
  if (lift > 0.5) drawHammer();
  c.part();
  c.capsule(sx, sy, ex, ey, 2.2, 1.9, SHIRT);
  c.part();
  c.capsule(ex, ey, hand.x, hand.y, 1.8, 1.7, SKIN);
  c.part();
  c.ellipse(hand.x, hand.y, 2, 1.9, TAN);
  if (lift <= 0.5) drawHammer();
}

/** An anvil on its stump, drawn from its foot at (cx, foot): the horn to the west, the glowing bar on its face. */
function anvil(c: PixelCanvas, cx: number, foot: number, heat: number): void {
  // The stump: bark round it, its rings on top.
  c.part();
  c.shape(foot - 7, foot, (y) => [cx - 6.5 - (y > foot - 2 ? 0.8 : 0), cx + 6.5 + (y > foot - 2 ? 0.8 : 0)], STUMP, (_x, _y, t) => cyl(t, 0.1), {});
  for (let y = foot - 6; y <= foot; y++) for (const x of [cx - 4, cx - 1, cx + 2, cx + 5]) if (hash2(x, y, 901) > 0.4) c.shade(x, y, -1);
  c.part();
  c.ellipse(cx, foot - 7.5, 6.6, 2.2, RINGS, { normal: () => top(0) });
  c.part();
  c.ellipse(cx, foot - 7.5, 3.5, 1.2, RINGS, { normal: () => top(0), bias: -1 });
  // The anvil: its foot, waist, and the long face with the horn.
  const ay = foot - 9;
  c.part();
  c.shape(ay - 2, ay, (y) => [cx - (y === ay ? 5 : 4), cx + (y === ay ? 5 : 4)], IRON, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.shape(ay - 5, ay - 3, () => [cx - 2.5, cx + 2.5], IRON, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  c.part();
  c.shape(ay - 9, ay - 6, () => [cx - 5.5, cx + 7.5], IRON, (_x, y, t) => (y < ay - 7 ? top(t) : front(t)), { bias: 1 });
  c.part();
  c.shape(ay - 8, ay - 7, (y) => [cx - 10 + (y - ay + 8) * 1.5, cx - 5.5], IRON, (_x, y, t) => (y === ay - 8 ? top(t) : cyl(t, 0.3)));
  c.part();
  c.px(cx - 10.5, ay - 8, IRON, top(0), { bias: 1 });
  // The bar, glowing, a little hotter just after each blow.
  c.part();
  for (let x = STRIKE_AT.x - 5; x <= STRIKE_AT.x + 4; x++) {
    const tip = x > STRIKE_AT.x + 1;
    c.px(x, ay - 9, HOT, top(0), { bias: Math.round(heat * 2) + (tip ? 0 : -1), glow: 0.55 + heat * 0.4 });
    if (!tip || x === STRIKE_AT.x + 2) c.px(x, ay - 8, HOT, front(0), { bias: Math.round(heat * 2) - 2, glow: 0.4 + heat * 0.3 });
  }
}

/** Brenna at her anvil, frame `f`: raising her hammer, bringing it down on the glowing bar (on SMITH_STRIKE), and raising it again. */
export function smithFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(SMITH_W, SMITH_H);
  const lift = SWING[f];
  const since = (f - SMITH_STRIKE + SMITH_FRAMES) % SMITH_FRAMES;
  const heat = since < 3 ? 1 - since / 3 : 0;
  const breath = Math.sin((f / SMITH_FRAMES) * Math.PI * 2) * 0.3;
  // She stands just behind the anvil: her feet a few rows up the frame, hidden by it.
  brenna(c, SMITH_OX - 4, SMITH_OY - 6, lift, breath, true, true);
  anvil(c, SMITH_OX, SMITH_OY, heat);
  // The strike: a burst of sparks off the bar.
  if (f === SMITH_STRIKE) {
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI * (0.1 + (k / 8) * 0.8);
      const d = 2 + (k % 3) * 2;
      c.spark(STRIKE_AT.x + Math.cos(a) * d, STRIKE_AT.y - 1 + Math.sin(a) * d * 0.7, k % 2 ? [255, 230, 150] : [255, 170, 60], 1 - (k % 3) * 0.2);
    }
  } else if (since === 1) {
    for (let k = 0; k < 5; k++) c.spark(STRIKE_AT.x - 5 + k * 3, STRIKE_AT.y - 4 - (k % 2) * 2, [255, 170, 70], 0.5);
  }
  return c;
}

/** Brenna for her counter's portrait, frame `f`: standing easy, her hammer resting on her shoulder, breathing. */
export function smithPortrait(f: number): PixelCanvas {
  const c = new PixelCanvas(PORTRAIT_W, PORTRAIT_H);
  const breath = Math.sin((f / PORTRAIT_FRAMES) * Math.PI * 2) * 0.5;
  brenna(c, 15, 35, 0.78, breath, false, false);
  return c;
}

// ---------------------------------------------------------------- Outside: the barrel and the grindstone

export const YARD_W = 24;
export const YARD_H = 22;
export const YARD_OX = 12;
export const YARD_OY = 20;

/** A water barrel by the door: oak staves in iron hoops, full to the brim. */
export function barrelFrame(): PixelCanvas {
  const c = new PixelCanvas(YARD_W, YARD_H);
  const cx = YARD_OX;
  c.part();
  c.shape(6, 19, (y) => {
    const u = (y - 6) / 13;
    const hw = 5.2 + Math.sin(u * Math.PI) * 0.9;
    return [cx - hw, cx + hw];
  }, WOOD, (_x, _y, t) => cyl(t, 0.1));
  for (let y = 7; y <= 19; y++) for (let x = cx - 5; x <= cx + 5; x += 2) c.shade(x, y, -1);
  for (const hy of [8, 17]) {
    c.part();
    c.shape(hy, hy + 1, () => [cx - 6.2, cx + 6.2], IRON, (_x, _y, t) => cyl(t, 0.1), { bias: 1 });
  }
  c.part();
  c.ellipse(cx, 5.8, 5.4, 2, WOOD, { normal: () => top(0), bias: 1 });
  c.part();
  c.ellipse(cx, 6, 4.2, 1.3, WATER, { normal: () => ({ x: 0, y: 0.2, z: 0.98 }) });
  c.spark(cx - 2, 5.6, [220, 235, 255], 0.35);
  // A dipper hung on its rim.
  c.part();
  c.line(cx + 4, 4, cx + 7, 11, WOOD);
  c.part();
  c.ellipse(cx + 7.5, 12, 1.6, 1.3, IRON);
  return c;
}

/** A grindstone: a round whetstone on a wooden frame, its crank on the east, a treadle below. */
export function grindFrame(): PixelCanvas {
  const c = new PixelCanvas(YARD_W, YARD_H);
  const cx = YARD_OX;
  // The frame: two posts and rails, the treadle between.
  for (const lx of [cx - 7, cx + 7]) {
    c.part();
    c.capsule(lx, 8, lx, 19, 0.9, 1, WOOD);
  }
  c.part();
  c.shape(15, 16, () => [cx - 8, cx + 8], WOOD, (_x, y, t) => (y === 15 ? top(t) : front(t)));
  c.part();
  c.shape(18, 19, () => [cx - 4, cx + 5], WOOD, (_x, y, t) => (y === 18 ? top(t) : front(t)), { bias: 1 });
  // The stone, seen edge-on from the south: a wide wheel standing in the frame.
  c.part();
  c.shape(3, 15, (y) => {
    const dy = (y + 0.5 - 9) / 6.5;
    const hw = Math.sqrt(Math.max(0, 1 - dy * dy)) * 2.4;
    return [cx - hw, cx + hw];
  }, GRIT, (_x, y, t) => sphere(t * 0.9, (9 - y) / 7, 1));
  for (let y = 4; y <= 14; y += 2) c.shade(cx, y, -1);
  // The axle and the crank.
  c.part();
  c.line(cx - 7, 9, cx + 9, 9, IRON, () => cyl(0, 0.2));
  c.part();
  c.line(cx + 9, 9, cx + 10, 5, IRON);
  c.part();
  c.capsule(cx + 10, 5, cx + 10, 3, 0.8, 0.8, WOOD);
  return c;
}

// ---------------------------------------------------------------- Outside: the smithy

/**
 * The smithy from outside: FG_EXT_W x FG_EXT_H, bottom row at the front
 * wall's foot. Its roof of sooty clay tiles runs east to west, its back slope
 * falling toward the forest and its front slope toward the plaza; the great
 * chimney rises from the back slope over the hearth. The front wall is
 * fieldstone to the sills and timber framing above, the wide door open on the
 * firelit forge, a window beside it glowing orange, an iron sign with an
 * anvil on it, a lantern, a horseshoe over the door, ivy and bushes.
 */
export function forgeExterior(): PixelCanvas {
  const W = FG_EXT_W;
  const H = FG_EXT_H;
  const c = new PixelCanvas(W, H);
  const cx = W / 2;
  /** Art rows: where the footprint's back wall is, the ridge, and the eaves over the front wall. */
  const back = H - FG_H;
  const ridge = back + 26;
  const eaves = H - 42;
  const wallN: Vec3 = { x: 0, y: -0.45, z: 0.88 };
  /** Where the chimney stands, over the hearth. */
  const chx = 4 + F_HEARTH.x;

  // The roof: clay tiles in courses, the back slope facing the sky (and the light), the front slope the plaza.
  c.part();
  for (let y = back - 2; y <= eaves; y++) {
    const backSlope = y < ridge;
    const inset = y < back + 2 ? back + 2 - y : 0;
    for (let x = inset; x < W - inset; x++) {
      const t = (x + 0.5 - cx) / (W / 2);
      const n: Vec3 = backSlope ? { x: t * 0.1, y: 0.62, z: 0.78 } : { x: t * 0.1, y: -0.32, z: 0.95 };
      // Each tile a rounded pan: rows of them, each row offset by half a tile.
      const rowH = backSlope ? 3 : 5;
      const r0 = backSlope ? ridge - y : y - ridge;
      const row = Math.floor(r0 / rowH);
      const ly = r0 % rowH;
      const off = row % 2 ? 3 : 0;
      const lx = (x + off) % 6;
      let bias = Math.round((hash2(Math.floor((x + off) / 6), row, 911) - 0.5) * 2);
      // Each pan's curve: lit on its west side, shadowed on the east, a dark lip where the row above laps it.
      if (lx === 0) bias -= 2;
      else if (lx === 1) bias += 1;
      else if (lx === 5) bias -= 1;
      if (backSlope ? ly === 0 : ly === rowH - 1) bias -= 2;
      // Soot blown back from the chimney, and moss creeping in low on the slopes.
      const soot = Math.max(0, 1 - Math.hypot((x - chx) / 34, (y - back - 8) / 30)) * 3.4 * (0.6 + fbm(x, y, 5, 913, 2) * 0.8);
      bias -= Math.round(soot);
      const moss = fbm(x, y, 8, 915, 3) + (backSlope ? 0 : (y - ridge) / (eaves - ridge)) * 0.18 - 0.12;
      // Light catches the tiles near the ridge; lower down the front slope they sink into the eaves' shade.
      if (!backSlope) bias += (y - ridge < 8 ? 1 : 0) - Math.round(((y - ridge) / (eaves - ridge)) ** 2 * 1.6);
      if (moss > 0.72 && soot < 1) {
        c.px(x, y, BUSH, n, { bias: Math.round((fbm(x, y, 3, 917, 2) - 0.5) * 2) + (lx === 0 ? -1 : 0) });
        continue;
      }
      if (x - inset < 2 || W - inset - x <= 2) bias -= 1;
      c.px(x, y, ROOF_TILE, n, { bias });
    }
  }
  // The ridge: a row of capping tiles.
  c.part();
  for (let x = 2; x < W - 2; x += 4) c.ellipse(x + 2, ridge, 2.4, 1.8, ROOF_TILE, { bias: 1 - (hash2(x, 0, 919) > 0.7 ? 1 : 0) - Math.round(Math.max(0, 1 - Math.abs(x - chx) / 20) * 2) });
  // Bargeboards down the gable ends.
  c.part();
  for (let y = back - 1; y <= eaves + 1; y++) {
    for (const [x, s] of [
      [0, -1],
      [W - 1, 1],
    ] as [number, number][]) {
      c.px(x, y, WOOD, { x: s * 0.6, y: 0.1, z: 0.8 }, { bias: y === ridge ? 2 : 0 });
      c.px(x - s, y, WOOD, { x: s * 0.3, y: 0.1, z: 0.9 }, { bias: 1 });
    }
  }
  // The eaves: the tiles' lower edge overhanging the wall, casting it into shade.
  c.part();
  c.shape(eaves + 1, eaves + 2, () => [0, W], ROOF_TILE, (_x, y) => (y === eaves + 1 ? front(0) : front(0)), { bias: -1 });

  // The chimney: fieldstone, its top blackened and glowing faintly with the fire below, a lip of cap stones.
  const cTop = 2;
  const cBase = back + 20;
  c.part();
  masonry(c, chx - 9, chx + 9, cTop + 3, cBase, 4, 921, wallN);
  for (let y = cTop + 3; y < cTop + 12; y++) for (let x = chx - 9; x < chx + 9; x++) c.shade(x, y, -Math.round((cTop + 12 - y) / 3));
  c.part();
  c.shape(cBase - 1, cBase + 1, () => [chx - 10, chx + 10], ROOF_TILE, () => top(0), { bias: -2 });
  c.part();
  c.shape(cTop, cTop + 3, () => [chx - 10, chx + 10], FIELDSTONE, (_x, y, t) => (y < cTop + 2 ? top(t * 0.4) : front(t)), { bias: 1 });
  c.part();
  c.ellipse(chx, cTop + 1.3, 6, 1.4, SOOTY);
  c.part();
  for (let x = chx - 4; x <= chx + 4; x++) if (hash2(x, 1, 923) > 0.35) c.px(x, cTop + 1 + (hash2(x, 2, 925) > 0.5 ? 1 : 0), HEARTH, top(0), { bias: -2, glow: 0.45 });

  // The front wall: fieldstone below, timber framing and daub above.
  const wl = 4;
  const wr = W - 4;
  const sill = eaves + 22;
  c.part();
  for (let y = eaves + 3; y < sill; y++) {
    for (let x = wl; x < wr; x++) {
      const post = (x - wl) % 22 < 3 || x >= wr - 3;
      const rail = y < eaves + 5 || y >= sill - 2;
      const brace = Math.abs(((x - wl) % 22) - 3 - (y - eaves - 5) * 1.1) < 1.4 && (x - wl) % 22 >= 3;
      if (post || rail || brace) c.px(x, y, WOOD, wallN, { bias: rail && y < eaves + 5 ? -1 : (x + y) % 5 === 0 ? -1 : 0 });
      else c.px(x, y, PLASTER, wallN, { bias: Math.round((fbm(x, y, 4, 931, 2) - 0.5) * 2) - (y < eaves + 8 ? 1 : 0) });
    }
  }
  c.part();
  masonry(c, wl, wr, sill, H, 5, 933, wallN);
  // The eaves' shadow on the wall.
  for (let y = eaves + 3; y < eaves + 6; y++) for (let x = wl; x < wr; x++) c.shade(x, y, y < eaves + 4 ? -2 : -1);

  // The door: wide and square under a heavy lintel, its two leaves swung open on the forge's glow.
  const dr = F_DOOR_HW;
  const lintel = H - 34;
  c.part();
  for (let y = lintel; y < H; y++) {
    for (let x = cx - dr; x < cx + dr; x++) {
      const side = Math.abs(x + 0.5 - cx);
      if (side > dr - 3) {
        // The open leaves, planks and iron straps, seen edge-on against the jambs.
        const strap = (y - lintel) % 11 === 3;
        c.px(x, y, strap ? IRON : WOOD, { x: x < cx ? 0.6 : -0.6, y: -0.2, z: 0.78 }, { bias: strap ? 1 : (x - (cx - dr)) % 2 === 0 ? 0 : -1 });
        continue;
      }
      doorway(c, x, y, side, (y - lintel) / (H - lintel), H - 1 - y);
    }
  }
  c.part();
  c.shape(lintel - 3, lintel - 1, () => [cx - dr - 3, cx + dr + 3], WOOD, (_x, y, t) => (y === lintel - 3 ? top(t) : front(t)), { bias: 1 });
  for (const s of [-1, 1]) {
    c.part();
    c.shape(lintel - 1, H - 1, () => (s < 0 ? [cx - dr - 2, cx - dr] : [cx + dr, cx + dr + 2]), WOOD, (_x, _y, t) => cyl(t, 0.1), {});
  }
  // A horseshoe over the door, points up for luck.
  c.part();
  for (let a = 0.15; a <= Math.PI - 0.15; a += 0.2) c.px(cx + Math.cos(a) * 3, lintel - 6 + Math.sin(a) * 2.6, IRON, sphere(Math.cos(a) * 0.6, -Math.sin(a) * 0.4), { bias: 1 });

  // A window west of the door, its shutters open, orange with the fire behind it.
  const wx = 4 + F_HEARTH.x - 12;
  const wy = eaves + 9;
  c.part();
  for (let y = wy; y < wy + 10; y++) {
    for (let x = wx - 6; x < wx + 6; x++) {
      const mull = Math.abs(x + 0.5 - wx) < 1 || y === wy + 5;
      if (mull) c.px(x, y, WOOD, wallN, { bias: 1 });
      else c.px(x, y, HEARTH, { x: 0, y: 0, z: 1 }, { bias: Math.round((y - wy) / 4) - 1 + (hash2(x, y, 941) > 0.8 ? 1 : 0), glow: 0.6 });
    }
  }
  c.part();
  c.shape(wy - 1, wy + 10, () => [wx - 7, wx - 6], WOOD, () => wallN, { bias: -1 });
  c.shape(wy - 1, wy + 10, () => [wx + 6, wx + 7], WOOD, () => wallN, { bias: -1 });
  for (const s of [-1, 1]) {
    c.part();
    c.shape(wy - 1, wy + 10, () => (s < 0 ? [wx - 12, wx - 8] : [wx + 8, wx + 12]), OAK, () => ({ x: s * 0.4, y: -0.3, z: 0.86 }));
    for (let y = wy - 1; y <= wy + 10; y++) c.shade(s < 0 ? wx - 10 : wx + 10, y, -1);
  }
  c.part();
  c.shape(wy + 10, wy + 11, () => [wx - 8, wx + 8], WOOD, (_x, y, t) => (y === wy + 10 ? top(t) : front(t)), { bias: 1 });

  // The sign east of the door: an iron bracket, a board swinging from it with a gold anvil.
  const bx = cx + dr + 8;
  const by = eaves + 8;
  c.part();
  c.line(bx - 2, by, bx + 14, by, IRON, () => top(0), { bias: 1 });
  c.line(bx - 2, by + 4, bx + 3, by, IRON);
  c.part();
  c.line(bx + 5, by + 1, bx + 5, by + 2, IRON);
  c.line(bx + 12, by + 1, bx + 12, by + 2, IRON);
  c.part();
  c.shape(by + 3, by + 12, () => [bx + 3, bx + 15], WOOD, (_x, y, t) => (y === by + 3 ? top(t) : { x: t * 0.2, y: -0.2, z: 0.95 }), { bias: 1 });
  c.part();
  // The anvil on it, in gold paint.
  const ax = bx + 9;
  const ay = by + 7;
  c.shape(ay - 2, ay - 1, (y) => [ax - (y === ay - 2 ? 4 : 2), ax + 3], BRASS, () => wallN, { bias: 1 });
  c.shape(ay, ay + 1, () => [ax - 1, ax + 2], BRASS, () => wallN);
  c.shape(ay + 2, ay + 2, () => [ax - 2, ax + 3], BRASS, () => wallN);
  // Ivy up the west corner, bushes at the wall's foot, a lantern by the door.
  c.part();
  for (let y = eaves; y < H - 2; y++) {
    const reach = 2 + Math.floor(fbm(wl, y, 5, 951, 2) * 6);
    for (let k = 0; k < reach; k++) if (hash2(wl + k, y, 953) > 0.35) c.px(wl + k, y, BUSH, { x: 0, y: 0.2, z: 0.95 }, { bias: Math.round(hash2(k, y, 955) * 2) - (k > reach - 2 ? 1 : 0) });
  }
  const lx = cx - dr - 6;
  c.part();
  c.line(lx, lintel - 2, lx + 2, lintel - 2, IRON);
  c.part();
  c.capsule(lx, lintel, lx, lintel + 5, 1.8, 2.1, IRON);
  c.part();
  c.ellipse(lx, lintel + 2.5, 1.1, 1.7, HEARTH, { glow: 1 });
  for (const [bx2, r] of [
    [8, 6],
    [W - 9, 5],
  ]) {
    c.part();
    c.ellipse(bx2, H - 3, r, r * 0.6, BUSH, { flatten: 0.8 });
    for (let k = 0; k < 3; k++) if (hash2(bx2, k, 957) > 0.3) c.px(bx2 - r + 2 + hash2(k, bx2, 959) * (r * 2 - 4), H - 3 - r * 0.4 + hash2(bx2, k, 961) * 2, k % 2 ? GEM_FLOWER_PINK : GEM_FLOWER_GOLD, sphere(0, 0.5), { bias: 2 });
  }
  return c;
}

/** Rough-cut fieldstone courses between x0..x1 and y0..y1, each block its own tone, mortar dark. */
function masonry(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, rowH: number, seed: number, n: Vec3): void {
  for (let y = y0; y < y1; y++) {
    const row = Math.floor((y - y0) / rowH);
    const ly = (y - y0) % rowH;
    const off = Math.floor(hash2(row, 0, seed) * 12);
    for (let x = x0; x < x1; x++) {
      const bw = 8 + Math.floor(hash2(Math.floor((x + off) / 10), row, seed + 1) * 3) * 2;
      const lx = (x + off) % bw;
      let bias = Math.round((hash2(Math.floor((x + off) / bw), row, seed + 2) - 0.5) * 2.2 + (fbm(x, y, 5, seed + 3, 2) - 0.5) * 1.2);
      if (ly === rowH - 1 || lx === 0) bias = -3;
      else if (ly === 0) bias += 1;
      c.px(x, y, FIELDSTONE, n, { bias });
    }
  }
}
