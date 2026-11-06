// Every item in the game, keyed by its OSRS cache id (the folder under
// public/assets/items). Wearable gear only comes out of dungeon chests; the
// shop sells food and buys anything.

export type Slot =
    | "weapon"
    | "shield"
    | "head"
    | "body"
    | "legs"
    | "feet"
    | "hands"
    | "cape"
    | "neck"
    | "ring";

export const SLOTS: Slot[] = [
    "weapon",
    "shield",
    "head",
    "body",
    "legs",
    "feet",
    "hands",
    "cape",
    "neck",
    "ring",
];

// How a weapon is held, standing and running (player.ts plays idle_<stance>
// and run_<stance>): the two handed sword's, the staff's (spears and
// halberds too), the whip's, the godsword's, the maul's and the bulwark's
export type Stance = "2h" | "staff" | "whip" | "godsword" | "maul" | "bulwark";

export type ItemDef = {
    id: number;
    name: string;
    // Where it's worn; food and coins have none
    slot?: Slot;
    // Chest loot tier, 1 (bronze) to 5 (the best in the game)
    tier: number;
    // Shop value in coins; selling pays a quarter (inventory.ts)
    value: number;
    // Weapons: max hit, seconds between swings, reach in tiles, and whether
    // it fires a projectile instead of swinging
    damage?: number;
    speed?: number;
    range?: number;
    ranged?: boolean;
    // Two handed weapons take the shield slot too
    twoHanded?: boolean;
    sound?: string;
    // How the character holds it: the clips a stance plays standing and
    // running (player.ts), and the swing it makes
    stance?: Stance;
    attackClip?: "attack" | "attack_stab" | "attack_whip" | "attack_2h" | "attack_bow" | "attack_cast" | "attack_maul" | "attack_spear";
    // What it shoots: a spot animation flying to the target, and one where it
    // lands
    projectile?: number;
    impact?: number;
    // Armour: damage soaked, and extra hitpoints
    defence?: number;
    hp?: number;
    // Prayer bonus, OSRS's: each point makes the prayer bar drain that much
    // slower under protection and refill that much faster without, a thirtieth
    // a point (PRAYER_BONUS_SCALE; set from PRAYER_BONUS below)
    prayer?: number;
    // Food: hitpoints healed when eaten
    heal?: number;
    // A drink: what it does for POTION_SECONDS
    potion?: Potion;
    stackable?: boolean;
    // A bow or staff: the ammunition each shot takes from the pack. A thrown
    // weapon (a dart, a knife, a chinchompa) takes none: it's its own.
    uses?: "arrows" | "runes";
    // Ammunition of that kind
    ammo?: "arrows" | "runes";
    // Ammunition's: a shot's share of the weapon's max hit, against what
    // the weapon's own tier's best kind gives (MATCH_POWER, ammoScale in
    // combat.ts): a bow with the arrows made for it hits what its max hit
    // says, better arrows above that and worse below
    power?: number;
    // A chinchompa: what it hits, everything beside it takes half
    splash?: boolean;
    // A weapon's special attack (every weapon has one; see specialOf)
    special?: Special;
    // A clue scroll: it names a spot on the map to dig at (run.ts)
    clue?: boolean;
    // The key to the map's vault, carried by one of its champions
    key?: boolean;
    // The key to the map's golden chest, which the boss always drops
    bossKey?: boolean;
    // Armour's kind, the combat triangle's way: plate and mail are melee
    // armour, hides and leathers ranged, robes magic. A piece's defence is
    // halved against the style its kind is weak to (melee to magic, ranged
    // to melee, magic to ranged), and worn armour helps the matching
    // weapon's hits and hurts the others' (inventory.ts). Unset is neutral:
    // jewellery, capes, void.
    style?: AttackStyle;
    // One crowned test character's alone (kit.ts): the owner's (version 83,
    // the gilded pieces) or the playtester's (version 89, the Guthix sunfire
    // set). Never in a chest, a drop or the shop, and no tier's prize.
    exclusive?: "owner" | "playtester";
};

export type AttackStyle = "melee" | "ranged" | "magic";
export const ATTACK_STYLES: AttackStyle[] = ["melee", "ranged", "magic"];

// What a weapon hits with
export function weaponStyle(weapon: ItemDef | undefined): AttackStyle {
    if (!weapon) {
        return "melee";
    }
    return weapon.uses === "runes" ? "magic" : weapon.ranged ? "ranged" : "melee";
}

// The style each kind of armour is weak to
export const WEAK_TO: Record<AttackStyle, AttackStyle> = { melee: "magic", ranged: "melee", magic: "ranged" };

// An armour piece's kind by its name, OSRS's way; nothing for the neutral
function armourStyle(item: ItemDef): AttackStyle | undefined {
    if (!item.slot || item.slot === "weapon" || item.slot === "neck" || item.slot === "cape") {
        return undefined;
    }
    const name = item.name.toLowerCase();
    if (/void|climbing|anti-dragon|highwayman|beret|santa|ring of life/.test(name)) {
        return undefined;
    }
    if (
        /leather|d'hide|studded|snakeskin|coif|cowl|vambrace|chaps|karil|ranger|archer|armadyl|masori|crystal|robin hood|pegasian|spined|range |morrigan|dragonfire ward|odium|venator|tunic/.test(
            name,
        )
    ) {
        return "ranged";
    }
    if (
        /robe|hood|wizard|ahrim|farseer|seers|book|tome|mystic|infinity|ancestral|tormented|eternal|xerician|splitbark|dagon'hai|elder chaos|virtus|skeletal|enchanted|lunar|zuriel|bloodbark|swampbark|mage|wyvern|malediction|elidinis|magus|ghostly|moonclan|squall|druid/.test(
            name,
        )
    ) {
        return "magic";
    }
    return "melee";
}

// A special attack: the next swing lands this many hits at this much of
// the usual damage, and heals this share of what it dealt
export type Special = { name: string; hits: number; power: number; heal?: number };

// The weapon's special: its own, or its kind's
export function specialOf(weapon: ItemDef | undefined): Special | undefined {
    if (!weapon || !weapon.slot) {
        return undefined;
    }
    if (weapon.special) {
        return weapon.special;
    }
    if (weapon.uses === "runes") {
        // Named so it isn't taken for the Surge spells (version 106)
        return { name: "Power surge", hits: 1, power: 1.7 };
    }
    if (weapon.ranged) {
        return { name: "Snap shot", hits: 2, power: 0.85 };
    }
    return { name: "Heavy blow", hits: 1, power: 1.5 };
}

export type Potion = "strength" | "defence" | "brew" | "prayer";
export const POTION_SECONDS = 90;
// What a prayer potion puts back on the prayer bar, of its 100
export const PRAYER_RESTORE = 40;
export const POTION_EFFECT: Record<Potion, string> = {
    strength: "hits a quarter harder for a while",
    defence: "20 more defence for a while",
    brew: "heals 40, and 15 more hitpoints for a while",
    prayer: `puts ${PRAYER_RESTORE} back on the prayer bar`,
};

function potion(id: number, name: string, kind: Potion, value: number): ItemDef {
    return { id, name, tier: 0, value, stackable: true, potion: kind };
}

const SWING = "2500";
const ARROW = "2707";
const WHIP = "2720";
const SPELL = "160";

function weapon(
    id: number,
    name: string,
    tier: number,
    damage: number,
    speed: number,
    value: number,
    extra: Partial<ItemDef> = {},
): ItemDef {
    return { id, name, slot: "weapon", tier, damage, speed, range: 1.3, value, sound: SWING, ...extra };
}

function bow(
    id: number,
    name: string,
    tier: number,
    damage: number,
    speed: number,
    value: number,
    projectile: number,
): ItemDef {
    return weapon(id, name, tier, damage, speed, value, {
        ranged: true,
        range: 7,
        twoHanded: true,
        sound: ARROW,
        attackClip: "attack_bow",
        projectile,
        uses: "arrows",
    });
}

function staff(id: number, name: string, tier: number, damage: number, value: number): ItemDef {
    return weapon(id, name, tier, damage, 1.8, value, {
        ranged: true,
        range: 6,
        sound: SPELL,
        stance: "staff",
        attackClip: "attack_cast",
        projectile: 100,
        impact: 101,
        uses: "runes",
    });
}

// The arrows each bow shoots when nothing's known of what's in the pack (a
// shot takes its look from the arrows it is, run.ts), by the metal that
// suits it; a crossbow shoots a bolt whatever's packed
const ARROW_BRONZE = 10;
const ARROW_IRON = 9;
const ARROW_STEEL = 11;
const ARROW_MITHRIL = 12;
const ARROW_ADAMANT = 13;
const ARROW_RUNE = 15;
const ARROW_AMETHYST = 1384;
const ARROW_DRAGON = 1120;
export const BOLT = 27;

// A thrown weapon: a dart, a knife, an axe, a chinchompa, a salamander's
// flame. Ranged, one in the hand, and nothing taken from the pack: it's its
// own ammunition, which is why it hits less than a bow of its tier.
function thrown(id: number, name: string, tier: number, damage: number, speed: number, value: number, projectile: number, extra: Partial<ItemDef> = {}): ItemDef {
    return weapon(id, name, tier, damage, speed, value, { ranged: true, range: 4, sound: ARROW, projectile, ...extra });
}

// Ammunition: a kind of arrow or rune. Its tier is the maps whose enemies
// drop it (and the shop sells it once a map of that tier is open); its
// power is a shot's share of the weapon's max hit against MATCH_POWER (the
// ItemDef says). The look is the arrow or spell flying and, for a spell,
// landing.
function ammo(id: number, name: string, kind: "arrows" | "runes", tier: number, power: number, value: number, projectile: number, impact?: number): ItemDef {
    return { id, name, tier, value, stackable: true, ammo: kind, power, projectile, impact };
}

// What a weapon's own tier's best ammunition has for power, by tier: with
// it a bow or staff hits what its max hit says
export const MATCH_POWER = [1, 0.8, 1.0, 1.2, 1.3, 1.45];

function armour(
    id: number,
    name: string,
    slot: Slot,
    tier: number,
    defence: number,
    value: number,
    extra: Partial<ItemDef> = {},
): ItemDef {
    return { id, name, slot, tier, defence, value, ...extra };
}

function food(id: number, name: string, heal: number, value: number): ItemDef {
    return { id, name, tier: 0, heal, value, stackable: true };
}

// Metal tiers share stats: [tier, max hit scale, defence scale, value scale]
const METALS: Record<string, [number, number, number, number]> = {
    bronze: [1, 1.0, 1.0, 1],
    iron: [1, 1.3, 1.4, 3],
    steel: [2, 1.7, 1.9, 8],
    black: [2, 1.9, 2.1, 12],
    mithril: [2, 2.1, 2.4, 25],
    adamant: [3, 2.6, 3.0, 60],
    rune: [3, 3.3, 3.8, 250],
};

type MetalIds = Record<string, number | undefined>;

function metalSet(
    ids: MetalIds,
    make: (id: number, metal: string, tier: number, scale: number, defScale: number, valueScale: number) => ItemDef,
): ItemDef[] {
    const out: ItemDef[] = [];
    for (const [metal, id] of Object.entries(ids)) {
        if (id === undefined) {
            continue;
        }
        const [tier, scale, defScale, valueScale] = METALS[metal];
        out.push(make(id, metal, tier, scale, defScale, valueScale));
    }
    return out;
}

const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);

// How the fifth batch's weapon kinds are held and swung
const X_2H: Partial<ItemDef> = { twoHanded: true, range: 1.6, stance: "2h", attackClip: "attack_2h" };
const X_HALBERD: Partial<ItemDef> = { twoHanded: true, range: 2.2, stance: "2h", attackClip: "attack_2h" };
const X_SPEAR: Partial<ItemDef> = { twoHanded: true, range: 2.0, stance: "2h", attackClip: "attack_stab" };
const X_HASTA: Partial<ItemDef> = { range: 1.8, attackClip: "attack_stab" };
const X_STAB: Partial<ItemDef> = { attackClip: "attack_stab" };

