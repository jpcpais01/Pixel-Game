// The farm and the kitchen's art: every crop at each of its four stages
// (lit, on the 'crops' sheet with its glow 'crops_e' and sun shadow
// 'crops_s', frames `<crop>_<stage>`), and the 16x16 icons the HUD, the
// build tray and the kitchen's counter show: seed packets `seed_<crop>`,
// produce `crop_<crop>`, fish to cook `fishi_<fish>`, dishes `dish_<recipe>`,
// and the touch button's `icon_harvest` and `icon_cook`.
//
// Crops are drawn the Home's way (art/homeProps.ts): from the high
// three-quarter view, standing on their tilled mound at the frame's foot,
// with normals so the sun and lamps play over them. The magic crops glow.

import type Phaser from 'phaser';
import { PixelCanvas, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { packAtlas, registerAtlas } from './atlas';
import { pixelCanvas } from './canvas';
import { hash2, rng } from './env';
import { CROPS, STAGES } from '../game/farm';
import { RECIPES } from '../game/recipes';
import { FISH, type FishDef } from '../game/fish';

/** A crop's frame, and where its foot (the mound's middle) is in it. */
export const CROP_W = 20;
export const CROP_H = 32;
export const CROP_FX = 10;
export const CROP_FY = 27;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const mat = (o: string, ...c: string[]): Material => ({ ramp: ramp(...c), outline: hex(o) });
const shiny = (m: Material): Material => ({ ...m, shine: true });
const glowing = (m: Material, g: number): Material => ({ ...m, emissive: g, noAO: true });

// ---------------------------------------------------------------- Materials

const TILL = mat('#080403', '#1a0f08', '#2a1a0f', '#3a2616', '#4c3320', '#5e412a', '#735236', '#886646');
const SEED = mat('#1a1006', '#6a5030', '#a08058', '#c8a878', '#e8d0a0');
const STAKE = mat('#1e140a', '#4a3420', '#634730', '#7e5c3e', '#9a744e', '#b58d60', '#cca674');
const TWINE = mat('#2a2010', '#6a5a38', '#9a8858', '#c4b280');
const FROND = mat('#0a1a06', '#14300c', '#22481a', '#336426', '#468232', '#5ea03e', '#7cbc4c', '#a0d468');
const CARROT = shiny(mat('#2a0c02', '#5a1c04', '#8a3008', '#b8480e', '#e06418', '#f88428', '#ffa850', '#ffc88a'));
const SPUD_LEAF = mat('#061206', '#0e2412', '#183a1e', '#225028', '#2e6832', '#3e803e', '#52984c', '#6ab05c');
const SPUD = mat('#1e1208', '#4a3218', '#6a4a26', '#8a6436', '#a88048', '#c49c62', '#dcb882', '#eed4a4');
const BLOSSOM = mat('#2a2438', '#7a70a0', '#a8a0c8', '#cec8e6', '#ece8fa', '#ffffff');
const BLADE = mat('#0e1a06', '#1e3410', '#2e4c18', '#426822', '#5a842e', '#76a03c', '#98bc54', '#b8d478');
const GRAIN = shiny(mat('#2e1802', '#663a06', '#9a5e10', '#c4861c', '#e0a42a', '#f2c040', '#fcdc6a', '#fff2a8'));
const STRAW = mat('#2a1c06', '#5a4214', '#86662a', '#a8863e', '#c6a456', '#dcc070', '#eedc96');
const VINE = mat('#0a1a08', '#163218', '#224a22', '#30622c', '#427c38', '#589646', '#72b058', '#90c86e');
const TOMATO = shiny(mat('#2a0404', '#5a0a08', '#8e1610', '#bc2418', '#e03a26', '#f45a3e', '#ff8a6a', '#ffc0a8'));
const TOMATO_GREEN = shiny(mat('#0e1a04', '#22380a', '#385612', '#4e741c', '#689228', '#86ae3a', '#a6c858'));
const TOMATO_TURN = shiny(mat('#2a1004', '#5a2808', '#8e4410', '#c0621a', '#e88228', '#ffa448', '#ffc878'));
const CABBAGE = mat('#0a1a10', '#163420', '#22482e', '#30603e', '#447a50', '#5a9464', '#78ae7a', '#9cc896', '#c4e0b8');
const CORN_LEAF = mat('#0a1c06', '#183812', '#26521c', '#386e26', '#4e8a32', '#68a63e', '#88c04e', '#a8d468');
const KERNEL = shiny(mat('#2a1a02', '#5a3a04', '#8c5e08', '#bc8810', '#e4b020', '#f8d040', '#ffe878', '#fff6b8'));
const HUSK = mat('#1a1e0a', '#3a4418', '#5a6626', '#7a8836', '#9aa84a', '#b8c262', '#d2d880', '#e8eca8');
const SILK = mat('#2a1408', '#5a3010', '#8a5020', '#b07034', '#cc9050', '#e0b070');
const BERRY_LEAF = mat('#061408', '#0e2812', '#163a1a', '#204e22', '#2c642c', '#3a7a36', '#4c9242', '#64aa52');
const BERRY = shiny(mat('#2a0208', '#5a0412', '#8e0a1e', '#c0142c', '#e42a3e', '#fa5058', '#ff8a86', '#ffc4c0'));
const BERRY_PALE = mat('#1a1a0e', '#4a5a2a', '#7a9048', '#a8c070', '#d0e0a0', '#eef4d0');
const PIP = { ...mat('#3a2a06', '#a08a30', '#d8c060', '#fff0a0'), noOutline: true };
const PETAL = mat('#3a3440', '#a8a4b0', '#d0ccd6', '#ecebf2', '#fafaff', '#ffffff');
const PETAL_Y = mat('#2a1802', '#5a3204', '#8a5006', '#b87210', '#e09a1c', '#f8c030', '#ffdc5e', '#fff09a');
const PUMPKIN = shiny(mat('#200a02', '#4a1a04', '#6e2806', '#94380a', '#b84c10', '#d6621a', '#ec7c2a', '#f89c48', '#ffbc78'));
const PUMPKIN_GREEN = shiny(mat('#0a1a08', '#1a3412', '#2a4e1c', '#3c6a26', '#548634', '#6ea444', '#8ebe5a'));
const PUMPKIN_LEAF = mat('#081a0c', '#123018', '#1c4622', '#285c2c', '#367438', '#468c44', '#5aa654', '#74c066');
const STEM = mat('#0a1006', '#1e2a10', '#34421a', '#4a5a24', '#627430', '#7c8e3e');
const PEPPER_LEAF = mat('#040a04', '#0a1a0c', '#122a14', '#1a3c1c', '#244e24', '#30622e', '#3e783a');
const EMBER = glowing(shiny(mat('#3a0802', '#7a1404', '#b42408', '#e43c10', '#ff6420', '#ff9440', '#ffc070', '#ffe8b0')), 0.75);
const EMBER_GREEN = shiny(mat('#0e1a04', '#203a0a', '#345412', '#4a701c', '#628c28', '#7ea838'));
const MOON_STEM = mat('#0a1418', '#1a2c34', '#2a4450', '#3c5c6a', '#527684', '#6c929e', '#8eb0ba', '#b4d0d6');
const MOON_LEAF = mat('#06141a', '#0e2630', '#183a46', '#224e5c', '#2e6472', '#3c7a88', '#4e909c');
const MOON_PETAL = glowing(mat('#1a2a4a', '#2c4a7a', '#4a72aa', '#76a2d4', '#a8ccf0', '#d4ecff', '#f4fbff'), 0.85);
const MOON_BUD = glowing(mat('#14202e', '#22385a', '#365480', '#4e72a4', '#6a92c4', '#8ab0dc'), 0.45);
const MOON_HEART = glowing({ ...mat('#4a4a20', '#c8c070', '#f0ecb0', '#fffbe0'), noOutline: true }, 1);

// For the icons.
const CERAMIC = mat('#14100e', '#4a3e38', '#6e625a', '#948880', '#b8aea4', '#d6cec4', '#ece6dc', '#faf6ee');
const CERAMIC_BLUE = mat('#060c1a', '#14244a', '#20386a', '#2e4e8a', '#4468a6', '#6086c0', '#88a8d6', '#b4ccea');
const WOODBOWL = mat('#120904', '#2a170c', '#3d2413', '#52311a', '#6a4122', '#83532c', '#9c6737', '#b57d46');
const IRON = shiny(mat('#04040a', '#0e0e16', '#1a1a24', '#282834', '#383846', '#4c4c5c', '#666678', '#8a8aa0'));
const GOLD = shiny(mat('#241404', '#4a300a', '#7a5212', '#a8761e', '#d29e30', '#f0c450', '#ffe486', '#fff6c8'));
const SOUP = mat('#3a1404', '#7a2c08', '#b04a12', '#dc6a1e', '#f48a34', '#ffaa58', '#ffca8a');
const CREAM = mat('#4a3e2a', '#a8946a', '#d8c69a', '#f0e4c0', '#fcf6e4', '#ffffff');
const BUTTER = shiny(mat('#4a3a04', '#a88a10', '#e0c030', '#f8e060', '#fff4a0', '#fffce0'));
const CRUST = shiny(mat('#1e0c04', '#4a2008', '#7a3a10', '#a8581c', '#cc7a2c', '#e49c44', '#f4bc64', '#fcd890'));
const LOAF_CUT = mat('#4a3418', '#a07c48', '#d0aa6c', '#ecc890', '#f8e0b0');
const BROTH_BROWN = mat('#1a0a04', '#3a1a0a', '#5a2c12', '#7a401c', '#985628', '#b26e38', '#c8884c');
const CHOWDER = mat('#4a3a1a', '#9a8240', '#ccb060', '#e8d07e', '#f6e6a4', '#fff6d0');
const CURRY = glowing(mat('#3a0802', '#7a1806', '#b42c0a', '#e04616', '#ff6a2a', '#ff964e', '#ffc07a'), 0.45);
const RICE = mat('#3a3a3e', '#a0a0a6', '#cacacf', '#e4e4e8', '#f6f6f8', '#ffffff');
const BROTH_MOON = glowing(mat('#14264a', '#244478', '#3a64a6', '#5c8ccc', '#8ab4e6', '#bcd8f6', '#e6f4ff'), 0.6);
const LEMON = shiny(mat('#3a3004', '#8a7208', '#c8a810', '#ecd020', '#fce850', '#fff8a0'));
const GRILL = { ...mat('#0a0606', '#1a0e0a', '#2a1810'), noOutline: true };
const PIE_FILL = mat('#3a1404', '#7a3008', '#ac4c10', '#d4681c', '#ec862e', '#f8a24a');
const PARSLEY = { ...mat('#0a1a06', '#1e4210', '#2e6418', '#44861e', '#5ea42a'), noOutline: true };
const STEAM = { ...mat('#a8a8b0', '#c8c8d0', '#e0e0e8', '#f4f4fa'), noOutline: true, noAO: true };
const WICKER = mat('#1e1006', '#4a2e14', '#6c461e', '#8e5e2a', '#ae783a', '#c8944e', '#deb066');
const KRAFT = mat('#1a1006', '#5a4024', '#7e5e38', '#9c7a4c', '#b89662', '#d0b07e', '#e4c89a');
const PAPER = mat('#2a2418', '#9a8e74', '#c8bea2', '#e4dcc4', '#f4eedc', '#fcf8ee');

/** A material made from a colour: shades from deep to pale round it. */
export function tintMat(tint: number, o: { shine?: boolean; glow?: number } = {}): Material {
  const c: RGB = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];
  const at = (k: number): RGB =>
    k < 0 ? (c.map((v) => Math.round(v * (1 + k))) as RGB) : (c.map((v) => Math.round(v + (255 - v) * k)) as RGB);
  const steps = [-0.78, -0.6, -0.42, -0.24, -0.08, 0.12, 0.34, 0.6];
  const m: Material = { ramp: steps.map(at), outline: at(-0.9), shine: o.shine };
  return o.glow ? glowing(m, o.glow) : m;
}

