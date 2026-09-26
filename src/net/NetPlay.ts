// Online play inside the world. Each player's game runs the whole fight: its
// own hero for real, everyone else's heroes from their inputs (RemotePlayer),
// and every monster. What must agree is shared:
//  - each player sends their hero's state many times a second, and says when
//    they cast their Special;
//  - a blow, slow or string that lands on a monster in the striker's game is
//    sent, and every other game deals the same to its copy of that monster;
//  - one player, the room's host, keeps the monsters for everyone: the others
//    ease their monsters toward where the host has them, take the host's
//    health for them, and bring monsters back or lay them low when it says;
//  - a monster's blow only hurts the hero of the game it lands in, so each
//    player is hurt by exactly what they see.
// In a duel there are no monsters: the two heroes can strike each other, the
// striker's game deciding what lands and the struck player's taking it.

import type { WorldScene } from '../scenes/WorldScene';
import type { Aim } from '../game/characters';
import type { Hit, Hurtbox } from '../game/combat';
import { Monster, type Target } from '../game/monsters';
import type { SpawnerSnap } from '../game/monsters';
import { energy } from '../game/energy';
import { snap } from '../game/display';
import { MARKS } from '../world/islandLayout';
import { RemotePlayer, type HeroState } from './Remote';
import { session, type Msg, type PeerInfo } from './session';

