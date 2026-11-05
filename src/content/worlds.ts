// The maps you can pick: real OSRS regions exported from the cache, each with
// the enemies that live there in Run Escape and a boss, from worlds.json
// (made by Run-Escape/scripts/cache/make-game-worlds.ts). Chests and the
// boss are scattered about; the way out is where you came in.
import { EnemyDef } from "./enemies";
import worldsJson from "./worlds.json";

type WorldEnemyJson = {
    id: string;
    npcId: number;
    name: string;
    hp: number;
    damage: number;
    speed: number;
    radius: number;
    scale?: number;
    size: number;
    anims: Record<string, number>;
    sounds: Record<string, number>;
    boss?: boolean;
};

type WorldJson = {
    id: string;
    name: string;
    description: string;
    tier: number;
    difficulty: { hp: number; damage: number };
    enemies: WorldEnemyJson[];
    boss?: WorldEnemyJson;
};

export type WorldDef = {
    id: string;
    name: string;
    description: string;
    tier: number;
    enemies: { def: EnemyDef; weight: number }[];
    boss: EnemyDef;
    // The map's ambient sounds (AMBIENT), played now and then
    ambient: number[];
    enemyCount: number;
    chests: number;
    chestItems: [number, number];
    lootTiers: { tier: number; weight: number }[];
};

// worlds.json carries Run Escape's blurbs, about its waves and bosses, so
// each map gets its own here: the place, as the maps screen lists what
// lives there under it
const DESCRIPTIONS: Record<string, string> = {
    lumbridge: "The castle, the farms around it and the swamp to the south. Where everyone starts.",
    barrows: "The six burial mounds and the marsh around Mort'ton, where the dead don't stay buried.",
    wilderness: "The Graveyard of Shadows and the ruins around it, north of the ditch. Nobody up here is friendly.",
    desert: "The Kharidian Desert around the Kalphite hive: dunes, scorpions and bandits in the heat.",
    fremennik: "Rellekka's shore and the hills behind it, with trolls and dagannoths among the rock crabs.",
    karamja: "Jungle paths across Karamja, with the TzHaar out of their volcano. Jad is in there somewhere.",
    kourend: "The swamps and lizard dens of Great Kourend, with something demonic loose from beneath.",
    varlamore: "Varlamore's sunlit plains and hunting grounds: jaguars and foxes among the antelope.",
    morytania: "Morytania's dark woods, with vampyres and werewolves between the swamp and the shades' town.",
    god_wars: "The God Wars Dungeon, where four armies have fought for an age. All of them want you dead.",
    prifddinas: "The crystal city's gauntlet and its corrupted beasts. The Hunllef hunts the deepest halls.",
    inferno: "Inside the volcano under Mor Ul Rek: TzHaar and Jal creatures on the rock, and a Jad among them.",
};

// What a map tier asks of you (see scripts/balance.ts): the average enemy
// on a map, and its boss. Run Escape's enemies keep their relative strengths
// within a map, but each map is scaled so its average lands on its tier.
// Version 55 made it all harder: a map is meant to take a few runs to beat
// unless you're lucky, so a tier's own full set with its own food wins its
// boss about one time in three in the sim (which has no prayer or footwork),
// and the tier below's set never does
const TIER_ENEMY_HP = [0, 19, 34, 60, 86, 126];
const TIER_ENEMY_DAMAGE = [0, 4, 6.5, 9.5, 13, 18];
const TIER_BOSS_HP = [0, 600, 980, 1300, 2500, 4000];
// Version 57 took boss hits down (and their rolls lean low, combat.ts)
const TIER_BOSS_DAMAGE = [0, 16, 22, 26, 39, 52];
// Version 78 evens out the maps of a tier: in the sim a tier's own set beat
// Fremennik's, Karamja's, Kourend's, Morytania's and Prifddinas' bosses
// eight or nine fights in twelve, the Inferno's every time, against about
// four in five meant. A boss's hitpoints are its tier's times this.
const BOSS_HP_SCALE: Record<string, number> = {
    fremennik: 0.92,
    karamja: 0.92,
    kourend: 0.9,
    morytania: 0.9,
    prifddinas: 0.92,
    desert: 1.06,
    inferno: 1.2,
};

