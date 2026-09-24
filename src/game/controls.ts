// Shared input state: the UI scene (touch) and keyboard both write here,
// the world scene reads it.
export const controls = {
  /** Joystick vector, length 0..1. */
  moveX: 0,
  moveY: 0,
  /** Attack button held. */
  attack: false,
};
