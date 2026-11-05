// Plays each map on paper with a few gear loadouts and reports what it
// costs: damage taken clearing a map's worth of enemies, food eaten, whether
// the boss can be beaten, and how long it takes. No movement or dodging: the
// player stands and trades blows, so real play should go a little better.
//
//   npx tsx scripts/balance.ts
import { EnemyDef } from "../src/content/enemies";
import { EAT_DELAY, FOOD_LIMIT, getItem } from "../src/content/items";
import { WORLDS, WorldDef } from "../src/content/worlds";
import { REGEN_DELAY, REGEN_PER_SECOND, enemyHit, playerHit } from "../src/game/combat";
import { makeRng } from "../src/game/dungeon";
import { BASE_HP, GearStats, gearStats } from "../src/game/inventory";
import { Equipment } from "../src/game/save";

type Loadout = { name: string; equipment: Equipment; food: number; heal: number };

const LOADOUTS: Loadout[] = [
    { name: "starter (bronze sword, 8 shrimps)", equipment: { weapon: 1277, body: 1129 }, food: 8, heal: 15 },
    {
        name: "iron set, 8 trout",
        equipment: { weapon: 1323, head: 1153, body: 1115, legs: 1067, shield: 1191, feet: 4121, hands: 1059 },
        food: 8,
        heal: 30,
    },
    {
        name: "mithril set, 8 lobsters",
        equipment: { weapon: 1329, head: 1159, body: 1121, legs: 1071, shield: 1197, feet: 4127, hands: 1063, neck: 1725 },
        food: 8,
        heal: 55,
    },
    {
        name: "rune set, 8 lobsters",
        equipment: { weapon: 1333, head: 1163, body: 1127, legs: 1079, shield: 1201, feet: 4129, hands: 1065, neck: 1731 },
        food: 8,
        heal: 55,
    },
    {
        name: "dragon + barrows, 8 sharks",
        equipment: { weapon: 4151, head: 4716, body: 4720, legs: 4722, shield: 1187, feet: 11840, hands: 2491, neck: 1704 },
        food: 8,
        heal: 100,
    },
    {
        name: "best in game, 8 sharks",
        equipment: { weapon: 11802, head: 26382, body: 26384, legs: 26386, feet: 11840, hands: 2491, neck: 6585, cape: 6570, ring: 6737 },
        food: 8,
        heal: 100,
    },
];

// A tier's own set: the strongest piece a map of that tier gives for every
// slot (its prize left out, as that's rare), with the map's food. What a
// player who's looted a tier has to beat it, and to try the next, with.
import { ITEMS, PRIZES, gearPower } from "../src/content/items";
import { SLOTS } from "../src/content/items";

const TIER_FOOD = [0, 15, 20, 30, 40, 55];
function tierSet(tier: number): Loadout {
    const equipment: Equipment = {};
    for (const slot of SLOTS) {
        const pieces = ITEMS.filter((i) => i.slot === slot && i.tier === tier && !PRIZES.has(i.id) && !i.exclusive && i.id !== 1050);
        if (pieces.length === 0) {
            continue;
        }
        const best = pieces.sort((a, b) => gearPower(b) - gearPower(a))[0];
        if (slot === "shield" && equipment.weapon !== undefined && getItem(equipment.weapon).twoHanded) {
            continue;
        }
        equipment[slot] = best.id;
    }
    // No shield with a two handed weapon
    if (equipment.weapon !== undefined && getItem(equipment.weapon).twoHanded) {
        delete equipment.shield;
    }
    const stats = gearStats(equipment);
    return { name: `tier ${tier} set (def ${stats.defence}, hit ${stats.damage}/${stats.speed}s)`, equipment, food: 8, heal: TIER_FOOD[tier] };
}
for (let t = 1; t <= 5; t++) {
    LOADOUTS.push(tierSet(t));
}

