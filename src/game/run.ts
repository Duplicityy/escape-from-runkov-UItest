// One run on a map: the exported OSRS region, the player, the enemies and
// boss scattered over it, the chests, the loot, and the way out where you
// came in.
import * as THREE from "three";

import { PLAYER_SOUND_NPC } from "../content/bodies";
import { TORCHES, addTorchTo, flicker, setTorch, setTorchNight, torchesOut } from "./torch";
import { EnemyDef } from "../content/enemies";
import {
    BOLT,
    BOSS_KEY,
    CLUE_SCROLL,
    COINS,
    EAT_DELAY,
    FOOD_BY_TIER,
    POTION_SECONDS,
    PRAYER_RESTORE,
    PRAYER_BONUS_SCALE,
    Potion,
    SHOP_POTIONS,
    SLOTS,
    Special,
    TIER_COLOURS,
    VAULT_KEY,
    ammoOfTier,
    getItem,
    iconUrl,
    rollGear,
    specialOf,
    tierGlows,
} from "../content/items";
import {
    AHRIMS_STAFF,
    AMULET_OF_THE_DAMNED,
    Book,
    POISON_EVERY,
    POISON_HITS,
    SPELL_BY_ID,
    SpellDef,
    WEAKEN_SECONDS,
    bestSpell,
    castsAncients,
    castsLeft,
    poweredSpell,
    runeDrop,
    runesGiven,
    spellCost,
    spellScale,
    staffCasts,
} from "../content/spells";
import { WorldDef } from "../content/worlds";
import { GameStart, LootRule } from "./coop";
import { Hero, Mate } from "./mates";
import {
    CLIP_ATTACK,
    CLIP_DEATH,
    CLIP_IDLE,
    CLIP_WALK,
    DownMessage,
    EnemyClip,
    EnemyDefLite,
    EnemyShot,
    HERO_ATTACK,
    HERO_DEATH,
    HERO_IDLE,
    HERO_RUN,
    HeroAnim,
    HeroState,
    KEYFRAME_EVERY,
    LOAD_WAIT_SECONDS,
    SNAPSHOT_HZ,
    SNAPSHOT_MAX_ENEMIES,
    SNAPSHOT_RANGE,
    STATE_CODES,
    STATE_NAMES,
    SpawnMessage,
    UpMessage,
    PRAY_NAMES,
    isDown,
    isUp,
    prayCode,
    round1,
    round2,
} from "./party";
import { MapLoad, loadMap } from "./mapload";
import { Overhead } from "./overhead";
import { PET_ONE_IN, PetBuff, applyPetStats, createPet, petBuff } from "./pets";
import { addShadow, groundShadow } from "./shadows";
import { iconTexture } from "./icons";
import {
    Actor,
    createActor,
    loadModel,
    loadTexture,
    npcSound,
    play,
    playChime,
    playPop,
    playSound,
    setWorldLight,
    tint,
} from "./assets";
import { assetUrl } from "./paths";
import { LootTracker } from "./loot";
import { REGEN_DELAY, REGEN_PER_SECOND, ammoScale, enemyHit, playerHit } from "./combat";
import { Rng, makeRng } from "./dungeon";
import {
    BASE_HP,
    GearStats,
    INVENTORY_SIZE,
    WEAR_PER_HIT,
    Wear,
    addItem,
    canCarry,
    carryLimitText,
    countOf,
    equip,
    gearStats,
    removeItem,
    roomFor,
    sellPrice,
    unequip,
    wearOf,
} from "./inventory";
import { CROWN_SHEET_HEIGHT, crownKey, crownSprite, crownVerified, nameColorOf } from "./crown";
import { playMusic } from "./music";
import { PlayerLook, RUN_CLIP_SPEED } from "./player";
import { isKept } from "./kit";
import { Region, Tile, TileSet, loadRegion } from "./region";
import { findWalkPath } from "./pathfinding";
import { Character, Equipment, Grave, ItemStack } from "./save";
import { ZOOM_MAX, ZOOM_MIN, saveSettings, settings } from "./settings";

export type RunCarry = {
    inventory: ItemStack[];
    equipment: Equipment;
    coins: number;
    hp?: number;
    // The guild's upgrades: pack slots, and how fast the special bar fills
    packSize?: number;
    specRate?: number;
    // Your gravestone on this map, if you died here lately, with what's in it
    grave?: Grave;
    // The pet that comes along, and every pet owned (a boss drops no second)
    pet?: string;
    pets?: string[];
    // How worn each piece of armour is (inventory.ts): it wears on in a run
    // and comes back with the gear
    wear?: Wear;
    // The spell picked to autocast (content/spells.ts; version 106), or
    // none: a staff then casts the strongest it can of the book open
    // (standard or Ancient Magicks, version 107)
    autocast?: string;
    spellbook?: Book;
};

// A style to protect from: enemies hit with it do half while the prayer
// bar lasts (Z, X, C, or the Pray button)
export type ProtectStyle = "none" | "melee" | "ranged" | "magic";

export function styleOf(def: EnemyDef): ProtectStyle {
    return def.shoots?.style ?? "melee";
}

// How a run ended: out with the loot, dead, or walked out of it from the
// pause menu (which loses what was carried, the same as dying), with the
// run's report card
export type RunResult = {
    kind: "extracted" | "died" | "left";
    carry: RunCarry;
    world: WorldDef;
    report: RunReport;
};

// What happened in a run, for the record, the tasks and the recap: how
// long, what was killed, what was eaten, what the pack held, who did it,
// and the map as it was seen with where it ended marked
export type RunReport = {
    seconds: number;
    kills: number;
    bossKills: number;
    championKills: number;
    rangedKills: number;
    ate: number;
    packItems: number;
    killer?: string;
    map: HTMLCanvasElement;
    // Where it ended (a gravestone goes there)
    x: number;
    z: number;
    // What's still in the gravestone visited, and whether it was emptied
    graveItems?: ItemStack[];
    graveTaken: boolean;
    // Clue scrolls dug up, vaults unlocked, and the pet a boss dropped
    // (the map's id)
    clues: number;
    vaults: number;
    petFound?: string;
    // Whether it was a night run
    night: boolean;
    // For the tasks (version 75): hits taken, chests opened by this player
    // (and whether the boss's golden one was), potions drunk, special
    // attacks used, things bought from the trader, whether the genie was
    // paid for the way out, how many seconds the ways out had left at the
    // end, and how many were in the party
    hitsTaken: number;
    // Hitpoints lost to them (version 115)
    damageTaken: number;
    chestsOpened: number;
    goldenOpened: boolean;
    drank: number;
    specials: number;
    traderBuys: number;
    genie: boolean;
    secondsLeft: number;
    party: number;
    // Party balloons this player burst (version 129)
    balloons: number;
};

export type RunHooks = {
    onEnd: (result: RunResult) => void;
    onMessage: (text: string) => void;
    // Something the HUD shows changed
    onChanged: () => void;
    // The player's at the trader: the UI opens the trade
    onTrade: () => void;
    // A hit landed on the player, this hard (a phone buzzes)
    onHurt?: (hit: number) => void;
};

// A co-op run (party.ts): whether this browser hosts it or is a guest in
// it, who this player is to the relay, everyone in the party as the start
// named them, and how a message gets to the others (the host's go to every
// guest, a guest's to the host)
export type CoopSetup = {
    role: "host" | "guest";
    me: string;
    heroes: GameStart["heroes"];
    send: (message: unknown) => void;
    // How the coins found are shared (version 115; the host's to apply)
    loot?: LootRule;
};

// What the HUD shows of the party
export type PartyMember = { id: string; name: string; hp: number; maxHp: number; dead: boolean; done: boolean; me: boolean; color?: string };

// With more in the party, the enemies have more in them: this much over for
// each player past the first, and the boss this much
const PARTY_ENEMY_HP = 0.25;
// Half until version 78: four players with revives made short work of it
const PARTY_BOSS_HP = 0.75;

// A health bar over an enemy's head, the client's way: green over red,
// shown while it fights and for a while after
type HealthBar = { group: THREE.Group; fill: THREE.Sprite };
const BAR_SECONDS = 6;
const BAR_WIDTH = 1;

type Enemy = {
    def: EnemyDef;
    actor: Actor;
    x: number;
    z: number;
    facing: number;
    hp: number;
    bar?: HealthBar;
    // Seconds the bar stays up
    barShown: number;
    // Fleeing: running for help, low on health, before coming back
    state: "idle" | "chase" | "attack" | "flee" | "dead";
    cooldown: number;
    // Seconds between attacks: the def's, less once a boss is enraged
    interval: number;
    // Seconds until the swing lands
    hitIn: number;
    deadFor: number;
    flash: number;
    // Its colour when nothing's flashing it: white, gold for a champion,
    // red for an enraged boss
    tint: THREE.Color;
    enraged?: boolean;
    // A boss's ground slam, and burning floor: seconds to the next
    slamIn: number;
    floorIn: number;
    // Seconds of crawling, from Ahrim's set
    slow: number;
    // Ancient Magicks (version 107): seconds frozen in place (ice); a share
    // off its hits and for how long (shadow); poison (smoke): what each
    // hit of it does, how many are left, seconds to the next, and whose
    frozen: number;
    weak: number;
    weakLeft: number;
    poisonHit: number;
    poisonLeft: number;
    poisonNext: number;
    poisonBy?: Hero;
    // A shooter that alternates: what the next shot is
    style?: "magic" | "ranged";
    // A second form, once it's fallen the first time
    reborn?: boolean;
    // A patrol: the tiles it walks between while idle, which it's heading
    // for, and how long it's been getting nowhere
    route?: Tile[];
    routeAt: number;
    stuck: number;
    // The champion carrying the vault's key
    key?: boolean;
    // An elite's trait (TRAITS), and whether it's been called out
    trait?: Trait;
    noticed?: boolean;
    // Which side of the player a melee enemy goes for, and when it last
    // took a hit (a boss heals if it's left alone; a regenerating elite
    // heals once it's been left alone a moment)
    flank: number;
    lastHurtAt: number;
    // Running for help: once an enemy, for this long, and it won't give
    // up the chase until this time
    fled?: boolean;
    fleeLeft: number;
    noIdleUntil: number;
    // Co-op: its number for the network, who it's after, how many times
    // it's attacked (the guests replay each), what was last sent of it, and
    // (on a guest) when this player last hit it, so the host's word on its
    // health isn't shown as a hit twice
    uid: number;
    target?: Hero;
    attacks: number;
    sentX: number;
    sentZ: number;
    sentClip: EnemyClip;
    sentState: string;
    sentHp: number;
    tintCode: 0 | 1 | 2;
    myHitAt: number;
    // Where it was put (a boss walks back there when it gives up a chase),
    // and when it last said it was giving up
    homeX: number;
    homeZ: number;
    gaveUpAt: number;
    // A guest's copy: where the host's last word put it, eased towards, and
    // which of its attacks have been played
    targetX: number;
    targetZ: number;
    targetFacing: number;
    seenAttacks: number;
};

// Elite traits: one enemy in ELITE_ONE_IN has one, shown by its tint
type Trait = "fast" | "armoured" | "venomous" | "regenerating";
const TRAITS: Record<Trait, { tint: THREE.Color; what: string }> = {
    fast: { tint: new THREE.Color(1.35, 1.3, 0.5), what: "half again as quick" },
    armoured: { tint: new THREE.Color(0.7, 0.72, 0.85), what: "your hits do six tenths" },
    venomous: { tint: new THREE.Color(0.65, 1.35, 0.65), what: "its hits poison you; food settles it" },
    regenerating: { tint: new THREE.Color(1.35, 0.75, 1.1), what: "it heals when left alone" },
};

// A pet following the player: its model, where it is and which way it faces
type Pet = { actor: Actor; x: number; z: number; facing: number; stuck: number };
// A way out: where its portal stands, and whether it's been seen
type Exit = { x: number; z: number; actor?: Actor; found: boolean };

// A patch of ground about to hurt: the ring warning where, and what it does
// to whoever's on it when the time's up
type Hazard = { ring: THREE.Mesh; left: number; x: number; z: number; radius: number; hit: (hero: Hero) => void; burst?: () => void };

// Something dropped: its icon bobbing over a shadow, and a shaft of light
// over a piece of gear worth one
type Pickup = {
    uid: number;
    id: number;
    count: number;
    sprite: THREE.Sprite;
    shadow: THREE.Mesh;
    beam?: THREE.Mesh;
    // A piece of gear's glow, its tier's colour (version 136)
    glow?: THREE.Sprite;
    x: number;
    z: number;
    age: number;
    // Items put down from a pack are transfers, not new world loot.
    noLoot?: boolean;
};

// The soft round light behind a piece of gear on the ground, drawn once in
// white and coloured per tier by its material
let glowMap: THREE.CanvasTexture | undefined;

function glowTexture(): THREE.CanvasTexture {
    if (!glowMap) {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        fade.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        fade.addColorStop(0.4, "rgba(255, 255, 255, 0.45)");
        fade.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, size, size);
        glowMap = new THREE.CanvasTexture(canvas);
    }
    return glowMap;
}

// A party balloon (version 129): where it lands, its colour, how long it's
// been about, its model once loaded, and its shadow on the ground (version
// 135), which grows as it comes down
type Balloon = { uid: number; x: number; z: number; colour: number; age: number; actor?: Actor; shadow?: THREE.Mesh; gone: boolean };

// A friendly face on the map: the wandering trader, and whether he's been
// pointed out yet (his model comes after his place is picked)
type Trader = { actor?: Actor; x: number; z: number; rotation: number; seen: boolean };
// The genie beside the spawn, who grants a wish out for coins
type Ferry = { actor?: Actor; x: number; z: number; rotation: number };

// Something flying: the player's at an enemy, or a mage's spell at a hero
// (from says whose); a visual one is a mate's, or on a guest an enemy's,
// and hurts nothing here
type Projectile = {
    root: THREE.Object3D;
    x: number;
    z: number;
    y: number;
    target?: Enemy;
    hero?: Hero;
    from?: EnemyDef;
    visual?: boolean;
    // The style a mage's or archer's shot hits with
    style?: ProtectStyle;
    damage: number;
    impact?: number;
    // A chinchompa's: what's beside the target takes half too
    splash?: boolean;
    // The player's spell, and its max hit (an Ancient spell's area and
    // effect go by them); an enemy's shot's share of its hit (shadow
    // spells take some off)
    spell?: SpellDef;
    maxHit?: number;
    scale?: number;
    // A spell's sound where it lands (version 108), anyone's
    hitSound?: number;
};

type Effect ={ actor: Actor; left: number };

// A chest: now and then a mimic (an enemy, once opened), or watched (opening
// it rouses what's about)
type Chest = {
    tile: Tile;
    // Its model, once that's loaded
    actor?: Actor;
    opened: boolean;
    boss: boolean;
    mimic?: boolean;
    ambush?: boolean;
    // The map's vault: locked, with gear from two tiers up inside
    vault?: boolean;
};

const PLAYER_RADIUS = 0.35;
// What the ground stops: narrower than the body, so a one tile gap between
// trees, or a doorway, can be walked through without lining up on it
const COLLISION_RADIUS = 0.25;
// Tiles a second unburdened: 4.2 until version 137, 30% faster since, as
// the user asked (a melee boss's chase below keeps pace with it)
const PLAYER_SPEED = 4.2 * 1.3;
// A melee boss after you moves at least this fast (just under you
// unburdened); any boss gives up the chase this many tiles from you and
// walks back to where it stood
const BOSS_CHASE_SPEED = PLAYER_SPEED * 0.95;
const BOSS_GIVE_UP = 20;
// A melee boss gives up much sooner, and only notices you from a little
// nearer than that (so it doesn't rouse and give up by turns at the edge)
const BOSS_GIVE_UP_MELEE = 8;
const BOSS_NOTICE_SHARE = 0.75;
// Holding E at the way out takes this long, and the moment it starts
// everything idle within this many tiles comes running
const EXTRACT_SECONDS = 10;
const EXTRACT_WAKE = 15;
// Co-op (version 76): a player who falls while someone else in the party
// is still standing is down, not dead, for this long; a mate who holds E at
// their side this long, this close, brings them back up with this share of
// their hitpoints, and nothing can hurt them for a moment after
const REVIVE_WINDOW = 60;
const REVIVE_SECONDS = 4;
const REVIVE_RANGE = 1.6;
const REVIVE_HP_SHARE = 0.3;
const REVIVE_GRACE = 3;
// A fall with nobody standing to help, or a solo one: this long on the
// ground, then the run's over for this player
const DEATH_PAUSE = 2.5;
// The vault (the crystal chest's model)
const VAULT_LOC = 172;
// The way out: Clan Wars' Free-for-all portal, a white swirl spinning
// between two stone pillars (its own animation, exported with the model;
// 29667, the lobby's low yellow Clan Wars vortex, is in the assets too)
const EXIT_LOC = 26645;
// Party balloons (version 129), a random event: now and then a handful
// drift down round someone standing, to burst by running into them. The
// six colours, and each one's burst, in the same order
const BALLOON_LOCS = [115, 116, 117, 118, 119, 120];
const BALLOON_BURSTS = [123, 124, 125, 126, 127, 128];
// Seconds into the run of the first, and between one and the next
const BALLOON_FIRST: [number, number] = [60, 150];
const BALLOON_EVERY: [number, number] = [180, 300];
const BALLOON_COUNT: [number, number] = [6, 9];
// How far round the hero they land (tiles), how long the fall takes, and
// how long they stay before floating off. The fall is the model's own
// animation, played once: from about seven tiles up (at this scale) to
// the ground in two and a half seconds
const BALLOON_SPREAD: [number, number] = [1.5, 5];
// The model's a fifth of a tile tall: drawn this much bigger, to read on
// the map
const BALLOON_SCALE = 3;
const BALLOON_FALL = 2.5;
// Its shadow's radius on the ground (tiles)
const BALLOON_SHADOW = 0.28;
const BALLOON_LIFE = 45;
const BALLOON_REACH = 0.75;
// What's in one: a piece of gear now and then, arrows or runes, food, or
// nothing at all
const BALLOON_GEAR = 0.08;
const BALLOON_AMMO = 0.45;
const BALLOON_FOOD = 0.32;
// The map wakes after this long (enemies notice you from twice as far, and
// nothing heals on its own), and the way out closes after this long
const WAKE_SECONDS = 240;
const CLOSE_SECONDS = 720;
// A roused enemy rouses everything idle this close
const ROUSE_SPREAD = 8;
// A mage or archer backs off while you're closer than this share of its
// range; a melee enemy within this many tiles goes for your side
const RETREAT_SHARE = 0.45;
const FLANK_RANGE = 4;
// Within this an enemy with a clear straight walk to its player takes it
// rather than the flow field's tile by tile steps
const STRAIGHT_RANGE = 6;
// A swing asked for while the weapon recovers waits this long for it
const ATTACK_BUFFER = 0.6;
// Below this share of its health an enemy runs for help for this long,
// rousing what's idle this close as it goes, and won't give up the chase
// for this long after
const FLEE_HP = 1 / 3;
const FLEE_SECONDS = 4;
const FLEE_ROUSE = 6;
const FLEE_PERSIST = 12;
// One enemy in this many is an elite (TRAITS); a venomous one's hits poison
// you for this many ticks, this far apart, each for this share of max hp
const ELITE_ONE_IN = 12;
const POISON_TICKS = 4;
const POISON_INTERVAL = 1.5;
const POISON_SHARE = 0.03;
// A boss is enraged below this share of its health, and an enraged boss left
// alone for this long heals this share
const BOSS_ENRAGE = 0.6;
const BOSS_IDLE_HEAL_SECONDS = 10;
const BOSS_IDLE_HEAL = 0.1;
// Protection drains this much faster with the boss after you
const BOSS_PRAYER_DRAIN = 2;
// Poison, for the record of who killed you
const POISON: EnemyDef = {
    id: "poison",
    npcId: 0,
    name: "Poison",
    hp: 1,
    damage: 0,
    speed: 0,
    radius: 0,
    attackInterval: 1,
    attackRange: 0,
    aggro: 0,
    coins: [0, 0],
    foodChance: 0,
};
// One enemy in twenty is a champion, with this much over the usual
// hitpoints and damage
const CHAMPION_CHANCE = 0.05;
const CHAMPION_HP = 2.5;
const CHAMPION_DAMAGE = 2;
// An enraged boss slams the ground this often, hurting anyone this close
const SLAM_SECONDS = 7;
const SLAM_RANGE = 3;
// Each piece of gear in the pack slows you by this much, up to the cap
const WEIGHT_PER_PIECE = 0.015;
const WEIGHT_MAX = 0.3;
// The way out shows on the minimap once you've been this close to it
const EXIT_SIGHT = 10;
// How many ways out a map has (version 69), and how far apart they're kept
// as a share of the map's longer side (halved as often as the ground needs)
const EXIT_COUNT = 4;
const EXIT_SPREAD_SHARE = 1 / 3;
// The special attack bar: what a special costs of its 100, and how much
// comes back a second
const SPEC_COST = 50;
const SPEC_REGEN = 5;
// The minimap's fog clears this far round you
const FOG_RADIUS = 12;
// The prayer bar: what protection drains a second, what comes back a second
// with none on
export const PRAYER_DRAIN = 4;
const PRAYER_REGEN = 1.5;
// The client's sound for each protection as it's switched on (the OSRS
// wiki's sound effect ids: protect_from_melee, _missiles, _magic)
const PRAYER_SOUNDS: Record<Exclude<ProtectStyle, "none">, number> = { melee: 2676, ranged: 2677, magic: 2675 };
// One chest in this many is a mimic, and this share of the rest are watched
const MIMIC_ONE_IN = 15;
const AMBUSH_CHANCE = 0.2;
// A boss with burning floor marks this many tiles this close to the player,
// this often, for this share of max hitpoints
const FLOOR_SECONDS = 8;
const FLOOR_TILES = 3;
const FLOOR_SPREAD = 3;
const FLOOR_DAMAGE = 0.15;
// This share of the map's walkers patrol: a round of up to two more tiles
// this far from where they stand, at this much of their speed
const PATROL_CHANCE = 0.3;
const PATROL_REACH = 8;
const PATROL_SPEED = 0.6;
// An ordinary kill drops its coins this often (a boss or a champion always),
// and a purse of several times the usual this often
const COIN_DROP_CHANCE = 0.4;
const PURSE_CHANCE = 0.05;
// The way out closes CLOSE_SECONDS into a run on a map of this many tiles
// a side; a bigger map gets longer by the square root of its area, to the
// half minute (closeSeconds)
const CLOSE_SECONDS_SIDE = 128;
// A kill drops a few arrows or runes this often (one in four)
const AMMO_DROP_CHANCE = 0.25;
// How far a chinchompa's burst reaches past what it hit, in tiles
const SPLASH_TILES = 1.5;

// What a hit does besides its damage: Ahrim's slow, Torag's stall, and an
// Ancient spell's freeze (seconds), weaken (a share off its hits) and poison
// (what each poison hit does); poisoned marks a poison hit itself
type HitEffects = { slow?: boolean; stall?: boolean; freeze?: number; weaken?: number; poison?: number; poisoned?: boolean };

// How a shot looks: the spot animation flying, and the one where it lands;
// and, cast, the spell and its max hit (an Ancient spell's area and effect)
type Look = { projectile?: number; impact?: number; spell?: SpellDef; maxHit?: number };
// A kill drops a prayer potion this often, and a clue scroll this often
// (one a run); the scroll's spot is this many steps off, and digging works
// this close to it
const PRAYER_POTION_CHANCE = 0.04;
const CLUE_CHANCE = 0.03;
const CLUE_MIN_STEPS = 12;
const CLUE_MAX_STEPS = 32;
const CLUE_DIG_RANGE = 3;
// A pet keeps this far behind, and catches up by itself from this far
const PET_FOLLOW = 1.2;
const PET_LEASH = 12;
// One run in this many is at night: the map and everything on it under
// this light, the fog this close, and enemies noticing you from this much
// of their usual distance
const NIGHT_CHANCE = 0.25;
const NIGHT_LIGHT = new THREE.Color(0.35, 0.41, 0.68);
const NIGHT_SKY = 0x0f1424;
const NIGHT_FOG: [number, number] = [12, 34];
const NIGHT_AGGRO = 0.6;
// How often a night run gives new things in the scene the torchlight
const TORCH_SWEEP = 0.5;
const FORCE_NIGHT = (() => {
    try {
        return new URLSearchParams(location.search).has("night");
    } catch {
        return false;
    }
})();
const DAY_LIGHT = new THREE.Color(1, 1, 1);
const WHITE = new THREE.Color(1, 1, 1);
// The boss stands where the fight has room: at least this many open tiles
// can be walked to within this many of it (a circle of that size holds
// about 250), so it's never in a building or a lane
const BOSS_ROOM_RADIUS = 9;
const BOSS_ROOM_TILES = 150;
const BOSS_TILE_TRIES = 12;
// The wandering trader (the Mysterious Old Man's model) charges this much
// over the shop's prices
export const TRADER_NPC = 6750;
export const TRADER_MARKUP = 1.5;
// The genie beside where you arrived (version 70) grants a wish out of the
// map for coins: this much on a one star map, and 2.2 times more a tier, as
// the purses grow, so it's about a third of a run's takings whatever the map
export const FERRY_NPC = 326;
const FERRY_FEE_BASE = 150;

export function ferryFee(tier: number): number {
    return Math.round((FERRY_FEE_BASE * Math.pow(2.2, tier - 1)) / 10) * 10;
}
// Gear of this tier and up drops under a shaft of light, with a chime
const BEAM_TIER = 4;
// An enemy's sounds are full this close to the player and silent this far
const HEAR_NEAR = 7;
const HEAR_FAR = 26;
// How often a piece of gear is one of its tier's prizes (items.ts): from a
// champion, from the boss's chest, and from the vault or a clue casket
const PRIZE_FULL = 1 / 6;
const PRIZE_BOSS_CHEST = 1 / 15;
const PRIZE_CASKET = 1 / 32;
const CAMERA_OFFSET = new THREE.Vector3(0, 13, 9);
const UP = new THREE.Vector3(0, 1, 0);
// How far round (and up or down) the camera goes for a pixel of a drag
const TURN_PER_PIXEL = 0.008;
// How steeply the camera looks down: CAMERA_OFFSET's, and as flat and as
// overhead as a drag can tilt it
const BASE_PITCH = Math.atan2(CAMERA_OFFSET.y, CAMERA_OFFSET.z);
const PITCH_MIN = 0.6;
const PITCH_MAX = 1.4;
// How far a finger can wander before it starts turning the camera, in pixels
const TAP_SLOP = 10;
const PROJECTILE_SPEED = 14;
// The minimap shows this many tiles across its circle
const MINIMAP_TILES = 40;
// How dark the unwalked ground is on the full map (1 would be the minimap's
// black)
const FULL_MAP_FOG = 0.7;
// Roofs come back this long after you're out from under them
const ROOF_RETURN_SECONDS = 0.3;
// Scenery stands on a tile that slopes less than this (in tiles) when one
// can be found in a few tries, so a chest or the trapdoor isn't half buried
const FLAT_TILE = 0.15;
const FLAT_TRIES = 20;
// A map's chests are its world's count for this much ground that can be
// walked to (or for its open ground, the older measure, if that's more),
// each the best spread of this many candidate spots
const CHEST_FULL_REACH = 12000;
const SPREAD_CANDIDATES = 12;
// A map's enemies are its world's count for this much ground that can be
// walked to, between these
const ENEMY_FULL_REACH = 14000;
const ENEMY_MIN = 40;
const ENEMY_MAX = 200;

function randInt(rng: Rng, min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1));
}

// The map for a party of this many: the same, with the enemies' hitpoints
// up for every player past the first (PARTY_ENEMY_HP, PARTY_BOSS_HP)
function partyWorld(world: WorldDef, players: number): WorldDef {
    const extra = players - 1;
    const tougher = (def: EnemyDef, share: number): EnemyDef => ({ ...def, hp: Math.round(def.hp * (1 + share * extra)) });
    return {
        ...world,
        enemies: world.enemies.map((e) => ({ def: tougher(e.def, PARTY_ENEMY_HP), weight: e.weight })),
        boss: tougher(world.boss, PARTY_BOSS_HP),
    };
}

export class Run {
    readonly scene = new THREE.Scene();
    readonly camera: THREE.PerspectiveCamera;
    readonly rng: Rng;

    // What the HUD reads
    hp: number;
    maxHp: number;
    inventory: ItemStack[];
    equipment: Equipment;
    coins: number;
    readonly loot = new LootTracker();
    stats: GearStats;
    prompt = "";
    boss?: { name: string; hp: number; maxHp: number };
    dead = false;
    ended = false;
    // Stood still from the pause menu: nothing moves, nothing is heard
    paused = false;

    private player!: PlayerLook;
    // The moderator's crown over this player's head, for the game's maker
    // (crown.ts; the others' are on their Mates)
    private crown?: THREE.Sprite;
    // The protection prayer's icon over this player's head (version 103)
    private overhead?: Overhead;
    private lookGeneration = 0;
    private px: number;
    private pz: number;
    private facing = 0;
    private attackCooldown = 0;
    private swingIn = -1;
    private swingTarget?: Enemy;
    private hurtFlash = 0;
    private lastHurt = -100;
    private regen = 0;
    private deadFor = 0;
    // Co-op reviving: how long E's been held at a downed mate's side (and
    // whose), and until when this player, just brought back up, can't be hit
    private reviving = 0;
    private revivingId?: string;
    private graceUntil = -100;
    // How many times this player's gone down this run: each fall's window
    // for a revive is half the last one's (version 78)
    private falls = 0;