export const ITEMS: ItemDef[] = [
    // Daggers: fast, light
    ...metalSet(
        { bronze: 1205, iron: 1203, steel: 1207, mithril: 1209, adamant: 1211, rune: 1213 },
        (id, m, tier, s, _d, v) =>
            weapon(id, `${cap(m)} dagger`, tier, Math.round(5 * s), 0.6, 20 * v, { attackClip: "attack_stab" }),
    ),
    weapon(1215, "Dragon dagger", 4, 20, 0.55, 17000, {
        attackClip: "attack_stab",
        special: { name: "Puncture", hits: 2, power: 1.15 },
    }),
    // Swords
    ...metalSet(
        { bronze: 1277, iron: 1279, steel: 1281, mithril: 1285, adamant: 1287, rune: 1289 },
        (id, m, tier, s, _d, v) => weapon(id, `${cap(m)} sword`, tier, Math.round(7 * s), 0.8, 30 * v),
    ),
    // Scimitars: the all rounder
    ...metalSet(
        { bronze: 1321, iron: 1323, steel: 1325, mithril: 1329, adamant: 1331, rune: 1333 },
        (id, m, tier, s, _d, v) => weapon(id, `${cap(m)} scimitar`, tier, Math.round(8 * s), 0.75, 40 * v),
    ),
    weapon(4587, "Dragon scimitar", 4, 30, 0.7, 60000, { special: { name: "Sever", hits: 1, power: 1.4 } }),
    weapon(1305, "Dragon longsword", 4, 32, 0.8, 58000, { special: { name: "Cleave", hits: 1, power: 1.7 } }),
    // Maces
    ...metalSet(
        { bronze: 1422, iron: 1420, steel: 1424, mithril: 1428, adamant: 1430, rune: 1432 },
        (id, m, tier, s, _d, v) => weapon(id, `${cap(m)} mace`, tier, Math.round(8 * s), 0.85, 35 * v),
    ),
    weapon(1434, "Dragon mace", 4, 31, 0.85, 50000),
    // Axes: slow and heavy
    ...metalSet(
        { bronze: 1351, iron: 1349, steel: 1353, mithril: 1355, adamant: 1357, rune: 1359 },
        (id, m, tier, s, _d, v) => weapon(id, `${cap(m)} axe`, tier, Math.round(10 * s), 1.0, 30 * v),
    ),
    // Two handed swords: huge, slow, long reach
    ...metalSet(
        { bronze: 1307, iron: 1309, steel: 1311, mithril: 1315, adamant: 1317, rune: 1319 },
        (id, m, tier, s, _d, v) =>
            weapon(id, `${cap(m)} 2h sword`, tier, Math.round(15 * s), 1.4, 80 * v, {
                twoHanded: true,
                range: 1.8,
                stance: "2h",
                attackClip: "attack_2h",
            }),
    ),
    weapon(4151, "Abyssal whip", 4, 34, 0.6, 120000, {
        sound: WHIP,
        range: 1.6,
        stance: "whip",
        attackClip: "attack_whip",
        special: { name: "Drain", hits: 1, power: 1.3, heal: 0.4 },
    }),
    weapon(4153, "Granite maul", 4, 60, 1.6, 40000, {
        twoHanded: true,
        range: 1.6,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Quick smash", hits: 2, power: 1.0 },
    }),
    weapon(4718, "Dharok's greataxe", 4, 65, 1.5, 150000, {
        twoHanded: true,
        range: 1.8,
        stance: "2h",
        attackClip: "attack_2h",
    }),
    weapon(4747, "Torag's hammers", 4, 48, 1.1, 110000, { twoHanded: true }),
    weapon(4755, "Verac's flail", 4, 44, 0.9, 110000),
    weapon(4726, "Guthan's warspear", 4, 46, 1.0, 110000, {
        twoHanded: true,
        range: 2.0,
        stance: "2h",
        attackClip: "attack_stab",
    }),
    weapon(11802, "Armadyl godsword", 5, 95, 1.4, 2000000, {
        twoHanded: true,
        range: 1.8,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Judgement", hits: 1, power: 2.2 },
    }),
    // Bows
    bow(841, "Shortbow", 1, 6, 0.9, 50, ARROW_BRONZE),
    bow(843, "Oak shortbow", 1, 9, 0.9, 150, ARROW_IRON),
    bow(849, "Willow shortbow", 2, 13, 0.9, 400, ARROW_STEEL),
    bow(853, "Maple shortbow", 2, 18, 0.9, 800, ARROW_MITHRIL),
    bow(855, "Yew longbow", 3, 26, 1.1, 2000, ARROW_ADAMANT),
    { ...bow(861, "Magic shortbow", 3, 30, 0.75, 8000, ARROW_RUNE), special: { name: "Double shot", hits: 2, power: 1.0 } },
    bow(4734, "Karil's crossbow", 4, 42, 0.8, 120000, BOLT),
    bow(20997, "Twisted bow", 5, 90, 0.9, 1500000000, ARROW_RUNE),
    // Staves
    staff(1381, "Staff of air", 1, 8, 200),
    staff(1383, "Staff of water", 1, 9, 200),
    staff(1385, "Staff of earth", 2, 12, 300),
    staff(1387, "Staff of fire", 2, 16, 400),
    staff(4710, "Ahrim's staff", 4, 45, 100000),
    // Helmets
    ...metalSet(
        { bronze: 1155, iron: 1153, steel: 1157, black: 1165, mithril: 1159, adamant: 1161, rune: 1163 },
        (id, m, tier, _s, d, v) => armour(id, `${cap(m)} full helm`, "head", tier, Math.round(4 * d), 30 * v),
    ),
    armour(11335, "Dragon full helm", "head", 4, 26, 60000000),
    armour(1167, "Leather cowl", "head", 1, 2, 20),
    armour(1169, "Coif", "head", 2, 5, 120),
    armour(3751, "Berserker helm", "head", 3, 16, 80000, { hp: 5 }),
    armour(3753, "Warrior helm", "head", 3, 16, 80000),
    armour(3755, "Farseer helm", "head", 3, 14, 80000),
    armour(10828, "Helm of neitiznot", "head", 4, 20, 50000, { hp: 5 }),
    armour(11826, "Armadyl helmet", "head", 5, 24, 5000000),
    armour(26382, "Torva full helm", "head", 5, 32, 200000000, { hp: 10 }),
    armour(4716, "Dharok's helm", "head", 4, 24, 70000),
    armour(4724, "Guthan's helm", "head", 4, 24, 70000),
    armour(4732, "Karil's coif", "head", 4, 18, 70000),
    armour(4745, "Torag's helm", "head", 4, 24, 70000),
    armour(4753, "Verac's helm", "head", 4, 24, 70000),
    armour(4708, "Ahrim's hood", "head", 4, 16, 70000),
    armour(11665, "Void melee helm", "head", 4, 12, 50000, { hp: 8 }),
    armour(11664, "Void ranger helm", "head", 4, 12, 50000, { hp: 8 }),
    armour(11663, "Void mage helm", "head", 4, 12, 50000, { hp: 8 }),
    armour(2631, "Highwayman mask", "head", 2, 3, 500),
    armour(2635, "Black beret", "head", 2, 3, 500),
    // Bodies
    armour(1129, "Leather body", "body", 1, 3, 25),
    armour(1131, "Hardleather body", "body", 2, 6, 150),
    armour(1135, "Green d'hide body", "body", 3, 14, 5000),
    armour(2499, "Blue d'hide body", "body", 3, 17, 8000),
    armour(2503, "Black d'hide body", "body", 4, 22, 12000),
    ...metalSet(
        { bronze: 1117, iron: 1115, steel: 1119, mithril: 1121, adamant: 1123, rune: 1127 },
        (id, m, tier, _s, d, v) => armour(id, `${cap(m)} platebody`, "body", tier, Math.round(8 * d), 80 * v),
    ),
    armour(2615, "Rune platebody (g)", "body", 4, 32, 300000),
    armour(3140, "Dragon chainbody", "body", 4, 42, 1500000),
    armour(11832, "Bandos chestplate", "body", 5, 48, 20000000, { hp: 5 }),
    armour(26384, "Torva platebody", "body", 5, 58, 400000000, { hp: 20 }),
    armour(4720, "Dharok's platebody", "body", 4, 44, 150000),
    armour(4728, "Guthan's platebody", "body", 4, 44, 150000),
    armour(4736, "Karil's leathertop", "body", 4, 34, 150000),
    armour(4749, "Torag's platebody", "body", 4, 44, 150000),
    armour(4757, "Verac's brassard", "body", 4, 44, 150000),
    armour(4712, "Ahrim's robetop", "body", 4, 26, 150000),
    armour(8839, "Void knight top", "body", 4, 20, 100000, { hp: 10 }),
    // Legs
    armour(1095, "Leather chaps", "legs", 1, 2, 20),
    armour(1099, "Green d'hide chaps", "legs", 3, 9, 3000),
    armour(2497, "Black d'hide chaps", "legs", 4, 14, 8000),
    ...metalSet(
        { bronze: 1075, iron: 1067, steel: 1069, black: 1077, mithril: 1071, adamant: 1073, rune: 1079 },
        (id, m, tier, _s, d, v) => armour(id, `${cap(m)} platelegs`, "legs", tier, Math.round(6 * d), 60 * v),
    ),
    armour(4087, "Dragon platelegs", "legs", 4, 32, 200000),
    armour(11834, "Bandos tassets", "legs", 5, 38, 25000000, { hp: 5 }),
    armour(26386, "Torva platelegs", "legs", 5, 48, 300000000, { hp: 15 }),
    armour(4722, "Dharok's platelegs", "legs", 4, 34, 120000),
    armour(4730, "Guthan's chainskirt", "legs", 4, 34, 120000),
    armour(4738, "Karil's leatherskirt", "legs", 4, 26, 120000),
    armour(4751, "Torag's platelegs", "legs", 4, 34, 120000),
    armour(4759, "Verac's plateskirt", "legs", 4, 34, 120000),
    armour(4714, "Ahrim's robeskirt", "legs", 4, 20, 120000),
    armour(8840, "Void knight robe", "legs", 4, 16, 100000, { hp: 8 }),
    // Shields
    ...metalSet(
        { bronze: 1189, iron: 1191, steel: 1193, black: 1195, mithril: 1197, adamant: 1199, rune: 1201 },
        (id, m, tier, _s, d, v) => armour(id, `${cap(m)} kiteshield`, "shield", tier, Math.round(5 * d), 50 * v),
    ),
    armour(1187, "Dragon sq shield", "shield", 4, 28, 500000),
    armour(1540, "Anti-dragon shield", "shield", 2, 8, 2000, { hp: 5 }),
    armour(3840, "Holy book", "shield", 3, 6, 10000, { hp: 10 }),
    armour(3842, "Unholy book", "shield", 3, 6, 10000, { hp: 10 }),
    armour(3844, "Book of balance", "shield", 3, 6, 10000, { hp: 10 }),
    // Boots
    armour(1061, "Leather boots", "feet", 1, 1, 10),
    ...metalSet(
        { bronze: 4119, iron: 4121, steel: 4123, black: 4125, mithril: 4127, adamant: 4129 },
        (id, m, tier, _s, d, v) => armour(id, `${cap(m)} boots`, "feet", tier, Math.round(2 * d), 20 * v),
    ),
    armour(11840, "Dragon boots", "feet", 4, 14, 200000),
    armour(2577, "Ranger boots", "feet", 4, 8, 30000000),
    armour(2579, "Wizard boots", "feet", 4, 8, 30000000),
    armour(3105, "Climbing boots", "feet", 2, 4, 75000),
    // Gloves
    armour(1059, "Leather gloves", "hands", 1, 1, 10),
    armour(1063, "Leather vambraces", "hands", 1, 2, 30),
    armour(1065, "Green d'hide vambraces", "hands", 3, 5, 2000),
    armour(2487, "Blue d'hide vambraces", "hands", 3, 6, 3000),
    armour(2491, "Black d'hide vambraces", "hands", 4, 8, 5000),
    armour(8842, "Void knight gloves", "hands", 4, 6, 50000, { hp: 4 }),
    // Capes
    armour(1019, "Black cape", "cape", 1, 1, 50),
    armour(1007, "Red cape", "cape", 1, 1, 50),
    armour(1021, "Blue cape", "cape", 1, 1, 50),
    armour(1027, "Green cape", "cape", 1, 1, 50),
    armour(6568, "Obsidian cape", "cape", 3, 9, 80000),
    armour(6570, "Fire cape", "cape", 5, 11, 1000000, { hp: 10 }),
    // Amulets
    armour(1478, "Amulet of accuracy", "neck", 1, 1, 500),
    armour(1725, "Amulet of strength", "neck", 2, 2, 2000, { hp: 5 }),
    armour(1731, "Amulet of power", "neck", 3, 4, 5000, { hp: 10 }),
    armour(1704, "Amulet of glory", "neck", 4, 6, 15000, { hp: 15 }),
    armour(6585, "Amulet of fury", "neck", 5, 10, 3000000, { hp: 25 }),
    // Rings
    armour(2570, "Ring of life", "ring", 2, 0, 3000, { hp: 20 }),
    armour(6737, "Berserker ring", "ring", 4, 4, 3000000, { hp: 10 }),
    armour(6735, "Warrior ring", "ring", 4, 4, 100000, { hp: 10 }),
    armour(6731, "Seers ring", "ring", 4, 4, 500000, { hp: 10 }),
    armour(6733, "Archers ring", "ring", 4, 4, 3000000, { hp: 10 }),
    // ---- The second batch (version 49): the ranged and magic progressions
    // in full, the metal slots that were missing, and the end-game prizes.
    // Tiers follow what OSRS asks to wear a piece: levels 1 to 10 are tier
    // 1, 20 to 30 tier 2, 40 tier 3, 50 to 60 tier 4, 70 and up tier 5.
    // Ranged armour
    armour(1133, "Studded body", "body", 1, 5, 60),
    armour(1097, "Studded chaps", "legs", 1, 4, 50),
    armour(2493, "Blue d'hide chaps", "legs", 3, 11, 4000),
    armour(2581, "Robin hood hat", "head", 3, 8, 200000),
    armour(3749, "Archer helm", "head", 3, 14, 80000),
    armour(11828, "Armadyl chestplate", "body", 5, 40, 8000000, { hp: 5 }),
    armour(11830, "Armadyl chainskirt", "legs", 5, 34, 7000000, { hp: 5 }),
    armour(27226, "Masori mask", "head", 5, 26, 20000000, { hp: 5 }),
    armour(27229, "Masori body", "body", 5, 44, 60000000, { hp: 10 }),
    armour(27232, "Masori chaps", "legs", 5, 36, 50000000, { hp: 10 }),
    armour(23971, "Crystal helm", "head", 5, 24, 10000000),
    armour(23975, "Crystal body", "body", 5, 38, 30000000),
    armour(23979, "Crystal legs", "legs", 5, 32, 25000000),
    armour(22109, "Ava's assembler", "cape", 5, 8, 5000000),
    armour(13237, "Pegasian boots", "feet", 5, 12, 30000000),
    armour(19547, "Necklace of anguish", "neck", 5, 8, 10000000, { hp: 15 }),
    // Ranged weapons: crossbows are one handed, so a shield goes with them
    { ...bow(9174, "Bronze crossbow", 1, 7, 1.0, 80, BOLT), twoHanded: false },
    { ...bow(9177, "Iron crossbow", 1, 9, 1.0, 200, BOLT), twoHanded: false },
    { ...bow(9179, "Steel crossbow", 2, 13, 1.0, 500, BOLT), twoHanded: false },
    { ...bow(9181, "Mithril crossbow", 2, 18, 1.0, 1000, BOLT), twoHanded: false },
    { ...bow(9183, "Adamant crossbow", 3, 23, 1.0, 3000, BOLT), twoHanded: false },
    { ...bow(9185, "Rune crossbow", 3, 29, 1.0, 15000, BOLT), twoHanded: false },
    { ...bow(21902, "Dragon crossbow", 4, 38, 1.0, 150000, BOLT), twoHanded: false },
    { ...bow(11785, "Armadyl crossbow", 5, 50, 1.0, 20000000, BOLT), twoHanded: false, special: { name: "Armadyl eye", hits: 1, power: 1.5 } },
    bow(859, "Magic longbow", 3, 28, 1.1, 3000, ARROW_RUNE),
    { ...bow(11235, "Dark bow", 4, 60, 1.5, 800000, ARROW_RUNE), special: { name: "Descent of darkness", hits: 2, power: 1.2 } },
    bow(23983, "Crystal bow", 5, 55, 0.9, 15000000, ARROW_RUNE),
    bow(25865, "Bow of faerdhinen", 5, 72, 0.8, 100000000, ARROW_RUNE),
    { ...bow(12926, "Toxic blowpipe", 4, 36, 0.5, 3000000, ARROW_RUNE), twoHanded: false, special: { name: "Toxic siphon", hits: 1, power: 1.5, heal: 0.5 } },
    { ...bow(19481, "Heavy ballista", 5, 85, 1.6, 5000000, ARROW_RUNE), special: { name: "Concentrated shot", hits: 1, power: 1.9 } },
    // Magic armour
    armour(579, "Blue wizard hat", "head", 1, 2, 20),
    armour(577, "Blue wizard robe", "body", 1, 3, 30),
    armour(1011, "Blue skirt", "legs", 1, 2, 20, { style: "magic" }),
    armour(4089, "Mystic hat", "head", 3, 8, 20000),
    armour(4091, "Mystic robe top", "body", 3, 16, 60000),
    armour(4093, "Mystic robe bottom", "legs", 3, 12, 40000),
    armour(4095, "Mystic gloves", "hands", 3, 4, 8000),
    armour(4097, "Mystic boots", "feet", 3, 5, 8000),
    armour(6918, "Infinity hat", "head", 4, 12, 500000),
    armour(6916, "Infinity top", "body", 4, 22, 1500000),
    armour(6924, "Infinity bottoms", "legs", 4, 18, 1000000),
    armour(6922, "Infinity gloves", "hands", 4, 6, 300000),
    armour(6920, "Infinity boots", "feet", 4, 7, 300000),
    armour(21018, "Ancestral hat", "head", 5, 16, 50000000, { hp: 5 }),
    armour(21021, "Ancestral robe top", "body", 5, 28, 150000000, { hp: 10 }),
    armour(21024, "Ancestral robe bottom", "legs", 5, 24, 120000000, { hp: 10 }),
    armour(12002, "Occult necklace", "neck", 5, 6, 1000000, { hp: 10 }),
    armour(19544, "Tormented bracelet", "hands", 5, 8, 20000000),
    armour(13235, "Eternal boots", "feet", 5, 10, 5000000),
    armour(13239, "Primordial boots", "feet", 5, 16, 30000000),
    armour(6889, "Mage's book", "shield", 4, 14, 2000000, { hp: 5 }),
    armour(20714, "Tome of fire", "shield", 4, 12, 1500000, { hp: 5 }),
    armour(12821, "Spectral spirit shield", "shield", 5, 30, 50000000, { hp: 10, style: "magic" }),
    armour(12825, "Arcane spirit shield", "shield", 5, 30, 200000000, { hp: 10, style: "magic" }),
    armour(12817, "Elysian spirit shield", "shield", 5, 40, 800000000, { hp: 15 }),
    // Magic weapons
    staff(1393, "Fire battlestaff", 2, 20, 1500),
    staff(1401, "Mystic fire staff", 3, 28, 50000),
    staff(4675, "Ancient staff", 3, 30, 80000),
    staff(1409, "Iban's staff", 3, 34, 100000),
    staff(4170, "Slayer's staff", 3, 26, 30000),
    staff(6914, "Master wand", 4, 40, 1500000),
    staff(11905, "Trident of the seas", 4, 42, 600000),
    staff(12899, "Trident of the swamp", 4, 48, 2500000),
    staff(12904, "Toxic staff of the dead", 4, 50, 3000000),
    staff(21006, "Kodai wand", 5, 60, 80000000),
    { ...staff(22323, "Sanguinesti staff", 5, 72, 120000000), special: { name: "Sanguine", hits: 1, power: 1.5, heal: 0.3 } },
    staff(24423, "Harmonised nightmare staff", 5, 80, 400000000),
    staff(27275, "Tumeken's shadow", 5, 95, 1500000000),
    // Melee armour
    armour(4131, "Rune boots", "feet", 3, 8, 10000),
    armour(7460, "Rune gloves", "hands", 3, 5, 8000),
    armour(21892, "Dragon platebody", "body", 4, 48, 5000000),
    armour(7461, "Dragon gloves", "hands", 4, 7, 100000),
    armour(1149, "Dragon med helm", "head", 4, 20, 500000),
    armour(10589, "Granite helm", "head", 3, 16, 80000),
    armour(10564, "Granite body", "body", 3, 34, 150000),
    armour(6809, "Granite legs", "legs", 3, 26, 120000),
    armour(3122, "Granite shield", "shield", 3, 22, 60000),
    armour(21298, "Obsidian helmet", "head", 4, 22, 500000),
    armour(21301, "Obsidian platebody", "body", 4, 40, 1500000),
    armour(21304, "Obsidian platelegs", "legs", 4, 32, 1200000),
    armour(6524, "Toktz-ket-xil", "shield", 3, 20, 70000),
    armour(8850, "Rune defender", "shield", 3, 10, 50000),
    armour(12954, "Dragon defender", "shield", 4, 16, 500000),
    armour(22322, "Avernic defender", "shield", 5, 24, 100000000),
    armour(10551, "Fighter torso", "body", 3, 28, 200000, { hp: 5 }),
    armour(21295, "Infernal cape", "cape", 5, 16, 20000000, { hp: 15 }),
    armour(12931, "Serpentine helm", "head", 4, 24, 4000000, { hp: 5 }),
    armour(22326, "Justiciar faceguard", "head", 5, 34, 20000000, { hp: 5 }),
    armour(22327, "Justiciar chestguard", "body", 5, 60, 60000000, { hp: 10 }),
    armour(22328, "Justiciar legguards", "legs", 5, 50, 50000000, { hp: 10 }),
    armour(24419, "Inquisitor's great helm", "head", 5, 30, 40000000, { hp: 5 }),
    armour(24420, "Inquisitor's hauberk", "body", 5, 52, 150000000, { hp: 10 }),
    armour(24421, "Inquisitor's plateskirt", "legs", 5, 44, 120000000, { hp: 10 }),
    armour(11283, "Dragonfire shield", "shield", 4, 36, 10000000, { hp: 10 }),
    armour(19553, "Amulet of torture", "neck", 5, 8, 15000000, { hp: 15 }),
    armour(22981, "Ferocious gloves", "hands", 5, 12, 15000000),
    armour(11836, "Bandos boots", "feet", 4, 10, 500000),
    // Melee weapons
    weapon(1369, "Mithril battleaxe", 2, 17, 1.0, 1000),
    weapon(1371, "Adamant battleaxe", 3, 22, 1.0, 3000),
    weapon(1373, "Rune battleaxe", 3, 28, 1.0, 20000),
    weapon(1377, "Dragon battleaxe", 4, 36, 1.0, 300000, { special: { name: "Rampage", hits: 1, power: 1.6 } }),
    weapon(1343, "Mithril warhammer", 2, 16, 0.95, 900),
    weapon(1345, "Adamant warhammer", 3, 21, 0.95, 2800),
    weapon(1347, "Rune warhammer", 3, 27, 0.95, 18000),
    weapon(1299, "Mithril longsword", 2, 15, 0.8, 800),
    weapon(1301, "Adamant longsword", 3, 20, 0.8, 2500),
    weapon(1303, "Rune longsword", 3, 25, 0.8, 15000),
    weapon(1249, "Dragon spear", 4, 30, 0.9, 80000, { twoHanded: true, range: 2.0, stance: "2h", attackClip: "attack_stab" }),
    weapon(3202, "Rune halberd", 3, 30, 1.2, 60000, { twoHanded: true, range: 2.2, stance: "2h", attackClip: "attack_2h" }),
    weapon(3204, "Dragon halberd", 4, 40, 1.2, 500000, {
        twoHanded: true,
        range: 2.2,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Sweep", hits: 2, power: 1.1 },
    }),
    weapon(23987, "Crystal halberd", 5, 55, 1.2, 20000000, {
        twoHanded: true,
        range: 2.2,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Sweep", hits: 2, power: 1.2 },
    }),
    weapon(13652, "Dragon claws", 5, 42, 0.6, 100000000, { special: { name: "Slice and dice", hits: 4, power: 0.6 } }),
    weapon(13576, "Dragon warhammer", 5, 50, 1.0, 60000000, { special: { name: "Smash", hits: 1, power: 1.5 } }),
    weapon(21003, "Elder maul", 5, 75, 1.5, 80000000, { twoHanded: true, range: 1.6, stance: "2h", attackClip: "attack_2h" }),
    weapon(22325, "Scythe of vitur", 5, 70, 1.0, 1000000000, {
        twoHanded: true,
        range: 2.0,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Reap", hits: 3, power: 0.7 },
    }),
    weapon(22324, "Ghrazi rapier", 5, 48, 0.6, 200000000, { attackClip: "attack_stab" }),
    weapon(11889, "Zamorakian hasta", 4, 36, 0.85, 5000000, { range: 1.8, attackClip: "attack_stab" }),
    weapon(23995, "Blade of saeldor", 5, 50, 0.6, 150000000),
    weapon(24417, "Inquisitor's mace", 5, 52, 0.6, 300000000),
    weapon(11838, "Saradomin sword", 4, 40, 0.8, 2000000, {
        twoHanded: true,
        range: 1.6,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Saradomin's lightning", hits: 1, power: 1.6 },
    }),
    weapon(11806, "Saradomin godsword", 5, 92, 1.4, 60000000, {
        twoHanded: true,
        range: 1.8,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Healing blade", hits: 1, power: 1.8, heal: 0.5 },
    }),
    weapon(11804, "Bandos godsword", 5, 92, 1.4, 30000000, {
        twoHanded: true,
        range: 1.8,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Warstrike", hits: 1, power: 2.0 },
    }),
    weapon(11808, "Zamorak godsword", 5, 92, 1.4, 25000000, {
        twoHanded: true,
        range: 1.8,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Ice cleave", hits: 1, power: 2.0 },
    }),
    weapon(13265, "Abyssal dagger", 4, 28, 0.6, 3000000, { attackClip: "attack_stab", special: { name: "Abyssal puncture", hits: 2, power: 1.0 } }),
    weapon(13263, "Abyssal bludgeon", 4, 55, 1.1, 15000000, { twoHanded: true, stance: "2h", attackClip: "attack_2h", special: { name: "Penance", hits: 1, power: 1.4 } }),
    weapon(21009, "Dragon sword", 4, 26, 0.7, 300000),
    weapon(7158, "Dragon 2h sword", 4, 52, 1.4, 1500000, {
        twoHanded: true,
        range: 1.8,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Powerstab", hits: 1, power: 1.5 },
    }),
    weapon(6739, "Dragon axe", 4, 33, 1.0, 120000),
    weapon(6523, "Toktz-xil-ak", 3, 24, 0.7, 50000),
    weapon(6528, "Tzhaar-ket-om", 3, 45, 1.5, 60000, { twoHanded: true, range: 1.6, stance: "2h", attackClip: "attack_2h" }),
    weapon(26219, "Osmumten's fang", 5, 55, 0.7, 250000000, { attackClip: "attack_stab" }),
    weapon(27690, "Voidwaker", 5, 54, 0.65, 400000000, { special: { name: "Voidwaker", hits: 1, power: 2.0 } }),
    weapon(3101, "Rune claws", 3, 22, 0.6, 15000),
    // ---- The third batch (version 50): the rest of the metal slots, more
    // hides and robes, every elemental staff, and more of the top end
    // Ranged
    armour(6326, "Snakeskin bandana", "head", 2, 4, 400),
    armour(6322, "Snakeskin body", "body", 2, 9, 1500),
    armour(6324, "Snakeskin chaps", "legs", 2, 7, 1000),
    armour(6328, "Snakeskin boots", "feet", 2, 3, 300),
    armour(6330, "Snakeskin vambraces", "hands", 2, 3, 300),
    armour(2501, "Red d'hide body", "body", 3, 19, 9000),
    armour(2495, "Red d'hide chaps", "legs", 3, 13, 5000),
    armour(2489, "Red d'hide vambraces", "hands", 3, 7, 3500),
    bow(839, "Longbow", 1, 7, 1.1, 80, ARROW_BRONZE),
    bow(845, "Oak longbow", 1, 10, 1.1, 200, ARROW_IRON),
    bow(847, "Willow longbow", 2, 14, 1.1, 500, ARROW_STEEL),
    bow(851, "Maple longbow", 2, 19, 1.1, 1000, ARROW_MITHRIL),
    bow(857, "Yew shortbow", 3, 24, 0.9, 1500, ARROW_ADAMANT),
    { ...bow(26374, "Zaryte crossbow", 5, 56, 1.0, 150000000, BOLT), twoHanded: false, special: { name: "Evoke", hits: 1, power: 1.8 } },
    { ...bow(21012, "Dragon hunter crossbow", 5, 45, 1.0, 80000000, BOLT), twoHanded: false },
    { ...bow(19478, "Light ballista", 5, 70, 1.6, 2000000, ARROW_RUNE), special: { name: "Concentrated shot", hits: 1, power: 1.8 } },
    // Magic armour
    armour(13385, "Xerician hat", "head", 2, 5, 2000),
    armour(13387, "Xerician top", "body", 2, 10, 5000),
    armour(13389, "Xerician robe", "legs", 2, 8, 4000),
    armour(3385, "Splitbark helm", "head", 3, 10, 30000),
    armour(3387, "Splitbark body", "body", 3, 18, 80000),
    armour(3389, "Splitbark legs", "legs", 3, 14, 60000),
    armour(3391, "Splitbark gauntlets", "hands", 3, 4, 10000),
    armour(3393, "Splitbark boots", "feet", 3, 5, 10000),
    armour(24288, "Dagon'hai hat", "head", 4, 13, 800000),
    armour(24291, "Dagon'hai robe top", "body", 4, 23, 2000000),
    armour(24294, "Dagon'hai robe bottom", "legs", 4, 19, 1500000),
    armour(20595, "Elder chaos hood", "head", 4, 12, 600000),
    armour(20517, "Elder chaos top", "body", 4, 22, 1500000),
    armour(20520, "Elder chaos robe", "legs", 4, 18, 1200000),
    armour(26241, "Virtus mask", "head", 5, 18, 80000000, { hp: 5 }),
    armour(26243, "Virtus robe top", "body", 5, 30, 250000000, { hp: 10 }),
    armour(26245, "Virtus robe bottom", "legs", 5, 26, 200000000, { hp: 10 }),
    armour(2412, "Saradomin cape", "cape", 3, 4, 20000),
    armour(2413, "Guthix cape", "cape", 3, 4, 20000),
    armour(2414, "Zamorak cape", "cape", 3, 4, 20000),
    // Magic weapons
    staff(1391, "Battlestaff", 2, 18, 1000),
    staff(1397, "Air battlestaff", 2, 20, 1500),
    staff(1395, "Water battlestaff", 2, 20, 1500),
    staff(1399, "Earth battlestaff", 2, 20, 1500),
    staff(1405, "Mystic air staff", 3, 28, 50000),
    staff(1403, "Mystic water staff", 3, 28, 50000),
    staff(1407, "Mystic earth staff", 3, 28, 50000),
    staff(6526, "Toktz-mej-tal", 3, 32, 60000),
    staff(11791, "Staff of the dead", 4, 48, 2500000),
    staff(22296, "Staff of light", 4, 52, 3500000),
    staff(24422, "Nightmare staff", 5, 66, 150000000),
    { ...staff(24424, "Volatile nightmare staff", 5, 76, 300000000), special: { name: "Immolate", hits: 1, power: 2.2 } },
    { ...staff(24425, "Eldritch nightmare staff", 5, 76, 300000000), special: { name: "Invocate", hits: 1, power: 1.6, heal: 0.4 } },
    // Melee armour: the metal slots that were missing
    armour(1139, "Bronze med helm", "head", 1, 3, 20),
    armour(1137, "Iron med helm", "head", 1, 4, 60),
    armour(1141, "Steel med helm", "head", 2, 7, 160),
    armour(1151, "Black med helm", "head", 2, 8, 240),
    armour(1143, "Mithril med helm", "head", 2, 9, 500),
    armour(1145, "Adamant med helm", "head", 3, 11, 1200),
    armour(1147, "Rune med helm", "head", 3, 14, 5000),
    armour(1103, "Bronze chainbody", "body", 1, 6, 60),
    armour(1101, "Iron chainbody", "body", 1, 8, 180),
    armour(1105, "Steel chainbody", "body", 2, 13, 480),
    armour(1107, "Black chainbody", "body", 2, 15, 720),
    armour(1109, "Mithril chainbody", "body", 2, 17, 1500),
    armour(1111, "Adamant chainbody", "body", 3, 22, 3600),
    armour(1113, "Rune chainbody", "body", 3, 28, 15000),
    armour(1125, "Black platebody", "body", 2, 17, 960),
    armour(1173, "Bronze sq shield", "shield", 1, 4, 40),
    armour(1175, "Iron sq shield", "shield", 1, 5, 120),
    armour(1177, "Steel sq shield", "shield", 2, 8, 320),
    armour(1179, "Black sq shield", "shield", 2, 9, 480),
    armour(1181, "Mithril sq shield", "shield", 2, 10, 1000),
    armour(1183, "Adamant sq shield", "shield", 3, 13, 2400),
    armour(1185, "Rune sq shield", "shield", 3, 16, 10000),
    armour(1083, "Steel plateskirt", "legs", 2, 11, 360),
    armour(1085, "Mithril plateskirt", "legs", 2, 14, 1500),
    armour(1091, "Adamant plateskirt", "legs", 3, 18, 3600),
    armour(1093, "Rune plateskirt", "legs", 3, 23, 15000),
    armour(4585, "Dragon plateskirt", "legs", 4, 32, 200000),
    armour(21895, "Dragon kiteshield", "shield", 4, 30, 2000000),
    armour(21643, "Granite boots", "feet", 3, 7, 50000),
    armour(21736, "Granite gloves", "hands", 3, 5, 40000),
    armour(21733, "Guardian boots", "feet", 4, 12, 1000000),
    armour(12831, "Blessed spirit shield", "shield", 4, 26, 3000000, { hp: 5 }),
    armour(4224, "Crystal shield", "shield", 4, 28, 2000000),
    armour(11128, "Berserker necklace", "neck", 3, 2, 100000, { hp: 5 }),
    // Melee weapons
    weapon(1291, "Bronze longsword", 1, 8, 0.8, 40),
    weapon(1293, "Iron longsword", 1, 10, 0.8, 120),
    weapon(1295, "Steel longsword", 2, 13, 0.8, 320),
    weapon(1375, "Bronze battleaxe", 1, 10, 1.0, 40),
    weapon(1363, "Iron battleaxe", 1, 13, 1.0, 120),
    weapon(1365, "Steel battleaxe", 2, 15, 1.0, 320),
    weapon(1337, "Bronze warhammer", 1, 9, 0.95, 35),
    weapon(1335, "Iron warhammer", 1, 12, 0.95, 110),
    weapon(1339, "Steel warhammer", 2, 14, 0.95, 300),
    weapon(11377, "Rune hasta", 3, 26, 0.85, 50000, { range: 1.8, attackClip: "attack_stab" }),
    weapon(11824, "Zamorakian spear", 4, 38, 0.9, 6000000, { twoHanded: true, range: 2.0, stance: "2h", attackClip: "attack_stab" }),
    weapon(22731, "Dragon hasta", 4, 36, 0.85, 1500000, { range: 1.8, attackClip: "attack_stab" }),
    weapon(20727, "Leaf-bladed battleaxe", 3, 30, 1.0, 80000),
    weapon(11902, "Leaf-bladed sword", 3, 24, 0.7, 60000),
    weapon(2402, "Silverlight", 2, 14, 0.8, 500),
    weapon(6746, "Darklight", 3, 24, 0.8, 20000),
    weapon(19675, "Arclight", 4, 36, 0.8, 2000000),
    weapon(35, "Excalibur", 2, 15, 0.8, 1000),
    weapon(25979, "Keris partisan", 4, 34, 0.75, 1000000, { attackClip: "attack_stab" }),
    weapon(21742, "Granite hammer", 4, 38, 0.85, 800000),
    weapon(10887, "Barrelchest anchor", 4, 58, 1.5, 1500000, { twoHanded: true, range: 1.6, stance: "2h", attackClip: "attack_2h" }),
    weapon(21015, "Dinh's bulwark", 5, 62, 1.6, 30000000, { twoHanded: true, range: 1.6, stance: "2h", attackClip: "attack_2h" }),
    weapon(26233, "Ancient godsword", 5, 92, 1.4, 70000000, {
        twoHanded: true,
        range: 1.8,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Blood sacrifice", hits: 1, power: 2.0, heal: 0.25 },
    }),
    weapon(28338, "Soulreaper axe", 5, 85, 1.3, 500000000, {
        twoHanded: true,
        range: 1.8,
        stance: "2h",
        attackClip: "attack_2h",
        special: { name: "Soul strike", hits: 1, power: 2.0 },
    }),
    weapon(12809, "Saradomin's blessed sword", 5, 46, 0.8, 20000000, { twoHanded: true, range: 1.6, stance: "2h", attackClip: "attack_2h" }),
    // ---- The fourth batch (version 51): real combat gear only, no trims,
    // ornaments or costume. Fremennik and Temple Knight sets, white, the
    // slayer helmets, every defender and metal glove, shields and books,
    // jewellery, god capes, 3rd age, the god hides, more bows and sceptres,
    // the elemental staves, and the newer weapons.
    // Melee armour
    armour(6128, "Rock-shell helm", "head", 3, 15, 60000),
    armour(6129, "Rock-shell plate", "body", 3, 30, 120000),
    armour(6130, "Rock-shell legs", "legs", 3, 24, 100000),
    armour(6145, "Rock-shell boots", "feet", 3, 6, 30000),
    armour(6151, "Rock-shell gloves", "hands", 3, 4, 25000),
    armour(9672, "Proselyte sallet", "head", 2, 8, 5000),
    armour(9674, "Proselyte hauberk", "body", 2, 16, 12000),
    armour(9676, "Proselyte cuisse", "legs", 2, 13, 9000),
    armour(5574, "Initiate sallet", "head", 1, 5, 2000),
    armour(5575, "Initiate hauberk", "body", 1, 11, 5000),
    armour(5576, "Initiate cuisse", "legs", 1, 8, 4000),
    armour(6617, "White platebody", "body", 2, 16, 2000),
    armour(6623, "White full helm", "head", 2, 8, 1000),
    armour(6625, "White platelegs", "legs", 2, 12, 1500),
    armour(6633, "White kiteshield", "shield", 2, 10, 1200),
    armour(11864, "Slayer helmet", "head", 4, 22, 1000000, { hp: 5 }),
    armour(4551, "Spiny helmet", "head", 2, 7, 3000),
    armour(24271, "Neitiznot faceguard", "head", 5, 30, 20000000, { hp: 10 }),
    armour(8844, "Bronze defender", "shield", 1, 2, 100),
    armour(8845, "Iron defender", "shield", 1, 3, 300),
    armour(8846, "Steel defender", "shield", 2, 5, 800),
    armour(8847, "Black defender", "shield", 2, 6, 1200),
    armour(8848, "Mithril defender", "shield", 2, 7, 2000),
    armour(8849, "Adamant defender", "shield", 3, 9, 8000),
    armour(4156, "Mirror shield", "shield", 2, 9, 5000),
    armour(12829, "Spirit shield", "shield", 3, 18, 500000),
    armour(22002, "Dragonfire ward", "shield", 4, 30, 15000000, { hp: 10 }),
    armour(21633, "Ancient wyvern shield", "shield", 4, 30, 12000000, { hp: 10 }),
    armour(11924, "Malediction ward", "shield", 4, 20, 3000000),
    armour(11926, "Odium ward", "shield", 4, 20, 3000000),
    armour(12612, "Book of darkness", "shield", 3, 6, 20000, { hp: 10 }),
    armour(12610, "Book of law", "shield", 3, 6, 20000, { hp: 10 }),
    armour(12608, "Book of war", "shield", 3, 6, 20000, { hp: 10 }),
    armour(25985, "Elidinis' ward", "shield", 5, 28, 100000000, { hp: 10 }),
    armour(25574, "Tome of water", "shield", 4, 12, 1500000, { hp: 5 }),
    armour(7454, "Bronze gloves", "hands", 1, 1, 20),
    armour(7455, "Iron gloves", "hands", 1, 1, 60),
    armour(7456, "Steel gloves", "hands", 2, 2, 160),
    armour(7457, "Black gloves", "hands", 2, 2, 240),
    armour(7458, "Mithril gloves", "hands", 2, 3, 500),
    armour(7459, "Adamant gloves", "hands", 3, 4, 1200),
    armour(7462, "Barrows gloves", "hands", 4, 9, 500000),
    armour(11126, "Combat bracelet", "hands", 3, 4, 100000, { hp: 5 }),
    armour(11133, "Regen bracelet", "hands", 4, 6, 2000000, { hp: 10 }),
    armour(1727, "Amulet of magic", "neck", 1, 1, 300),
    armour(1729, "Amulet of defence", "neck", 2, 3, 1500),
    armour(4081, "Salve amulet", "neck", 3, 4, 50000, { hp: 10 }),
    armour(11090, "Phoenix necklace", "neck", 3, 2, 20000, { hp: 15 }),
    armour(24780, "Amulet of blood fury", "neck", 5, 10, 50000000, { hp: 25 }),
    armour(2550, "Ring of recoil", "ring", 2, 1, 500, { hp: 5 }),
    armour(2572, "Ring of wealth", "ring", 3, 2, 20000, { hp: 5 }),
    armour(12601, "Ring of the gods", "ring", 4, 4, 5000000, { hp: 10 }),
    armour(12605, "Treasonous ring", "ring", 4, 4, 2000000, { hp: 10 }),
    armour(12603, "Tyrannical ring", "ring", 4, 4, 2000000, { hp: 10 }),
    armour(19550, "Ring of suffering", "ring", 5, 8, 50000000, { hp: 20 }),
    armour(22975, "Brimstone ring", "ring", 5, 6, 10000000, { hp: 15 }),
    armour(25975, "Lightbearer", "ring", 5, 4, 10000000, { hp: 10 }),
    armour(28307, "Ultor ring", "ring", 5, 6, 200000000, { hp: 15 }),
    armour(28316, "Bellator ring", "ring", 5, 6, 150000000, { hp: 15 }),
    armour(28313, "Magus ring", "ring", 5, 6, 150000000, { hp: 15 }),
    armour(28310, "Venator ring", "ring", 5, 6, 150000000, { hp: 15 }),
    armour(22114, "Mythical cape", "cape", 4, 10, 2000000, { hp: 5 }),
    armour(21791, "Imbued saradomin cape", "cape", 5, 12, 5000000),
    armour(21793, "Imbued guthix cape", "cape", 5, 12, 5000000),
    armour(21795, "Imbued zamorak cape", "cape", 5, 12, 5000000),
    armour(1052, "Cape of legends", "cape", 2, 4, 50000),
    armour(10350, "3rd age full helmet", "head", 5, 32, 500000000, { hp: 5 }),
    armour(10348, "3rd age platebody", "body", 5, 56, 1000000000, { hp: 10 }),
    armour(10346, "3rd age platelegs", "legs", 5, 48, 800000000, { hp: 10 }),
    armour(10352, "3rd age kiteshield", "shield", 5, 36, 600000000, { hp: 5 }),
    armour(10334, "3rd age range coif", "head", 5, 26, 500000000),
    armour(10330, "3rd age range top", "body", 5, 42, 1000000000),
    armour(10332, "3rd age range legs", "legs", 5, 36, 800000000),
    armour(10336, "3rd age vambraces", "hands", 5, 12, 300000000, { style: "ranged" }),
    armour(10342, "3rd age mage hat", "head", 5, 18, 500000000),
    armour(10338, "3rd age robe top", "body", 5, 30, 1000000000),
    armour(10340, "3rd age robe", "legs", 5, 26, 800000000),
    armour(10344, "3rd age amulet", "neck", 5, 10, 300000000, { hp: 20 }),
    // Ranged armour
    armour(6131, "Spined helm", "head", 3, 12, 60000),
    armour(6133, "Spined body", "body", 3, 22, 120000),
    armour(6135, "Spined chaps", "legs", 3, 16, 100000),
    armour(6143, "Spined boots", "feet", 3, 5, 30000),
    armour(6149, "Spined gloves", "hands", 3, 4, 25000),
    armour(10382, "Guthix coif", "head", 4, 12, 50000),
    armour(10378, "Guthix d'hide body", "body", 4, 24, 200000),
    armour(10380, "Guthix chaps", "legs", 4, 16, 150000),
    armour(10376, "Guthix bracers", "hands", 4, 8, 50000),
    armour(10390, "Saradomin coif", "head", 4, 12, 50000),
    armour(10386, "Saradomin d'hide body", "body", 4, 24, 200000),
    armour(10388, "Saradomin chaps", "legs", 4, 16, 150000),
    armour(10384, "Saradomin bracers", "hands", 4, 8, 50000),
    armour(10374, "Zamorak coif", "head", 4, 12, 50000),
    armour(10370, "Zamorak d'hide body", "body", 4, 24, 200000),
    armour(10372, "Zamorak chaps", "legs", 4, 16, 150000),
    armour(10368, "Zamorak bracers", "hands", 4, 8, 50000),
    armour(12496, "Ancient coif", "head", 4, 12, 50000),
    armour(12492, "Ancient d'hide body", "body", 4, 24, 200000),
    armour(12494, "Ancient chaps", "legs", 4, 16, 150000),
    armour(12490, "Ancient bracers", "hands", 4, 8, 50000),
    armour(12596, "Rangers' tunic", "body", 3, 14, 300000),
    armour(19994, "Ranger gloves", "hands", 4, 8, 5000000),
    armour(22638, "Morrigan's coif", "head", 4, 16, 2000000),
    armour(22641, "Morrigan's leather body", "body", 4, 30, 5000000),
    armour(22644, "Morrigan's leather chaps", "legs", 4, 24, 4000000),
    // Ranged weapons
    bow(4827, "Comp ogre bow", 2, 16, 1.1, 600, ARROW_STEEL),
    bow(6724, "Seercull", 4, 44, 0.9, 500000, ARROW_RUNE),
    { ...bow(8880, "Dorgeshuun crossbow", 2, 15, 1.0, 1200, BOLT), twoHanded: false },
    { ...bow(10156, "Hunters' crossbow", 3, 25, 0.9, 20000, BOLT), twoHanded: false },
    bow(22550, "Craw's bow", 4, 55, 0.9, 3000000, ARROW_RUNE),
    bow(27655, "Webweaver bow", 5, 75, 0.9, 60000000, ARROW_RUNE),
    { ...bow(27610, "Venator bow", 5, 62, 0.7, 100000000, ARROW_RUNE), special: { name: "Ricochet", hits: 2, power: 1.0 } },
    bow(29591, "Scorching bow", 4, 50, 0.9, 2000000, ARROW_RUNE),
    // Magic armour
    armour(6137, "Skeletal helm", "head", 3, 9, 60000),
    armour(6139, "Skeletal top", "body", 3, 17, 120000),
    armour(6141, "Skeletal bottoms", "legs", 3, 13, 100000),
    armour(6147, "Skeletal boots", "feet", 3, 4, 30000),
    armour(6153, "Skeletal gloves", "hands", 3, 3, 25000),
    armour(7400, "Enchanted hat", "head", 3, 8, 20000),
    armour(7399, "Enchanted top", "body", 3, 16, 60000),
    armour(7398, "Enchanted robe", "legs", 3, 12, 40000),
    armour(9096, "Lunar helm", "head", 4, 11, 300000),
    armour(9097, "Lunar torso", "body", 4, 20, 800000),
    armour(9098, "Lunar legs", "legs", 4, 16, 600000),
    armour(9099, "Lunar gloves", "hands", 4, 5, 150000),
    armour(9100, "Lunar boots", "feet", 4, 6, 150000),
    armour(22650, "Zuriel's hood", "head", 4, 14, 2000000),
    armour(22653, "Zuriel's robe top", "body", 4, 24, 5000000),
    armour(22656, "Zuriel's robe bottom", "legs", 4, 20, 4000000),
    armour(25413, "Bloodbark helm", "head", 4, 12, 400000),
    armour(25404, "Bloodbark body", "body", 4, 22, 1000000),
    armour(25416, "Bloodbark legs", "legs", 4, 18, 800000),
    armour(25407, "Bloodbark gauntlets", "hands", 4, 6, 200000),
    armour(25410, "Bloodbark boots", "feet", 4, 7, 200000),
    armour(25398, "Swampbark helm", "head", 3, 10, 100000),
    armour(25389, "Swampbark body", "body", 3, 18, 250000),
    armour(25401, "Swampbark legs", "legs", 3, 14, 200000),
    armour(25392, "Swampbark gauntlets", "hands", 3, 4, 50000),
    armour(25395, "Swampbark boots", "feet", 3, 5, 50000),
    // Magic weapons
    staff(27624, "Ancient sceptre", 4, 50, 5000000),
    staff(22555, "Thammaron's sceptre", 4, 46, 3000000),
    staff(27665, "Accursed sceptre", 5, 62, 80000000),
    staff(11998, "Smoke battlestaff", 3, 24, 300000),
    staff(12000, "Mystic smoke staff", 3, 30, 500000),
    staff(6562, "Mud battlestaff", 3, 22, 200000),
    staff(6563, "Mystic mud staff", 3, 28, 400000),
    staff(3053, "Lava battlestaff", 3, 22, 100000),
    staff(3054, "Mystic lava staff", 3, 28, 200000),
    staff(11787, "Steam battlestaff", 3, 22, 100000),
    staff(11789, "Mystic steam staff", 3, 28, 200000),
    staff(20730, "Mist battlestaff", 3, 22, 100000),
    staff(20736, "Dust battlestaff", 3, 22, 100000),
    staff(20739, "Mystic dust staff", 3, 28, 200000),
    staff(22647, "Zuriel's staff", 4, 50, 4000000),
    staff(29594, "Purging staff", 5, 70, 150000000),
    // Melee weapons
    weapon(1247, "Rune spear", 3, 24, 0.9, 30000, { twoHanded: true, range: 2.0, stance: "2h", attackClip: "attack_stab" }),
    weapon(4158, "Leaf-bladed spear", 3, 26, 0.9, 60000, { twoHanded: true, range: 2.0, stance: "2h", attackClip: "attack_stab" }),
    weapon(12006, "Abyssal tentacle", 5, 44, 0.6, 50000000, {
        sound: WHIP,
        range: 1.6,
        stance: "whip",
        attackClip: "attack_whip",
        special: { name: "Binding tentacle", hits: 1, power: 1.3, heal: 0.3 },
    }),
    weapon(22978, "Dragon hunter lance", 5, 54, 0.8, 60000000, { range: 1.8, attackClip: "attack_stab" }),
    weapon(21646, "Granite longsword", 4, 34, 0.8, 500000),
    weapon(6525, "Toktz-xil-ek", 3, 20, 0.6, 40000, { attackClip: "attack_stab" }),
    weapon(11037, "Brine sabre", 3, 24, 0.7, 100000),
    weapon(2952, "Wolfbane", 2, 14, 0.6, 5000, { attackClip: "attack_stab" }),
    weapon(11061, "Ancient mace", 2, 15, 0.85, 3000),
    weapon(22545, "Viggora's chainmace", 4, 40, 0.8, 3000000),
    weapon(27660, "Ursine chainmace", 5, 54, 0.8, 60000000),
    weapon(24219, "Swift blade", 4, 24, 0.5, 2000000),
    weapon(8872, "Bone dagger", 2, 12, 0.6, 2000, { attackClip: "attack_stab", special: { name: "Backstab", hits: 1, power: 1.8 } }),
    weapon(23528, "Sarachnis cudgel", 4, 40, 0.85, 1500000),
    weapon(29589, "Emberlight", 5, 50, 0.8, 80000000),
    weapon(29796, "Noxious halberd", 5, 60, 1.2, 150000000, { twoHanded: true, range: 2.2, stance: "2h", attackClip: "attack_2h" }),
    weapon(29577, "Burning claws", 5, 44, 0.6, 120000000, { special: { name: "Scorch", hits: 4, power: 0.6 } }),
    weapon(28997, "Dual macuahuitl", 4, 40, 0.75, 3000000, { special: { name: "Double strike", hits: 2, power: 1.1 } }),
    weapon(29889, "Glacial temotli", 4, 30, 0.6, 2000000),
    weapon(30957, "Earthbound tecpatl", 4, 28, 0.6, 1500000, { attackClip: "attack_stab" }),
    weapon(29084, "Sulphur blades", 4, 32, 0.6, 2000000),
    weapon(28988, "Blue moon spear", 4, 42, 1.0, 3000000, { twoHanded: true, range: 2.0, stance: "2h", attackClip: "attack_stab" }),
    weapon(28922, "Tonalztics of ralos", 5, 58, 1.0, 80000000, { twoHanded: true, range: 1.8, stance: "2h", attackClip: "attack_2h" }),
    // ---- The fifth batch (version 52): everything left in the export that
    // is real combat gear. Black and white weapons, the metal claws,
    // halberds, hastas and spears, the god rune armour, every wooden and
    // d'hide shield, the god d'hide boots and the Armadyl and Bandos hides,
    // the Moon sets, Oathplate, Sunfire, Dragonstone, elite void, the
    // Barbarian Assault hats, the quest armours, and the newest weapons.
    // Melee weapons: black and white
    weapon(1217, "Black dagger", 2, 10, 0.6, 240, X_STAB),
    weapon(1283, "Black sword", 2, 11, 0.7, 300, X_STAB),
    weapon(1297, "Black longsword", 2, 14, 0.8, 480),
    weapon(1327, "Black scimitar", 2, 14, 0.65, 400),
    weapon(1426, "Black mace", 2, 13, 0.85, 300),
    weapon(1367, "Black battleaxe", 2, 16, 1.0, 480),
    weapon(1341, "Black warhammer", 2, 15, 0.95, 450),
    weapon(1313, "Black 2h sword", 2, 24, 1.4, 700, X_2H),
    weapon(3098, "Black claws", 2, 13, 0.6, 720),
    weapon(3196, "Black halberd", 2, 17, 1.2, 2900, X_HALBERD),
    weapon(4580, "Black spear", 2, 14, 0.9, 1440, X_SPEAR),
    weapon(6591, "White dagger", 2, 10, 0.6, 300, X_STAB),
    weapon(6605, "White sword", 2, 11, 0.7, 400, X_STAB),
    weapon(6607, "White longsword", 2, 14, 0.8, 600),
    weapon(6611, "White scimitar", 2, 14, 0.65, 500),
    weapon(6601, "White mace", 2, 13, 0.85, 400),
    weapon(6589, "White battleaxe", 2, 16, 1.0, 600),
    weapon(6613, "White warhammer", 2, 15, 0.95, 550),
    weapon(6609, "White 2h sword", 2, 24, 1.4, 900, X_2H),
    weapon(6587, "White claws", 2, 13, 0.6, 900),
    weapon(6599, "White halberd", 2, 17, 1.2, 3500, X_HALBERD),
    // The metal claws, halberds, hastas and spears below rune
    weapon(3095, "Bronze claws", 1, 7, 0.6, 60),
    weapon(3096, "Iron claws", 1, 9, 0.6, 180),
    weapon(3097, "Steel claws", 2, 11, 0.6, 480),
    weapon(3099, "Mithril claws", 2, 14, 0.6, 1500),
    weapon(3100, "Adamant claws", 3, 17, 0.6, 3600),
    weapon(3190, "Bronze halberd", 1, 9, 1.2, 240, X_HALBERD),
    weapon(3192, "Iron halberd", 1, 12, 1.2, 720, X_HALBERD),
    weapon(3194, "Steel halberd", 2, 15, 1.2, 1920, X_HALBERD),
    weapon(3198, "Mithril halberd", 2, 19, 1.2, 6000, X_HALBERD),
    weapon(3200, "Adamant halberd", 3, 24, 1.2, 14400, X_HALBERD),
    weapon(11367, "Bronze hasta", 1, 8, 0.85, 200, X_HASTA),
    weapon(11369, "Iron hasta", 1, 10, 0.85, 600, X_HASTA),
    weapon(11371, "Steel hasta", 2, 13, 0.85, 1600, X_HASTA),
    weapon(11373, "Mithril hasta", 2, 17, 0.85, 5000, X_HASTA),
    weapon(11375, "Adamant hasta", 3, 20, 0.85, 12000, X_HASTA),
    weapon(1237, "Bronze spear", 1, 7, 0.9, 120, X_SPEAR),
    weapon(1239, "Iron spear", 1, 9, 0.9, 360, X_SPEAR),
    weapon(1241, "Steel spear", 2, 12, 0.9, 960, X_SPEAR),
    weapon(1243, "Mithril spear", 2, 15, 0.9, 3000, X_SPEAR),
    weapon(1245, "Adamant spear", 3, 19, 0.9, 7200, X_SPEAR),
    // Melee weapons: the rest
    weapon(667, "Blurite sword", 1, 7, 0.7, 50, X_STAB),
    weapon(3757, "Fremennik blade", 1, 6, 0.7, 40, X_STAB),
    weapon(5060, "Dwarven battleaxe", 1, 11, 1.0, 100),
    weapon(5018, "Bone club", 1, 8, 0.9, 60),
    weapon(5016, "Bone spear", 1, 8, 0.9, 80, X_SPEAR),
    weapon(28792, "Bone mace", 1, 8, 0.85, 60),
    weapon(10581, "Keris", 2, 12, 0.6, 3000, X_STAB),
    weapon(10858, "Shadow sword", 2, 15, 0.75, 2000),
    weapon(25641, "Barronite mace", 2, 16, 0.85, 5000),
    weapon(22398, "Ivandis flail", 2, 16, 0.8, 8000),
    weapon(20756, "Hill giant club", 2, 28, 1.3, 20000, X_2H),
    weapon(24699, "Blisterwood flail", 3, 26, 0.8, 50000),
    weapon(24697, "Blisterwood sickle", 3, 20, 0.7, 30000),
    weapon(8841, "Void knight mace", 3, 22, 0.85, 50000),
    weapon(28810, "Zombie axe", 3, 28, 0.9, 100000),
    weapon(29305, "Hunter's spear", 3, 26, 0.9, 80000, X_SPEAR),
    weapon(6527, "Tzhaar-ket-em", 3, 24, 0.85, 40000),
    weapon(27021, "Colossal blade", 4, 44, 1.4, 1000000, X_2H),
    weapon(22622, "Statius's warhammer", 4, 40, 0.95, 3000000, { special: { name: "Smash", hits: 1, power: 1.5 } }),
    weapon(22613, "Vesta's longsword", 4, 36, 0.75, 3000000, { special: { name: "Feint", hits: 1, power: 1.6 } }),
    weapon(22610, "Vesta's spear", 4, 38, 0.9, 3000000, { ...X_SPEAR, special: { name: "Spear wall", hits: 2, power: 1.0 } }),
    weapon(30955, "Arkan blade", 5, 52, 0.7, 150000000),
    weapon(12426, "3rd Age longsword", 5, 48, 0.75, 500000000),
    // Magic weapons
    staff(28796, "Bone staff", 1, 9, 80),
    staff(1389, "Magic staff", 1, 10, 300),
    // Not magic weapons in OSRS (version 110), so swung: the skull sceptre
    // (unimbued, it casts no combat spell), the mjolnirs and Pharaoh's
    // sceptre (polestaves), the Dramen staff (blunt), the Merfolk trident (a
    // spear) and the demonic sceptre (spiked)
    weapon(9013, "Skull sceptre", 1, 10, 0.9, 500),
    staff(6603, "White magic staff", 2, 12, 800),
    weapon(6760, "Guthix mjolnir", 2, 18, 1.2, 3000, { stance: "staff" }),
    weapon(6762, "Saradomin mjolnir", 2, 18, 1.2, 3000, { stance: "staff" }),
    weapon(6764, "Zamorak mjolnir", 2, 18, 1.2, 3000, { stance: "staff" }),
    staff(2416, "Guthix staff", 3, 30, 80000),
    staff(2415, "Saradomin staff", 3, 30, 80000),
    staff(2417, "Zamorak staff", 3, 30, 80000),
    staff(22370, "Bryophyta's staff", 3, 32, 150000),
    staff(9084, "Lunar staff", 4, 36, 200000),
    staff(28585, "Warped sceptre", 4, 44, 1000000),
    { ...staff(25489, "Blood ancient sceptre", 4, 52, 8000000), special: { name: "Blood surge", hits: 1, power: 1.5, heal: 0.3 } },
    staff(25490, "Ice ancient sceptre", 4, 52, 8000000),
    staff(25491, "Smoke ancient sceptre", 4, 52, 8000000),
    staff(25492, "Shadow ancient sceptre", 4, 52, 8000000),
    staff(30634, "Twinflame staff", 5, 60, 20000000),
    staff(30070, "Dragon hunter wand", 5, 58, 60000000),
    staff(12422, "3rd Age wand", 5, 64, 500000000),
    staff(23342, "3rd Age druidic staff", 5, 60, 800000000),
    staff(31113, "Eye of Ayak", 5, 78, 300000000),
    // Ranged weapons
    bow(28794, "Bone shortbow", 1, 7, 0.9, 80, ARROW_IRON),
    { ...bow(837, "Crossbow", 1, 8, 1.0, 150, BOLT), twoHanded: false },
    { ...bow(9176, "Blurite crossbow", 1, 8, 1.0, 180, BOLT), twoHanded: false },
    bow(2883, "Ogre bow", 2, 14, 1.2, 500, ARROW_STEEL),
    bow(10280, "Willow comp bow", 2, 14, 0.9, 600, ARROW_STEEL),
    bow(10282, "Yew comp bow", 3, 26, 0.9, 2500, ARROW_ADAMANT),
    bow(10284, "Magic comp bow", 3, 32, 1.0, 5000, ARROW_RUNE),
    { ...bow(6522, "Toktz-xil-ul", 3, 24, 0.6, 60000, ARROW_RUNE), twoHanded: false },
    { ...bow(28869, "Hunters' sunlight crossbow", 4, 36, 0.9, 500000, BOLT), twoHanded: false },
    { ...bow(29000, "Eclipse atlatl", 4, 40, 0.7, 3000000, ARROW_RUNE), twoHanded: false },
    bow(12424, "3rd Age bow", 5, 70, 0.9, 500000000, ARROW_RUNE),
    // Melee armour
    armour(6615, "White chainbody", "body", 2, 15, 1500),
    armour(6621, "White med helm", "head", 2, 6, 800),
    armour(6631, "White sq shield", "shield", 2, 8, 900),
    armour(6619, "White boots", "feet", 2, 3, 500),
    armour(6629, "White gloves", "hands", 2, 2, 400),
    armour(778, "Steel gauntlets", "hands", 1, 1, 150),
    armour(1495, "Klank's gauntlets", "hands", 1, 1, 200),
    armour(6720, "Slayer gloves", "hands", 1, 1, 500),
    armour(1580, "Ice gloves", "hands", 2, 3, 5000),
    armour(10553, "Penance gloves", "hands", 3, 5, 200000),
    armour(24046, "Dragonstone gauntlets", "hands", 4, 7, 800000),
    armour(1171, "Wooden shield", "shield", 1, 2, 20),
    armour(22251, "Oak shield", "shield", 1, 3, 100),
    armour(22254, "Willow shield", "shield", 2, 5, 300),
    armour(22257, "Maple shield", "shield", 2, 8, 800),
    armour(22260, "Yew shield", "shield", 3, 12, 2000),
    armour(22263, "Magic shield", "shield", 4, 16, 6000),
    armour(22266, "Redwood shield", "shield", 4, 20, 20000),
    armour(3758, "Fremennik shield", "shield", 1, 4, 200),
    armour(10826, "Neitiznot shield", "shield", 2, 10, 5000),
    armour(24266, "V's shield", "shield", 3, 20, 100000),
    armour(2673, "Guthix full helm", "head", 3, 17, 60000),
    armour(2675, "Guthix kiteshield", "shield", 3, 19, 80000),
    armour(2669, "Guthix platebody", "body", 3, 34, 150000),
    armour(2671, "Guthix platelegs", "legs", 3, 26, 100000),
    armour(2665, "Saradomin full helm", "head", 3, 17, 60000),
    armour(2667, "Saradomin kiteshield", "shield", 3, 19, 80000),
    armour(2661, "Saradomin platebody", "body", 3, 34, 150000),
    armour(2663, "Saradomin platelegs", "legs", 3, 26, 100000),
    armour(2657, "Zamorak full helm", "head", 3, 17, 60000),
    armour(2659, "Zamorak kiteshield", "shield", 3, 19, 80000),
    armour(2653, "Zamorak platebody", "body", 3, 34, 150000),
    armour(2655, "Zamorak platelegs", "legs", 3, 26, 100000),
    armour(12466, "Ancient full helm", "head", 3, 17, 60000),
    armour(12468, "Ancient kiteshield", "shield", 3, 19, 80000),
    armour(12460, "Ancient platebody", "body", 3, 34, 150000),
    armour(12462, "Ancient platelegs", "legs", 3, 26, 100000),
    armour(12476, "Armadyl full helm", "head", 3, 17, 60000, { style: "melee" }),
    armour(12478, "Armadyl kiteshield", "shield", 3, 19, 80000, { style: "melee" }),
    armour(12470, "Armadyl platebody", "body", 3, 34, 150000, { style: "melee" }),
    armour(12472, "Armadyl platelegs", "legs", 3, 26, 100000, { style: "melee" }),
    armour(12486, "Bandos full helm", "head", 3, 17, 60000),
    armour(12488, "Bandos kiteshield", "shield", 3, 19, 80000),
    armour(12480, "Bandos platebody", "body", 3, 34, 150000),
    armour(12482, "Bandos platelegs", "legs", 3, 26, 100000),
    armour(29560, "Elite black full helm", "head", 3, 16, 50000),
    armour(29562, "Elite black platebody", "body", 3, 32, 150000),
    armour(29564, "Elite black platelegs", "legs", 3, 24, 100000),
    armour(23785, "Ardougne knight helm", "head", 3, 15, 30000),
    armour(23787, "Ardougne knight platebody", "body", 3, 30, 80000),
    armour(23789, "Ardougne knight platelegs", "legs", 3, 22, 60000),
    armour(74, "Khazard helmet", "head", 1, 3, 80),
    armour(75, "Khazard armour", "body", 1, 8, 150),
    armour(2405, "Carnillean armour", "body", 1, 8, 150),
    armour(3748, "Fremennik helm", "head", 1, 3, 100),
    armour(10822, "Yak-hide armour", "body", 1, 5, 200),
    armour(10824, "Yak-hide armour", "legs", 1, 4, 150),
    armour(4567, "Gold helmet", "head", 2, 7, 2000),
    armour(11200, "Dwarven helmet", "head", 4, 20, 200000),
    armour(13379, "Shayzien helm (5)", "head", 2, 9, 8000),
    armour(13381, "Shayzien body (5)", "body", 2, 17, 15000),
    armour(13380, "Shayzien greaves (5)", "legs", 2, 13, 12000),
    armour(13378, "Shayzien boots (5)", "feet", 2, 4, 4000),
    armour(13377, "Shayzien gloves (5)", "hands", 2, 3, 4000),
    armour(24034, "Dragonstone full helm", "head", 4, 20, 1000000),
    armour(24037, "Dragonstone platebody", "body", 4, 38, 2500000),
    armour(24040, "Dragonstone platelegs", "legs", 4, 30, 2000000),
    armour(24043, "Dragonstone boots", "feet", 4, 10, 800000),
    armour(28933, "Sunfire fanatic helm", "head", 4, 22, 3000000, { hp: 5 }),
    armour(28936, "Sunfire fanatic cuirass", "body", 4, 40, 8000000, { hp: 5 }),
    armour(28939, "Sunfire fanatic chausses", "legs", 4, 32, 6000000, { hp: 5 }),
    armour(30750, "Oathplate helm", "head", 5, 34, 300000000, { hp: 10 }),
    armour(30753, "Oathplate chest", "body", 5, 60, 600000000, { hp: 20 }),
    armour(30756, "Oathplate legs", "legs", 5, 48, 500000000, { hp: 15 }),
    armour(29028, "Blood Moon helm", "head", 4, 22, 5000000, { hp: 5 }),
    armour(29022, "Blood Moon chestplate", "body", 4, 40, 12000000, { hp: 10 }),
    armour(29025, "Blood Moon tassets", "legs", 4, 32, 10000000, { hp: 5 }),
    armour(13072, "Elite void top", "body", 4, 22, 500000, { hp: 12 }),
    armour(13073, "Elite void robe", "legs", 4, 18, 500000, { hp: 10 }),
    armour(10548, "Fighter hat", "head", 3, 16, 100000),
    armour(10549, "Runner hat", "head", 3, 14, 100000),
    armour(10555, "Penance skirt", "legs", 3, 18, 150000),
    armour(10552, "Runner boots", "feet", 2, 4, 20000),
    armour(9006, "Fighting boots", "feet", 1, 2, 100),
    armour(3107, "Spiked boots", "feet", 1, 2, 200),
    armour(7159, "Insulated boots", "feet", 1, 2, 500),
    armour(23037, "Boots of stone", "feet", 2, 4, 10000),
    armour(12598, "Holy sandals", "feet", 2, 3, 20000),
    armour(23389, "Spiked manacles", "feet", 2, 4, 50000),
    armour(22954, "Devout boots", "feet", 4, 7, 500000),
    armour(31088, "Avernic treads", "feet", 5, 18, 500000000),
    // Ranged armour
    armour(7453, "Hardleather gloves", "hands", 1, 1, 40),
    armour(10077, "Spiky vambraces", "hands", 1, 2, 100),
    armour(10954, "Frog-leather body", "body", 2, 10, 1500),
    armour(10956, "Frog-leather chaps", "legs", 2, 7, 1000),
    armour(10958, "Frog-leather boots", "feet", 2, 3, 400),
    armour(29280, "Mixed hide top", "body", 2, 11, 30000, { style: "ranged" }),
    armour(29283, "Mixed hide legs", "legs", 2, 8, 20000, { style: "ranged" }),
    armour(29286, "Mixed hide boots", "feet", 2, 3, 10000, { style: "ranged" }),
    armour(29289, "Mixed hide cape", "cape", 2, 3, 10000),
    armour(22269, "Hard leather shield", "shield", 1, 3, 60),
    armour(22272, "Snakeskin shield", "shield", 2, 7, 500),
    armour(22275, "Green d'hide shield", "shield", 3, 10, 3000),
    armour(22278, "Blue d'hide shield", "shield", 3, 12, 5000),
    armour(22281, "Red d'hide shield", "shield", 3, 14, 7000),
    armour(22284, "Black d'hide shield", "shield", 4, 16, 10000),
    armour(23188, "Guthix d'hide shield", "shield", 4, 18, 150000),
    armour(23191, "Saradomin d'hide shield", "shield", 4, 18, 150000),
    armour(23194, "Zamorak d'hide shield", "shield", 4, 18, 150000),
    armour(23197, "Ancient d'hide shield", "shield", 4, 18, 150000),
    armour(23200, "Armadyl d'hide shield", "shield", 4, 18, 150000),
    armour(23203, "Bandos d'hide shield", "shield", 4, 18, 150000),
    armour(19921, "Ancient d'hide boots", "feet", 4, 6, 100000),
    armour(19930, "Armadyl d'hide boots", "feet", 4, 6, 100000),
    armour(19924, "Bandos d'hide boots", "feet", 4, 6, 100000),
    armour(19927, "Guthix d'hide boots", "feet", 4, 6, 100000),
    armour(19933, "Saradomin d'hide boots", "feet", 4, 6, 100000),
    armour(19936, "Zamorak d'hide boots", "feet", 4, 6, 100000),
    armour(12512, "Armadyl coif", "head", 4, 12, 50000),
    armour(12508, "Armadyl d'hide body", "body", 4, 24, 200000),
    armour(12510, "Armadyl chaps", "legs", 4, 16, 150000),
    armour(12506, "Armadyl bracers", "hands", 4, 8, 50000),
    armour(12504, "Bandos coif", "head", 4, 12, 50000),
    armour(12500, "Bandos d'hide body", "body", 4, 24, 200000),
    armour(12502, "Bandos chaps", "legs", 4, 16, 150000),
    armour(12498, "Bandos bracers", "hands", 4, 8, 50000),
    armour(23249, "Rangers' tights", "legs", 3, 10, 250000),
    armour(10550, "Ranger hat", "head", 3, 12, 100000),
    armour(30073, "Hueycoatl hide coif", "head", 4, 14, 2000000),
    armour(30076, "Hueycoatl hide body", "body", 4, 28, 6000000, { style: "ranged" }),
    armour(30079, "Hueycoatl hide chaps", "legs", 4, 20, 4000000),
    armour(30082, "Hueycoatl hide vambraces", "hands", 4, 9, 1500000),
    armour(29010, "Eclipse Moon helm", "head", 4, 18, 5000000, { style: "ranged", hp: 5 }),
    armour(29004, "Eclipse Moon chestplate", "body", 4, 32, 12000000, { style: "ranged", hp: 10 }),
    armour(29007, "Eclipse Moon tassets", "legs", 4, 26, 10000000, { style: "ranged", hp: 5 }),
    armour(29806, "Aranea boots", "feet", 4, 9, 5000000, { style: "ranged" }),
    armour(21000, "Twisted buckler", "shield", 5, 28, 50000000, { style: "ranged" }),
    armour(26235, "Zaryte vambraces", "hands", 5, 14, 150000000),
    armour(28955, "Blessed Dizana's quiver", "cape", 5, 10, 150000000, { hp: 5 }),
    // Magic armour
    armour(544, "Monk's robe top", "body", 1, 3, 50),
    armour(542, "Monk's robe", "legs", 1, 2, 40),
    armour(9729, "Elemental helmet", "head", 1, 3, 500, { style: "magic" }),
    armour(2890, "Elemental shield", "shield", 1, 4, 500, { style: "magic" }),
    armour(9733, "Mind helmet", "head", 2, 6, 2000, { style: "magic" }),
    armour(9731, "Mind shield", "shield", 2, 7, 2000, { style: "magic" }),
    armour(777, "Chaos gauntlets", "hands", 2, 2, 3000, { style: "magic" }),
    armour(25438, "Zealot's helm", "head", 2, 5, 200000, { style: "magic" }),
    armour(25434, "Zealot's robe top", "body", 2, 9, 300000),
    armour(25436, "Zealot's robe bottom", "legs", 2, 7, 250000),
    armour(25440, "Zealot's boots", "feet", 2, 3, 100000, { style: "magic" }),
    armour(20128, "Hood of darkness", "head", 3, 8, 100000),
    armour(20131, "Robe top of darkness", "body", 3, 16, 250000),
    armour(20137, "Robe bottom of darkness", "legs", 3, 12, 200000),
    armour(20134, "Gloves of darkness", "hands", 3, 3, 60000, { style: "magic" }),
    armour(20140, "Boots of darkness", "feet", 3, 4, 60000, { style: "magic" }),
    armour(19997, "Holy wraps", "hands", 3, 4, 100000, { style: "magic" }),
    armour(10547, "Healer hat", "head", 3, 10, 100000, { style: "magic" }),
    armour(29019, "Blue Moon helm", "head", 4, 14, 5000000, { style: "magic", hp: 5 }),
    armour(29013, "Blue Moon chestplate", "body", 4, 26, 12000000, { style: "magic", hp: 10 }),
    armour(29016, "Blue Moon tassets", "legs", 4, 22, 10000000, { style: "magic", hp: 5 }),
    armour(30064, "Tome of Earth", "shield", 4, 12, 1500000, { hp: 5 }),
    armour(22951, "Boots of Brimstone", "feet", 5, 11, 10000000, { style: "magic" }),
    armour(31106, "Confliction gauntlets", "hands", 5, 10, 200000000, { style: "magic" }),
    armour(23336, "3rd Age druidic robe top", "body", 5, 28, 1500000000, { hp: 10 }),
    armour(23339, "3rd Age druidic robe bottoms", "legs", 5, 24, 1200000000, { hp: 10 }),
    // Capes and jewellery
    armour(10498, "Ava's attractor", "cape", 1, 2, 2000),
    armour(10499, "Ava's accumulator", "cape", 2, 4, 20000),
    armour(12437, "3rd Age cloak", "cape", 5, 12, 800000000, { hp: 5 }),
    armour(23345, "3rd Age druidic cloak", "cape", 5, 12, 800000000, { hp: 5 }),
    armour(22111, "Dragonbone necklace", "neck", 3, 4, 200000, { hp: 10 }),
    armour(12853, "Amulet of the Damned", "neck", 4, 6, 500000, { hp: 15 }),
    armour(22557, "Amulet of avarice", "neck", 4, 6, 3000000, { hp: 10 }),
    armour(29801, "Amulet of rancour", "neck", 5, 10, 100000000, { hp: 20 }),
    // ---- The sixth batch (version 53): same-stat twins of pieces in the
    // game, which the user chose to have in after all: every plateskirt
    // the game lacked, the lower Shayzien tiers, the Proselyte tasset and
    // Fancy boots.
    armour(1087, "Bronze plateskirt", "legs", 1, 6, 45),
    armour(1081, "Iron plateskirt", "legs", 1, 8, 135),
    armour(1089, "Black plateskirt", "legs", 2, 12, 540),
    armour(6627, "White plateskirt", "legs", 2, 12, 1500),
    armour(3480, "Guthix plateskirt", "legs", 3, 26, 100000),
    armour(3479, "Saradomin plateskirt", "legs", 3, 26, 100000),
    armour(3478, "Zamorak plateskirt", "legs", 3, 26, 100000),
    armour(12464, "Ancient plateskirt", "legs", 3, 26, 100000),
    armour(12474, "Armadyl plateskirt", "legs", 3, 26, 100000, { style: "melee" }),
    armour(12484, "Bandos plateskirt", "legs", 3, 26, 100000),
    armour(23242, "3rd Age plateskirt", "legs", 5, 48, 800000000, { hp: 10 }),
    armour(9678, "Proselyte tasset", "legs", 2, 13, 9000),
    armour(9005, "Fancy boots", "feet", 1, 2, 100),
    armour(13359, "Shayzien helm (1)", "head", 1, 5, 1000),
    armour(13361, "Shayzien platebody (1)", "body", 1, 9, 2000),
    armour(13360, "Shayzien greaves (1)", "legs", 1, 7, 1500),
    armour(13358, "Shayzien boots (1)", "feet", 1, 2, 500),
    armour(13357, "Shayzien gloves (1)", "hands", 1, 1, 500),
    armour(13364, "Shayzien helm (2)", "head", 1, 6, 2000),
    armour(13366, "Shayzien platebody (2)", "body", 1, 11, 4000),
    armour(13365, "Shayzien greaves (2)", "legs", 1, 9, 3000),
    armour(13363, "Shayzien boots (2)", "feet", 1, 3, 1000),
    armour(13362, "Shayzien gloves (2)", "hands", 1, 2, 1000),
    armour(13369, "Shayzien helm (3)", "head", 2, 7, 4000),
    armour(13371, "Shayzien platebody (3)", "body", 2, 13, 8000),
    armour(13370, "Shayzien greaves (3)", "legs", 2, 10, 6000),
    armour(13368, "Shayzien boots (3)", "feet", 2, 3, 2000),
    armour(13367, "Shayzien gloves (3)", "hands", 2, 2, 2000),
    armour(13374, "Shayzien helm (4)", "head", 2, 8, 6000),
    armour(13376, "Shayzien platebody (4)", "body", 2, 15, 12000),
    armour(13375, "Shayzien greaves (4)", "legs", 2, 12, 9000),
    armour(13373, "Shayzien boots (4)", "feet", 2, 4, 3000),
    armour(13372, "Shayzien gloves (4)", "hands", 2, 3, 3000),
    // Food, from the shop and now and then from what the dead drop. Dear:
    // a run's food is a cost to weigh against its takings.
    food(315, "Shrimps", 15, 105),
    food(2309, "Bread", 20, 186),
    food(333, "Trout", 30, 473),
    food(329, "Salmon", 40, 788),
    food(379, "Lobster", 55, 1733),
    food(373, "Swordfish", 70, 3308),
    food(385, "Shark", 100, 7875),
    // Potions, from the shop and from chests: 1 for strength, 2 for
    // defence, 3 for a brew, 4 for prayer, during a run
    potion(119, "Strength potion", "strength", 240),
    potion(137, "Defence potion", "defence", 200),
    potion(6691, "Saradomin brew", "brew", 300),
    potion(2434, "Prayer potion", "prayer", 220),
    { id: 995, name: "Coins", tier: 0, value: 1, stackable: true },
    { id: 526, name: "Bones", tier: 0, value: 2, stackable: true },
    // A clue scroll: dropped now and then, it names a spot on the map
    // where a casket is buried. Worth nothing to the shop, and it crumbles
    // on the way out.
    { id: 2677, name: "Clue scroll", tier: 0, value: 0, clue: true },
    // The vault's key: one of the map's champions carries it, and it's no
    // use off the map
    { id: 989, name: "Crystal key", tier: 0, value: 0, key: true },
    // The golden chest's key: the boss drops it every time, and it's no use
    // off the map either
    { id: 991, name: "Golden chest key", tier: 0, value: 0, bossKey: true },
    // Version 59: ranged and magic filled out. Thrown weapons, which need no
    // ammunition: darts (fastest, lightest), knives, throwing axes (the
    // heaviest), chinchompas (what they hit, everything beside it takes
    // half) and salamanders (two hands, close range, a flame)
    thrown(806, "Bronze dart", 1, 4, 0.5, 5, ARROW_BRONZE),
    thrown(807, "Iron dart", 1, 5, 0.5, 15, ARROW_IRON),
    thrown(808, "Steel dart", 1, 6, 0.5, 40, ARROW_STEEL),
    thrown(3093, "Black dart", 2, 7, 0.5, 60, ARROW_STEEL),
    thrown(809, "Mithril dart", 2, 8, 0.5, 120, ARROW_MITHRIL),
    thrown(810, "Adamant dart", 3, 11, 0.5, 300, ARROW_ADAMANT),
    thrown(811, "Rune dart", 3, 13, 0.5, 1200, ARROW_RUNE),
    thrown(25849, "Amethyst dart", 4, 17, 0.5, 3000, ARROW_AMETHYST),
    thrown(11230, "Dragon dart", 5, 22, 0.5, 8000, ARROW_DRAGON),
    thrown(864, "Bronze knife", 1, 5, 0.6, 6, ARROW_BRONZE),
    thrown(863, "Iron knife", 1, 6, 0.6, 20, ARROW_IRON),
    thrown(865, "Steel knife", 1, 7, 0.6, 50, ARROW_STEEL),
    thrown(869, "Black knife", 2, 8, 0.6, 80, ARROW_STEEL),
    thrown(866, "Mithril knife", 2, 10, 0.6, 150, ARROW_MITHRIL),
    thrown(867, "Adamant knife", 3, 13, 0.6, 400, ARROW_ADAMANT),
    thrown(868, "Rune knife", 3, 16, 0.6, 1500, ARROW_RUNE),
    thrown(22804, "Dragon knife", 5, 28, 0.6, 12000, ARROW_DRAGON),
    thrown(800, "Bronze thrownaxe", 1, 8, 0.9, 8, ARROW_BRONZE),
    thrown(801, "Iron thrownaxe", 1, 9, 0.9, 25, ARROW_IRON),
    thrown(802, "Steel thrownaxe", 1, 11, 0.9, 60, ARROW_STEEL),
    thrown(803, "Mithril thrownaxe", 2, 14, 0.9, 200, ARROW_MITHRIL),
    thrown(804, "Adamant thrownaxe", 3, 19, 0.9, 500, ARROW_ADAMANT),
    thrown(805, "Rune thrownaxe", 3, 23, 0.9, 2000, ARROW_RUNE),
    thrown(20849, "Dragon thrownaxe", 5, 40, 0.9, 20000, ARROW_DRAGON),
    thrown(22636, "Morrigan's javelin", 5, 50, 1.0, 1000000, ARROW_DRAGON, { range: 5 }),
    thrown(22634, "Morrigan's throwing axe", 5, 40, 0.8, 800000, ARROW_DRAGON),
    thrown(10033, "Chinchompa", 2, 14, 1.0, 800, 908, { range: 5, splash: true, impact: 157 }),
    thrown(10034, "Red chinchompa", 3, 24, 1.0, 2500, 909, { range: 5, splash: true, impact: 157 }),
    thrown(11959, "Black chinchompa", 4, 38, 1.0, 5000, 1272, { range: 5, splash: true, impact: 157 }),
    thrown(10149, "Swamp lizard", 1, 9, 0.9, 300, 100, { range: 3, twoHanded: true, impact: 101, sound: SPELL }),
    thrown(10146, "Orange salamander", 2, 15, 0.9, 1200, 100, { range: 3, twoHanded: true, impact: 101, sound: SPELL }),
    thrown(10147, "Red salamander", 3, 24, 0.9, 3000, 100, { range: 3, twoHanded: true, impact: 101, sound: SPELL }),
    thrown(10148, "Black salamander", 4, 36, 0.9, 6000, 100, { range: 3, twoHanded: true, impact: 101, sound: SPELL }),
    thrown(28834, "Tecu salamander", 5, 52, 0.9, 500000, 100, { range: 3, twoHanded: true, impact: 101, sound: SPELL }),
    bow(767, "Phoenix crossbow", 1, 8, 1.0, 150, BOLT),
    // The wands, the plain staves and the sceptres the game lacked
    staff(6908, "Beginner wand", 1, 10, 400),
    staff(6910, "Apprentice wand", 2, 16, 2000),
    staff(6912, "Teacher wand", 3, 26, 20000),
    staff(1379, "Staff", 1, 7, 50),
    weapon(772, "Dramen staff", 1, 9, 1.2, 100, { stance: "staff" }),
    staff(20733, "Mystic mist staff", 3, 28, 200000),
    weapon(9044, "Pharaoh's sceptre", 3, 30, 1.2, 300000, { stance: "staff" }),
    weapon(21649, "Merfolk trident", 3, 26, 1.0, 30000, { range: 1.8, attackClip: "attack_stab", stance: "staff" }),
    staff(33255, "Lithic sceptre", 4, 42, 2000000),
    weapon(33296, "Demonic sceptre", 5, 62, 1.0, 50000000),
    // Magic robes the game lacked: the black wizard's, the Shade and Druid
    // robes, the ghostly and Moonclan sets, the dark squall robes
    armour(1017, "Wizard hat", "head", 1, 2, 20),
    armour(581, "Black robe", "body", 1, 3, 30),
    armour(546, "Shade robe top", "body", 1, 3, 40),
    armour(548, "Shade robe", "legs", 1, 2, 30),
    armour(540, "Druid's robe top", "body", 1, 3, 60),
    armour(538, "Druid's robe", "legs", 1, 2, 40),
    armour(6109, "Ghostly hood", "head", 2, 3, 500),
    armour(6107, "Ghostly robe top", "body", 2, 6, 1000),
    armour(6108, "Ghostly robe bottom", "legs", 2, 5, 800),
    armour(6110, "Ghostly gloves", "hands", 2, 2, 300),
    armour(6106, "Ghostly boots", "feet", 2, 2, 300),
    armour(6111, "Ghostly cloak", "cape", 2, 2, 400),
    armour(9068, "Moonclan helm", "head", 2, 5, 800),
    armour(9069, "Moonclan hat", "head", 2, 4, 600),
    armour(9070, "Moonclan armour", "body", 2, 8, 1500),
    armour(9071, "Moonclan skirt", "legs", 2, 6, 1200),
    armour(9072, "Moonclan gloves", "hands", 2, 2, 300),
    armour(9073, "Moonclan boots", "feet", 2, 2, 300),
    armour(9074, "Moonclan cape", "cape", 2, 3, 500),
    armour(29566, "Dark squall hood", "head", 3, 8, 20000),
    armour(29568, "Dark squall robe top", "body", 3, 16, 50000),
    armour(29570, "Dark squall robe bottom", "legs", 3, 12, 40000),
    armour(25818, "Book of the Dead", "shield", 3, 4, 50000),
    // Ammunition, in kinds from the weakest to the strongest (version 59; an
    // older save's arrows and runes are the bronze and mind kinds). A shot
    // from a bow or a staff takes one: the best kind in the pack. Enemies
    // drop their map's tier of it, and the shop sells each kind once a map
    // of its tier is open.
    ammo(882, "Bronze arrows", "arrows", 1, 0.7, 3, ARROW_BRONZE),
    ammo(884, "Iron arrows", "arrows", 1, 0.8, 5, ARROW_IRON),
    ammo(886, "Steel arrows", "arrows", 2, 0.9, 8, ARROW_STEEL),
    ammo(888, "Mithril arrows", "arrows", 2, 1.0, 12, ARROW_MITHRIL),
    ammo(890, "Adamant arrows", "arrows", 3, 1.1, 20, ARROW_ADAMANT),
    ammo(892, "Rune arrows", "arrows", 3, 1.2, 35, ARROW_RUNE),
    ammo(21326, "Amethyst arrows", "arrows", 4, 1.3, 60, ARROW_AMETHYST),
    ammo(11212, "Dragon arrows", "arrows", 5, 1.45, 100, ARROW_DRAGON),
    // Runes (version 106: the spellbook, content/spells.ts, says what each
    // spell takes). The elemental runes are every tier's, since every spell
    // needs them; a family's catalyst is its tier's: mind for strikes, chaos
    // bolts, death blasts, blood waves, wrath surges. Power and look are
    // the spell's now, not the rune's.
    ammo(558, "Mind runes", "runes", 1, 0.7, 3, 91, 92),
    ammo(556, "Air runes", "runes", 1, 0.8, 4, 118, 119),
    ammo(555, "Water runes", "runes", 1, 0.9, 4, 121, 122),
    ammo(557, "Earth runes", "runes", 1, 1.0, 4, 124, 125),
    ammo(554, "Fire runes", "runes", 1, 1.1, 4, 127, 128),
    ammo(562, "Chaos runes", "runes", 2, 1.2, 20, 130, 131),
    ammo(560, "Death runes", "runes", 3, 1.3, 60, 156, 157),
    ammo(565, "Blood runes", "runes", 4, 1.45, 100, 156, 375),
    // Ancient Magicks' (version 107): shadow spells and Blood Barrage
    ammo(566, "Soul runes", "runes", 4, 1.5, 120, 378, 379),
    ammo(21880, "Wrath runes", "runes", 5, 1.6, 150, 1465, 1466),
    // The lithic sceptre's charge (version 110), with earth runes
    ammo(559, "Body runes", "runes", 1, 0.75, 4, 91, 92),
];

