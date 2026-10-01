// The face of a skin's card, shared by the shop's wishes and the Inventory's
// skins page: a jewelled frame in the skin's rarity, the hero standing in its
// window, its name on the plate and the rarity's stars under it.

import Phaser from 'phaser';
import { RARITY_INFO, SKIN_RARITIES, wornSkin, type SkinEntry } from '../game/gacha';
import { addBitmap, cardFront } from '../art/shop';
import { cropToWindow, fitLine } from '../scenes/SelectScene';
import { pixelText } from './widgets';

/** The name plate along a card's bottom (see art/shop.ts cardFront): the name with the stars under it, or (compact) the name alone. */
export const PLATE = 22;
const COMPACT_PLATE = 13;

export interface SkinFace {
  /** Everything on the card, centred on (0, 0), to add to a container. */
  parts: Phaser.GameObjects.GameObject[];
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite | null;
}

/**
 * A `w` x `h` card for `entry`, the hero drawn `scale` times over, idling.
 * `title` writes a line across the top of the window (its class, say).
 * `compact` gives the hero more room on a short card: a slim plate with the
 * name alone, the stars moving up across the top of the window (and no title).
 */
export function skinFace(scene: Phaser.Scene, entry: SkinEntry, w: number, h: number, scale: number, title?: { text: string; tint: number }, compact = false): SkinFace {
  const info = RARITY_INFO[entry.rarity];
  const plate = compact ? COMPACT_PLATE : PLATE;
  const front = scene.add.image(0, 0, addBitmap(scene, `wish_card_${entry.rarity}_${w}x${h}_${plate}`, cardFront(w, h, info.tint, info.deep, SKIN_RARITIES.indexOf(entry.rarity), plate)));
  // The hero stands in the window, feet a little above the name plate.
  const p = wornSkin(entry).preview;
  const feet = h / 2 - plate - 2;
  const oy = p.originY ?? 31 / 32;
  const sprite = scene.add.sprite(0, feet, p.texture).setOrigin(0.5, oy).setScale(scale);
  sprite.play(p.idle);
  cropToWindow(sprite, p, w - 8, h - plate - 8, 2, scale);
  const parts: Phaser.GameObjects.GameObject[] = [front, sprite];
  let glow: Phaser.GameObjects.Sprite | null = null;
  if (p.glow) {
    glow = scene.add.sprite(0, feet, p.glow).setOrigin(0.5, oy).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    cropToWindow(glow, p, w - 8, h - plate - 8, 2, scale);
    parts.push(glow);
  }
  const probe = pixelText(scene, 0, 0, '').setVisible(false);
  const name = pixelText(scene, 0, 0, fitLine(probe, entry.skin.name, w - 8), info.core);
  name.setPosition(Math.round(-name.width / 2), Math.round(h / 2 - plate + 3));
  parts.push(name);
  // The rarity's stars under the name, or across the top of the window.
  const starW = 6;
  const sx = Math.round(-(info.stars * starW) / 2);
  const sy = compact ? Math.round(-h / 2 + 5) : h / 2 - 8;
  for (let i = 0; i < info.stars; i++) parts.push(scene.add.image(sx + i * starW, sy, 'icon_star').setOrigin(0).setTint(info.tint));
  if (title && !compact) {
    const t = pixelText(scene, 0, 0, fitLine(probe, title.text, w - 10), title.tint);
    t.setPosition(Math.round(-t.width / 2), Math.round(-h / 2 + 6));
    parts.push(t);
  }
  probe.destroy();
  return { parts, sprite, glow };
}
