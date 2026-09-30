// Player accounts and cloud saves on Firebase, through its REST endpoints
// rather than the SDK (which would add a few hundred KB to a game that has to
// load fast on phones). Players only ever see a username and a password:
// Firebase Auth wants an email, so each name maps to a hidden address on a
// made-up domain, which also keeps names unique. Each player's save is one
// Firestore document, `players/{uid}`, that only they can read or write.

import { FIREBASE_CONFIG } from '../firebaseConfig';
import type { StatKey } from './gear';

const SESSION_KEY = 'pixel-battle.account';
const EMAIL_DOMAIN = 'players.myths-and-legends.game';

export const USERNAME_RULE = /^[a-zA-Z0-9_]{3,16}$/;
export const MIN_PASSWORD = 6;

export interface Account {
  uid: string;
  username: string;
}

/** What a player keeps between visits. */
export interface SaveData {
  /** How many of each item they've picked up, by item id. */
  items: Record<string, number>;
  /** Their six always-equipped items (item ids), empty slots as null. */
  equipped: (string | null)[];
  /** Dust from disenchanted items, spent on upgrades at the Rune Temple. */
  dust: number;
  /** The stat each level past the first went into, per upgraded item id. */
  upgrades: Record<string, StatKey[]>;
  /** Gems to spend on wishes in the shop. */
  gems: number;
  /** Skins won from wishes, as "class:skin" ids. */
  skins: string[];
  /** The last day (YYYY-MM-DD, local) the daily gems were given. */
  daily: string;
  /** Wishes since the last legendary skin, for the guarantee. */
  pity: number;
  /** One-off gifts already given to this account (see GRANTS in collection.ts), so each is given once. */
  grants: string[];
  /** The furthest wave reached in the Endless Rift, by class id. */
  rift: Record<string, number>;
  /** Companions won from the companion wishes, by id. */
  pets: string[];
  /** The companion that follows the player, or '' for none. */
  pet: string;
  /** Companion wishes since the last legendary companion, for its own guarantee. */
  petPity: number;
  /** Each season's currency (Hallow's Eve's candy...), by season id (see game/season.ts). */
  candy: Record<string, number>;
  /** Critters caught with the net, how many of each, by id. */
  critters: Record<string, number>;
  /** Boss materials for the Forge, by the set they forge (see game/forge.ts). */
  mats: Record<string, number>;
}

interface Session extends Account {
  refreshToken: string;
  idToken: string;
  /** ms timestamp the id token stops working. */
  expires: number;
}

export const cloudReady = (): boolean => !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

let session: Session | null = loadSession();
const listeners = new Set<(a: Account | null) => void>();

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setSession(s: Session | null): void {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Not remembered; the player stays logged in for this visit.
  }
  const a = account();
  for (const fn of listeners) fn(a);
}

/** The logged-in player, or null when playing as a guest. */
export function account(): Account | null {
  return session ? { uid: session.uid, username: session.username } : null;
}

/** Call `fn` on every login and logout; returns the unsubscribe. */
export function onAccount(fn: (a: Account | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A readable message for a failed request. */
export class CloudError extends Error {}

const AUTH_MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: 'That name is taken.',
  EMAIL_NOT_FOUND: 'Wrong name or password.',
  INVALID_PASSWORD: 'Wrong name or password.',
  INVALID_LOGIN_CREDENTIALS: 'Wrong name or password.',
  USER_DISABLED: 'This account is disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries. Wait a bit and try again.',
  OPERATION_NOT_ALLOWED: 'Accounts are switched off on the server.',
};

async function post(url: string, body: object): Promise<Record<string, string>> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new CloudError('No connection. Check your internet.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // e.g. "WEAK_PASSWORD : Password should be at least 6 characters"
    const code = String(data?.error?.message ?? '').split(' ')[0];
    if (code === 'WEAK_PASSWORD') throw new CloudError(`Password needs at least ${MIN_PASSWORD} characters.`);
    throw new CloudError(AUTH_MESSAGES[code] ?? 'Something went wrong. Try again.');
  }
  return data;
}

const emailFor = (username: string) => `${username.toLowerCase()}@${EMAIL_DOMAIN}`;

