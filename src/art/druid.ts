// Materials, spell colours and button icons for the Druid. The figure itself
// is drawn by the wizard's rig (wizard.ts), switched by its `head`: 'grove'
// for the Grovekeeper and 'wild' for the Shapeshifter.

import { hex, type Material, type RGB } from './pixel';
import type { SpellColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// The Grovekeeper: a hood of moss with antlers growing through it, a mantle of
// leaves, a robe hemmed with leaves and fireflies, and a living staff whose
// twigs cradle a glowing seed.

export const MOSS: Material = {
  ramp: ramp('#131d0e', '#1f3217', '#2f4c24', '#456c33', '#628f46'),
  outline: hex('#070b05'),
  outlineLit: hex('#141f0e'),
};

/** The hood's lining, round the face: old bark. */
export const BARK: Material = {
  ramp: ramp('#1a120c', '#2c1e14', '#40301f', '#56432c'),
  outline: hex('#0a0604'),
};

/** Young leaves, gold-green: the hem, the mantle's edge and the staff's twigs. */
export const LEAF: Material = {
  ramp: ramp('#34520f', '#62861c', '#9fbe36', '#dbe775'),
  outline: hex('#121c05'),
  outlineLit: hex('#1f2d0a'),
};

export const ANTLER: Material = {
  ramp: ramp('#56432f', '#86694a', '#b89e76', '#e8dab6'),
  outline: hex('#1c1309'),
  outlineLit: hex('#2c1f10'),
  shine: true,
};

/** Wood that still grows: dark bark with a green cast. */
export const LIVEWOOD: Material = {
  ramp: ramp('#241a10', '#43301d', '#654a2c', '#8a6c44'),
  outline: hex('#0f0905'),
};

export const SEED: Material = {
  ramp: ramp('#2f7a24', '#7ed447', '#d4ff86', '#fbffe6'),
  outline: hex('#0c2408'),
  outlineLit: hex('#16380e'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

// Grove light (light-only colours): sunlit green, deepening to forest.
export const GROVE_CORE = hex('#f6ffe0');
export const GROVE_HOT = hex('#d8ff8a');
export const GROVE_MID = hex('#7ee05a');
export const GROVE_DEEP = hex('#2e8a4a');
export const GROVE_GOLD = hex('#ffd66b');

export const GROVE_SPELL: SpellColors = { core: GROVE_CORE, hot: GROVE_HOT, mid: GROVE_MID, deep: GROVE_DEEP, accent: GROVE_GOLD };

// ---------------------------------------------------------------------------
// The Shapeshifter: a wolf's pelt worn as a hood, its head over her brow and
// its eyes still burning amber; a mantle of grey fur, woad on the cheeks, a
// hide robe, and a staff hung with fangs round a lump of amber.

export const HIDE: Material = {
  ramp: ramp('#1c120e', '#2e1e16', '#44301f', '#5c4430', '#7a5c40'),
  outline: hex('#0a0604'),
  outlineLit: hex('#1c120e'),
};

/** The tunic under the hide. */
export const TUNIC: Material = {
  ramp: ramp('#10141c', '#1c2230', '#2a3246', '#3c465e'),
  outline: hex('#06080c'),
};

/** Fangs and claws on the staff and the belt. */
export const FANG: Material = {
  ramp: ramp('#5a5040', '#948a70', '#cfc6a8', '#f4f0e0'),
  outline: hex('#1a160e'),
  shine: true,
};

/** The wolf's grey pelt. */
export const PELT: Material = {
  ramp: ramp('#26262e', '#45454f', '#6f6f82', '#a2a2b4', '#d2d2de'),
  outline: hex('#0b0b10'),
  outlineLit: hex('#1b1b22'),
};

/** The wolf's pale muzzle and throat. */
export const MUZZLE: Material = {
  ramp: ramp('#5e5e6c', '#8e8e9e', '#c2c2d0', '#eeeef6'),
  outline: hex('#16161e'),
  outlineLit: hex('#24242e'),
};

/** Her own hair, dark auburn. */
export const AUBURN: Material = {
  ramp: ramp('#2a120c', '#4a2014', '#6e3420', '#94502e'),
  outline: hex('#12060a'),
};

export const WOAD: Material = {
  ramp: ramp('#1c3a86', '#2e5cc6', '#4a7ae0'),
  outline: hex('#0a1430'),
  noAO: true,
};

/** The pelt's eyes, still burning. */
export const WOLF_EYE: Material = {
  ramp: ramp('#ff9a20', '#ffd060', '#fff0b0'),
  outline: hex('#2a1004'),
  emissive: 1,
  noAO: true,
};

export const WOLF_NOSE: Material = {
  ramp: ramp('#08080c', '#16161c'),
  outline: hex('#040406'),
  noAO: true,
};

export const AMBER: Material = {
  ramp: ramp('#8a3a0a', '#e0801e', '#ffc860', '#fff4d0'),
  outline: hex('#2a1004'),
  outlineLit: hex('#40180a'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

// Spirit light (light-only colours): amber, burning down to russet.
export const WILD_CORE = hex('#fff6e0');
export const WILD_HOT = hex('#ffd27a');
export const WILD_MID = hex('#f09a3a');
export const WILD_DEEP = hex('#8a3a1e');

export const WILD_SPELL: SpellColors = { core: WILD_CORE, hot: WILD_HOT, mid: WILD_MID, deep: WILD_DEEP, accent: hex('#fff0c0') };

// ---------------------------------------------------------------------------
// The Grovekeeper's Autumn Warden skin: a hood of russet leaves, bare antlers,
// a hem of falling leaves, and a staff holding an ember of a seed.

export const AUTUMN_ROBE: Material = {
  ramp: ramp('#2a120c', '#46200f', '#6a3214', '#8e4a1c', '#b0662a'),
  outline: hex('#120604'),
  outlineLit: hex('#2a120c'),
};

export const AUTUMN_LEAF: Material = {
  ramp: ramp('#6a2a0a', '#b0501a', '#e08a2a', '#ffc85a'),
  outline: hex('#240c04'),
  outlineLit: hex('#3a1406'),
};

export const BARE_ANTLER: Material = {
  ramp: ramp('#3a2c20', '#5e4a36', '#86705a', '#b09a80'),
  outline: hex('#140e08'),
  shine: true,
};

export const EMBER_SEED: Material = {
  ramp: ramp('#8a2a0a', '#e0701e', '#ffb84a', '#fff0c0'),
  outline: hex('#2a0a04'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

export const AUTUMN_CORE = hex('#fff4e0');
export const AUTUMN_HOT = hex('#ffc870');
export const AUTUMN_MID = hex('#f0803a');
export const AUTUMN_DEEP = hex('#9a3a1a');

export const AUTUMN_SPELL: SpellColors = { core: AUTUMN_CORE, hot: AUTUMN_HOT, mid: AUTUMN_MID, deep: AUTUMN_DEEP, accent: hex('#ffe08a') };

// ---------------------------------------------------------------------------
// The Shapeshifter's Frostfang skin: a white wolf's pelt with eyes of ice, a
// hide bleached by winter, silver hair and a staff of pale wood round a shard of ice.

export const FROST_HIDE: Material = {
  ramp: ramp('#1e2430', '#323c4c', '#4c5a6e', '#6a7a90', '#8e9eb4'),
  outline: hex('#0a0c12'),
  outlineLit: hex('#1e2430'),
};

export const FROST_TUNIC: Material = {
  ramp: ramp('#0c1424', '#16223a', '#223452', '#30486c'),
  outline: hex('#04080e'),
};

export const ICE_FANG: Material = {
  ramp: ramp('#6a8aa8', '#a0c0dc', '#d4ecff', '#f6fcff'),
  outline: hex('#141e2a'),
  shine: true,
};

export const SNOW_PELT: Material = {
  ramp: ramp('#6a7282', '#9aa2b4', '#c8d0de', '#e8eef6', '#fafcff'),
  outline: hex('#1c2230'),
  outlineLit: hex('#2c3444'),
};

export const FROST_WOOD: Material = {
  ramp: ramp('#2a2e38', '#464c5a', '#6a7282', '#9098a8'),
  outline: hex('#0c0e14'),
};

export const ICE: Material = {
  ramp: ramp('#1a5aa8', '#4aa0f0', '#a8e0ff', '#ffffff'),
  outline: hex('#081830'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

export const FROST_HAIR: Material = {
  ramp: ramp('#5a6070', '#8a92a6', '#c0c8d8', '#eef2fa'),
  outline: hex('#161a24'),
};

export const FROST_CORE = hex('#f0faff');
export const FROST_HOT = hex('#b8e8ff');
export const FROST_MID = hex('#5ab8f0');
export const FROST_DEEP = hex('#2a5aa8');

export const FROST_SPELL: SpellColors = { core: FROST_CORE, hot: FROST_HOT, mid: FROST_MID, deep: FROST_DEEP, accent: hex('#e0f6ff') };

// ---------------------------------------------------------------------------
// The Grovekeeper's Titania skin: the faerie queen. Honey-gold hair to the
// waist under a crown of white blossoms and gold leaves, a gown of layered
// petals from blush pink down to cream, gauzy wings that catch the light, and
// a slender staff of moonwood holding a glowing moonflower bud.

/** The gown's upper petals: blush pink. */
export const FAE_GOWN: Material = {
  ramp: ramp('#4a2236', '#7a3a56', '#b0607e', '#e090aa', '#ffc4d4'),
  outline: hex('#1e0a14'),
  outlineLit: hex('#3a1828'),
};

/** The gown's lowest petals, the staff's sepals and her slippers: cream. */
export const FAE_PETAL: Material = {
  ramp: ramp('#9a6070', '#d4a2ac', '#f2d6d2', '#fff4ec'),
  outline: hex('#3a1a24'),
  outlineLit: hex('#4e2a32'),
  shine: true,
};

/** Gold leaf: the girdle, the crown's leaves. */
export const FAE_GOLD: Material = {
  ramp: ramp('#6a4210', '#a8741e', '#e0b040', '#fff0a0'),
  outline: hex('#241404'),
  shine: true,
};

export const HONEY_HAIR: Material = {
  ramp: ramp('#5a3612', '#8c5c1e', '#c08c34', '#e8bc56', '#fde494'),
  outline: hex('#24140a'),
  outlineLit: hex('#3a220c'),
  shine: true,
};

/**
 * Wings like a dragonfly's: lilac at the root paling to pearl at the tips,
 * with a soft glow of their own, and a light outline so they read as gauze
 * rather than as solid shapes.
 */
export const FAE_WING: Material = {
  ramp: ramp('#56609e', '#7e8cd0', '#a8b4ec', '#d8c8f2', '#fbf2ff'),
  outline: hex('#4a4a8a'),
  outlineLit: hex('#6a6aa8'),
  emissive: 0.22,
  noAO: true,
};

/** The crown's white blossoms. */
export const FAE_BLOSSOM: Material = {
  ramp: ramp('#9a8a96', '#d8ccd4', '#f6f0f2', '#ffffff'),
  // A soft outline: a wreath of petals, not a row of teeth.
  outline: hex('#5a4656'),
  outlineLit: hex('#7a6676'),
  emissive: 0.15,
  shine: true,
};

/** Pale moonwood, silvery like birch. */
export const MOONWOOD: Material = {
  ramp: ramp('#3a3240', '#665a6c', '#a0949e', '#d8ccd2'),
  outline: hex('#140e16'),
};

/** The moonflower bud at the staff's head, lit from within. */
export const MOONFLOWER: Material = {
  ramp: ramp('#b0607e', '#ffb8d0', '#fff0e0', '#ffffff'),
  outline: hex('#3a1828'),
  outlineLit: hex('#4a2030'),
  emissive: 0.95,
  shine: true,
  noAO: true,
};

// Faerie light (light-only colours): moonlit white, gold, blush, deepening to rose.
export const TITANIA_CORE = hex('#fffaf0');
export const TITANIA_HOT = hex('#ffd88a');
export const TITANIA_MID = hex('#ff9ac0');
export const TITANIA_DEEP = hex('#b8487a');

export const TITANIA_SPELL: SpellColors = { core: TITANIA_CORE, hot: TITANIA_HOT, mid: TITANIA_MID, deep: TITANIA_DEEP, accent: hex('#fff0b0'), petals: true };

// ---------------------------------------------------------------------------
// The Grovekeeper's Mycelia skin: a mushroom druid of the deep woods, where
// no sun reaches and the only light is what grows. A broad spotted toadstool
// for a hat, a dusky violet-brown robe whose hem frills into glowing gills,
// little glowcaps sprouting on her shoulders and up her staff, and a gnarled
// staff crowned with a cluster of luminous mushrooms.

export const MYC_ROBE: Material = {
  ramp: ramp('#150d15', '#231623', '#352333', '#4a3244', '#614456'),
  outline: hex('#070407'),
  outlineLit: hex('#1a0f19'),
};

/** The robe's underlayer, dark as leaf mould. */
export const MYC_LOAM: Material = {
  ramp: ramp('#0e0a0e', '#1a141c', '#282030', '#382c40'),
  outline: hex('#050306'),
};

/**
 * The gills under the cap and the frills at the hem and mantle: teal light,
 * glowing softly on their own like foxfire.
 */
export const MYC_GILL: Material = {
  ramp: ramp('#103a42', '#1c707a', '#36bcbc', '#94f2e2'),
  outline: hex('#061418'),
  outlineLit: hex('#0c262c'),
  emissive: 0.55,
  noAO: true,
};

/** The toadstool's cap: deep plum, glossy as wet fungus. */
export const MYC_CAP: Material = {
  ramp: ramp('#1a0b1c', '#321532', '#4e2249', '#6e345c', '#8f4870'),
  outline: hex('#090309'),
  outlineLit: hex('#220d20'),
  shine: true,
};

/** The pale spots on the cap, lit from within. */
export const MYC_SPOT: Material = {
  ramp: ramp('#3e9aa2', '#8eeadf', '#e4fff8'),
  outline: hex('#12323a'),
  emissive: 0.75,
  noAO: true,
};

/** Mushroom stems: pale and soft, a little lilac in the shadow. */
export const MYC_STEM: Material = {
  ramp: ramp('#4e4048', '#7e6e74', '#b0a29e', '#ddd2c4'),
  outline: hex('#1a1216'),
};

/** The glowcaps on her staff and shoulders. */
export const GLOWCAP: Material = {
  ramp: ramp('#124a64', '#2290b0', '#56d4dc', '#c0faf2'),
  outline: hex('#071c2a'),
  outlineLit: hex('#0c2a3a'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

/** Her skin, pale as a mushroom's flesh, with a cool cast from never seeing the sun. */
export const MYC_SKIN: Material = {
  ramp: ramp('#6a4a52', '#a8848a', '#dcc0bc', '#f6e6de'),
  outline: hex('#2a161c'),
};

/** Old wood, gnarled and grey, threaded with mycelium. */
export const MYC_WOOD: Material = {
  ramp: ramp('#18121a', '#2a2228', '#41363a', '#5a4e4e'),
  outline: hex('#080608'),
};

export const MYC_HAIR: Material = {
  ramp: ramp('#0d0911', '#1a1322', '#2a1f36', '#3c2e4c'),
  outline: hex('#050307'),
};

// Spore light (light-only colours): pale cyan, through teal, deepening to a woodland violet.
export const MYC_CORE = hex('#effffb');
export const MYC_HOT = hex('#8ef6e6');
export const MYC_MID = hex('#36c4cc');
export const MYC_DEEP = hex('#5a3aa8');

export const MYCELIA_SPELL: SpellColors = { core: MYC_CORE, hot: MYC_HOT, mid: MYC_MID, deep: MYC_DEEP, accent: hex('#c8a4ff') };

// ---------------------------------------------------------------------------
// The Shapeshifter's Cinderhide skin: a shaman of the volcano. An obsidian
// pelt split by glowing lava cracks, a charred wolf's skull for a headdress
// with embers in its sockets, ash on her face, ember eyes, a hide burnt black,
// and a charred staff round a heart of magma.

/** The pelt: black as obsidian, glassy where the light catches it. */
export const OBSIDIAN_PELT: Material = {
  ramp: ramp('#07070a', '#121218', '#1f1e27', '#302e3a', '#47434f'),
  outline: hex('#020203'),
  outlineLit: hex('#0d0c11'),
  shine: true,
};

/** The hide, burnt black-brown. */
export const CHAR_HIDE: Material = {
  ramp: ramp('#0d0908', '#191110', '#271a17', '#372521', '#4a322c'),
  outline: hex('#050303'),
  outlineLit: hex('#140d0c'),
};

/** The tunic under it, a smouldering dark red. */
export const CINDER_TUNIC: Material = {
  ramp: ramp('#180705', '#2c0d09', '#45150f', '#5e2018'),
  outline: hex('#080202'),
};

/** Charred bone: the skull, and the fangs on her staff and belt. */
export const CHAR_BONE: Material = {
  ramp: ramp('#221c18', '#463e38', '#746a62', '#a49a8e', '#d0c6b4'),
  outline: hex('#090706'),
  outlineLit: hex('#16120f'),
  shine: true,
};

/** Her hair, grey as ash. */
export const ASH_HAIR: Material = {
  ramp: ramp('#262222', '#433e3e', '#666060', '#8c8684'),
  outline: hex('#0c0a0a'),
};

/** Ash daubed on her face. */
export const ASH_PAINT: Material = {
  ramp: ramp('#5e5a5a', '#8a8686', '#b4b0ae'),
  outline: hex('#1a1818'),
  noAO: true,
};

/** Molten rock in the cracks of the pelt, and her eyes. */
export const LAVA: Material = {
  ramp: ramp('#7a1806', '#d84a0c', '#ff9a1e', '#ffe48a'),
  outline: hex('#1a0502'),
  emissive: 1,
  noAO: true,
};

/** The staff's charred wood. */
export const CINDER_WOOD: Material = {
  ramp: ramp('#100a08', '#1e140e', '#2e2016', '#422e1e'),
  outline: hex('#060302'),
};

/** The heart of magma the fangs hold. */
export const MAGMA: Material = {
  ramp: ramp('#6a1004', '#d0400a', '#ff9a1e', '#fff0a0'),
  outline: hex('#200602'),
  outlineLit: hex('#300a04'),
  emissive: 0.95,
  shine: true,
  noAO: true,
};

// Ember light (light-only colours): white-hot, gold, flame orange, down to a smoky red.
export const CINDER_CORE = hex('#fff4d8');
export const CINDER_HOT = hex('#ffc04a');
export const CINDER_MID = hex('#ff6a14');
export const CINDER_DEEP = hex('#6a1a0c');

export const CINDER_SPELL: SpellColors = { core: CINDER_CORE, hot: CINDER_HOT, mid: CINDER_MID, deep: CINDER_DEEP, accent: hex('#ffe0a0') };

// ---------------------------------------------------------------------------
// Button icons: 16x16, drawn additively on the buttons, so black is empty and
// where shapes overlap the brighter colour stays.

export type Put = (x: number, y: number, c: RGB) => void;

/** A blank 16x16 icon and a pen for it that keeps the brighter colour. */
export function icon16(draw: (put: Put) => void): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put: Put = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i + 3] && px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  draw(put);
  return px;
}

/** A one-pixel line. */
export function seg(put: Put, x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
}

/** Colours for an icon, brightest first. */
export type Tones = [RGB, RGB, RGB, RGB];

export const GROVE_TONES: Tones = [GROVE_CORE, GROVE_HOT, GROVE_MID, GROVE_DEEP];
export const WILD_TONES: Tones = [WILD_CORE, WILD_HOT, WILD_MID, WILD_DEEP];
export const AUTUMN_TONES: Tones = [AUTUMN_CORE, AUTUMN_HOT, AUTUMN_MID, AUTUMN_DEEP];
export const FROST_TONES: Tones = [FROST_CORE, FROST_HOT, FROST_MID, FROST_DEEP];
export const TITANIA_TONES: Tones = [TITANIA_CORE, TITANIA_HOT, TITANIA_MID, TITANIA_DEEP];
export const MYCELIA_TONES: Tones = [MYC_CORE, MYC_HOT, MYC_MID, MYC_DEEP];
export const CINDER_TONES: Tones = [CINDER_CORE, CINDER_HOT, CINDER_MID, CINDER_DEEP];

/** The thorn seed: a glowing seed bristling with thorns, a leaf sprouting from its top. */
export function thornSeedIcon(k: Tones = GROVE_TONES): Uint8ClampedArray {
  return icon16((put) => {
    // Thorns first, so the seed sits over their roots.
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + 0.45 + (i / 7) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      seg(put, 8 + ca * 3.4, 9 + sa * 4, 8 + ca * 6.6, 9 + sa * 6.6, k[3]);
      put(8 + ca * 6.8, 9 + sa * 6.8, k[2]);
    }
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = (x + 0.5 - 8) / 3.3;
        const dy = (y + 0.5 - 9.2) / 4.1;
        const d = Math.hypot(dx, dy);
        if (d > 1) continue;
        put(x, y, d < 0.35 ? k[0] : dx + dy < -0.3 ? k[1] : d < 0.75 ? k[1] : k[2]);
      }
    }
    // The sprout: a stem and two little leaves.
    seg(put, 8, 5, 8, 2, k[2]);
    put(7, 2, k[1]);
    put(6, 1, k[1]);
    put(9, 3, k[1]);
    put(10, 2, k[1]);
    put(11, 2, k[2]);
  });
}

/** The wild grove: a ring of green on the ground with shoots springing up inside and fireflies over it. */
export function groveIcon(k: Tones = GROVE_TONES): Uint8ClampedArray {
  return icon16((put) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 7.2, (y + 0.5 - 12) / 3.1);
        if (d > 1) continue;
        put(x, y, d > 0.78 ? k[2] : (x + y) % 2 ? k[3] : [k[3][0] >> 1, k[3][1] >> 1, k[3][2] >> 1]);
      }
    }
    // Three shoots, the middle one tallest, each with a leaf.
    const shoot = (x: number, h: number, lean: number) => {
      for (let i = 0; i <= h; i++) put(x + Math.round(lean * (i / h) ** 2), 12 - i, i > h - 2 ? k[0] : k[1]);
      put(x + Math.round(lean) + (lean >= 0 ? 1 : -1), 12 - h + 1, k[1]);
      put(x - (lean >= 0 ? 1 : -1), 12 - Math.round(h / 2), k[2]);
    };
    shoot(8, 8, 0);
    shoot(5, 5, -1.5);
    shoot(11, 5, 1.5);
    for (const [x, y] of [[3, 4], [13, 3], [10, 1], [2, 8]]) put(x, y, k[0]);
  });
}

/** Spirit claws: three raking slashes, hot at their heads. */
export function clawsIcon(k: Tones = WILD_TONES): Uint8ClampedArray {
  return icon16((put) => {
    for (let n = 0; n < 3; n++) {
      const ox = n * 3.6 - 3.6;
      for (let i = 0; i <= 12; i++) {
        const f = i / 12;
        // A shallow curve from the upper right down to the lower left.
        const x = 12.5 + ox - f * 9 - Math.sin(f * Math.PI) * 1.6;
        const y = 1.5 + f * 12.5;
        const w = Math.sin(f * Math.PI);
        put(x, y, w > 0.75 ? k[0] : w > 0.45 ? k[1] : k[2]);
        if (w > 0.5) put(x + 1, y, k[2]);
        if (w > 0.8) put(x - 1, y, k[3]);
      }
    }
  });
}

/** Pounce: a leap's arc of spirit light coming down on a paw print. */
export function pounceIcon(k: Tones = WILD_TONES): Uint8ClampedArray {
  return icon16((put) => {
    for (let i = 0; i <= 16; i++) {
      const f = i / 16;
      const x = 1 + f * 10;
      const y = 10 - Math.sin(f * Math.PI) * 8.5 + f * 1.5;
      put(x, y, f > 0.7 ? k[1] : f > 0.35 ? k[2] : k[3]);
      if (f > 0.55) put(x, y + 1, k[3]);
    }
    // The paw: a pad and four toes.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (Math.hypot((x + 0.5 - 12) / 2.1, (y + 0.5 - 13.3) / 1.6) <= 1) put(x, y, k[1]);
      }
    }
    for (const [x, y] of [[9, 11], [10, 9], [13, 9], [14, 11]]) {
      put(x, y, k[0]);
    }
    put(11, 13, k[0]);
  });
}

