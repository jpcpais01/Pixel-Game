// Sky Glide's flight and bookkeeping: how a glider flies (steering, diving,
// flaring, the lift of updrafts and the push of wind rivers, knocks on
// islets), the state the HUD shows, best times, and the ghost of the best
// run. The scene (scenes/GlideScene.ts) draws it all; the HUD
// (scenes/GlideUIScene.ts) shows glideHud and writes the touch controls into
// glideInput.

import { GOAL, ISLETS, LANES, RINGS, UPDRAFTS, WALL_L, WALL_R, isletR, laneAt, type SkyIslet } from '../world/glideLayout';

/** Most the heading turns from straight down the course, and how fast it turns (radians, per second). */
const HEAD_MAX = 1.15;
const TURN = 2.3;
/** The speed a glider settles at (px/s): gliding, pushed forward, flared, diving. */
const V_GLIDE = 95;
const V_PUSH = 30;
const V_FLARE = 38;
const V_DIVE = 178;
/** How fast it sinks at each (px/s). */
const SINK_GLIDE = 5;
const SINK_PUSH = 7;
const SINK_FLARE = 2.5;
const SINK_DIVE = 48;
/** Slower than this and the wing stalls: it sinks fast until it picks up speed again. */
const STALL = 50;
/** Flaring while faster than the flare's speed trades the extra speed for height, at this rate. */
const CLIMB_K = 0.35;
/** Top speed, with boosts. */
const V_MAX = 240;
/** How fast speed above the settled speed bleeds away (per second), and speed below it builds. */
const BLEED = 0.35;
const BUILD = 0.8;
const BUILD_DIVE = 1.6;
/** A wind river raises the settled speed by this much. */
const LANE_SPEED = 45;
/** Pushing past the course's edges: how hard the crosswind shoves back. */
const WALL_PUSH = 3;
/** Over the goal and past its middle, a headwind settles the glider onto the meadow. */
const LAND_SPEED = 26;
const LAND_SINK = 34;

/** Ring boosts, added to the speed. */
export const RING_BOOST = 26;
export const BIG_BOOST = 70;
/** Seconds added for sinking into the clouds. */
export const FALL_PENALTY = 3000;

/** The touch controls (the HUD writes them; the keyboard is read by the scene). */
export const glideInput = { mx: 0, my: 0, dive: false };

export interface Flight {
  x: number;
  y: number;
  z: number;
  /** Airspeed, px/s. */
  v: number;
  /** Heading: 0 straight down the course, positive toward the east (radians). */
  h: number;
  /** -1..1, how hard it banks (for the wing's look). */
  bank: number;
  /** 0 flared, 1 gliding, 2 diving (for the wing's look). */
  pitch: number;
  /** Upward push left from a hop off an islet (px/s). */
  bounce: number;
  /** In rising air or a wind river this frame (for sounds and effects). */
  draft: number;
  lane: boolean;
  /** Settling onto the goal. */
  landing: boolean;
}

export const newFlight = (x: number, y: number, z: number): Flight => ({ x, y, z, v: V_GLIDE, h: 0, bank: 0, pitch: 1, bounce: 0, draft: 0, lane: false, landing: false });

/** What the controls ask: steer -1..1, pitch -1 (flare, pull back) .. 1 (push), and the dive held. */
export interface FlyInput {
  steer: number;
  pitch: number;
  dive: boolean;
}

/** Something that happened this step. */
export type FlightEvent = { kind: 'bonk'; islet: SkyIslet } | { kind: 'hop'; islet: SkyIslet } | { kind: 'land' };

/** How high the ground (an islet's top) is under (x, y), or null over open sky. */
export function surfaceAt(x: number, y: number): SkyIslet | null {
  if (isletR(GOAL, x, y) <= 1) return GOAL;
  for (const l of ISLETS) if (isletR(l, x, y) <= 1) return l;
  return null;
}

