// What the vault and the war room say about a set of gear and a pack
// (version 115): a combat level for what's worn, what a death would cost,
// and how long the food and the prayer potions last.
import { COINS, ITEMS, PRAYER_BONUS_SCALE, PRAYER_RESTORE, SLOTS, Slot, getItem, gearPower, price } from "../content/items";
import { gearStats } from "./inventory";
import { isKept } from "./kit";
import { PRAYER_DRAIN } from "./run";
import { Equipment, ItemStack, Stats } from "./save";

// The strongest piece the game has for each slot (the exclusive ones aside)
const BEST_POWER = new Map<Slot, number>();
for (const item of ITEMS) {
    if (item.slot && !item.exclusive) {
        BEST_POWER.set(item.slot, Math.max(BEST_POWER.get(item.slot) ?? 0, gearPower(item)));
    }
}
// The weapon's share of the level; the armour's slots share the rest
const WEAPON_SHARE = 0.45;

// OSRS's 3 to 126. The game has no skills, so it's the gear's: each slot's
// piece against the best there is for that slot
export function combatLevel(equipment: Equipment): number {
    let armour = 0;
    let armourSlots = 0;
    let weapon = 0;
    for (const slot of SLOTS) {
        const best = BEST_POWER.get(slot) ?? 0;
        if (best <= 0) {
            continue;
        }
        const id = equipment[slot];
        const share = id !== undefined ? Math.min(1, gearPower(getItem(id)) / best) : 0;
        if (slot === "weapon") {
            weapon = share;
        } else {
            armour += share;
            armourSlots++;
        }
    }
    const score = WEAPON_SHARE * weapon + (1 - WEAPON_SHARE) * (armourSlots > 0 ? armour / armourSlots : 0);
    return 3 + Math.round(123 * score);
}

// A pack and what's worn, in a few numbers
export type PackSummary = {
    // Pieces of food, the kind there's most of, and every hitpoint the food
    // and brews heal between them
    food: number;
    foodId?: number;
    heal: number;
    prayerPots: number;
    // What a death loses: the worn gear and the pack, coins packed included,
    // but the insured piece and anything kept
    risk: number;
};

// A brew heals this (items.ts's POTION_EFFECT says so)
const BREW_HEAL = 40;

export function packSummary(equipment: Equipment, backpack: ItemStack[], insured?: number): PackSummary {
    let food = 0;
    let heal = 0;
    let prayerPots = 0;
    let risk = 0;
    const foodCounts = new Map<number, number>();
    let insuredLeft = insured !== undefined ? 1 : 0;
    const risked = (id: number, count: number) => {
        if (isKept(id)) {
            return;
        }
        let n = count;
        if (insuredLeft > 0 && id === insured) {
            n--;
            insuredLeft--;
        }
        risk += id === COINS ? n : price(getItem(id)) * n;
    };
    for (const stack of backpack) {
        const item = getItem(stack.id);
        if (item.heal) {
            food += stack.count;
            heal += item.heal * stack.count;
            foodCounts.set(item.id, (foodCounts.get(item.id) ?? 0) + stack.count);
        }
        if (item.potion === "brew") {
            heal += BREW_HEAL * stack.count;
        }
        if (item.potion === "prayer") {
            prayerPots += stack.count;
        }
        risked(stack.id, stack.count);
    }
    for (const slot of SLOTS) {
        const id = equipment[slot];
        if (id !== undefined) {
            risked(id, 1);
        }
    }
    const foodId = [...foodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { food, foodId, heal, prayerPots, risk };
}

// How many hitpoints a minute this character's runs have cost them, once
// they've played long enough to say (five minutes of runs)
export function damagePerMinute(stats: Stats): number | undefined {
    return stats.secondsPlayed >= 300 ? (stats.damageTaken / stats.secondsPlayed) * 60 : undefined;
}

// Minutes the food lasts at that pace
export function foodMinutes(summary: PackSummary, stats: Stats): number | undefined {
    const rate = damagePerMinute(stats);
    return rate && rate > 0 ? summary.heal / rate : undefined;
}

// Seconds of protection a full prayer bar and the potions give, with the
// prayer bonus of what's worn (run.ts drains it PRAYER_DRAIN a second)
export function prayerSeconds(equipment: Equipment, prayerPots: number): number {
    const scale = 1 + Math.max(0, gearStats(equipment).prayer) / PRAYER_BONUS_SCALE;
    return ((100 + prayerPots * PRAYER_RESTORE) * scale) / PRAYER_DRAIN;
}

// Minutes and seconds, as the vault says them
export function minutesText(minutes: number): string {
    if (minutes >= 1.5) {
        return `about ${Math.round(minutes)} minutes`;
    }
    if (minutes >= 0.75) {
        return "about a minute";
    }
    return `about ${Math.max(5, Math.round((minutes * 60) / 5) * 5)} seconds`;
}

// What the bank holds, priced as the shop does, with the coins banked
export function vaultWorth(stash: ItemStack[], coins: number): number {
    return stash.reduce((n, s) => n + price(getItem(s.id)) * s.count, coins);
}