// ---------------------------------------------------------------- Helpers

const n3 = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};
const FACE: Vec3 = n3(0, -0.42, 0.9);
const TOP: Vec3 = n3(0, 0.45, 0.9);
const UP: Vec3 = n3(0, 0.2, 0.98);

/** A leaf from its base to its tip, widest a little past the base, a darker rib down its middle. */
function leaf(c: PixelCanvas, bx: number, by: number, tx: number, ty: number, w: number, m: Material, o: { bias?: number; rib?: boolean } = {}): void {
  const mx = bx + (tx - bx) * 0.38;
  const my = by + (ty - by) * 0.38;
  c.capsule(bx, by, mx, my, 0.45, w, m, { bias: o.bias ?? 0 });
  c.capsule(mx, my, tx, ty, w, 0.35, m, { bias: o.bias ?? 0 });
  if (o.rib === false || w < 1.2) return;
  const n = Math.ceil(Math.hypot(tx - bx, ty - by));
  for (let i = 1; i < n - 1; i++) c.shade(bx + ((tx - bx) * i) / n, by + ((ty - by) * i) / n, -1);
}

/** A stem: a 1 px line, rounded by its normal. */
function stem(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, m: Material, bias = 0): void {
  c.line(x0, y0, x1, y1, m, (i, n) => n3(-0.3 + (i / Math.max(1, n)) * 0.1, 0.2, 0.93), { bias });
}

/** A gently bowed stalk: from its foot, up `h` px, leaning `lean` px at the top. */
function stalk(c: PixelCanvas, x: number, y: number, h: number, lean: number, m: Material, bias = 0): { x: number; y: number } {
  let last = { x, y };
  for (let k = 0; k <= h; k++) {
    const t = k / h;
    const px = x + lean * t * t;
    const py = y - k;
    c.px(px, py, m, n3(lean * 0.2, 0.2, 0.95), { bias: bias + (k > h * 0.6 ? 1 : 0) });
    last = { x: px, y: py };
  }
  return last;
}

/** The tilled mound a crop stands in, crumbs of earth on it. */
function mound(c: PixelCanvas, cx: number, gy: number, seed: number, rx = 6.5, ry = 2.7): void {
  c.part();
  c.ellipse(cx, gy, rx, ry, TILL, { normal: (_x, _y, dx, dy) => n3(dx * 0.55, 0.55 - dy * 0.7, 0.8) });
  const R = rng(seed);
  for (let k = 0; k < 7; k++) {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R()) * 0.8;
    c.shade(cx + Math.cos(a) * rx * d, gy + Math.sin(a) * ry * d, R() < 0.55 ? -1 : 1);
  }
}

/** A wooden marker pushed into the back of the mound, a tag in the crop's colour on it. */
function marker(c: PixelCanvas, x: number, gy: number, tint: number): void {
  c.part();
  for (let y = gy - 8; y <= gy - 1; y++) c.px(x, y, STAKE, n3(-0.4, 0.1, 0.9), { bias: y === gy - 8 ? 1 : 0 });
  c.part();
  const tag = tintMat(tint);
  for (let y = gy - 8; y <= gy - 6; y++) for (let x2 = x - 1; x2 <= x + 2; x2++) c.px(x2, y, tag, FACE, { bias: y === gy - 8 ? 2 : x2 === x + 2 ? -1 : 1 });
  c.px(x, gy - 7, PAPER, FACE, { bias: 1 });
}

// ---------------------------------------------------------------- The crops

type CropDraw = (c: PixelCanvas, cx: number, gy: number, ripe: boolean) => void;

