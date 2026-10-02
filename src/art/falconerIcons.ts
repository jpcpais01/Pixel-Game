// Button icons for the Falconer: her quick shot from a short bow and her
// falcon's strike, in her own tones and in Berkut's (a dark horn bow, crimson
// fletching, a golden eagle). 16x16, outlined, lit from the top left like the
// other icons.

import { iconPainter } from './effects';

export interface FalconerIconTones {
  /** The bow's wood, light to dark. */
  wood: [string, string, string];
  /** Arrowhead and fletching. */
  head: string;
  fletch: string;
  /** The bird's plumage: light breast, mid back, dark wings and head. */
  bird: [string, string, string];
  /** Its talons and beak, and the streaks of its rake. */
  claw: string;
  rake: [string, string];
  ink: string;
}

export const FALCONER_TONES: FalconerIconTones = {
  wood: ['#c89a5e', '#946a3c', '#5e3e22'],
  head: '#e8eef6',
  fletch: '#d8743a',
  bird: ['#efe6cc', '#7a86a0', '#3a4254'],
  claw: '#f0c040',
  rake: ['#ffffff', '#ffc860'],
  ink: '#0c0806',
};

export const BERKUT_TONES: FalconerIconTones = {
  wood: ['#e8d4a8', '#6a4428', '#2a1a0e'],
  head: '#eef2f8',
  fletch: '#d0402e',
  bird: ['#f0c058', '#6a4428', '#2a1a10'],
  claw: '#f0c040',
  rake: ['#fff4d0', '#ffb040'],
  ink: '#0c0604',
};

/** Quick shot: a short recurve bow drawn, an arrow leaving it fast up and right, speed lines behind. */
export function quickShotIcon(t: FalconerIconTones): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The bow: a curve from its top tip (1, 5) to its bottom tip (10, 14), bulging up and right toward the shot.
  const bow = (u: number): [number, number] => {
    const v = 1 - u;
    return [v * v * 1 + 2 * v * u * 8.5 + u * u * 10, v * v * 5 + 2 * v * u * 6.5 + u * u * 14];
  };
  for (let u = 0; u <= 1; u += 0.04) {
    const [x, y] = bow(u);
    put(Math.round(x), Math.round(y), t.wood[u < 0.15 || u > 0.85 ? 2 : u > 0.4 && u < 0.6 ? 0 : 1]);
  }
  // The arrow, nocked on the drawn string and flying up and right past the grip.
  for (let i = 0; i < 10; i++) put(3 + i, 12 - i, '#b89868');
  outline(t.ink);
  // String from tip to tip, pulled back to the nock.
  for (let u = 0; u <= 1; u += 0.1) {
    put(Math.round(1 + u * 2), Math.round(6 + u * 6), '#e6dcc4');
    put(Math.round(3 + u * 6), Math.round(12 + u * 2), '#e6dcc4');
  }
  put(13, 2, t.head);
  put(14, 1, '#ffffff');
  put(12, 2, t.head);
  put(13, 3, t.head);
  put(3, 11, t.fletch);
  put(4, 13, t.fletch);
  put(2, 12, t.fletch);
  // Its speed.
  for (const [x, y] of [[9, 0], [10, 0], [11, 0], [15, 5], [15, 6], [15, 4]]) put(x, y, t.rake[1]);
  return px;
}

/** Falcon strike: the bird stooping out of the top right, talons thrust forward, three rake marks below it. */
export function falconIcon(t: FalconerIconTones): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const [light, mid, dark] = t.bird;
  // Wings raised and swept back over it, like a stooping falcon flaring to strike.
  const wings: [number, number, string][] = [
    [6, 1, dark], [7, 2, dark], [8, 2, mid], [9, 3, mid], [10, 3, mid], [11, 2, mid], [12, 1, dark], [13, 1, dark], [14, 0, dark],
    [5, 2, dark], [6, 3, mid], [7, 3, mid], [8, 4, mid], [11, 4, mid], [12, 3, mid], [13, 2, mid],
  ];
  for (const [x, y, c] of wings) put(x, y, c);
  // The body, breast lit, head down to the lower left.
  const body: [number, number, string][] = [
    [9, 4, mid], [10, 4, mid], [8, 5, light], [9, 5, light], [10, 5, mid], [7, 6, light], [8, 6, light], [9, 6, mid], [6, 7, light], [7, 7, mid],
    [11, 5, dark], [12, 4, dark], [13, 4, dark],
  ];
  for (const [x, y, c] of body) put(x, y, c);
  put(5, 7, dark);
  put(5, 8, dark);
  put(4, 8, t.claw);
  // Talons thrust out ahead.
  for (const [x, y] of [[7, 8], [6, 9], [8, 9], [7, 10]]) put(x, y, t.claw);
  outline(t.ink);
  put(6, 7, '#ffffff');
  // The rake: three bright streaks below the talons.
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 4; k++) put(3 + i * 3 + k, 11 + k, k < 2 ? t.rake[0] : t.rake[1]);
  }
  return px;
}
