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

// "staff": a staff's own spells (version 110), the god spells, Iban Blast and
// Magic Dart, and a powered staff's built-in spell; no book of their own
export type Book = "standard" | "ancient" | "staff";
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
// The lithic sceptre's (version 110)
export const BODY = 559;

export type RuneCost = { id: number; n: number };

// What an Ancient spell does besides its hit (version 107), OSRS's way:
// smoke poisons (a share of the spell's max hit every POISON_EVERY seconds,
// POISON_HITS times), shadow takes a share off the target's hits for
// WEAKEN_SECONDS, blood heals the caster a share of what it dealt, and ice
// freezes the target in place (bosses shrug it off)
// (version 110) chance: on that share of hits only (the swamp trident's
// venom, the Sanguinesti staff's heal)
export type SpellEffect = (
    | { kind: "poison"; share: number }
    | { kind: "weaken"; share: number }
    | { kind: "heal"; share: number }
    | { kind: "freeze"; seconds: number }
) & { chance?: number };
export const POISON_EVERY = 3;
export const POISON_HITS = 5;
export const WEAKEN_SECONDS = 30;

export type SpellDef = {
    id: string;
    name: string;
    book: Book;
    family: SpellFamily | AncientFamily | "staff";
    element: Element | AncientElement | "staff";
    // The staff tier that casts it (a family's tier)
    tier: number;
    // Its share of the staff's max hit against MATCH_POWER (spellScale); a
    // powered staff's own spell has none: it hits the staff's max hit
    power: number;
    // A powered staff's own spell: the staff that casts it (version 110)
    poweredBy?: number;
    // Whose heal it is to show on the caster (the Sanguinesti staff's)
    healLook?: number;
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
    // None for a spell OSRS sounds only where it lands (the god spells)
    castSound?: number;
    hitSound: number;
};

// The player's cast animations (Run Escape's PLAYER_CLIPS): OSRS's staff
// casts for strikes, bolts and blasts (1162) and waves (1167), the surge
// (7855), and Ancient Magicks' single (1978) and area (1979) casts
export type CastClip =
    | "cast_staff"
    | "cast_wave"
    | "cast_surge"
    | "cast_ancient"
    | "cast_ancient_area"
    // The staves' own (version 110): the god spells (811), Iban Blast (708),
    // Magic Dart (1576), the tridents and the Sanguinesti staff (11430),
    // Tumeken's shadow (9493), the warped sceptre (10501), the Eye of Ayak
    // (12397)
    | "cast_god"
    | "cast_iban"
    | "cast_dart"
    | "cast_trident"
    | "cast_shadow"
    | "cast_warped"
    | "cast_ayak";
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

// A staff's own spells (version 110), OSRS's: the god spells, Iban Blast and
// Magic Dart, each cast only by the staves OSRS lets cast it (STAFF_MAGIC),
// with its OSRS max hit, runes, animation, graphics and sounds. All of them
// at tier 3, the god staves' and Iban's and the Slayer's staff's.
type StaffSpellDef = {
    id: string;
    name: string;
    max: number;
    runes: [number, number][];
    cast?: number;
    projectile?: number;
    impact: number;
    clip: CastClip;
    castSound?: number;
    hitSound: number;
};
const STAFF_SPELL_DEFS: StaffSpellDef[] = [
    // The god spells strike from above: nothing flies, and OSRS sounds them
    // where they land
    { id: "saradomin_strike", name: "Saradomin Strike", max: 20, runes: [[AIR, 4], [FIRE, 2], [BLOOD, 2]], impact: 76, clip: "cast_god", hitSound: 1659 },
    { id: "claws_of_guthix", name: "Claws of Guthix", max: 20, runes: [[AIR, 4], [FIRE, 1], [BLOOD, 2]], impact: 77, clip: "cast_god", hitSound: 1653 },
    { id: "flames_of_zamorak", name: "Flames of Zamorak", max: 20, runes: [[AIR, 1], [FIRE, 4], [BLOOD, 2]], impact: 78, clip: "cast_god", hitSound: 1655 },
    { id: "iban_blast", name: "Iban Blast", max: 25, runes: [[FIRE, 5], [DEATH, 1]], cast: 87, projectile: 88, impact: 89, clip: "cast_iban", castSound: 1341, hitSound: 163 },
    // At 99 Magic: 99 / 10 + 10
    { id: "magic_dart", name: "Magic Dart", max: 19, runes: [[MIND, 4], [DEATH, 1]], projectile: 328, impact: 329, clip: "cast_dart", castSound: 1718, hitSound: 174 },
];
const STAFF_SPELLS: SpellDef[] = STAFF_SPELL_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    book: "staff",
    family: "staff",
    element: "staff",
    tier: 3,
    power: powerOfMaxHit(d.max),
    runes: d.runes.map(([id, n]) => ({ id, n })),
    cast: d.cast,
    projectile: d.projectile,
    impact: d.impact,
    icon: d.id,
    clip: d.clip,
    castSound: d.castSound,
    hitSound: d.hitSound,
}));