/** Titania's blossom seed: a five-petalled flower with a gold heart, pollen drifting off it. */
export function blossomSeedIcon(k: Tones = TITANIA_TONES): Uint8ClampedArray {
  return icon16((put) => {
    const dim: RGB = [k[3][0] >> 1, k[3][1] >> 1, k[3][2] >> 1];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - 8;
        const dy = y + 0.5 - 8.5;
        // Five petals: a radius that swells five times round the heart.
        const a = Math.atan2(dy, dx) + Math.PI / 2;
        const lobe = Math.abs(Math.cos((a * 5) / 2));
        const R = 3.2 + 3.6 * lobe;
        const d = Math.hypot(dx, dy);
        if (d > R) continue;
        const f = d / R;
        // Paler toward each petal's tip, a darker crease between petals.
        put(x, y, lobe < 0.35 && f > 0.55 ? k[3] : f > 0.82 ? k[0] : f > 0.45 ? k[2] : dim);
      }
    }
    // The heart: gold stamens round a white centre.
    for (const [x, y] of [[7, 8], [8, 7], [9, 8], [8, 9]]) put(x, y, k[1]);
    put(8, 8, k[0]);
    // Pollen drifting off it.
    for (const [x, y] of [[13, 2], [2, 3], [14, 13], [1, 12]]) put(x, y, k[1]);
  });
}

