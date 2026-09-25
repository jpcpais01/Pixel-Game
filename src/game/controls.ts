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
  /**
   * A mouse is in use (it moved or clicked since the last touch): abilities aim
   * at it. Starts true on computers, whose main pointer is a mouse.
   */
  mouse: typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches,
  /** Left mouse button held on the game world (the attack on a computer). */
  click: false,
  /**
   * Touch aim: the way an ability button is dragged (a unit vector), or null
   * while it isn't dragged out of its centre, which aims at the nearest enemy.
   */
  attackAim: null as { x: number; y: number } | null,
  beamAim: null as { x: number; y: number } | null,
  /** The Special's touch button dragged this way (see attackAim). */
  ultAim: null as { x: number; y: number } | null,
  /** The Special's touch button let go (or C pressed): cast it once, if there is energy for it. */
  ultTap: false,
  /**
   * One-shot presses from the touch buttons (a tap, or letting go after
   * dragging the special): the world presses the button for one frame, then
   * clears them.
   */
  attackTap: false,
  beamTap: false,
  /** A touch button being dragged, for the world's aim line; `cancel` when pulled back to its centre. `ult` is the Special's button. */
  aiming: null as { special: boolean; ult?: boolean; cancel: boolean } | null,
  /** Hotbar slots (0..8) asked to be used since the world last looked: taps on the HUD and keys 1 to 9. */
  items: [] as number[],
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