// The powered staves (version 110): OSRS's tridents, the Sanguinesti staff,
// Tumeken's shadow, the warped sceptre, the bone staff, the Eye of Ayak and
// the lithic sceptre cast their own spell and nothing else, for what one of
// their charges costs in runes (the trident's coins and scales left out). It
// hits the staff's max hit. The swamp trident envenoms a hit in four, and the
// Sanguinesti staff heals half a hit's damage one hit in five. Sounds OSRS's
// lists name where they do (Tumeken's shadow, the swamp trident's and the
// eye's cast); otherwise the nearest OSRS spell's.
type PoweredDef = {
    staff: number;
    id: string;
    name: string;
    runes: [number, number][];
    cast?: number;
    projectile: number;
    impact: number;
    clip: CastClip;
    castSound: number;
    hitSound: number;
    effect?: SpellEffect;
    healLook?: number;
};
const POWERED_DEFS: PoweredDef[] = [
    { staff: 11905, id: "trident_seas", name: "Trident of the seas", runes: [[DEATH, 1], [CHAOS, 1], [FIRE, 5]], cast: 1251, projectile: 1252, impact: 1253, clip: "cast_trident", castSound: 213, hitSound: 214 },
    {
        staff: 12899,
        id: "trident_swamp",
        name: "Trident of the swamp",
        runes: [[DEATH, 1], [CHAOS, 1], [FIRE, 5]],
        cast: 665,
        projectile: 1040,
        impact: 1042,
        clip: "cast_trident",
        castSound: 178,
        hitSound: 179,
        effect: { kind: "poison", share: 0.2, chance: 0.25 },
    },
    {
        staff: 22323,
        id: "sanguinesti",
        name: "Sanguinesti staff",
        runes: [[BLOOD, 2]],
        cast: 1540,
        projectile: 1539,
        impact: 1541,
        clip: "cast_trident",
        castSound: 106,
        hitSound: 102,
        effect: { kind: "heal", share: 0.5, chance: 0.2 },
        healLook: 1542,
    },
    { staff: 27275, id: "tumekens_shadow", name: "Tumeken's shadow", runes: [[SOUL, 2], [CHAOS, 5]], cast: 2125, projectile: 2126, impact: 2127, clip: "cast_shadow", castSound: 6410, hitSound: 1460 },
    { staff: 28585, id: "warped_sceptre", name: "Warped sceptre", runes: [[CHAOS, 2], [EARTH, 5]], cast: 2567, projectile: 2569, impact: 2568, clip: "cast_warped", castSound: 134, hitSound: 135 },
    { staff: 28796, id: "bone_staff", name: "Bone staff", runes: [[CHAOS, 1]], cast: 2645, projectile: 2647, impact: 2646, clip: "cast_staff", castSound: 7647, hitSound: 7620 },
    { staff: 31113, id: "eye_of_ayak", name: "Eye of Ayak", runes: [[DEATH, 2], [CHAOS, 1]], cast: 3366, projectile: 3367, impact: 3368, clip: "cast_ayak", castSound: 178, hitSound: 5595 },
    { staff: 33255, id: "lithic_sceptre", name: "Lithic sceptre", runes: [[BODY, 1], [EARTH, 3]], projectile: 3751, impact: 3752, clip: "cast_staff", castSound: 134, hitSound: 135 },
];
const POWERED_SPELLS: SpellDef[] = POWERED_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    book: "staff",
    family: "staff",
    element: "staff",
    tier: 1,
    power: 0,
    poweredBy: d.staff,
    runes: d.runes.map(([id, n]) => ({ id, n })),
    cast: d.cast,
    projectile: d.projectile,
    impact: d.impact,
    effect: d.effect,
    healLook: d.healLook,
    // The staff's own item icon
    icon: `item_${d.staff}`,
    clip: d.clip,
    castSound: d.castSound,
    hitSound: d.hitSound,
}));

export const SPELLS: SpellDef[] = [...STANDARD, ...ANCIENT_SPELLS, ...STAFF_SPELLS, ...POWERED_SPELLS];
export const SPELL_BY_ID = new Map(SPELLS.map((s) => [s.id, s]));
const POWERED_BY_STAFF = new Map(POWERED_SPELLS.map((s) => [s.poweredBy!, s]));