/** Titania's faerie ring: a ring of little flowers on the grass, fireflies dancing over it. */
export function faerieRingIcon(k: Tones = TITANIA_TONES): Uint8ClampedArray {
  return icon16((put) => {
    // A glow on the grass inside the ring.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 6.4, (y + 0.5 - 11.5) / 2.8);
        if (d <= 0.8 && (x + y) % 2) put(x, y, [k[3][0] >> 1, k[3][1] >> 1, k[3][2] >> 1]);
      }
    }
    // Eight blossoms round the ring, pink and cream by turns, each with a gold heart.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const x = Math.round(8 + Math.cos(a) * 6.2 - 0.5);
      const y = Math.round(11.5 + Math.sin(a) * 2.8 - 0.5);
      const petal = i % 2 ? k[0] : k[2];
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) put(x + ox, y + oy, petal);
      put(x, y, k[1]);
    }
    // Fireflies over it, the middle one twinkling.
    for (const [x, y] of [[4, 3], [12, 2], [10, 6]]) put(x, y, k[1]);
    put(7, 1, k[0]);
    for (const [x, y] of [[6, 1], [8, 1], [7, 0], [7, 2]]) put(x, y, k[1]);
  });
}

/** Mycelia's spore: a glowing spore pod, a tiny glowcap sprouting from its top, spores puffing off it. */
export function sporeIcon(k: Tones = MYCELIA_TONES): Uint8ClampedArray {
  return icon16((put) => {
    const dim: RGB = [k[3][0] >> 1, k[3][1] >> 1, k[3][2] >> 1];
    // A soft halo of spores round the pod, thinner further out.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 5.4 + (i % 3) * 0.9;
      put(8 + Math.cos(a) * r, 10 + Math.sin(a) * r * 0.85, i % 3 === 0 ? k[1] : k[3]);
    }
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = (x + 0.5 - 8) / 3.6;
        const dy = (y + 0.5 - 10.4) / 3.6;
        const d = Math.hypot(dx, dy);
        if (d > 1) continue;
        // Lit from the upper left, freckled with darker pores.
        const lit = d < 0.35 ? k[0] : dx + dy < -0.25 ? k[1] : d < 0.8 ? k[2] : k[3];
        put(x, y, (x * 3 + y * 5) % 7 === 0 && d > 0.4 ? dim : lit);
      }
    }
    // The glowcap on top: a stem and a little domed cap, a spot on it.
    put(8, 6, k[2]);
    put(8, 5, k[2]);
    for (let x = 6; x <= 10; x++) put(x, 4, x === 6 || x === 10 ? k[3] : k[1]);
    for (let x = 7; x <= 9; x++) put(x, 3, k[1]);
    put(8, 2, k[2]);
    put(7, 3, k[0]);
    // Spores puffing up off it.
    for (const [x, y] of [[11, 1], [4, 1], [12, 3]]) put(x, y, k[0]);
  });
}

