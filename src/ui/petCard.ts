// The face of a companion's card, for the shop's companion wishes and the
// Inventory's companions page: the same jewelled frame as a skin's, the
// companion drawn big in its window, its name on the plate, the rarity's
// stars, and (on a big card) what it does across the top.

import Phaser from 'phaser';
import { RARITY_INFO, SKIN_RARITIES } from '../game/gacha';
import type { PetDef } from '../game/pets';
import { addBitmap, cardFront } from '../art/shop';
import { PET_H, PET_OX, PET_OY, PET_W } from '../art/pets';
import { fitLine } from '../scenes/SelectScene';
import { PLATE, type SkinFace } from './skinCard';
import { pixelText } from './widgets';

const COMPACT_PLATE = 13;

/** A `w` x `h` card for companion `pet`, drawn `scale` times over; `perk` writes what it does across the top. */
export function petFace(scene: Phaser.Scene, pet: PetDef, w: number, h: number, scale: number, perk = false, compact = false): SkinFace {
  const info = RARITY_INFO[pet.rarity];
  const plate = compact ? COMPACT_PLATE : PLATE;
  const front = scene.add.image(0, 0, addBitmap(scene, `wish_card_${pet.rarity}_${w}x${h}_${plate}`, cardFront(w, h, info.tint, info.deep, SKIN_RARITIES.indexOf(pet.rarity), plate)));
  // Stood a little above the plate; a soft light of its own colour behind it.
  const feet = h / 2 - plate - 4;
  const halo = scene.add.image(0, feet - (PET_OY - 10) * scale * 0.5, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(pet.tint).setAlpha(0.3).setScale(scale * 0.55);
  const sprite = scene.add.sprite(0, feet, 'pets', `${pet.id}_0`).setOrigin(PET_OX / PET_W, PET_OY / PET_H).setScale(scale).play(`pet_${pet.id}`);
  const glow = scene.add.sprite(0, feet, 'pets_e', `${pet.id}_0`).setOrigin(PET_OX / PET_W, PET_OY / PET_H).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
  const parts: Phaser.GameObjects.GameObject[] = [front, halo, sprite, glow];
  const probe = pixelText(scene, 0, 0, '').setVisible(false);
  const name = pixelText(scene, 0, 0, fitLine(probe, pet.name, w - 8), info.core);
  name.setPosition(Math.round(-name.width / 2), Math.round(h / 2 - plate + 3));
  parts.push(name);
  const starW = 6;
  const sx = Math.round(-(info.stars * starW) / 2);
  const sy = compact ? Math.round(-h / 2 + 5) : h / 2 - 8;
  for (let i = 0; i < info.stars; i++) parts.push(scene.add.image(sx + i * starW, sy, 'icon_star').setOrigin(0).setTint(info.tint));
  if (perk && !compact) {
    const t = pixelText(scene, 0, 0, fitLine(probe, pet.perk, w - 10), pet.tint);
    t.setPosition(Math.round(-t.width / 2), Math.round(-h / 2 + 6));
    parts.push(t);
  }
  probe.destroy();
  return { parts, sprite, glow };
}