/** Create an account (`create`) or log into one. Resolves with the player's save, if they have one. */
export async function logIn(username: string, password: string, create: boolean): Promise<LoadedSave | null> {
  if (!cloudReady()) throw new CloudError('Accounts are not set up yet.');
  if (!USERNAME_RULE.test(username)) throw new CloudError('Names are 3 to 16 letters, numbers or _.');
  if (password.length < MIN_PASSWORD) throw new CloudError(`Password needs at least ${MIN_PASSWORD} characters.`);
  const op = create ? 'signUp' : 'signInWithPassword';
  const data = await post(`https://identitytoolkit.googleapis.com/v1/accounts:${op}?key=${FIREBASE_CONFIG.apiKey}`, {
    email: emailFor(username),
    password,
    returnSecureToken: true,
  });
  const s: Session = {
    uid: data.localId,
    username,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expires: Date.now() + Number(data.expiresIn) * 1000,
  };
  session = s;
  const save = create ? null : await loadSave().catch(() => null);
  // The name as they typed it at sign-up is the one kept in their save.
  if (save?.username) s.username = save.username;
  setSession(s);
  return save;
}

export function logOut(): void {
  setSession(null);
}

/** A fresh id token for the logged-in player, refreshing it when it's about to run out. */
async function token(): Promise<string> {
  const s = session;
  if (!s) throw new CloudError('Not logged in.');
  if (Date.now() < s.expires - 60_000) return s.idToken;
  let res: Response;
  try {
    res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
    });
  } catch {
    throw new CloudError('No connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The account was deleted or its password changed elsewhere.
    if (res.status === 400) setSession(null);
    throw new CloudError('Please log in again.');
  }
  s.idToken = data.id_token;
  s.refreshToken = data.refresh_token;
  s.expires = Date.now() + Number(data.expires_in) * 1000;
  if (session === s) setSession(s);
  return s.idToken;
}

