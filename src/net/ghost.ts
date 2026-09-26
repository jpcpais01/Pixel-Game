// While another player's hero acts in this game (see net/Remote.ts), the code
// it runs is the same as for the player's own hero. The few shared things that
// belong to the player alone (their buffs, their energy) check this flag and
// leave the player be while a remote hero is acting.

export const ghost = {
  /** True while a remote hero's own code is running. */
  active: false,
};

/** Run `fn` as a remote hero's doing. */
export function asGhost<T>(fn: () => T): T {
  const was = ghost.active;
  ghost.active = true;
  try {
    return fn();
  } finally {
    ghost.active = was;
  }
}