const carrot: CropDraw = (c, cx, gy, ripe) => {
  const R = rng(ripe ? 11 : 12);
  const h = ripe ? 13 : 9;
  if (ripe) {
    // Orange shoulders breaking the soil.
    c.part();
    c.ellipse(cx - 2, gy - 0.5, 2.4, 1.6, CARROT, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.4) });
    c.part();
    c.ellipse(cx + 2.5, gy + 0.6, 2, 1.3, CARROT, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.4) });
  }
  // Feathery fronds fanning up from the crown, each with little side leaflets.
  const fronds = ripe ? 7 : 5;
  for (let k = 0; k < fronds; k++) {
    c.part();
    const a = -Math.PI / 2 + (k / (fronds - 1) - 0.5) * 1.7 + (R() - 0.5) * 0.2;
    const len = h * (0.75 + R() * 0.3) * (1 - Math.abs(k / (fronds - 1) - 0.5) * 0.5);
    const bx = cx + (k % 2 ? 1 : -1) * 0.5 - (ripe ? 0 : 0);
    const by = gy - 1;
    const tx = bx + Math.cos(a) * len;
    const ty = by + Math.sin(a) * len;
    stem(c, bx, by, tx, ty, FROND, -1);
    for (let s = 3; s < len; s += 2) {
      const px = bx + Math.cos(a) * s;
      const py = by + Math.sin(a) * s;
      const side = (s / 2) % 2 ? 1 : -1;
      c.px(px + side * Math.cos(a + Math.PI / 2) * 1.2, py + side * Math.sin(a + Math.PI / 2) * 1.2, FROND, UP, { bias: 1 + (s > len * 0.6 ? 1 : 0) });
      c.px(px - side * Math.cos(a + Math.PI / 2), py - side * Math.sin(a + Math.PI / 2), FROND, UP, { bias: 0 });
    }
    c.px(tx, ty, FROND, UP, { bias: 2 });
  }
};

const potato: CropDraw = (c, cx, gy, ripe) => {
  const R = rng(ripe ? 21 : 22);
  if (ripe) {
    c.part();
    c.ellipse(cx + 4, gy + 0.8, 2.2, 1.5, SPUD, { flatten: 0.9 });
    c.part();
    c.ellipse(cx - 4.5, gy + 0.4, 1.8, 1.3, SPUD, { flatten: 0.9 });
  }
  // A low, round bush of leaves, back ones first.
  const n = ripe ? 13 : 8;
  const r = ripe ? 6 : 4.5;
  const top = ripe ? 9 : 6;
  const pts = Array.from({ length: n }, () => {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R());
    return { x: cx + Math.cos(a) * r * d, y: gy - 2 - top * 0.5 - Math.sin(a) * top * 0.45 * d - R() * 1.5 };
  }).sort((a, b) => a.y - b.y);
  for (const p of pts) {
    c.part();
    stem(c, cx, gy - 1, p.x, p.y + 1, STEM, -1);
    c.ellipse(p.x, p.y, 2.1, 1.5, SPUD_LEAF, { flatten: 0.8, bias: p.y < gy - top ? 1 : 0 });
    c.shade(p.x, p.y, -1);
  }
  if (ripe) {
    // Pale lilac flowers over the top, yellow at their hearts.
    for (const [fx, fy] of [[-2, -10], [2.5, -9], [0, -12]]) {
      c.part();
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) c.px(cx + fx + dx, gy + fy + dy, BLOSSOM, UP, { bias: 1 });
      c.px(cx + fx, gy + fy, PETAL_Y, UP, { bias: 2 });
    }
  }
};

const wheat: CropDraw = (c, cx, gy, ripe) => {
  const R = rng(ripe ? 31 : 32);
  const stalks = ripe ? [-4, -2, 0, 1.5, 3.5, 5] : [-3, -1, 1, 3, 4.5];
  for (const [k, sx] of stalks.entries()) {
    c.part();
    const h = ripe ? 13 + R() * 4 : 8 + R() * 3;
    const lean = (sx / 5) * (ripe ? 2.5 : 1.5) + (R() - 0.5);
    const top = stalk(c, cx + sx * 0.6, gy - 1 + (k % 2) * 0.8, h, lean, ripe ? STRAW : BLADE);
    // A blade leaf off the stalk.
    leaf(c, cx + sx * 0.6, gy - 3, cx + sx * 0.6 + (sx < 0 ? -3 : 3), gy - 7 - R() * 2, 0.7, ripe ? STRAW : BLADE, { bias: ripe ? -1 : 0 });
    if (!ripe) continue;
    // The ear: a plump, kernelled head, nodding with the stalk, its whiskers above.
    c.part();
    const ex = top.x + lean * 0.15;
    for (let j = 0; j < 6; j++) {
      const y = top.y - 1 + j - 5;
      // Kernels in two staggered rows, fattest in the middle of the head.
      const fat = j > 0 && j < 5 ? 1 : 0.5;
      c.px(ex - fat, y, GRAIN, n3(-0.6, 0.3, 0.75), { bias: j % 2 });
      c.px(ex, y, GRAIN, n3(0, 0.4, 0.9), { bias: 1 });
      c.px(ex + fat, y, GRAIN, n3(0.5, 0.3, 0.8), { bias: (j + 1) % 2 - 1 });
    }
    c.part();
    c.px(ex - 1 + (lean > 0 ? 1 : 0), top.y - 8, GRAIN, UP, { bias: 2 });
    c.px(ex + (lean > 0 ? 1 : 0), top.y - 9, GRAIN, UP, { bias: 1 });
  }
};

const tomato: CropDraw = (c, cx, gy, ripe) => {
  const R = rng(ripe ? 41 : 42);
  const h = ripe ? 18 : 14;
  // The cane it climbs, and the twine that ties it.
  c.part();
  for (let y = gy - h; y <= gy - 1; y++) c.px(cx + 3, y, STAKE, n3(-0.3, 0.1, 0.95), { bias: y === gy - h ? 1 : 0 });
  // The vine twisting up round the cane, leaves out to either side.
  c.part();
  let px = cx;
  for (let k = 1; k < h - 1; k++) {
    px = cx + 1.5 + Math.sin(k * 0.7) * 2.2;
    c.px(px, gy - k, VINE, n3(Math.cos(k * 0.7) * 0.5, 0.2, 0.85), { bias: -1 });
  }
  for (let k = 0; k < (ripe ? 6 : 5); k++) {
    c.part();
    const y = gy - 3 - k * (h - 5) / 5;
    const side = k % 2 ? 1 : -1;
    const bx = cx + 1.5 + Math.sin((gy - y) * 0.7) * 2.2;
    leaf(c, bx, y, bx + side * (4 + R() * 1.5), y - 1.5 - R(), 1.3, VINE, { bias: k > 3 ? 1 : 0 });
  }
  c.part();
  for (const y of [gy - 6, gy - 12]) c.px(cx + 3, y, TWINE, FACE, { bias: 2 });
  // Its fruit: green ones on the young plant; on the ripe one red, one still turning.
  const fruit = ripe
    ? [{ x: -3, y: -6, r: 2, m: TOMATO }, { x: 4.5, y: -9, r: 1.8, m: TOMATO }, { x: -2.5, y: -12, r: 1.7, m: TOMATO_TURN }, { x: 5, y: -4, r: 1.9, m: TOMATO }, { x: 0, y: -15, r: 1.5, m: TOMATO }]
    : [{ x: -2.5, y: -7, r: 1.2, m: TOMATO_GREEN }, { x: 4.5, y: -10, r: 1.1, m: TOMATO_GREEN }];
  for (const f of fruit) {
    c.part();
    c.ellipse(cx + f.x, gy + f.y, f.r, f.r * 0.95, f.m);
    c.part();
    c.px(cx + f.x, gy + f.y - f.r, VINE, UP, { bias: 1 });
  }
  if (!ripe) {
    c.part();
    for (const [fx, fy] of [[-3.5, -11], [1, -13]]) c.px(cx + fx, gy + fy, PETAL_Y, UP, { bias: 1 });
  }
};