for (const item of ITEMS) {
    if (item.slot && item.style === undefined) {
        item.style = armourStyle(item);
    }
}

// A piece's prayer bonus slows the bar's drain and speeds its refill by
// 1 + bonus / this
export const PRAYER_BONUS_SCALE = 30;

// OSRS's prayer bonuses, for the pieces that have one: the holy armours,
// the god books and blessed shields, the blessed hides, the god rune sets,
// the godswords, the Zamorakian spear, the big amulets and the fire capes
const PRAYER_BONUS: Record<number, number> = {
    // Initiate, Proselyte, monk's, druid's, Zealot's, Sunfire fanatic
    5574: 3, 5575: 6, 5576: 5,
    540: 4, 538: 4,
    9672: 4, 9674: 8, 9676: 6, 9678: 6,
    544: 6, 542: 5,
    25438: 3, 25434: 6, 25436: 5, 25440: 2,
    28933: 2, 28936: 4, 28939: 3,
    // Verac's, the Armadyl and Bandos armour, holy wraps, holy boots, 3rd age druidic
    4753: 3, 4757: 5, 4759: 4, 4755: 2,
    11826: 1, 11828: 1, 11830: 1, 11832: 1, 11834: 1, 11836: 1,
    19997: 3, 12598: 3, 22954: 5,
    23336: 8, 23339: 6, 23345: 5, 23342: 5,
    // God books, spirit shields
    3840: 5, 3842: 5, 3844: 5, 12608: 5, 12610: 5, 12612: 5,
    12829: 1, 12831: 3, 12821: 3, 12825: 3, 12817: 3,
    // Blessed d'hide: body, chaps, coif, bracers, boots, shield
    10378: 4, 10380: 3, 10382: 2, 10376: 1, 19927: 1, 23188: 3,
    10386: 4, 10388: 3, 10390: 2, 10384: 1, 19933: 1, 23191: 3,
    10370: 4, 10372: 3, 10374: 2, 10368: 1, 19936: 1, 23194: 3,
    12492: 4, 12494: 3, 12496: 2, 12490: 1, 19921: 1, 23197: 3,
    12508: 4, 12510: 3, 12512: 2, 12506: 1, 19930: 1, 23200: 3,
    12500: 4, 12502: 3, 12504: 2, 12498: 1, 19924: 1, 23203: 3,
    // God rune armour
    2673: 1, 2675: 1, 2669: 1, 2671: 1, 3480: 1,
    2665: 1, 2667: 1, 2661: 1, 2663: 1, 3479: 1,
    2657: 1, 2659: 1, 2653: 1, 2655: 1, 3478: 1,
    12466: 1, 12468: 1, 12460: 1, 12462: 1, 12464: 1,
    12476: 1, 12478: 1, 12470: 1, 12472: 1, 12474: 1,
    12486: 1, 12488: 1, 12480: 1, 12482: 1, 12484: 1,
    // Godswords, the Zamorakian spear and hasta, Saradomin's blessed sword
    11802: 8, 11806: 8, 11804: 8, 11808: 8, 26233: 8, 11824: 2, 11889: 2, 12809: 2,
    // Jewellery and capes
    6585: 5, 24780: 5, 19553: 2, 19547: 2, 12002: 2, 1704: 3, 1731: 1, 29801: 2, 22111: 12, 12601: 4,
    6570: 2, 21295: 2,
};
for (const [id, prayer] of Object.entries(PRAYER_BONUS)) {
    const item = ITEMS.find((i) => i.id === Number(id));
    if (!item) {
        throw new Error("Prayer bonus for an item the game lacks: " + id);
    }
    item.prayer = prayer;
}

