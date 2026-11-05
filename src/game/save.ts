// What persists between runs, in localStorage: the stash, coins, what's worn
// and who the character is.
import { ITEM_BY_ID, Slot, rollShopStock } from "../content/items";
import { DEFAULT_COLORS, DEFAULT_KITS } from "./player";

export type ItemStack = { id: number; count: number };
export type Equipment = Partial<Record<Slot, number>>;

export type Character = {
    name: string;
    // Body kit per part (hair, jaw, torso, arms, hands, legs, feet)
    kits: number[];
    // Colour choice per group (hair, torso, legs, feet, skin)
    colors: number[];
    // Height scale
    size: number;
    // The name's colour, one of crown.ts's NAME_COLORS: drawn only while the
    // browser holds a crown key that checks out (version 73)
    nameColor?: string;
};

// The save's shape. A save from an older version is dropped on load, so a
// change that should start everyone fresh raises this.
export const SAVE_VERSION = 3;

export type SaveData = {
    version: typeof SAVE_VERSION;
    coins: number;
    stash: ItemStack[];
    // Packed for the next run: lost on death, back in the stash on extraction
    backpack: ItemStack[];
    equipment: Equipment;
    character: Character;
    // What the shop has on its shelves, rolled again after every run
    shop: number[];
    stats: Stats;
    // Tasks done (content/tasks.ts), each paid once
    tasks: string[];
    // The item insured for the next run: it comes home if you don't
    insured?: number;
    // The guild's upgrades, bought with coins (UPGRADES has what each does)
    upgrades: Upgrades;
    // Gravestones: where you last died on a map, with what you carried in
    // it, for the next GRAVE_RUNS runs (one a map; main.ts keeps them)
    graves: Grave[];
    // Pets found (the map whose boss dropped each), and the one following
    pets: string[];
    pet?: string;
    // How worn each piece of armour is, 0 to 1, by item id: every hit taken
    // wears what's worn, and the guild repairs it (inventory.ts has the
    // numbers)
    wear: Record<number, number>;
    // The last few maps started, newest first, for the title screen
    recentMaps: string[];
};

export type Grave = { map: string; x: number; z: number; items: ItemStack[]; runsLeft: number };
export const GRAVE_RUNS = 2;

export type Upgrades = { pack: number; shop: number; insurance: number; spec: number };

// What each upgrade does per level, and what the levels cost
export const UPGRADES: Record<keyof Upgrades, { name: string; effect: string; costs: number[] }> = {
    pack: { name: "A bigger pack", effect: "four more pack slots a level", costs: [1500, 6000] },
    shop: { name: "Wider shelves", effect: "two more pieces of gear in the shop a level", costs: [800, 3000] },
    insurance: { name: "Guild cover", effect: "insurance a quarter cheaper a level", costs: [1000, 4000] },
    spec: { name: "Battle training", effect: "the special attack bar fills half again as fast a level", costs: [2000, 8000] },
};

export function packSize(save: SaveData): number {
    return 28 + 4 * save.upgrades.pack;
}

// The record, across every run
export type Stats = {
    runs: number;
    extractions: number;
    deaths: number;
    deepest: number;
    kills: number;
    bossKills: number;
    championKills: number;
    rangedKills: number;
    // Most coins carried out of a run, and the quickest escape in seconds (0 for none yet)
    bestHaul: number;
    fastestEscape: number;
    // Maps escaped from, maps whose boss has fallen, and maps beaten: escaped
    // from in a run where its boss fell (the next map opens on that)
    mapsEscaped: string[];
    bossesBeaten: string[];
    mapsBeaten: string[];
    // Clue scrolls dug up, gravestones emptied, and vaults unlocked
    clues: number;
    graves: number;
    vaults: number;
};

const KEY = "dungeon-extraction-save";

// Character slots (version 79): a browser holding a crown key (crown.ts) has
// a second character, a whole save of its own (stash, coins, progress,
// look), kept beside the first under its own key. Which one is played is
// kept too; everyone else only ever has the first.
export const CHARACTER_SLOTS = 2;
const SLOT_STORAGE = "dungeon-extraction-slot";

function slotKey(slot: number): string {
    return slot === 0 ? KEY : `${KEY}-${slot + 1}`;
}

