// Item lists (the stash, a run's inventory) and what worn gear adds up to.
import { AMMO_LIMITS, ATTACK_STYLES, AttackStyle, FOOD_LIMIT, ItemDef, SLOTS, Slot, WEAK_TO, getItem, price, weaponStyle } from "../content/items";
import { Equipment, ItemStack } from "./save";

export const INVENTORY_SIZE = 28;

// Whether a pack can take this many more of something, by what it's
// carrying already: food is FOOD_LIMIT pieces in all, ammunition
// AMMO_LIMITS arrows in all and runes in all (every kind together);
// everything else is only the slots
export function canCarry(list: ItemStack[], id: number, count = 1): boolean {
    const item = getItem(id);
    if (item.heal) {
        const food = list.reduce((n, s) => n + (getItem(s.id).heal ? s.count : 0), 0);
        return food + count <= FOOD_LIMIT;
    }
    if (item.ammo) {
        const kind = item.ammo;
        const packed = list.reduce((n, s) => n + (getItem(s.id).ammo === kind ? s.count : 0), 0);
        return packed + count <= AMMO_LIMITS[kind];
    }
    return true;
}

// How many more of something the pack's limits allow, up to `wanted`
export function roomFor(list: ItemStack[], id: number, wanted: number): number {
    let n = 0;
    while (n < wanted && canCarry(list, id, n + 1)) {
        n++;
    }
    return n;
}

// Why canCarry said no, in a word
export function carryLimitText(id: number): string {
    const item = getItem(id);
    if (item.heal) {
        return `You can't carry more than ${FOOD_LIMIT} pieces of food.`;
    }
    const kind = item.ammo ?? "arrows";
    return `You can't carry more than ${AMMO_LIMITS[kind]} ${kind} of every kind together.`;
}

export function countOf(list: ItemStack[], id: number): number {
    return list.filter((s) => s.id === id).reduce((n, s) => n + s.count, 0);
}

// Adds to a list, stacking stackables. With a slot limit, says no (and adds
// nothing) when it wouldn't fit.
export function addItem(list: ItemStack[], id: number, count = 1, limit = Infinity): boolean {
    // Nothing to add is nothing added (never an empty stack)
    if (count <= 0) {
        return true;
    }
    const item = getItem(id);
    if (item.stackable) {
        const stack = list.find((s) => s.id === id);
        if (stack) {
            stack.count += count;
            return true;
        }
        if (list.length >= limit) {
            return false;
        }
        list.push({ id, count });
        return true;
    }
    if (list.length + count > limit) {
        return false;
    }
    for (let i = 0; i < count; i++) {
        list.push({ id, count: 1 });
    }
    return true;
}

export function removeItem(list: ItemStack[], id: number, count = 1): boolean {
    if (countOf(list, id) < count) {
        return false;
    }
    let left = count;
    for (let i = list.length - 1; i >= 0 && left > 0; i--) {
        const stack = list[i];
        if (stack.id !== id) {
            continue;
        }
        const take = Math.min(stack.count, left);
        stack.count -= take;
        left -= take;
        if (stack.count === 0) {
            list.splice(i, 1);
        }
    }
    return true;
}

export type GearStats = {
    // The weapon's max hit, with what the armour worn does to it (STYLE_HELP
    // for each piece of the weapon's kind, STYLE_HINDER for each of another)
    damage: number;
    speed: number;
    range: number;
    ranged: boolean;
    // The armour's defence in all, and against each style of attack: a
    // piece counts half against the style its kind is weak to
    defence: number;
    defenceVs: Record<AttackStyle, number>;
    // What the armour did to the max hit, as a share (+0.12 for 12% more)
    styleBonus: number;
    hp: number;
    // The prayer bonus in all (items.ts's PRAYER_BONUS_SCALE says what it does)
    prayer: number;
    sound?: string;
    weapon?: ItemDef;
    // A full Barrows set worn: its effect is run.ts's (and SET_EFFECTS says what)
    set?: BarrowsSet;
};

// Each piece of armour of the weapon's kind adds this share to its hits,
// and each piece of another kind takes this much off, within the bounds
export const STYLE_HELP = 0.03;
export const STYLE_HINDER = 0.04;
export const STYLE_BONUS_MIN = -0.3;
export const STYLE_BONUS_MAX = 0.2;

export type BarrowsSet = "dharok" | "guthan" | "verac" | "ahrim" | "karil" | "torag";

// Each set's helm, body, legs and weapon, all four for the effect
export const BARROWS_SETS: Record<BarrowsSet, { name: string; items: number[] }> = {
    dharok: { name: "Dharok's", items: [4716, 4720, 4722, 4718] },
    guthan: { name: "Guthan's", items: [4724, 4728, 4730, 4726] },
    verac: { name: "Verac's", items: [4753, 4757, 4759, 4755] },
    ahrim: { name: "Ahrim's", items: [4708, 4712, 4714, 4710] },
    karil: { name: "Karil's", items: [4732, 4736, 4738, 4734] },
    torag: { name: "Torag's", items: [4745, 4749, 4751, 4747] },
};