// How the two handers are held (version 81), as OSRS holds them: every
// player piece carries each of these stances and swings (Run Escape's
// PLAYER_CLIPS). Two handed swords, the colossal blade, the scythe and the
// glaive stay as their entries say ("2h", the two handed sword's).
const GODSWORD: Partial<ItemDef> = { stance: "godsword", attackClip: "attack_2h" };
const MAUL: Partial<ItemDef> = { stance: "maul", attackClip: "attack_maul" };
const HOLDS: Record<number, Partial<ItemDef>> = {
    // Godswords, upright in one hand, and the Saradomin swords with them
    11802: GODSWORD, 11804: GODSWORD, 11806: GODSWORD, 11808: GODSWORD, 26233: GODSWORD, 11838: GODSWORD, 12809: GODSWORD,
    // Mauls and the other heavy two handers, two hands on the haft: the
    // granite and elder mauls, the Tzhaar-ket-om, the hill giant club, the
    // bludgeon, the anchor, Dharok's greataxe, the soulreaper axe
    4153: MAUL, 21003: MAUL, 6528: MAUL, 20756: MAUL, 13263: MAUL, 10887: MAUL, 4718: MAUL, 28338: MAUL,
    // Dinh's bulwark, planted in front; it bashes as a maul swings
    21015: { stance: "bulwark", attackClip: "attack_maul" },
};
for (const [id, hold] of Object.entries(HOLDS)) {
    const item = ITEMS.find((i) => i.id === Number(id));
    if (!item) {
        throw new Error("A hold for an item the game lacks: " + id);
    }
    Object.assign(item, hold);
}
// Spears and halberds stand as with a staff and thrust as a spear does
for (const item of ITEMS) {
    if (item.twoHanded && /\b(spear|halberd|warspear)\b/i.test(item.name)) {
        item.stance = "staff";
        item.attackClip = "attack_spear";
    }
}