    private enemies: Enemy[] = [];
    private pickups: Pickup[] = [];
    private projectiles: Projectile[] = [];
    private effects: Effect[] = [];
    private chests: Chest[] = [];
    // The ways out: EXIT_COUNT portals somewhere else on the map each run,
    // spread apart, each to be found (the minimap shows one once it's been
    // seen, or the nearest once the boss has fallen)
    private exits: Exit[] = [];
    private extracting = 0;
    // The run's clock: the map wakes, then the ways out close
    awake = false;
    closed = false;
    private warned = new Set<number>();
    // Whether anything was after the player last frame: no healing then
    private chased = false;
    private champions = new Map<EnemyDef, EnemyDef>();
    private ammoMessageAt = -10;
    // The spell picked to autocast (the spellbook sets it), or none for the
    // strongest the staff can cast with the runes packed; and the book open
    autocast?: string;
    spellbook: Book = "standard";
    private slamRing?: THREE.RingGeometry;
    private hazards: Hazard[] = [];
    // Party balloons about now, and when the next lot comes (the host's
    // and a solo run's to decide; -1 until the run's clock starts)
    private balloons: Balloon[] = [];
    private balloonsAt = -1;
    // Bursts playing out, and how many this player has burst
    private popping: { actor: Actor; left: number }[] = [];
    private balloonsBurst = 0;
    // A ring under the enemy being hit, where there's no cursor to show it
    // (a touch screen; ui/touch.ts turns it on)
    markTarget = false;
    private targetRing?: THREE.Mesh;
    // The guild's upgrades that came along
    private readonly packSize: number;
    private readonly specRate: number;
    // Protection from a style, and the prayer that pays for it, 0 to 100
    protect: ProtectStyle = "none";
    prayer = 100;
    private piercedOnce = false;
    // The map's ambient sounds: seconds to the next
    private ambientIn = 4;
    // Hitsplats: the number of every hit, floating up off whoever took it
    private splats: { sprite: THREE.Sprite; left: number; baseY: number }[] = [];
    private splatTextures = new Map<string, THREE.CanvasTexture>();
    // The special attack bar, 0 to 100, and whether the next swing spends it
    spec = 100;
    private specPending = false;
    // What's been seen of the map: the minimap's fog clears round you
    private explored?: Uint8Array;
    private fog?: HTMLCanvasElement;
    private exploredTile = -1;
    // The report card
    kills = 0;
    bossKills = 0;
    championKills = 0;
    rangedKills = 0;
    ate = 0;
    clues = 0;
    vaults = 0;
    killer?: string;
    petFound?: string;
    private hitsTaken = 0;
    // Hitpoints the hits took, all told (version 115: the vault's word on
    // how long food lasts)
    private damageTaken = 0;
    private chestsOpened = 0;
    private goldenOpened = false;
    private drank = 0;
    private specials = 0;
    private traderBuys = 0;
    private genie = false;
    // Coins come by in this run (picked up, or the trader's for what was
    // sold): the genie takes only these, not coins brought from the bank
    // (version 78), so a wish out is something a run earns
    private coinsFound = 0;
    // Your gravestone from last time, with what's still in it
    private grave?: { actor: Actor; x: number; z: number; items: ItemStack[] };
    private graveTaken = false;
    // Each clue scroll's spot, one per scroll picked up (version 95: there
    // was one for the run, so a second scroll moved it and digging either
    // left the other scroll with none), and whether you've been told it's
    // close; and whether one has dropped from this run's kills or chests
    private clueSpots: { x: number; z: number; near: boolean }[] = [];
    private clueDropped = false;
    private pet?: Pet;
    // What the pet that came along does for you (pets.ts)
    private readonly petBuff?: PetBuff;
    private readonly carry: RunCarry;
    // A night run: the map's materials are darkened in place (the model is
    // shared with the menu), and put back when the run stops
    readonly night: boolean;
    // The map's model, a square at a time as they come in (mapload.ts)
    private map?: THREE.Object3D;
    private mapLoad?: MapLoad;
    private nightMaterials: { material: THREE.MeshBasicMaterial; color: THREE.Color }[] = [];
    private readonly nightSeen = new Set<THREE.Material>();
    private trader?: Trader;
    private ferry?: Ferry;
    // The vault shows on the minimap once its key is in hand; and whether
    // this hold of E at the way out has woken the neighbourhood yet
    private vaultFound = false;
    private extractWoke = false;
    // Each piece of armour's wear, carried in and out with the gear
    readonly wear: Wear;
    // Poison in you: ticks left, and seconds to the next
    private poisonTicks = 0;
    private poisonIn = 0;
    private fleeMessageAt = -10;
    // map.glb's floors above the plane: buildings' upper storeys and roofs,
    // and how long you've been out from under them
    private upperFloors: THREE.Object3D[] = [];
    private roofClearFor = 0;
    // Seconds left on each potion (a prayer potion works at once instead),
    // and until the next bite can be taken
    readonly boosts: Record<Potion, number> = { strength: 0, defence: 0, brew: 0, prayer: 0 };
    private eatIn = 0;
    // The whole map from above, for the minimap
    private minimap?: { image: HTMLCanvasElement; pxPerTile: number };
    // How far off the camera stands: the settings' distance, and the wheel's
    private zoom = settings.zoom;
    private readonly cameraOffset = new THREE.Vector3();
    // How far the camera's been turned round you from the south, in radians,
    // and how steeply it looks down (version 123; version 124 made it OSRS
    // mobile's): a middle-button drag on a desktop, a finger dragged on the
    // world on a touch screen. The keys and the stick turn with it, so up is
    // always away from the camera.
    private cameraYaw = 0;
    private cameraPitch = BASE_PITCH;
    // The middle button held down for turning, and where it was
    private turnPointer?: number;
    private turnX = 0;
    private turnY = 0;
    // The fingers on the world (not the stick or a button): where each is
    // and came down, and whether it's gone far enough to be turning the camera
    private readonly fingers = new Map<number, { x: number; y: number; fromX: number; fromY: number; dragged: boolean }>();
    // How far apart two fingers were at the pinch's last move
    private pinchFrom?: number;

    // Click walking is an optional route through the existing free movement.
    private walkPath: Tile[] = [];
    private walkMarker?: THREE.LineSegments;
    private walkStuckFor = 0;
    private readonly worldRay = new THREE.Raycaster();

    private keys = new Set<string>();
    private wantAttack = false;
    // How much longer a press waits for the weapon to be ready
    private attackAsked = 0;
    // A touch screen's stick (ui/touch.ts): which way and how far, -1 to 1,
    // added to the keys
    readonly stick = { x: 0, z: 0 };
    // Separate from touch input so releasing a controller cannot release a
    // thumb still holding the screen's movement stick.
    private readonly controllerStick = { x: 0, z: 0 };
    private controllerInteract = false;
    private controllerAttack = false;
    private touchAttack = false;
    private readonly aimInput = { x: 0, z: 0 };
    // A flow field to each hero enemies can be after, worked out every
    // quarter second (one hero outside co-op)
    private flows = new Map<string, Int16Array>();
    private flowAge = 1;
    private fullMessageAt = -10;
    private time = 0;
    private frame?: number;
    private clock = new THREE.Clock();
    private disposables: { dispose(): void }[] = [];

    // Co-op (party.ts): this player as an enemy sees them (the host's own
    // hero; a guest's too, for what's local), the others in the party, and
    // the traffic between the host's run and the guests'
    readonly coop?: CoopSetup;
    private readonly self: Hero;
    private readonly mates = new Map<string, Mate>();
    // This player's run is over (out, dead, or left) while the party's goes
    // on: they watch the others until it ends, or leave
    private done?: RunResult["kind"];
    private spectating?: Mate;
    private partyOver = false;
    // The world holds still while the party loads: who hasn't yet, and how
    // long the host gives them
    private holding = false;
    private waitingFor = new Set<string>();
    private waitLeft = LOAD_WAIT_SECONDS;
    private snapshotIn = 0;
    private snapshots = 0;
    private moveIn = 0;
    private attacks = 0;
    private nextUid = 0;
    // The host's table of what each enemy is, for the guests (and theirs,
    // from the host); whether the host has sent the map yet (spawns after
    // that go on their own)
    private readonly defs: EnemyDefLite[] = [];
    private readonly defIndex = new Map<EnemyDef, number>();
    private worldSent = false;
    // On a guest: what the host's clock says, and the pickups asked for and
    // not yet answered (asked again after a moment)
    private hostLeft: number;
    private readonly requested = new Map<number, number>();
    private readonly ghosts = new Map<number, Enemy>();

    private constructor(
        private readonly renderer: THREE.WebGLRenderer,
        readonly world: WorldDef,
        readonly region: Region,
        carry: RunCarry,
        private readonly character: Character,
        seed: number,
        private readonly hooks: RunHooks,
        coop?: CoopSetup,
    ) {
        this.rng = makeRng(seed);
        this.carry = carry;
        this.autocast = carry.autocast && SPELL_BY_ID.has(carry.autocast) ? carry.autocast : undefined;
        this.spellbook = carry.spellbook === "ancient" ? "ancient" : "standard";
        this.coop = coop;
        this.hostLeft = this.closeSeconds();
        // The first draw, so every browser in a party gets the same night;
        // alone, ?night in the address makes every run a night (a way to
        // try the torchlight)
        this.night = this.rng() < NIGHT_CHANCE || (!coop && FORCE_NIGHT);
        this.inventory = carry.inventory.map((s) => ({ ...s }));
        this.equipment = { ...carry.equipment };
        this.coins = carry.coins;
        this.wear = { ...(carry.wear ?? {}) };
        this.petBuff = petBuff(carry.pet);
        this.stats = gearStats(this.equipment, this.wear);
        applyPetStats(this.stats, this.petBuff);
        this.maxHp = BASE_HP + this.stats.hp;
        this.hp = Math.min(this.maxHp, carry.hp ?? this.maxHp);
        this.packSize = carry.packSize ?? INVENTORY_SIZE;
        this.specRate = (carry.specRate ?? 1) * (1 + (this.petBuff?.spec ?? 0));
        this.px = region.spawn.x;
        this.pz = region.spawn.z;
        this.self = {
            id: coop?.me ?? "me",
            name: character.name,
            x: this.px,
            z: this.pz,
            facing: 0,
            hp: this.hp,
            maxHp: this.maxHp,
            dead: false,
            defenceVs: this.defenceTriple(),
            protect: "none",
            me: true,
        };
        // The others, standing where everyone arrives until they say otherwise
        if (coop) {
            for (const hero of coop.heroes) {
                if (hero.id !== coop.me) {
                    this.mates.set(hero.id, new Mate(hero.id, hero.name, hero.loadout, this.px, this.pz, this.scene, (x, z) => this.groundY(x, z)));
                }
            }
        }

        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
        // Daylight: the map is lit the way the client lit it, so only the
        // distance needs fog
        this.scene.background = new THREE.Color(0x7d96b8);
        this.scene.fog = new THREE.Fog(0x7d96b8, 28, 70);
    }

    static async create(
        renderer: THREE.WebGLRenderer,
        world: WorldDef,
        carry: RunCarry,
        character: Character,
        seed: number,
        hooks: RunHooks,
        coop?: CoopSetup,
    ): Promise<Run> {
        const region = await loadRegion(world.id);
        // The host's enemies have more in them for a bigger party
        if (coop?.role === "host" && coop.heroes.length > 1) {
            world = partyWorld(world, coop.heroes.length);
        }
        const run = new Run(renderer, world, region, carry, character, seed, hooks, coop);
        // The map comes in a square at a time, the ones round the spawn
        // first: the run starts on those, and the rest join as they arrive
        const map = new THREE.Group();
        run.map = map;
        run.scene.add(map);
        run.mapLoad = loadMap(region, region.spawn.x, region.spawn.z, (part) => {
            part.traverse((o) => {
                const mesh = o as THREE.Mesh;
                if (mesh.isMesh) {
                    mesh.frustumCulled = true;
                }
                const level = /^level(\d+)$/.exec(o.name);
                if (level && parseInt(level[1]) > region.plane) {
                    run.upperFloors.push(o);
                }
            });
            map.add(part);
            run.applyNightTo(part);
        });
        await run.mapLoad.near;
        // The minimap is drawn by day either way, so it can be read; and
        // again whole once the far squares are in
        run.renderMinimapImage();
        run.applyNight();
        void run.mapLoad.all.then(() => {
            if (!run.ended) {
                run.renderMinimapImage();
            }
        });
        await run.loadActors();
        return run;
    }

    // Night: the sky and fog close in, the map's colours go down to the
    // night's blue, and so does the light on everything made from here on
    private applyNight(): void {
        if (!this.night || !this.map) {
            return;
        }
        this.scene.background = new THREE.Color(NIGHT_SKY);
        this.scene.fog = new THREE.Fog(NIGHT_SKY, NIGHT_FOG[0], NIGHT_FOG[1]);
        setWorldLight(NIGHT_LIGHT);
        setTorchNight(NIGHT_LIGHT);
        this.nightApplied = true;
        this.applyNightTo(this.map);
    }

    // The night's colour on a part of the map (each once, as the squares
    // come in; nothing until the night has begun)
    private nightApplied = false;

