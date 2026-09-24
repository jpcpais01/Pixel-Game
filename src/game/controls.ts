// Shared input state: the UI scene (touch) and keyboard both write here,
// the world scene reads it.
export const controls = {
  /** Joystick vector, length 0..1. */
  moveX: 0,
  moveY: 0,
  /** Attack button held. */
  attack: false,
  /** Special button held (the wizard's beam). */
  beam: false,
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