const cabbage: CropDraw = (c, cx, gy, ripe) => {
  const s = ripe ? 1 : 0.7;
  const y = gy - 2 - (ripe ? 1.5 : 0.5);
  // Loose outer leaves splayed round, pale veins running out, then the tight head.
  for (let k = 0; k < 7; k++) {
    c.part();
    const a = (k / 7) * Math.PI * 2 + 0.4;
    c.ellipse(cx + Math.cos(a) * 3.4 * s, y + Math.sin(a) * 1.9 * s + 0.5, 3 * s, 2.1 * s, CABBAGE, { flatten: 0.6, bias: Math.sin(a) > 0 ? 0 : -1 });
    c.line(cx + Math.cos(a) * 1.4 * s, y + Math.sin(a) * 0.8 * s, cx + Math.cos(a) * 5.2 * s, y + Math.sin(a) * 3 * s + 0.4, CABBAGE, () => TOP, { bias: 2 });
  }
  c.part();
  c.ellipse(cx, y - 1.3 * s, 3.6 * s, 3.1 * s, CABBAGE, { bias: 1 });
  c.part();
  // The head's folded leaf edges.
  c.line(cx - 2.6 * s, y - 0.5 * s, cx + 0.4, y - 3.2 * s, CABBAGE, () => TOP, { bias: 3 });
  c.line(cx + 2.4 * s, y - 0.2, cx + 0.8, y - 3.6 * s, CABBAGE, () => TOP, { bias: 2 });
  if (ripe) c.line(cx - 1, y + 1.3, cx + 2, y + 0.8, CABBAGE, () => FACE, { bias: 1 });
};

const corn: CropDraw = (c, cx, gy, ripe) => {
  const h = ripe ? 24 : 14;
  // The stalk, jointed, a little thicker at its foot.
  c.part();
  for (let k = 0; k <= h; k++) {
    const x = cx + Math.sin(k * 0.12) * 0.6;
    c.px(x, gy - 1 - k, CORN_LEAF, n3(-0.35, 0.15, 0.92), { bias: k % 5 === 0 ? -1 : 0 });
    if (k < h * 0.4) c.px(x + 1, gy - 1 - k, CORN_LEAF, n3(0.5, 0.15, 0.85), { bias: -1 });
  }
  // Long, arching leaves from the joints, drooping at the tips.
  const joints = ripe ? [3, 7, 11, 15, 19] : [3, 6, 9, 12];
  for (const [k, j] of joints.entries()) {
    c.part();
    const side = k % 2 ? 1 : -1;
    const len = (ripe ? 8 : 6) - k * 0.6;
    const bx = cx + 0.5;
    const by = gy - 1 - j;
    for (let s = 0; s <= len; s++) {
      const t = s / len;
      const x = bx + side * s;
      const y = by - Math.sin(t * Math.PI * 0.75) * 3 + t * t * 2.5;
      c.px(x, y, CORN_LEAF, n3(side * 0.3, 0.5, 0.8), { bias: t < 0.5 ? 1 : 0 });
      if (t < 0.6) c.px(x, y + 1, CORN_LEAF, n3(side * 0.2, -0.1, 0.95), { bias: -1 });
    }
  }
  if (!ripe) return;
  // The tassel: golden sprays at the top.
  c.part();
  for (const [dx, dy] of [[-2, -1], [-1, -2], [0, -3], [1, -2], [2, -1], [0, -2]]) stem(c, cx, gy - 1 - h, cx + dx, gy - 1 - h + dy, GRAIN, dx === 0 ? 1 : 0);
  // An ear on the stalk: husk peeled back off golden kernels, silk at its tip.
  c.part();
  const ex = cx + 2.5;
  const ey = gy - 12;
  c.ellipse(ex, ey, 1.7, 3.5, HUSK, { flatten: 0.9 });
  c.part();
  for (let y = -2; y <= 2; y++) for (let x = 0; x <= 1; x++) c.px(ex - 0.5 + x, ey + y - 0.5, KERNEL, sphere(x ? 0.4 : -0.4, -y / 3), { bias: (x + y) % 2 === 0 ? 1 : 0 });
  c.part();
  c.line(ex - 1.5, ey + 3, ex - 2.5, ey - 1, HUSK, () => n3(-0.6, 0.2, 0.8));
  c.line(ex + 1.5, ey + 3, ex + 2.5, ey - 0.5, HUSK, () => n3(0.6, 0.2, 0.8), { bias: -1 });
  c.px(ex, ey - 4, SILK, UP, { bias: 1 });
  c.px(ex + 1, ey - 5, SILK, UP, { bias: 2 });
};

/** A strawberry leaf: three round leaflets on a stem, toothed by shading. */
function trefoil(c: PixelCanvas, x: number, y: number, s: number, m: Material, bias: number): void {
  for (const [dx, dy] of [[-1.6, 0.2], [1.6, 0.2], [0, -1.2]]) {
    c.ellipse(x + dx * s, y + dy * s, 1.6 * s, 1.2 * s, m, { flatten: 0.7, bias });
    c.shade(x + dx * s, y + dy * s, -1);
  }
}

const strawberry: CropDraw = (c, cx, gy, ripe) => {
  const leaves = ripe
    ? [[-3.5, -4, 1], [3.5, -4.5, 1], [0, -7, 1.1], [-1.5, -3, 0.9], [2.5, -2.5, 0.9]]
    : [[-2.5, -3.5, 0.9], [2.5, -4, 0.9], [0, -6, 1]];
  for (const [lx, ly, s] of leaves) {
    c.part();
    stem(c, cx, gy - 1, cx + lx, gy + ly + 1, STEM, -1);
    trefoil(c, cx + lx, gy + ly, s, BERRY_LEAF, ly < -5 ? 1 : 0);
  }
  if (!ripe) {
    // White flowers, yellow at the heart, and one green berry setting.
    for (const [fx, fy] of [[-4.5, -6], [4, -7]]) {
      c.part();
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) c.px(cx + fx + dx, gy + fy + dy, PETAL, UP, { bias: 1 });
      c.px(cx + fx, gy + fy, PETAL_Y, UP, { bias: 2 });
    }
    c.part();
    c.ellipse(cx + 5, gy - 1.5, 1, 1.3, BERRY_PALE);
    return;
  }
  // Ripe berries hanging over the leaves: pointed at the bottom, pips on them, green caps.
  for (const [bx, by, s] of [[-5, -1.5, 1], [4.5, -1, 1.1], [-1, 0.3, 0.9], [6, -5, 0.85]]) {
    c.part();
    c.shape(Math.round(gy + by - 1.6 * s), Math.round(gy + by + 1.8 * s), (y) => {
      const t = (y + 0.5 - (gy + by - 1.6 * s)) / (3.4 * s);
      const w = (t < 0.35 ? 0.75 + t : 1.1 - (t - 0.35) * 1.3) * 1.6 * s;
      return w > 0.2 ? [cx + bx - w, cx + bx + w] : null;
    }, BERRY, (_x, _y, t, u) => sphere(t * 0.8, 0.5 - u));
    c.part();
    c.px(cx + bx - 0.5, gy + by - 0.3, PIP, UP, { bias: 1 });
    c.px(cx + bx + 0.6, gy + by + 0.8, PIP, UP);
    c.px(cx + bx - 0.3, gy + by - 2, BERRY_LEAF, UP, { bias: 1 });
    c.px(cx + bx + 0.7, gy + by - 2, BERRY_LEAF, UP);
  }
};

/** A pumpkin of lobes, from the sides in, so the front lobe sits on top; its stem curling up. */
function pumpkinBody(c: PixelCanvas, x: number, y: number, s: number, m: Material): void {
  for (const o of [-3.6, 3.6, -1.9, 1.9, 0]) {
    c.part();
    c.ellipse(x + o * s, y, 2.6 * s, 3.2 * s * 0.85, m, { flatten: 0.9, bias: o === 0 ? 1 : 0 });
  }
  c.part();
  c.capsule(x, y - 2.6 * s, x + 0.8 * s, y - 4.4 * s, 0.9 * s, 0.6 * s, STEM);
}

