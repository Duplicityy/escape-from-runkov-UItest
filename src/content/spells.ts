// The spellbooks: the standard spellbook's twenty combat spells (version 106)
// and Ancient Magicks' sixteen (version 107), OSRS's own, with OSRS's rune
// costs and spot animations. A staff casts them (any weapon that uses
// runes); which ones it can is its tier, as the game has no Magic level: a
// tier 1 staff casts strikes, tier 2 bolts too, then blasts, waves, and at
// tier 5 surges. Ancient Magicks also need a staff that can cast them, OSRS's
// list (ANCIENT_STAVES): rushes at tier 3, bursts and blitzes at 4, barrages
// at 5. A standard spell hits what the staff's max hit says when it is the
// staff's own tier's fire spell, a little less for the other elements, and
// less again for a lower family (spellScale), the way arrows did a bow
// before. Elemental staffs, battlestaves, mystic staves and the tomes give
// their element's runes for nothing, as in OSRS.
import { ItemDef, MATCH_POWER } from "./items";

export type Book = "standard" | "ancient";
export const BOOKS: Book[] = ["standard", "ancient"];

export type Element = "wind" | "water" | "earth" | "fire";
export type SpellFamily = "strike" | "bolt" | "blast" | "wave" | "surge";
export type AncientElement = "smoke" | "shadow" | "blood" | "ice";
export type AncientFamily = "rush" | "burst" | "blitz" | "barrage";

export const ELEMENTS: Element[] = ["wind", "water", "earth", "fire"];
export const FAMILIES: SpellFamily[] = ["strike", "bolt", "blast", "wave", "surge"];
// Across the Ancient page by level, as OSRS lists them; down by family
export const ANCIENT_ELEMENTS: AncientElement[] = ["smoke", "shadow", "blood", "ice"];
export const ANCIENT_FAMILIES: AncientFamily[] = ["rush", "burst", "blitz", "barrage"];

// The runes
export const AIR = 556;
export const WATER = 555;
export const EARTH = 557;
export const FIRE = 554;
export const MIND = 558;
export const CHAOS = 562;
export const DEATH = 560;
export const BLOOD = 565;
export const SOUL = 566;
export const WRATH = 21880;

export type RuneCost = { id: number; n: number };

// What an Ancient spell does besides its hit (version 107), OSRS's way:
// smoke poisons (a share of the spell's max hit every POISON_EVERY seconds,
// POISON_HITS times), shadow takes a share off the target's hits for
// WEAKEN_SECONDS, blood heals the caster a share of what it dealt, and ice
// freezes the target in place (bosses shrug it off)
export type SpellEffect =
    | { kind: "poison"; share: number }
    | { kind: "weaken"; share: number }
    | { kind: "heal"; share: number }
    | { kind: "freeze"; seconds: number };
export const POISON_EVERY = 3;
export const POISON_HITS = 5;
export const WEAKEN_SECONDS = 30;

export type SpellDef = {
    id: string;
    name: string;
    book: Book;
    family: SpellFamily | AncientFamily;
    element: Element | AncientElement;
    // The staff tier that casts it (a family's tier)
    tier: number;
    // Its share of the staff's max hit against MATCH_POWER (spellScale)
    power: number;
    runes: RuneCost[];
    // Spot animations: on the caster, flying, and where it lands. A spell
    // with no flight (a burst, a barrage but ice's) lands on the target as
    // it's cast.
    cast?: number;
    projectile?: number;
    impact: number;
    // A burst or barrage: everything within a tile of the target (OSRS's
    // three by three) takes it too, up to nine in all
    area?: boolean;
    effect?: SpellEffect;
    // The spellbook's icon (public/ui/spells/<id>.png, the cache's sprite)
    icon: string;
    // The caster's animation and the spell's sounds as it's cast and where
    // it lands, OSRS's own (version 108)
    clip: CastClip;
    castSound: number;
    hitSound: number;
};

// The player's cast animations (Run Escape's PLAYER_CLIPS): OSRS's staff
// casts for strikes, bolts and blasts (1162) and waves (1167), the surge
// (7855), and Ancient Magicks' single (1978) and area (1979) casts
export type CastClip = "cast_staff" | "cast_wave" | "cast_surge" | "cast_ancient" | "cast_ancient_area";
const FAMILY_CLIP: Record<SpellFamily | AncientFamily, CastClip> = {
    strike: "cast_staff",
    bolt: "cast_staff",
    blast: "cast_staff",
    wave: "cast_wave",
    surge: "cast_surge",
    rush: "cast_ancient",
    blitz: "cast_ancient",
    burst: "cast_ancient_area",
    barrage: "cast_ancient_area",
};