// The gilded pieces (version 83), for the owner's test character alone
// (kit.ts keeps them at the head of its stash): OSRS's gilded armour has the
// stats of the piece it gilds, so each is that piece's twin here, and the
// gilded hides green d'hide's (the coif, which green has none of, a three
// star ranged helm of its own). The cache's look, the twin's numbers.
export const GILDED: number[] = [];
{
    const twins: [number, string, number, Partial<ItemDef>?][] = [
        [3486, "Gilded full helm", 1163],
        [20146, "Gilded med helm", 1147],
        [3481, "Gilded platebody", 1127],
        [20149, "Gilded chainbody", 1113],
        [3483, "Gilded platelegs", 1079],
        [3485, "Gilded plateskirt", 1093],
        [3488, "Gilded kiteshield", 1201],
        [20152, "Gilded sq shield", 1185],
        [12391, "Gilded boots", 4131],
        [23258, "Gilded coif", 1135, { slot: "head", defence: 7, hp: undefined }],
        [23264, "Gilded d'hide body", 1135],
        [23267, "Gilded d'hide chaps", 1099],
        [23261, "Gilded d'hide vambraces", 1065],
        [12389, "Gilded scimitar", 1333],
        [20155, "Gilded 2h sword", 1319],
        [20158, "Gilded spear", 1247],
        [20161, "Gilded hasta", 11377],
        [23279, "Gilded axe", 1359],
    ];
    for (const [id, name, twin, changes] of twins) {
        const base = ITEMS.find((i) => i.id === twin);
        if (!base) {
            throw new Error(`No ${twin} for ${name} to be the twin of`);
        }
        ITEMS.push({ ...base, ...changes, id, name, exclusive: "owner" });
        GILDED.push(id);
    }
}

