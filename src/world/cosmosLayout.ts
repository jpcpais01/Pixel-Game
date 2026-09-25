// The Cosmos Arena's shape: a round platform of star-stone floating in deep
// space, seen from a little above, so its circle reads as an ellipse with
// its rocky side hanging below. Pure functions of arena coordinates, shared
// by the art (art/cosmos.ts) and the game (world/Cosmos.ts).

export const COSMOS_W = 720;
export const COSMOS_H = 600;
/** The platform's centre and its top surface's radii. */
export const COSMOS_CX = 360;
export const COSMOS_CY = 290;
export const COSMOS_RX = 170;
export const COSMOS_RY = 128;
/** How far the platform's side hangs below its top edge, at the front. */
export const COSMOS_RIM = 26;

/** Where heroes arrive: the platform's south edge, facing the Warden. */
export const COSMOS_SPAWN = { x: COSMOS_CX, y: COSMOS_CY + 98 };

/** Six obelisks stand around the rim; the way in from the south is left open. */
export const OBELISKS: { x: number; y: number }[] = [0, 60, 120, 180, 240, 300].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.round(COSMOS_CX + Math.cos(a) * COSMOS_RX * 0.87), y: Math.round(COSMOS_CY + Math.sin(a) * COSMOS_RY * 0.87) };
});

/** Distance from the centre in radii: 1 on the top surface's edge. */
export function cosmosR(x: number, y: number): number {
  return Math.hypot((x - COSMOS_CX) / COSMOS_RX, (y - COSMOS_CY) / COSMOS_RY);
}

/** Can feet stand here? On the platform, inside its rim, and not in an obelisk. */
export function cosmosWalkable(x: number, y: number): boolean {
  const u = (x - COSMOS_CX) / (COSMOS_RX - 7);
  const v = (y - COSMOS_CY) / (COSMOS_RY - 5);
  if (u * u + v * v > 1) return false;
  for (const o of OBELISKS) {
    const dx = (x - o.x) / 8;
    const dy = (y - o.y) / 4.5;
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}

/** A random spot on the platform at most `r` radii from the centre. */
export function cosmosSpot(r: number, rand = Math.random): { x: number; y: number } {
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * r;
  return { x: COSMOS_CX + Math.cos(a) * d * COSMOS_RX, y: COSMOS_CY + Math.sin(a) * d * COSMOS_RY };
}
