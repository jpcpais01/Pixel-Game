// Shared input state: the UI scene (touch and mouse) and keyboard both write
// here, the world scene reads it.
export const controls = {
  /** Joystick vector, length 0..1. */
  moveX: 0,
  moveY: 0,
  /** Attack button held. */
  attack: false,
  /** Special button held (the wizard's beam). */
  beam: false,
  /** A mouse is in use (it moved or clicked since the last touch): abilities aim at it. */
  mouse: false,
  /** Left mouse button held on the game world (the attack on a computer). */
  click: false,
};

// Beam state written by the wizard, read by the UI to draw the button's charge ring.
export const beamHud = {
  /** 0..1 charge gathered. */
  charge: 0,
  /** 0..1 of the grace period used up while held at full charge. */
  over: 0,
  /** The beam is firing. */
  firing: false,
};

// The melee heroes' combo, read by the UI to light pips on the attack button.
export const comboHud = {
  /** Hits landed in the current chain, 0..max. */
  hits: 0,
  /** Hits in a full chain: one pip each. */
  max: 3,
  /** 0..1 of the time left to chain the next hit. */
  window: 0,
};
