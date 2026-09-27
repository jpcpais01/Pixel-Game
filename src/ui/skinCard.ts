// The face of a skin's card, shared by the shop's wishes and the Inventory's
// skins page: a jewelled frame in the skin's rarity, the hero standing in its
// window, its name on the plate and the rarity's stars under it.

import Phaser from 'phaser';
import { RARITY_INFO, wornSkin, type SkinEntry } from '../game/gacha';
import { addBitmap, cardFront } from '../art/shop';
import { cropToWindow, fitLine } from '../scenes/SelectScene';
import { pixelText } from './widgets';

/** The name plate along a card's bottom (see art/shop.ts cardFront). */
export const PLATE = 22;

export interface SkinFace {
  /** Everything on the card, centred on (0, 0), to add to a container. */
  parts: Phaser.GameObjects.GameObject[];
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite | null;
}

/**
 * A `w` x `h` card for `entry`, the hero drawn `scale` times over, idling.
 * `title` writes a line across the top of the window (its class, say).
 */
export function skinFace(scene: Phaser.Scene, entry: SkinEntry, w: number, h: number, scale: number, title?: { text: string; tint: number }): SkinFace {
  const info = RARITY_INFO[entry.rarity];
  const front = scene.add.image(0, 0, addBitmap(scene, `wish_card_${entry.rarity}_${w}x${h}`, cardFront(w, h, info.tint, info.deep, entry.rarity === 'legendary')));
  // The hero stands in the window, feet a little above the name plate.
  const p = wornSkin(entry).preview;
  const feet = h / 2 - PLATE - 2;
  const oy = p.originY ?? 31 / 32;
  const sprite = scene.add.sprite(0, feet, p.texture).setOrigin(0.5, oy).setScale(scale);
  sprite.play(p.idle);
  cropToWindow(sprite, p, w - 8, h - PLATE - 8, 2, scale);
  const parts: Phaser.GameObjects.GameObject[] = [front, sprite];
  let glow: Phaser.GameObjects.Sprite | null = null;
  if (p.glow) {
    glow = scene.add.sprite(0, feet, p.glow).setOrigin(0.5, oy).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    cropToWindow(glow, p, w - 8, h - PLATE - 8, 2, scale);
    parts.push(glow);
  }
  const probe = pixelText(scene, 0, 0, '').setVisible(false);
  const name = pixelText(scene, 0, 0, fitLine(probe, entry.skin.name, w - 8), info.core);
  name.setPosition(Math.round(-name.width / 2), Math.round(h / 2 - PLATE + 3));
  parts.push(name);
  // The rarity's stars under the name.
  const starW = 6;
  const sx = Math.round(-(info.stars * starW) / 2);
  for (let i = 0; i < info.stars; i++) parts.push(scene.add.image(sx + i * starW, h / 2 - 8, 'icon_star').setOrigin(0).setTint(info.tint));
  if (title) {
    const t = pixelText(scene, 0, 0, fitLine(probe, title.text, w - 10), title.tint);
    t.setPosition(Math.round(-t.width / 2), Math.round(-h / 2 + 6));
    parts.push(t);
  }
  probe.destroy();
  return { parts, sprite, glow };
}