const pumpkin: CropDraw = (c, cx, gy, ripe) => {
  const R = rng(ripe ? 61 : 62);
  // Broad leaves on the vine behind, and the vine's tendril.
  const leaves = ripe ? [[-5, -7], [4, -8], [0, -9.5], [7, -3]] : [[-4, -5], [3, -6], [0, -7.5]];
  for (const [lx, ly] of leaves) {
    c.part();
    stem(c, cx, gy - 1, cx + lx, gy + ly + 1, STEM, -1);
    c.ellipse(cx + lx, gy + ly, 2.8, 2, PUMPKIN_LEAF, { flatten: 0.7, bias: ly < -8 ? 1 : 0 });
    for (let k = 0; k < 3; k++) c.shade(cx + lx + (R() - 0.5) * 3, gy + ly + (R() - 0.5) * 2, -1);
  }
  c.part();
  for (let k = 0; k < 5; k++) c.px(cx - 7 + Math.cos(k * 1.3) * 1.2, gy - 2 - k * 0.6 + Math.sin(k * 1.3), STEM, UP, { bias: 1 });
  if (ripe) {
    pumpkinBody(c, cx + 0.5, gy - 2.5, 1.05, PUMPKIN);
    return;
  }
  // A small green pumpkin, and its yellow trumpet flower.
  pumpkinBody(c, cx + 1, gy - 1.5, 0.55, PUMPKIN_GREEN);
  c.part();
  c.ellipse(cx - 3, gy - 9, 1.6, 1.2, PETAL_Y, { bias: 1 });
  c.px(cx - 3, gy - 9, PETAL_Y, UP, { bias: -1 });
};

const emberpepper: CropDraw = (c, cx, gy, ripe) => {
  const R = rng(ripe ? 71 : 72);
  // A small, dark, glossy-leafed bush.
  const n = ripe ? 11 : 8;
  const pts = Array.from({ length: n }, () => {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R());
    return { x: cx + Math.cos(a) * 5 * d, y: gy - 6 - Math.sin(a) * 3.5 * d - (ripe ? 2 : 0) };
  }).sort((a, b) => a.y - b.y);
  for (const p of pts) {
    c.part();
    stem(c, cx, gy - 1, p.x, p.y + 1, STEM, -1);
    leaf(c, p.x, p.y, p.x + (p.x < cx ? -2.2 : 2.2), p.y - 1, 1, PEPPER_LEAF, { bias: p.y < gy - 9 ? 1 : 0, rib: false });
  }
  // Peppers hanging, curved and pointed: green on the young bush, glowing embers on the ripe one.
  const peppers = ripe ? [[-4, -6, 1], [3.5, -7, -1], [0, -4, 1], [5.5, -3.5, -1], [-2, -9.5, -1]] : [[-3, -5, 1], [3, -6, -1]];
  for (const [px, py, bend] of peppers) {
    c.part();
    const m = ripe ? EMBER : EMBER_GREEN;
    const len = ripe ? 4.5 : 3;
    c.capsule(cx + px, gy + py, cx + px + bend * 0.8, gy + py + len, ripe ? 1.1 : 0.8, 0.3, m);
    c.px(cx + px, gy + py - 1, STEM, UP, { bias: 1 });
    if (ripe) c.spark(cx + px - 0.5, gy + py + 1, [255, 200, 120], 0.6);
  }
  if (ripe) {
    // Embers drifting up off it.
    c.spark(cx - 1, gy - 14, [255, 150, 60], 0.8);
    c.spark(cx + 3, gy - 16, [255, 190, 90], 0.6);
    c.spark(cx - 4, gy - 13, [255, 120, 40], 0.5);
  }
};

/** A moonbloom flower: five pale petals round a bright heart, glowing. */
function bloom(c: PixelCanvas, x: number, y: number, r: number): void {
  c.part();
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
    c.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, r * 0.75, r * 0.6, MOON_PETAL, { flatten: 0.7, bias: Math.sin(a) < 0 ? 1 : 0 });
  }
  c.part();
  c.px(x, y, MOON_HEART, UP, { bias: 1 });
  c.spark(x, y, [220, 240, 255], 0.6);
}

const moonbloom: CropDraw = (c, cx, gy, ripe) => {
  // Silvery stems, slim leaves, and buds (or, ripe, open flowers shedding motes).
  const heads = ripe ? [[-3, -15, 2.1], [3.5, -12, 1.9], [0, -19, 2.3]] : [[-2, -10, 0], [2.5, -12, 0]];
  c.part();
  leaf(c, cx, gy - 1, cx - 5, gy - 5, 1, MOON_LEAF);
  leaf(c, cx, gy - 1, cx + 5, gy - 4, 1, MOON_LEAF, { bias: -1 });
  leaf(c, cx, gy - 2, cx - 3, gy - 8, 0.8, MOON_LEAF, { bias: 1 });
  for (const [hx, hy] of heads) {
    c.part();
    const n = Math.abs(hy);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      c.px(cx + hx * t * t, gy - 1 - k, MOON_STEM, n3(-0.3, 0.2, 0.93), { bias: t > 0.7 ? 1 : 0 });
    }
  }
  for (const [hx, hy, r] of heads) {
    if (ripe) bloom(c, cx + hx, gy - 1 + hy, r);
    else {
      c.part();
      c.ellipse(cx + hx, gy - 2 + hy, 1, 1.6, MOON_BUD);
    }
  }
  if (ripe) {
    c.spark(cx - 6, gy - 20, [180, 220, 255], 0.7);
    c.spark(cx + 6, gy - 17, [200, 230, 255], 0.5);
    c.spark(cx + 1, gy - 24, [220, 240, 255], 0.6);
  }
};

const DRAW: Record<string, CropDraw> = { carrot, potato, wheat, tomato, cabbage, corn, strawberry, pumpkin, emberpepper, moonbloom };
/** The two grass-like crops sprout in blades; the rest in a pair of seed leaves. */
const GRASSY = new Set(['wheat', 'corn']);
/** Each crop's leaf, for its sprout. */
const SPROUT: Record<string, Material> = { carrot: FROND, potato: SPUD_LEAF, wheat: BLADE, tomato: VINE, cabbage: CABBAGE, corn: CORN_LEAF, strawberry: BERRY_LEAF, pumpkin: PUMPKIN_LEAF, emberpepper: PEPPER_LEAF, moonbloom: MOON_LEAF };

/** One crop at one stage: 0 sown, 1 sprout, 2 young, 3 ripe. */
export function cropFrame(id: string, stage: number): PixelCanvas {
  const c = new PixelCanvas(CROP_W, CROP_H);
  const cx = CROP_FX;
  const gy = CROP_FY;
  const def = CROPS.find((d) => d.id === id)!;
  mound(c, cx, gy, hash2(id.length, stage, 7) * 1000);
  if (stage === 0) {
    // Seeds in a dimple, and the marker.
    c.shade(cx, gy, -2);
    c.shade(cx - 1, gy, -1);
    c.part();
    c.px(cx - 1, gy - 1, SEED, UP, { bias: 1 });
    c.px(cx + 1, gy, SEED, UP);
    marker(c, cx + 4, gy - 1, def.tint);
    return c;
  }
  if (stage === 1) {
    const m = SPROUT[id];
    c.part();
    if (GRASSY.has(id)) {
      stem(c, cx, gy - 1, cx - 2, gy - 6, m);
      stem(c, cx, gy - 1, cx, gy - 7, m, 1);
      stem(c, cx, gy - 1, cx + 2, gy - 5, m, -1);
    } else {
      stem(c, cx, gy - 1, cx, gy - 4, m, -1);
      c.part();
      c.ellipse(cx - 1.8, gy - 5, 1.9, 1.1, m, { flatten: 0.7, bias: 1 });
      c.ellipse(cx + 1.8, gy - 5.5, 1.9, 1.1, m, { flatten: 0.7 });
    }
    marker(c, cx + 5, gy - 1, def.tint);
    return c;
  }
  DRAW[id](c, cx, gy, stage === 3);
  return c;
}