// OSRS's sound ids (the wiki's list of sound ids): [cast, hit]
const STANDARD_SOUNDS: Record<SpellFamily, Record<Element, [number, number]>> = {
    strike: { wind: [220, 221], water: [211, 212], earth: [132, 133], fire: [160, 161] },
    bolt: { wind: [218, 219], water: [209, 210], earth: [130, 131], fire: [157, 158] },
    blast: { wind: [216, 217], water: [207, 208], earth: [128, 129], fire: [155, 156] },
    wave: { wind: [222, 223], water: [213, 214], earth: [134, 135], fire: [162, 163] },
    surge: { wind: [4028, 4027], water: [4030, 4029], earth: [4025, 4026], fire: [4032, 4031] },
};
// Ancient Magicks: one cast sound an element, a hit sound a spell
const ANCIENT_CAST_SOUND: Record<AncientElement, number> = { smoke: 183, shadow: 178, blood: 106, ice: 171 };
const ANCIENT_HIT_SOUND: Record<AncientFamily, Record<AncientElement, number>> = {
    rush: { smoke: 185, shadow: 179, blood: 110, ice: 173 },
    burst: { smoke: 182, shadow: 177, blood: 105, ice: 170 },
    blitz: { smoke: 181, shadow: 176, blood: 104, ice: 169 },
    barrage: { smoke: 180, shadow: 175, blood: 102, ice: 168 },
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

const STANDARD: SpellDef[] = FAMILIES.flatMap((family) =>
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
            book: "standard" as const,
            family,
            element,
            tier,
            power: Math.round(MATCH_POWER[tier] * ELEMENT_POWER[element] * 1000) / 1000,
            runes,
            cast,
            projectile,
            impact,
            icon: id,
            clip: FAMILY_CLIP[family],
            castSound: STANDARD_SOUNDS[family][element][0],
            hitSound: STANDARD_SOUNDS[family][element][1],
        };
    }),
);

// An Ancient spell's power from its OSRS max hit, on the line the standard
// fire spells draw through theirs (OSRS 8, 12, 16, 20, 24 are the game's
// 0.8, 1.0, 1.2, 1.3, 1.45), carried on past 24 at the surge's slope
function powerOfMaxHit(max: number): number {
    const points: [number, number][] = [
        [8, MATCH_POWER[1]],
        [12, MATCH_POWER[2]],
        [16, MATCH_POWER[3]],
        [20, MATCH_POWER[4]],
        [24, MATCH_POWER[5]],
    ];
    for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        if (max <= x1 || i === points.length - 1) {
            return Math.round((y0 + ((max - x0) * (y1 - y0)) / (x1 - x0)) * 1000) / 1000;
        }
    }
    return MATCH_POWER[5];
}

const ANCIENT_TIER: Record<AncientFamily, number> = { rush: 3, burst: 4, blitz: 4, barrage: 5 };

// OSRS's Ancient Magicks (the wiki's numbers): max hit, runes, and the look
// [cast, projectile, impact] (0 for none)
type AncientRow = { max: number; runes: [number, number][]; look: [number, number, number] };
const ANCIENT: Record<AncientFamily, Record<AncientElement, AncientRow>> = {
    rush: {
        smoke: { max: 13, runes: [[AIR, 1], [FIRE, 1], [CHAOS, 2], [DEATH, 2]], look: [0, 384, 385] },
        shadow: { max: 14, runes: [[AIR, 1], [SOUL, 1], [CHAOS, 2], [DEATH, 2]], look: [0, 378, 379] },
        blood: { max: 15, runes: [[BLOOD, 1], [CHAOS, 2], [DEATH, 2]], look: [0, 372, 373] },
        ice: { max: 16, runes: [[WATER, 2], [CHAOS, 2], [DEATH, 2]], look: [0, 360, 361] },
    },
    burst: {
        smoke: { max: 17, runes: [[AIR, 2], [FIRE, 2], [CHAOS, 4], [DEATH, 2]], look: [0, 0, 389] },
        shadow: { max: 18, runes: [[AIR, 1], [SOUL, 2], [CHAOS, 4], [DEATH, 2]], look: [0, 0, 382] },
        blood: { max: 21, runes: [[BLOOD, 2], [CHAOS, 4], [DEATH, 2]], look: [0, 0, 376] },
        ice: { max: 22, runes: [[WATER, 4], [CHAOS, 4], [DEATH, 2]], look: [0, 0, 363] },
    },
    blitz: {
        smoke: { max: 23, runes: [[AIR, 2], [FIRE, 2], [BLOOD, 2], [DEATH, 2]], look: [0, 386, 387] },
        shadow: { max: 24, runes: [[AIR, 2], [SOUL, 2], [BLOOD, 2], [DEATH, 2]], look: [0, 380, 381] },
        blood: { max: 25, runes: [[BLOOD, 4], [DEATH, 2]], look: [0, 374, 375] },
        ice: { max: 26, runes: [[WATER, 3], [BLOOD, 2], [DEATH, 2]], look: [366, 0, 367] },
    },
    barrage: {
        smoke: { max: 27, runes: [[AIR, 4], [FIRE, 4], [BLOOD, 2], [DEATH, 4]], look: [0, 0, 391] },
        shadow: { max: 28, runes: [[AIR, 4], [SOUL, 3], [BLOOD, 2], [DEATH, 4]], look: [0, 0, 383] },
        blood: { max: 29, runes: [[BLOOD, 4], [DEATH, 4], [SOUL, 1]], look: [0, 0, 377] },
        ice: { max: 30, runes: [[WATER, 6], [BLOOD, 2], [DEATH, 4]], look: [0, 368, 369] },
    },
};