/** Mycelia's grove: three glowing toadstools in a ring of light, threads of mycelium beneath and spores rising. */
export function shroomRingIcon(k: Tones = MYCELIA_TONES): Uint8ClampedArray {
  return icon16((put) => {
    const dim: RGB = [k[3][0] >> 1, k[3][1] >> 1, k[3][2] >> 1];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 7.2, (y + 0.5 - 12.6) / 2.8);
        if (d > 1) continue;
        if (d > 0.8) put(x, y, k[3]);
        else if ((x + y) % 2) put(x, y, dim);
      }
    }
    // The mycelium: pale threads wandering under the ground between the caps.
    for (const [x, y] of [[3, 13], [4, 14], [6, 14], [7, 13], [9, 14], [10, 13], [12, 14], [13, 13]]) put(x, y, k[2]);
    /** A toadstool: stem from the ground up to `top`, a cap `w` wide either side, spotted. */
    const shroom = (x: number, top: number, w: number) => {
      for (let y = top + 1; y <= 12; y++) put(x, y, k[2]);
      for (let ox = -w; ox <= w; ox++) put(x + ox, top, Math.abs(ox) === w ? k[3] : k[1]);
      for (let ox = -w + 1; ox <= w - 1; ox++) put(x + ox, top - 1, k[1]);
      if (w > 1) for (let ox = -w + 2; ox <= w - 2; ox++) put(x + ox, top - 2, k[2]);
      put(x - 1, top - 1, k[0]);
      if (w > 2) put(x + 1, top - 2, k[0]);
    };
    shroom(8, 6, 3);
    shroom(4, 9, 2);
    shroom(12, 9, 2);
    // Spores rising over them.
    for (const [x, y] of [[3, 3], [13, 4], [10, 1], [6, 2]]) put(x, y, k[0]);
  });
}