// Enemies met at once: they come in twos and threes
const GROUP = 2;
const TICK = 0.05;
// A run fights about this share of a map's enemies on the way to its chests:
// the maps are crowded, and most of what's there never notices you
const FOUGHT = 0.35;
// What enemies drop (run.ts: shrimps, bread, trout, salmon, lobster), rolled
// up to the map's tier
const DROP_HEAL = [15, 20, 30, 40, 55];

type Fight = { damageTaken: number; seconds: number; eaten: number; died: boolean; hpLeft: number };

// A fight to the death against a group, eating (from the front of the pack)
// when under 40%
function fight(enemies: EnemyDef[], stats: GearStats, maxHp: number, hp: number, food: number[], seed: number): Fight {
    const rng = makeRng(seed);
    const alive = enemies.map((def) => ({ def, hp: def.hp, cooldown: 0.5 + rng() * def.attackInterval }));
    let attackCooldown = 0;
    let eatCooldown = 0;
    let time = 0;
    let damageTaken = 0;
    let eaten = 0;
    let lastHurt = -100;
    let regen = 0;
    while (alive.length > 0 && time < 600) {
        time += TICK;
        attackCooldown -= TICK;
        eatCooldown -= TICK;
        if (attackCooldown <= 0) {
            const target = alive[0];
            target.hp -= playerHit(stats, rng());
            attackCooldown = stats.speed;
            if (target.hp <= 0) {
                alive.shift();
            }
        }
        for (const e of alive) {
            e.cooldown -= TICK;
            if (e.cooldown <= 0) {
                const hit = enemyHit(e.def, { defence: stats.defenceVs[e.def.shoots?.style ?? "melee"] }, rng());
                hp -= hit;
                damageTaken += hit;
                lastHurt = time;
                e.cooldown = e.def.attackInterval;
            }
        }
        // A bite, when low, no sooner than EAT_DELAY after the last (run.ts)
        if (hp <= maxHp * 0.4 && food.length > 0 && eatCooldown <= 0) {
            hp = Math.min(maxHp, hp + food.shift()!);
            eaten++;
            eatCooldown = EAT_DELAY;
        }
        if (time - lastHurt > REGEN_DELAY) {
            regen += REGEN_PER_SECOND * TICK;
            if (regen >= 1) {
                hp = Math.min(maxHp, hp + 1);
                regen -= 1;
            }
        }
        if (hp <= 0) {
            return { damageTaken, seconds: time, eaten, died: true, hpLeft: 0 };
        }
    }
    return { damageTaken, seconds: time, eaten, died: false, hpLeft: hp };
}

function weightedEnemies(world: WorldDef, rng: () => number): EnemyDef[] {
    const total = world.enemies.reduce((n, e) => n + e.weight, 0);
    const list: EnemyDef[] = [];
    for (let i = 0; i < Math.round(world.enemyCount * FOUGHT); i++) {
        let roll = rng() * total;
        for (const e of world.enemies) {
            roll -= e.weight;
            if (roll <= 0) {
                list.push(e.def);
                break;
            }
        }
    }
    return list;
}

// A run: the enemies in groups, with a breather between groups (regen for 8
// seconds), then the boss
function playWorld(world: WorldDef, loadout: Loadout, seed: number) {
    const rng = makeRng(seed);
    const stats = gearStats(loadout.equipment);
    const maxHp = BASE_HP + stats.hp;
    let hp = maxHp;
    const food: number[] = new Array<number>(loadout.food).fill(loadout.heal);
    let damage = 0;
    let seconds = 0;
    let died = false;
    let eatenOnMap = 0;
    const enemies = weightedEnemies(world, rng);
    for (let i = 0; i < enemies.length && !died; i += GROUP) {
        const group = enemies.slice(i, i + GROUP);
        const result = fight(group, stats, maxHp, hp, food, seed + i);
        damage += result.damageTaken;
        seconds += result.seconds + 8;
        eatenOnMap += result.eaten;
        hp = Math.min(maxHp, result.hpLeft + 8 * REGEN_PER_SECOND);
        died = result.died;
        // What the group dropped goes in the pack, eaten before the brought
        // food, as far as the pack's food limit allows
        if (!died) {
            for (const def of group) {
                if (rng() < def.foodChance && food.length < FOOD_LIMIT) {
                    food.unshift(DROP_HEAL[Math.min(4, Math.floor(rng() * (world.tier + 1)))]);
                }
            }
        }
    }
    let boss: Fight | undefined;
    if (!died) {
        boss = fight([world.boss], stats, maxHp, hp, food, seed + 999);
    }
    return { damage, seconds, died, eatenOnMap, foodLeft: food.length, boss, maxHp };
}