// Salmon Dev's (the playtester's) own set (version 89): the Sunfire fanatic
// armour with its plate in iron's greys and its trim in Guthix's green, for
// that test character alone. Each is the Sunfire piece's twin; the ids are
// the cache's unused noted forms of the pieces, and the look is exported
// with Run Escape's --like and --recolor (README's two characters section).
export const GUTHIX_SUNFIRE: number[] = [];
{
    const twins: [number, string, number][] = [
        [28934, "Guthix sunfire helm", 28933],
        [28937, "Guthix sunfire cuirass", 28936],
        [28940, "Guthix sunfire chausses", 28939],
    ];
    for (const [id, name, twin] of twins) {
        const base = ITEMS.find((i) => i.id === twin);
        if (!base) {
            throw new Error(`No ${twin} for ${name} to be the twin of`);
        }
        ITEMS.push({ ...base, id, name, exclusive: "playtester" });
        GUTHIX_SUNFIRE.push(id);
    }
}

// The Ankou outfit (version 120), for the owner's own first character alone
// (kit.ts keeps it), as the user asked: OSRS's is cosmetic, with no stats, so each piece is the
// twin of the Infinity robes' in its slot (four star magic). The cache's
// own ids and looks.
export const ANKOU: number[] = [];
{
    const twins: [number, string, number][] = [
        [20095, "Ankou mask", 6918],
        [20098, "Ankou top", 6916],
        [20104, "Ankou's leggings", 6924],
        [20101, "Ankou gloves", 6922],
        [20107, "Ankou socks", 6920],
    ];
    for (const [id, name, twin] of twins) {
        const base = ITEMS.find((i) => i.id === twin);
        if (!base) {
            throw new Error(`No ${twin} for ${name} to be the twin of`);
        }
        ITEMS.push({ ...base, id, name, exclusive: "owner" });
        ANKOU.push(id);
    }
}