const docUrl = (uid: string) =>
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/players/${uid}`;

// Firestore's REST API wraps every value in its type.
type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FsValue> } }
  | { arrayValue: { values?: FsValue[] } };

/** Load the logged-in player's save; null if they haven't got one yet. */
/** A save as stored: one from before gems existed has none. */
export type LoadedSave = Omit<SaveData, 'gems'> & { gems?: number; username?: string };

export async function loadSave(): Promise<LoadedSave | null> {
  const s = session;
  if (!s) return null;
  let res: Response;
  try {
    res = await fetch(docUrl(s.uid), { headers: { Authorization: `Bearer ${await token()}` } });
  } catch (e) {
    throw e instanceof CloudError ? e : new CloudError('No connection.');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new CloudError('Could not load your save.');
  const doc = (await res.json()) as { fields?: Record<string, FsValue> };
  const f = doc.fields ?? {};
  const items: Record<string, number> = {};
  const map = f.items && 'mapValue' in f.items ? (f.items.mapValue.fields ?? {}) : {};
  for (const [id, v] of Object.entries(map)) if ('integerValue' in v) items[id] = Number(v.integerValue);
  const list = f.equipped && 'arrayValue' in f.equipped ? (f.equipped.arrayValue.values ?? []) : [];
  const equipped = list.map((v) => ('stringValue' in v ? v.stringValue : null));
  const username = f.username && 'stringValue' in f.username ? f.username.stringValue : undefined;
  const dust = f.dust && 'integerValue' in f.dust ? Number(f.dust.integerValue) : 0;
  const upgrades: Record<string, StatKey[]> = {};
  const ups = f.upgrades && 'mapValue' in f.upgrades ? (f.upgrades.mapValue.fields ?? {}) : {};
  for (const [id, v] of Object.entries(ups)) if ('stringValue' in v && v.stringValue) upgrades[id] = v.stringValue.split(',') as StatKey[];
  // A save from before gems existed has none: the player is given the welcome gems.
  const gems = f.gems && 'integerValue' in f.gems ? Number(f.gems.integerValue) : undefined;
  const skins = f.skins && 'stringValue' in f.skins && f.skins.stringValue ? f.skins.stringValue.split(',') : [];
  const daily = f.daily && 'stringValue' in f.daily ? f.daily.stringValue : '';
  const pity = f.pity && 'integerValue' in f.pity ? Number(f.pity.integerValue) : 0;
  const grants = f.grants && 'stringValue' in f.grants && f.grants.stringValue ? f.grants.stringValue.split(',') : [];
  // The Rift's best waves as "wizard:12,valkyrie:7".
  const rift: Record<string, number> = {};
  if (f.rift && 'stringValue' in f.rift && f.rift.stringValue) {
    for (const pair of f.rift.stringValue.split(',')) {
      const [cls, n] = pair.split(':');
      if (cls && Number(n) > 0) rift[cls] = Number(n);
    }
  }
  const pets = f.pets && 'stringValue' in f.pets && f.pets.stringValue ? f.pets.stringValue.split(',') : [];
  const pet = f.pet && 'stringValue' in f.pet ? f.pet.stringValue : '';
  const petPity = f.petPity && 'integerValue' in f.petPity ? Number(f.petPity.integerValue) : 0;
  // Seasonal currencies as "hallows:120".
  const candy: Record<string, number> = {};
  if (f.candy && 'stringValue' in f.candy && f.candy.stringValue) {
    for (const pair of f.candy.stringValue.split(',')) {
      const [id, n] = pair.split(':');
      if (id && Number(n) > 0) candy[id] = Number(n);
    }
  }
  // Boss materials as "wraith:4,ember:9".
  const mats: Record<string, number> = {};
  if (f.mats && 'stringValue' in f.mats && f.mats.stringValue) {
    for (const pair of f.mats.stringValue.split(',')) {
      const [set, n] = pair.split(':');
      if (set && Number(n) > 0) mats[set] = Number(n);
    }
  }
  // Critters caught as "firefly:3,glowfrog:1".
  const critters: Record<string, number> = {};
  if (f.critters && 'stringValue' in f.critters && f.critters.stringValue) {
    for (const pair of f.critters.stringValue.split(',')) {
      const [id, n] = pair.split(':');
      if (id && Number(n) > 0) critters[id] = Number(n);
    }
  }
  return { items, equipped, dust, upgrades, gems, skins, daily, pity, grants, rift, pets, pet, petPity, critters, mats, candy, username };
}

/** Overwrite the logged-in player's save. */
export async function writeSave(data: SaveData): Promise<void> {
  const s = session;
  if (!s) return;
  const items: Record<string, FsValue> = {};
  for (const [id, n] of Object.entries(data.items)) items[id] = { integerValue: String(Math.floor(n)) };
  const fields: Record<string, FsValue> = {
    username: { stringValue: s.username },
    items: { mapValue: { fields: items } },
    equipped: { arrayValue: { values: data.equipped.map((id) => (id ? { stringValue: id } : { nullValue: null })) } },
    dust: { integerValue: String(Math.floor(data.dust)) },
    // Each item's levels as its chosen stats in order, "power,hp,hp".
    upgrades: { mapValue: { fields: Object.fromEntries(Object.entries(data.upgrades).map(([id, picks]) => [id, { stringValue: picks.join(',') }])) } },
    gems: { integerValue: String(Math.floor(data.gems)) },
    skins: { stringValue: data.skins.join(',') },
    daily: { stringValue: data.daily },
    pity: { integerValue: String(Math.floor(data.pity)) },
    grants: { stringValue: data.grants.join(',') },
    rift: { stringValue: Object.entries(data.rift).map(([cls, n]) => `${cls}:${Math.floor(n)}`).join(',') },
    pets: { stringValue: data.pets.join(',') },
    pet: { stringValue: data.pet },
    petPity: { integerValue: String(Math.floor(data.petPity)) },
    candy: { stringValue: Object.entries(data.candy).map(([id, n]) => `${id}:${Math.floor(n)}`).join(',') },
    critters: { stringValue: Object.entries(data.critters).map(([id, n]) => `${id}:${Math.floor(n)}`).join(',') },
    mats: { stringValue: Object.entries(data.mats).map(([set, n]) => `${set}:${Math.floor(n)}`).join(',') },
    updated: { timestampValue: new Date().toISOString() },
  };
  const res = await fetch(docUrl(s.uid), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new CloudError('Could not save.');
}