// Enemies that shoot instead of hitting, by their id in worlds.json: mages
// with a spell's spot animations (its cast graphic, the one that flies, and
// the burst where it lands), archers with an arrow's, how far off they stand
// and how long between shots (a shot hits as hard as a swing, less often).
// Regular mages throw fire strikes; mage bosses, like the Wise Old Man,
// whose attack clip is the client's spellcasting one, throw fire waves.
type Shooter = { style: "magic" | "ranged"; cast?: number; projectile: number; impact?: number; range: number; interval: number };
const STRIKE: Shooter = { style: "magic", cast: 99, projectile: 100, impact: 101, range: 6, interval: 2.2 };
const WAVE: Shooter = { style: "magic", cast: 155, projectile: 156, impact: 157, range: 7, interval: 2 };
const ARROW: Shooter = { style: "ranged", projectile: 10, range: 7, interval: 2.2 };
const SHOOTERS: Record<string, Shooter> = {
    wise_old_man: WAVE,
    chaos_fanatic: WAVE,
    dagannoth_prime: WAVE,
    tztok_jad: WAVE,
    jaltok_jad_finale: WAVE,
    sotetseg: WAVE,
    corrupted_hunllef: WAVE,
    revenant_imp: STRIKE,
    revenant_pyrefiend: STRIKE,
    serpent_shaman: STRIKE,
    tzhaar_mej: STRIKE,
    desert_bandit: ARROW,
    nylocas_toxobolos: ARROW,
    aviansie: ARROW,
    armadyl_spiritual_ranger: ARROW,
    bree: ARROW,
    zakln_gritch: ARROW,
    iorwerth_archer: ARROW,
    tzhaar_xil: ARROW,
    javelin_colossus: { ...ARROW, interval: 2 },
};

// Bosses' own moves (enemies.ts says what each is; run.ts does them)
type Moves = Pick<EnemyDef, "alternates" | "pierce" | "secondForm" | "floor">;
const MOVES: Record<string, Moves> = {
    tztok_jad: { alternates: true },
    jaltok_jad_finale: { alternates: true },
    verac: { pierce: true },
    kalphite_queen: { secondForm: true },
    corrupted_hunllef: { floor: true },
};

// Every other boss gets a move by its map's tier, so the one star bosses
// stay gentle and the five star ones have two: hits through armour at two
// stars, burning floor at three, a second form (or swapping styles, for a
// shooter) at four, and both at five
function defaultMoves(tier: number, shooter: boolean): Moves {
    if (tier <= 1) {
        return {};
    }
    if (tier === 2) {
        return { pierce: true };
    }
    if (tier === 3) {
        return { floor: true };
    }
    const fourth: Moves = shooter ? { alternates: true } : { secondForm: true };
    return tier === 4 ? fourth : { ...fourth, floor: true };
}

// Each map's ambient sounds, by sound id in the cache: what the map's own
// scenery plays in the client (scripts/cache/list-ambient.ts in Run Escape
// tallies them), played now and then at low volume. The ids go in
// assets.json's sounds too, so they're in the pack.
export const AMBIENT: Record<string, number[]> = {
    lumbridge: [3087, 3087, 3087, 2065, 2065, 2150, 2150, 2209, 2209, 3141, 2199, 3120, 2220],
    barrows: [3120, 3120, 2065],
    fremennik: [2065, 2065, 2065, 2065, 2065, 2065, 2066, 2220, 3137],
    karamja: [3141],
    kourend: [2151],
    varlamore: [2200, 2200, 2200, 2200, 2065],
    morytania: [2199, 2199, 2199, 2199, 2065, 2065, 2065, 2065, 2200, 2200, 2209, 3673, 2066],
    god_wars: [3087],
    prifddinas: [3124, 3124, 3124, 3124, 3124, 3124, 3124, 3124, 4157, 4157, 4157, 4157, 4157, 2199, 2209],
    inferno: [2066, 2066, 2066, 2066, 2066, 2066, 2208, 2208],
};

// Enemies that only fight back (EnemyDef's passive), by name
const PASSIVE_NAMES = /^(chicken|imp)$/i;

function convertEnemy(
    e: WorldEnemyJson,
    world: WorldJson,
    scale: { hp: number; damage: number },
): EnemyDef {
    const boss = !!e.boss;
    const shooter = SHOOTERS[e.id];
    const hp = boss ? Math.round(TIER_BOSS_HP[world.tier] * (BOSS_HP_SCALE[world.id] ?? 1)) : Math.max(8, Math.round(e.hp * scale.hp));
    const damage = boss ? TIER_BOSS_DAMAGE[world.tier] : Math.max(2, Math.round(e.damage * scale.damage));
    // Per kill; a crowded map gives forty or more kills a run, so a kill pays
    // little next to the boss
    const coinsMax = Math.round((boss ? 150 : 3) * Math.pow(2.2, world.tier - 1) * (boss ? 1 : 1 + hp / 60));
    return {
        id: `${world.id}:${e.id}`,
        npcId: e.npcId,
        name: e.name,
        hp,
        damage,
        speed: Math.min(3.2, Math.max(1.4, e.speed)),
        radius: Math.min(0.9, Math.max(0.3, e.radius)),
        attackInterval: shooter ? shooter.interval : boss ? 1.5 : 1.6,
        attackRange: shooter ? shooter.range : 1.1 + Math.max(0, e.size - 1) * 0.5,
        aggro: boss ? 12 : 8,
        coins: [Math.round(coinsMax / 3), coinsMax],
        // Food is rare on the dead: one kill in twelve
        foodChance: boss ? 0 : 0.08,
        scale: e.scale,
        boss: boss || undefined,
        // Chickens and imps leave you be until you hit them (version 93):
        // the first map's easiest things, and a first fight on your terms
        passive: !boss && PASSIVE_NAMES.test(e.name) ? true : undefined,
        shoots: shooter
            ? { style: shooter.style, cast: shooter.cast, projectile: shooter.projectile, impact: shooter.impact }
            : undefined,
        ...(boss ? defaultMoves(world.tier, !!shooter) : {}),
        ...(MOVES[e.id] ?? {}),
    };
}