// The red ghostly robes (version 121), for the owner's own first character
// alone as well, as the user asked: the Ghostly robes in the Ankou outfit's
// deeper red, still see-through, each the twin of its Ghostly piece (whose
// own grey everyone else keeps). The ids are the cache's spare copies: its
// second Ghostly hood and robes, and three more spares exported with the
// gloves', boots' and cloak's looks (Run Escape's --like and --recolor).
export const RED_GHOSTLY: number[] = [];
{
    const twins: [number, string, number][] = [
        [27166, "Red ghostly hood", 6109],
        [27167, "Red ghostly robe top", 6107],
        [27168, "Red ghostly robe bottom", 6108],
        [27170, "Red ghostly gloves", 6110],
        [27171, "Red ghostly boots", 6106],
        [27172, "Red ghostly cloak", 6111],
    ];
    for (const [id, name, twin] of twins) {
        const base = ITEMS.find((i) => i.id === twin);
        if (!base) {
            throw new Error(`No ${twin} for ${name} to be the twin of`);
        }
        ITEMS.push({ ...base, id, name, exclusive: "owner" });
        RED_GHOSTLY.push(id);
    }
}

export const ITEM_BY_ID: Map<number, ItemDef> = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: number): ItemDef {
    const item = ITEM_BY_ID.get(id);
    if (!item) {
        throw new Error("Unknown item " + id);
    }
    return item;
}