/** Step the flight by `dt` seconds. */
export function stepFlight(f: Flight, inp: FlyInput, dt: number): FlightEvent[] {
  const events: FlightEvent[] = [];
  const flare = Math.max(0, -inp.pitch);
  const push = Math.max(0, inp.pitch);
  const dive = inp.dive && !f.landing;

  // Steering eases the heading toward where the stick points; the wing banks into the turn.
  let target = inp.steer * HEAD_MAX;
  if (f.landing) target = Math.max(-0.6, Math.min(0.6, (GOAL.x - f.x) / 80));
  const turn = Math.max(-TURN * dt, Math.min(TURN * dt, target - f.h));
  f.h += turn;
  f.bank += (Math.max(-1, Math.min(1, (target - f.h) * 1.6 + inp.steer * 0.35)) - f.bank) * Math.min(1, dt * 8);
  f.pitch = dive ? 2 : flare > 0.3 ? 0 : 1;

  // Wind rivers carry the glider along and speed it up.
  let laneX = 0;
  let laneY = 0;
  f.lane = false;
  for (const l of LANES) {
    const a = laneAt(l, f.x, f.y);
    if (a.t < 0 || a.t > 1 || a.d > l.w) continue;
    const k = 1 - (a.d / l.w) ** 2;
    const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    laneX += ((l.x2 - l.x1) / len) * l.push * k;
    laneY += ((l.y2 - l.y1) / len) * l.push * k;
    f.lane = true;
  }

  let vEq = dive ? V_DIVE : V_GLIDE + push * V_PUSH - flare * V_FLARE;
  let sink = dive ? SINK_DIVE : Math.max(2, SINK_GLIDE + push * SINK_PUSH - flare * SINK_FLARE);
  if (f.lane) vEq += LANE_SPEED;
  if (f.landing) {
    vEq = LAND_SPEED;
    sink = LAND_SINK;
  }
  if (f.v < STALL && !dive && !f.landing) sink += (STALL - f.v) * 0.9;
  f.v += (vEq - f.v) * Math.min(1, (f.v < vEq ? (dive ? BUILD_DIVE : BUILD) : f.landing ? 3 : BLEED) * dt);
  // A flare while fast zooms the glider up, spending the speed.
  let climb = 0;
  if (flare > 0 && f.v > vEq + 5 && !f.landing) {
    climb = Math.min(f.v - vEq, 120) * CLIMB_K * flare;
    f.v -= climb * 1.3 * dt;
  }
  f.v = Math.min(V_MAX, f.v);

  // Rising air.
  let lift = 0;
  for (const u of UPDRAFTS) {
    const d = Math.hypot(f.x - u.x, (f.y - u.y) * 1.15) / u.r;
    if (d < 1) lift += u.lift * (1 - d * d);
  }
  f.draft = lift;
  f.bounce *= Math.exp(-dt * 4);

  const px = f.x;
  const py = f.y;
  const pz = f.z;
  f.x += (Math.sin(f.h) * f.v + laneX) * dt;
  f.y += (Math.cos(f.h) * f.v + laneY) * dt;
  f.z += (lift + climb + f.bounce - sink) * dt;

  // The course's edges.
  if (f.x < WALL_L) f.x += (WALL_L - f.x) * Math.min(1, WALL_PUSH * dt);
  if (f.x > WALL_R) f.x += (WALL_R - f.x) * Math.min(1, WALL_PUSH * dt);

  // Islets: over one, a low glider hops off its grass; into its rock, it's knocked back out.
  for (const l of ISLETS) {
    const r = isletR(l, f.x, f.y);
    if (r > 1.08) continue;
    const bottom = l.top - l.thick * 0.85;
    if (f.z <= l.top && f.z > bottom) {
      if (pz >= l.top - 1 && r <= 1) {
        // Came down onto its top.
        f.z = l.top + 1;
        f.bounce = 34;
        f.v *= 0.9;
        events.push({ kind: 'hop', islet: l });
      } else {
        // Flew into its side: back out the way it came, slowed.
        const wasR = isletR(l, px, py);
        f.x = px;
        f.y = py;
        if (wasR <= 1.08) {
          // Still inside (it came up from below): nudge out sideways.
          const dx = f.x - l.x || 1;
          f.x = l.x + Math.sign(dx) * l.rx * 1.1;
        }
        // Shoved off to the nearer side and turned away, so it can't catch on the rock again at once.
        const side = Math.sign(f.x - l.x || 1);
        f.x += side * 6;
        f.v *= 0.45;
        f.h = side * 0.9;
        events.push({ kind: 'bonk', islet: l });
      }
    }
  }

  // The goal: past its middle a headwind settles the glider; touching its meadow ends the run.
  const onGoal = isletR(GOAL, f.x, f.y) <= 1;
  if (onGoal && f.y > GOAL.y - GOAL.ry * 0.2) f.landing = true;
  if (onGoal && f.z <= GOAL.top) {
    if (pz > GOAL.top - 6) {
      f.z = GOAL.top;
      events.push({ kind: 'land' });
    } else if (!events.some((e) => e.kind === 'bonk')) {
      // Came in under the meadow's edge: into the cliff.
      f.x = px;
      f.y = py;
      f.v *= 0.4;
      events.push({ kind: 'bonk', islet: GOAL });
    }
  }
  return events;
}