    private applyNightTo(root: THREE.Object3D): void {
        if (!this.night || !this.nightApplied) {
            return;
        }
        root.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) {
                return;
            }
            for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                const material = m as THREE.MeshBasicMaterial;
                if (!this.nightSeen.has(material) && material.color) {
                    this.nightSeen.add(material);
                    this.nightMaterials.push({ material, color: material.color.clone() });
                    material.color.multiply(NIGHT_LIGHT);
                }
            }
        });
    }

    // A picture of the whole map from straight above, north up, drawn
    // through the screen's own pipeline (to the game canvas, then copied)
    // so its colours are the screen's. Only the map is drawn (drawn again
    // when the far squares are in, with everything that moves hidden for
    // the moment); the fog over it is made the first time only.
    private renderMinimapImage(): void {
        const g = this.region;
        const canvas = this.renderer.domElement;
        // The canvas hasn't been sized yet on a fresh page (start() does
        // that), and a background tab can report no window at all
        if (canvas.width < 2 || canvas.height < 2) {
            this.renderer.setSize(window.innerWidth || 512, window.innerHeight || 512, false);
        }
        const side = Math.min(canvas.width, canvas.height);
        const tiles = Math.max(g.sizeX, g.sizeY);
        const half = tiles / 2;
        const camera = new THREE.OrthographicCamera(
            (-half * canvas.width) / side,
            (half * canvas.width) / side,
            (half * canvas.height) / side,
            (-half * canvas.height) / side,
            1,
            200,
        );
        const cx = g.baseX + tiles / 2;
        const cz = -(g.baseY + tiles / 2);
        camera.position.set(cx, 100, cz);
        camera.up.set(0, 0, -1);
        camera.lookAt(cx, 0, cz);
        const fog = this.scene.fog;
        const background = this.scene.background;
        this.scene.fog = null;
        this.scene.background = new THREE.Color(0x000000);
        const hidden: THREE.Object3D[] = [];
        for (const child of this.scene.children) {
            if (child !== this.map && child.visible) {
                child.visible = false;
                hidden.push(child);
            }
        }
        // The map by day, whatever the hour
        const dimmed = this.nightMaterials;
        for (const { material, color } of dimmed) {
            material.color.copy(color);
        }
        this.renderer.render(this.scene, camera);
        for (const { material } of dimmed) {
            material.color.multiply(NIGHT_LIGHT);
        }
        for (const child of hidden) {
            child.visible = true;
        }
        this.scene.fog = fog;
        this.scene.background = background;
        const image = this.minimap?.image ?? document.createElement("canvas");
        image.width = side;
        image.height = side;
        image
            .getContext("2d")!
            .drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, side, side);
        this.minimap = { image, pxPerTile: side / tiles };
        if (!this.fog) {
            // Fog over all of it, cleared as the map is walked
            const fogCanvas = document.createElement("canvas");
            fogCanvas.width = side;
            fogCanvas.height = side;
            const fogCtx = fogCanvas.getContext("2d")!;
            fogCtx.fillStyle = "#000";
            fogCtx.fillRect(0, 0, side, side);
            this.fog = fogCanvas;
            this.explored = new Uint8Array(g.sizeX * g.sizeY);
        }
        // Not left on screen: if loading fails after this, the menu comes
        // back over a blank canvas rather than the map from above
        this.renderer.clear();
    }

    // Clears the fog round the player when they're on a new tile
    private reveal(): void {
        const g = this.region;
        const mini = this.minimap;
        if (!mini || !this.fog || !this.explored) {
            return;
        }
        const tx = g.tileX(this.px) - g.baseX;
        const ty = g.tileY(this.pz) - g.baseY;
        const here = tx + ty * g.sizeX;
        if (here === this.exploredTile) {
            return;
        }
        this.exploredTile = here;
        for (let dy = -FOG_RADIUS; dy <= FOG_RADIUS; dy++) {
            for (let dx = -FOG_RADIUS; dx <= FOG_RADIUS; dx++) {
                const x = tx + dx;
                const y = ty + dy;
                if (dx * dx + dy * dy <= FOG_RADIUS * FOG_RADIUS && x >= 0 && y >= 0 && x < g.sizeX && y < g.sizeY) {
                    this.explored[x + y * g.sizeX] = 1;
                }
            }
        }
        const ctx = this.fog.getContext("2d")!;
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc((this.px - g.baseX) * mini.pxPerTile, (g.baseY + g.sizeY + this.pz) * mini.pxPerTile, FOG_RADIUS * mini.pxPerTile, 0, Math.PI * 2);
        ctx.fill();
    }

    // Map navigation shares the fog-of-war check used by map markers.
    isDiscovered(x: number, z: number): boolean {
        return Number.isFinite(x) && Number.isFinite(z) && this.isExplored(x, z);
    }

    private isExplored(x: number, z: number): boolean {
        const g = this.region;
        const tx = g.tileX(x) - g.baseX;
        const ty = g.tileY(z) - g.baseY;
        if (!this.explored || tx < 0 || ty < 0 || tx >= g.sizeX || ty >= g.sizeY) {
            return false;
        }
        return this.explored[tx + ty * g.sizeX] === 1;
    }

    // The whole map as it's been seen, with where you arrived, the way out
    // if it was found, and where the run ended: for the summary
    private recapMap(size: number): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);
        const mini = this.minimap;
        if (!mini) {
            return canvas;
        }
        ctx.drawImage(mini.image, 0, 0, size, size);
        if (this.fog) {
            ctx.drawImage(this.fog, 0, 0, size, size);
        }
        const g = this.region;
        const scale = size / mini.image.width;
        const dot = (x: number, z: number, color: string, r: number) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc((x - g.baseX) * mini.pxPerTile * scale, (g.baseY + g.sizeY + z) * mini.pxPerTile * scale, r, 0, Math.PI * 2);
            ctx.fill();
        };
        dot(g.spawn.x, g.spawn.z, "#ffffff", 3);
        for (const exit of this.exits) {
            if (exit.found) {
                dot(exit.x, exit.z, "#00ff00", 3);
            }
        }
        if (this.grave && this.grave.items.length > 0) {
            dot(this.grave.x, this.grave.z, "#b8b0ff", 3);
        }
        dot(this.px, this.pz, this.dead ? "#ff2020" : "#ffd700", 4);
        return canvas;
    }

    // The minimap in its circle: the map around you, chests, the way out,
    // enemies and the boss, you in the middle
    drawMinimap(ctx: CanvasRenderingContext2D, size: number): void {
        const mini = this.minimap;
        if (!mini) {
            return;
        }
        const g = this.region;
        const scale = size / MINIMAP_TILES;
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        const half = MINIMAP_TILES / 2;
        const sx = (this.px - half - g.baseX) * mini.pxPerTile;
        const sy = (this.pz - half + g.baseY + g.sizeY) * mini.pxPerTile;
        const sw = MINIMAP_TILES * mini.pxPerTile;
        ctx.drawImage(mini.image, sx, sy, sw, sw, 0, 0, size, size);
        if (this.fog) {
            ctx.drawImage(this.fog, sx, sy, sw, sw, 0, 0, size, size);
        }
        const dot = (x: number, z: number, color: string, r: number) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(size / 2 + (x - this.px) * scale, size / 2 + (z - this.pz) * scale, r, 0, Math.PI * 2);
            ctx.fill();
        };
        // Only what's been seen: chests and enemies on explored ground, and
        // the way out once it's found
        for (const chest of this.chests) {
            if (chest.opened) {
                continue;
            }
            // The vault, once its key is in hand, wherever it is
            if (chest.vault) {
                if (this.vaultFound || this.isExplored(chest.tile.x, chest.tile.z)) {
                    dot(chest.tile.x, chest.tile.z, "#60e0ff", 3);
                }
            } else if (this.isExplored(chest.tile.x, chest.tile.z)) {
                dot(chest.tile.x, chest.tile.z, chest.boss ? "#ffd700" : "#ff6a00", 2.5);
            }
        }
        for (const exit of this.exits) {
            if (exit.found) {
                dot(exit.x, exit.z, "#00ff00", 3);
            }
        }
        // Your gravestone, always: you know where you fell
        if (this.grave && this.grave.items.length > 0) {
            dot(this.grave.x, this.grave.z, "#b8b0ff", 3);
        }
        if (this.trader && this.isExplored(this.trader.x, this.trader.z)) {
            dot(this.trader.x, this.trader.z, "#40e8ff", 3);
        }
        for (const e of this.enemies) {
            if (e.state !== "dead" && this.isExplored(e.x, e.z)) {
                dot(e.x, e.z, e.def.boss ? "#ff0000" : "#ffff00", e.def.boss ? 4 : 2);
            }
        }
        // The party, wherever they are
        for (const m of this.mates.values()) {
            // Down and waiting for help: red, and bigger, to be found
            if (!m.done) {
                dot(m.x, m.z, m.dead ? "#ff2020" : "#2e8bff", m.dead ? 4 : 3);
            } else if (m.corpse) {
                dot(m.x, m.z, "#9a9a9a", 2);
            }
        }
        if (this.walkDestination) {
            dot(this.walkDestination.x, this.walkDestination.z, "#ffd040", 4);
        }
        if (!this.done) {
            dot(this.px, this.pz, "#ffffff", 3);
        }
        ctx.restore();
    }

    // The whole map, for the full map screen (version 91): its ground in
    // tiles, and where you arrived and are, to open it on
    get mapBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } | undefined {
        if (!this.minimap) {
            return undefined;
        }
        const g = this.region;
        return { minX: g.baseX, maxX: g.baseX + g.sizeX, minZ: -(g.baseY + g.sizeY), maxZ: -g.baseY };
    }

    get mapHere(): { x: number; z: number } {
        const watching = this.done ? this.spectating : undefined;
        return watching ? { x: watching.x, z: watching.z } : { x: this.px, z: this.pz };
    }

    // The full map: the same picture, fog and marks as the minimap, the
    // whole map at any size, centred on a point (scene x and z) at this many
    // pixels a tile, with what's been found named at a size it can be read
    drawFullMap(ctx: CanvasRenderingContext2D, width: number, height: number, centreX: number, centreZ: number, pxPerTile: number): void {
        const mini = this.minimap;
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        if (!mini) {
            ctx.restore();
            return;
        }
        const g = this.region;
        // Scene to screen, and the picture laid on it by the same reckoning
        // the minimap uses (picture x from baseX, y from the map's south edge)
        const sx = (x: number) => width / 2 + (x - centreX) * pxPerTile;
        const sy = (z: number) => height / 2 + (z - centreZ) * pxPerTile;
        const k = pxPerTile / mini.pxPerTile;
        ctx.imageSmoothingEnabled = pxPerTile < mini.pxPerTile * 2;
        ctx.setTransform(k, 0, 0, k, sx(g.baseX), sy(-(g.baseY + g.sizeY)));
        ctx.drawImage(mini.image, 0, 0);
        if (this.fog) {
            // The ground not yet walked shows dimmed here, so the map can be
            // read as a map; what's on it still shows only once it's been
            // seen (the marks below), and the minimap keeps it black
            ctx.globalAlpha = FULL_MAP_FOG;
            ctx.drawImage(this.fog, 0, 0);
            ctx.globalAlpha = 1;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const r = Math.max(3, Math.min(8, pxPerTile * 0.9));
        const dot = (x: number, z: number, color: string, scale = 1, ring = false) => {
            ctx.beginPath();
            ctx.arc(sx(x), sy(z), r * scale, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = ring ? "#ffffff" : "rgba(0, 0, 0, 0.8)";
            ctx.stroke();
        };
        // Where you came in, with the genie: always, it's where you arrived
        dot(g.spawn.x, g.spawn.z, "#ff66cc", 1, true);
        for (const chest of this.chests) {
            if (chest.opened) {
                continue;
            }
            if (chest.vault) {
                if (this.vaultFound || this.isExplored(chest.tile.x, chest.tile.z)) {
                    dot(chest.tile.x, chest.tile.z, "#60e0ff", 1.1);
                }
            } else if (this.isExplored(chest.tile.x, chest.tile.z)) {
                dot(chest.tile.x, chest.tile.z, chest.boss ? "#ffd700" : "#ff6a00", chest.boss ? 1.1 : 0.8);
            }
        }
        for (const exit of this.exits) {
            if (exit.found) {
                dot(exit.x, exit.z, "#00ff00", 1.3, true);
            }
        }
        if (this.grave && this.grave.items.length > 0) {
            dot(this.grave.x, this.grave.z, "#b8b0ff", 1.1);
        }
        if (this.trader && this.isExplored(this.trader.x, this.trader.z)) {
            dot(this.trader.x, this.trader.z, "#40e8ff", 1.1);
        }
        for (const e of this.enemies) {
            if (e.state !== "dead" && this.isExplored(e.x, e.z)) {
                dot(e.x, e.z, e.def.boss ? "#ff0000" : "#ffff00", e.def.boss ? 1.4 : 0.6);
            }
        }
        for (const m of this.mates.values()) {
            if (!m.done) {
                dot(m.x, m.z, m.dead ? "#ff2020" : "#2e8bff", m.dead ? 1.3 : 1.1, true);
            } else if (m.corpse) {
                dot(m.x, m.z, "#9a9a9a", 0.8);
            }
        }
        if (this.walkDestination) {
            dot(this.walkDestination.x, this.walkDestination.z, "#ffd040", 1.1, true);
        }
        if (!this.done) {
            // You, with which way you face
            const x = sx(this.px);
            const y = sy(this.pz);
            ctx.beginPath();
            ctx.moveTo(x + Math.sin(this.facing) * r * 2.2, y + Math.cos(this.facing) * r * 2.2);
            ctx.lineTo(x + Math.sin(this.facing + 2.4) * r * 1.3, y + Math.cos(this.facing + 2.4) * r * 1.3);
            ctx.lineTo(x + Math.sin(this.facing - 2.4) * r * 1.3, y + Math.cos(this.facing - 2.4) * r * 1.3);
            ctx.closePath();
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#000000";
            ctx.stroke();
        }
        ctx.restore();
    }

    // -----------------------------------------------------------------------
    // Building the run

    private groundY(x: number, z: number): number {
        return this.region.heightAt(x, z);
    }

    // Something standing on the map: on its tile's highest corner, so no
    // part of it is under the ground, under the world's light (the night's,
    // on a night run)
    private placeActor(actor: Actor, x: number, z: number, rotation = 0, scale = 1): void {
        actor.root.position.set(x, this.region.topAt(x, z), z);
        actor.root.rotation.y = rotation;
        actor.root.scale.setScalar(scale);
        tint(actor, WHITE);
        this.scene.add(actor.root);
    }

    // The player, their gravestone and their pet; and, unless a co-op host
    // lays the map out for this run (a guest), the map's own things
    private async loadActors(): Promise<void> {
        const jobs: Promise<void>[] = [];

        // The player
        jobs.push(
            PlayerLook.create(this.character, this.equipment).then((look) => {
                this.player = look;
                look.stance = this.stats.weapon?.stance;
                look.root.scale.setScalar(this.character.size);
                look.play("idle");
                this.scene.add(look.root);
            }),
        );
        const crown = crownVerified(crownKey(), () => this.wearCrown());
        if (crown) {
            this.wearCrown();
        }

        // Your gravestone, where you fell last time, with what you carried
        const grave = this.carry.grave;
        if (grave && grave.items.length > 0) {
            jobs.push(
                createActor("locs", 404).then((actor) => {
                    this.placeActor(actor, grave.x, grave.z);
                    addShadow(actor.root, 0.5);
                    this.grave = { actor, x: grave.x, z: grave.z, items: grave.items.map((s) => ({ ...s })) };
                }),
            );
        }

        // The pet, at your heels
        if (this.carry.pet) {
            jobs.push(
                createPet(this.carry.pet).then((actor) => {
                    const x = this.px + 0.8;
                    const z = this.pz + 0.8;
                    actor.root.position.set(x, this.groundY(x, z), z);
                    this.scene.add(actor.root);
                    this.pet = { actor, x, z, facing: 0, stuck: 0 };
                }),
            );
        }

        if (this.coop?.role !== "guest") {
            this.loadLayout(jobs);
        }
        await Promise.all(jobs);

        // One of the champions has the vault's key
        if (this.coop?.role !== "guest") {
            const champions = this.enemies.filter((e) => e.def.champion);
            if (champions.length > 0) {
                champions[Math.floor(this.rng() * champions.length)].key = true;
            }
        }
    }

    // The map's things: the way out, the trader, the vault, the chests, the
    // enemies and the boss, scattered by the run's rng
    private loadLayout(jobs: Promise<void>[]): void {
        const region = this.region;
        const reach = region.flowField({ x: this.px, z: this.pz });
        const taken = new Set<number>();

        // The ways out: each somewhere a good walk from where you arrived,
        // to find (the minimap shows one green once it's near), and spread
        // out from each other, a third of the map apart where the ground
        // allows, closer where it doesn't
        const spread = Math.max(region.sizeX, region.sizeY) * EXIT_SPREAD_SHARE;
        for (let i = 0; i < EXIT_COUNT; i++) {
            let tile: Tile | undefined;
            for (let apart = spread; !tile && apart >= 1; apart /= 2) {
                for (let tries = 0; tries < 8 && !tile; tries++) {
                    const t = this.flatTile(reach, 30, taken) ?? this.flatTile(reach, 15, taken);
                    if (t && this.exits.every((e) => Math.hypot(e.x - t.x, e.z - t.z) >= apart)) {
                        tile = t;
                    }
                }
            }
            if (!tile) {
                if (i > 0) {
                    break;
                }
                tile = { x: this.px, z: this.pz };
            }
            const exit: Exit = { x: tile.x, z: tile.z, found: false };
            this.exits.push(exit);
            jobs.push(createActor("locs", EXIT_LOC).then((a) => this.placeExit(a, exit)));
        }

        // The genie, two tiles from where you arrived, facing the spot
        const ferryTile = this.nearTile({ x: this.px, z: this.pz }, taken, reach);
        if (ferryTile) {
            const rotation = Math.atan2(this.px - ferryTile.x, this.pz - ferryTile.z);
            this.ferry = { x: ferryTile.x, z: ferryTile.z, rotation };
            jobs.push(this.loadFerry());
        }

        // The wandering trader, somewhere a walk off, facing whichever way
        const traderTile = this.flatTile(reach, 15, taken);
        if (traderTile) {
            const rotation = this.rng() * Math.PI * 2;
            this.trader = { x: traderTile.x, z: traderTile.z, rotation, seen: false };
            jobs.push(this.loadTrader());
        }

        // The vault: a crystal chest a walk off, locked until a champion's
        // key opens it
        const vaultTile = this.flatTile(reach, 20, taken);
        if (vaultTile) {
            const chest: Chest = { tile: vaultTile, opened: false, boss: false, vault: true };
            this.chests.push(chest);
            jobs.push(this.loadChest(chest));
        }

        // Chests, one by the boss and the rest about the map
        const bossTile = this.bossTile(reach, taken);
        const chestTiles: { tile: Tile; boss: boolean }[] = [];
        if (bossTile) {
            const near = this.flatTile(reach, 6, taken);
            chestTiles.push({ tile: this.nearTile(bossTile, taken, reach) ?? near ?? bossTile, boss: true });
        }
        // The counts are a full map's worth; a one square map gets its share
        // of them, by open ground, and never under half
        const share = Math.min(1.2, Math.max(0.5, region.openTiles / 12000));
        // Chests go by the ground that can be walked to as well (version
        // 77): the share's cap had left the widest maps (the Wilderness,
        // Lumbridge, the desert) with a third of the chests a smaller map has
        // for its ground. Never fewer than before.
        // The hillsides run over since version 109 aren't more ground for
        // chests and enemies: the maps keep the counts they had
        let reachable = 0;
        for (let i = 0; i < reach.length; i++) {
            if (reach[i] >= 0 && !region.isHill(i)) {
                reachable++;
            }
        }
        const chestCount = Math.round(this.world.chests * Math.max(share, reachable / CHEST_FULL_REACH));
        // Each one as far from the others as a few tries can find, so they
        // spread over the map instead of bunching
        const placed: Tile[] = chestTiles.map((c) => c.tile);
        if (vaultTile) {
            placed.push(vaultTile);
        }
        for (let i = 0; i < chestCount; i++) {
            const tile = this.spreadTile(reach, 10, taken, placed);
            if (tile) {
                chestTiles.push({ tile, boss: false });
                placed.push(tile);
            }
        }
        for (const chest of chestTiles) {
            // Some chests aren't what they seem, and some are watched
            const mimic = !chest.boss && this.rng() < 1 / MIMIC_ONE_IN;
            const ambush = !chest.boss && !mimic && this.rng() < AMBUSH_CHANCE;
            const made: Chest = { tile: chest.tile, opened: false, boss: chest.boss, mimic, ambush };
            this.chests.push(made);
            jobs.push(this.loadChest(made));
        }

        // Enemies everywhere but near the spawn, now and then a champion,
        // and the boss far off
        const totalWeight = this.world.enemies.reduce((n, e) => n + e.weight, 0);
        // By the ground that can be walked to (version 78), so every map is
        // about as crowded as the middling ones; the open-ground share had
        // left the Wilderness at under a fifth of God Wars' crowd. A floor
        // so a small map still has a fight, a ceiling for phones.
        const enemyCount = Math.min(ENEMY_MAX, Math.max(ENEMY_MIN, Math.round((this.world.enemyCount * reachable) / ENEMY_FULL_REACH)));
        // There's always at least one champion: somebody has to carry the
        // vault's key
        let anyChampion: boolean = false;
        for (let i = 0; i < enemyCount; i++) {
            let roll = this.rng() * totalWeight;
            let def = this.world.enemies[0].def;
            for (const e of this.world.enemies) {
                roll -= e.weight;
                if (roll <= 0) {
                    def = e.def;
                    break;
                }
            }
            const tile = region.randomTile(this.rng, reach, 8, taken);
            if (tile) {
                const champion: boolean = this.rng() < CHAMPION_CHANCE || (i === enemyCount - 1 && !anyChampion);
                anyChampion = anyChampion || champion;
                // Some of the walkers patrol a round instead of standing
                const route =
                    !champion && !def.shoots && this.rng() < PATROL_CHANCE ? this.patrolRoute(tile, reach) : undefined;
                // Now and then an elite, with a trait of its own
                const traits = Object.keys(TRAITS) as Trait[];
                const trait = !champion && this.rng() < 1 / ELITE_ONE_IN ? traits[Math.floor(this.rng() * traits.length)] : undefined;
                jobs.push(
                    this.spawnEnemy(champion ? this.champion(def) : def, tile, trait).then((e) => {
                        e.route = route;
                    }),
                );
                // On the hardest maps champions come in pairs
                if (champion && this.world.tier >= 4) {
                    const second = this.nearTile(tile, taken, reach);
                    if (second) {
                        jobs.push(this.spawnEnemy(this.champion(def), second).then(() => undefined));
                    }
                }
            }
        }
        if (bossTile) {
            jobs.push(this.spawnEnemy(this.world.boss, bossTile).then(() => undefined));
        }
    }

    // A chest's model on its tile (gilded for the boss's; the crystal chest
    // for the vault), unless it's been opened while the model loaded
    private loadChest(chest: Chest): Promise<void> {
        return createActor("locs", chest.vault ? VAULT_LOC : 75).then((actor) => {
            if (chest.opened || this.ended) {
                return;
            }
            this.placeActor(actor, chest.tile.x, chest.tile.z, Math.PI);
            addShadow(actor.root, 0.7);
            if (chest.boss) {
                tint(actor, new THREE.Color(1.2, 1.1, 0.7));
            }
            chest.actor = actor;
        });
    }

    // A portal out, swirling from the moment it's there
    private placeExit(actor: Actor, exit: Exit): void {
        exit.actor = actor;
        this.placeActor(actor, exit.x, exit.z);
        play(actor, "play");
    }

    // The way out nearest the player
    private nearestExit(): Exit | undefined {
        let best: Exit | undefined;
        let bestDistance = Infinity;
        for (const exit of this.exits) {
            const distance = Math.hypot(exit.x - this.px, exit.z - this.pz);
            if (distance < bestDistance) {
                best = exit;
                bestDistance = distance;
            }
        }
        return best;
    }

    // The boss has fallen: the nearest way out is told
    private revealNearestExit(): void {
        const exit = this.nearestExit();
        if (exit) {
            exit.found = true;
        }
    }

    private loadTrader(): Promise<void> {
        const trader = this.trader!;
        return createActor("npcs", TRADER_NPC).then((actor) => {
            this.placeActor(actor, trader.x, trader.z, trader.rotation);
            play(actor, "idle");
            addShadow(actor.root, 0.45);
            trader.actor = actor;
        });
    }

    private loadFerry(): Promise<void> {
        const ferry = this.ferry!;
        return createActor("npcs", FERRY_NPC).then((actor) => {
            this.placeActor(actor, ferry.x, ferry.z, ferry.rotation);
            play(actor, "idle");
            addShadow(actor.root, 0.45);
            ferry.actor = actor;
        });
    }

    // What the genie asks for a wish out of this map
    ferryFee(): number {
        return ferryFee(this.world.tier);
    }

    // A patrol's round: where it stands and up to two more open tiles a few
    // off, each in plain sight of the last so the walk between is clear
    private patrolRoute(tile: Tile, reach: Int16Array): Tile[] | undefined {
        const route: Tile[] = [tile];
        for (let i = 0; i < 2; i++) {
            const from = route[route.length - 1];
            for (let tries = 0; tries < 8; tries++) {
                const x = Math.floor(tile.x + randInt(this.rng, -PATROL_REACH, PATROL_REACH)) + 0.5;
                const z = Math.floor(tile.z + randInt(this.rng, -PATROL_REACH, PATROL_REACH)) + 0.5;
                if (
                    Math.hypot(x - from.x, z - from.z) >= 3 &&
                    this.region.flowAt(reach, x, z) >= 0 &&
                    this.region.fits(x, z, 0.3) &&
                    this.region.lineOfSight(from.x, from.z, x, z)
                ) {
                    route.push({ x, z });
                    break;
                }
            }
        }
        return route.length > 1 ? route : undefined;
    }

    // An enemy of the map's own, standing here: the host tells the guests
    // once the map's gone out (before that it goes with the map)
    private async spawnEnemy(def: EnemyDef, tile: Tile, trait?: Trait): Promise<Enemy> {
        const enemy = await this.makeEnemy(def, tile.x, tile.z, this.rng() * Math.PI * 2, trait, this.nextUid++);
        if (this.coop?.role === "host" && this.worldSent) {
            this.coop.send(this.spawnMessage(enemy));
        }
        return enemy;
    }

    private async makeEnemy(def: EnemyDef, x: number, z: number, facing: number, trait: Trait | undefined, uid: number): Promise<Enemy> {
        const actor = await createActor("npcs", def.npcId);
        const tile = { x, z };
        actor.root.position.set(tile.x, this.groundY(tile.x, tile.z), tile.z);
        actor.root.rotation.y = facing;
        actor.root.scale.setScalar(def.scale ?? 1);
        // A shadow its footprint wide, whatever the model's scale
        addShadow(actor.root, (def.radius * 1.4) / (def.scale ?? 1));
        this.scene.add(actor.root);
        play(actor, "idle");
        // Champions are gilded; an elite wears its trait's colour
        const colour = def.champion ? new THREE.Color(1.35, 1.1, 0.7) : trait ? TRAITS[trait].tint.clone() : new THREE.Color(1, 1, 1);
        tint(actor, colour);
        // The boss has the bar at the top of the screen instead
        const bar = def.boss ? undefined : this.makeHealthBar();
        if (bar) {
            this.scene.add(bar.group);
        }
        const enemy: Enemy = {
            def,
            actor,
            x: tile.x,
            z: tile.z,
            facing: actor.root.rotation.y,
            hp: def.hp,
            bar,
            barShown: 0,
            state: "idle",
            cooldown: 0,
            interval: def.attackInterval,
            hitIn: -1,
            deadFor: 0,
            flash: 0,
            tint: colour,
            slamIn: SLAM_SECONDS,
            floorIn: FLOOR_SECONDS,
            slow: 0,
            frozen: 0,
            weak: 0,
            weakLeft: 0,
            poisonHit: 0,
            poisonLeft: 0,
            poisonNext: 0,
            routeAt: 0,
            stuck: 0,
            trait,
            // Every other one goes left
            flank: this.enemies.length % 2 === 0 ? 1 : -1,
            lastHurtAt: 0,
            fleeLeft: 0,
            noIdleUntil: 0,
            uid,
            attacks: 0,
            sentX: NaN,
            sentZ: NaN,
            sentClip: CLIP_IDLE,
            sentState: "",
            sentHp: -1,
            tintCode: 0,
            myHitAt: -10,
            homeX: x,
            homeZ: z,
            gaveUpAt: -10,
            targetX: x,
            targetZ: z,
            targetFacing: facing,
            seenAttacks: 0,
        };
        this.enemies.push(enemy);
        return enemy;
    }

    // The def's place in the table the guests get (party.ts); a new one
    // after the map's gone out travels with the spawn
    private defCode(def: EnemyDef): number {
        let code = this.defIndex.get(def);
        if (code === undefined) {
            code = this.defs.length;
            this.defIndex.set(def, code);
            this.defs.push({
                npc: def.npcId,
                name: def.name,
                hp: def.hp,
                radius: def.radius,
                scale: def.scale,
                boss: def.boss ? 1 : undefined,
                champion: def.champion ? 1 : undefined,
                shoots: def.shoots?.style,
            });
        }
        return code;
    }

    private spawnMessage(e: Enemy): SpawnMessage {
        const known = this.defIndex.has(e.def);
        const d = this.defCode(e.def);
        return {
            k: "spawn",
            u: e.uid,
            d,
            x: round2(e.x),
            z: round2(e.z),
            f: round2(e.facing),
            t: e.trait,
            key: e.key ? 1 : undefined,
            def: known && this.worldSent ? undefined : this.worldSent ? this.defs[d] : undefined,
        };
    }

    // A champion's def: the same enemy, bigger, far tougher, worth more
    private champion(def: EnemyDef): EnemyDef {
        let c = this.champions.get(def);
        if (!c) {
            c = {
                ...def,
                id: `${def.id}:champion`,
                name: `Champion ${def.name.toLowerCase()}`,
                hp: Math.round(def.hp * CHAMPION_HP),
                damage: Math.round(def.damage * CHAMPION_DAMAGE),
                scale: (def.scale ?? 1) * 1.3,
                coins: [def.coins[0] * 4, def.coins[1] * 4],
                champion: true,
            };
            this.champions.set(def, c);
        }
        return c;
    }

    // Where the boss stands: far off, flat, and with room for the fight
    // round it (the first candidate with enough open ground within
    // BOSS_ROOM_RADIUS, else the one with the most)
    private bossTile(reach: Int16Array, taken: Set<number>): Tile | undefined {
        let best: Tile | undefined;
        let bestRoom = -1;
        for (let tries = 0; tries < BOSS_TILE_TRIES; tries++) {
            const tile = this.flatTile(reach, 40, taken) ?? this.flatTile(reach, 20, taken);
            if (!tile) {
                break;
            }
            const room = this.roomAround(tile, BOSS_ROOM_RADIUS);
            if (room > bestRoom) {
                best = tile;
                bestRoom = room;
            }
            if (room >= BOSS_ROOM_TILES) {
                break;
            }
        }
        return best;
    }

    // How many open tiles can be walked to from a tile without leaving a
    // circle this big round it
    roomAround(tile: Tile, radius: number): number {
        const g = this.region;
        const flow = g.flowField(tile);
        let open = 0;
        for (let y = 0; y < g.sizeY; y++) {
            for (let x = 0; x < g.sizeX; x++) {
                if (flow[x + y * g.sizeX] < 0) {
                    continue;
                }
                const wx = g.baseX + x + 0.5;
                const wz = -(g.baseY + y + 0.5);
                if (Math.hypot(wx - tile.x, wz - tile.z) <= radius) {
                    open++;
                }
            }
        }
        return open;
    }

    // A random reachable tile that's flat enough for something to stand on:
    // the first within FLAT_TILE of a few tries, else the flattest of them
    private flatTile(reach: Int16Array, minDistance: number, taken: TileSet): Tile | undefined {
        let best: Tile | undefined;
        let bestRange = Infinity;
        for (let tries = 0; tries < FLAT_TRIES; tries++) {
            const tile = this.region.randomTile(this.rng, reach, minDistance, taken);
            if (!tile) {
                break;
            }
            const range = this.region.cornerRange(tile.x, tile.z);
            if (range < bestRange) {
                best = tile;
                bestRange = range;
            }
            if (range <= FLAT_TILE) {
                break;
            }
        }
        return best;
    }

    // A flat tile as far as can be found from every tile already placed: the
    // best of a few candidates (each of them flat, reachable and free), by
    // its distance to the nearest placed one. Only the one chosen is taken.
    private spreadTile(reach: Int16Array, minDistance: number, taken: Set<number>, placed: Tile[]): Tile | undefined {
        const peek: TileSet = { has: (i) => taken.has(i), add: () => undefined };
        let best: Tile | undefined;
        let bestGap = -1;
        for (let tries = 0; tries < SPREAD_CANDIDATES; tries++) {
            const tile = this.flatTile(reach, minDistance, peek);
            if (!tile) {
                break;
            }
            let gap = Infinity;
            for (const p of placed) {
                gap = Math.min(gap, Math.hypot(p.x - tile.x, p.z - tile.z));
            }
            if (gap > bestGap) {
                best = tile;
                bestGap = gap;
            }
        }
        if (best) {
            const g = this.region;
            taken.add(g.tileX(best.x) - g.baseX + (g.tileY(best.z) - g.baseY) * g.sizeX);
        }
        return best;
    }

    // An open tile next to another, for the boss's chest
    private nearTile(tile: Tile, taken: Set<number>, reach: Int16Array): Tile | undefined {
        for (const [dx, dz] of [
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
            [2, 2],
            [-2, -2],
        ]) {
            const x = tile.x + dx;
            const z = tile.z + dz;
            if (this.region.flowAt(reach, x, z) >= 0) {
                const i = this.region.tileX(x) - this.region.baseX + (this.region.tileY(z) - this.region.baseY) * this.region.sizeX;
                if (!taken.has(i)) {
                    taken.add(i);
                    return { x, z };
                }
            }
        }
        return undefined;
    }

    // -----------------------------------------------------------------------
    // Running

    start(): void {
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        // A pointer, not a mouse: a phone's tap is one straight away, where
        // its mouse event comes late or not at all
        window.addEventListener("pointerdown", this.onMouseDown);
        window.addEventListener("pointermove", this.onPointerMove);
        window.addEventListener("pointerup", this.onPointerUp);
        window.addEventListener("pointercancel", this.onPointerUp);
        window.addEventListener("mousedown", this.onMiddleDown);
        window.addEventListener("wheel", this.onWheel, { passive: true });
        window.addEventListener("resize", this.onResize);
        this.onResize();
        this.clock.start();
        this.reveal();
        playMusic(assetUrl(`assets/music/${this.world.id}.ogg`));
        const coop = this.coop;
        if (coop?.role === "guest") {
            const host = coop.heroes.find((h) => h.id !== coop.me)?.name ?? "the host";
            this.hooks.onMessage(
                `${this.world.name}, with ${host}'s party. Chests are scattered about, the boss guards a golden one; the ways out are to be found. They close in ${Math.round(this.closeSeconds() / 60)} minutes. A genie waits where you arrived: ${this.ferryFee().toLocaleString()} coins buys a wish out.`,
            );
            // The host's map comes once this one's ready for it; the world
            // holds until everyone's loaded
            this.holding = true;
            coop.send({ k: "loaded" } satisfies UpMessage);
        } else {
            this.hooks.onMessage(
                `${this.world.name}. Chests are scattered about, the boss guards a golden one. There are ${this.exits.length} ways out, the nearest somewhere to the ${this.exitCompass()}: find one, or the boss will tell you. They close in ${Math.round(this.closeSeconds() / 60)} minutes. A genie waits where you arrived: ${this.ferryFee().toLocaleString()} coins buys a wish out.`,
            );
            if (coop?.role === "host") {
                this.sendWorld();
                for (const id of this.mates.keys()) {
                    this.waitingFor.add(id);
                }
                this.holding = this.waitingFor.size > 0;
            }
        }
        if (this.night) {
            this.hooks.onMessage("Night has fallen. You see less, and so do they.");
        }
        // A clue scroll brought in (the daily contract pays one, version 115)
        // names its spot as one picked up here would
        const scrolls = this.inventory.reduce((n, s) => n + (s.id === CLUE_SCROLL ? s.count : 0), 0);
        for (let i = 0; i < scrolls; i++) {
            this.setClue();
        }
        const loop = () => {
            this.frame = requestAnimationFrame(loop);
            const dt = Math.min(0.05, this.clock.getDelta());
            if (this.holding) {
                this.updateHold(dt);
            } else if (!this.paused) {
                this.update(dt);
            }
            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }

    // Paused, the world stands as it is; keys held down are let go of, so
    // nothing carries on by itself when it resumes. In co-op the world
    // doesn't wait: a menu over the run only takes the controls.
    setPaused(paused: boolean): void {
        if (this.ended) {
            return;
        }
        if (this.coop) {
            this.menuOpen = paused;
        } else {
            if (this.paused === paused) {
                return;
            }
            this.paused = paused;
        }
        this.keys.clear();
        if (paused) this.cancelWalk();
        this.fingers.clear();
        this.turnPointer = undefined;
        this.pinchFrom = undefined;
        this.wantAttack = false;
        this.attackAsked = 0;
        this.stick.x = 0;
        this.stick.z = 0;
        this.releaseControllerInput();
        this.touchAttack = false;
        this.aimInput.x = 0;
        this.aimInput.z = 0;
        if (!paused) {
            // The time spent paused isn't a frame
            this.clock.getDelta();
        }
    }

    private menuOpen = false;

    // Out of the run from the pause menu, leaving everything carried behind
    // (nothing, if this player's part is already over)
    leave(): void {
        if (this.done) {
            this.end(this.done);
            return;
        }
        if (this.coop?.role === "guest") {
            this.coop.send({ k: "gone", how: "left" } satisfies UpMessage);
        }
        this.end("left");
    }

    // Which way the nearest way out lies from the player, as a compass point
    private exitCompass(): string {
        const exit = this.nearestExit();
        return exit ? this.compassTo(exit.x, exit.z) : "north";
    }

    // Which way somewhere lies from the player, as a compass point
    private compassTo(x: number, z: number): string {
        // North is up the map, which is -z here
        const angle = Math.atan2(x - this.px, -(z - this.pz));
        const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
        return names[((Math.round((angle / (Math.PI * 2)) * 8) % 8) + 8) % 8];
    }

    // The same with the distance
    private exitDirection(): string {
        const exit = this.nearestExit();
        if (!exit) {
            return "where you came in";
        }
        return `${Math.round(Math.hypot(exit.x - this.px, exit.z - this.pz))} tiles to the ${this.exitCompass()}`;
    }

    // How long until the way out closes (the host's word, on a guest)
    get timeLeft(): number {
        if (this.coop?.role === "guest") {
            return Math.max(0, this.hostLeft);
        }
        return Math.max(0, this.closeSeconds() - this.time);
    }

    // When the way out closes: CLOSE_SECONDS for a 128 tile map, longer by
    // the square root of the area for a bigger one
    private closeSeconds(): number {
        const area = this.region.sizeX * this.region.sizeY;
        return Math.round((CLOSE_SECONDS * Math.sqrt(area / (CLOSE_SECONDS_SIDE * CLOSE_SECONDS_SIDE))) / 30) * 30;
    }

    // Whether this player's part of the run is over while the party plays
    // on, and who they're watching
    get spectatingName(): string | undefined {
        return this.done ? (this.spectating?.name ?? undefined) : undefined;
    }

    get isDone(): boolean {
        return this.done !== undefined;
    }

    // Everyone in the party, for the HUD: this player first
    party(): PartyMember[] {
        const list: PartyMember[] = [
            {
                id: this.self.id,
                name: this.self.name,
                hp: this.hp,
                maxHp: this.maxHp,
                dead: this.dead,
                done: this.done !== undefined,
                me: true,
                color: nameColorOf(this.character, crownKey()),
            },
        ];
        for (const m of this.mates.values()) {
            list.push({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, dead: m.dead, done: m.done, me: false, color: m.nameColor });
        }
        return list;
    }

    // How many slots the pack has, with the guild's upgrade
    get slots(): number {
        return this.packSize;
    }

    // How much the gear in the pack slows you, 0 to WEIGHT_MAX
    weight(): number {
        let pieces = 0;
        for (const stack of this.inventory) {
            if (getItem(stack.id).slot) {
                pieces++;
            }
        }
        return Math.min(WEIGHT_MAX, pieces * WEIGHT_PER_PIECE);
    }

    // Tiles a second, with the pack's weight (and a pet's long strides)
    speed(): number {
        return PLAYER_SPEED * (1 - this.weight()) * (1 + (this.petBuff?.speed ?? 0));
    }

    // How many of a thing the pack holds
    readonly count = (id: number): number => countOf(this.inventory, id);

    // The runes the staff and shield in hand give for nothing (spells.ts)
    runesGiven(): Set<number> {
        return runesGiven(this.equipment.weapon, this.equipment.shield);
    }

    // Whether Ahrim's staff casts Ancient Magicks: with all of Ahrim's set and
    // the amulet of the damned, as in OSRS (version 110)
    ahrimCasts(): boolean {
        return this.stats.set === "ahrim" && this.equipment.neck === AMULET_OF_THE_DAMNED;
    }

    // The spell a staff casts now (version 106): the one picked to
    // autocast, or, none picked, the strongest it can with the runes packed;
    // or why it can't cast
    castingSpell(): { spell?: SpellDef; why?: string } {
        const weapon = this.stats.weapon;
        if (weapon?.uses !== "runes") {
            return {};
        }
        const given = this.runesGiven();
        const ahrim = this.ahrimCasts();
        // A powered staff casts its own spell, whatever's picked (version 110)
        const powered = poweredSpell(weapon);
        if (powered) {
            return castsLeft(powered, given, this.count) > 0 ? { spell: powered } : { why: `You don't have the runes to charge your ${weapon.name.toLowerCase()}.` };
        }
        const picked = this.autocast ? SPELL_BY_ID.get(this.autocast) : undefined;
        const ancientsBarred = `Your ${weapon.name.toLowerCase()} can't cast Ancient Magicks${weapon.id === AHRIMS_STAFF ? " without the rest of Ahrim's set and the amulet of the damned" : ""}.`;
        if (picked?.book === "staff" && !staffCasts(weapon, picked, ahrim)) {
            return { why: `Only certain staves cast ${picked.name}: not your ${weapon.name.toLowerCase()}.` };
        }
        if (picked) {
            if (picked.book === "ancient" && !castsAncients(weapon, ahrim)) {
                return { why: ancientsBarred };
            }
            if (!staffCasts(weapon, picked, ahrim)) {
                return { why: `Your ${weapon.name.toLowerCase()} can't cast ${picked.name}: it takes a tier ${picked.tier} staff.` };
            }
            if (castsLeft(picked, given, this.count) <= 0) {
                return { why: `You don't have the runes for ${picked.name}.` };
            }
            return { spell: picked };
        }
        if (this.spellbook === "ancient" && !castsAncients(weapon, ahrim)) {
            return { why: ancientsBarred };
        }
        const best = bestSpell(weapon, given, this.count, this.spellbook, ahrim);
        return best ? { spell: best } : { why: "You don't have the runes for any spell your staff can cast." };
    }

    // The ammunition the weapon in hand shoots, if it's in the pack: the
    // best kind there (a staff's runes are the spell's to take: castingSpell)
    ammo(): ItemStack | undefined {
        const uses = this.stats.weapon?.uses;
        if (!uses) {
            return undefined;
        }
        let best: ItemStack | undefined;
        for (const stack of this.inventory) {
            const item = getItem(stack.id);
            if (item.ammo === uses && (!best || (item.power ?? 0) > (getItem(best.id).power ?? 0))) {
                best = stack;
            }
        }
        return best;
    }

    // The map wakes after a while, and the way out closes after longer, with
    // warnings before it does
    private updateClock(): void {
        // A guest's clock is the host's, from the snapshots
        if (this.coop?.role === "guest") {
            return;
        }
        if (!this.awake && this.time >= WAKE_SECONDS) {
            this.awake = true;
            this.announce("The map wakes. Everything here knows you're about now, and nothing heals on its own.");
        }
        const left = this.closeSeconds() - this.time;
        for (const warn of [120, 60, 30]) {
            if (left <= warn && !this.warned.has(warn)) {
                this.warned.add(warn);
                this.announce(
                    warn >= 60 ? `The ways out close in ${warn / 60} minute${warn > 60 ? "s" : ""}.` : "The ways out close in thirty seconds!",
                );
            }
        }
        if (!this.closed && left <= 0) {
            this.closed = true;
            this.announce("The ways out have closed. There's no leaving with the loot now.");
        }
    }

    // A sound from somewhere on the map, as loud as it's near: full within
    // HEAR_NEAR tiles of the player (or whoever they're watching), fading to
    // nothing at HEAR_FAR, so a mate's fight across the map isn't in your ear
    private hear(key: string, x: number, z: number, volume: number): void {
        const at = this.done && this.spectating ? this.spectating : { x: this.px, z: this.pz };
        const dist = Math.hypot(x - at.x, z - at.z);
        const share = dist <= HEAR_NEAR ? 1 : Math.max(0, 1 - (dist - HEAR_NEAR) / (HEAR_FAR - HEAR_NEAR));
        if (share > 0.02) {
            playSound(key, volume * share);
        }
    }

    // A word for everyone in the party (and this player), or for one hero
    private announce(text: string): void {
        this.hooks.onMessage(text);
        if (this.coop?.role === "host") {
            this.coop.send({ k: "msg", text } satisfies DownMessage);
        }
    }

    private tell(hero: Hero, text: string): void {
        if (hero.me) {
            this.hooks.onMessage(text);
        } else if (this.coop?.role === "host") {
            this.coop.send({ k: "msg", text, to: hero.id } satisfies DownMessage);
        }
    }

    // Everything idle this close comes running; how many did
    private wakeNear(x: number, z: number, radius: number): number {
        let woke = 0;
        for (const e of this.enemies) {
            if (e.state === "idle" && !e.def.passive && Math.hypot(e.x - x, e.z - z) < radius) {
                e.state = "chase";
                woke++;
            }
        }
        return woke;
    }

    // Where the vault lies from the player
    private vaultDirection(): string {
        const vault = this.chests.find((c) => c.vault);
        if (!vault) {
            return "nowhere to be found";
        }
        return `${Math.round(Math.hypot(vault.tile.x - this.px, vault.tile.z - this.pz))} tiles to the ${this.compassTo(vault.tile.x, vault.tile.z)}`;
    }

    // Sets an enemy after the player, and its idle neighbours with it: a
    // fight is noise. An elite is called out the first time.
    private rouse(e: Enemy): void {
        if (e.state !== "idle") {
            return;
        }
        e.state = "chase";
        e.lastHurtAt = this.time;
        this.notice(e);
        for (const o of this.enemies) {
            if (o.state === "idle" && !o.def.passive && Math.hypot(o.x - e.x, o.z - e.z) < ROUSE_SPREAD) {
                o.state = "chase";
                o.lastHurtAt = this.time;
                this.notice(o);
            }
        }
    }

    private notice(e: Enemy): void {
        if (e.trait && !e.noticed) {
            e.noticed = true;
            this.tell(e.target ?? this.self, `A ${e.trait} ${e.def.name.toLowerCase()} comes at you: ${TRAITS[e.trait].what}.`);
        }
    }

    setZoom(zoom: number): void {
        this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    }

    get controlsEnabled(): boolean {
        return !this.paused && !this.menuOpen && !this.dead && !this.done && !this.ended;
    }

    setControllerMove(x: number, z: number): void {
        const length = Math.hypot(x, z);
        if (!this.controlsEnabled || !Number.isFinite(length)) {
            this.controllerStick.x = this.controllerStick.z = 0;
            return;
        }
        this.controllerStick.x = x / Math.max(1, length);
        this.controllerStick.z = z / Math.max(1, length);
        if (length > 0) this.cancelWalk();
    }

    setControllerInteract(down: boolean): void {
        this.controllerInteract = down && this.controlsEnabled;
        if (this.controllerInteract) this.cancelWalk();
    }

    requestAttack(down = true): void {
        this.controllerAttack = down && this.controlsEnabled;
    }

    setTouchAttack(down: boolean): void {
        this.touchAttack = down && this.controlsEnabled;
    }

    releaseControllerInput(): void {
        this.controllerStick.x = this.controllerStick.z = 0;
        this.controllerInteract = false;
        this.controllerAttack = false;
    }

    orbitCamera(dx: number, dy: number): void {
        if (this.controlsEnabled && Number.isFinite(dx) && Number.isFinite(dy)) this.dragCamera(dx, dy);
    }

    resetCamera(): void {
        this.cameraYaw = 0;
        this.cameraPitch = BASE_PITCH;
    }

    // The right touch stick aims in screen directions. A swing still faces
    // its selected target and uses the same range, cooldown and hit rules.
    aimDirection(x: number, z: number): void {
        if (!this.controlsEnabled || !Number.isFinite(x) || !Number.isFinite(z)) {
            this.aimInput.x = this.aimInput.z = 0;
            return;
        }
        this.aimInput.x = x;
        this.aimInput.z = z;
    }

    // A key pressed or let go of by a touch screen's button
    press(code: string, down: boolean): void {
        if (this.paused || this.menuOpen || this.done) {
            return;
        }
        if (down) {
            if (this.isWalkKey(code) || code === "KeyE") this.cancelWalk();
            this.keys.add(code);
            if (code === "Space") {
                this.wantAttack = true;
            }
        } else {
            this.keys.delete(code);
        }
    }

    stop(): void {
        this.cancelWalk();
        this.releaseControllerInput();
        this.touchAttack = false;
        if (this.frame !== undefined) {
            cancelAnimationFrame(this.frame);
        }
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("pointerdown", this.onMouseDown);
        window.removeEventListener("pointermove", this.onPointerMove);
        window.removeEventListener("pointerup", this.onPointerUp);
        window.removeEventListener("pointercancel", this.onPointerUp);
        window.removeEventListener("mousedown", this.onMiddleDown);
        window.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("resize", this.onResize);
        // No more of the map, and its colours back, for the menu and the
        // next run
        this.mapLoad?.cancel();
        this.overhead?.remove();
        for (const { material, color } of this.nightMaterials) {
            material.color.copy(color);
        }
        this.nightMaterials = [];
        setWorldLight(DAY_LIGHT);
        torchesOut();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    private onResize = (): void => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    };

    private onKeyDown = (e: KeyboardEvent): void => {
        if ((e.target as HTMLElement).tagName === "INPUT" || this.paused || this.menuOpen || this.done) {
            return;
        }
        if (this.isWalkKey(e.code) || e.code === "KeyE") this.cancelWalk();
        this.keys.add(e.code);
        if (e.code === "Space") {
            this.wantAttack = true;
            e.preventDefault();
        }
        // Hotkeys: F eats, 1 to 4 drink, Q spends the special, Z X C protect
        if (e.code === "KeyF") {
            this.eatHotkey();
        } else if (e.code === "KeyQ") {
            this.useSpecial();
        } else if (e.code === "KeyZ") {
            this.setProtect("melee");
        } else if (e.code === "KeyX") {
            this.setProtect("ranged");
        } else if (e.code === "KeyC") {
            this.setProtect("magic");
        } else if (e.code === "Digit1") {
            this.drinkKind("strength");
        } else if (e.code === "Digit2") {
            this.drinkKind("defence");
        } else if (e.code === "Digit3") {
            this.drinkKind("brew");
        } else if (e.code === "Digit4") {
            this.drinkKind("prayer");
        }
    };

    private onKeyUp = (e: KeyboardEvent): void => {
        this.keys.delete(e.code);
    };

    private onMouseDown = (e: PointerEvent): void => {
        const onWorld = e.target === this.renderer.domElement;
        if (!onWorld || this.paused || this.menuOpen || this.done || this.dead) return;
        // A tap walks when released; dragging and pinching only move the
        // camera, so rotating a touch view never starts an accidental route.
        if (e.pointerType === "touch") {
            this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, fromX: e.clientX, fromY: e.clientY, dragged: false });
            if (this.fingers.size > 1) {
                for (const f of this.fingers.values()) {
                    f.dragged = true;
                }
                this.pinchFrom = this.fingerSpread();
            }
            return;
        }
        if (e.button === 1 && onWorld) {
            e.preventDefault();
            this.turnPointer = e.pointerId;
            this.turnX = e.clientX;
            this.turnY = e.clientY;
            // Its moves and its letting go still come once it's off the page
            try {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
                // Not a live pointer
            }
            return;
        }
        if (e.button === 0) {
            this.clickWorld(e.clientX, e.clientY);
        }
    };

    private isWalkKey(code: string): boolean {
        return ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code);
    }

    // Public so an interface (for example, a minimap) can use the same route.
    walkTo(x: number, z: number): boolean {
        return this.planWalk(x, z, false);
    }

    // The map is paused while choosing a route. Queue it now, and it starts
    // only when the interface resumes the run. Fogged destinations stay shut.
    walkToMap(x: number, z: number): boolean {
        if (!this.isDiscovered(x, z)) return false;
        if (!this.planWalk(x, z, true)) return false;
        const destination = this.walkDestination!;
        if (!this.isDiscovered(destination.x, destination.z)) {
            this.cancelWalk();
            return false;
        }
        return true;
    }

    private planWalk(x: number, z: number, fromMap: boolean): boolean {
        if ((!fromMap && (this.paused || this.menuOpen)) || this.done || this.dead || this.extracting > 0 || !Number.isFinite(x) || !Number.isFinite(z)) return false;
        this.cancelWalk();
        this.walkPath = findWalkPath(this.region, { x: this.px, z: this.pz }, { x, z }, COLLISION_RADIUS);
        const destination = this.walkDestination;
        if (!destination) return false;
        if (!this.walkMarker) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-0.22, 0, -0.22), new THREE.Vector3(0.22, 0, 0.22),
                new THREE.Vector3(-0.22, 0, 0.22), new THREE.Vector3(0.22, 0, -0.22),
            ]);
            const material = new THREE.LineBasicMaterial({ color: 0xffd040, depthTest: false });
            this.disposables.push(geometry, material);
            this.walkMarker = new THREE.LineSegments(geometry, material);
            this.walkMarker.renderOrder = 10;
            this.scene.add(this.walkMarker);
        }
        this.walkMarker.position.set(destination.x, this.groundY(destination.x, destination.z) + 0.06, destination.z);
        this.walkMarker.visible = true;
        return true;
    }

    get walkDestination(): Readonly<Tile> | undefined {
        return this.walkPath[this.walkPath.length - 1];
    }

    cancelWalk(): void {
        this.walkPath = [];
        this.walkStuckFor = 0;
        if (this.walkMarker) this.walkMarker.visible = false;
    }

    private clickWorld(clientX: number, clientY: number): void {
        if (this.paused || this.menuOpen || this.done || this.dead) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.camera.updateMatrixWorld();
        this.worldRay.setFromCamera(new THREE.Vector2(
            (clientX - rect.left) / rect.width * 2 - 1,
            1 - (clientY - rect.top) / rect.height * 2,
        ), this.camera);
        const visible = (object: THREE.Object3D): boolean => {
            for (let part: THREE.Object3D | null = object; part; part = part.parent) {
                if (!part.visible) return false;
            }
            return true;
        };
        const terrain = this.map && this.worldRay.intersectObject(this.map, true).find((hit) => visible(hit.object));
        const actors = this.enemies.filter((enemy) => enemy.state !== "dead").map((enemy) => enemy.actor.root);
        const enemy = this.worldRay.intersectObjects(actors, true).find((hit) => visible(hit.object));
        if (enemy && (!terrain || enemy.distance < terrain.distance + 0.05)) {
            // Keep a deliberate swing at passive enemies. The existing combat
            // code still decides range, line of sight and the swing's target.
            this.cancelWalk();
            this.wantAttack = true;
        } else if (terrain) {
            this.walkTo(terrain.point.x, terrain.point.z);
        }
    }

    // The browser's own middle-button scrolling stays off the world
    private onMiddleDown = (e: MouseEvent): void => {
        if (e.button === 1 && e.target === this.renderer.domElement) {
            e.preventDefault();
        }
    };

    // A drag turns the camera round you and tilts it, OSRS's way: across
    // turns it, up and down tilts it, as if the world were held and moved.
    // The middle button drags on a desktop, one finger on the world on a
    // touch screen; two fingers there pinch it in and out.
    private onPointerMove = (e: PointerEvent): void => {
        if (e.pointerId === this.turnPointer) {
            this.dragCamera(e.clientX - this.turnX, e.clientY - this.turnY);
            this.turnX = e.clientX;
            this.turnY = e.clientY;
            return;
        }
        const finger = this.fingers.get(e.pointerId);
        if (!finger) {
            return;
        }
        const dx = e.clientX - finger.x;
        const dy = e.clientY - finger.y;
        finger.x = e.clientX;
        finger.y = e.clientY;
        if (this.fingers.size > 1) {
            const spread = this.fingerSpread();
            if (this.pinchFrom && spread) {
                this.setZoom(this.zoom * (this.pinchFrom / spread));
            }
            this.pinchFrom = spread;
            return;
        }
        if (!finger.dragged && Math.hypot(e.clientX - finger.fromX, e.clientY - finger.fromY) > TAP_SLOP) {
            finger.dragged = true;
        }
        if (finger.dragged) {
            this.dragCamera(dx, dy);
        }
    };

    private onPointerUp = (e: PointerEvent): void => {
        const finger = this.fingers.get(e.pointerId);
        if (finger && !finger.dragged && e.type !== "pointercancel" && Math.hypot(e.clientX - finger.fromX, e.clientY - finger.fromY) <= TAP_SLOP) {
            this.clickWorld(e.clientX, e.clientY);
        }
        if (e.pointerId === this.turnPointer) {
            this.turnPointer = undefined;
        }
        if (this.fingers.delete(e.pointerId) && this.pinchFrom !== undefined && this.fingers.size < 2) {
            // The pinch's distance is kept for the next run, like the wheel's
            this.pinchFrom = undefined;
            settings.zoom = this.zoom;
            saveSettings();
        }
    };

    private dragCamera(dx: number, dy: number): void {
        this.cameraYaw -= dx * TURN_PER_PIXEL;
        this.cameraPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.cameraPitch - dy * TURN_PER_PIXEL));
    }

    // How far apart the first two fingers on the world are
    private fingerSpread(): number | undefined {
        const [a, b] = this.fingers.values();
        return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : undefined;
    }

    // The wheel takes the camera a little in and out, and the next run
    // starts where it's left
    private onWheel = (e: WheelEvent): void => {
        this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * Math.exp(e.deltaY * 0.0008)));
        settings.zoom = this.zoom;
        saveSettings();
    };

    // This player's part of the run is over: out with the loot, dead, or
    // gone. Alone, that's the run. In a party the others play on, and this
    // one watches them until they're all out too (or leaves from the pause
    // menu); the host's browser keeps running the map for them meanwhile.
    private finishSelf(kind: RunResult["kind"]): void {
        if (this.done || this.ended) {
            return;
        }
        const coop = this.coop;
        if (!coop) {
            this.end(kind);
            return;
        }
        this.done = kind;
        this.self.dead = true;
        if (kind === "extracted") {
            // Gone from the map
            this.scene.remove(this.player.root);
            if (this.crown) {
                this.scene.remove(this.crown);
            }
            if (this.pet) {
                this.scene.remove(this.pet.actor.root);
            }
        }
        if (coop.role === "guest") {
            coop.send({ k: "gone", how: kind } satisfies UpMessage);
        } else {
            coop.send({ k: "gone", id: coop.me, how: kind } satisfies DownMessage);
        }
        if (!this.othersRemain()) {
            this.end(kind);
            return;
        }
        this.hooks.onMessage(
            kind === "extracted"
                ? "You're out. You watch the others until they're out too; Esc, then Leave run, goes back to the guild now."
                : "You watch the others until they're out; Esc, then Leave run, goes back to the guild now.",
        );
    }

    // Whether anyone else in the party is still in the map
    private othersRemain(): boolean {
        for (const m of this.mates.values()) {
            if (!m.done && !m.dead) {
                return true;
            }
        }
        return false;
    }

    // Whether this party splits the coins found (version 115)
    private splitsLoot(): boolean {
        return this.coop?.role === "host" && this.coop.loot === "split";
    }

    // Coins picked up in a party that splits its loot: shared between
    // everyone still in the map (a hero who's down too, who may yet be
    // revived), the odd coins the taker's. Each share is in its owner's
    // purse, theirs to keep only by getting out.
    private shareCoins(takerId: string, count: number): void {
        const coop = this.coop;
        if (!coop) {
            return;
        }
        const ids = [...(this.done ? [] : [coop.me]), ...[...this.mates.values()].filter((m) => !m.done).map((m) => m.id)];
        if (!ids.includes(takerId)) {
            ids.push(takerId);
        }
        const each = Math.floor(count / ids.length);
        const odd = count - each * ids.length;
        const shares: [string, number][] = ids.map((id) => [id, each + (id === takerId ? odd : 0)]);
        const by = coop.heroes.find((h) => h.id === takerId)?.name ?? "Someone";
        coop.send({ k: "share", by, n: count, s: shares } satisfies DownMessage);
        this.takeShare(by, count, shares);
    }

    // This player's share of coins someone found
    private takeShare(by: string, count: number, shares: [string, number][]): void {
        const mine = shares.find(([id]) => id === this.self.id)?.[1] ?? 0;
        if (mine <= 0 || this.done) {
            return;
        }
        this.coins += mine;
        this.coinsFound += mine;
        this.loot.record(COINS, mine);
        this.hooks.onMessage(
            by === this.coop?.heroes.find((h) => h.id === this.self.id)?.name
                ? `You find ${count.toLocaleString()} coins: ${mine.toLocaleString()} of them are your share.`
                : `${by} finds ${count.toLocaleString()} coins: your share is ${mine.toLocaleString()}.`,
        );
        this.hooks.onChanged();
    }

    // A mate's gone or fallen: if this player's only watching, and there's
    // nobody left to watch, that's the run
    private checkPartyDone(): void {
        if (this.done && !this.ended && !this.othersRemain()) {
            this.end(this.done);
        }
    }

    private end(kind: RunResult["kind"]): void {
        if (this.ended) {
            return;
        }
        this.ended = true;
        // The host's run is the party's: over for everyone
        if (this.coop?.role === "host" && !this.partyOver) {
            this.coop.send({ k: "over" } satisfies DownMessage);
        }
        // A clue scroll or a key is no use anywhere else
        if (kind === "extracted") {
            this.inventory = this.inventory.filter((s) => {
                const item = getItem(s.id);
                return !item.clue && !item.key && !item.bossKey;
            });
        }
        this.hooks.onEnd({
            kind,
            carry: { inventory: this.inventory, equipment: this.equipment, coins: this.coins, hp: this.hp, wear: this.wear },
            world: this.world,
            report: {
                seconds: this.time,
                kills: this.kills,
                bossKills: this.bossKills,
                championKills: this.championKills,
                rangedKills: this.rangedKills,
                ate: this.ate,
                packItems: this.inventory.length,
                killer: this.killer,
                map: this.recapMap(240),
                x: this.px,
                z: this.pz,
                graveItems: this.grave?.items,
                graveTaken: this.graveTaken,
                clues: this.clues,
                vaults: this.vaults,
                petFound: this.petFound,
                night: this.night,
                hitsTaken: this.hitsTaken,
                damageTaken: this.damageTaken,
                chestsOpened: this.chestsOpened,
                goldenOpened: this.goldenOpened,
                drank: this.drank,
                specials: this.specials,
                traderBuys: this.traderBuys,
                genie: this.genie,
                secondsLeft: Math.round(this.timeLeft),
                party: 1 + this.mates.size,
                balloons: this.balloonsBurst,
            },
        });
    }

    // Whether the bar has enough for a special
    get specReady(): boolean {
        return this.spec >= SPEC_COST;
    }

    // Protection on or off: the same style again takes it off
    setProtect(style: ProtectStyle): void {
        if (this.dead || this.paused) {
            return;
        }
        if (style === "none" || this.protect === style) {
            this.protect = "none";
            return;
        }
        if (this.prayer <= 0) {
            this.hooks.onMessage("You have no prayer left.");
            return;
        }
        this.protect = style;
        playSound(`sounds/${PRAYER_SOUNDS[style]}`, 0.45);
    }

    // The next protection round: none, melee, ranged, magic (the Pray button)
    cycleProtect(): void {
        const order: ProtectStyle[] = ["none", "melee", "ranged", "magic"];
        const next = order[(order.indexOf(this.protect) + 1) % order.length];
        if (next === "none") {
            this.protect = "none";
        } else {
            this.setProtect(next);
        }
    }

    // How much slower the bar drains and faster it refills for the prayer
    // bonus of what's worn: +30 is twice as slow and twice as fast
    private prayerScale(): number {
        return 1 + Math.max(0, this.stats.prayer) / PRAYER_BONUS_SCALE;
    }

    private updatePrayer(dt: number): void {
        const scale = this.prayerScale();
        if (this.protect !== "none") {
            // Twice as fast with the boss after you
            const bossOnMe = this.enemies.some((e) => e.def.boss && e.state !== "idle" && e.state !== "dead" && e.target === this.self);
            this.prayer = Math.max(0, this.prayer - (PRAYER_DRAIN * (bossOnMe ? BOSS_PRAYER_DRAIN : 1) * dt) / scale);
            if (this.prayer <= 0) {
                this.protect = "none";
                this.hooks.onMessage("Your prayer runs out.");
            }
        } else {
            this.prayer = Math.min(100, this.prayer + PRAYER_REGEN * scale * dt);
        }
    }

    // One of the map's ambient sounds now and then, quietly
    private updateAmbient(dt: number): void {
        this.ambientIn -= dt;
        if (this.ambientIn > 0) {
            return;
        }
        this.ambientIn = 5 + this.rng() * 9;
        const sounds = this.world.ambient;
        if (sounds.length > 0) {
            playSound(`sounds/${sounds[Math.floor(this.rng() * sounds.length)]}`, 0.25);
        }
    }

    // A patch of ground that hurts whoever's on it when its time is up,
    // ringed in red until then (`burst` goes once, as it does). The guests
    // see the ring; the host does the hurting.
    private hazard(x: number, z: number, radius: number, left: number, hit: (hero: Hero) => void, burst?: () => void): void {
        if (!this.slamRing) {
            this.slamRing = new THREE.RingGeometry(0.85, 1, 40);
            this.disposables.push(this.slamRing);
        }
        const ring = new THREE.Mesh(
            this.slamRing,
            new THREE.MeshBasicMaterial({ color: 0xff3000, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.scale.setScalar(radius);
        ring.position.set(x, this.groundY(x, z) + 0.05, z);
        this.scene.add(ring);
        this.hazards.push({ ring, left, x, z, radius, hit, burst });
        if (this.coop?.role === "host") {
            this.coop.send({ k: "hazard", x: round2(x), z: round2(z), r: radius, l: round2(left) } satisfies DownMessage);
        }
    }

    private updateHazards(dt: number): void {
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const h = this.hazards[i];
            h.left -= dt;
            (h.ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.35 * Math.sin(h.left * 25);
            if (h.left <= 0) {
                this.scene.remove(h.ring);
                (h.ring.material as THREE.Material).dispose();
                this.hazards.splice(i, 1);
                h.burst?.();
                for (const hero of this.heroes()) {
                    if (Math.hypot(hero.x - h.x, hero.z - h.z) <= h.radius + PLAYER_RADIUS) {
                        h.hit(hero);
                    }
                }
            }
        }
    }

    // Party balloons: the next lot when it's time (not on a guest: the host
    // sends them), the fall, the bob, a burst for whoever runs into one,
    // and those left too long floating off
    private updateBalloons(dt: number): void {
        const host = this.coop?.role !== "guest";
        const between = (range: [number, number]) => range[0] + this.rng() * (range[1] - range[0]);
        if (host) {
            if (this.balloonsAt < 0) {
                this.balloonsAt = this.time + between(BALLOON_FIRST);
            } else if (this.time >= this.balloonsAt) {
                this.balloonsAt = this.time + between(BALLOON_EVERY);
                this.dropBalloons();
            }
        }
        for (const pop of [...this.popping]) {
            pop.actor.mixer.update(dt);
            pop.left -= dt;
            if (pop.left <= 0) {
                this.scene.remove(pop.actor.root);
                this.popping.splice(this.popping.indexOf(pop), 1);
            }
        }
        const heroes = host ? this.heroes() : [];
        for (const b of [...this.balloons]) {
            b.age += dt;
            if (b.age > BALLOON_LIFE + 3) {
                this.removeBalloon(b);
                continue;
            }
            if (b.actor) {
                b.actor.mixer.update(dt);
                // On the ground itself (not its tile's highest corner, which
                // on a slope is half a tile up) once its fall's played; off
                // up into the sky at the end
                const off = Math.max(0, b.age - BALLOON_LIFE);
                b.actor.root.position.y = this.groundY(b.x, b.z) + off * off * 2;
            }
            if (b.shadow) {
                // Small while it's high, its own size on the ground, gone
                // as it floats off
                const down = Math.min(1, b.age / BALLOON_FALL);
                const off = Math.max(0, 1 - (b.age - BALLOON_LIFE) / 1.5);
                b.shadow.scale.setScalar(BALLOON_SHADOW * (0.35 + 0.65 * down * down) * Math.min(1, off));
            }
            if (!host || b.age < BALLOON_FALL || b.age > BALLOON_LIFE) {
                continue;
            }
            const by = heroes.find((h) => Math.hypot(h.x - b.x, h.z - b.z) < BALLOON_REACH + PLAYER_RADIUS);
            if (by) {
                this.burstBalloon(b, by);
            }
        }
    }

    // A lot of party balloons round someone standing (a solo run's player,
    // or anyone in a party), each on open ground
    private dropBalloons(): void {
        const heroes = this.heroes();
        if (heroes.length === 0) {
            return;
        }
        const hero = heroes[Math.floor(this.rng() * heroes.length)];
        const count = randInt(this.rng, BALLOON_COUNT[0], BALLOON_COUNT[1]);
        const sent: [number, number, number, number][] = [];
        for (let i = 0; i < count; i++) {
            for (let tries = 0; tries < 10; tries++) {
                const angle = this.rng() * Math.PI * 2;
                const dist = BALLOON_SPREAD[0] + this.rng() * (BALLOON_SPREAD[1] - BALLOON_SPREAD[0]);
                const x = round2(hero.x + Math.cos(angle) * dist);
                const z = round2(hero.z + Math.sin(angle) * dist);
                if (!this.region.fits(x, z, 0.3) || this.balloons.some((b) => Math.hypot(b.x - x, b.z - z) < 1)) {
                    continue;
                }
                const uid = this.nextUid++;
                const colour = Math.floor(this.rng() * BALLOON_LOCS.length);
                this.addBalloon(uid, x, z, colour);
                sent.push([uid, x, z, colour]);
                break;
            }
        }
        if (sent.length === 0) {
            return;
        }
        if (this.coop?.role === "host") {
            this.coop.send({ k: "balloons", b: sent } satisfies DownMessage);
        }
        this.announce(
            this.coop ? "Party balloons are drifting down! Run into them to burst them." : "Party balloons drift down around you! Run into them to burst them.",
        );
    }

    private addBalloon(uid: number, x: number, z: number, colour: number): void {
        const b: Balloon = { uid, x, z, colour, age: 0, gone: false };
        this.balloons.push(b);
        void createActor("locs", BALLOON_LOCS[colour] ?? BALLOON_LOCS[0]).then((actor) => {
            if (b.gone || this.done) {
                return;
            }
            b.actor = actor;
            this.placeActor(actor, x, z, this.rng() * Math.PI * 2, BALLOON_SCALE);
            actor.root.position.y = this.groundY(x, z);
            b.shadow = groundShadow(BALLOON_SHADOW);
            b.shadow.position.set(x, this.groundY(x, z) + 0.05, z);
            this.scene.add(b.shadow);
            // Its fall, once, as far along as the balloon is (a model that
            // loaded late, or a guest told late, doesn't start from the top)
            play(actor, "play", { once: true });
            actor.mixer.update(Math.min(b.age, BALLOON_FALL));
        });
    }

    private removeBalloon(b: Balloon): void {
        b.gone = true;
        if (b.actor) {
            this.scene.remove(b.actor.root);
        }
        if (b.shadow) {
            this.scene.remove(b.shadow);
        }
        const i = this.balloons.indexOf(b);
        if (i !== -1) {
            this.balloons.splice(i, 1);
        }
    }

    // A balloon run into: it bursts, and what was in it falls where it was
    // (the host rolls it and tells everyone)
    private burstBalloon(b: Balloon, by?: Hero): void {
        this.removeBalloon(b);
        const distance = Math.hypot(b.x - this.px, b.z - this.pz);
        playPop(distance <= HEAR_NEAR ? 1 : Math.max(0, 1 - (distance - HEAR_NEAR) / (HEAR_FAR - HEAR_NEAR)));
        void createActor("locs", BALLOON_BURSTS[b.colour] ?? BALLOON_BURSTS[0]).then((actor) => {
            if (this.done) {
                return;
            }
            this.placeActor(actor, b.x, b.z, 0, BALLOON_SCALE);
            actor.root.position.y = this.groundY(b.x, b.z);
            this.popping.push({ actor, left: Math.max(0.3, play(actor, "play", { once: true })) });
        });
        if (!by) {
            return;
        }
        if (this.coop?.role === "host") {
            this.coop.send({ k: "burst", u: b.uid } satisfies DownMessage);
        }
        if (by.me) {
            this.balloonsBurst++;
        }
        const roll = this.rng();
        if (roll < BALLOON_GEAR) {
            this.dropGear(this.world.lootTiers, b.x, b.z, 0, 0.3);
        } else if (roll < BALLOON_GEAR + BALLOON_AMMO) {
            if (this.rng() < 0.5) {
                this.dropPickup(ammoOfTier("arrows", this.world.tier, this.rng()), randInt(this.rng, 5, 10), b.x, b.z, 0.3);
            } else {
                const runes = runeDrop(this.world.tier, this.rng(), this.rng(), (lo, hi) => randInt(this.rng, lo, hi));
                this.dropPickup(runes.id, runes.count * 2, b.x, b.z, 0.3);
            }
        } else if (roll < BALLOON_GEAR + BALLOON_AMMO + BALLOON_FOOD) {
            this.dropPickup(FOOD_BY_TIER[Math.min(FOOD_BY_TIER.length - 1, this.world.tier - 1)], randInt(this.rng, 1, 2), b.x, b.z, 0.3);
        } else {
            this.tell(by, "The balloon was empty.");
        }
    }

    // The weapon's special attack, on the next swing, if the bar has enough
    useSpecial(): void {
        const special = specialOf(this.stats.weapon);
        if (!special || this.dead || this.paused || this.specPending) {
            return;
        }
        if (this.spec < SPEC_COST) {
            this.hooks.onMessage("Your special attack isn't ready.");
            return;
        }
        this.specPending = true;
        this.wantAttack = true;
    }

    // The special the swing landing now spends, if it's spending one
    private takeSpecial(): Special | undefined {
        if (!this.specPending) {
            return undefined;
        }
        this.specPending = false;
        const special = specialOf(this.stats.weapon);
        if (!special || this.spec < SPEC_COST) {
            return undefined;
        }
        this.spec -= SPEC_COST;
        this.specials++;
        this.hooks.onMessage(`${special.name}!`);
        return special;
    }

    // Torchlight on a night run (version 114, torch.ts): a torch with
    // this player and each mate still in it. What's come into the scene
    // since (the map's far squares, enemies, drops) takes the light every
    // TORCH_SWEEP seconds.
    private torchSweep = 0;

    private updateTorches(dt: number): void {
        if (!this.night) {
            return;
        }
        this.torchSweep -= dt;
        if (this.torchSweep <= 0) {
            this.torchSweep = TORCH_SWEEP;
            addTorchTo(this.scene);
        }
        const heroes: { x: number; z: number; out: boolean }[] = [
            { x: this.px, z: this.pz, out: this.dead },
            ...[...this.mates.values()].map((m) => ({ x: m.x, z: m.z, out: m.dead || m.done })),
        ];
        for (let i = 0; i < TORCHES; i++) {
            const h = heroes[i];
            if (!h || h.out) {
                setTorch(i, 0, -1000, 0, 0);
            } else {
                setTorch(i, h.x, this.groundY(h.x, h.z) + 1.1, h.z, flicker(this.time, i * 1.7));
            }
        }
    }

    private update(dt: number): void {
        this.time += dt;
        if (!this.player) {
            return;
        }
        this.updateClock();
        this.updatePrayer(dt);
        this.updateAmbient(dt);
        this.updatePlayer(dt);
        this.updatePet(dt);
        this.syncSelf();
        this.updateMates(dt);
        if (this.coop?.role === "guest") {
            this.updateGhosts(dt);
        } else {
            this.updateEnemies(dt);
        }
        this.updateProjectiles(dt);
        this.updateHazards(dt);
        this.updateSplats(dt);
        this.updateEffects(dt);
        this.updateTorches(dt);
        this.updatePickups(dt);
        this.updateBalloons(dt);
        this.updateInteractions(dt);
        this.player.update(dt);
        for (const exit of this.exits) {
            exit.actor?.mixer.update(dt);
        }
        for (const e of this.enemies) {
            e.actor.mixer.update(dt);
        }
        this.updateBoosts(dt);
        this.updateFloors(dt);
        this.placeCamera();
        // The boss bar, once it has seen you
        const boss = this.enemies.find((e) => e.def.boss && e.state !== "dead" && e.state !== "idle");
        this.boss = boss ? { name: boss.def.name, hp: boss.hp, maxHp: boss.def.hp } : undefined;
        if (this.coop?.role === "host") {
            this.sendSnapshot(dt);
        } else if (this.coop?.role === "guest") {
            this.sendMove(dt);
        }
        this.hooks.onChanged();
    }

    // The world holds while the party loads: the host counts the guests in
    // (or gives up waiting after a while), the guests wait for its word
    private updateHold(dt: number): void {
        if (!this.player) {
            return;
        }
        const coop = this.coop!;
        if (coop.role === "host") {
            this.waitLeft -= dt;
            if (this.waitingFor.size === 0 || this.waitLeft <= 0) {
                this.holding = false;
                this.prompt = "";
                coop.send({ k: "go" } satisfies DownMessage);
                this.hooks.onMessage(this.waitingFor.size === 0 ? "Everyone's in. Go." : "Not everyone's loaded, but the run goes on.");
                this.waitingFor.clear();
                this.clock.getDelta();
            } else {
                const names = [...this.waitingFor].map((id) => this.mates.get(id)?.name ?? "someone");
                this.prompt = `Waiting for ${names.join(", ")} to load... ${Math.ceil(this.waitLeft)}s`;
            }
        } else {
            this.prompt = "Waiting for the others to load...";
        }
        this.player.update(dt);
        this.updateMates(dt);
        for (const exit of this.exits) {
            exit.actor?.mixer.update(dt);
        }
        for (const e of this.enemies) {
            e.actor.mixer.update(dt);
        }
        this.placeCamera();
        this.hooks.onChanged();
    }

    // The camera over this player, or over whoever they're watching once
    // their own part is over
    private placeCamera(): void {
        let x = this.px;
        let z = this.pz;
        if (this.done) {
            const watching = this.spectating;
            if (!watching || watching.done || watching.dead) {
                this.spectating = [...this.mates.values()].find((m) => !m.done && !m.dead);
            }
            if (this.spectating) {
                x = this.spectating.x;
                z = this.spectating.z;
                this.prompt = `Watching ${this.spectating.name}. Esc, then Leave run, goes back to the guild.`;
            }
        }
        const py = this.groundY(x, z);
        this.cameraOffset
            .set(0, Math.sin(this.cameraPitch), Math.cos(this.cameraPitch))
            .multiplyScalar(CAMERA_OFFSET.length() * this.zoom)
            .applyAxisAngle(UP, this.cameraYaw);
        this.camera.position.set(x, py, z).add(this.cameraOffset);
        this.camera.lookAt(x, py + 0.6, z);
    }

    // This player as the enemies (and the snapshot) see them
    private syncSelf(): void {
        const s = this.self;
        s.x = this.px;
        s.z = this.pz;
        s.facing = this.facing;
        s.hp = this.hp;
        s.maxHp = this.maxHp;
        s.dead = this.dead || this.done !== undefined;
        s.defenceVs = this.defenceTriple();
        s.protect = this.protect;
    }

    // The armour's defence against melee, ranged and magic, in that order
    // (party.ts sends it so; a hero carries it so)
    private defenceTriple(): [number, number, number] {
        const d = this.stats.defenceVs;
        return [d.melee, d.ranged, d.magic];
    }

    // A hero's defence against a style of attack
    private static defenceAgainst(hero: Hero, style: ProtectStyle): number {
        return hero.defenceVs[style === "ranged" ? 1 : style === "magic" ? 2 : 0];
    }

    // The others in the party, eased along
    private updateMates(dt: number): void {
        for (const m of this.mates.values()) {
            if (!m.done || m.corpse) {
                m.update(dt, settings.healthBars);
            }
        }
    }

    // Every hero an enemy could be after: this player and the mates still
    // standing
    private heroes(): Hero[] {
        const list: Hero[] = [];
        if (!this.dead && !this.done) {
            list.push(this.self);
        }
        for (const m of this.mates.values()) {
            if (!m.done && !m.dead) {
                list.push(m);
            }
        }
        return list;
    }

    // The storeys and roofs above the plane go while anything up there hangs
    // over you (a roof, the way the client takes roofs off indoors, or an
    // eave or walkway), and while one a few tiles toward the camera (south,
    // unless it's been turned) would stand between you and it. They go at
    // once and come back only after you've been clear for a moment, so a walk
    // along a wall doesn't flick them.
    private updateFloors(dt: number): void {
        if (this.upperFloors.length === 0) {
            return;
        }
        let covered = false;
        const towardX = Math.sin(this.cameraYaw);
        const towardZ = Math.cos(this.cameraYaw);
        for (let tiles = 0; tiles <= 4 && !covered; tiles++) {
            covered = this.region.isCovered(this.px + towardX * tiles, this.pz + towardZ * tiles);
        }
        this.roofClearFor = covered ? 0 : this.roofClearFor + dt;
        const show = !covered && this.roofClearFor >= ROOF_RETURN_SECONDS;
        for (const floor of this.upperFloors) {
            floor.visible = show;
        }
    }

    private moveCircle(x: number, z: number, dx: number, dz: number, radius: number): [number, number] {
        let [nx, nz] = this.region.moveAxis(x, z, dx, 0, radius);
        [nx, nz] = this.region.moveAxis(nx, nz, 0, dz, radius);
        return [nx, nz];
    }

    private updatePlayer(dt: number): void {
        const p = this.player;
        if (this.done || this.dead) {
            this.cancelWalk();
            this.overhead?.show("none", this.px, 0, this.pz);
        }
        if (this.done) {
            return;
        }
        if (this.dead) {
            this.deadFor += dt;
            // Down in a party: a mate standing can still come for you, until
            // the window's gone
            const help = this.coop !== undefined && this.othersRemain() && this.deadFor < this.reviveWindow();
            if (this.deadFor > DEATH_PAUSE && !help) {
                this.finishSelf("died");
            }
            return;
        }
        this.attackCooldown -= dt;
        this.spec = Math.min(100, this.spec + SPEC_REGEN * this.specRate * dt);
        if (this.hurtFlash > 0) {
            this.hurtFlash -= dt;
            if (this.hurtFlash <= 0) {
                this.player.restore();
            }
        }
        let dx = 0;
        let dz = 0;
        if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dz -= 1;
        if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dz += 1;
        if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
        if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
        dx += this.stick.x;
        dz += this.stick.z;
        // Mouse, keyboard and touch keep priority when inputs overlap.
        if (dx === 0 && dz === 0) {
            dx = this.controllerStick.x;
            dz = this.controllerStick.z;
        }
        // Up on the keys or the stick is away from the camera, however it's
        // turned (the turn of the camera's offset, done to the way)
        if (this.cameraYaw !== 0) {
            const cos = Math.cos(this.cameraYaw);
            const sin = Math.sin(this.cameraYaw);
            [dx, dz] = [dx * cos + dz * sin, dz * cos - dx * sin];
        }
        const manualMove = dx !== 0 || dz !== 0;
        let walkDistance = Infinity;
        if (manualMove) {
            this.cancelWalk();
        } else if (!this.menuOpen) {
            while (this.walkPath.length > 0) {
                const waypoint = this.walkPath[0];
                walkDistance = Math.hypot(waypoint.x - this.px, waypoint.z - this.pz);
                // Reach the actual waypoint before turning. Cutting even a
                // small fraction off a corner can lose the wall clearance
                // that the planned next segment was checked against.
                if (walkDistance > 0.00001) {
                    dx = waypoint.x - this.px;
                    dz = waypoint.z - this.pz;
                    break;
                }
                this.walkPath.shift();
            }
            if (this.walkPath.length === 0) this.cancelWalk();
        }
        const moving = dx !== 0 || dz !== 0;
        const swinging = this.swingIn >= 0;

        // Catching your breath: only standing still, with nothing after you,
        // and only before the map wakes. After that it's food.
        const regenRate = this.petBuff?.regen ?? 1;
        if (!this.chased && !moving && !this.awake && this.time - this.lastHurt > REGEN_DELAY / regenRate && this.hp < this.maxHp) {
            this.regen += REGEN_PER_SECOND * regenRate * dt;
            if (this.regen >= 1) {
                this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.regen));
                this.regen -= Math.floor(this.regen);
            }
        }
        // Poison ticks on until it's run its course or food settles it
        if (this.poisonTicks > 0) {
            this.poisonIn -= dt;
            if (this.poisonIn <= 0) {
                this.poisonIn = POISON_INTERVAL;
                this.poisonTicks--;
                this.hurtPlayer(POISON, 1, "melee", true, Math.max(2, Math.round(this.maxHp * POISON_SHARE)));
            }
        }

        // Moving never waits for a swing, so you can fight on the move or get
        // away; the swing's animation just plays over the run
        if (moving && this.extracting <= 0) {
            const len = Math.hypot(dx, dz);
            dx /= len;
            dz /= len;
            const speed = this.speed();
            const step = Math.min(speed * dt, walkDistance);
            const beforeX = this.px;
            const beforeZ = this.pz;
            [this.px, this.pz] = this.moveCircle(this.px, this.pz, dx * step, dz * step, COLLISION_RADIUS);
            if (this.walkPath.length > 0) {
                this.walkStuckFor = Math.hypot(this.px - beforeX, this.pz - beforeZ) < step * 0.1 ? this.walkStuckFor + dt : 0;
                if (this.walkStuckFor > 0.5) this.cancelWalk();
            }
            if (!swinging) {
                this.facing = Math.atan2(dx, dz);
                p.play("run", { speed: RUN_CLIP_SPEED });
            }
        } else if (!swinging) {
            p.play("idle");
        }

        // Swinging: the hit lands part way through the animation
        if (swinging) {
            this.swingIn -= dt;
            if (this.swingIn < 0) {
                this.landSwing();
            }
        }

        // The weapon fires on its own at anything in its range that's after
        // you (a passive chicken or imp minding its own business is left
        // be); Space, a click or a tap swings regardless, at anything
        // A press while the weapon's still recovering waits a moment for it
        // (version 98: it was dropped, so a tap between swings did nothing)
        if (this.wantAttack) {
            this.attackAsked = ATTACK_BUFFER;
            this.wantAttack = false;
        }
        const asked = this.attackAsked > 0 || this.controllerAttack || this.touchAttack;
        if (this.attackCooldown <= 0 && !swinging) {
            if (asked || this.nearestEnemy(this.stats.range, true, false)) {
                this.beginSwing(asked);
                this.attackAsked = 0;
            }
        }
        this.attackAsked = Math.max(0, this.attackAsked - dt);

        const groundY = this.groundY(this.px, this.pz);
        if (this.swingIn < 0 && Math.hypot(this.aimInput.x, this.aimInput.z) > 0.15) {
            const cos = Math.cos(this.cameraYaw);
            const sin = Math.sin(this.cameraYaw);
            this.facing = Math.atan2(this.aimInput.x * cos + this.aimInput.z * sin, this.aimInput.z * cos - this.aimInput.x * sin);
        }
        p.root.position.set(this.px, groundY, this.pz);
        p.root.rotation.y = this.facing;
        const top = groundY + p.height * this.character.size;
        if (this.crown) {
            // The sheet's bottom (the word) a little over the head
            this.crown.position.set(this.px, top + 0.12 + CROWN_SHEET_HEIGHT / 2, this.pz);
            this.crown.visible = !this.dead;
        }
        // The protection's icon over the head, over the crown if there's one
        this.overhead ??= new Overhead(this.scene);
        this.overhead.show(this.protect, this.px, top + 0.12 + (this.crown ? CROWN_SHEET_HEIGHT + 0.04 : 0), this.pz);
        this.reveal();
    }

    // The pet keeps a step behind and to one side, walking when you do;
    // left far behind, or stuck on something, it catches up by itself
    private updatePet(dt: number): void {
        const pet = this.pet;
        if (!pet) {
            return;
        }
        pet.actor.mixer.update(dt);
        const sin = Math.sin(this.facing);
        const cos = Math.cos(this.facing);
        const tx = this.px - sin * PET_FOLLOW + cos * 0.5;
        const tz = this.pz - cos * PET_FOLLOW - sin * 0.5;
        const dx = tx - pet.x;
        const dz = tz - pet.z;
        const dist = Math.hypot(dx, dz);
        if (dist > PET_LEASH || pet.stuck > 2) {
            const open = this.region.fits(tx, tz, 0.15);
            pet.x = open ? tx : this.px;
            pet.z = open ? tz : this.pz;
            pet.stuck = 0;
        } else if (dist > 0.3) {
            const step = Math.min(dist, Math.max(this.speed(), dist * 2) * dt);
            const [nx, nz] = this.moveCircle(pet.x, pet.z, (dx / dist) * step, (dz / dist) * step, 0.15);
            pet.stuck = Math.hypot(nx - pet.x, nz - pet.z) < step * 0.3 && dist > 2 ? pet.stuck + dt : 0;
            pet.x = nx;
            pet.z = nz;
            pet.facing = Math.atan2(dx, dz);
            play(pet.actor, "walk");
        } else {
            play(pet.actor, "idle");
        }
        pet.actor.root.position.set(pet.x, this.groundY(pet.x, pet.z), pet.z);
        pet.actor.root.rotation.y = pet.facing;
    }

    // The nearest enemy in reach, and in line of sight; with passive false,
    // not a passive one that's still minding its own business
    private nearestEnemy(range: number, anyDirection: boolean, passive = true): Enemy | undefined {
        let best: Enemy | undefined;
        let bestDist = Infinity;
        for (const e of this.enemies) {
            if (e.state === "dead" || (!passive && e.def.passive && e.state === "idle")) {
                continue;
            }
            const dist = Math.hypot(e.x - this.px, e.z - this.pz) - e.def.radius;
            if (dist > range || dist >= bestDist) {
                continue;
            }
            // Not through a wall
            if (!this.region.lineOfSight(this.px, this.pz, e.x, e.z)) {
                continue;
            }
            if (!anyDirection) {
                const angle = Math.atan2(e.x - this.px, e.z - this.pz);
                let diff = Math.abs(angle - this.facing) % (Math.PI * 2);
                diff = diff > Math.PI ? Math.PI * 2 - diff : diff;
                if (diff > Math.PI * 0.6) {
                    continue;
                }
            }
            best = e;
            bestDist = dist;
        }
        return best;
    }

    // A swing: on its own (at what's after you) or asked for (at anything)
    private beginSwing(asked = false): void {
        const stats = this.stats;
        // A bow shoots nothing without arrows in the pack, and a staff casts
        // nothing it can't (its tier) or hasn't the runes for
        const casting = stats.weapon?.uses === "runes" ? this.castingSpell() : undefined;
        const why = stats.weapon?.uses === "arrows" && !this.ammo() ? "You're out of arrows." : casting && !casting.spell ? casting.why : undefined;
        if (why) {
            if (this.time - this.ammoMessageAt > 3) {
                this.ammoMessageAt = this.time;
                this.hooks.onMessage(why);
            }
            this.attackCooldown = 1;
            return;
        }
        // Face whatever is in reach, even behind
        const target = this.nearestEnemy(stats.range, true, asked);
        if (target) {
            this.facing = Math.atan2(target.x - this.px, target.z - this.pz);
        }
        // A spell is cast with its own animation and sound, OSRS's (version
        // 108); anything else swings as the weapon does
        const spell = casting?.spell;
        const clip = spell?.clip ?? stats.weapon?.attackClip ?? "attack";
        const length = this.player.play(clip, { once: true, speed: Math.max(1, 0.7 / stats.speed) });
        this.swingIn = Math.min(0.3, length * 0.5);
        this.swingTarget = target;
        this.attackCooldown = stats.speed;
        this.attacks++;
        // A god spell sounds only where it lands
        const sound = spell ? spell.castSound : stats.sound;
        if (sound) {
            playSound(`sounds/${sound}`, 0.4);
        }
        // A spell's own light on the caster as it's cast
        if (casting?.spell?.cast !== undefined && target) {
            void this.burst(casting.spell.cast, this.px, this.pz);
        }
    }

    private landSwing(): void {
        this.swingIn = -1;
        const stats = this.stats;
        // A special lands more, or harder, and may heal; a full Barrows set
        // has its say too (SET_EFFECTS)
        const special = this.takeSpecial();
        const hits = special?.hits ?? 1;
        const set = stats.set;
        const roll = () => {
            // Verac's never rolls low; Dharok's hits harder the lower you are
            let hit = set === "verac" ? stats.damage * (0.85 + this.rng() * 0.15) : playerHit(stats, this.rng());
            if (set === "dharok") {
                hit *= 1 + (1 - this.hp / this.maxHp);
            }
            // A pet may hold the roll off the floor
            if (this.petBuff?.floor) {
                hit = Math.max(hit, stats.damage * this.petBuff.floor);
            }
            return Math.max(1, Math.round(hit * (special?.power ?? 1)));
        };
        if (stats.ranged) {
            const target = this.swingTarget && this.swingTarget.state !== "dead" ? this.swingTarget : undefined;
            if (target) {
                // Each shot takes an arrow or a rune (a special's shots the
                // one), and the kind decides the hit and the look of the
                // shot (ammoScale; a crossbow shoots a bolt whatever's packed)
                let look: Look = { projectile: stats.weapon?.projectile, impact: stats.weapon?.impact };
                let scale = 1;
                if (stats.weapon?.uses === "runes") {
                    // A spell: its runes (OSRS's costs, less what the staff
                    // and shield give), its hit and its look (spells.ts)
                    const { spell } = this.castingSpell();
                    if (!spell) {
                        return;
                    }
                    scale = spellScale(stats.weapon, spell);
                    look = { projectile: spell.projectile, impact: spell.impact, spell, maxHit: Math.max(1, Math.round(stats.damage * scale)) };
                    if (!(this.petBuff?.ammoSave && this.rng() < this.petBuff.ammoSave)) {
                        for (const rune of spellCost(spell, this.runesGiven())) {
                            removeItem(this.inventory, rune.id, rune.n);
                        }
                        this.hooks.onChanged();
                    }
                } else if (stats.weapon?.uses) {
                    const ammo = this.ammo();
                    if (!ammo) {
                        return;
                    }
                    const kind = getItem(ammo.id);
                    scale = ammoScale(stats.weapon, kind);
                    if (stats.weapon.projectile !== BOLT) {
                        look = { projectile: kind.projectile ?? look.projectile, impact: kind.impact ?? look.impact };
                    }
                    // A pet may spare the shot its ammunition now and then
                    if (!(this.petBuff?.ammoSave && this.rng() < this.petBuff.ammoSave)) {
                        removeItem(this.inventory, ammo.id, 1);
                        this.hooks.onChanged();
                    }
                }
                const shot = () => Math.max(1, Math.round(roll() * scale));
                for (let i = 0; i < hits; i++) {
                    void this.shoot(target, shot(), look);
                }
                // Karil's bolts: one in three hits again at half
                if (set === "karil" && this.rng() < 1 / 3) {
                    void this.shoot(target, Math.max(1, Math.round(shot() / 2)), look);
                }
            }
            return;
        }
        // Melee hits everything in front within reach
        let dealt = 0;
        for (const e of this.enemies) {
            if (e.state === "dead") {
                continue;
            }
            const dist = Math.hypot(e.x - this.px, e.z - this.pz) - e.def.radius;
            if (dist > stats.range || !this.region.lineOfSight(this.px, this.pz, e.x, e.z)) {
                continue;
            }
            const angle = Math.atan2(e.x - this.px, e.z - this.pz);
            let diff = Math.abs(angle - this.facing) % (Math.PI * 2);
            diff = diff > Math.PI ? Math.PI * 2 - diff : diff;
            if (diff <= Math.PI * 0.45 || e === this.swingTarget) {
                for (let i = 0; i < hits && e.hp > 0; i++) {
                    const damage = roll();
                    dealt += Math.min(damage, e.hp);
                    this.damageEnemy(e, damage);
                }
            }
        }
        if (special?.heal && dealt > 0) {
            this.hp = Math.min(this.maxHp, this.hp + Math.round(dealt * special.heal));
        }
        // Guthan's: a quarter of what's dealt comes back
        if (set === "guthan" && dealt > 0) {
            this.hp = Math.min(this.maxHp, this.hp + Math.round(dealt * 0.25));
        }
    }

    // A hitsplat: the client's red square with the number, over whoever
    // took the hit, drifting up and fading; the client's green for poison
    private splat(x: number, z: number, height: number, value: number, poison = false): void {
        const material = new THREE.SpriteMaterial({
            map: this.splatTexture(value, poison),
            transparent: true,
            depthTest: false,
            toneMapped: false,
            fog: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.05, 0.7, 1);
        sprite.renderOrder = 20;
        const baseY = this.groundY(x, z) + height;
        sprite.position.set(x + (this.rng() - 0.5) * 0.3, baseY, z);
        this.scene.add(sprite);
        this.splats.push({ sprite, left: 1, baseY });
    }

    private splatTexture(value: number, poison = false): THREE.CanvasTexture {
        const key = poison ? `p${value}` : String(value);
        let texture = this.splatTextures.get(key);
        if (!texture) {
            const canvas = document.createElement("canvas");
            canvas.width = 96;
            canvas.height = 64;
            const ctx = canvas.getContext("2d")!;
            // A splat: a blob with jagged lobes round it, the lobes' sizes
            // from a fixed pattern so every splat is the same shape, and a
            // few drops flung off it
            const cx = 48;
            const cy = 32;
            const lobes = [1.0, 0.78, 1.18, 0.84, 1.08, 0.74, 1.22, 0.8, 1.02, 0.76, 1.15, 0.82, 1.06, 0.72, 1.2, 0.86];
            const outline = (scale: number) => {
                ctx.beginPath();
                for (let i = 0; i <= lobes.length; i++) {
                    const a = (i / lobes.length) * Math.PI * 2;
                    const r = lobes[i % lobes.length] * scale;
                    const x = cx + Math.cos(a) * 30 * r;
                    const y = cy + Math.sin(a) * 19 * r;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
            };
            ctx.fillStyle = poison ? "#0a3a0a" : "#4a0000";
            outline(1.08);
            ctx.fill();
            ctx.fillStyle = poison ? "#2a9a1a" : "#c01010";
            outline(1);
            ctx.fill();
            for (const [dx, dy, r] of [
                [34, -22, 3.5],
                [-37, 14, 3],
                [30, 20, 2.5],
                [-31, -17, 2],
                [41, 2, 2],
            ]) {
                ctx.beginPath();
                ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = "#fff";
            ctx.font = "26px 'OSRS Bold', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 3;
            ctx.strokeText(String(value), cx, cy + 1);
            ctx.fillText(String(value), cx, cy + 1);
            texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            this.splatTextures.set(key, texture);
            this.disposables.push(texture);
        }
        return texture;
    }

    private updateSplats(dt: number): void {
        for (let i = this.splats.length - 1; i >= 0; i--) {
            const s = this.splats[i];
            s.left -= dt;
            s.sprite.position.y = s.baseY + (1 - s.left) * 0.6;
            (s.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, s.left * 3);
            if (s.left <= 0) {
                this.scene.remove(s.sprite);
                (s.sprite.material as THREE.SpriteMaterial).dispose();
                this.splats.splice(i, 1);
            }
        }
    }

    // An arrow, bolt or spell on its way: the spot animation of what's
    // shot (the arrows' or runes' own, else the weapon's), flying at the
    // target (the party sees it too). A chinchompa's burst spreads.
    private shoot(target: Enemy, damage: number, look: Look): Promise<void> {
        const weapon = this.stats.weapon;
        const y = this.groundY(this.px, this.pz) + 1.0;
        // The party hears of the spell too, to cast it and hear it as it was
        const s = look.spell?.id;
        if (this.coop?.role === "host") {
            this.coop.send({ k: "pshot", from: this.coop.me, u: target.uid, p: look.projectile, i: look.impact, s } satisfies DownMessage);
        } else if (this.coop?.role === "guest") {
            this.coop.send({ k: "shot", u: target.uid, p: look.projectile, i: look.impact, s } satisfies UpMessage);
        }
        return this.launch(this.px, this.pz, y, look.projectile, {
            target,
            damage,
            impact: look.impact,
            splash: weapon?.splash,
            spell: look.spell,
            maxHit: look.maxHit,
            hitSound: look.spell?.hitSound,
        });
    }

    private ballProjectile(): THREE.Object3D {
        const geometry = new THREE.SphereGeometry(0.12, 6, 6);
        const material = new THREE.MeshBasicMaterial({ color: 0xdddddd });
        this.disposables.push(geometry, material);
        return new THREE.Mesh(geometry, material);
    }

    // A mage's spell or an archer's arrow: a spell's cast graphic on the
    // caster, and the shot itself flying at a hero from about hand height
    private async cast(e: Enemy, t: Hero): Promise<void> {
        const magic = e.def.shoots;
        if (!magic) {
            return;
        }
        // One that alternates throws an arrow between its spells
        const style: ProtectStyle = e.def.alternates ? (e.style ?? magic.style) : magic.style;
        const projectile = style === "ranged" && magic.style !== "ranged" ? 10 : magic.projectile;
        const impact = style === "magic" ? magic.impact : undefined;
        const castAnim = style === "magic" ? magic.cast : undefined;
        const y = this.groundY(e.x, e.z) + e.actor.height * (e.def.scale ?? 1) * 0.6;
        if (this.coop?.role === "host") {
            this.coop.send({ k: "shot", x: round2(e.x), z: round2(e.z), y: round2(y), to: t.id, p: projectile, i: impact, c: castAnim } satisfies DownMessage);
        }
        // A shadow spell takes a share off what it throws (version 107)
        await this.launch(e.x, e.z, y, projectile, { hero: t, from: e.def, style, impact, cast: castAnim, scale: this.weakScale(e) });
    }

    // A mate's spell, from its shot's word (version 108): they cast it with
    // its own animation, and its sound is heard where they are
    private mateSpell(mate: Mate, id: unknown): SpellDef | undefined {
        const spell = typeof id === "string" ? SPELL_BY_ID.get(id) : undefined;
        if (spell) {
            mate.castWith(spell.clip);
            if (spell.castSound !== undefined) {
                this.hear(`sounds/${spell.castSound}`, mate.x, mate.z, 0.4);
            }
        }
        return spell;
    }

    // What a shadow spell leaves of an enemy's hits (version 107)
    private weakScale(e: Enemy): number {
        return e.weakLeft > 0 ? 1 - e.weak : 1;
    }

    // Something flying from here: a spot animation (or a plain ball when
    // there's none) at an enemy, at a hero, or just for show
    private async launch(
        x: number,
        z: number,
        y: number,
        projectile: number | undefined,
        at: {
            target?: Enemy;
            hero?: Hero;
            from?: EnemyDef;
            style?: ProtectStyle;
            damage?: number;
            impact?: number;
            cast?: number;
            visual?: boolean;
            splash?: boolean;
            spell?: SpellDef;
            maxHit?: number;
            scale?: number;
            hitSound?: number;
        },
    ): Promise<void> {
        if (at.cast !== undefined) {
            void this.burst(at.cast, x, z);
        }
        const actor = projectile !== undefined ? await createActor("spotanims", projectile).catch(() => undefined) : undefined;
        if (this.ended) {
            return;
        }
        let root: THREE.Object3D;
        if (actor) {
            root = actor.root;
            if (actor.clips.size > 0) {
                play(actor, "play");
                this.effects.push({ actor, left: 60 });
            }
        } else if (projectile === undefined && at.impact !== undefined) {
            // A spell with no flight (a burst, a barrage): nothing to see on
            // the way, only where it lands (version 107)
            root = new THREE.Group();
        } else {
            root = this.ballProjectile();
        }
        root.position.set(x, y, z);
        this.scene.add(root);
        this.projectiles.push({
            root,
            x,
            z,
            y,
            target: at.target,
            hero: at.hero,
            from: at.from,
            style: at.style,
            damage: at.damage ?? 0,
            impact: at.impact,
            visual: at.visual,
            splash: at.splash,
            spell: at.spell,
            maxHit: at.maxHit,
            scale: at.scale,
            hitSound: at.hitSound,
        });
    }

    // A hit on an enemy by a hero (this player unless said). On a guest the
    // host decides: the hit goes up to it, and shows here meanwhile. Set
    // effects: Ahrim's slows what a spell hits, Torag's puts another half
    // second between its attacks.
    private damageEnemy(e: Enemy, damage: number, by: Hero = this.self, effects: HitEffects = {}): void {
        if (by.me && !effects.poisoned) {
            effects = { ...effects, stall: this.stats.set === "torag" };
        }
        if (this.coop?.role === "guest") {
            this.coop.send({
                k: "hit",
                u: e.uid,
                d: damage,
                slow: effects.slow ? 1 : undefined,
                stall: effects.stall ? 1 : undefined,
                frz: effects.freeze,
                wk: effects.weaken,
                psn: effects.poison,
            } satisfies UpMessage);
            e.myHitAt = this.time;
        }
        // An armoured elite shrugs off some of it
        if (e.trait === "armoured") {
            damage = Math.max(1, Math.round(damage * 0.6));
        }
        e.hp = Math.max(0, e.hp - damage);
        e.flash = 0.12;
        e.barShown = BAR_SECONDS;
        e.lastHurtAt = this.time;
        tint(e.actor, new THREE.Color(1.6, 0.6, 0.6));
        this.splat(e.x, e.z, e.actor.height * (e.def.scale ?? 1) * 0.7, damage, effects.poisoned);
        if (this.coop?.role === "guest") {
            // Its fall is the host's to call
            this.hear(npcSound(e.def.npcId, "hit"), e.x, e.z, 0.4);
            return;
        }
        this.rouse(e);
        if (effects.stall) {
            e.cooldown += 0.5;
        }
        if (effects.slow) {
            e.slow = 4;
        }
        // Ancient Magicks (version 107): ice holds it (a boss shrugs that
        // off), shadow weakens its hits, smoke poisons it (a fresh poison
        // only if it's stronger than what's in it)
        if (effects.freeze && !e.def.boss) {
            e.frozen = Math.max(e.frozen, effects.freeze);
        }
        if (effects.weaken) {
            e.weak = Math.max(e.weakLeft > 0 ? e.weak : 0, effects.weaken);
            e.weakLeft = WEAKEN_SECONDS;
        }
        if (effects.poison && (e.poisonLeft <= 0 || effects.poison >= e.poisonHit)) {
            e.poisonHit = effects.poison;
            e.poisonLeft = POISON_HITS;
            e.poisonNext = POISON_EVERY;
            e.poisonBy = by;
        }
        if (e.hp <= 0) {
            this.killEnemy(e, by);
            return;
        }
        this.hear(npcSound(e.def.npcId, "hit"), e.x, e.z, 0.4);
        // Low, an ordinary enemy runs for help, once
        if (!e.def.boss && !e.def.champion && !e.fled && e.hp < e.def.hp * FLEE_HP) {
            e.fled = true;
            e.state = "flee";
            e.fleeLeft = FLEE_SECONDS;
            e.noIdleUntil = this.time + FLEE_PERSIST;
            if (this.time - this.fleeMessageAt > 3) {
                this.fleeMessageAt = this.time;
                this.hooks.onMessage(`The ${e.def.name.toLowerCase()} runs for help!`);
            }
        }
    }

    private killEnemy(e: Enemy, by: Hero): void {
        // A second form: up again, quicker, greener, with most of its health
        if (e.def.secondForm && !e.reborn) {
            e.reborn = true;
            e.hp = Math.round(e.def.hp * 0.6);
            e.interval = e.def.attackInterval * 0.7;
            e.tint = new THREE.Color(0.8, 1.25, 0.8);
            tint(e.actor, e.tint);
            e.actor.root.scale.setScalar((e.def.scale ?? 1) * 1.15);
            e.flash = 0;
            this.sendTint(e, 2);
            this.announce(`${e.def.name} sheds its shell and rises again!`);
            return;
        }
        e.state = "dead";
        e.hp = 0;
        // The kill is the killer's; the boss is everyone's
        if (by.me) {
            this.kills++;
            if (e.def.champion) {
                this.championKills++;
            }
            if (this.stats.ranged) {
                this.rangedKills++;
            }
        }
        if (e.def.boss) {
            this.bossKills++;
        }
        if (this.coop?.role === "host") {
            this.coop.send({ k: "kill", u: e.uid, by: by.id, boss: e.def.boss ? 1 : undefined, champion: e.def.champion ? 1 : undefined } satisfies DownMessage);
        }
        tint(e.actor, new THREE.Color(1, 1, 1));
        play(e.actor, "death", { once: true });
        this.hear(npcSound(e.def.npcId, "death"), e.x, e.z, 0.5);
        // An elite was worth twice the coins; an ordinary enemy only
        // sometimes carried any
        // (and a pet's share, for whoever walks over them)
        const coins = Math.round(randInt(this.rng, e.def.coins[0], e.def.coins[1]) * (e.trait ? 2 : 1) * (1 + (this.petBuff?.coins ?? 0)));
        if (e.def.boss || e.def.champion || this.rng() < COIN_DROP_CHANCE) {
            this.dropPickup(COINS, coins, e.x, e.z);
        }
        if (this.rng() < e.def.foodChance) {
            const food = [315, 2309, 333, 329, 379][Math.min(4, Math.floor(this.rng() * (this.world.tier + 1)))];
            this.dropPickup(food, 1, e.x + 0.3, e.z + 0.3);
        }
        if (e.def.boss) {
            this.revealNearestExit();
            // The golden chest's key, every time
            this.dropPickup(BOSS_KEY, 1, e.x - 0.3, e.z + 0.3);
            this.hooks.onMessage(`${e.def.name} falls and drops the golden chest's key. The nearest way out is ${this.exitDirection()}.`);
            // Now and then something small is left behind, if you haven't
            // got one from here already
            const pets = this.carry.pets ?? [];
            if (!pets.includes(this.world.id) && !this.petFound && this.rng() < 1 / PET_ONE_IN) {
                this.petFound = this.world.id;
                this.hooks.onMessage(`Something small crawls out from under ${e.def.name}. It seems to like you.`);
            }
            return;
        }
        // Arrows or runes, for whoever shoots: one kill in four, a few
        // arrows of the map's tier, or a handful of elemental runes or a few
        // of the tier's catalyst (version 106: spells take OSRS's costs)
        if (this.rng() < AMMO_DROP_CHANCE) {
            if (this.rng() < 0.5) {
                const kind = ammoOfTier("arrows", this.world.tier, this.rng());
                this.dropPickup(kind, randInt(this.rng, 3, 6), e.x + 0.3, e.z - 0.3);
            } else {
                const runes = runeDrop(this.world.tier, this.rng(), this.rng(), (lo, hi) => randInt(this.rng, lo, hi));
                this.dropPickup(runes.id, runes.count, e.x + 0.3, e.z - 0.3);
            }
        }
        // A clue scroll, once a run
        if (!this.clueDropped && this.rng() < CLUE_CHANCE) {
            this.clueDropped = true;
            this.dropPickup(CLUE_SCROLL, 1, e.x - 0.3, e.z + 0.3);
        }
        // A champion always carried a piece of gear, the way a chest gives it
        if (e.def.champion) {
            this.dropGear(this.world.lootTiers, e.x - 0.3, e.z - 0.3, PRIZE_FULL);
            if (e.key) {
                this.dropPickup(VAULT_KEY, 1, e.x + 0.3, e.z + 0.4);
                this.announce(`The ${e.def.name.toLowerCase()} drops its prize, and a crystal key.`);
            } else {
                this.announce(`The ${e.def.name.toLowerCase()} drops its prize.`);
            }
            return;
        }
        // Now and then one was carrying more: a purse, or a piece of gear the
        // way a chest gives it
        const roll = this.rng();
        if (roll < 0.02) {
            this.dropGear(this.world.lootTiers, e.x - 0.3, e.z - 0.3);
            this.announce(`The ${e.def.name.toLowerCase()} was carrying something.`);
        } else if (roll < 0.02 + PURSE_CHANCE) {
            this.dropPickup(COINS, coins * randInt(this.rng, 4, 8), e.x - 0.3, e.z + 0.3);
        } else if (roll < 0.02 + PURSE_CHANCE + PRAYER_POTION_CHANCE) {
            this.dropPickup(2434, 1, e.x - 0.3, e.z - 0.3);
        }
    }

    // A piece of gear from a roll over tiers, dropped here; a tier's prize
    // only where prizes are given (the boss's chest, the vault, a champion,
    // a clue casket), at the weight they're given there
    private dropGear(tiers: { tier: number; weight: number }[], x: number, z: number, prizes = 0, scatter?: number): void {
        let roll = this.rng() * tiers.reduce((n, t) => n + t.weight, 0);
        let pick = tiers[tiers.length - 1].tier;
        for (const t of tiers) {
            roll -= t.weight;
            if (roll <= 0) {
                pick = t.tier;
                break;
            }
        }
        const item = rollGear(this.rng, pick, prizes);
        if (item) {
            this.dropPickup(item.id, 1, x, z, scatter);
        }
    }

    // Who an enemy goes for: the nearest hero standing, with a little
    // loyalty to the one it's after already
    private targetFor(e: Enemy, heroes: Hero[]): Hero | undefined {
        let best: Hero | undefined;
        let bestDist = Infinity;
        for (const h of heroes) {
            const d = Math.hypot(h.x - e.x, h.z - e.z) - (h === e.target ? 2 : 0);
            if (d < bestDist) {
                best = h;
                bestDist = d;
            }
        }
        return best;
    }

    private updateEnemies(dt: number): void {
        const heroes = this.heroes();
        this.flowAge += dt;
        if (this.flowAge > 0.25) {
            this.flows.clear();
            for (const h of heroes) {
                this.flows.set(h.id, this.region.flowField({ x: h.x, z: h.z }));
            }
            this.flowAge = 0;
        }
        let chased = false;
        for (const e of this.enemies) {
            if (e.flash > 0) {
                e.flash -= dt;
                if (e.flash <= 0 && e.state !== "dead") {
                    tint(e.actor, e.tint);
                }
            }
            if (e.slow > 0) {
                e.slow -= dt;
            }
            // Ancient Magicks' holds (version 107): a freeze and a weakening
            // wear off, and a poison hits every few seconds until it's done
            if (e.frozen > 0) {
                e.frozen -= dt;
            }
            if (e.weakLeft > 0) {
                e.weakLeft -= dt;
            }
            if (e.poisonLeft > 0 && e.state !== "dead") {
                e.poisonNext -= dt;
                if (e.poisonNext <= 0) {
                    e.poisonNext = POISON_EVERY;
                    e.poisonLeft--;
                    this.damageEnemy(e, e.poisonHit, e.poisonBy ?? this.self, { poisoned: true });
                }
            }
            if (e.state === "dead") {
                e.deadFor += dt;
                if (e.deadFor > 4) {
                    this.scene.remove(e.actor.root);
                }
                if (e.bar) {
                    e.bar.group.visible = false;
                }
                continue;
            }
            const t = this.targetFor(e, heroes);
            e.target = t;
            const dist = t ? Math.hypot(e.x - t.x, e.z - t.z) : Infinity;
            e.cooldown -= dt;

            if (e.state === "idle") {
                // Twice as far once the map's awake, less in the dark; a
                // boss never from further than it would chase
                let aggro = e.def.aggro * (this.awake ? 2 : 1) * (this.night ? NIGHT_AGGRO : 1);
                if (e.def.boss) {
                    aggro = Math.min(aggro, this.bossGiveUp(e) * BOSS_NOTICE_SHARE);
                }
                // A passive one never comes at you on sight
                if (t && dist < aggro && !e.def.passive) {
                    this.rouse(e);
                } else if (e.def.boss && Math.hypot(e.x - e.homeX, e.z - e.homeZ) > 1) {
                    this.walkHome(e, dt);
                } else if (e.route) {
                    this.patrol(e, dt);
                } else {
                    play(e.actor, "idle");
                }
            }
            if (e.state !== "idle") {
                if (t === this.self) {
                    chased = true;
                }
                // A regenerating elite heals once it's been left alone a moment
                if (e.trait === "regenerating" && e.hp < e.def.hp && this.time - e.lastHurtAt > 3) {
                    e.hp = Math.min(e.def.hp, e.hp + e.def.hp * 0.02 * dt);
                }
            }

            if (e.state === "flee") {
                this.flee(e, t, dt);
            }

            if (e.state === "attack") {
                if (e.hitIn >= 0) {
                    e.hitIn -= dt;
                    if (e.hitIn < 0 && t) {
                        const reach = e.def.attackRange + PLAYER_RADIUS + 0.4;
                        if (Math.hypot(e.x - t.x, e.z - t.z) <= reach && this.region.lineOfSight(e.x, e.z, t.x, t.z)) {
                            if (e.def.shoots) {
                                void this.cast(e, t);
                            } else {
                                this.hurtHero(t, e.def, this.weakScale(e), "melee", e.def.pierce, undefined, e.trait === "venomous");
                            }
                        }
                    }
                }
                if (e.cooldown <= 0) {
                    e.state = "chase";
                }
                if (t) {
                    e.facing = Math.atan2(t.x - e.x, t.z - e.z);
                }
            }

            if (e.state === "chase") {
                // Out of reach it gives up: a boss only from much further,
                // and nothing soon after running for help
                const giveUp = dist > (e.def.boss ? this.bossGiveUp(e) : e.def.aggro * 2.5) && this.time > e.noIdleUntil;
                if (giveUp && e.def.boss && t && this.time - e.gaveUpAt > 5) {
                    e.gaveUpAt = this.time;
                    this.announce(`${e.def.name} loses interest and turns back.`);
                }
                if (!t || giveUp) {
                    e.state = "idle";
                } else if (
                    e.def.shoots &&
                    !e.def.boss &&
                    dist < e.def.attackRange * RETREAT_SHARE &&
                    this.region.lineOfSight(e.x, e.z, t.x, t.z) &&
                    this.retreat(e, t, dt)
                ) {
                    // Backed off a step; it shoots from further out
                } else if (dist <= e.def.attackRange + PLAYER_RADIUS && this.region.lineOfSight(e.x, e.z, t.x, t.z)) {
                    if (e.cooldown <= 0) {
                        e.state = "attack";
                        e.attacks++;
                        // A shooter that alternates swaps now, and says so
                        if (e.def.alternates && e.def.shoots) {
                            e.style = e.style === "magic" ? "ranged" : "magic";
                            this.announce(e.style === "magic" ? `${e.def.name}'s fire gathers!` : `${e.def.name} rears up to throw!`);
                        }
                        const length = play(e.actor, "attack", { once: true });
                        e.hitIn = Math.min(0.45, length * 0.5);
                        e.cooldown = e.interval;
                        this.hear(npcSound(e.def.npcId, "attack"), e.x, e.z, 0.35);
                    } else if (!e.def.shoots && !e.def.boss) {
                        // Between swings a melee enemy works round to your side
                        this.chase(e, t, dt);
                    } else {
                        play(e.actor, "idle");
                    }
                    e.facing = Math.atan2(t.x - e.x, t.z - e.z);
                } else {
                    this.chase(e, t, dt);
                }
            }

            if (e.def.boss) {
                this.updateBoss(e, dt);
            }
            if (e.def.floor && e.state !== "idle" && t) {
                this.updateFloor(e, t, dt);
            }
            e.actor.root.position.set(e.x, this.groundY(e.x, e.z), e.z);
            e.actor.root.rotation.y = e.facing;
            this.updateHealthBar(e, dt);
        }
        this.chased = chased;
        this.updateTargetRing();
    }

    // The ring sits under the last enemy swung at while it lives and is near
    private updateTargetRing(): void {
        const e = this.swingTarget;
        const shown = this.markTarget && e !== undefined && e.state !== "dead" && !this.dead && Math.hypot(e.x - this.px, e.z - this.pz) < 10;
        if (!shown) {
            if (this.targetRing) {
                this.targetRing.visible = false;
            }
            return;
        }
        if (!this.targetRing) {
            const geometry = new THREE.RingGeometry(0.78, 1, 40);
            const material = new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
            this.disposables.push(geometry, material);
            this.targetRing = new THREE.Mesh(geometry, material);
            this.targetRing.rotation.x = -Math.PI / 2;
            this.scene.add(this.targetRing);
        }
        this.targetRing.visible = true;
        this.targetRing.scale.setScalar(0.7 * (e.def.scale ?? 1));
        this.targetRing.position.set(e.x, this.groundY(e.x, e.z) + 0.06, e.z);
    }

    // How fast an enemy moves: its own pace, half again for a fast elite,
    // half while Ahrim's spell has it crawling
    private speedOf(e: Enemy): number {
        // A roused melee boss closes the distance: nearly as quick as you
        // are, so it can't be shot at from a walk backwards for ever (one
        // that shoots back has no need)
        const base = e.def.boss && !e.def.shoots && e.state !== "idle" ? Math.max(e.def.speed, BOSS_CHASE_SPEED) : e.def.speed;
        // Frozen by an ice spell, it stands where it is (version 107)
        if (e.frozen > 0) {
            return 0;
        }
        return base * (e.trait === "fast" ? 1.5 : 1) * (e.slow > 0 ? 0.5 : 1);
    }

    // A mage or archer backing away from a hero who's closed in, facing
    // them; whether it got anywhere (cornered, it shoots from where it is)
    private retreat(e: Enemy, t: Hero, dt: number): boolean {
        const dx = e.x - t.x;
        const dz = e.z - t.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.01) {
            return false;
        }
        const step = this.speedOf(e) * 0.8 * dt;
        const [nx, nz] = this.moveCircle(e.x, e.z, (dx / len) * step, (dz / len) * step, COLLISION_RADIUS);
        if (Math.hypot(nx - e.x, nz - e.z) < step * 0.3) {
            return false;
        }
        e.x = nx;
        e.z = nz;
        e.facing = Math.atan2(t.x - e.x, t.z - e.z);
        play(e.actor, "walk");
        return true;
    }

    // Running for help: away from whoever it's after at full tilt, rousing
    // what's idle along the way, then back into the chase
    private flee(e: Enemy, t: Hero | undefined, dt: number): void {
        e.fleeLeft -= dt;
        const dx = e.x - (t?.x ?? e.x);
        const dz = e.z - (t?.z ?? e.z);
        const len = Math.hypot(dx, dz);
        let moved = false;
        if (len > 0.01) {
            const step = this.speedOf(e) * dt;
            const [nx, nz] = this.moveCircle(e.x, e.z, (dx / len) * step, (dz / len) * step, COLLISION_RADIUS);
            moved = Math.hypot(nx - e.x, nz - e.z) >= step * 0.3;
            e.x = nx;
            e.z = nz;
            e.facing = Math.atan2(dx, dz);
            play(e.actor, "walk");
        }
        for (const o of this.enemies) {
            if (o.state === "idle" && !o.def.passive && Math.hypot(o.x - e.x, o.z - e.z) < FLEE_ROUSE) {
                o.state = "chase";
                o.lastHurtAt = this.time;
                this.notice(o);
            }
        }
        if (e.fleeLeft <= 0 || !moved) {
            e.state = "chase";
        }
    }

    // A venomous hit: poison that ticks for a while, unless you eat
    private poison(): void {
        if (this.poisonTicks === 0) {
            this.hooks.onMessage("You've been poisoned. Food settles it.");
            this.poisonIn = POISON_INTERVAL;
        }
        this.poisonTicks = POISON_TICKS;
    }

    // How far off a boss gives up the chase: a melee one soon, a shooter
    // much later
    private bossGiveUp(e: Enemy): number {
        return e.def.shoots ? BOSS_GIVE_UP : BOSS_GIVE_UP_MELEE;
    }

    // A boss that's given up walks back to where it stood (stuck on the
    // way too long, it's simply put back there)
    private walkHome(e: Enemy, dt: number): void {
        const dx = e.homeX - e.x;
        const dz = e.homeZ - e.z;
        const dist = Math.hypot(dx, dz);
        const step = e.def.speed * dt;
        const [nx, nz] = this.moveCircle(e.x, e.z, (dx / dist) * Math.min(step, dist), (dz / dist) * Math.min(step, dist), COLLISION_RADIUS);
        e.stuck = Math.hypot(nx - e.x, nz - e.z) < step * 0.3 ? e.stuck + dt : 0;
        if (e.stuck > 3) {
            e.x = e.homeX;
            e.z = e.homeZ;
            e.stuck = 0;
            return;
        }
        e.x = nx;
        e.z = nz;
        e.facing = Math.atan2(dx, dz);
        play(e.actor, "walk");
    }

    // A patrol walks its round while nothing's up: on to the next tile of
    // it when this one's reached, or when something's in the way too long
    private patrol(e: Enemy, dt: number): void {
        const route = e.route!;
        const target = route[e.routeAt];
        const dx = target.x - e.x;
        const dz = target.z - e.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.5 || e.stuck > 1.5) {
            e.routeAt = (e.routeAt + 1) % route.length;
            e.stuck = 0;
            return;
        }
        const step = this.speedOf(e) * PATROL_SPEED * dt;
        const [nx, nz] = this.moveCircle(e.x, e.z, (dx / dist) * step, (dz / dist) * step, COLLISION_RADIUS);
        e.stuck = Math.hypot(nx - e.x, nz - e.z) < step * 0.3 ? e.stuck + dt : 0;
        e.x = nx;
        e.z = nz;
        e.facing = Math.atan2(dx, dz);
        play(e.actor, "walk");
    }

    // Half way down, a boss is enraged: quicker, redder, with company, and
    // slamming the ground now and then, a ring on the ground warning where
    private updateBoss(e: Enemy, dt: number): void {
        // Left alone too long, an enraged boss gets some of its health back
        if (e.enraged && e.state !== "idle" && this.time - e.lastHurtAt > BOSS_IDLE_HEAL_SECONDS && e.hp < e.def.hp) {
            e.lastHurtAt = this.time;
            e.hp = Math.min(e.def.hp, e.hp + Math.round(e.def.hp * BOSS_IDLE_HEAL));
            this.announce(`${e.def.name} catches its breath and heals.`);
        }
        if (!e.enraged && e.hp <= e.def.hp * BOSS_ENRAGE) {
            e.enraged = true;
            e.interval = e.def.attackInterval * 0.65;
            e.tint = new THREE.Color(1.4, 0.75, 0.75);
            tint(e.actor, e.tint);
            this.sendTint(e, 1);
            e.slamIn = SLAM_SECONDS / 2;
            this.announce(`${e.def.name} is enraged!`);
            // Company: a few of the map's commonest enemy, beside it
            const company = this.world.enemies[0].def;
            for (const [ox, oz] of [
                [2, 0],
                [-2, 0],
                [0, 2],
            ]) {
                const x = e.x + ox;
                const z = e.z + oz;
                if (this.region.fits(x, z, COLLISION_RADIUS)) {
                    void this.spawnEnemy(company, { x, z }).then((add) => this.rouse(add));
                }
            }
        }
        if (!e.enraged || e.state === "idle") {
            return;
        }
        e.slamIn -= dt;
        if (e.slamIn <= 0) {
            e.slamIn = SLAM_SECONDS;
            this.hazard(
                e.x,
                e.z,
                SLAM_RANGE,
                1.2,
                (hero) => this.hurtHero(hero, e.def, 1.5 * this.weakScale(e), "melee", e.def.pierce),
                () => {
                    play(e.actor, "attack", { once: true });
                    e.attacks++;
                },
            );
        }
    }

    // Burning floor: a few tiles round whoever it's after ringed, then burst
    private updateFloor(e: Enemy, t: Hero, dt: number): void {
        e.floorIn -= dt;
        if (e.floorIn > 0) {
            return;
        }
        e.floorIn = FLOOR_SECONDS;
        for (let i = 0; i < FLOOR_TILES; i++) {
            const x = t.x + (this.rng() - 0.5) * 2 * FLOOR_SPREAD;
            const z = t.z + (this.rng() - 0.5) * 2 * FLOOR_SPREAD;
            if (!this.region.fits(x, z, 0.1)) {
                continue;
            }
            this.hazard(x, z, 1, 1.4, (hero) => {
                this.hurtHero(hero, e.def, 0, "magic", true, Math.round(hero.maxHp * FLOOR_DAMAGE));
            });
        }
        this.tell(t, `The ground under you glows: ${e.def.name}'s fire is coming.`);
    }

    private barMaterials?: { back: THREE.SpriteMaterial; red: THREE.SpriteMaterial; green: THREE.SpriteMaterial };

    private makeHealthBar(): HealthBar {
        if (!this.barMaterials) {
            const make = (color: number, renderOrder: number) => {
                // Not fogged, not brightened: a plain red and green
                const material = new THREE.SpriteMaterial({ color, fog: false, depthWrite: false, toneMapped: false });
                material.userData.renderOrder = renderOrder;
                this.disposables.push(material);
                return material;
            };
            this.barMaterials = { back: make(0x000000, 10), red: make(0xff0000, 11), green: make(0x00ff00, 12) };
        }
        const group = new THREE.Group();
        const sprite = (material: THREE.SpriteMaterial, x: number, width: number, height: number) => {
            const s = new THREE.Sprite(material);
            // Grows from its left edge, so the fill shrinks from the right
            s.center.set(0, 0.5);
            s.position.set(x, 0, 0);
            s.scale.set(width, height, 1);
            s.renderOrder = material.userData.renderOrder;
            group.add(s);
            return s;
        };
        sprite(this.barMaterials.back, -BAR_WIDTH / 2 - 0.03, BAR_WIDTH + 0.06, 0.2);
        sprite(this.barMaterials.red, -BAR_WIDTH / 2, BAR_WIDTH, 0.14);
        const fill = sprite(this.barMaterials.green, -BAR_WIDTH / 2, BAR_WIDTH, 0.14);
        group.visible = false;
        return { group, fill };
    }

    // Over its head while it's hurt or fighting, for BAR_SECONDS after
    private updateHealthBar(e: Enemy, dt: number): void {
        const bar = e.bar;
        if (!bar) {
            return;
        }
        e.barShown = Math.max(0, e.barShown - dt);
        if (e.state === "attack") {
            e.barShown = BAR_SECONDS;
        }
        bar.group.visible = settings.healthBars && e.barShown > 0;
        if (!bar.group.visible) {
            return;
        }
        const top = e.actor.height * (e.def.scale ?? 1);
        bar.group.position.set(e.x, this.groundY(e.x, e.z) + top + 0.25, e.z);
        bar.fill.scale.x = Math.max(0.001, e.hp / e.def.hp) * BAR_WIDTH;
    }

    private chase(e: Enemy, t: Hero, dt: number): void {
        const region = this.region;
        const flow = this.flows.get(t.id);
        let dx = t.x - e.x;
        let dz = t.z - e.z;
        let here = flow ? region.flowAt(flow, e.x, e.z) : -1;
        const near = Math.hypot(dx, dz);
        // Close, in sight and nothing in the way (a tree's trunk, say), it
        // walks straight at the player, whatever the field says (version 94:
        // the field goes round a tree's whole canopy, so near one it led an
        // enemy round and round while the player stood under it, safe)
        const straight =
            near < STRAIGHT_RANGE &&
            region.lineOfSight(e.x, e.z, t.x, t.z) &&
            region.clearWalk(e.x, e.z, t.x - (dx / Math.max(near, 0.001)) * 0.5, t.z - (dz / Math.max(near, 0.001)) * 0.5, COLLISION_RADIUS);
        // Close and in sight, a melee enemy goes for your side instead of
        // queueing up in front, where your swings land
        const side = 1.0 * e.flank;
        const flankX = t.x + Math.cos(t.facing) * side;
        const flankZ = t.z - Math.sin(t.facing) * side;
        // Only where it can walk there straight: past a tree's trunk it
        // follows the field round instead (version 94; else it walked into
        // the trunk and stood there, a safe spot)
        const flanking =
            !e.def.shoots &&
            !e.def.boss &&
            near < FLANK_RANGE &&
            near > 0.5 &&
            region.lineOfSight(e.x, e.z, t.x, t.z) &&
            region.clearWalk(e.x, e.z, flankX, flankZ, COLLISION_RADIUS);
        // Standing where the field has no step (under a tree's canopy, whose
        // tiles it goes round) with no straight way on, it makes for the
        // nearest tile that has one first (version 94: before, it stood
        // there for good, and a tree was a safe spot to shoot it from)
        const offField = flow !== undefined && here === -1 && !straight && !flanking;
        if (offField) {
            const out = region.nearestFlow(flow, e.x, e.z, COLLISION_RADIUS);
            if (out.steps !== -1) {
                const ox = out.x - e.x;
                const oz = out.z - e.z;
                const olen = Math.hypot(ox, oz);
                if (olen > 0.05) {
                    const step = this.speedOf(e) * dt;
                    [e.x, e.z] = this.moveCircle(e.x, e.z, (ox / olen) * step, (oz / olen) * step, COLLISION_RADIUS);
                    e.facing = Math.atan2(ox, oz);
                    play(e.actor, "walk");
                    return;
                }
                here = out.steps;
            }
        }
        // No way round to the player at all (a fence between, say): wait
        // rather than walk into it
        if (offField && here === -1) {
            play(e.actor, "idle");
            return;
        }
        if (flanking) {
            dx = flankX - e.x;
            dz = flankZ - e.z;
            // At the side already: stand there
            if (Math.hypot(dx, dz) < 0.25) {
                play(e.actor, "idle");
                return;
            }
        } else if (near <= 0.5) {
            // On top of the player already: no closer
            play(e.actor, "idle");
            return;
        }
        // Follow the field unless the player is right there, or a straight
        // walk gets there
        if (!flanking && !straight && flow && here > 1) {
            const tx = region.tileX(e.x);
            const ty = region.tileY(e.z);
            let best = here;
            let bx = tx;
            let by = ty;
            for (const [ox, oy] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ]) {
                // Not the player's own tile through a wall: the field counts
                // steps round it, so the next step is a neighbour it can enter
                if (region.crossesWall(tx, ty, tx + ox, ty + oy)) {
                    continue;
                }
                const n = region.flowAt(flow, tx + ox + 0.5, -(ty + oy + 0.5));
                if (n !== -1 && n < best) {
                    best = n;
                    bx = tx + ox;
                    by = ty + oy;
                }
            }
            dx = bx + 0.5 - e.x;
            dz = -(by + 0.5) - e.z;
        }
        // Keep off the others
        for (const o of this.enemies) {
            if (o === e || o.state === "dead") {
                continue;
            }
            const ox = e.x - o.x;
            const oz = e.z - o.z;
            const dist = Math.hypot(ox, oz);
            const min = e.def.radius + o.def.radius;
            if (dist < min && dist > 0.001) {
                dx += (ox / dist) * (min - dist) * 3;
                dz += (oz / dist) * (min - dist) * 3;
            }
        }
        const len = Math.hypot(dx, dz);
        if (len < 0.01) {
            return;
        }
        dx /= len;
        dz /= len;
        const step = this.speedOf(e) * dt;
        // The same narrow footprint as the player, whatever its size, so a
        // big one follows the flow field through a one tile gap too
        [e.x, e.z] = this.moveCircle(e.x, e.z, dx * step, dz * step, COLLISION_RADIUS);
        e.facing = Math.atan2(dx, dz);
        play(e.actor, "walk");
    }

    // A hit on a hero: on this player, or (the host) rolled for a mate from
    // their defence and sent to them, with its poison if the enemy's venomous
    private hurtHero(hero: Hero, enemy: EnemyDef, scale = 1, style: ProtectStyle = styleOf(enemy), pierce = false, fixed?: number, venom = false): void {
        if (hero.me) {
            this.hurtPlayer(enemy, scale, style, pierce, fixed);
            if (venom && !this.dead) {
                this.poison();
            }
            return;
        }
        if (hero.dead || this.coop?.role !== "host") {
            return;
        }
        const hit = this.rollHit(enemy, Run.defenceAgainst(hero, style), scale, pierce, fixed);
        this.coop.send({
            k: "hurt",
            to: hero.id,
            hit,
            style,
            pierce: pierce ? 1 : undefined,
            fixed: fixed !== undefined ? 1 : undefined,
            by: enemy.name,
            venom: venom ? 1 : undefined,
        } satisfies DownMessage);
    }

    // What an enemy's hit comes to against this much defence: its roll less
    // the soak; a piercing hit gets through half the armour (and all of a
    // prayer, which applyHit sees to); or a set amount
    private rollHit(enemy: EnemyDef, defence: number, scale: number, pierce: boolean, fixed?: number): number {
        if (fixed !== undefined) {
            return fixed;
        }
        return Math.max(1, Math.round(enemyHit(enemy, { defence: pierce ? defence / 2 : defence }, this.rng()) * scale));
    }

    // A hit on the player: the enemy's roll less armour, halved by
    // protection from its style, unless it pierces (then neither counts);
    // or a set amount
    private hurtPlayer(enemy: EnemyDef, scale = 1, style: ProtectStyle = styleOf(enemy), pierce = false, fixed?: number): void {
        if (this.dead) {
            return;
        }
        this.applyHit(this.rollHit(enemy, Run.defenceAgainst(this.self, style), scale, pierce, fixed), enemy.name, style, pierce, fixed !== undefined);
    }

    // The hit landing: protection halves it unless it pierces or is set;
    // the armour wears, the health goes, and at none the player falls
    private applyHit(hit: number, by: string, style: ProtectStyle, pierce: boolean, fixed: boolean): void {
        if (this.dead || this.done || this.time < this.graceUntil) {
            return;
        }
        if (pierce && !fixed && !this.piercedOnce) {
            this.piercedOnce = true;
            this.hooks.onMessage(`${by}'s hits find the gaps in your armour. Nothing softens them.`);
        }
        if (!pierce && !fixed && this.protect === style && this.protect !== "none") {
            hit = Math.max(1, Math.round(hit / 2));
        }
        // A pet's hide takes a little off a real hit, or a pet born in the
        // fire a share off a burning floor's (a set hit that isn't poison)
        if (this.petBuff?.soak && !fixed) {
            hit = Math.max(1, hit - this.petBuff.soak);
        }
        if (this.petBuff?.burn !== undefined && fixed && by !== POISON.name) {
            hit = Math.max(1, Math.round(hit * this.petBuff.burn));
        }
        // A real hit wears the armour that took it
        if (!fixed) {
            this.wearArmour();
        }
        this.damageTaken += Math.min(hit, Math.max(0, this.hp));
        this.hp -= hit;
        this.hitsTaken++;
        this.lastHurt = this.time;
        this.hurtFlash = 0.15;
        this.hooks.onHurt?.(hit);
        this.player.flash(new THREE.Color(1.6, 0.5, 0.5));
        this.splat(this.px, this.pz, 1.5 * this.character.size, hit);
        playSound(npcSound(PLAYER_SOUND_NPC, "hit"), 0.5);
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.killer = by;
            this.swingIn = -1;
            this.player.restore();
            this.player.play("death", { once: true });
            playSound(npcSound(PLAYER_SOUND_NPC, "death"), 0.6);
            this.falls++;
            if (this.coop && this.othersRemain()) {
                this.hooks.onMessage(
                    `You're down. Someone in the party has ${this.reviveWindow()} seconds to revive you, or everything you carried is lost.` +
                        (this.falls > 1 ? " Each fall gives them half the time of the last." : ""),
                );
                if (this.coop.role === "host") {
                    this.coop.send({ k: "msg", text: Run.downText(this.self.name) } satisfies DownMessage);
                }
            } else {
                this.hooks.onMessage("You have died. Everything you carried is lost.");
            }
        }
    }

    // This fall's time for a revive: the full window the first time, half
    // the last fall's each time after
    private reviveWindow(): number {
        return REVIVE_WINDOW / Math.pow(2, Math.max(0, this.falls - 1));
    }

    private static downText(name: string): string {
        return `${name} is down. Stand beside them and hold E (Revive on a phone) to bring them back.`;
    }

    // Back up from being down: a share of the hitpoints, a moment nothing
    // can hurt, and the poison gone. Only while still down (not bled out)
    private standUp(by: string): void {
        if (!this.dead || this.done || this.ended) {
            return;
        }
        this.dead = false;
        this.deadFor = 0;
        this.killer = undefined;
        this.hp = Math.max(1, Math.round(this.maxHp * REVIVE_HP_SHARE));
        this.graceUntil = this.time + REVIVE_GRACE;
        this.poisonTicks = 0;
        this.lastHurt = this.time;
        this.player.restore();
        this.player.play("idle");
        this.hooks.onMessage(`${by} pulls you back to your feet.`);
        this.hooks.onChanged();
    }

    // A mate who's down within reach, for this player to revive (not one
    // just revived, whose word that they're up hasn't come yet)
    private downedMateNear(): Mate | undefined {
        for (const m of this.mates.values()) {
            if (!m.done && m.dead && this.time - m.revivedAt > 2 && Math.hypot(m.x - this.px, m.z - this.pz) < REVIVE_RANGE) {
                return m;
            }
        }
        return undefined;
    }

    // This player's revive of a mate: a guest asks the host, the host does it
    private sendRevive(mate: Mate): void {
        mate.revivedAt = this.time;
        if (this.coop?.role === "guest") {
            this.coop.send({ k: "revive", id: mate.id } satisfies UpMessage);
        } else {
            this.revive(mate.id, this.self);
        }
    }

    // The host's: a hero revived by another, if they're still down. The
    // host stands up here; a guest is told to
    private revive(id: string, by: Hero): void {
        const target = this.heroById(id);
        if (!target || target === by || by.dead) {
            return;
        }
        if (target.me) {
            if (!this.dead || this.done) {
                return;
            }
            this.standUp(by.name);
        } else {
            const mate = this.mates.get(id);
            if (!mate || mate.done || !mate.dead) {
                return;
            }
            mate.revivedAt = this.time;
            this.coop?.send({ k: "revive", id, by: by.name } satisfies DownMessage);
        }
        this.announce(`${by.name} revives ${target.name}.`);
    }

    // Every piece of armour worn wears a little with each hit; a word when
    // one is half gone and when it's worn through
    private wearArmour(): void {
        let changed = false;
        for (const slot of SLOTS) {
            const id = this.equipment[slot];
            if (slot === "weapon" || id === undefined) {
                continue;
            }
            const item = getItem(id);
            if (!item.defence) {
                continue;
            }
            const before = wearOf(this.wear, id);
            if (before >= 1) {
                continue;
            }
            const after = Math.min(1, before + WEAR_PER_HIT);
            this.wear[id] = after;
            changed = true;
            if (before < 0.5 && after >= 0.5) {
                this.hooks.onMessage(`Your ${item.name.toLowerCase()} is wearing thin.`);
            } else if (after >= 1) {
                this.hooks.onMessage(`Your ${item.name.toLowerCase()} is worn through: half its defence is gone until the guild repairs it.`);
            }
        }
        if (changed) {
            this.applyStats();
        }
    }

    // The player's spell landing (version 107): on the target, and for a
    // burst or barrage on up to eight more within a tile of it (OSRS's three
    // by three), each with the spell's effect; a blood spell heals a quarter
    // of what it dealt in all
    private landSpell(p: Projectile, target: Enemy, slow: boolean): void {
        const spell = p.spell!;
        // An effect with a chance (version 110: the swamp trident's venom,
        // the Sanguinesti staff's heal) comes on that share of hits
        const effect = spell.effect && (spell.effect.chance === undefined || this.rng() < spell.effect.chance) ? spell.effect : undefined;
        const effects: HitEffects = { slow };
        if (effect?.kind === "freeze") {
            effects.freeze = effect.seconds;
        } else if (effect?.kind === "weaken") {
            effects.weaken = effect.share;
        } else if (effect?.kind === "poison") {
            effects.poison = Math.max(1, Math.round((p.maxHit ?? p.damage) * effect.share));
        }
        const hit = [target];
        if (spell.area) {
            const near = this.enemies
                .filter((e) => e !== target && e.state !== "dead" && Math.max(Math.abs(e.x - target.x), Math.abs(e.z - target.z)) <= 1.5)
                .sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z));
            hit.push(...near.slice(0, 8));
        }
        let dealt = 0;
        for (const e of hit) {
            // The others roll their own hit, from a little under the target's
            const damage = e === target ? p.damage : Math.max(1, Math.round(p.damage * (0.75 + this.rng() * 0.25)));
            dealt += Math.min(damage, e.hp);
            this.damageEnemy(e, damage, this.self, effects);
            if (e !== target) {
                void this.burst(spell.impact, e.x, e.z);
            }
        }
        if (effect?.kind === "heal" && dealt > 0) {
            this.hp = Math.min(this.maxHp, this.hp + Math.round(dealt * effect.share));
            // The Sanguinesti staff's heal shows on its caster
            if (spell.healLook !== undefined) {
                void this.burst(spell.healLook, this.px, this.pz);
            }
        }
    }

    private updateProjectiles(dt: number): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const tx = p.target ? p.target.x : (p.hero?.x ?? this.px);
            const tz = p.target ? p.target.z : (p.hero?.z ?? this.pz);
            const ty = this.groundY(tx, tz) + 0.8;
            const dx = tx - p.x;
            const dz = tz - p.z;
            const dy = ty - p.y;
            const dist = Math.hypot(dx, dz);
            const step = PROJECTILE_SPEED * dt;
            const gone = p.target ? p.target.state === "dead" : p.hero ? p.hero.dead : this.dead;
            if (dist <= step || gone) {
                if (!gone) {
                    if (p.visual) {
                        // Someone else's: it lands, and that's all
                    } else if (p.target) {
                        // Ahrim's: what a spell hits crawls
                        const slow = this.stats.set === "ahrim" && this.stats.weapon?.uses === "runes";
                        if (p.spell) {
                            this.landSpell(p, p.target, slow);
                        } else {
                            this.damageEnemy(p.target, p.damage, this.self, { slow });
                        }
                        // A chinchompa: everything beside what it hit takes half
                        if (p.splash) {
                            for (const e of this.enemies) {
                                if (e !== p.target && e.state !== "dead" && Math.hypot(e.x - tx, e.z - tz) <= SPLASH_TILES) {
                                    this.damageEnemy(e, Math.max(1, Math.round(p.damage / 2)), this.self);
                                }
                            }
                        }
                    } else if (p.from && p.hero) {
                        this.hurtHero(p.hero, p.from, p.scale ?? 1, p.style ?? styleOf(p.from), p.from.pierce);
                    }
                    if (p.impact !== undefined) {
                        void this.burst(p.impact, tx, tz);
                    }
                    if (p.hitSound !== undefined) {
                        this.hear(`sounds/${p.hitSound}`, tx, tz, 0.4);
                    }
                }
                this.scene.remove(p.root);
                this.projectiles.splice(i, 1);
                continue;
            }
            p.x += (dx / dist) * step;
            p.z += (dz / dist) * step;
            p.y += (dy / dist) * step;
            p.root.position.set(p.x, p.y, p.z);
            // Nose first
            p.root.lookAt(tx, ty, tz);
        }
    }

    // A spot animation played once where something lands
    private async burst(spotAnim: number, x: number, z: number): Promise<void> {
        const actor = await createActor("spotanims", spotAnim).catch(() => undefined);
        if (!actor || this.ended) {
            return;
        }
        actor.root.position.set(x, this.groundY(x, z), z);
        this.scene.add(actor.root);
        const length = play(actor, "play", { once: true });
        this.effects.push({ actor, left: Math.max(0.3, length) });
    }

    private updateEffects(dt: number): void {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.actor.mixer.update(dt);
            effect.left -= dt;
            if (effect.left <= 0) {
                this.scene.remove(effect.actor.root);
                this.effects.splice(i, 1);
            }
        }
    }

    // Something dropped here, scattered up to this far (a kill's drops a
    // little, a chest's not at all); the host tells the guests where it lay
    private dropPickup(id: number, count: number, x: number, z: number, scatter = 0.8, uid = this.nextUid++, noLoot = false): void {
        // Its cell of the icon sheet, through the world's brightness curve, so
        // a dark icon reads on the ground
        const material = new THREE.SpriteMaterial({ map: iconTexture(id), transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.7, 0.62, 1);
        // Scatter a little, onto open ground
        for (let tries = 0; tries < 6 && scatter > 0; tries++) {
            const sx = x + (this.rng() - 0.5) * scatter;
            const sz = z + (this.rng() - 0.5) * scatter;
            if (this.region.fits(sx, sz, 0.1)) {
                x = sx;
                z = sz;
                break;
            }
        }
        if (this.coop?.role === "host") {
            this.coop.send({ k: "drop", u: uid, i: id, n: count, x: round2(x), z: round2(z), ...(noLoot ? { noLoot: 1 as const } : {}) } satisfies DownMessage);
        }
        const y = this.groundY(x, z);
        sprite.position.set(x, y + 0.5, z);
        this.scene.add(sprite);
        const shadow = groundShadow(0.28);
        shadow.position.set(x, y + 0.05, z);
        this.scene.add(shadow);
        // Every piece of gear glows its tier's colour (version 136)
        const item = getItem(id);
        let glow: THREE.Sprite | undefined;
        if (tierGlows(item)) {
            glow = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: glowTexture(),
                    color: TIER_COLOURS[item.tier],
                    transparent: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                    toneMapped: false,
                }),
            );
            glow.scale.setScalar(1.15);
            glow.position.copy(sprite.position);
            sprite.renderOrder = 1;
            this.scene.add(glow);
        }
        // Gear worth a shout stands under a shaft of light, with a chime
        let beam: THREE.Mesh | undefined;
        if (item.slot && item.tier >= BEAM_TIER) {
            const best = item.tier >= 5;
            beam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.16, 0.3, 7, 12, 1, true),
                new THREE.MeshBasicMaterial({
                    color: TIER_COLOURS[item.tier],
                    transparent: true,
                    opacity: 0.35,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    toneMapped: false,
                }),
            );
            beam.position.set(x, y + 3.5, z);
            this.scene.add(beam);
            this.disposables.push(beam.geometry, beam.material as THREE.Material);
            if (Math.hypot(x - this.px, z - this.pz) < HEAR_FAR) {
                playChime(best);
            }
            this.hooks.onMessage(`${item.name} gleams on the ground.`);
        }
        this.pickups.push({ uid, id, count, sprite, shadow, beam, glow, x, z, age: 0, noLoot });
    }

    // A pickup off the ground, whoever took it
    private removePickup(p: Pickup): void {
        this.scene.remove(p.sprite, p.shadow);
        if (p.beam) {
            this.scene.remove(p.beam);
        }
        if (p.glow) {
            this.scene.remove(p.glow);
            p.glow.material.dispose();
        }
        p.sprite.material.dispose();
        const i = this.pickups.indexOf(p);
        if (i !== -1) {
            this.pickups.splice(i, 1);
        }
    }

    // Something into the pack (or the purse): whether it went, with a word
    private takeItem(id: number, count: number, noLoot = false): boolean {
        if (id === COINS) {
            this.coins += count;
            this.coinsFound += count;
            if (!noLoot) this.loot.record(id, count);
            return true;
        }
        if (!canCarry(this.inventory, id, count)) {
            if (this.time - this.fullMessageAt > 2) {
                this.hooks.onMessage(carryLimitText(id));
                this.fullMessageAt = this.time;
            }
            return false;
        }
        if (!addItem(this.inventory, id, count, this.packSize)) {
            if (this.time - this.fullMessageAt > 2) {
                this.hooks.onMessage("Your pack is full.");
                this.fullMessageAt = this.time;
            }
            return false;
        }
        if (!noLoot) this.loot.record(id, count);
        if (id === CLUE_SCROLL) {
            this.setClue();
        } else if (id === VAULT_KEY) {
            this.vaultFound = true;
            this.hooks.onMessage(`You pick up the crystal key. The vault is ${this.vaultDirection()}.`);
        } else if (id === BOSS_KEY) {
            const golden = this.chests.find((c) => c.boss && !c.opened);
            this.hooks.onMessage(
                golden
                    ? `You pick up the golden chest's key. The chest is ${Math.round(Math.hypot(golden.tile.x - this.px, golden.tile.z - this.pz))} tiles to the ${this.compassTo(golden.tile.x, golden.tile.z)}.`
                    : "You pick up the golden chest's key.",
            );
        } else {
            this.hooks.onMessage(`You pick up ${count > 1 ? count + " " : ""}${getItem(id).name}.`);
        }
        return true;
    }

    // How many of a stack on the ground the pack has room for: what its
    // limits allow (food, arrows, runes) and its slots hold (version 100:
    // a stack was all or nothing, so 14 food turned down a stack of 2)
    private roomInPack(id: number, count: number): number {
        if (id === COINS) {
            return count;
        }
        const allowed = roomFor(this.inventory, id, count);
        if (getItem(id).stackable) {
            return this.inventory.some((s) => s.id === id) || this.inventory.length < this.packSize ? allowed : 0;
        }
        return Math.max(0, Math.min(allowed, this.packSize - this.inventory.length));
    }

    // Why nothing of it fits, once a while
    private noRoom(id: number): void {
        if (this.time - this.fullMessageAt > 2) {
            this.hooks.onMessage(canCarry(this.inventory, id, 1) ? "Your pack is full." : carryLimitText(id));
            this.fullMessageAt = this.time;
        }
    }

    private updatePickups(dt: number): void {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.age += dt;
            p.sprite.position.y = this.groundY(p.x, p.z) + 0.5 + Math.sin(p.age * 3) * 0.06;
            if (p.glow) {
                p.glow.position.y = p.sprite.position.y;
                p.glow.material.opacity = 0.75 + 0.25 * Math.sin(p.age * 2.5);
            }
            if (p.beam) {
                (p.beam.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.12 * Math.sin(p.age * 4);
                p.beam.rotation.y += dt * 0.6;
            }
            if (this.dead || this.done || p.age < 0.4) {
                continue;
            }
            if (Math.hypot(p.x - this.px, p.z - this.pz) < 0.7) {
                if (this.coop?.role === "guest") {
                    // The host hands it over (asked again if it hasn't in a moment)
                    const asked = this.requested.get(p.uid);
                    const room = this.roomInPack(p.id, p.count);
                    if (room > 0 && (asked === undefined || this.time - asked > 1.5)) {
                        this.requested.set(p.uid, this.time);
                        this.coop.send({ k: "take", u: p.uid, n: room < p.count ? room : undefined } satisfies UpMessage);
                    } else if (room === 0) {
                        this.noRoom(p.id);
                    }
                    continue;
                }
                // A party that splits its loot shares the coins out
                if (p.id === COINS && this.coop && this.splitsLoot()) {
                    this.shareCoins(this.coop.me, p.count);
                    this.coop.send({ k: "taken", u: p.uid } satisfies DownMessage);
                    this.removePickup(p);
                    continue;
                }
                // What fits, and the rest left where it lies
                const room = this.roomInPack(p.id, p.count);
                if (room === 0) {
                    this.noRoom(p.id);
                    continue;
                }
                if (!this.takeItem(p.id, room, p.noLoot)) {
                    continue;
                }
                if (room < p.count) {
                    p.count -= room;
                    if (this.coop?.role === "host") {
                        this.coop.send({ k: "taken", u: p.uid, n: room, left: p.count } satisfies DownMessage);
                    }
                    this.hooks.onChanged();
                    continue;
                }
                if (this.coop?.role === "host") {
                    this.coop.send({ k: "taken", u: p.uid } satisfies DownMessage);
                }
                this.removePickup(p);
            }
        }
    }

    private updateInteractions(dt: number): void {
        this.prompt = "";
        if (this.dead && !this.done && this.coop && this.othersRemain()) {
            this.prompt = `You're down. ${Math.max(0, Math.ceil(this.reviveWindow() - this.deadFor))}s for someone to revive you`;
            return;
        }
        if (this.dead || this.done) {
            return;
        }
        const near = (x: number, z: number) => Math.hypot(x - this.px, z - this.pz) < 1.6;
        const pressed = this.keys.has("KeyE") || this.controllerInteract;

        // A mate who's down: held E at their side brings them back up
        const downed = this.downedMateNear();
        if (downed) {
            if (!pressed) {
                this.reviving = 0;
                this.prompt = `Hold E to revive ${downed.name}: ${REVIVE_SECONDS} seconds at their side`;
                return;
            }
            if (this.revivingId !== downed.id) {
                this.revivingId = downed.id;
                this.reviving = 0;
            }
            this.reviving += dt;
            if (this.swingIn < 0) {
                this.player.play("idle");
            }
            this.prompt = `Reviving ${downed.name}... ${Math.max(0, REVIVE_SECONDS - this.reviving).toFixed(1)}s`;
            if (this.reviving >= REVIVE_SECONDS) {
                this.reviving = 0;
                this.revivingId = undefined;
                this.keys.delete("KeyE");
                this.sendRevive(downed);
            }
            return;
        }
        this.reviving = 0;

        // A way out, once it's been found
        for (const exit of this.exits) {
            if (!exit.found && Math.hypot(exit.x - this.px, exit.z - this.pz) < EXIT_SIGHT) {
                exit.found = true;
                this.hooks.onMessage("You spot a way out.");
            }
        }
        const exit = this.exits.find((e) => e.actor && near(e.x, e.z));
        if (exit) {
            if (this.closed) {
                this.prompt = "The ways out have closed";
                return;
            }
            if (pressed) {
                // The way out is loud: the first moment of it wakes what's near
                if (!this.extractWoke) {
                    this.extractWoke = true;
                    if (this.coop?.role === "guest") {
                        this.coop.send({ k: "wake", x: round2(this.px), z: round2(this.pz) } satisfies UpMessage);
                    } else {
                        const woke = this.wakeNear(this.px, this.pz, EXTRACT_WAKE);
                        this.announce(woke > 0 ? "The way out groans open. Everything near has heard it." : "The way out groans open. Nothing stirs.");
                    }
                }
                this.extracting += dt;
                // Standing still, but a swing at whatever comes still plays
                if (this.swingIn < 0) {
                    this.player.play("idle");
                }
                this.prompt = `Escaping... ${Math.max(0, EXTRACT_SECONDS - this.extracting).toFixed(1)}s`;
                if (this.extracting >= EXTRACT_SECONDS) {
                    this.finishSelf("extracted");
                }
            } else {
                this.extracting = 0;
                this.extractWoke = false;
                this.prompt = "Hold E to escape: ten seconds, and everything near will hear it";
            }
            return;
        }
        this.extracting = 0;
        this.extractWoke = false;

        // Your gravestone, with what you left in it
        const grave = this.grave;
        if (grave && grave.items.length > 0 && near(grave.x, grave.z)) {
            const n = grave.items.reduce((sum, s) => sum + s.count, 0);
            this.prompt = `Press E to take back what you left here (${n} thing${n === 1 ? "" : "s"})`;
            if (pressed) {
                this.takeGrave();
            }
            return;
        }

        // The genie: a wish out, for coins, until the ways out close
        const ferry = this.ferry;
        if (ferry && Math.hypot(ferry.x - this.px, ferry.z - this.pz) < 1.8) {
            const fee = this.ferryFee();
            // Only what this run has found pays (and never more than's carried)
            const found = Math.min(this.coins, this.coinsFound);
            if (this.closed) {
                this.prompt = "The genie's wishes went with the ways out";
            } else if (found < fee) {
                this.prompt = `The genie wants ${fee.toLocaleString()} coins found on this map for a wish out; you've found ${found.toLocaleString()}`;
            } else {
                this.prompt = `Press E to pay the genie ${fee.toLocaleString()} coins for a wish out of the map`;
                if (pressed) {
                    this.keys.delete("KeyE");
                    this.coins -= fee;
                    this.coinsFound -= fee;
                    this.genie = true;
                    this.hooks.onChanged();
                    this.hooks.onMessage(`The genie takes ${fee.toLocaleString()} coins and grants your wish. The map fades.`);
                    this.finishSelf("extracted");
                }
            }
            return;
        }

        // The trader: a word when he's first in sight, a trade at his side
        const trader = this.trader;
        if (trader) {
            const d = Math.hypot(trader.x - this.px, trader.z - this.pz);
            if (!trader.seen && d < 10) {
                trader.seen = true;
                this.hooks.onMessage(
                    "A wandering trader has set up here. He sells food, potions and ammunition for the coins you carry, and buys what you've found.",
                );
            }
            if (d < 1.8) {
                this.prompt = "Press E to trade";
                if (pressed) {
                    this.keys.delete("KeyE");
                    this.hooks.onTrade();
                }
                return;
            }
        }

        // The clue scroll's spot: a word when it's close, the spade when
        // it's here
        this.matchClueSpots();
        for (const clue of this.clueSpots) {
            const d = Math.hypot(clue.x - this.px, clue.z - this.pz);
            if (d < 6 && !clue.near) {
                clue.near = true;
                this.hooks.onMessage("The ground about here has been dug before. The spot is close.");
            }
            if (d < CLUE_DIG_RANGE) {
                this.prompt = "Press E to dig here";
                if (pressed) {
                    this.dig(clue);
                }
                return;
            }
        }

        // Chests, and the vault, which wants its key
        for (const chest of this.chests) {
            if (chest.opened || !near(chest.tile.x, chest.tile.z)) {
                continue;
            }
            if (chest.vault && !this.inventory.some((s) => s.id === VAULT_KEY)) {
                this.prompt = "The vault is locked. One of this map's champions carries the key.";
                return;
            }
            if (chest.boss && !this.inventory.some((s) => s.id === BOSS_KEY)) {
                this.prompt = "The golden chest is locked. The boss has its key.";
                return;
            }
            this.prompt = chest.vault
                ? "Press E to unlock the vault"
                : chest.boss
                  ? "Press E to open the golden chest"
                  : "Press E to open the chest";
            if (pressed) {
                this.openChest(chest);
            }
            return;
        }
    }

    // A chest opened, by this player unless said (the host opens them for
    // the guests, who ask)
    private openChest(chest: Chest, by: Hero = this.self): void {
        chest.opened = true;
        if (chest.actor) {
            this.scene.remove(chest.actor.root);
        }
        if (by === this.self) {
            this.chestsOpened++;
            if (chest.boss) {
                this.goldenOpened = true;
            }
        }
        const index = this.chests.indexOf(chest);
        if (this.coop?.role === "guest") {
            // The key's spent here; the host spills what's inside
            if (chest.vault) {
                removeItem(this.inventory, VAULT_KEY, 1);
                this.vaults++;
                this.hooks.onChanged();
            } else if (chest.boss) {
                removeItem(this.inventory, BOSS_KEY, 1);
                this.hooks.onChanged();
            }
            this.coop.send({ k: "open", c: index } satisfies UpMessage);
            return;
        }
        if (this.coop?.role === "host") {
            this.coop.send({ k: "opened", c: index, by: by.id } satisfies DownMessage);
        }
        // A mimic: no chest at all, but a champion of whatever lives here
        if (chest.mimic) {
            const pick = this.world.enemies[Math.floor(this.rng() * this.world.enemies.length)].def;
            void this.spawnEnemy(this.champion(pick), chest.tile).then((mimic) => {
                mimic.cooldown = 0.6;
                this.rouse(mimic);
            });
            this.announce("The chest bites!");
            return;
        }
        // A watched chest: what's about comes running
        if (chest.ambush) {
            let roused = 0;
            for (const e of this.enemies) {
                if (e.state === "idle" && !e.def.passive && Math.hypot(e.x - chest.tile.x, e.z - chest.tile.z) < 12) {
                    e.state = "chase";
                    roused++;
                }
            }
            if (roused > 0) {
                this.announce("The lid creaks. Something heard it.");
            }
        }
        // The chest is gone once opened; what was in it lies exactly where
        // it stood
        const tier = this.world.tier;
        const drop = (id: number, count: number) => this.dropPickup(id, count, chest.tile.x, chest.tile.z, 0);
        const gear = (tiers: { tier: number; weight: number }[], prizes = 0) =>
            this.dropGear(tiers, chest.tile.x, chest.tile.z, prizes, 0);
        const purse = (min: number, max: number) => Math.round(randInt(this.rng, min, max) * Math.pow(2.2, tier - 1));
        const potion = () => SHOP_POTIONS[Math.floor(this.rng() * SHOP_POTIONS.length)];
        // Nothing on a map is better than the map: the vault, the golden
        // chest and the caskets give the map's own tier, their chance of its
        // prize apart
        const own = [{ tier, weight: 1 }];
        if (chest.vault) {
            // The key goes in the lock; two pieces of the map's tier, and a
            // purse to match
            if (by.me) {
                removeItem(this.inventory, VAULT_KEY, 1);
                this.vaults++;
            }
            gear(own, PRIZE_CASKET);
            gear(own, PRIZE_CASKET);
            drop(COINS, purse(200, 400));
            if (by.me) {
                playChime(true);
            }
            this.announce("The vault swings open.");
            this.hooks.onChanged();
            return;
        }
        if (chest.boss) {
            // The boss's key goes in the lock. The prize: two or three pieces
            // of the map's tier (the tier's prizes among them), a potion and
            // a purse
            if (by.me) {
                removeItem(this.inventory, BOSS_KEY, 1);
                this.hooks.onChanged();
            }
            const count = 2 + (this.rng() < 0.5 ? 1 : 0);
            for (let i = 0; i < count; i++) {
                gear(own, PRIZE_BOSS_CHEST);
            }
            drop(potion(), 1);
            drop(COINS, purse(150, 300));
            this.announce("The golden chest creaks open.");
            return;
        }
        // About half the chests hold gear, mostly the map's own tier; the
        // rest supplies, or a purse
        const roll = this.rng();
        if (roll < 0.55) {
            const count = randInt(this.rng, this.world.chestItems[0], this.world.chestItems[1]);
            for (let i = 0; i < count; i++) {
                gear(this.world.lootTiers);
            }
        } else if (roll < 0.85) {
            if (!this.clueDropped && this.rng() < 0.15) {
                this.clueDropped = true;
                drop(CLUE_SCROLL, 1);
            } else if (this.rng() < 0.4) {
                drop(potion(), 1);
            } else {
                drop(FOOD_BY_TIER[Math.min(FOOD_BY_TIER.length - 1, tier - 1)], randInt(this.rng, 1, 2));
            }
        } else {
            // 15 to 40 until version 78, less than the food the same chest
            // might have held instead
            drop(COINS, purse(60, 150));
        }
        this.hooks.onMessage("The chest creaks open.");
    }

    // What fits of the grave's things comes back to the pack; the stone
    // goes once it's empty
    private takeGrave(): void {
        const grave = this.grave!;
        const left: ItemStack[] = [];
        let taken = 0;
        for (const stack of grave.items) {
            if (addItem(this.inventory, stack.id, stack.count, this.packSize)) {
                taken += stack.count;
            } else {
                left.push(stack);
            }
        }
        grave.items = left;
        if (left.length === 0) {
            this.graveTaken = true;
            this.scene.remove(grave.actor.root);
            this.hooks.onMessage("You take back everything you left here. The stone crumbles.");
        } else if (taken > 0) {
            this.hooks.onMessage(`You take back what fits. ${left.length} thing${left.length === 1 ? " stays" : "s stay"} in the grave.`);
        } else if (this.time - this.fullMessageAt > 2) {
            this.hooks.onMessage("Your pack is full.");
            this.fullMessageAt = this.time;
        }
        this.hooks.onChanged();
    }

    // A clue scroll picked up: its spot is an open tile a good walk off, and
    // the scroll says which way and how far from where you stand
    private setClue(): void {
        const reach = this.region.flowField({ x: this.px, z: this.pz });
        let spot: Tile | undefined;
        for (let tries = 0; tries < 30 && !spot; tries++) {
            const t = this.region.randomTile(this.rng, reach, CLUE_MIN_STEPS, new Set());
            if (t && this.region.flowAt(reach, t.x, t.z) <= CLUE_MAX_STEPS) {
                spot = t;
            }
        }
        let chosen = spot ?? this.region.randomTile(this.rng, reach, CLUE_MIN_STEPS, new Set()) ?? { x: this.px, z: this.pz };
        // Not on another scroll's spot, so each is a casket of its own
        const clash = (p: { x: number; z: number }) => this.clueSpots.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < CLUE_DIG_RANGE * 2);
        for (let tries = 0; tries < 30 && clash(chosen); tries++) {
            const other = this.region.randomTile(this.rng, reach, CLUE_MIN_STEPS, new Set());
            if (other) {
                chosen = other;
            }
        }
        this.clueSpots.push({ x: chosen.x, z: chosen.z, near: false });
        this.readClue();
    }

    // One spot per scroll in the pack: a scroll dropped (or taken from the
    // pack some other way) takes the newest spot with it
    private matchClueSpots(): void {
        const held = this.inventory.reduce((n, s) => n + (s.id === CLUE_SCROLL ? s.count : 0), 0);
        if (this.clueSpots.length > held) {
            this.clueSpots.length = held;
        }
    }

    // The scrolls' directions, from where you stand now (so reading again
    // nearer narrows a spot down), the nearest first
    readClue(): void {
        this.matchClueSpots();
        if (this.clueSpots.length === 0 || this.dead) {
            return;
        }
        const by = (c: { x: number; z: number }) => Math.hypot(c.x - this.px, c.z - this.pz);
        const spots = [...this.clueSpots].sort((a, b) => by(a) - by(b));
        const lines = spots.map((clue) => {
            const paces = Math.round(by(clue));
            return paces < 2 ? "dig where you stand" : `dig ${paces} paces to the ${this.compassTo(clue.x, clue.z)} of where you stand`;
        });
        this.hooks.onMessage(
            lines.length === 1
                ? `The scroll reads: ${lines[0]}.`
                : `Your ${lines.length} scrolls read: ${lines.map((l, i) => `${i + 1}) ${l}`).join("; ")}.`,
        );
    }

    // The casket: two pieces of gear of the map's tier (its prize among
    // them, now and then), and a purse
    private dig(clue: { x: number; z: number; near: boolean }): void {
        this.clueSpots = this.clueSpots.filter((c) => c !== clue);
        removeItem(this.inventory, CLUE_SCROLL, 1);
        this.clues++;
        this.player.play("idle");
        this.hooks.onMessage("You dig up a casket and prise it open.");
        this.hooks.onChanged();
        if (this.coop?.role === "guest") {
            // The host drops what's in it
            this.coop.send({ k: "dig", x: round2(clue.x), z: round2(clue.z) } satisfies UpMessage);
            return;
        }
        this.dropCasket(clue.x, clue.z);
    }

    // What a casket holds, spilled about the spot
    private dropCasket(x: number, z: number): void {
        const tier = this.world.tier;
        const scatter = () => [x + (this.rng() - 0.5) * 1.2, z + (this.rng() - 0.5) * 1.2] as const;
        for (let i = 0; i < 2; i++) {
            this.dropGear([{ tier, weight: 1 }], ...scatter(), PRIZE_CASKET);
        }
        this.dropPickup(COINS, Math.round(randInt(this.rng, 40, 80) * Math.pow(2.2, tier - 1)), ...scatter());
    }

    // -----------------------------------------------------------------------
    // Co-op: what the host sends (party.ts has the shapes)

    // The map as the host laid it out, for the guests, with every enemy on
    // it; after this, each new enemy goes on its own (spawnEnemy)
    private sendWorld(): void {
        const coop = this.coop;
        if (coop?.role !== "host") {
            return;
        }
        for (const e of this.enemies) {
            this.defCode(e.def);
        }
        const exits = this.exits.length > 0 ? this.exits : [{ x: this.px, z: this.pz }];
        coop.send({
            k: "world",
            exits: exits.map((e) => [round2(e.x), round2(e.z)] as [number, number]),
            chests: this.chests.map((c) => [round2(c.tile.x), round2(c.tile.z), c.vault ? 2 : c.boss ? 1 : 0]),
            trader: this.trader ? [round2(this.trader.x), round2(this.trader.z), round2(this.trader.rotation)] : undefined,
            ferry: this.ferry ? [round2(this.ferry.x), round2(this.ferry.z), round2(this.ferry.rotation)] : undefined,
            defs: this.defs.slice(),
            spawns: this.enemies.map((e) => this.spawnMessage(e)),
        } satisfies DownMessage);
        this.worldSent = true;
    }

    // An enemy's colour changed for good: enraged, or reborn
    private sendTint(e: Enemy, code: 1 | 2): void {
        e.tintCode = code;
        if (this.coop?.role === "host") {
            this.coop.send({ k: "tint", u: e.uid, c: code } satisfies DownMessage);
        }
    }

    // What this player's doing, as the others' copy of them plays it
    private selfAnim(): HeroAnim {
        if (this.dead) {
            return HERO_DEATH;
        }
        const clip = this.player.current;
        if (clip !== undefined && clip.startsWith("run")) {
            return HERO_RUN;
        }
        if (clip === undefined || clip.startsWith("idle")) {
            return HERO_IDLE;
        }
        return HERO_ATTACK;
    }

    private selfState(): HeroState {
        return [
            this.self.id,
            round2(this.px),
            round2(this.pz),
            round2(this.facing),
            Math.round(this.hp),
            this.maxHp,
            this.selfAnim(),
            this.attacks % 100,
            this.dead ? 1 : 0,
            prayCode(this.protect),
        ];
    }

    // What an enemy's model is playing, as a code
    private clipCode(e: Enemy): EnemyClip {
        switch (e.actor.current) {
            case "walk":
                return CLIP_WALK;
            case "attack":
                return CLIP_ATTACK;
            case "death":
                return CLIP_DEATH;
            default:
                return CLIP_IDLE;
        }
    }

    // The snapshot, SNAPSHOT_HZ times a second: every hero, and every enemy
    // that's up, or near a hero and moved (or due a keyframe), or just fallen
    private sendSnapshot(dt: number): void {
        const coop = this.coop;
        if (coop?.role !== "host") {
            return;
        }
        this.snapshotIn -= dt;
        if (this.snapshotIn > 0) {
            return;
        }
        this.snapshotIn = 1 / SNAPSHOT_HZ;
        this.snapshots++;
        const keyframe = this.snapshots % KEYFRAME_EVERY === 0;
        const heroes: HeroState[] = [];
        if (!this.done) {
            heroes.push(this.selfState());
        }
        for (const m of this.mates.values()) {
            if (!m.done) {
                heroes.push(m.state());
            }
        }
        // Every enemy near a hero that's changed since it was last sent (or
        // is due a keyframe, or has just fallen), nearest first, up to the
        // snapshot's limit: the rest stay changed and go next time
        const candidates: { e: Enemy; clip: EnemyClip; dist: number }[] = [];
        for (const e of this.enemies) {
            const clip = this.clipCode(e);
            const changed =
                Math.abs(e.x - e.sentX) > 0.05 || Math.abs(e.z - e.sentZ) > 0.05 || clip !== e.sentClip || e.state !== e.sentState || e.hp !== e.sentHp;
            if (e.state === "dead") {
                if (e.sentState === "dead") {
                    continue;
                }
            } else if (!changed && !keyframe) {
                continue;
            }
            let dist = Infinity;
            for (const h of heroes) {
                dist = Math.min(dist, Math.hypot(h[1] - e.x, h[2] - e.z));
            }
            if (dist > SNAPSHOT_RANGE && e.state !== "dead") {
                continue;
            }
            candidates.push({ e, clip, dist });
        }
        candidates.sort((a, b) => a.dist - b.dist);
        const shots: EnemyShot[] = [];
        for (const { e, clip } of candidates.slice(0, SNAPSHOT_MAX_ENEMIES)) {
            shots.push([e.uid, round1(e.x), round1(e.z), round1(e.facing), Math.round(e.hp), clip, e.attacks % 100, STATE_CODES[e.state]]);
            e.sentX = e.x;
            e.sentZ = e.z;
            e.sentClip = clip;
            e.sentState = e.state;
            e.sentHp = e.hp;
        }
        coop.send({
            k: "s",
            t: Math.round(this.time * 10) / 10,
            left: Math.round(this.timeLeft),
            f: (this.awake ? 1 : 0) | (this.closed ? 2 : 0),
            h: heroes,
            e: shots,
        } satisfies DownMessage);
    }

    // A guest's word on where it is, as often as the host's snapshots
    private sendMove(dt: number): void {
        const coop = this.coop;
        if (coop?.role !== "guest" || this.done) {
            return;
        }
        this.moveIn -= dt;
        if (this.moveIn > 0) {
            return;
        }
        this.moveIn = 1 / SNAPSHOT_HZ;
        coop.send({
            k: "move",
            x: round2(this.px),
            z: round2(this.pz),
            f: round2(this.facing),
            hp: Math.round(this.hp),
            mh: this.maxHp,
            a: this.selfAnim(),
            ac: this.attacks % 100,
            d: this.defenceTriple(),
            dead: this.dead ? 1 : 0,
            p: prayCode(this.protect),
        } satisfies UpMessage);
    }

    // -----------------------------------------------------------------------
    // Co-op: what a guest does with the host's word, and the host with a
    // guest's

    // A hero by their id: this player, or a mate
    private heroById(id: string): Hero | undefined {
        return id === this.self.id ? this.self : this.mates.get(id);
    }

    // A guest's copies of the host's enemies, eased to where the last
    // snapshot put them, playing what the host says they're playing
    private updateGhosts(dt: number): void {
        const k = 1 - Math.exp(-12 * dt);
        for (const e of this.enemies) {
            if (e.flash > 0) {
                e.flash -= dt;
                if (e.flash <= 0 && e.state !== "dead") {
                    tint(e.actor, e.tint);
                }
            }
            if (e.state === "dead") {
                e.deadFor += dt;
                if (e.deadFor > 4) {
                    this.scene.remove(e.actor.root);
                }
                if (e.bar) {
                    e.bar.group.visible = false;
                }
                continue;
            }
            e.x += (e.targetX - e.x) * k;
            e.z += (e.targetZ - e.z) * k;
            let turn = e.targetFacing - e.facing;
            turn = Math.atan2(Math.sin(turn), Math.cos(turn));
            e.facing += turn * k;
            if (e.attacks !== e.seenAttacks) {
                e.seenAttacks = e.attacks;
                play(e.actor, "attack", { once: true });
                this.hear(npcSound(e.def.npcId, "attack"), e.x, e.z, 0.35);
            } else if (e.sentClip === CLIP_WALK) {
                play(e.actor, "walk");
            } else if (e.sentClip === CLIP_IDLE || e.actor.current !== "attack") {
                play(e.actor, "idle");
            }
            e.actor.root.position.set(e.x, this.groundY(e.x, e.z), e.z);
            e.actor.root.rotation.y = e.facing;
            this.updateHealthBar(e, dt);
        }
    }

    // An enemy def from the host's table, for a guest's copy: what's drawn
    // and named; it fights nothing here
    private readonly ghostDefs = new Map<number, EnemyDef>();

    private ghostDef(code: number, lite: EnemyDefLite): EnemyDef {
        let def = this.ghostDefs.get(code);
        if (!def) {
            def = {
                id: `ghost:${code}`,
                npcId: lite.npc,
                name: lite.name,
                hp: lite.hp,
                damage: 0,
                speed: 0,
                radius: lite.radius,
                attackInterval: 1,
                attackRange: 0,
                aggro: 0,
                coins: [0, 0],
                foodChance: 0,
                scale: lite.scale,
                boss: lite.boss ? true : undefined,
                champion: lite.champion ? true : undefined,
                shoots: lite.shoots ? { style: lite.shoots, projectile: 0 } : undefined,
            };
            this.ghostDefs.set(code, def);
        }
        return def;
    }

    private async spawnGhost(message: SpawnMessage): Promise<void> {
        if (message.def) {
            this.defs[message.d] = message.def;
        }
        const lite = this.defs[message.d];
        if (!lite || this.ghosts.has(message.u) || this.ended) {
            return;
        }
        const def = this.ghostDef(message.d, lite);
        const e = await this.makeEnemy(def, message.x, message.z, message.f, message.t as Trait | undefined, message.u);
        e.key = !!message.key;
        this.ghosts.set(message.u, e);
    }

    // The map as the host laid it out
    private applyWorld(message: Extract<DownMessage, { k: "world" }>): void {
        this.exits = message.exits.map(([x, z]) => ({ x, z, found: false }));
        for (const exit of this.exits) {
            void createActor("locs", EXIT_LOC).then((a) => {
                if (!this.ended) {
                    this.placeExit(a, exit);
                }
            });
        }
        this.chests = message.chests.map(([x, z, kind]) => ({ tile: { x, z }, opened: false, boss: kind === 1, vault: kind === 2 }));
        for (const chest of this.chests) {
            void this.loadChest(chest);
        }
        if (message.trader) {
            const [x, z, rotation] = message.trader;
            this.trader = { x, z, rotation, seen: false };
            void this.loadTrader();
        }
        if (message.ferry) {
            const [x, z, rotation] = message.ferry;
            this.ferry = { x, z, rotation };
            void this.loadFerry();
        }
        this.defs.length = 0;
        this.defs.push(...message.defs);
        for (const spawn of message.spawns) {
            void this.spawnGhost(spawn);
        }
        this.hooks.onMessage(`There are ${this.exits.length} ways out, the nearest somewhere to the ${this.exitCompass()}: find one, or the boss will tell you.`);
    }

    private applySnapshot(s: Extract<DownMessage, { k: "s" }>): void {
        this.hostLeft = s.left;
        this.awake = (s.f & 1) !== 0;
        this.closed = (s.f & 2) !== 0;
        for (const state of s.h) {
            if (state[0] === this.self.id) {
                continue;
            }
            const m = this.mates.get(state[0]);
            if (m && !m.done) {
                m.apply(state);
            }
        }
        for (const [u, x, z, facing, hp, clip, attacks, state] of s.e) {
            const e = this.ghosts.get(u);
            if (!e) {
                continue;
            }
            e.targetX = x;
            e.targetZ = z;
            e.targetFacing = facing;
            if (Math.hypot(x - e.x, z - e.z) > 5) {
                e.x = x;
                e.z = z;
                e.facing = facing;
            }
            // Someone else's hit shows as one; this player's showed already
            if (hp < e.hp && this.time - e.myHitAt > 0.4 && e.state !== "dead") {
                e.flash = 0.12;
                e.barShown = BAR_SECONDS;
                tint(e.actor, new THREE.Color(1.6, 0.6, 0.6));
                this.splat(e.x, e.z, e.actor.height * (e.def.scale ?? 1) * 0.7, e.hp - hp);
            }
            e.hp = hp;
            const name = STATE_NAMES[state];
            if (name === "dead") {
                this.ghostDied(e);
            } else {
                e.state = name;
            }
            e.sentClip = clip;
            e.attacks = attacks;
        }
    }

    private ghostDied(e: Enemy): void {
        if (e.state === "dead") {
            return;
        }
        e.state = "dead";
        e.hp = 0;
        e.deadFor = 0;
        tint(e.actor, new THREE.Color(1, 1, 1));
        play(e.actor, "death", { once: true });
        this.hear(npcSound(e.def.npcId, "death"), e.x, e.z, 0.5);
    }

    private static goneText(name: string, how: "extracted" | "died" | "left"): string {
        return how === "extracted" ? `${name} escaped with their loot.` : how === "died" ? `${name} has died.` : `${name} left the run.`;
    }

    // A mate's out of the run: their copy goes (or, fallen, stays lying
    // where they fell, for everyone to see), and on the host the rest of the
    // party hears
    private mateGone(mate: Mate, how: "extracted" | "died" | "left"): void {
        if (mate.done) {
            return;
        }
        mate.done = true;
        if (how === "died" || mate.dead) {
            mate.lieDown();
        } else {
            mate.remove();
        }
        this.hooks.onMessage(Run.goneText(mate.name, how));
        if (this.coop?.role === "host") {
            this.coop.send({ k: "gone", id: mate.id, how } satisfies DownMessage);
        }
        this.checkPartyDone();
    }

    // What the host sent (a guest's side)
    receiveDown(message: unknown): void {
        if (!isDown(message) || this.ended || this.coop?.role !== "guest") {
            return;
        }
        const me = this.self.id;
        switch (message.k) {
            case "s":
                this.applySnapshot(message);
                break;
            case "world":
                this.applyWorld(message);
                break;
            case "spawn":
                void this.spawnGhost(message);
                break;
            case "gear":
                if (message.id !== this.coop?.me) {
                    this.mates.get(message.id)?.wear(message.e);
                }
                break;
            case "tint": {
                const e = this.ghosts.get(message.u);
                if (e) {
                    e.tintCode = message.c;
                    e.tint = message.c === 1 ? new THREE.Color(1.4, 0.75, 0.75) : message.c === 2 ? new THREE.Color(0.8, 1.25, 0.8) : new THREE.Color(1, 1, 1);
                    tint(e.actor, e.tint);
                    if (message.c === 2) {
                        e.actor.root.scale.setScalar((e.def.scale ?? 1) * 1.15);
                    }
                }
                break;
            }
            case "drop":
                this.dropPickup(message.i, message.n, message.x, message.z, 0, message.u, !!message.noLoot);
                break;
            case "balloons":
                if (Array.isArray(message.b)) {
                    for (const [u, x, z, c] of message.b) {
                        this.addBalloon(Number(u), Number(x), Number(z), Number(c) || 0);
                    }
                }
                break;
            case "burst": {
                const b = this.balloons.find((x) => x.uid === message.u);
                if (b) {
                    this.burstBalloon(b);
                }
                break;
            }
            case "share":
                if (Array.isArray(message.s)) {
                    this.takeShare(String(message.by), Number(message.n) || 0, message.s);
                }
                break;
            case "taken": {
                const p = this.pickups.find((x) => x.uid === message.u);
                this.requested.delete(message.u);
                if (p) {
                    if (message.to === me) {
                        this.takeItem(p.id, message.n ?? p.count, p.noLoot);
                        this.hooks.onChanged();
                    }
                    // Part taken: the rest stays where it is
                    if (message.left !== undefined && message.left > 0) {
                        p.count = message.left;
                    } else {
                        this.removePickup(p);
                    }
                }
                break;
            }
            case "opened": {
                const chest = this.chests[message.c];
                if (chest) {
                    chest.opened = true;
                    if (chest.actor) {
                        this.scene.remove(chest.actor.root);
                    }
                }
                break;
            }
            case "hazard":
                this.hazard(message.x, message.z, message.r, message.l, () => undefined);
                break;
            case "shot": {
                const hero = this.heroById(message.to);
                if (hero) {
                    void this.launch(message.x, message.z, message.y, message.p, { hero, visual: true, impact: message.i, cast: message.c });
                }
                break;
            }
            case "pshot": {
                const mate = this.mates.get(message.from);
                const e = this.ghosts.get(message.u);
                if (mate && e && message.from !== me) {
                    const spell = this.mateSpell(mate, message.s);
                    void this.launch(mate.x, mate.z, this.groundY(mate.x, mate.z) + 1.0, message.p, { target: e, visual: true, impact: message.i, hitSound: spell?.hitSound });
                }
                break;
            }
            case "hurt":
                if (message.to === me) {
                    this.applyHit(message.hit, message.by, message.style, !!message.pierce, !!message.fixed);
                    if (message.venom && !this.dead) {
                        this.poison();
                    }
                }
                break;
            case "kill": {
                const e = this.ghosts.get(message.u);
                if (e) {
                    this.ghostDied(e);
                }
                if (message.by === me) {
                    this.kills++;
                    if (message.champion) {
                        this.championKills++;
                    }
                    if (this.stats.ranged) {
                        this.rangedKills++;
                    }
                }
                if (message.boss) {
                    this.bossKills++;
                    this.revealNearestExit();
                    const name = e?.def.name ?? "The boss";
                    this.hooks.onMessage(`${name} falls. The golden chest is yours. The nearest way out is ${this.exitDirection()}.`);
                    const pets = this.carry.pets ?? [];
                    if (!pets.includes(this.world.id) && !this.petFound && this.rng() < 1 / PET_ONE_IN) {
                        this.petFound = this.world.id;
                        this.hooks.onMessage(`Something small crawls out from under ${name}. It seems to like you.`);
                    }
                }
                break;
            }
            case "msg":
                if (!message.to || message.to === me) {
                    this.hooks.onMessage(message.text);
                }
                break;
            case "go":
                this.holding = false;
                this.prompt = "";
                this.clock.getDelta();
                break;
            case "revive":
                if (message.id === me) {
                    this.standUp(message.by);
                } else {
                    const mate = this.mates.get(message.id);
                    if (mate) {
                        mate.revivedAt = this.time;
                    }
                }
                break;
            case "gone": {
                const mate = this.mates.get(message.id);
                if (mate) {
                    this.mateGone(mate, message.how);
                }
                break;
            }
            case "over":
                this.partyOver = true;
                if (!this.done) {
                    this.hooks.onMessage(
                        this.dead ? "The host's run is over, with you still down. Everything you carried is lost." : "The host's run is over. You're out, with what you carry.",
                    );
                }
                this.end(this.done ?? (this.dead ? "died" : "extracted"));
                break;
        }
    }

    // What a guest sent (the host's side)
    receiveUp(from: string, message: unknown): void {
        if (!isUp(message) || this.ended || this.coop?.role !== "host") {
            return;
        }
        const coop = this.coop;
        const mate = this.mates.get(from);
        if (!mate || mate.done) {
            return;
        }
        switch (message.k) {
            case "move": {
                const wasDown = mate.dead;
                mate.move(message.x, message.z, message.f, message.hp, message.mh, message.a, message.ac, message.d, message.dead === 1);
                // Their protection, for its icon over them here and in the snapshot
                mate.protect = PRAY_NAMES[message.p ?? 0] ?? "none";
                // A guest just fell with others still standing: everyone hears
                if (!wasDown && mate.dead && ((!this.dead && !this.done) || this.othersRemain())) {
                    this.announce(Run.downText(mate.name));
                }
                break;
            }
            case "revive":
                this.revive(message.id, mate);
                break;
            case "hit": {
                const e = this.enemies.find((x) => x.uid === message.u);
                if (e && e.state !== "dead") {
                    this.damageEnemy(e, message.d, mate, {
                        slow: !!message.slow,
                        stall: !!message.stall,
                        freeze: typeof message.frz === "number" ? Math.min(20, message.frz) : undefined,
                        weaken: typeof message.wk === "number" ? Math.min(0.15, message.wk) : undefined,
                        poison: typeof message.psn === "number" ? Math.min(30, message.psn) : undefined,
                    });
                }
                break;
            }
            case "shot": {
                const e = this.enemies.find((x) => x.uid === message.u);
                if (e) {
                    const spell = this.mateSpell(mate, message.s);
                    coop.send({ k: "pshot", from, u: message.u, p: message.p, i: message.i, s: spell?.id } satisfies DownMessage);
                    void this.launch(mate.x, mate.z, this.groundY(mate.x, mate.z) + 1.0, message.p, { target: e, visual: true, impact: message.i, hitSound: spell?.hitSound });
                }
                break;
            }
            case "take": {
                const p = this.pickups.find((x) => x.uid === message.u);
                if (p && p.id === COINS && this.splitsLoot()) {
                    this.shareCoins(from, p.count);
                    coop.send({ k: "taken", u: p.uid } satisfies DownMessage);
                    this.removePickup(p);
                    break;
                }
                if (p) {
                    // Part of it, when that's all the guest has room for
                    const n = Math.floor(message.n ?? p.count);
                    if (n > 0 && n < p.count) {
                        p.count -= n;
                        coop.send({ k: "taken", u: p.uid, to: from, n, left: p.count } satisfies DownMessage);
                    } else {
                        coop.send({ k: "taken", u: p.uid, to: from } satisfies DownMessage);
                        this.removePickup(p);
                    }
                }
                break;
            }
            case "drop":
                if (message.n > 0 && message.n <= 1000) {
                    this.dropPickup(message.i, message.n, message.x, message.z, 0, undefined, true);
                }
                break;
            case "open": {
                const chest = this.chests[message.c];
                if (chest && !chest.opened) {
                    this.openChest(chest, mate);
                }
                break;
            }
            case "dig":
                this.dropCasket(message.x, message.z);
                this.announce(`${mate.name} digs up a casket.`);
                break;
            case "wake": {
                const woke = this.wakeNear(message.x, message.z, EXTRACT_WAKE);
                this.announce(woke > 0 ? `${mate.name} opens the way out. Everything near has heard it.` : `${mate.name} opens the way out. Nothing stirs.`);
                break;
            }
            case "gear":
                // Drawn here, and passed on to the other guests
                mate.wear(message.e);
                coop.send({ k: "gear", id: from, e: message.e } satisfies DownMessage);
                break;
            case "loaded":
                this.waitingFor.delete(from);
                break;
            case "gone":
                this.mateGone(mate, message.how);
                break;
        }
    }

    // The relay says a player left the room
    coopLeft(id: string): void {
        const mate = this.mates.get(id);
        if (mate && !mate.done) {
            this.mateGone(mate, "left");
        }
    }

    // The connection to the party's gone: a guest is out with what they
    // carry; the host plays on alone
    coopLost(text: string): void {
        if (this.ended || !this.coop) {
            return;
        }
        this.hooks.onMessage(text);
        if (this.coop.role === "guest") {
            this.partyOver = true;
            this.end(this.done ?? (this.dead ? "died" : "extracted"));
            return;
        }
        for (const mate of this.mates.values()) {
            if (!mate.done) {
                mate.done = true;
                mate.remove();
            }
        }
        this.holding = false;
        this.checkPartyDone();
    }

    // -----------------------------------------------------------------------
    // The trader

    // Buying from the trader: the coins carried pay, the pack has to have room
    buy(id: number, count: number, cost: number): boolean {
        if (this.dead) {
            return false;
        }
        if (this.coins < cost) {
            this.hooks.onMessage("You haven't the coins for that.");
            return false;
        }
        if (!canCarry(this.inventory, id, count)) {
            this.hooks.onMessage(carryLimitText(id));
            return false;
        }
        if (!addItem(this.inventory, id, count, this.packSize)) {
            this.hooks.onMessage("Your pack is full.");
            return false;
        }
        this.coins -= cost;
        this.traderBuys++;
        this.hooks.onChanged();
        return true;
    }

    // Selling him a piece from the pack, at the shop's buying price
    sell(id: number): boolean {
        const item = getItem(id);
        // The owner's kept kit (kit.ts) isn't for selling
        if (isKept(id)) {
            this.hooks.onMessage(`${item.name} is kept: it isn't for sale.`);
            return false;
        }
        if (this.dead || !item.slot || !removeItem(this.inventory, id, 1)) {
            return false;
        }
        this.coins += sellPrice(item);
        this.coinsFound += sellPrice(item);
        this.hooks.onChanged();
        return true;
    }

    // -----------------------------------------------------------------------
    // What the inventory panel does

    eat(id: number): void {
        const item = getItem(id);
        if (!item.heal || this.dead) {
            return;
        }
        // One bite at a time: the next waits EAT_DELAY
        if (this.eatIn > 0) {
            if (this.time - this.fullMessageAt > 1.5) {
                this.hooks.onMessage("You're still chewing.");
                this.fullMessageAt = this.time;
            }
            return;
        }
        if (removeItem(this.inventory, id, 1)) {
            this.eatIn = EAT_DELAY;
            this.hp = Math.min(this.maxHp, this.hp + item.heal);
            this.ate++;
            // Food settles poison
            if (this.poisonTicks > 0) {
                this.poisonTicks = 0;
                this.hooks.onMessage(`You eat the ${item.name.toLowerCase()}. The poison settles.`);
            } else {
                this.hooks.onMessage(`You eat the ${item.name.toLowerCase()}.`);
            }
            this.hooks.onChanged();
        }
    }

    // Something put down from the pack, a step ahead: to make room, or for
    // a mate to pick up (in a party the host lays it there for everyone)
    dropItem(id: number, count: number): void {
        // The gilded pieces are the owner's test character's alone, so they
        // aren't put down where a mate could take one (version 83)
        if (getItem(id).exclusive) {
            this.hooks.onMessage(`${getItem(id).name} stays with you.`);
            return;
        }
        if (this.dead || this.done || !removeItem(this.inventory, id, count)) {
            return;
        }
        const item = getItem(id);
        const x = this.px + Math.sin(this.facing) * 1.3;
        const z = this.pz + Math.cos(this.facing) * 1.3;
        const [dx, dz] = this.region.fits(x, z, 0.1) ? [x, z] : [this.px, this.pz];
        if (this.coop?.role === "guest") {
            this.coop.send({ k: "drop", i: id, n: count, x: round2(dx), z: round2(dz) } satisfies UpMessage);
        } else {
            this.dropPickup(id, count, dx, dz, 0, undefined, true);
        }
        this.hooks.onMessage(`You drop ${count > 1 ? count + " " : ""}${item.name}.`);
        this.hooks.onChanged();
    }

    // F eats what fills the gap best: the biggest heal that isn't wasted,
    // else the smallest there is
    eatHotkey(): void {
        const stack = this.foodToEat();
        if (stack) {
            this.eat(stack.id);
        }
    }

    foodToEat(): ItemStack | undefined {
        const missing = this.maxHp - this.hp;
        let best: ItemStack | undefined;
        let bestHeal = 0;
        let smallest: ItemStack | undefined;
        let smallestHeal = Infinity;
        for (const stack of this.inventory) {
            const heal = getItem(stack.id).heal;
            if (!heal) {
                continue;
            }
            if (heal <= missing && heal > bestHeal) {
                best = stack;
                bestHeal = heal;
            }
            if (heal < smallestHeal) {
                smallest = stack;
                smallestHeal = heal;
            }
        }
        return best ?? smallest;
    }

    // 1 to 4 drink a potion of that kind from the pack
    drinkKind(kind: Potion): void {
        const stack = this.inventory.find((s) => getItem(s.id).potion === kind);
        if (stack) {
            this.drink(stack.id);
        }
    }

    drink(id: number): void {
        const item = getItem(id);
        if (!item.potion || this.dead || !removeItem(this.inventory, id, 1)) {
            return;
        }
        if (item.potion === "prayer") {
            // Straight onto the bar, nothing to wear off
            this.prayer = Math.min(100, this.prayer + PRAYER_RESTORE);
        } else {
            this.boosts[item.potion] = POTION_SECONDS;
            this.applyStats();
            if (item.potion === "brew") {
                this.hp = Math.min(this.maxHp, this.hp + 40);
            }
        }
        this.drank++;
        this.hooks.onMessage(`You drink the ${item.name.toLowerCase()}.`);
        this.hooks.onChanged();
    }

    private updateBoosts(dt: number): void {
        if (this.eatIn > 0) {
            this.eatIn -= dt;
        }
        for (const kind of Object.keys(this.boosts) as Potion[]) {
            if (this.boosts[kind] <= 0) {
                continue;
            }
            this.boosts[kind] -= dt;
            if (this.boosts[kind] <= 0) {
                this.boosts[kind] = 0;
                this.applyStats();
                this.hooks.onMessage(kind === "brew" ? "The brew wears off." : `The ${kind} potion wears off.`);
            }
        }
    }

    // The gear's numbers, with the pet's gift and the potions on top
    private applyStats(): void {
        const stats = gearStats(this.equipment, this.wear);
        applyPetStats(stats, this.petBuff);
        if (this.boosts.strength > 0) {
            stats.damage = Math.round(stats.damage * 1.25);
        }
        if (this.boosts.defence > 0) {
            stats.defence += 20;
            stats.defenceVs.melee += 20;
            stats.defenceVs.ranged += 20;
            stats.defenceVs.magic += 20;
        }
        if (this.boosts.brew > 0) {
            stats.hp += 15;
        }
        this.stats = stats;
        const maxHp = BASE_HP + stats.hp;
        this.hp = Math.min(this.hp, maxHp);
        this.maxHp = maxHp;
    }

    equipFromInventory(id: number): void {
        if (this.dead) {
            return;
        }
        if (equip(this.equipment, this.inventory, id, this.packSize)) {
            this.refreshStats();
        } else {
            this.hooks.onMessage("No room in your pack to swap that.");
        }
    }

    unequipSlot(slot: keyof Equipment): void {
        if (this.dead) {
            return;
        }
        if (unequip(this.equipment, this.inventory, slot, this.packSize)) {
            this.refreshStats();
        } else {
            this.hooks.onMessage("Your pack is full.");
        }
    }

    // The crown over this player's head, once the key has checked out
    private wearCrown(): void {
        const crown = crownVerified(crownKey());
        if (!crown || this.crown || this.ended || this.done === "extracted") {
            return;
        }
        this.crown = crownSprite(crown);
        this.scene.add(this.crown);
    }

    // Worn gear changed: build the look again in place
    private rebuildLook(): void {
        const generation = ++this.lookGeneration;
        void PlayerLook.create(this.character, this.equipment).then((look) => {
            if (generation !== this.lookGeneration || this.ended) {
                return;
            }
            const old = this.player;
            this.scene.remove(old.root);
            this.player = look;
            look.stance = this.stats.weapon?.stance;
            look.root.scale.setScalar(this.character.size);
            look.root.position.copy(old.root.position);
            look.root.rotation.copy(old.root.rotation);
            look.play(old.current && old.current !== "idle" ? old.current : "idle", {
                once: old.current === "death",
            });
            this.scene.add(look.root);
        });
    }

    private refreshStats(): void {
        this.applyStats();
        this.rebuildLook();
        this.hooks.onChanged();
        // The party draws this player in the new gear too
        const coop = this.coop;
        if (coop && !this.ended) {
            const e = { ...this.equipment };
            if (coop.role === "guest") {
                coop.send({ k: "gear", e } satisfies UpMessage);
            } else {
                coop.send({ k: "gear", id: coop.me, e } satisfies DownMessage);
            }
        }
    }
}
