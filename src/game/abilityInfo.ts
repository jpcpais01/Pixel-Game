// What each type's moves do, in a line or two for the in-game "i" card (ui/statsHud.ts).
// Skins keep their type's moves (only names and colours change), so this is by type.

export interface AbilityInfo {
  /** The basic attack. */
  attack: string;
  /** The normal ability. */
  ability: string;
  /** The Special (energy ultimate). */
  special: string;
}

/** By `class.type` id, as in stats.ts HERO_STATS. */
export const ABILITY_INFO: Record<string, AbilityInfo> = {
  'wizard.arcane': {
    attack: 'Hurls a crackling ball of light at the first foe it meets.',
    ability: 'Hold to charge a beam that burns through a whole line of foes.',
    special: 'A black star drags foes in, then bursts in a nova.',
  },
  'wizard.pyro': {
    attack: 'Lobs a fireball that bursts and sets nearby foes on fire.',
    ability: 'Hold to charge, then a meteor falls and scorches a wide circle.',
    special: 'Pillars of fire erupt one after another along the aim.',
  },
  'wizard.tide': {
    attack: 'Fires a water bolt whose splash throws foes back hard.',
    ability: 'Hold to charge a wave that rolls out and carries foes away.',
    special: 'A whirlpool drags foes in, grinds them, then spouts them away.',
  },
  'warrior.knight': {
    attack: 'A slash, a backhand and a lunging thrust.',
    ability: 'A steerable whirlwind of fire that ends in a shockwave.',
    special: 'A giant blade of light drops from the sky and splits the ground.',
  },
  'warrior.king': {
    attack: 'Two heavy swings, then a chop that bursts where it lands.',
    ability: 'A ring of light strikes, holds foes kneeling and gives a barrier.',
    special: 'A crown of light slams down, then pillars force foes to kneel.',
  },
  'paladin.holy': {
    attack: 'An overhead mace smite that heals for each foe it strikes.',
    ability: 'Consecrates the ground, burning foes in it and healing the hero.',
    special: 'Light heals and shields the hero as rings of holy fire roll out.',
  },
  'paladin.crusader': {
    attack: 'Slow, heavy hammer blows that heal a little.',
    ability: 'Sunfire throws foes back, shields and powers up the hammer.',
    special: 'A small sun overhead hurls rays of fire at every foe around.',
  },
  'jedi.knight': {
    attack: 'A fast forehand, backhand, then a twirl that cuts all round.',
    ability: 'A wave of the Force blasts foes in a cone ahead.',
    special: 'The saber spins out along the aim, whirls there, then flies home.',
  },
  'jedi.sith': {
    attack: 'Wide sweeps that also cut behind, then a whirling lunge.',
    ability: 'Lightning pours into foes ahead, jumping on and slowing them.',
    special: 'Lifts and squeezes foes on a spot, draining life, then crushes.',
  },
  'fighter.brawler': {
    attack: 'A five-punch combo ending in a flying straight that launches.',
    ability: 'A stream of chi fists hammers far ahead, ending in a finisher.',
    special: 'A fire dragon dash through every foe in the way, ending in a blast.',
  },
  'fighter.monk': {
    attack: 'Three palm strikes, the last driving a wall of force ahead.',
    ability: 'Leaps to the aim and lands in a ring that hurls foes away.',
    special: "Three quakes raise rings of stone spikes and turn the hero's skin to stone.",
  },
  'alchemist.plague': {
    attack: 'Lobs a flask that splashes foes with stacking poison.',
    ability: 'Hurls a great flask that leaves a lasting bog of poison.',
    special: 'A churning miasma settles on a spot, poisoning deeper and deeper.',
  },
  'alchemist.chem': {
    attack: 'Quick, short throws of corrosive chem that stacks higher.',
    ability: 'Fans out three canisters, each leaving a small chem pool.',
    special: 'A great canister bursts in a towering blast, leaving acid behind.',
  },
  'archer.ranger': {
    attack: 'Fast, straight arrows that strike the first foe in their path.',
    ability: 'A volley rains arrows on a ring, striking foes again and again.',
    special: 'One huge arrow pierces everything along the aim.',
  },
  'archer.arbalest': {
    attack: 'A heavy bolt that punches through two foes, then a slow crank to reload.',
    ability: 'Kneels and fires a net bolt: foes under the net are slowed to a crawl.',
    special: 'Lobs a powder keg on a spot; after a short fuse it blows everything back.',
  },
  'archer.wind': {
    attack: 'Three short arrows in a fan, loosed without slowing down.',
    ability: 'Flips back out of reach, firing a gale arrow that pierces and blows foes away.',
    special: 'A walking cyclone pulls foes in, wears at them, then flings them away.',
  },
  'rogue.rogue': {
    attack: 'Two bleeding stabs, then an X cut that rips the wounds open.',
    ability: 'Dashes through foes unharmed, then hides for a double-damage ambush.',
    special: 'Three rings of daggers burst out, leaving foes bleeding.',
  },
  'rogue.dancer': {
    attack: 'Four wide, light cuts, the last a spin all round.',
    ability: 'Blinks from foe to foe nearby, striking each, untouchable.',
    special: 'A dark ring where blades cut every foe inside, while the hero is untouchable.',
  },
  'necromancer.necro': {
    attack: 'Soul bolts that curve into foes.',
    ability: 'Raises three skeletons at the aim to fight for a while.',
    special: 'A ring of souls whirls out, biting foes and feeding their life back.',
  },
  'necromancer.blood': {
    attack: 'Fast lances that pierce three foes and heal for each hit.',
    ability: "Spends the hero's own blood on a nova that hits and drains foes around.",
    special: 'A crimson moon rains lances of blood on foes below, then bursts.',
  },
  'bard.minstrel': {
    attack: 'Lute notes that bend toward foes and leap from one to the next.',
    ability: "A song that quickens the hero's feet and heals.",
    special: 'Heals and quickens as a ring of notes flies out at foes.',
  },
  'bard.drummer': {
    attack: 'Two beats and a boom, waves of sound that throw foes back.',
    ability: 'A great beat shoves foes off, then every blow hits harder a while.',
    special: 'Five great beats shake the ground and hurl foes back.',
  },
  'chronomancer.keeper': {
    attack: 'Second hands of light that slow foes more with each hit.',
    ability: 'Sets a clock on the ground that all but stops foes until it strikes.',
    special: 'Freezes everything around under a great clock, then strikes all.',
  },
  'chronomancer.paradox': {
    attack: 'Throws shards, and an echo throws them again a moment later.',
    ability: 'Snaps back to a spot from moments ago, undoing wounds since.',
    special: 'Four echoes of the hero step out and throw shards at foes near.',
  },
  'samurai.bladewind': {
    attack: 'Stabs in a line, and two hits charge a tornado that lifts foes.',
    ability: 'Dashes through a foe, and an attack right after spins all round.',
    special: 'A storm of blades holds airborne foes up, then slams them down.',
  },
  'samurai.ronin': {
    attack: 'Heavy slashes that leave marking cuts on foes.',
    ability: 'Crosses a line in a flash, then crossed and marked foes burst.',
    special: 'Vanishes to cut every foe near, and the cuts burst on the sheathe.',
  },
  'druid.grove': {
    attack: 'Thorn seeds burst into a ring of thorns that slows foes.',
    ability: 'Hold to charge a grove that roots foes, wears them down and heals.',
    special: 'Thorned roots burst up in a spiral, seizing then crushing foes.',
  },
  'druid.wild': {
    attack: 'Short-reach spirit claws, every third rake a heavier maul.',
    ability: 'Hold to charge, then leap as a spirit wolf onto the spot.',
    special: 'Spirit wolves and stags charge ahead, trampling all in their path.',
  },
  'valkyrie.spear': {
    attack: 'A jab, a wide sweep and a lunge, reaching past a sword.',
    ability: 'A thrown spear of light pierces foes and flies back, striking again.',
    special: 'A great winged spear falls on the spot and its runes burst after.',
  },
  'valkyrie.storm': {
    attack: 'A three-blow spear chain whose hits arc lightning to nearby foes.',
    ability: 'Leaps into the air and dives on the spot with a thunderbolt.',
    special: 'A ring of storm surrounds the hero as lightning strikes foes within.',
  },
  'automaton.mech': {
    attack: 'Hold to fire both cannons in turn, building heat as they shoot.',
    ability: 'Hold to paint foes ahead, release to fire a homing missile at each.',
    special: 'Plants itself as a turret, both guns hammering whatever it aims at.',
  },
  'automaton.synth': {
    attack: 'Hold to send drones darting at foes to zap and slow them.',
    ability: 'Drones hold a triangle of lasers that cut and slow foes crossing.',
    special: 'A storm of micro-drones pours out to hunt and zap foes near.',
  },
  'phantom.poltergeist': {
    attack: 'Hurls haunted things at foes, every fourth a big one that bursts.',
    ability: 'Haunted things burst from the ground, flinging nearby foes up.',
    special: 'A spectral house rises and batters foes in a whirl of furniture.',
  },
  'phantom.wraith': {
    attack: 'Swings the lantern, leaving wisps that cling to foes and burn.',
    ability: 'Dives into a foe to steer it into the others, then bursts out.',
    special: 'Darkness freezes foes with fear, then the lantern flares and burns.',
  },
  'inventor.engineer': {
    attack: 'Two wrench sweeps, then an overhead bonk that staggers.',
    ability: 'Tosses a crate that unfolds into a turret shooting the nearest foe.',
    special: 'A giant turret crashes down, then hoses foes with fire and rockets.',
  },
  'inventor.scientist': {
    attack: 'Lightning leaps from foe to foe, weaker each jump, jolting each.',
    ability: 'Tosses an orb that drags nearby foes in, then bursts in a shock.',
    special: 'A great atom lashes nearby foes with arcs, then splits in a flash.',
  },
  'beast.eagle': {
    attack: 'Flings fans of three feathers from one hand, then the other.',
    ability: 'A wingbeat gust hurls foes back and lifts the hero away.',
    special: 'A giant spirit eagle swoops along the aim, raking, then swoops back.',
  },
  'beast.lion': {
    attack: 'Two raking swipes, then a pounce that throws foes back.',
    ability: 'Strikes foes around, throws them back and cows them to half pace.',
    special: 'Three widening roars, the last throwing foes far.',
  },
  'beast.dragon': {
    attack: 'Spits a firebolt that bursts on the first foe, scorching those near.',
    ability: 'Pours out a long cone of fire that turns with the aim.',
    special: 'A flame serpent coils round the spot, raking, then dives in a blast.',
  },
  'lightwright.lightwright': {
    attack: 'A ray of focused sunlight instantly sears the first foe in line.',
    ability: 'A hovering prism sweeps spectrum beams round it, then shatters.',
    special: 'A great mirror focuses a steerable heat ray that scorches the ground.',
  },
  'transmuter.transmuter': {
    attack: 'Flicks a quicksilver bead that bursts and splits after two more foes.',
    ability: 'Chalks a circle; foes in it turn to lead: held, and struck 30% harder.',
    special: 'A golden array gilds foes round her into statues, then shatters them.',
  },
  'aquanaut.aquanaut': {
    attack: 'A slow, heavy harpoon that pierces up to two foes and sticks in the ground.',
    ability: 'A chain hook drags the first foe to him, stunned; bosses are yanked and slowed.',
    special: 'A steam torpedo runs along the ground and bursts, knocking foes back and soaking them.',
  },
};
