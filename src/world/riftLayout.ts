// The Endless Rift's shape: a round platform of obsidian adrift in a
// swirling void, seen from a little above (so its circle reads as an ellipse
// with its broken side hanging below). Six tears in the air ring it, where
// each wave pours through, and four shards of obsidian stand on it to fight
// round. Pure functions of arena coordinates, shared by the art (art/rift.ts)
// and the game (world/Rift.ts, game/rift.ts).

export const RIFT_W = 720;
export const RIFT_H = 620;
/** The platform's centre and its top surface's radii. */
export const RIFT_CX = 360;
export const RIFT_CY = 310;
export const RIFT_RX = 190;
export const RIFT_RY = 140;
/** How far the platform's side hangs below its top edge, at the front. */
export const RIFT_RIM = 36;

/** The hero stands at the heart of the seal. */
export const RIFT_SPAWN = { x: RIFT_CX, y: RIFT_CY + 12 };

/** Where the tears hang, round the edge of the platform: monsters step out of them. */
export const TEARS: { x: number; y: number }[] = [30, 90, 150, 210, 270, 330].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.round(RIFT_CX + Math.cos(a) * RIFT_RX * 0.8), y: Math.round(RIFT_CY + Math.sin(a) * RIFT_RY * 0.8) };
});

/** Four obsidian shards between the seal and the tears, cover to fight round. */
export const SHARDS: { x: number; y: number; v: number }[] = [45, 135, 225, 315].map((deg, i) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.round(RIFT_CX + Math.cos(a) * RIFT_RX * 0.5), y: Math.round(RIFT_CY + Math.sin(a) * RIFT_RY * 0.5), v: i };
});

/** Distance from the centre in radii: 1 on the top surface's edge. */
export function riftR(x: number, y: number): number {
  return Math.hypot((x - RIFT_CX) / RIFT_RX, (y - RIFT_CY) / RIFT_RY);
}

/** Can feet stand here? On the platform, inside its rim, and clear of the shards. */
export function riftWalkable(x: number, y: number): boolean {
  const u = (x - RIFT_CX) / (RIFT_RX - 8);
  const v = (y - RIFT_CY) / (RIFT_RY - 6);
  if (u * u + v * v > 1) return false;
  for (const s of SHARDS) {
    const dx = (x - s.x) / 7.5;
    const dy = (y - s.y) / 4;
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}