function pad(s: string | number, n: number): string {
    return String(s).padEnd(n);
}

// Runs a loadout plays on each map (BALANCE_SEEDS=12 for a steadier read)
const SEEDS = Number(process.env.BALANCE_SEEDS) || 5;
console.log("Per map and loadout, averaged over seeds: damage taken fighting 40% of the map's enemies (two at a time, a");
console.log("breather between fights), food eaten, time, deaths, then the boss fight after that with what's left.\n");
for (const world of WORLDS) {
    console.log(`== ${world.name} (tier ${world.tier}, ${world.enemyCount} enemies, boss ${world.boss.name} ${world.boss.hp} hp, hits ${world.boss.damage})`);
    console.log(pad("loadout", 36) + pad("hp", 5) + pad("clear dmg", 11) + pad("food", 6) + pad("time", 7) + pad("deaths", 8) + "boss: win / dmg / food / time");
    for (const loadout of LOADOUTS) {
        let damage = 0;
        let eaten = 0;
        let seconds = 0;
        let deaths = 0;
        let bossWins = 0;
        let bossDamage = 0;
        let bossFood = 0;
        let bossTime = 0;
        let maxHp = 0;
        for (let s = 0; s < SEEDS; s++) {
            const r = playWorld(world, loadout, 1000 * world.tier + s * 17 + 1);
            maxHp = r.maxHp;
            damage += r.damage;
            eaten += r.eatenOnMap;
            seconds += r.seconds;
            deaths += r.died ? 1 : 0;
            if (r.boss) {
                bossWins += r.boss.died ? 0 : 1;
                bossDamage += r.boss.damageTaken;
                bossFood += r.boss.eaten;
                bossTime += r.boss.seconds;
            }
        }
        const n = SEEDS;
        const survived = n - deaths;
        console.log(
            pad(loadout.name, 36) +
                pad(maxHp, 5) +
                pad(Math.round(damage / n), 11) +
                pad((eaten / n).toFixed(1), 6) +
                pad(Math.round(seconds / n) + "s", 7) +
                pad(`${deaths}/${n}`, 8) +
                (survived > 0
                    ? `${bossWins}/${survived} / ${Math.round(bossDamage / survived)} / ${(bossFood / survived).toFixed(1)} / ${Math.round(bossTime / survived)}s`
                    : "-"),
        );
    }
    console.log();
}

// Per enemy: seconds to kill with each weapon tier, and damage it deals meanwhile
console.log("== Enemy by weapon: seconds to kill / damage it deals in that time (no armour)");
const weapons = [1277, 1323, 1329, 1333, 4587, 4151, 11802].map((id) => getItem(id));
console.log(pad("enemy", 30) + weapons.map((w) => pad(w.name.replace(" scimitar", " scim"), 16)).join(""));
for (const world of WORLDS) {
    for (const enemy of [...world.enemies.map((e) => e.def), world.boss]) {
        const cells = weapons.map((w) => {
            const stats = gearStats({ weapon: w.id });
            const r = fight([enemy], stats, 1000, 1000, 0, 0, 7);
            return pad(`${r.seconds.toFixed(1)}s / ${r.damageTaken}`, 16);
        });
        console.log(pad(enemy.name, 30) + cells.join(""));
    }
}
