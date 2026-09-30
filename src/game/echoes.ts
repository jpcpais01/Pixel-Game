// Echoes of the fallen: where a player dies, the last few seconds of their
// hero are kept, and other players find a gravestone on that spot. Touching
// it plays their last moments back as a ghost and grants a small blessing in
// their name (see world/Echoes.ts for the graves and the ghost).
//
// The echoes are shared through Firestore over REST, like the saves in
// cloud.ts: each arena has a ring of SLOTS documents, `echoes/{arena}/slots/
// s{n}`, and a death overwrites one at random, so the store can never grow
// past SLOTS per arena and a fetch is one small list. Nothing is sent but the
// player's display name, the hero's name, where they fell and how their
// sprite moved: no account id or email. Everything fails quietly: offline, or
// before the Firestore rules allow it, the player still sees their own echoes
// from this device's cache.

import type Phaser from 'phaser';
import { FIREBASE_CONFIG } from '../firebaseConfig';
import { account, cloudReady } from './cloud';
import type { BuffDef, BuffMods } from './buffs';

/** How often the hero's sprite is sampled, ms, and how many samples an echo keeps (~4.8 s). */
export const SAMPLE_MS = 80;
const KEEP = 60;
/** Documents per arena. */
const SLOTS = 24;
/** Echoes older than this are left to rest (ms). */
const MAX_AGE = 30 * 24 * 3600 * 1000;
/** At most one echo sent this often (ms), so a bad streak doesn't fill an arena's slots alone. */
const SEND_GAP = 20000;
/** Give up on a fetch after this long and use the cache (ms). */
const FETCH_TIMEOUT = 5000;
/** A record's recording, as text, is kept under this (the Firestore rule checks it too). */
const MAX_REC = 7000;

const CACHE_KEY = 'pixel-battle.echoes.';
const TAG_KEY = 'pixel-battle.echoTag';

/** One moment of the fallen hero: where their sprite stood (relative to where they fell) and what it showed. */
export interface EchoSample {
  x: number;
  y: number;
  /** Index into the record's texture keys. */
  key: number;
  frame: string;
  flip: boolean;
  /** They were struck just then. */
  hurt: boolean;
}

export interface EchoRecord {
  /** The player's display name. */
  name: string;
  /** The hero they played (a type's or skin's name). */
  hero: string;
  /** Where they fell, in world px. */
  x: number;
  y: number;
  /** When, ms since the epoch. */
  t: number;
  /** A random tag for the device it came from, to tell a player's own echoes from others'. */
  by: string;
  keys: string[];
  /** The hero sprite's origin. */
  ox: number;
  oy: number;
  samples: EchoSample[];
}

