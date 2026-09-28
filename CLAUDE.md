# Myths and Legends

Mobile-first, top-down pixel-art PvE game built with Phaser 3, TypeScript and Vite. All art and sound are generated in code: there are no image or audio files. It is a PWA and deploys to Vercel from `main`. See README.md for the player-facing overview.

## Working rules

- Don't test, playtest or visualize everything along the way. Write good, logical code, and only do a light verification at the end if it seems necessary.
- Don't build or publish a preview Artifact (João, 2026-09-26). Just work on the code: merge to main, and the Vercel site deploys from there.
- Match the existing style: plain-English comments that explain why, `const` tuning numbers at the top of a file, no new dependencies.

## Commands

- `npm run dev`: dev server. `npm run build`: `tsc --noEmit` then `vite build`. `npm run typecheck`: types only.
- `npm run sheet` / `icons` / `gear`: write sprite sheets, app icons and gear icons to disk for reviewing art.

## Map of the code

**Startup and scenes** (`src/main.ts`, `src/scenes/`)
- `main.ts` makes the Phaser game, fits the canvas, and drops the graphics level if the world runs below 30 FPS for 5 s.
- Flow: `BootScene` (builds every texture) → `HomeScene` → `SelectScene` (hero) → `ArenaScene` (arena, and online rooms) → `WorldScene`. `ShopScene` (the Wishing Sanctum) and `InventoryScene` open over Home.
- Overlays while playing: `UIScene` (joystick, ability buttons, hotbar, buffs, gear HUD), `RiftScene` (the Rift's wave HUD, blessing cards and results), `PauseScene`, `ShadeScene` (brightness), `SoundScene` (mute), `FpsScene`.
- `src/diagnostics.ts`: crash reports (copyable overlay, heartbeat for killed tabs), switched off: set `CRASH_REPORTS` to true to use them again. `src/pwa.ts` + `scripts/pwa.ts`: install, fullscreen, service worker, icons.

**The world** (`src/scenes/WorldScene.ts`)
- Owns the hero, spawners, effects, pickups, lights, day/night, camera, and the combat API: `melee(area, strike)`, `strikeAt(x, y, strike)`, `firstHurtbox`, `hurtboxesWhere`, `hurtHero(harm)`, `popNumber`, `debris`, `addEffect`.
- Input comes from `game/controls.ts` (written by `UIScene` and the keyboard). PC: WASD, left click/J attack, right click/K/Shift ability, Space Special, 1-9 hotbar, N day/night, E talk.

**Heroes** (`src/game/`)
- `characters.ts`: `CLASSES` → types → skins. The world spawns a hero by look id (a type's id or a skin's id). `skins.ts` remembers the chosen look.
- One file per class: `Wizard.ts` (+ `Pyro.ts`, and `Druid.ts`, whose Grovekeeper and Shapeshifter play through the wizard's cast and charge), `Warrior.ts` (+ `Valkyrie.ts`, its own hero on the warrior's rig), `Paladin.ts`, `Jedi.ts`, `Fighter.ts`, `Alchemist.ts`, `Archer.ts`, `Rogue.ts`, `Necromancer.ts`, `Bard.ts`, `Chrono.ts`, `Puppeteer.ts`, `Samurai.ts`. Each implements `Hero` (`update(dt, mx, my, attack, special, bounds, aim)`) and takes a style/kit/skin object for its look.
- Shared effects: `Slash.ts` (`Effect` interface, blade FX, `Scheme` colours), `Beam.ts` (`PixelLayer`), `EnergyBall.ts`, `Arrows.ts`, `Toxins.ts`, `Souls.ts`, `Songs.ts`, `Strings.ts`, `Chronos.ts`, `Blades.ts`, `Fists.ts`, `Force.ts`, `Holy.ts`, `Shadows.ts`.
- Specials: `game/ultimate/index.ts` holds `ULTS` (by `class:type`) and `SKINS` (by `class:skin`, renamed and recoloured). `UltCaster` does the windup and spends energy (`energy.ts`). Effects live in `ultimate/*.ts`, icons in `ultimate/icons.ts`.
- `combat.ts`: `MeleeArea`, `Strike`, `Hit`, `Hurtbox`, `Harm`, `Vitals` (hp + barrier).

**Monsters** (`src/game/monsters/`)
- `Monster.ts`: base state machine (spawn, idle, wander, notice, chase, windup/attack/recover, hurt, return, dying), slows, strings, knockback. Species override `chase` and `act`.
- `index.ts`: `MONSTERS` registry, `Spawner` (respawns, and host sync online), `separate`.
- Bosses use `BossBar` and `noBar: true` and have a `rank` (`legend` or `myth`). `game/tiers.ts` gives every kind a tier, which sets its drops.

**Arenas** (`src/world/`)
- `arenas.ts`: `ARENAS` (clearing, garden, cosmos, spirit, temple, deep, rift, island). Each has a ground, spawn, monsters, `walkable`, scenery and a select-card preview; `solo: true` greys out Online for it.
- `*Layout.ts` files hold positions and walkability; the class files (`Garden.ts`, `Deep.ts`, `Sanctum.ts` for the Rune Temple...) build the arena's living parts.
- `GroundStreamer.ts` streams the ground in strips; painted arenas warm their textures in `art/textures.ts` (`warmCosmos`, `warmDeep`...).
- The Endless Rift (solo): `riftLayout.ts`, `art/rift.ts`, `world/Rift.ts` (tears, shards, violet light) and `game/rift.ts` (`RiftWaves`, a `Spawner` that builds each wave from a budget of Temple, Deep and garden monsters, a "Riftborn" champion every 5th wave, blessings picked between waves into `riftMods`, best wave per class in `collection.riftBest`). Monsters scale by `toughness`, `size` and `hunter` on `Monster`. Its warm job also warms the Temple and the Deep for their monster sheets.
- Arenas are built ahead: the home screen warms them a few ms a frame (`warmArenasInBackground` in `arenas.ts`); build jobs are keyed by the texture manager, so the arena select and the world carry on the same job. Arena cards save a picture of their window (`pixel-battle.thumb.<id>`, per build) to show at once on later launches.

**Loot and progression** (`src/game/`)
- `items.ts`: potions and the 9-slot hotbar. `buffs.ts`: timed buffs. `Pickup.ts`: items on the ground and the rare/epic/legendary drop shows.
- `gear.ts`: 70 pieces, 6 slots, 5 rarities, 5 boss sets (`GEAR_SETS`, `SET_BOSS`; a set piece's icon stands on its set's pattern, `setPattern` in `art/gear.ts`), stat caps, dust and upgrades. `collection.ts`: what the player owns and wears, saved locally and to the cloud. `cloud.ts`: Firebase auth and Firestore over REST. `keepers.ts`: Nyx (disenchant) and Tharn (upgrade) in the Rune Temple, UI in `src/ui/keeper*.ts`.

**Gems, wishes and skins** (`src/game/`)
- Skins are locked until won; a type's own look is free. `skins.ts` falls back to the type's look for a skin not owned; the account `kel` (admin, `ADMINS` in `collection.ts`) owns every skin.
- `collection.ts` holds gems (200 to start, +5 a day via `claimDaily`, shown on Home), owned skins, and the pity count, all saved to the cloud (`cloud.ts`).
- `gacha.ts`: skin rarities (`RARITY_OF`, rare if unlisted), odds, costs (20 / 180 for ten), ten-wish epic guarantee, legendary pity, duplicates give back half a wish (`DUPE_GEMS`). New skins need a rarity there if not rare.
- Gem drops: `TIER_GEMS` / `rollGems` in `tiers.ts`; the drop show scales with the count (`gemShow` in `Pickup.ts`, `dropGems`/`gainGems` in `WorldScene`).
- Art in `art/shop.ts` (gems, piles, crystal, altar, hall, cards); sounds `gem*`, `wish*`, `cardFlip` in `audio/sfx.ts`.

**Companions** (`src/game/pets.ts`, `src/game/Companion.ts`)
- `PETS`: 8 companions (rare/epic/legendary) with a perk in `mods`, a gait, and the wyrmling's `fights` and the phoenix's `rebirth`. Won from the Shop's second banner, the Wishing Nest (`petWish`, own pity `collection.petPity`, same odds and prices as skins); worn one is `collection.pet`, chosen on the Inventory's Companions tab (`ui/petGallery.ts`).
- `wearPet` fills `petMods`, which WorldScene multiplies in beside gear and `riftMods` (damage, speed, guard, regen, energy, and luck in `rollGems`). `Companion` follows the hero in the world.
- Art: `art/pets.ts` (24x24, 4 frames, facing right; the Nest's egg and cracks), registered as `pets` with `pet_<id>` anims; cards by `ui/petCard.ts`. The Nest mode in `ShopScene` (`setMode`) swaps the crystal for the egg, warms the hall and moves the shop music into its `nest` mood (`sound.setShopMood`).

**Online play** (`src/net/`, `server/`)
- `server/server.js`: a WebSocket relay on Render with 4-letter room codes (co-op up to 4, duel 2). It runs no game logic.
- `session.ts`: the connection and room. `NetPlay.ts`: sends hero state every 50 ms; the host sends monsters every 100 ms; hits, slows and binds on monsters are relayed. `Remote.ts`: other players' heroes, run from their inputs through a "ghost" world whose blows hurt nothing. `ghost.ts`: keeps remote heroes from touching this player's buffs and energy.

**Art** (`src/art/`)
- `pixel.ts`: the engine. Shapes carry a material and a surface normal; `render()` gives diffuse, normal map and emissive layers.
- One file per hero (`wizard.ts`, `fighter.ts`...) with its looks (`*_LOOKS`) and animations; the Druid is drawn by `wizard.ts` (heads `grove`, `wild`) and the Valkyrie by `warrior.ts` (the `valkyrie` flag: wings, winged helm, braids, spear), with their materials and button icons in `druid.ts` and `valkyrie.ts`; monster sheets in `monsters.ts`, `ghosts.ts`, `deepMonsters.ts`, boss files; arenas in `garden.ts`, `deep.ts`, `sanctum.ts`...
- `textures.ts`: `buildAllTextures` packs and registers everything, and creates animations named `<key>_<anim>_<dir>`. Every lit texture has `_e` (emissive), `_s` (shadow) and, for monsters, `_w` (hit flash) companions.
- Icons: `effects.ts`, `heroSkins.ts`, `moreSkinIcons.ts`; gear icons in `gear.ts`.

**Rendering** (`src/game/`): `LitPipeline.ts` (sun or moon plus sky light on top of Light2D), `PixelPipeline.ts` (ground drawn at art resolution, then scaled up), `SkyPipeline.ts` (cloud shadows and vignette), `display.ts` (pixel ratio, zoom, `snap`), `settings.ts` (quality, zoom, volumes, brightness, screen shake: off stills every camera shake, patched in `main.ts`).

**Audio** (`src/audio/`): everything synthesised with Web Audio: `music.ts`, `ambience.ts`, `sfx.ts`, through `mixer.ts`; `index.ts` exposes `sound`.

## Recipes

**Add a skin to a type** (as in the recent skin PRs):
1. A look in `src/art/<class>.ts`: new materials, spread the type's look, give it a new `key`, add any new shapes, and add it to `<CLASS>_LOOKS`.
2. Make sure `src/art/textures.ts` registers it (most classes loop over their `*_LOOKS`) and paints its ability icons (`effects.ts`, `heroSkins.ts` or `moreSkinIcons.ts`).
3. A style or kit in `src/game/<Class>.ts` with its effect colours, and pick it in the class's `spawn` in `characters.ts`.
4. A `SkinDef` in `characters.ts` (id unique within the class, name, role, accent, ability names, preview, buttons).
5. A renamed, recoloured Special in `SKINS` in `src/game/ultimate/index.ts` (with `type` if the skin isn't on the base type).
6. Its rarity in `RARITY_OF` in `src/game/gacha.ts` if it isn't rare. It joins the wish pool by itself.

**Add a monster:** a class in `src/game/monsters/` extending `Monster`, its sheet in `src/art/` registered with `registerMonster` in `textures.ts`, an entry in `MONSTERS`, a tier in `MOB_TIER` (`tiers.ts`), and spawn spots in an arena's layout.

**Add an arena:** an `ArenaDef` in `src/world/arenas.ts`, a layout file, and any living parts built by id in `WorldScene.create`.

**Add a companion:** a drawing in `PET_ART` (`src/art/pets.ts`) and a `PetDef` in `PETS` (`src/game/pets.ts`); keep its name to 8 letters and its perk to about 14 so they fit the cards.

**Add gear:** a `piece(...)` in `GEAR` (`src/game/gear.ts`) and its painter in `src/art/gear.ts`.
