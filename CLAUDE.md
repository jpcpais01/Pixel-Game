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
- `entry.ts` imports `main.ts` only after the page's load event (so the browser's loading bar ends at once). `main.ts` makes the Phaser game, fits the canvas, and drops the graphics level if the world runs below 30 FPS for 5 s.
- Flow: `BootScene` (builds every texture) → `HomeScene` → `SelectScene` (hero) → `ArenaScene` (the world map of Aurendel: pan/pinch/wheel, a landmark per arena on a road the hero walks, a panel with the picked arena's window and lore, online rooms) → `WorldScene`. An arena with a `mode` (Sky Glide) starts its own scene and HUD instead of the world (`ArenaScene.go`); `PauseScene` takes `{ world, ui }` to pause them. `ShopScene` (the Wishing Sanctum) and `InventoryScene` open over Home.
- Overlays while playing: `UIScene` (joystick, ability buttons, hotbar, buffs, gear HUD), `RiftScene` (the Rift's wave HUD, blessing cards and results), `PauseScene`, `ShadeScene` (brightness), `SoundScene` (mute), `FpsScene`.
- `src/diagnostics.ts`: crash reports (copyable overlay, heartbeat for killed tabs), switched off: set `CRASH_REPORTS` to true to use them again. `src/pwa.ts` + `scripts/pwa.ts`: install, fullscreen, service worker, icons.

**The world** (`src/scenes/WorldScene.ts`)
- Owns the hero, spawners, effects, pickups, lights, day/night, camera, and the combat API: `melee(area, strike)`, `strikeAt(x, y, strike)`, `firstHurtbox`, `hurtboxesWhere`, `hurtHero(harm)`, `popNumber`, `debris`, `addEffect`.
- Input comes from `game/controls.ts` (written by `UIScene` and the keyboard). PC: WASD, left click/J attack, right click/K/Shift ability, Space Special, 1-9 hotbar, N day/night, E talk (or swing the critter net).

**Heroes** (`src/game/`)
- `characters.ts`: `CLASSES` → types → skins. The world spawns a hero by look id (a type's id or a skin's id). `skins.ts` remembers the chosen look.
- One file per class: `Wizard.ts` (+ `Pyro.ts`, `Tide.ts` for the Tidecaller: splashing water bolts and a charged tidal wave that carries foes, art in `art/tide.ts` and the wizard rig's `tide` head, Special Maelstrom in `ultimate/tide.ts`, and `Druid.ts`, whose Grovekeeper and Shapeshifter play through the wizard's cast and charge), `Warrior.ts` (+ `Valkyrie.ts`, its own hero on the warrior's rig), `Paladin.ts`, `Jedi.ts`, `Fighter.ts`, `Alchemist.ts`, `Archer.ts`, `Rogue.ts`, `Necromancer.ts`, `Bard.ts`, `Chrono.ts`, `Puppeteer.ts`, `Samurai.ts`, and the Automaton's `Mech.ts` and `Synth.ts` (sharing the heat gauge in `heat.ts`: shots warm it, past 70% it hits harder, at the top it vents and stalls), and the Phantom's `Poltergeist.ts` and `Wraith.ts` (sharing `phase.ts`: the next blow passes through them, via the optional `Hero.dodge`, then it recharges). The Inventor's `Engineer.ts` (wrench combo, tossed sentry turrets: `Turret`, reused scaled up by the Mega Sentry) and `Scientist.ts` (chain lightning `Arc`, Polarity Orb; Einstein skin), art in `art/inventor.ts`, Specials in `ultimate/inventor.ts`. The Beastkin's `Beast.ts` (shared body, one move at a time with a landing moment) with `Eagle.ts` (feather fans, Gale), `Lion.ts` (claw chain, Roar) and `Dragon.ts` (firebolts, steered Flame breath); art for all three and their Benfica, Sporting and Porto skins in `art/beast.ts`, Specials in `ultimate/beast.ts`. Each implements `Hero` (`update(dt, mx, my, attack, special, bounds, aim)`) and takes a style/kit/skin object for its look.
- Shared effects: `Slash.ts` (`Effect` interface, blade FX, `Scheme` colours), `Beam.ts` (`PixelLayer`), `EnergyBall.ts`, `Arrows.ts`, `Toxins.ts`, `Souls.ts`, `Songs.ts`, `Strings.ts`, `Chronos.ts`, `Blades.ts`, `Fists.ts`, `Force.ts`, `Holy.ts`, `Shadows.ts`.
- Specials: `game/ultimate/index.ts` holds `ULTS` (by `class:type`) and `SKINS` (by `class:skin`, renamed and recoloured). `UltCaster` does the windup and spends energy (`energy.ts`). Effects live in `ultimate/*.ts`, icons in `ultimate/icons.ts`.
- `combat.ts`: `MeleeArea`, `Strike`, `Hit`, `Hurtbox`, `Harm`, `Vitals` (hp + barrier).

**Monsters** (`src/game/monsters/`)
- `Monster.ts`: base state machine (spawn, idle, wander, notice, chase, windup/attack/recover, hurt, return, dying), slows, strings, knockback. Species override `chase` and `act`.
- `index.ts`: `MONSTERS` registry, `Spawner` (respawns, and host sync online), `separate`.
- Bosses use `BossBar` and `noBar: true` and have a `rank` (`legend` or `myth`). `game/tiers.ts` gives every kind a tier, which sets its drops.

**Sky Glide** (`src/scenes/GlideScene.ts`, `GlideUIScene.ts`)
- Its own mode on the arena select: jump off the Floating Island under a paraglider in the hero's colour and ride down to the goal islet through rings, updrafts and wind rivers, round, over or under floating islets. Timed, with the best time per course in `collection.glide` (and the cloud), a ghost of the best run in localStorage, and online races in a room (the host starts; `gs`/`gp`/`gf` messages).
- `world/glideLayout.ts`: the course (rings, updrafts, lanes, islets, goal, checkpoints). `game/glide.ts`: the flight model (`stepFlight`), `glideHud`, `glideInput`, ghost recording. `art/glide.ts`: sea tile, cloud tops, islets, rings, swirls, arch, and `gliderSheet(accent)` painted in the page. Textures come from the `glide` arena job plus the island's (`warmGlide`).
- Height is drawn the game's way: z up is drawn z px higher than the spot below, where the shadow lies; the far sea scrolls at 0.35, far islands at 0.5, wisps above at 1.35.

**Arenas** (`src/world/`)
- World map: `realm.ts` (places, road legs, region labels, lore, and the player's progress: visited places part their fog, bosses slain plant a flag via `realm.slay` in `WorldScene.monsterSlain`); `art/worldMap.ts` paints terrain, road, props and landmarks, built as the `worldmap` job in the arena worker and warmed on the home screen.
- `arenas.ts`: `ARENAS` (clearing, garden, cosmos, spirit, temple, deep, rift, island). Each has a ground, spawn, monsters, `walkable`, scenery and a select-card preview; `solo: true` greys out Online for it.
- `*Layout.ts` files hold positions and walkability; the class files (`Garden.ts`, `Deep.ts`, `Sanctum.ts` for the Rune Temple...) build the arena's living parts.
- `GroundStreamer.ts` streams the ground in strips; painted arenas warm their textures in `art/textures.ts` (`warmCosmos`, `warmDeep`...).
- The Endless Rift (solo): `riftLayout.ts`, `art/rift.ts`, `world/Rift.ts` (tears, shards, violet light) and `game/rift.ts` (`RiftWaves`, a `Spawner` that builds each wave from a budget of Temple, Deep and garden monsters, a "Riftborn" champion every 5th wave, blessings picked between waves into `riftMods`, best wave per class in `collection.riftBest`). Monsters scale by `toughness`, `size` and `hunter` on `Monster`. Its warm job also warms the Temple and the Deep for their monster sheets.
- Omens (garden, cosmos, spirit, temple, deep; `OMEN_ARENAS`): every couple of minutes a random event with a banner and a turn of the light. `game/omens.ts` holds the eight (`OMENS`), `omenMods` (fury, pace, energy, gear rarity `bump`, dark) read by WorldScene like `riftMods`, and `omenHud` for `scenes/OmenScene.ts` (banner, top chip, the merchant's card). `world/Omens.ts` runs them: its own monsters come as extra `Spawner`s numbered from slot 1000 (the Treasure Imp, `monsters/Imp.ts`; Riftborn elites; fog ghosts); online the host picks and sends `o+`/`o-`/`ow`/`mo` and each omen's own messages. Art in `art/omens.ts` (built by `omenTextures` in `textures.ts` a few ms a frame); star dust drops as `Loot` `dust`.
- Echoes of the fallen: `game/echoes.ts` records the hero's last ~5 s (`EchoRecorder`) and shares a death through Firestore (`echoes/{arena}/slots/s0..s23`, a ring overwritten at random, cached locally); `world/Echoes.ts` raises up to 4 graves per arena that replay the fallen hero as a ghost and bless the toucher (buff id `echo`). Art in `art/echoes.ts`. Not in the clearing, the island or duels. Needs a Firestore rule allowing public read/write on that path.
- The Home (`home`, off the arena select, the Home button on the home screen): the player's own plot on a grid (`world/homeLayout.ts`, parts in `homeParts.ts`, runtime `world/Home.ts`, build tray `ui/buildHud.ts` + `game/build.ts`, invites `ui/homeFriends.ts`). Walls, floors, hipped roofs (`paintRoof` in `art/homeWalls.ts`) and 70+ parts (`art/homeProps.ts`) on the `home` sheet (`art/homeArt.ts`). Walk-in houses: the roof fades, the south wall drops to a stub (corners stay whole) and its wall decor hides. Seats and beds (`turns` on the part) face four ways (`Thing.turn`, R or the Turn pill; side and back views in `PROP_TURNS`, left is right mirrored, sides swap the footprint via `extent`). House shadows are swept from the walls and roof in `world/houseShadow.ts` and redrawn as the sun swings. Saved as `home`/`homeT` in the player's own save; online the host owns it and sends it in pieces. Caught critters can be let out from the tray's Critters tab (parts `critter_<id>`, up to `MAX_CRITTERS`, saved as things) and live round their spot by `world/HomeCritters.ts`: fireflies blink in threes, moths circle lamps at night, butterflies and ladybirds visit flowers, pond-lovers keep to water, fire-lovers curl up by the hearth; each keeps its hours and its side of a house's walls.
- Fishing (the Home's `fishrod` part, a rod in a pail; usable within `FISH_REACH` = 3 cells of water): `world/Fishing.ts` (cast, float, nibbles, bite, the reel's physics, the landing leap; the held rod and line drawn pixel by pixel), `scenes/FishScene.ts` (the gauge, hints, landed card, Put rod away), `game/fish.ts` (`FISH`: 12 fish, common/rare/legendary, some only at certain phases; `rollFish`; `fishHud` shared state). Art in `art/fish.ts` (fish sheet `fish`, anims `fish_<id>`, plaques, gauge shadows, `icon_rod`); the pail, its empty frame `rodbucket` and the `bobber` in `homeProps.ts`. Landed fish are `collection.fish`, shown on the Inventory's Fish tab (`ui/fishGallery.ts`).
- Trees (`art/trees.ts`: oak, birch, pine; the Home's cherry in `homeProps.ts`) sway: the still frames are built at boot, the sway (`tree_sway`, anims `tree_<kind><v>`) in the background by `game/treeSway.ts`; `Scenery` and the Home start them swaying when it's ready, and drop the odd leaf (`treeLeaves` in `world/Scenery.ts`).
- Arenas are built ahead: the home screen warms them a few ms a frame (`warmArenasInBackground` in `arenas.ts`); build jobs are keyed by the texture manager, so the arena select and the world carry on the same job. Arena cards save a picture of their window (`pixel-battle.thumb.<id>`, per build) to show at once on later launches.

**Loot and progression** (`src/game/`)
- `items.ts`: potions and the 9-slot hotbar. `buffs.ts`: timed buffs. `Pickup.ts`: items on the ground and the rare/epic/legendary drop shows.
- `gear.ts`: 70 pieces, 6 slots, 5 rarities, 5 boss sets (`GEAR_SETS`, `SET_BOSS`; a set piece's icon stands on its set's pattern, `setPattern` in `art/gear.ts`), stat caps, dust and upgrades. The Myth sets (Wyrmshard, Starborn) also give a power at 2, 4 and 6 pieces worn (`SET_POWERS`, `gear.powers`): `game/setPowers.ts` decides when (hooked into WorldScene's update, `hurtHero`, `monsterSlain` and `heroStruck`), `game/setFx.ts` draws them, their blows measured in the hero's own Damage; the Inventory card lists the tiers. `collection.ts`: what the player owns and wears, saved locally and to the cloud. `cloud.ts`: Firebase auth and Firestore over REST. `keepers.ts`: Nyx (disenchant) and Tharn (upgrade) in the Rune Temple, UI in `src/ui/keeper*.ts`.
- The Rune Temple (walk-in, at the Clearing's head in a glade of the treeline; `world/sanctumLayout.ts` footprint and walkability, `world/Sanctum.ts` roof fade, lights and keeper talk, art in `art/runeHall.ts` for the hall, steps and outside, `art/sanctum.ts` for the palette, runestones, stations and keepers). Nyx and Tharn stand on daises inside; walking up to one opens their counter. Walk-in buildings (it and the Forge) paint their hall on the ground, hide it under an outside sprite whose bottom is the front wall's foot, and fade that sprite while the hero is inside.
- The Forge (walk-in smithy on the Clearing's west, `world/forgeLayout.ts`, `world/Forge.ts`, art in `art/forge.ts`): Brenna forges a set piece the player is missing from `FORGE_COST` dust plus its boss's material (`game/forge.ts`: `MATERIALS`, `rollMats`; Legends drop 2-3, Myths 3-4, as `mat` pickups; saved as `collection.mats`). Her counter is `ui/forgeView.ts`, opened through `keeperHud.ts` as keeper `forge`. Drop tables are untouched.

**Gems, wishes and skins** (`src/game/`)
- Skins are locked until won; a type's own look is free. `skins.ts` falls back to the type's look for a skin not owned; the account `kel` (admin, `ADMINS` in `collection.ts`) owns every skin.
- `collection.ts` holds gems (200 to start, +5 a day via `claimDaily`, shown on Home), owned skins, and the pity count, all saved to the cloud (`cloud.ts`).
- `gacha.ts`: skin rarities (`RARITY_OF`, rare if unlisted), odds, costs (20 / 180 for ten), ten-wish epic guarantee, legendary pity, duplicates give back half a wish (`DUPE_GEMS`). New skins need a rarity there if not rare.
- Gem drops: `TIER_GEMS` / `rollGems` in `tiers.ts`; the drop show scales with the count (`gemShow` in `Pickup.ts`, `dropGems`/`gainGems` in `WorldScene`).
- Art in `art/shop.ts` (gems, piles, crystal, altar, hall, cards); sounds `gem*`, `wish*`, `cardFlip` in `audio/sfx.ts`.

**Seasons** (`src/game/season.ts`)
- `SEASONS`: a month-long event each. Hallow's Eve (October): candy (`collection.candy`, saved to the cloud) dropped by its monsters (`gourdling`, `hexbat`, the `pumpkin_king` Legend in the Sunken Garden; `game/monsters/Hallows.ts`, art in `art/hallowsMonsters.ts`) and a little by any monster, spent at Old Wick's stall in the Clearing (`world/Hallows.ts`: lanterns, fog, stall; art in `art/hallowsDecor.ts`; counter `ui/candyView.ts`, opened as `keeperCall` 'candy').
- `seasonalSpots` adds its monsters after an arena's own spots (so online slots match). Season skins (`SkinDef.season`) and pets (`PetDef.season`) are sold for candy and never wished for. `?season=hallows|off|auto` previews one on this device.
- A new season: an entry in `SEASONS`, its monsters, decor, and wares.

**Companions** (`src/game/pets.ts`, `src/game/Companion.ts`)
- `PETS`: 20 companions (rare/epic/legendary) with a perk in `mods` (Scarab's `reach` widens the loot magnet in `Pickup.ts`), a gait, the wyrmling's `fights`, the phoenix's `rebirth`, and a `power` for the newer epics and legendaries: `chill` (Snowpaw), `zap` (Nimbus), `ward` (Mossback, checked in `hurtHero`), `mend` (Pixie, via `WorldScene.mendHero`), `dive` (Gryphon), `lash` (Krakling), `hoard` (Mimic, on `cheer`). Their timings are consts at the top of `Companion.ts`; their effects are in `petPowers.ts`. Won from the Shop's second banner, the Wishing Nest (`petWish`, own pity `collection.petPity`, same odds and prices as skins); worn one is `collection.pet`, chosen on the Inventory's Companions tab (`ui/petGallery.ts`).
- `wearPet` fills `petMods`, which WorldScene multiplies in beside gear and `riftMods` (damage, speed, guard, regen, energy, and luck in `rollGems`). `Companion` follows the hero in the world.
- Art: `art/pets.ts` (24x24, 4 frames, facing right; the Nest's egg and cracks), registered as `pets` with `pet_<id>` anims; cards by `ui/petCard.ts`. The Nest mode in `ShopScene` (`setMode`) swaps the crystal for the egg, warms the hall and moves the shop music into its `nest` mood (`sound.setShopMood`).

**Critters** (`src/game/critters.ts`, `src/game/CritterField.ts`)
- `CRITTERS`: 18 critters, each with its arenas, `when` (day/night, in day/night arenas), rarity (common/rare/omen), gait and glow. `critterPool` picks what can come out now. Omen critters (Blood Moth, Gold Scarab) come out only while their Omen runs: the Omens code calls `setCritterOmen('blood-moon' | 'golden-hour' | null)`.
- `CritterField` (built by `WorldScene` in arenas listed in `CRITTER_ARENAS`, not in duels): a few near the hero at a time, startled by a running hero, caught with the net (touch net button in `UIScene` via `critterHud`/`controls.netTap`, or E). Caught ones are counted in `collection.critters` (saved locally and to the cloud) and shown as jars on shelves on the Inventory's Critters tab (`ui/critterGallery.ts`).
- Hazel the Naturalist buys spares (every catch after a kind's first) for dust, `CRITTER_PRICE` by rarity in `critters.ts`, `collection.sellCritters`: her camp on the Clearing's east lawn (`NATURALIST_CAMP` in `world/clearing.ts`, runtime `world/Naturalist.ts`, art `art/naturalist.ts`), counter `ui/critterView.ts`, opened as `keeperCall` 'critters'.
- Art in `art/critters.ts`: 16x16 frames (`critters`, anims `critter_<id>`), jars (`jars` sheet, frames `<id>_<f>` and `empty`, anims `jar_<id>`, glowing like lanterns via `jars_e`: ready for Home shelves), the net swing (`net`, `n0`..`n4`) and `icon_net`.

**Online play** (`src/net/`, `server/`)
- `server/server.js`: a WebSocket relay on Render with 4-letter room codes (co-op up to 4, duel 2). It runs no game logic.
- `session.ts`: the connection and room. `NetPlay.ts`: sends hero state every 50 ms; the host sends monsters every 100 ms; hits, slows and binds on monsters are relayed. `Remote.ts`: other players' heroes, run from their inputs through a "ghost" world whose blows hurt nothing. `ghost.ts`: keeps remote heroes from touching this player's buffs and energy.

**Art** (`src/art/`)
- `pixel.ts`: the engine. Shapes carry a material and a surface normal; `render()` gives diffuse, normal map and emissive layers.
- One file per hero (`wizard.ts`, `fighter.ts`, `mech.ts`, `synth.ts`, `poltergeist.ts`, `wraith.ts`...) with its looks (`*_LOOKS`) and animations; the Druid is drawn by `wizard.ts` (heads `grove`, `wild`) and the Valkyrie by `warrior.ts` (the `valkyrie` flag: wings, winged helm, braids, spear), with their materials and button icons in `druid.ts` and `valkyrie.ts`; monster sheets in `monsters.ts`, `ghosts.ts`, `deepMonsters.ts`, boss files; arenas in `garden.ts`, `deep.ts`, `sanctum.ts`...
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

**Add an arena:** an `ArenaDef` in `src/world/arenas.ts`, a layout file, and any living parts built by id in `WorldScene.create`. For the world map: a `Place` (spot, region, lore, bosses) and a `Leg` of road in `src/world/realm.ts`, and a landmark painter in `LANDMARK_ART`/`LANDMARKS` in `src/art/worldMap.ts` (until then it stands at a spare spot with a waymarker).

**Add a companion:** a drawing in `PET_ART` (`src/art/pets.ts`) and a `PetDef` in `PETS` (`src/game/pets.ts`); keep its name to 8 letters and its perk to about 14 so they fit the cards.

**Add gear:** a `piece(...)` in `GEAR` (`src/game/gear.ts`) and its painter in `src/art/gear.ts`.