// What each staff casts, OSRS's rules (the wiki's autocast tables and item
// pages, version 110). Any staff, wand or sceptre not listed casts the
// standard spellbook's combat spells and nothing more.
// - ancient: Ancient Magicks too: the ancient staff and sceptres, the
//   master, Kodai and dragon hunter wands, the nightmare staves but the
//   harmonised, Zuriel's staff, and Thammaron's and the accursed sceptre
//   (OSRS's attuned ones, which the game's are); Ahrim's staff only with all
//   of Ahrim's set and the amulet of the damned ("ahrim")
// - families: only these of the standard spells (the Slayer's staff's waves
//   and surges)
// - own: the staff's own spells. OSRS lets the god staves cast their god
//   spell but not autocast it; the game only autocasts, so they do.
type StaffMagic = { ancient?: boolean | "ahrim"; families?: SpellFamily[]; own?: string[] };
const STAFF_MAGIC = new Map<number, StaffMagic>([
    ...[4675, 27624, 25489, 25490, 25491, 25492, 6914, 21006, 30070, 24422, 24424, 24425, 22647].map((id): [number, StaffMagic] => [id, { ancient: true }]),
    [22555, { ancient: true, own: ["flames_of_zamorak"] }],
    [27665, { ancient: true, own: ["flames_of_zamorak"] }],
    [4710, { ancient: "ahrim" }],
    [2415, { own: ["saradomin_strike"] }],
    [2416, { own: ["claws_of_guthix"] }],
    [2417, { own: ["flames_of_zamorak"] }],
    [22296, { own: ["saradomin_strike", "magic_dart"] }],
    [11791, { own: ["flames_of_zamorak", "magic_dart"] }],
    [12904, { own: ["flames_of_zamorak", "magic_dart"] }],
    [4170, { families: ["wave", "surge"], own: ["magic_dart"] }],
    [1409, { own: ["iban_blast"] }],
]);
export const AHRIMS_STAFF = 4710;
export const AMULET_OF_THE_DAMNED = 12853;

// A powered staff's own spell, if the weapon is one
export function poweredSpell(weapon: ItemDef | undefined): SpellDef | undefined {
    return weapon ? POWERED_BY_STAFF.get(weapon.id) : undefined;
}

// The staff's own spells, the god spells and the like (not a powered staff's)
export function ownSpells(weapon: ItemDef | undefined): SpellDef[] {
    return (STAFF_MAGIC.get(weapon?.id ?? -1)?.own ?? []).map((id) => SPELL_BY_ID.get(id)!);
}

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

// Whether a staff casts Ancient Magicks at all (Ahrim's only with all of its
// set and the amulet of the damned: ahrimSet)
export function castsAncients(weapon: ItemDef | undefined, ahrimSet = false): boolean {
    const ancient = STAFF_MAGIC.get(weapon?.id ?? -1)?.ancient;
    return ancient === true || (ancient === "ahrim" && ahrimSet);
}

// Whether a staff can cast a spell at all, OSRS's rules (STAFF_MAGIC): a
// powered staff only its own; a standard spell of a family the staff casts,
// an Ancient one if it casts them, one of its own spells; and its tier is
// enough
export function staffCasts(weapon: ItemDef | undefined, spell: SpellDef, ahrimSet = false): boolean {
    if (weapon?.uses !== "runes") {
        return false;
    }
    const powered = poweredSpell(weapon);
    if (powered || spell.poweredBy !== undefined) {
        return powered === spell;
    }
    if (weapon.tier < spell.tier) {
        return false;
    }
    const magic = STAFF_MAGIC.get(weapon.id);
    switch (spell.book) {
        case "standard":
            return !magic?.families || magic.families.includes(spell.family as SpellFamily);
        case "ancient":
            return castsAncients(weapon, ahrimSet);
        case "staff":
            return magic?.own?.includes(spell.id) ?? false;
    }
}

// A spell's share of the staff's max hit: its power against the staff's own
// tier's best (MATCH_POWER, as ammoScale has it for arrows); a powered
// staff's own spell hits the staff's max hit
export function spellScale(weapon: ItemDef | undefined, spell: SpellDef): number {
    if (spell.poweredBy !== undefined) {
        return 1;
    }
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

// The spell a staff casts on its own (autocast unset): a powered staff's own;
// else the strongest it can cast of the book open, or of its own spells
// (version 110: a god staff's god spell, with the runes, beats its blasts),
// with the runes for it
export function bestSpell(weapon: ItemDef | undefined, given: Set<number>, count: (id: number) => number, book: Book = "standard", ahrimSet = false): SpellDef | undefined {
    const powered = poweredSpell(weapon);
    if (powered) {
        return castsLeft(powered, given, count) > 0 ? powered : undefined;
    }
    let best: SpellDef | undefined;
    for (const spell of SPELLS) {
        if ((spell.book === book || spell.book === "staff") && staffCasts(weapon, spell, ahrimSet) && castsLeft(spell, given, count) > 0 && (!best || spell.power > best.power)) {
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