// ---------------------------------------------------------------- Icons

const ICON = 16;

/** The harvested produce, drawn big for its icon. */
function produceIcon(id: string): PixelCanvas {
  const c = new PixelCanvas(ICON, ICON);
  switch (id) {
    case 'carrot': {
      // A carrot lying across, its leafy top up at the left.
      c.part();
      for (const [tx, ty] of [[2, 1], [4, 1], [1, 4]]) stem(c, 5, 5, tx, ty, FROND, 1);
      c.px(3, 2, FROND, UP, { bias: 2 });
      c.part();
      c.capsule(5.5, 5.5, 13, 13, 2.6, 0.5, CARROT);
      for (const k of [7, 9.5, 11.5]) c.shade(k + 0.5, k - 0.5, -2);
      break;
    }
    case 'potato':
      c.part();
      c.ellipse(10, 9, 4.5, 3.6, SPUD, { flatten: 0.9 });
      c.part();
      c.ellipse(5.5, 11, 3.6, 2.9, SPUD, { flatten: 0.9 });
      for (const [x, y] of [[9, 8], [12, 10], [4, 11], [6, 10]]) c.shade(x, y, -2);
      break;
    case 'wheat': {
      // A sheaf of three ears, tied with twine.
      for (const [k, lean] of [-2.5, 0, 2.5].entries()) {
        c.part();
        stalk(c, 8 + lean * 0.4, 15, 9, lean, STRAW, 1);
        c.part();
        for (let j = 0; j < 5; j++) {
          c.px(8 + lean * 1.1 - 0.5, 5 - j - k % 2, GRAIN, n3(-0.5, 0.3, 0.8), { bias: j % 2 });
          c.px(8 + lean * 1.1 + 0.5, 5 - j - k % 2, GRAIN, n3(0.4, 0.3, 0.85), { bias: (j + 1) % 2 - 1 });
        }
      }
      c.part();
      for (let x = 6; x <= 10; x++) c.px(x, 11, TWINE, FACE, { bias: x === 6 ? 1 : 0 });
      break;
    }
    case 'tomato':
      c.part();
      c.ellipse(8, 9.5, 5.6, 5, TOMATO);
      c.shade(8, 5.5, -1);
      c.part();
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -1], [-1, 1], [1, 1]]) c.px(8 + dx, 5 + dy, VINE, UP, { bias: 1 });
      c.px(8, 3, VINE, UP, { bias: 1 });
      break;
    case 'cabbage': {
      const k = cabbage;
      k(c, 8, 13, true);
      break;
    }
    case 'corn':
      c.part();
      c.capsule(5, 13, 11, 3, 3, 2, KERNEL);
      for (let y = 3; y < 14; y++) for (let x = 2; x < 14; x++) if (c.materialAt(x, y) === KERNEL && (x + y) % 2 === 0) c.shade(x, y, -1);
      c.part();
      c.line(3, 14, 3, 7, HUSK, () => n3(-0.6, 0.2, 0.8), { bias: 1 });
      c.line(4, 14, 3, 9, HUSK, () => n3(-0.4, 0.2, 0.8));
      c.line(8, 14, 12, 9, HUSK, () => n3(0.6, 0.2, 0.8), { bias: -1 });
      c.line(7, 14, 10, 11, HUSK, () => n3(0.4, 0.2, 0.8));
      c.part();
      c.px(11, 1, SILK, UP, { bias: 1 });
      c.px(12, 2, SILK, UP);
      break;
    case 'strawberry':
      c.part();
      c.shape(4, 15, (y) => {
        const t = (y + 0.5 - 4) / 11;
        const w = (t < 0.3 ? 4.2 + t * 4 : 5.4 - (t - 0.3) * 7.2);
        return w > 0.3 ? [8 - w, 8 + w] : null;
      }, BERRY, (_x, _y, t, u) => sphere(t * 0.85, 0.55 - u));
      c.part();
      for (const [x, y] of [[6, 7], [10, 7], [8, 9], [5, 10], [11, 10], [7, 12], [9, 12], [8, 6]]) c.px(x, y, PIP, UP, { bias: (x + y) % 2 });
      c.part();
      for (const [dx, dy] of [[-3, 1], [-1, 0], [1, 0], [3, 1], [0, -1]]) c.px(8 + dx, 3 + dy, BERRY_LEAF, UP, { bias: 1 });
      c.px(8, 1, STEM, UP);
      break;
    case 'pumpkin':
      pumpkinBody(c, 8, 10, 1.25, PUMPKIN);
      break;
    case 'emberpepper':
      c.part();
      c.capsule(6, 4, 11, 14, 2.6, 0.4, EMBER);
      c.part();
      c.capsule(5, 4, 4, 1, 0.8, 0.6, STEM);
      c.px(6, 3, PEPPER_LEAF, UP, { bias: 1 });
      c.px(7, 3, PEPPER_LEAF, UP);
      break;
    case 'moonbloom':
      c.part();
      stem(c, 8, 15, 8, 10, MOON_STEM);
      leaf(c, 8, 14, 3, 12, 1, MOON_LEAF);
      bloom(c, 8, 6.5, 3);
      break;
  }
  return c;
}

/** A tiny picture of the crop for its seed packet's window. */
function packetPicture(c: PixelCanvas, id: string, x: number, y: number): void {
  c.part();
  switch (id) {
    case 'carrot':
      c.capsule(x - 1, y - 1, x + 1.5, y + 2.5, 1.4, 0.3, CARROT);
      c.px(x - 2, y - 2, FROND, UP, { bias: 1 });
      c.px(x - 1, y - 3, FROND, UP, { bias: 1 });
      break;
    case 'potato':
      c.ellipse(x, y + 0.5, 2.4, 1.8, SPUD);
      break;
    case 'wheat':
      for (let k = -2; k <= 1; k++) c.px(x, y + k, GRAIN, UP, { bias: k % 2 });
      c.px(x - 1, y - 1, GRAIN, UP);
      c.px(x + 1, y, GRAIN, UP, { bias: -1 });
      c.px(x, y + 2, STRAW, UP);
      break;
    case 'tomato':
    case 'cabbage':
    case 'pumpkin':
      c.ellipse(x, y + 0.5, 2.3, 2, id === 'tomato' ? TOMATO : id === 'cabbage' ? CABBAGE : PUMPKIN);
      c.part();
      c.px(x, y - 1.5, id === 'cabbage' ? CABBAGE : STEM, UP, { bias: 2 });
      break;
    case 'corn':
      c.ellipse(x, y, 1.3, 2.6, KERNEL);
      c.part();
      c.px(x - 1.5, y + 2, HUSK, UP);
      c.px(x + 1.5, y + 2, HUSK, UP, { bias: -1 });
      break;
    case 'strawberry':
      c.ellipse(x, y + 0.5, 2, 2.2, BERRY);
      c.part();
      c.px(x, y - 1.5, BERRY_LEAF, UP, { bias: 1 });
      c.px(x - 0.5, y + 0.5, PIP, UP);
      break;
    case 'emberpepper':
      c.capsule(x - 1, y - 2, x + 1, y + 2.5, 1.3, 0.3, EMBER);
      break;
    case 'moonbloom':
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
        c.px(x + Math.round(Math.cos(a) * 1.6), y + Math.round(Math.sin(a) * 1.6), MOON_PETAL, UP, { bias: 1 });
      }
      c.px(x, y, MOON_HEART, UP);
      break;
  }
}

