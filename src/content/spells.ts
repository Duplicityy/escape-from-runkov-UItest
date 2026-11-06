// The spellbook (version 106): the standard spellbook's twenty combat spells,
// OSRS's own, with OSRS's rune costs and spot animations. A staff casts them
// (any weapon that uses runes); which ones it can is its tier, as the game
// has no Magic level: a tier 1 staff casts strikes, tier 2 bolts too, then
// blasts, waves, and at tier 5 surges. A spell hits what the staff's max hit
// says when it is the staff's own tier's fire spell, a little less for the
// other elements, and less again for a lower family (spellScale), the way
// arrows did a bow before. Elemental staffs, battlestaves, mystic staves and
// the tomes give their element's runes for nothing, as in OSRS.
import { ItemDef, MATCH_POWER } from "./items";

export type Element = "wind" | "water" | "earth" | "fire";
export type SpellFamily = "strike" | "bolt" | "blast" | "wave" | "surge";

export const ELEMENTS: Element[] = ["wind", "water", "earth", "fire"];
export const FAMILIES: SpellFamily[] = ["strike", "bolt", "blast", "wave", "surge"];

// The runes
export const AIR = 556;
export const WATER = 555;
export const EARTH = 557;
export const FIRE = 554;
export const MIND = 558;
export const CHAOS = 562;
export const DEATH = 560;
export const BLOOD = 565;
export const WRATH = 21880;

export type RuneCost = { id: number; n: number };

export type SpellDef = {
    id: string;
    name: string;
    family: SpellFamily;
    element: Element;
    // The staff tier that casts it (a family's tier)
    tier: number;
    // Its share of the staff's max hit against MATCH_POWER (spellScale)
    power: number;
    runes: RuneCost[];
    // Spot animations: on the caster, flying, and where it lands
    cast: number;
    projectile: number;
    impact: number;
    // The spellbook's icon (public/ui/spells/<id>.png, the cache's sprite)
    icon: string;
};

// What each element's spell of a family has, against the family's fire spell
const ELEMENT_POWER: Record<Element, number> = { wind: 0.91, water: 0.94, earth: 0.97, fire: 1 };
const FAMILY_TIER: Record<SpellFamily, number> = { strike: 1, bolt: 2, blast: 3, wave: 4, surge: 5 };

// OSRS's costs: the element's runes, the air runes (but for wind, whose
// element they are), and one of the family's own catalyst
const COSTS: Record<SpellFamily, Record<Element, [number, number]>> = {
    // [element runes, air runes]
    strike: { wind: [1, 0], water: [1, 1], earth: [2, 1], fire: [3, 2] },
    bolt: { wind: [2, 0], water: [2, 2], earth: [3, 2], fire: [4, 3] },
    blast: { wind: [3, 0], water: [3, 3], earth: [4, 3], fire: [5, 4] },
    wave: { wind: [5, 0], water: [7, 5], earth: [7, 5], fire: [7, 5] },
    surge: { wind: [7, 0], water: [10, 7], earth: [10, 7], fire: [10, 7] },
};
const CATALYST: Record<SpellFamily, number> = { strike: MIND, bolt: CHAOS, blast: DEATH, wave: BLOOD, surge: WRATH };
const ELEMENT_RUNE: Record<Element, number> = { wind: AIR, water: WATER, earth: EARTH, fire: FIRE };

