// The combat numbers, shared by the game and the balance simulation
// (scripts/balance.ts), so what the sim measures is what the game does.
import { EnemyDef } from "../content/enemies";
import { ItemDef, MATCH_POWER } from "../content/items";
import { GearStats } from "./inventory";

// Defence soaks a share of each hit: 30 defence soaks a third, 60 half, and
// it never soaks more than three quarters (60 since food was capped at eight
// pieces and a bite a time: armour has to carry more of a fight)
export const SOAK_HALF_AT = 60;
export const SOAK_MAX = 0.75;

export function soak(defence: number): number {
    return Math.min(SOAK_MAX, defence / (defence + SOAK_HALF_AT));
}

// What the player hits an enemy for: 60% to 100% of the weapon's max hit
export function playerHit(stats: GearStats, roll: number): number {
    return Math.max(1, Math.round(stats.damage * (0.6 + roll * 0.4)));
}

// What an enemy hits the player for: 50% to 100% of its max, less the soak
// (only the defence counts, so a co-op host can roll for a guest from theirs).
// A boss's roll leans low (version 57): the lower of two rolls, so its big
// hits are rare (a hit in the top tenth of its range one time in a hundred,
// not one in ten) and the usual one is two thirds of its max, not three
// quarters.
export function enemyHit(enemy: EnemyDef, stats: Pick<GearStats, "defence">, roll: number): number {
    const share = enemy.boss ? bossRoll(roll) : roll;
    return Math.max(1, Math.round(enemy.damage * (0.5 + share * 0.5) * (1 - soak(stats.defence))));
}

// One random number into the lower of two: the square root's inverse, so
// the game and the sim need only the one roll
export function bossRoll(roll: number): number {
    return 1 - Math.sqrt(1 - roll);
}

// What the ammunition does to a shot (version 59): a bow or staff hits
// what its max hit says with its own tier's best arrows or runes
// (MATCH_POWER), more with better and less with worse; a thrown weapon,
// or a swing, is unchanged
export function ammoScale(weapon: ItemDef | undefined, ammo: ItemDef | undefined): number {
    if (!weapon?.uses || !ammo?.power) {
        return 1;
    }
    return ammo.power / (MATCH_POWER[weapon.tier] ?? 1);
}

// Hitpoints a player gets back on their own, per second, when nothing has
// hurt them for REGEN_DELAY seconds (and, in a run, nothing is after them)
export const REGEN_PER_SECOND = 0.5;
export const REGEN_DELAY = 8;
