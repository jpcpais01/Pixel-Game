// Auto Battle's hero card lines: a piece's numbers at its star level, and
// what its ability and Special do, read from their numbers so the card is
// never out of date with the fight.

import { heroStats } from '../stats';
import { COST_LIFT, DPS_MUL, HP_MUL, STAR_LIFT } from './sim';
import { unitDef, type Spell } from './units';

export interface PieceNumbers {
  hp: number;
  /** Damage a second from basic attacks. */
  dps: number;
  defense: number;
  range: number;
  mana: number;
}

export function pieceNumbers(key: string, star: number): PieceNumbers {
  const d = unitDef(key);
  const s = heroStats(d.cls, d.type);
  const lift = (1 + COST_LIFT * (d.cost - 1)) * STAR_LIFT[star];
  return { hp: Math.round(s.hp * HP_MUL * lift), dps: Math.round(s.damage * s.rate * DPS_MUL * lift), defense: s.defense, range: d.range, mana: d.mana };
}

const sec = (n: number) => `${Math.round(n * 10) / 10}s`;

/** One plain sentence on what a spell does, with its damage at this star level. */
export function spellText(s: Spell, dps: number): string {
  const dmg = Math.round(dps * s.dmg);
  let main: string;
  switch (s.kind) {
    case 'bolt':
      main = `Hits one foe for ${dmg}`;
      break;
    case 'beam':
      main = `${dmg} to each foe in a line`;
      break;
    case 'nova':
      main = `${dmg} to all foes around it`;
      break;
    case 'blast':
      main = s.aim === 'target' ? `${dmg} to its target and foes by it` : `${dmg} to a crowd of foes`;
      break;
    case 'leap':
      main = `Leaps in: ${dmg} where it lands`;
      break;
    case 'dash':
      main = s.aim === 'weak' ? `Dashes to the weakest foe: ${dmg}` : s.aim === 'far' ? `Dashes through to the farthest foe: ${dmg} each` : `Dashes through a foe: ${dmg}`;
      break;
    case 'chain':
      main = `${dmg}, jumping on to ${s.n ?? 3} more foes`;
      break;
    case 'rain':
      main = `${s.n ?? 6} strikes: ${dmg} in all`;
      break;
    case 'mend': {
      const who = (s.r ?? 0) >= 9 ? 'all allies' : (s.r ?? 0) > 0 ? 'allies near' : 'itself';
      const parts = [s.heal ? `heals ${who} ${Math.round(s.heal * 100)}% HP` : '', s.shield ? `a ${Math.round(s.shield * 100)}% barrier` : '', s.haste ? `${Math.round(s.haste * 100)}% faster attacks for ${sec(s.dur ?? 4)}` : ''].filter(Boolean);
      main = parts.join(', ');
      main = main.charAt(0).toUpperCase() + main.slice(1);
      if (!s.heal) main = `Gives ${who} ${main.charAt(0).toLowerCase()}${main.slice(1)}`;
      break;
    }
  }
  const extra = [
    s.stun ? `stuns ${sec(s.stun)}` : '',
    s.slow ? 'slows' : '',
    s.burn ? `burns ${Math.round(dps * s.burn)}` : '',
    s.knock ? 'throws back' : '',
    s.drain ? `heals ${Math.round(s.drain * 100)}% of it` : '',
    s.kind !== 'mend' && s.shield ? `${Math.round(s.shield * 100)}% barrier` : '',
    s.kind !== 'mend' && s.haste ? `${Math.round(s.haste * 100)}% faster attacks` : '',
    s.dodge ? `untouchable ${sec(s.dodge)}` : '',
    s.pull ? 'drags it in' : '',
  ].filter(Boolean);
  return extra.length ? `${main}; ${extra.join(', ')}.` : `${main}.`;
}