export const SET_EFFECTS: Record<BarrowsSet, string> = {
    dharok: "the lower your hitpoints, the harder you hit, up to double",
    guthan: "every hit heals you a quarter of what it dealt",
    verac: "your hits never roll low: 85% to 100% of the max",
    ahrim: "what your spells hit crawls, half speed for four seconds",
    karil: "every bolt has a one in three chance of a second hit at half",
    torag: "every hit puts another half second between the target's attacks",
};

export const BASE_HP = 100;
// Bare hands
const FISTS: GearStats = {
    damage: 3,
    speed: 0.7,
    range: 1.1,
    ranged: false,
    defence: 0,
    defenceVs: { melee: 0, ranged: 0, magic: 0 },
    styleBonus: 0,
    hp: 0,
    prayer: 0,
};

// Durability: every hit taken wears each piece of armour worn by this much
// (two hundred hits from new to worn through), a worn through piece has lost
// this share of its defence, and the guild repairs a piece for this share of
// its price per full wear
export const WEAR_PER_HIT = 0.005;
export const WEAR_DEFENCE_LOSS = 0.5;
export const REPAIR_SHARE = 0.1;
export type Wear = Record<number, number>;

export function wearOf(wear: Wear, id: number): number {
    return Math.min(1, Math.max(0, wear[id] ?? 0));
}

export function repairCost(item: ItemDef, wear: Wear): number {
    const w = wearOf(wear, item.id);
    return w > 0 ? Math.max(1, Math.ceil(price(item) * REPAIR_SHARE * w)) : 0;
}

// The gear's numbers, with each piece's wear taken off its defence
export function gearStats(equipment: Equipment, wear: Wear = {}): GearStats {
    const stats: GearStats = { ...FISTS, defenceVs: { melee: 0, ranged: 0, magic: 0 } };
    let bonus = 0;
    const weapon = equipment.weapon !== undefined ? getItem(equipment.weapon) : undefined;
    const hitsWith = weaponStyle(weapon);
    for (const slot of SLOTS) {
        const id = equipment[slot];
        if (id === undefined) {
            continue;
        }
        const item = getItem(id);
        if (slot === "weapon") {
            stats.damage = item.damage ?? stats.damage;
            stats.speed = item.speed ?? stats.speed;
            stats.range = item.range ?? stats.range;
            stats.ranged = !!item.ranged;
            stats.sound = item.sound;
            stats.weapon = item;
        }
        const defence = Math.round((item.defence ?? 0) * (1 - WEAR_DEFENCE_LOSS * wearOf(wear, id)));
        stats.defence += defence;
        for (const style of ATTACK_STYLES) {
            stats.defenceVs[style] += item.style && WEAK_TO[item.style] === style ? Math.round(defence / 2) : defence;
        }
        if (item.style && slot !== "weapon") {
            bonus += item.style === hitsWith ? STYLE_HELP : -STYLE_HINDER;
        }
        stats.hp += item.hp ?? 0;
        stats.prayer += item.prayer ?? 0;
    }
    stats.styleBonus = Math.min(STYLE_BONUS_MAX, Math.max(STYLE_BONUS_MIN, bonus));
    stats.damage = Math.max(1, Math.round(stats.damage * (1 + stats.styleBonus)));
    const worn = Object.values(equipment);
    for (const [set, def] of Object.entries(BARROWS_SETS) as [BarrowsSet, { items: number[] }][]) {
        if (def.items.every((id) => worn.includes(id))) {
            stats.set = set;
        }
    }
    return stats;
}

// Puts an item on, moving what it replaces (and a shield a two handed weapon
// pushes off) into the list it came from. Says no if the list has no room.
export function equip(equipment: Equipment, list: ItemStack[], id: number, limit = Infinity): boolean {
    const item = getItem(id);
    const slot = item.slot;
    if (!slot) {
        return false;
    }
    const displaced: number[] = [];
    if (equipment[slot] !== undefined) {
        displaced.push(equipment[slot]!);
    }
    if (slot === "weapon" && item.twoHanded && equipment.shield !== undefined) {
        displaced.push(equipment.shield);
    }
    if (slot === "shield" && equipment.weapon !== undefined && getItem(equipment.weapon).twoHanded) {
        displaced.push(equipment.weapon);
    }
    // Room check: one goes out, the displaced come in
    if (list.length - 1 + displaced.length > limit) {
        return false;
    }
    removeItem(list, id, 1);
    for (const d of displaced) {
        addItem(list, d, 1);
    }
    equipment[slot] = id;
    if (slot === "weapon" && item.twoHanded) {
        delete equipment.shield;
    }
    if (slot === "shield" && displaced.includes(equipment.weapon ?? -1)) {
        delete equipment.weapon;
    }
    return true;
}

export function unequip(equipment: Equipment, list: ItemStack[], slot: Slot, limit = Infinity): boolean {
    const id = equipment[slot];
    if (id === undefined) {
        return false;
    }
    if (!addItem(list, id, 1, limit)) {
        return false;
    }
    delete equipment[slot];
    return true;
}

// What the shop (and the trader) pays for a piece: a quarter of its price
export const SELL_SHARE = 0.25;

export function sellPrice(item: ItemDef): number {
    return Math.max(1, Math.floor(price(item) * SELL_SHARE));
}