// The slot being played: 0 (the first) unless a crowned browser switched
export function activeSlot(): number {
    try {
        const slot = Number(localStorage.getItem(SLOT_STORAGE) ?? 0);
        return Number.isInteger(slot) && slot >= 0 && slot < CHARACTER_SLOTS ? slot : 0;
    } catch {
        return 0;
    }
}

export function setActiveSlot(slot: number): void {
    try {
        if (slot === 0) {
            localStorage.removeItem(SLOT_STORAGE);
        } else {
            localStorage.setItem(SLOT_STORAGE, String(slot));
        }
    } catch {
        // No storage: always the first
    }
}

// Another slot's save, to name it on the switch (undefined: nobody there yet)
export function peekSlot(slot: number): SaveData | undefined {
    try {
        const raw = localStorage.getItem(slotKey(slot));
        return raw ? parseSave(raw) : undefined;
    } catch {
        return undefined;
    }
}

export function newSave(): SaveData {
    return {
        version: SAVE_VERSION,
        coins: 50,
        // The guild's starter kit
        stash: [{ id: 1129, count: 1 }],
        backpack: [{ id: 315, count: 8 }],
        equipment: { weapon: 1277 },
        character: { name: "Adventurer", kits: DEFAULT_KITS.slice(), colors: DEFAULT_COLORS.slice(), size: 1 },
        shop: rollShopStock(Math.random, 1),
        stats: {
            runs: 0,
            extractions: 0,
            deaths: 0,
            deepest: 0,
            kills: 0,
            bossKills: 0,
            championKills: 0,
            rangedKills: 0,
            bestHaul: 0,
            fastestEscape: 0,
            mapsEscaped: [],
            bossesBeaten: [],
            mapsBeaten: [],
            clues: 0,
            graves: 0,
            vaults: 0,
        },
        tasks: [],
        upgrades: { pack: 0, shop: 0, insurance: 0, spec: 0 },
        graves: [],
        pets: [],
        wear: {},
        recentMaps: [],
    };
}

// A save from its JSON, brought up to date; undefined if it isn't one
export function parseSave(raw: string): SaveData | undefined {
    try {
        const data = JSON.parse(raw) as SaveData;
        if (data.version !== SAVE_VERSION || !data.character || !Array.isArray(data.stash)) {
            return undefined;
        }
        const fresh = newSave();
        const save = { ...fresh, ...data };
        // Saves from before the record grew, or tasks
        save.stats = { ...fresh.stats, ...(data.stats ?? {}) };
        save.upgrades = { ...fresh.upgrades, ...(data.upgrades ?? {}) };
        if (!Array.isArray(save.tasks)) {
            save.tasks = [];
        }
        // Saves from before gravestones and pets
        if (!Array.isArray(save.graves)) {
            save.graves = [];
        }
        if (!Array.isArray(save.pets)) {
            save.pets = [];
        }
        if (save.pet !== undefined && !save.pets.includes(save.pet)) {
            save.pet = undefined;
        }
        if (!save.wear || typeof save.wear !== "object") {
            save.wear = {};
        }
        if (!Array.isArray(save.recentMaps)) {
            save.recentMaps = [];
        }
        // Empty stacks (a deposit that went wrong before version 39) go, and
        // so does anything the game no longer has (the Santa hat, say)
        const whole = (list: ItemStack[]) => list.filter((s) => s && typeof s.id === "number" && s.count > 0 && ITEM_BY_ID.has(s.id));
        save.stash = whole(save.stash);
        save.backpack = whole(Array.isArray(save.backpack) ? save.backpack : []);
        for (const grave of save.graves) {
            grave.items = whole(grave.items ?? []);
        }
        for (const [slot, id] of Object.entries(save.equipment)) {
            if (id === undefined || !ITEM_BY_ID.has(id)) {
                delete save.equipment[slot as Slot];
            }
        }
        if (save.insured !== undefined && !ITEM_BY_ID.has(save.insured)) {
            save.insured = undefined;
        }
        if (Array.isArray(save.shop)) {
            save.shop = save.shop.filter((id) => ITEM_BY_ID.has(id));
        }
        // Saves from before looks were built from body kits
        if (!Array.isArray(save.character.kits) || !Array.isArray(save.character.colors)) {
            save.character = { ...newSave().character, name: save.character.name, size: save.character.size ?? 1, nameColor: save.character.nameColor };
        }
        if (typeof save.character.nameColor !== "string") {
            delete save.character.nameColor;
        }
        if (!Array.isArray(save.shop)) {
            save.shop = rollShopStock(Math.random, Math.max(1, save.stats?.deepest ?? 1));
        }
        return save;
    } catch {
        return undefined;
    }
}