// The spot animations, by family and element: cast, projectile, impact
const LOOKS: Record<SpellFamily, Record<Element, [number, number, number]>> = {
    strike: { wind: [90, 91, 92], water: [93, 94, 95], earth: [96, 97, 98], fire: [99, 100, 101] },
    bolt: { wind: [117, 118, 119], water: [120, 121, 122], earth: [123, 124, 125], fire: [126, 127, 128] },
    blast: { wind: [132, 133, 134], water: [135, 136, 137], earth: [138, 139, 140], fire: [129, 130, 131] },
    wave: { wind: [158, 159, 160], water: [161, 162, 163], earth: [164, 165, 166], fire: [155, 156, 157] },
    surge: { wind: [1455, 1456, 1457], water: [1458, 1459, 1460], earth: [1461, 1462, 1463], fire: [1464, 1465, 1466] },
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const SPELLS: SpellDef[] = FAMILIES.flatMap((family) =>
    ELEMENTS.map((element) => {
        const tier = FAMILY_TIER[family];
        const [own, air] = COSTS[family][element];
        const runes: RuneCost[] = [];
        if (element === "wind") {
            runes.push({ id: AIR, n: own });
        } else {
            runes.push({ id: ELEMENT_RUNE[element], n: own }, { id: AIR, n: air });
        }
        runes.push({ id: CATALYST[family], n: 1 });
        const [cast, projectile, impact] = LOOKS[family][element];
        const id = `${element}_${family}`;
        return {
            id,
            name: `${cap(element)} ${cap(family)}`,
            family,
            element,
            tier,
            power: Math.round(MATCH_POWER[tier] * ELEMENT_POWER[element] * 1000) / 1000,
            runes,
            cast,
            projectile,
            impact,
            icon: id,
        };
    }),
);

export const SPELL_BY_ID = new Map(SPELLS.map((s) => [s.id, s]));

// Staves (and the tomes, held in the shield hand) that give runes, by the
// runes they give: OSRS's elemental staves, battlestaves and mystic staves,
// the combination staves, the Kodai wand and the tomes
const GIVES: [number[], number[]][] = [
    [[1381, 1397, 1405], [AIR]],
    [[1383, 1395, 1403, 21006, 25574], [WATER]],
    [[1385, 1399, 1407, 30064], [EARTH]],
    [[1387, 1393, 1401, 20714], [FIRE]],
    [[11998, 12000], [AIR, FIRE]],
    [[20730, 20733], [AIR, WATER]],
    [[20736, 20739], [AIR, EARTH]],
    [[6562, 6563], [WATER, EARTH]],
    [[3053, 3054], [EARTH, FIRE]],
    [[11787, 11789], [WATER, FIRE]],
];
const RUNES_GIVEN = new Map<number, number[]>();
for (const [items, runes] of GIVES) {
    for (const id of items) {
        RUNES_GIVEN.set(id, runes);
    }
}

// The runes the worn staff and shield give, for nothing
export function runesGiven(weapon: number | undefined, shield: number | undefined): Set<number> {
    return new Set([...(weapon !== undefined ? (RUNES_GIVEN.get(weapon) ?? []) : []), ...(shield !== undefined ? (RUNES_GIVEN.get(shield) ?? []) : [])]);
}

// What a spell takes from the pack, given what's worn
export function spellCost(spell: SpellDef, given: Set<number>): RuneCost[] {
    return spell.runes.filter((r) => !given.has(r.id));
}

// Whether a staff can cast a spell at all (its tier is enough)
export function staffCasts(weapon: ItemDef | undefined, spell: SpellDef): boolean {
    return weapon?.uses === "runes" && weapon.tier >= spell.tier;
}

// A spell's share of the staff's max hit: its power against the staff's own
// tier's best (MATCH_POWER, as ammoScale has it for arrows)
export function spellScale(weapon: ItemDef | undefined, spell: SpellDef): number {
    return spell.power / (MATCH_POWER[weapon?.tier ?? 1] ?? 1);
}

// How many casts the runes in a pack hold (Infinity when every rune is given)
export function castsLeft(spell: SpellDef, given: Set<number>, count: (id: number) => number): number {
    let casts = Infinity;
    for (const r of spellCost(spell, given)) {
        casts = Math.min(casts, Math.floor(count(r.id) / r.n));
    }
    return casts;
}

// The spell a staff casts on its own (autocast unset): the strongest it can,
// with the runes for it (the highest family, fire before earth, water, wind)
export function bestSpell(weapon: ItemDef | undefined, given: Set<number>, count: (id: number) => number): SpellDef | undefined {
    let best: SpellDef | undefined;
    for (const spell of SPELLS) {
        if (staffCasts(weapon, spell) && castsLeft(spell, given, count) > 0 && (!best || spell.power > best.power)) {
            best = spell;
        }
    }
    return best;
}

// A kill's runes (version 106): an elemental rune's handful, or a few of the
// map tier's catalyst, so a pack can keep up with OSRS's costs
export function runeDrop(tier: number, roll: number, roll2: number, randInt: (lo: number, hi: number) => number): { id: number; count: number } {
    if (roll < 0.6) {
        const element = [AIR, WATER, EARTH, FIRE][Math.min(3, Math.floor(roll2 * 4))];
        return { id: element, count: randInt(15, 30) };
    }
    return { id: catalystOfTier(tier), count: randInt(4, 8) };
}

// The catalyst a tier's spells need: mind, chaos, death, blood, wrath
export function catalystOfTier(tier: number): number {
    return [MIND, CHAOS, DEATH, BLOOD, WRATH][Math.max(0, Math.min(4, tier - 1))];
}