export const COINS = 995;

// The food the shop always has
export const SHOP_FOOD: number[] = [315, 2309, 333, 329, 379, 373, 385];
export const SHOP_POTIONS: number[] = [119, 137, 6691, 2434];
export const CLUE_SCROLL = 2677;
export const VAULT_KEY = 989;
export const BOSS_KEY = 991;
// What a pack carries at most: this many pieces of food in all, and this
// many arrows and this many runes (every kind together); a bite takes this
// long before the next (inventory.ts's canCarry enforces the limits,
// run.ts the delay). Runes went from 100 to 2000 with the spellbook
// (version 106): a spell takes OSRS's two to seventeen of them.
export const FOOD_LIMIT = 15;
export const AMMO_LIMITS: Record<"arrows" | "runes", number> = { arrows: 150, runes: 2000 };
export const EAT_DELAY = 1.8;
// The weakest kind of each, what a new pack starts with
export const AMMO_ARROWS = 882;
export const AMMO_RUNES = 558;
// Every kind of ammunition, weakest first: the shop's shelf (each kind once
// a map of its tier is open), and what enemies drop by their map's tier
export const AMMO: ItemDef[] = ITEMS.filter((i) => i.ammo !== undefined);
export const SHOP_AMMO: number[] = AMMO.map((i) => i.id);

// A kind of ammunition a map of this tier drops: one of its tier's, at
// random (the lower tiers have two kinds each)
export function ammoOfTier(kind: "arrows" | "runes", tier: number, roll: number): number {
    const kinds = AMMO.filter((i) => i.ammo === kind && i.tier === tier);
    const pick = kinds.length > 0 ? kinds : AMMO.filter((i) => i.ammo === kind);
    return pick[Math.min(pick.length - 1, Math.floor(roll * pick.length))].id;
}
// What a chest's supplies are, by map tier: bread up to swordfish
export const FOOD_BY_TIER: number[] = [2309, 333, 329, 379, 373];

// Gear prices come from the tier and the slot, not from OSRS's economy, so a
// map's takings buy a piece of its own tier after a few runs, and nothing
// from far above it (selling pays a quarter of these, insurance a fifth, a
// repair a tenth per full wear)
const TIER_PRICE = [0, 120, 800, 4000, 18000, 80000];
const SLOT_PRICE: Record<Slot, number> = {
    weapon: 1.5,
    body: 1.4,
    legs: 1.2,
    head: 1,
    shield: 1,
    cape: 0.8,
    neck: 0.9,
    ring: 0.9,
    feet: 0.6,
    hands: 0.6,
};

export function price(item: ItemDef): number {
    if (!item.slot) {
        return item.value;
    }
    return Math.round((TIER_PRICE[item.tier] ?? 1000) * SLOT_PRICE[item.slot]);
}

// Random gear the shop offers: mostly low tiers, now and then something
// good, and nothing above the hardest map tier reached (maxTier), so the
// strong gear is found out there before it's sold here
const STOCK_SIZE = 8;
const STOCK_TIER_WEIGHTS = [0, 45, 30, 16, 7, 2];

export function rollShopStock(random: () => number, maxTier = 5, size = STOCK_SIZE): number[] {
    const weights = STOCK_TIER_WEIGHTS.map((w, t) => (t <= Math.max(1, maxTier) ? w : 0));
    const stock: number[] = [];
    for (let tries = 0; tries < 100 && stock.length < size; tries++) {
        let roll = random() * weights.reduce((a, b) => a + b, 0);
        let tier = 1;
        for (let t = 1; t < weights.length; t++) {
            roll -= weights[t];
            if (roll <= 0) {
                tier = t;
                break;
            }
        }
        // Never a tier's prize: those are found, not bought
        const item = rollGear(random, tier, 0);
        if (item && !stock.includes(item.id)) {
            stock.push(item.id);
        }
    }
    return stock;
}

// Gear by tier, for chests
export const GEAR_BY_TIER: Map<number, ItemDef[]> = new Map();
for (const item of ITEMS) {
    if (item.slot && !item.exclusive) {
        const list = GEAR_BY_TIER.get(item.tier) ?? [];
        list.push(item);
        GEAR_BY_TIER.set(item.tier, list);
    }
}

// How strong a piece is next to the others of its tier and slot: a weapon
// by damage a second, armour by defence with its hitpoints
export function gearPower(item: ItemDef): number {
    if (item.damage !== undefined) {
        return item.damage / (item.speed ?? 1);
    }
    return (item.defence ?? 0) + (item.hp ?? 0) * 0.5;
}

// Rarity within a tier. The strongest piece of each tier and slot is that
// tier's prize: it never comes from an ordinary chest, an ordinary kill or
// the shop, only from the boss's chest, the vault, a champion or a clue
// casket. The rest drop more the weaker they are: the weakest third of a
// tier and slot four times as often as the strongest third.
export const PRIZES = new Set<number>();
const GEAR_WEIGHT = new Map<number, number>();
{
    const groups = new Map<string, ItemDef[]>();
    for (const item of ITEMS) {
        if (item.slot && !item.exclusive) {
            const key = `${item.tier}:${item.slot}`;
            groups.set(key, [...(groups.get(key) ?? []), item]);
        }
    }
    for (const group of groups.values()) {
        group.sort((a, b) => gearPower(a) - gearPower(b));
        group.forEach((item, i) => {
            const p = group.length > 1 ? i / (group.length - 1) : 0.5;
            GEAR_WEIGHT.set(item.id, p < 1 / 3 ? 4 : p < 2 / 3 ? 2 : 1);
        });
        if (group.length >= 2) {
            PRIZES.add(group[group.length - 1].id);
        }
    }
}

export function isPrize(id: number): boolean {
    return PRIZES.has(id);
}

// A piece of a tier at random. `prizeChance` is the chance the piece is
// one of the tier's prizes (0 where prizes aren't given), picked evenly
// among them; otherwise one of the rest by weight.
export function rollGear(random: () => number, tier: number, prizeChance: number): ItemDef | undefined {
    const all = GEAR_BY_TIER.get(tier) ?? [];
    const prizes = all.filter((i) => PRIZES.has(i.id));
    const rest = all.filter((i) => !PRIZES.has(i.id));
    if (prizes.length > 0 && prizeChance > 0 && (rest.length === 0 || random() < prizeChance)) {
        return prizes[Math.floor(random() * prizes.length)];
    }
    const from = rest.length > 0 ? rest : all;
    if (from.length === 0) {
        return undefined;
    }
    const weight = (item: ItemDef) => GEAR_WEIGHT.get(item.id) ?? 1;
    let roll = random() * from.reduce((n, i) => n + weight(i), 0);
    for (const item of from) {
        roll -= weight(item);
        if (roll <= 0) {
            return item;
        }
    }
    return from[from.length - 1];
}

import { assetUrl } from "../game/paths";

export function iconUrl(id: number): string {
    return assetUrl(`assets/items/${id}.png`);
}

export function formatCoins(n: number): string {
    if (n >= 10_000_000) {
        return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (n >= 100_000) {
        return Math.floor(n / 1000) + "K";
    }
    return n.toLocaleString();
}