// The save in this browser, or a new one; `wiped` says a save from an older
// version (or a broken one) was there and has been dropped
// The slot this page loaded, and writes to: fixed for the page's life, so a
// second tab that switched characters can't have this one write over the
// other character
let pageSlot = 0;

export function loadedSlot(): number {
    return pageSlot;
}

export function loadSave(): { save: SaveData; wiped: boolean } {
    pageSlot = activeSlot();
    const raw = localStorage.getItem(slotKey(pageSlot));
    const save = raw ? parseSave(raw) : undefined;
    if (save) {
        return { save, wiped: false };
    }
    const fresh = newSave();
    if (raw) {
        writeSave(fresh);
    }
    return { save: fresh, wiped: !!raw };
}

// A save as text to carry to another browser, with a tag in front so it's
// plainly a save code. DX2 (version 101): the stash and pack as bare ids
// (or [id, count]), the JSON deflated and in URL-safe base64, a third of
// the length or less. DX1, the JSON as it is in plain base64, still loads,
// and is what a browser without the compressor gets.
const CODE_TAG = "DX1-";
const PACKED_TAG = "DX2-";

type PackedStack = number | [number, number];

function packStacks(list: ItemStack[]): PackedStack[] {
    return list.map((s) => (s.count === 1 ? s.id : [s.id, s.count]));
}

function unpackStacks(list: unknown): unknown {
    if (!Array.isArray(list)) {
        return list;
    }
    return list.map((s: unknown) => (typeof s === "number" ? { id: s, count: 1 } : Array.isArray(s) ? { id: Number(s[0]), count: Number(s[1]) } : s));
}

// Bytes to base64 and back, a piece at a time (one spread of a big save's
// bytes into String.fromCharCode can overflow the call stack)
function toBase64(bytes: Uint8Array): string {
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(text);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function run(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
    const writer = stream.writable.getWriter();
    void writer.write(bytes);
    void writer.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function saveCode(save: SaveData): Promise<string> {
    if (typeof CompressionStream === "undefined") {
        return CODE_TAG + toBase64(new TextEncoder().encode(JSON.stringify(save)));
    }
    const packed = { ...save, stash: packStacks(save.stash), backpack: packStacks(save.backpack) };
    const deflated = await run(new TextEncoder().encode(JSON.stringify(packed)), new CompressionStream("deflate-raw"));
    return PACKED_TAG + toBase64(deflated).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Undefined if it isn't one: no tag, cut short or garbled, or from a save
// version this game no longer takes
export async function parseSaveCode(code: string): Promise<SaveData | undefined> {
    // Spaces and line breaks a chat app put in don't count
    const trimmed = code.replace(/\s+/g, "");
    try {
        if (trimmed.startsWith(PACKED_TAG)) {
            if (typeof DecompressionStream === "undefined") {
                return undefined;
            }
            let body = trimmed.slice(PACKED_TAG.length).replace(/-/g, "+").replace(/_/g, "/");
            body += "=".repeat((4 - (body.length % 4)) % 4);
            const json = new TextDecoder().decode(await run(fromBase64(body), new DecompressionStream("deflate-raw")));
            const data = JSON.parse(json) as Record<string, unknown>;
            data.stash = unpackStacks(data.stash);
            data.backpack = unpackStacks(data.backpack);
            return parseSave(JSON.stringify(data));
        }
        if (trimmed.startsWith(CODE_TAG)) {
            return parseSave(new TextDecoder().decode(fromBase64(trimmed.slice(CODE_TAG.length))));
        }
    } catch {
        // Cut short or garbled
    }
    return undefined;
}

export function writeSave(save: SaveData): void {
    localStorage.setItem(slotKey(pageSlot), JSON.stringify(save));
}

export function resetSave(): SaveData {
    const save = newSave();
    writeSave(save);
    return save;
}