// OSRS's freezes: 4.8, 9.6, 14.4 and 19.2 seconds
const FREEZE_SECONDS: Record<AncientFamily, number> = { rush: 4.8, burst: 9.6, blitz: 14.4, barrage: 19.2 };

function ancientEffect(family: AncientFamily, element: AncientElement): SpellEffect {
    const strong = family === "blitz" || family === "barrage";
    switch (element) {
        case "smoke":
            // OSRS starts the poison at 2 (rush, burst) or 4 (blitz, barrage)
            return { kind: "poison", share: strong ? 0.17 : 0.15 };
        case "shadow":
            return { kind: "weaken", share: strong ? 0.15 : 0.1 };
        case "blood":
            return { kind: "heal", share: 0.25 };
        case "ice":
            return { kind: "freeze", seconds: FREEZE_SECONDS[family] };
    }
}

const ANCIENT_SPELLS: SpellDef[] = ANCIENT_FAMILIES.flatMap((family) =>
    ANCIENT_ELEMENTS.map((element) => {
        const row = ANCIENT[family][element];
        const [cast, projectile, impact] = row.look;
        const id = `${element}_${family}`;
        return {
            id,
            name: `${cap(element)} ${cap(family)}`,
            book: "ancient" as const,
            family,
            element,
            tier: ANCIENT_TIER[family],
            power: powerOfMaxHit(row.max),
            runes: row.runes.map(([rune, n]) => ({ id: rune, n })),
            cast: cast || undefined,
            projectile: projectile || undefined,
            impact,
            area: family === "burst" || family === "barrage",
            effect: ancientEffect(family, element),
            icon: id,
            clip: FAMILY_CLIP[family],
            castSound: ANCIENT_CAST_SOUND[element],
            hitSound: ANCIENT_HIT_SOUND[family][element],
        };
    }),
);

export const SPELLS: SpellDef[] = [...STANDARD, ...ANCIENT_SPELLS];
export const SPELL_BY_ID = new Map(SPELLS.map((s) => [s.id, s]));

// The staves that cast Ancient Magicks, OSRS's list: the ancient staff and
// sceptres, the master, Kodai and dragon hunter wands, the nightmare staves,
// Thammaron's and the accursed sceptre; Ahrim's staff with Ahrim's whole set
export const ANCIENT_STAVES = new Set([4675, 27624, 25489, 25490, 25491, 25492, 6914, 21006, 30070, 24422, 24424, 24425, 22555, 27665]);
export const AHRIMS_STAFF = 4710;

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

// Whether a staff casts Ancient Magicks at all (Ahrim's only with its set)
export function castsAncients(weapon: ItemDef | undefined, ahrimSet = false): boolean {
    return !!weapon && (ANCIENT_STAVES.has(weapon.id) || (weapon.id === AHRIMS_STAFF && ahrimSet));
}

// Whether a staff can cast a spell at all: its tier is enough, and for an
// Ancient spell it's a staff that casts them
export function staffCasts(weapon: ItemDef | undefined, spell: SpellDef, ahrimSet = false): boolean {
    return weapon?.uses === "runes" && weapon.tier >= spell.tier && (spell.book === "standard" || castsAncients(weapon, ahrimSet));
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

// The spell a staff casts on its own (autocast unset): the strongest of the
// book open it can cast, with the runes for it
export function bestSpell(weapon: ItemDef | undefined, given: Set<number>, count: (id: number) => number, book: Book = "standard", ahrimSet = false): SpellDef | undefined {
    let best: SpellDef | undefined;
    for (const spell of SPELLS) {
        if (spell.book === book && staffCasts(weapon, spell, ahrimSet) && castsLeft(spell, given, count) > 0 && (!best || spell.power > best.power)) {
            best = spell;
        }
    }
    return best;
}

// A kill's runes (version 106): an elemental rune's handful, or a few of a
// catalyst: half the time the map tier's own, else one of the tiers below
// that Ancient Magicks also want (chaos, death, and from tier 4 soul runes)
export function runeDrop(tier: number, roll: number, roll2: number, randInt: (lo: number, hi: number) => number): { id: number; count: number } {
    if (roll < 0.6) {
        const element = [AIR, WATER, EARTH, FIRE][Math.min(3, Math.floor(roll2 * 4))];
        return { id: element, count: randInt(15, 30) };
    }
    const lower = [...(tier >= 3 ? [CHAOS] : []), ...(tier >= 4 ? [DEATH, SOUL] : [])];
    if (roll < 0.8 && lower.length > 0) {
        return { id: lower[Math.min(lower.length - 1, Math.floor(roll2 * lower.length))], count: randInt(4, 8) };
    }
    return { id: catalystOfTier(tier), count: randInt(4, 8) };
}

// The catalyst a tier's spells need: mind, chaos, death, blood, wrath
export function catalystOfTier(tier: number): number {
    return [MIND, CHAOS, DEATH, BLOOD, WRATH][Math.max(0, Math.min(4, tier - 1))];
}