/** How often this player's state goes out, and the host's monsters, in ms. */
const STATE_EVERY = 50;
const MONSTERS_EVERY = 100;
/** Energy for the Special earned per point of damage dealt in a duel. */
const DUEL_ENERGY = 0.45;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export class NetPlay {
  readonly duel: boolean;
  private remotes = new Map<number, RemotePlayer>();
  private off: () => void;
  private sendT = 0;
  private snapT = 0;
  /** Attack and special held at any moment since the last state went out. */
  private attackHeld = false;
  private specialHeld = false;
  private input: { mx: number; my: number; aim: Aim | null } = { mx: 0, my: 0, aim: null };
  private wasDown = false;
  private score = { me: 0, them: 0 };
  private ended = false;

  constructor(private world: WorldScene) {
    const room = session.room!;
    this.duel = room.mode === 'duel';
    this.off = session.on((m) => this.receive(m));
    for (const p of session.peers.values()) this.addPeer(p);
    this.lead();

    Monster.net = {
      hit: (m, hit, damage) =>
        session.send({ t: 'h', i: m.slot, g: m.gen, d: r1(damage), hv: hit.heavy ? 1 : 0, k: Math.round(hit.knock), x: r1(hit.fromX), y: r1(hit.fromY), p: hit.poison }),
      slow: (m, k, ms, tint) => session.send({ t: 'sl', i: m.slot, g: m.gen, k: r2(k), ms: Math.round(ms), c: tint }),
      bind: (m, ms, lift) => session.send({ t: 'b', i: m.slot, g: m.gen, ms: Math.round(ms), l: r1(lift) }),
    };
    world.ultCaster.onCast = (aim, facing) => {
      const h = world.player;
      session.send({ t: 'u', x: r1(h.x), y: r1(h.y), ...this.aimFields(aim), fx: r2(facing.x), fy: r2(facing.y) });
    };

    // Duellists stand on the ring's two marks: whoever opened the room on the west one.
    if (this.duel) {
      const mark = MARKS[room.players.some((p) => p.id < room.you) ? 1 : 0];
      world.setSpawn(mark.x, mark.y + 2);
    } else {
      // Friends arrive side by side, not on top of each other.
      const s = world.spawnPoint;
      const x = s.x + ((room.you % 4) - 1.5) * 12;
      if (world.walkable(x, s.y)) world.setSpawn(x, s.y);
    }

  }

  /** The other players standing, for monsters to hunt. */
  targets(): Target[] {
    const out: Target[] = [];
    for (const r of this.remotes.values()) if (r.alive) out.push(r);
    return out;
  }

  /** What this player's blows can reach besides monsters: the opponent, in a duel. */
  foes(): Hurtbox[] {
    return this.duel ? [...this.remotes.values()].filter((r) => r.alive) : [];
  }

  /** This frame's inputs, from the world, for the next state sent. */
  record(mx: number, my: number, attack: boolean, special: boolean, aim: Aim | null): void {
    this.input = { mx, my, aim };
    this.attackHeld ||= attack;
    this.specialHeld ||= special;
  }

  /** Before the monsters move: ease them toward the host's. */
  follow(dt: number): void {
    if (session.isHost) return;
    for (const sp of this.world.spawnerList) sp.follow(dt);
  }

  update(dt: number, daylight: number): void {
    if (this.ended) return;
    const now = this.world.time.now;
    for (const r of this.remotes.values()) r.update(dt, now, daylight);

    const down = this.world.heroDown;
    if (this.duel && down && !this.wasDown) {
      this.score.them++;
      this.world.announce(`Defeated ${this.score.me}-${this.score.them}`);
    }
    this.wasDown = down;

    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT += STATE_EVERY;
      if (this.sendT < 0) this.sendT = STATE_EVERY;
      this.sendState();
    }
    if (session.isHost && !this.duel) {
      this.snapT -= dt;
      if (this.snapT <= 0) {
        this.snapT = MONSTERS_EVERY;
        const sp = this.world.spawnerList[0];
        if (sp) session.send({ t: 'm', ...sp.snapshot() });
      }
    }
  }

  /** The hurtboxes a remote hero's blows touch (for show): everything this player's would, and in a duel this player's own hero. */
  private bodiesFor(rp: RemotePlayer): Hurtbox[] {
    const out = this.world.allHurtboxes();
    if (this.duel) {
      const w = this.world;
      out.push({
        get x() {
          return w.player.x;
        },
        get y() {
          return w.player.y;
        },
        bodyY: 11,
        radius: 6,
        get alive() {
          return !w.heroDown;
        },
        hurt: () => {},
      });
      for (const r of this.remotes.values()) if (r !== rp && r.alive) out.push(r);
    }
    return out;
  }

  private addPeer(p: PeerInfo): void {
    if (this.remotes.has(p.id)) return;
    const s = this.world.spawnPoint;
    this.remotes.set(p.id, new RemotePlayer(this.world, p, s.x, s.y, () => this.bodiesFor(this.remotes.get(p.id)!), (rp, hit) => this.strike(rp, hit)));
  }

  private removePeer(id: number): void {
    this.remotes.get(id)?.destroy();
    this.remotes.delete(id);
  }

  /** The host keeps the monsters; everyone else follows. */
  private lead(): void {
    for (const sp of this.world.spawnerList) sp.follower = !session.isHost;
    this.snapT = 0;
  }

  /** This player's blow landed on the opponent: it's theirs to take. */
  private strike(rp: RemotePlayer, hit: Hit): void {
    const damage = hit.damage * this.world.might;
    session.send({ t: 'pv', d: r1(damage), k: Math.round(hit.knock), x: r1(hit.fromX), y: r1(hit.fromY) }, rp.id);
    rp.flash();
    this.world.leech(damage);
    if (energy.gain(damage * DUEL_ENERGY)) {
      const h = this.world.player;
      this.world.popNumber(snap(h.x), snap(h.y) - 42, 'SPECIAL READY', this.world.ultCaster.ult.pal.hot);
    }
  }

  /** In a duel, the damage this player just took, for the others to see over their hero. */
  hurtShown(damage: number, tint: number): void {
    if (this.duel) session.send({ t: 'ow', d: damage, c: tint });
  }

  private sendState(): void {
    const h = this.world.player;
    const v = h.vitals;
    const { mx, my, aim } = this.input;
    const s: HeroState = {
      t: 's',
      x: r1(h.x),
      y: r1(h.y),
      mx: r2(mx),
      my: r2(my),
      a: this.attackHeld ? 1 : 0,
      s: this.specialHeld ? 1 : 0,
      ...this.aimFields(aim),
      hp: Math.ceil(v.hp),
      mh: Math.round(v.max),
      br: Math.round(v.barrier),
      dn: this.world.heroDown ? 1 : 0,
    };
    this.attackHeld = this.specialHeld = false;
    session.send(s as unknown as Msg);
  }

  private aimFields(aim: Aim | null): Partial<HeroState> {
    if (!aim) return {};
    return { ax: r2(aim.x), ay: r2(aim.y), ad: aim.dist === undefined ? undefined : Math.round(aim.dist), al: aim.look ? 1 : 0 };
  }

  private receive(m: Msg): void {
    const f = m.f ?? 0;
    const now = this.world.time.now;
    switch (m.t) {
      case 'peer+':
        this.addPeer(m.p as PeerInfo);
        // Show the newcomer the monsters at once.
        this.snapT = 0;
        break;
      case 'peer-':
        this.removePeer(m.id as number);
        break;
      case 'host':
        this.lead();
        break;
      case 's': {
        const r = this.remotes.get(f);
        if (!r) break;
        const wasDown = r.down;
        r.apply(m as unknown as HeroState, now);
        if (this.duel && r.down && !wasDown && !this.world.heroDown) {
          this.score.me++;
          this.world.announce(`Victory ${this.score.me}-${this.score.them}`);
        }
        break;
      }
      case 'u': {
        const aim = m.ax === undefined ? null : { x: m.ax as number, y: m.ay as number, dist: m.ad as number | undefined };
        this.remotes.get(f)?.castUlt(m.x as number, m.y as number, aim, { x: m.fx as number, y: m.fy as number });
        break;
      }
      case 'h': {
        const mon = this.monster(m);
        mon?.netHurt({ damage: m.d as number, heavy: !!m.hv, knock: m.k as number, fromX: m.x as number, fromY: m.y as number, poison: m.p as number | undefined }, m.d as number);
        break;
      }
      case 'sl':
        this.monster(m)?.netSlow(m.k as number, m.ms as number, m.c as number);
        break;
      case 'b':
        this.monster(m)?.netBind(m.ms as number, m.l as number);
        break;
      case 'm':
        if (!session.isHost) for (const sp of this.world.spawnerList) sp.sync(m as unknown as SpawnerSnap);
        break;
      case 'pv': {
        const r = this.remotes.get(f);
        if (!r?.alive || this.world.heroDown) break;
        this.world.hurtHero({ damage: m.d as number, fromX: m.x as number, fromY: m.y as number, knock: m.k as number });
        break;
      }
      case 'ow': {
        const r = this.remotes.get(f);
        if (r) this.world.popNumber(snap(r.x), snap(r.y) - 38, `-${m.d}`, m.c as number);
        break;
      }
      case 'closed':
        this.goSolo();
        break;
    }
  }

  private monster(m: Msg): Monster | null {
    return this.world.spawnerList[0]?.find(m.i as number, m.g as number) ?? null;
  }

  /** The connection dropped: carry on alone. */
  private goSolo(): void {
    for (const r of this.remotes.values()) r.destroy();
    this.remotes.clear();
    Monster.net = null;
    for (const sp of this.world.spawnerList) sp.follower = false;
    this.world.announce('Connection lost');
    this.ended = true;
  }

  /** The world is closing: leave the room. */
  destroy(): void {
    this.off();
    for (const r of this.remotes.values()) r.destroy();
    this.remotes.clear();
    if (Monster.net) Monster.net = null;
    this.world.ultCaster.onCast = null;
    session.close();
  }
}
