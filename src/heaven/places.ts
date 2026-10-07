// The places of Heaven Lands: islands adrift in a sea of cloud, each one a
// world of its own to wander. Some are the old game's lands made peaceful,
// some go on forever. The Atlas (scenes/AtlasScene.ts) shows them; travel.ts
// takes the wanderer there.

export interface Place {
  id: string;
  /** The world's arena id (see world/arenas.ts, and arenas Heaven Lands adds itself). */
  arena: string;
  name: string;
  /** One line under the name. */
  blurb: string;
  /** A few quiet sentences about it, for the Atlas's card. */
  lore: string;
  /** Goes on forever (grown from a seed as you walk). */
  endless: boolean;
  /** Friends can come along (a room for up to four). */
  together: boolean;
  /** The time of day turns there. */
  dayNight: boolean;
}

export const PLACES: Place[] = [
  {
    id: 'home',
    arena: 'home',
    name: 'Hearthhome',
    blurb: 'Your own little isle',
    lore: 'A patch of meadow that is yours alone. Build a cottage, plant a garden, cook supper and invite whoever you like to stay a while.',
    endless: false,
    together: true,
    dayNight: true,
  },
  {
    id: 'everwood',
    arena: 'forest',
    name: 'The Everwood',
    blurb: 'A forest without an end',
    lore: 'Seven woods grown into one, on and on in every direction. Brooks, glades, campfires and old stones, and a white stag that comes to those who wander long enough.',
    endless: true,
    together: true,
    dayNight: true,
  },
  {
    id: 'cloudrest',
    arena: 'island',
    name: 'Cloudrest',
    blurb: 'A ring of stones above the clouds',
    lore: 'The highest of the isles, where the wind is always warm. Old pillars stand in a ring, and the whole sky turns slowly round them.',
    endless: false,
    together: true,
    dayNight: true,
  },
  {
    id: 'garden',
    arena: 'garden',
    name: 'The Sunken Garden',
    blurb: 'Hedges, fountains and quiet water',
    lore: 'A garden that slipped a little way into the earth long ago and kept on growing. Nobody tends it now, and it has never looked lovelier.',
    endless: false,
    together: true,
    dayNight: true,
  },
  {
    id: 'glimmerdeep',
    arena: 'deep',
    name: 'Glimmerdeep',
    blurb: 'Caves of glowing crystal',
    lore: 'Under the isles the rock is hollow and full of light: glowcaps, crystal and still pools that hold the colours of the stones.',
    endless: false,
    together: true,
    dayNight: false,
  },
  {
    id: 'starwatch',
    arena: 'cosmos',
    name: 'Starwatch',
    blurb: 'A terrace among the stars',
    lore: 'Past the last cloud there is a terrace of old stone floating in the night, with the stars close enough to count. A good place to sit and say nothing.',
    endless: false,
    together: true,
    dayNight: false,
  },
  {
    id: 'shore',
    arena: 'shore',
    name: 'Glowtide Shore',
    blurb: 'A coast that never ends',
    lore: "Warm sand, turquoise shallows and a sea that never stirs much above a whisper. Walk it east or west for as long as you like; by night the water's edge glows blue where the waves come in.",
    endless: true,
    together: true,
    dayNight: true,
  },
];

export const placeById = (id: string | undefined): Place => PLACES.find((p) => p.id === id || p.arena === id) ?? PLACES[0];