function lootTiersFor(tier: number): { tier: number; weight: number }[] {
    // The map's own tier, or about one piece in three the one under it:
    // nothing from a map's chests, champions or kills is better than the map.
    // Better comes from the boss's golden chest, the vault and clue caskets.
    const tiers = [
        { tier: tier - 1, weight: 25 },
        { tier, weight: 60 },
    ].filter((t) => t.tier >= 1 && t.tier <= 5);
    return tiers;
}

// The scale that puts a map's weighted average enemy on its tier. Run
// Escape's numbers are for its own waves, so a map's can be far off: the
// Inferno's TzHaar are pushovers there, and get ten times the hp here.
function tierScale(w: WorldJson): { hp: number; damage: number } {
    let weightTotal = 0;
    let hp = 0;
    let damage = 0;
    w.enemies.forEach((e, i) => {
        const weight = Math.max(1, w.enemies.length - i);
        weightTotal += weight;
        hp += e.hp * weight;
        damage += e.damage * weight;
    });
    const clamp = (v: number) => Math.min(12, Math.max(0.2, v));
    return {
        hp: clamp(TIER_ENEMY_HP[w.tier] / (hp / weightTotal)),
        damage: clamp(TIER_ENEMY_DAMAGE[w.tier] / (damage / weightTotal)),
    };
}

export const WORLDS: WorldDef[] = (worldsJson as WorldJson[])
    .filter((w) => w.boss)
    .map((w) => {
        const scale = tierScale(w);
        return {
            id: w.id,
            name: w.name,
            description: DESCRIPTIONS[w.id] ?? w.description,
            tier: w.tier,
            enemies: w.enemies.map((e, i) => ({
                def: convertEnemy(e, w, scale),
                // The weaker ones are the more common
                weight: Math.max(1, w.enemies.length - i),
            })),
            boss: convertEnemy(w.boss!, w, scale),
            ambient: AMBIENT[w.id] ?? [],
            // For a full 128 by 128 map; a run scales it by the map's open ground
            enemyCount: 100 + w.tier * 10,
            // Likewise a full map's worth of chests; about half hold gear, a
            // piece or two
            chests: 16 + w.tier * 2,
            chestItems: w.tier >= 4 ? [1, 2] : [1, 1],
            lootTiers: lootTiersFor(w.tier),
        };
    });

export const WORLD_BY_ID: Map<string, WorldDef> = new Map(WORLDS.map((w) => [w.id, w]));

export function getWorld(id: string): WorldDef {
    const world = WORLD_BY_ID.get(id);
    if (!world) {
        throw new Error("Unknown world " + id);
    }
    return world;
}

// Every enemy in every world, for the enemy table
export const WORLD_ENEMIES: EnemyDef[] = WORLDS.flatMap((w) => [...w.enemies.map((e) => e.def), w.boss]);

// The maps open in WORLDS' order (worlds.json, by tier), each once the one
// before it is beaten: escaped from in a run where its boss fell
// (save.ts's stats.mapsBeaten). The first is always open. main.ts holds a
// run to it and the maps screen shows it.
export function mapBefore(id: string): WorldDef | undefined {
    const i = WORLDS.findIndex((w) => w.id === id);
    return i > 0 ? WORLDS[i - 1] : undefined;
}

export function mapUnlocked(mapsBeaten: string[], id: string): boolean {
    const before = mapBefore(id);
    return before === undefined || mapsBeaten.includes(before.id);
}

// The highest tier with a map open: what the shop's ammunition goes up to
export function tierUnlocked(mapsBeaten: string[]): number {
    return WORLDS.filter((w) => mapUnlocked(mapsBeaten, w.id)).reduce((n, w) => Math.max(n, w.tier), 1);
}
