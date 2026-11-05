// What an enemy is. The enemies themselves come from worlds.ts: each map's
// from worlds.json, keyed by OSRS NPC id (the folder under
// public/assets/npcs). Each has idle, walk, attack and death clips in its
// model.glb, and attack, hit and death sounds beside it.
//
// Balance: scripts/balance.ts plays the maps on paper. The aim is that the
// gear a map's chests give beats the map after it with some food, and its
// boss falls to one tier better than that.

export type EnemyDef = {
    id: string;
    npcId: number;
    name: string;
    hp: number;
    // Max hit on the player
    damage: number;
    // Tiles per second
    speed: number;
    // Collision radius in tiles
    radius: number;
    // Seconds between attacks, and how close it has to be
    attackInterval: number;
    attackRange: number;
    // Tiles away it notices the player
    aggro: number;
    // Coins dropped, and the chance of dropping food
    coins: [number, number];
    foodChance: number;
    // Render scale on top of the model's own
    scale?: number;
    boss?: boolean;
    // A mage or an archer: it stands off at attackRange and shoots instead
    // of hitting, the spell or arrow a spot animation flying at the player,
    // bursting as it lands, and a spell with another on the caster
    shoots?: { style: "magic" | "ranged"; projectile: number; impact?: number; cast?: number };
    // One in twenty spawns as a champion: bigger, far tougher, carrying gear
    champion?: boolean;
    // A boss's own move (worlds.ts's MOVES; run.ts does them): shots that
    // swap between magic and arrows each cast, with a tell; hits that go
    // through armour and protection; a second form on falling; and burning
    // floor that marks tiles round the player before it bursts
    alternates?: boolean;
    pierce?: boolean;
    secondForm?: boolean;
    floor?: boolean;
    // Minds its own business (version 93: chickens and imps): it never
    // comes at you on sight, nor for a fight, a noise or a fleeing friend
    // near it, only once it's hit itself
    passive?: boolean;
};