/** A seed packet: folded kraft paper, a band in the crop's colour, its picture in a window, seeds spilling out. */
function seedIcon(id: string): PixelCanvas {
  const def = CROPS.find((d) => d.id === id)!;
  const c = new PixelCanvas(ICON, ICON);
  const band = tintMat(def.tint);
  c.part();
  for (let y = 2; y <= 14; y++) {
    for (let x = 3; x <= 12; x++) {
      // A crimped top edge, and a slight bulge.
      if (y === 2 && x % 2) continue;
      const m = y >= 4 && y <= 5 ? band : KRAFT;
      c.px(x, y, m, n3((x - 7.5) * 0.08, y < 4 ? 0.5 : -0.2, 0.9), { bias: x === 3 ? 1 : x === 12 ? -1 : y === 14 ? -1 : 0 });
    }
  }
  // The window with the picture in it.
  c.part();
  for (let y = 7; y <= 12; y++) for (let x = 5; x <= 10; x++) c.px(x, y, PAPER, FACE, { bias: y === 7 ? 1 : 0 });
  packetPicture(c, id, 7.5, 9.5);
  // Seeds spilling out at the corner.
  c.part();
  c.px(13, 14, SEED, UP, { bias: 1 });
  c.px(14, 13, SEED, UP);
  c.px(14, 15, SEED, UP, { bias: -1 });
  return c;
}

/** A fish ready for the pot: its own colours, a fin, a tail and an eye; the glowing ones glow. */
function fishIcon(f: FishDef): PixelCanvas {
  const c = new PixelCanvas(ICON, ICON);
  const body = tintMat(f.tint, { shine: true, glow: f.glow ? 0.5 : 0 });
  const fin = tintMat(f.tint);
  const legend = f.rarity === 'legendary';
  c.part();
  // Tail first, behind: a forked fan at the right.
  for (let k = 0; k < 4; k++) {
    c.px(12 + k * 0.6, 8 - k, fin, FACE, { bias: -1 });
    c.px(12 + k * 0.6, 8 + k, fin, FACE, { bias: -2 });
    c.px(12, 8 + (k - 1.5), fin, FACE, { bias: -1 });
  }
  c.part();
  // The dorsal fin.
  for (let x = 5; x <= 9; x++) c.px(x, 4 + Math.abs(x - 7) * 0.4, fin, UP, { bias: 0 });
  c.part();
  c.ellipse(7.5, 8.5, legend ? 5.6 : 5.2, legend ? 3.4 : 2.9, body, { flatten: 0.9 });
  // A pale belly, gill line and eye.
  for (let x = 4; x <= 10; x++) c.shade(x, 10, 1);
  c.shade(5, 7, -1);
  c.shade(5, 8, -1);
  c.shade(5, 9, -1);
  c.part();
  c.px(3.5, 7.5, IRON, FACE, { bias: 2 });
  if (legend) {
    c.part();
    c.px(8, 4, GOLD, UP, { bias: 2 });
    c.px(6, 4, GOLD, UP, { bias: 1 });
  }
  return c;
}

/** A bowl at (x, y) (its rim's middle), `rx` across, filled with `fill`, in ceramic `m`. */
function bowl(c: PixelCanvas, x: number, y: number, rx: number, fill: Material, m: Material = CERAMIC): void {
  c.part();
  // The bowl's side, rounding down to a foot.
  c.shape(Math.round(y), Math.round(y + rx * 0.75), (yy) => {
    const t = (yy + 0.5 - y) / (rx * 0.75);
    const w = rx * Math.sqrt(Math.max(0, 1 - t * t * 0.75));
    return [x - w, x + w];
  }, m, (_x, _y, t, u) => n3(t * 0.8, -0.3 - u * 0.4, 0.8));
  c.part();
  c.ellipse(x, y, rx, rx * 0.36, m, { normal: () => TOP, bias: 2 });
  c.part();
  c.ellipse(x, y, rx - 1.2, rx * 0.36 - 0.7, fill, { normal: (_x, _y, dx, dy) => n3(dx * 0.2, 0.5 - dy * 0.2, 0.85) });
}

/** A plate seen from above-front: a flat ellipse with a rim. */
function plate(c: PixelCanvas, x: number, y: number, rx: number, m: Material = CERAMIC): void {
  c.part();
  c.ellipse(x, y + 0.6, rx, rx * 0.45, m, { normal: () => FACE, bias: -1 });
  c.part();
  c.ellipse(x, y, rx, rx * 0.42, m, { normal: () => TOP, bias: 1 });
  c.part();
  c.ellipse(x, y, rx - 1.5, rx * 0.42 - 1, m, { normal: () => TOP, bias: 2 });
}

/** A curl of steam rising off a hot dish. */
function steam(c: PixelCanvas, x: number, y: number): void {
  c.part();
  for (let k = 0; k < 4; k++) c.px(x + Math.round(Math.sin(k * 1.4)), y - k, STEAM, FLATN, { bias: 3 - k });
}
const FLATN: Vec3 = { x: 0, y: 0, z: 1 };