// ---------------------------------------------------------------- What the HUD shows

export type GlidePhase = 'lobby' | 'count' | 'fly' | 'done';

export interface RaceRow {
  name: string;
  /** Finish time, or null while still flying. */
  ms: number | null;
  me: boolean;
}

export const glideHud = {
  phase: 'count' as GlidePhase,
  /** Countdown: 3, 2, 1, then 0 for GO. */
  count: 3,
  /** The run's time so far (or its final time), ms. */
  time: 0,
  /** Best time on this course (0 if none). */
  best: 0,
  newBest: false,
  rings: 0,
  ringsTotal: RINGS.length,
  z: 0,
  v: 0,
  /** Down the course, 0..1; the ghost's too (negative when there is none). */
  progress: 0,
  ghost: -1,
  diving: false,
  /** Low over open sky: the altimeter warns. */
  low: false,
  /** ms left to flash the fall penalty. */
  penalty: 0,
  /** Online: in a room, hosting it, its code and who's in it; the race's standings once someone finishes. */
  online: false,
  host: false,
  code: '',
  players: [] as string[],
  results: [] as RaceRow[],
  /** A line across the screen for a moment ("Checkpoint!"). */
  toast: '',
  toastT: 0,
};

export function toast(text: string, ms = 1400): void {
  glideHud.toast = text;
  glideHud.toastT = ms;
}

/** 83456 -> "1:23.45". */
export function fmtTime(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 10));
  const cs = t % 100;
  const s = Math.floor(t / 100) % 60;
  const m = Math.floor(t / 6000);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- The ghost of the best run

/** A sample of the flight every this many ms. */
export const GHOST_EVERY = 100;
const GHOST_KEY = 'pixel-battle.glide.ghost.';

export interface GhostRun {
  /** Its time, ms. */
  t: number;
  /** Who flew it: the hero's look (texture) and wing colour. */
  look: string;
  accent: number;
  /** x, y, z, bank x10, pitch, every GHOST_EVERY ms from the start. */
  s: number[];
}

export function loadGhost(course: string): GhostRun | null {
  try {
    const raw = localStorage.getItem(GHOST_KEY + course);
    const g = raw ? (JSON.parse(raw) as GhostRun) : null;
    return g && Array.isArray(g.s) && g.s.length >= 10 && g.t > 0 ? g : null;
  } catch {
    return null;
  }
}

export function saveGhost(course: string, g: GhostRun): void {
  try {
    localStorage.setItem(GHOST_KEY + course, JSON.stringify(g));
  } catch {
    // Storage full or blocked: the time is still kept.
  }
}

export class GhostRecorder {
  readonly s: number[] = [];
  private next = 0;

  /** Record the flight at run time `t` (ms), if a sample is due. */
  push(t: number, f: Flight): void {
    while (t >= this.next) {
      this.s.push(Math.round(f.x), Math.round(f.y), Math.round(f.z), Math.round(f.bank * 10), f.pitch);
      this.next += GHOST_EVERY;
    }
  }
}

/** Where the ghost was at run time `t` (ms), eased between samples; null once its run is over. */
export function ghostAt(g: GhostRun, t: number): { x: number; y: number; z: number; bank: number; pitch: number } | null {
  const n = g.s.length / 5;
  const f = t / GHOST_EVERY;
  const i = Math.floor(f);
  if (i >= n - 1) return null;
  const k = f - i;
  const a = i * 5;
  const b = a + 5;
  const s = g.s;
  return { x: s[a] + (s[b] - s[a]) * k, y: s[a + 1] + (s[b + 1] - s[a + 1]) * k, z: s[a + 2] + (s[b + 2] - s[a + 2]) * k, bank: (s[a + 3] + (s[b + 3] - s[a + 3]) * k) / 10, pitch: s[k < 0.5 ? a + 4 : b + 4] };
}