const NAME_RULE = /^[A-Za-z0-9_ ]{1,16}$/;
const TEXT_RULE = /^[\w .'-]{1,24}$/;
const FRAME_RULE = /^[\w.-]{1,40}$/;

/** This device's tag, made once. It says nothing about who the player is. */
export function deviceTag(): string {
  try {
    let t = localStorage.getItem(TAG_KEY);
    if (!t || !/^[a-z0-9]{8}$/.test(t)) {
      t = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
      localStorage.setItem(TAG_KEY, t);
    }
    return t;
  } catch {
    return 'guest000';
  }
}

// ---------------------------------------------------------------------------
// The recording, as compact text: "ox,oy|key,key|x,y,k,frame,flags;..."

function encode(r: EchoRecord): string {
  const head = `${r.ox.toFixed(3)},${r.oy.toFixed(3)}|${r.keys.join(',')}|`;
  return head + r.samples.map((s) => `${s.x},${s.y},${s.key},${s.frame},${(s.flip ? 1 : 0) | (s.hurt ? 2 : 0)}`).join(';');
}

/** Read a stored echo back; anything malformed (or from someone meddling) is dropped. */
function decode(f: { n?: string; c?: string; x?: number; y?: number; t?: number; b?: string; r?: string }): EchoRecord | null {
  const { n, c, x, y, t, b, r } = f;
  if (typeof r !== 'string' || r.length > MAX_REC || typeof x !== 'number' || typeof y !== 'number' || typeof t !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) return null;
  const parts = r.split('|');
  if (parts.length !== 3) return null;
  const [ox, oy] = parts[0].split(',').map(Number);
  if (!(ox >= 0 && ox <= 1 && oy >= 0 && oy <= 1)) return null;
  const keys = parts[1].split(',');
  if (!keys.length || keys.length > 4 || !keys.every((k) => FRAME_RULE.test(k))) return null;
  const samples: EchoSample[] = [];
  for (const s of parts[2].split(';')) {
    const q = s.split(',');
    if (q.length !== 5) return null;
    const [sx, sy, k, fl] = [Number(q[0]), Number(q[1]), Number(q[2]), Number(q[4])];
    if (!Number.isInteger(sx) || !Number.isInteger(sy) || Math.abs(sx) > 600 || Math.abs(sy) > 600) return null;
    if (!(k >= 0 && k < keys.length) || !FRAME_RULE.test(q[3])) return null;
    samples.push({ x: sx, y: sy, key: k, frame: q[3], flip: (fl & 1) > 0, hurt: (fl & 2) > 0 });
  }
  if (samples.length < 2 || samples.length > KEEP) return null;
  return {
    name: typeof n === 'string' && NAME_RULE.test(n) ? n : 'Wanderer',
    hero: typeof c === 'string' && TEXT_RULE.test(c) ? c : '',
    x: Math.round(x),
    y: Math.round(y),
    t,
    by: typeof b === 'string' ? b.slice(0, 12) : '',
    keys,
    ox,
    oy,
    samples,
  };
}

type Stored = { n: string; c: string; x: number; y: number; t: number; b: string; r: string };
const store = (r: EchoRecord): Stored => ({ n: r.name, c: r.hero, x: r.x, y: r.y, t: r.t, b: r.by, r: encode(r) });

// ---------------------------------------------------------------------------
// Recording

/**
 * Keeps the last few seconds of the hero's sprite, a sample every SAMPLE_MS,
 * so that when they fall the moments before it can be sent as an echo.
 */
export class EchoRecorder {
  private ring: { x: number; y: number; key: string; frame: string; flip: boolean; hurt: boolean }[] = [];
  private acc = SAMPLE_MS;
  private hurtSince = false;
  private ox = 0.5;
  private oy = 1;

  sample(dt: number, sprite: Phaser.GameObjects.Sprite, hurt: boolean): void {
    // A blow between samples still shows on the next one.
    this.hurtSince ||= hurt;
    this.acc += dt;
    if (this.acc < SAMPLE_MS) return;
    this.acc %= SAMPLE_MS;
    const key = sprite.texture.key;
    const frame = String(sprite.frame.name);
    if (!FRAME_RULE.test(key) || !FRAME_RULE.test(frame)) return;
    this.ox = sprite.originX;
    this.oy = sprite.originY;
    this.ring.push({ x: sprite.x, y: sprite.y, key, frame, flip: sprite.flipX, hurt: this.hurtSince });
    this.hurtSince = false;
    if (this.ring.length > KEEP) this.ring.shift();
  }

  /** The hero fell at (x, y): their last moments as an echo, or null if there's too little to show. */
  fell(x: number, y: number, hero: string): EchoRecord | null {
    const ring = this.ring;
    this.ring = [];
    if (ring.length < 4) return null;
    const keys: string[] = [];
    const samples: EchoSample[] = [];
    for (const s of ring) {
      let k = keys.indexOf(s.key);
      if (k < 0) {
        // A hero wears one sheet, but a shapeshifter may change; four is plenty.
        if (keys.length >= 4) continue;
        k = keys.push(s.key) - 1;
      }
      samples.push({ x: Math.round(s.x - x), y: Math.round(s.y - y), key: k, frame: s.frame, flip: s.flip, hurt: s.hurt });
    }
    const name = account()?.username ?? 'Wanderer';
    const rec: EchoRecord = { name, hero: TEXT_RULE.test(hero) ? hero : '', x: Math.round(x), y: Math.round(y), t: Date.now(), by: deviceTag(), keys, ox: this.ox, oy: this.oy, samples };
    // Trim the oldest moments until it fits.
    while (rec.samples.length > 4 && encode(rec).length > MAX_REC) rec.samples.shift();
    return rec;
  }
}

// ---------------------------------------------------------------------------
// The cache on this device

function readCache(arena: string): Stored[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY + arena);
    const list = raw ? (JSON.parse(raw) as Stored[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeCache(arena: string, list: Stored[]): void {
  try {
    localStorage.setItem(CACHE_KEY + arena, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the echoes are just not remembered.
  }
}

/** The same death from two sources (the cloud and the cache) is one echo. */
const same = (a: Stored, b: Stored) => a.t === b.t && a.b === b.b;

function remember(arena: string, add: Stored[]): Stored[] {
  const list = readCache(arena);
  for (const s of add) if (!list.some((o) => same(o, s))) list.push(s);
  list.sort((a, b) => b.t - a.t);
  const kept = list.slice(0, SLOTS);
  writeCache(arena, kept);
  return kept;
}

// ---------------------------------------------------------------------------
// The cloud

const slotsUrl = (arena: string) => `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/echoes/${arena}/slots`;

type FsField = { stringValue?: string; integerValue?: string; doubleValue?: number };

async function fetchCloud(arena: string): Promise<Stored[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(`${slotsUrl(arena)}?pageSize=${SLOTS}&key=${FIREBASE_CONFIG.apiKey}`, { signal: ctl.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { documents?: { fields?: Record<string, FsField> }[] };
    const out: Stored[] = [];
    for (const d of data.documents ?? []) {
      const f = d.fields ?? {};
      const str = (k: string) => f[k]?.stringValue ?? '';
      const num = (k: string) => Number(f[k]?.integerValue ?? f[k]?.doubleValue ?? NaN);
      out.push({ n: str('n'), c: str('c'), x: num('x'), y: num('y'), t: num('t'), b: str('b'), r: str('r') });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

let lastSent = -Infinity;

/** Share a death: kept on this device at once, and sent to one of the arena's slots when the cloud will take it. */
export function sendEcho(arena: string, rec: EchoRecord): void {
  const s = store(rec);
  remember(arena, [s]);
  if (!cloudReady() || !/^[a-z0-9_-]{1,24}$/.test(arena)) return;
  const now = performance.now();
  if (now - lastSent < SEND_GAP) return;
  lastSent = now;
  const slot = `s${Math.floor(Math.random() * SLOTS)}`;
  const fields = {
    n: { stringValue: s.n },
    c: { stringValue: s.c },
    x: { integerValue: String(s.x) },
    y: { integerValue: String(s.y) },
    t: { integerValue: String(s.t) },
    b: { stringValue: s.b },
    r: { stringValue: s.r },
  };
  fetch(`${slotsUrl(arena)}/${slot}?key=${FIREBASE_CONFIG.apiKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  }).catch(() => {
    // Offline or not allowed: it lives on in this device's cache.
  });
}

/** The echoes lying in an arena, newest first: from the cloud when it answers, with this device's own added. */
export async function loadEchoes(arena: string): Promise<EchoRecord[]> {
  const cloud = cloudReady() ? await fetchCloud(arena) : [];
  const list = remember(arena, cloud);
  const now = Date.now();
  const out: EchoRecord[] = [];
  for (const s of list) {
    if (!(now - s.t < MAX_AGE)) continue;
    const r = decode(s);
    if (r) out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Blessings

interface Blessing {
  title: string;
  tint: number;
  mods: BuffMods;
}

/** Small, and short: a nod from the fallen, not a reason to go looking for graves. */
const BLESSINGS: Blessing[] = [
  { title: 'Valor', tint: 0xffd89a, mods: { damage: 1.12 } },
  { title: 'Resolve', tint: 0xb8a8ff, mods: { guard: 0.88 } },
  { title: 'Haste', tint: 0x9ff0ff, mods: { speed: 1.12 } },
  { title: 'Solace', tint: 0x9dffc8, mods: { regen: 2 } },
];
const BLESSING_MS = 40000;

/** The blessing an echo gives, the same one every time for the same echo. One echo blessing is held at a time. */
export function blessingOf(r: EchoRecord): BuffDef {
  let h = r.t;
  for (const ch of r.name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  const b = BLESSINGS[Math.abs(h) % BLESSINGS.length];
  return { id: 'echo', name: `${r.name}'s ${b.title}`, icon: 'buff_echo', tint: b.tint, duration: BLESSING_MS, mods: b.mods };
}