function dishIcon(id: string): PixelCanvas {
  const c = new PixelCanvas(ICON, ICON);
  switch (id) {
    case 'soup':
      bowl(c, 8, 8, 6.5, SOUP);
      c.part();
      c.px(6, 8, CREAM, UP, { bias: 1 });
      c.px(7, 8, CREAM, UP);
      c.px(9, 7, PARSLEY, UP, { bias: 1 });
      c.px(10, 8, PARSLEY, UP);
      steam(c, 6, 5);
      steam(c, 10, 4);
      break;
    case 'potato':
      plate(c, 8, 11, 7);
      c.part();
      c.ellipse(8, 9, 4.6, 3, SPUD, { flatten: 0.9 });
      c.part();
      c.ellipse(8, 8.2, 3, 1.3, LOAF_CUT, { normal: () => TOP });
      c.part();
      c.px(8, 7, BUTTER, UP, { bias: 2 });
      c.px(9, 7, BUTTER, UP, { bias: 1 });
      c.px(8, 8, BUTTER, UP);
      c.px(6, 8, PARSLEY, UP);
      steam(c, 9, 5);
      break;
    case 'bread':
      c.part();
      c.ellipse(8, 9.5, 6.5, 4.2, CRUST, { flatten: 0.9 });
      // Its scored top, pale in the cuts.
      c.part();
      for (const sx of [-3, 0, 3]) {
        c.px(8 + sx, 7, LOAF_CUT, UP, { bias: 1 });
        c.px(8 + sx + 1, 8, LOAF_CUT, UP);
      }
      steam(c, 5, 5);
      break;
    case 'salad':
      bowl(c, 8, 8, 6.5, BERRY_LEAF, WOODBOWL);
      c.part();
      for (const [x, y, m] of [[5, 7, CABBAGE], [7, 6, BERRY_LEAF], [10, 7, CABBAGE], [6, 8, TOMATO], [9, 8, CARROT], [11, 8, TOMATO], [8, 7, CARROT], [8, 5, CABBAGE]] as const) {
        c.ellipse(x, y, 1.2, 0.9, m, { bias: 1 });
      }
      break;
    case 'grilled': {
      plate(c, 8, 11, 7.2);
      // The perch, browned on the grill.
      c.part();
      c.ellipse(8, 9, 5, 2.5, CRUST, { flatten: 0.9 });
      for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) c.px(5 + k * 2 + j * 0.5, 8 + j - 0.5, GRILL, UP);
      c.part();
      for (let k = 0; k < 3; k++) c.px(13 + k * 0.5, 9 - 1 + k, CRUST, FACE, { bias: -1 });
      c.px(4, 8, IRON, FACE, { bias: 2 });
      c.part();
      c.ellipse(11.5, 12, 1.6, 1, LEMON);
      break;
    }
    case 'stew':
      bowl(c, 8, 8, 6.5, BROTH_BROWN, CERAMIC_BLUE);
      c.part();
      for (const [x, y, m] of [[6, 8, CARROT], [9, 7, SPUD], [10, 8, CARROT], [7, 7, SPUD], [8, 8, CREAM]] as const) c.px(x, y, m, UP, { bias: 1 });
      steam(c, 7, 5);
      steam(c, 11, 4);
      break;
    case 'chowder':
      bowl(c, 8, 8, 6.5, CHOWDER);
      c.part();
      for (const [x, y] of [[6, 8], [8, 7], [10, 8], [9, 9], [7, 9]]) c.px(x, y, KERNEL, UP, { bias: 1 });
      c.px(5, 8, PARSLEY, UP);
      steam(c, 9, 5);
      break;
    case 'tart':
      c.part();
      c.ellipse(8, 10, 7, 3.6, CRUST, { normal: () => FACE, bias: -1 });
      c.part();
      c.ellipse(8, 9, 7, 3.4, CRUST, { normal: () => TOP, bias: 1 });
      c.part();
      c.ellipse(8, 9, 5.5, 2.4, CREAM, { normal: () => TOP });
      for (const [x, y] of [[5, 9], [8, 8], [11, 9], [7, 10], [10, 10], [8, 9.5]]) {
        c.part();
        c.ellipse(x, y - 0.5, 1.3, 1.1, BERRY);
      }
      break;
    case 'pie':
      c.part();
      c.ellipse(8, 10.5, 7, 3.4, CERAMIC, { normal: () => FACE, bias: -1 });
      c.part();
      c.ellipse(8, 9.3, 6.6, 3.3, CRUST, { normal: () => TOP, bias: 1 });
      c.part();
      c.ellipse(8, 9.3, 5.2, 2.3, PIE_FILL, { normal: () => TOP });
      // A wedge cut out, and a dollop of cream.
      c.part();
      for (let y = 9; y <= 12; y++) for (let x = 9; x <= 14; x++) if (x - 9 >= (y - 9) * 1.4) c.erase(x, y);
      c.part();
      c.ellipse(6.5, 8, 1.5, 1.1, CREAM, { bias: 1 });
      break;
    case 'curry':
      bowl(c, 8, 8, 6.5, CURRY);
      c.part();
      c.ellipse(5.5, 7.5, 2.2, 1.2, RICE, { bias: 1 });
      c.part();
      c.px(10, 7, EMBER, UP, { bias: 1 });
      c.px(9, 8, PARSLEY, UP);
      steam(c, 8, 5);
      steam(c, 11, 4);
      break;
    case 'broth':
      bowl(c, 8, 8, 6.5, BROTH_MOON, CERAMIC_BLUE);
      c.part();
      // A moonbloom petal floating, and a crescent of light on the surface.
      c.px(7, 8, MOON_PETAL, UP, { bias: 2 });
      c.px(8, 8, MOON_PETAL, UP, { bias: 1 });
      c.px(10, 7, MOON_HEART, UP);
      break;
    case 'feast':
      // A golden platter: the Goldmaw, a pumpkin and corn round it.
      plate(c, 8, 11, 7.6, GOLD);
      c.part();
      c.ellipse(13, 8, 2.2, 2.3, PUMPKIN);
      c.part();
      c.capsule(2, 10, 4, 7, 1.2, 1, KERNEL);
      c.part();
      c.ellipse(8, 9.5, 4.6, 2.4, GOLD, { flatten: 0.9 });
      for (let k = 0; k < 3; k++) c.px(12 + k * 0.4, 9 - 1 + k, GOLD, FACE, { bias: -1 });
      c.px(4.5, 9, IRON, FACE, { bias: 2 });
      c.part();
      c.px(7, 7, PARSLEY, UP, { bias: 1 });
      c.px(9, 7, PARSLEY, UP);
      steam(c, 6, 5);
      break;
  }
  return c;
}

/** The touch button's harvest: a wicker basket brimming with produce. */
function basketIcon(): PixelCanvas {
  const c = new PixelCanvas(ICON, ICON);
  c.part();
  for (let x = 3; x <= 12; x++) c.px(x, 4 + Math.round(Math.abs(x - 7.5) * 0.35 - 2.5) + 2, WICKER, UP, { bias: 1 });
  c.part();
  c.ellipse(5, 8, 2, 1.8, TOMATO);
  c.ellipse(10.5, 8, 2.1, 1.7, CABBAGE);
  c.part();
  c.capsule(7, 7, 9, 10, 1.3, 0.5, CARROT);
  c.px(6, 6, FROND, UP, { bias: 1 });
  c.part();
  for (let y = 9; y <= 14; y++) {
    const w = 6.5 - (y - 9) * 0.35;
    for (let x = Math.round(7.5 - w); x <= 7.5 + w; x++) c.px(x, y, WICKER, n3((x - 7.5) * 0.1, -0.3, 0.9), { bias: (x + y) % 2 ? 1 : -1 });
  }
  return c;
}

/** The touch button's cook: a black pot over a flame, steaming. */
function potIcon(): PixelCanvas {
  const c = new PixelCanvas(ICON, ICON);
  c.part();
  c.ellipse(8, 9.5, 5.6, 4.2, IRON);
  c.part();
  c.ellipse(8, 6.5, 5.4, 1.6, IRON, { normal: () => TOP, bias: 2 });
  c.part();
  c.ellipse(8, 6.5, 4.2, 1, SOUP, { normal: () => TOP });
  c.part();
  for (let x = 6; x <= 10; x++) c.px(x, 15, EMBER, UP, { bias: x % 2 });
  c.px(8, 14, EMBER, UP, { bias: 2 });
  steam(c, 6, 4);
  steam(c, 10, 3);
  return c;
}

// ---------------------------------------------------------------- Textures

/** The crops' sheet and every farm and kitchen icon. Cheap, and made once: the drops and the hotbar need them everywhere. */
export function warmFarm(scene: Phaser.Scene): void {
  if (scene.textures.exists('crops')) return;
  const frames = CROPS.flatMap((d) => Array.from({ length: STAGES }, (_, s) => ({ name: `${d.id}_${s}`, r: cropFrame(d.id, s).render() })));
  registerAtlas(scene, 'crops', packAtlas(frames, CROP_W, CROP_H, 8), CROP_W, CROP_H);
  const icon = (key: string, c: PixelCanvas) => {
    const r = c.render();
    // The icons are drawn unlit, so what glows is brightened into them.
    const px = new Uint8ClampedArray(r.diffuse);
    for (let i = 0; i < px.length; i += 4) {
      if (!r.emissive[i + 3]) continue;
      for (let k = 0; k < 3; k++) px[i + k] = Math.min(255, px[i + k] + r.emissive[i + k] * 0.35);
      if (!px[i + 3]) px[i + 3] = Math.min(255, Math.max(r.emissive[i], r.emissive[i + 1], r.emissive[i + 2]));
    }
    scene.textures.addCanvas(key, pixelCanvas(ICON, ICON, px));
  };
  for (const d of CROPS) {
    icon(`seed_${d.id}`, seedIcon(d.id));
    icon(`crop_${d.id}`, produceIcon(d.id));
  }
  for (const f of FISH) icon(`fishi_${f.id}`, fishIcon(f));
  for (const r of RECIPES) icon(`dish_${r.id}`, dishIcon(r.id));
  icon('icon_harvest', basketIcon());
  icon('icon_cook', potIcon());
}

/** For the art script: every icon by name. */
export function farmIcons(): { name: string; c: PixelCanvas }[] {
  return [
    ...CROPS.map((d) => ({ name: `seed_${d.id}`, c: seedIcon(d.id) })),
    ...CROPS.map((d) => ({ name: `crop_${d.id}`, c: produceIcon(d.id) })),
    ...FISH.map((f) => ({ name: `fishi_${f.id}`, c: fishIcon(f) })),
    ...RECIPES.map((r) => ({ name: `dish_${r.id}`, c: dishIcon(r.id) })),
    { name: 'icon_harvest', c: basketIcon() },
    { name: 'icon_cook', c: potIcon() },
  ];
}
