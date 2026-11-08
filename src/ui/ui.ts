// The screens: menu, stash, shop, character, settings, the in-run HUD and
// the run's summary. Plain DOM on top of the canvas, which shows the
// character in the world behind every screen but the HUD (menu.ts).
import { WORLDS, WORLD_BY_ID, getWorld, mapBefore, mapUnlocked, tierUnlocked } from "../content/worlds";
import {
    AMMO_LIMITS,
    COINS,
    ammoOfTier,
    FOOD_BY_TIER,
    FOOD_LIMIT,
    ItemDef,
    POTION_EFFECT,
    Potion,
    SHOP_AMMO,
    SHOP_FOOD,
    SHOP_POTIONS,
    SLOTS,
    Slot,
    ITEM_BY_ID,
    STRENGTH_NAME,
    TIER_COLOURS,
    WEAK_TO,
    formatCoins,
    tierGlows,
    getItem,
    isPrize,
    price,
    specialOf,
    weaponStyle,
    PRAYER_BONUS_SCALE,
} from "../content/items";
import { iconElement, setIcon } from "../game/icons";
import { interfaceIcon } from "./interface-icons";
import { assetUrl } from "../game/paths";
import {
    AIR as AIR_RUNE,
    ANCIENT_ELEMENTS,
    ANCIENT_FAMILIES,
    BOOKS,
    Book,
    EARTH,
    ELEMENTS,
    FAMILIES,
    FIRE,
    POISON_EVERY,
    POISON_HITS,
    SPELL_BY_ID,
    SpellDef,
    WATER,
    WEAKEN_SECONDS,
    castsAncients,
    castsLeft,
    ownSpells,
    poweredSpell,
    catalystOfTier,
    spellScale,
    staffCasts,
} from "../content/spells";
import { TASKS, Task } from "../content/tasks";
import { isKept, restoreCrownPets } from "../game/kit";
import { STARTER_KITS, StarterKit, applyStarter } from "../game/starter";
import { Chat } from "./chat";
import { FullMap } from "./fullmap";
import { REGEN_DELAY, soak } from "../game/combat";
import { FriendStatus, FriendView, GAME_BUILD, GameStart, Loadout, LootRule, MemberView, Presence, RoomView, Session } from "../game/coop";
import { DEFAULT_NAME_COLOR, NAME_COLORS, crownByAlt, crownIcon, crownKey, crownVerified, nameColorOf } from "../game/crown";
import { Contract, contractProgress, contractResetsIn, todaysContract } from "../game/contract";
import { combatLevel, foodMinutes, minutesText, packSummary, prayerSeconds, vaultWorth } from "../game/gear";
import { Account } from "../game/account";
import { formatFriendCode, friendCodeOf } from "../game/friendcode";
import {
    BARROWS_SETS,
    BASE_HP,
    GearStats,
    SET_EFFECTS,
    addItem,
    canCarry,
    carryLimitText,
    countOf,
    equip,
    gearStats,
    removeItem,
    repairCost,
    roomFor,
    sellPrice,
    unequip,
    wearOf,
} from "../game/inventory";
import { MenuScene } from "../game/menu";
import type { LootTracker } from "../game/loot";
import { applyMusicVolume } from "../game/music";
import { PET_ONE_IN, isBossPet, petBuff, petFrom, petName } from "../game/pets";
import { BODY_PART_NAMES, COLOR_GROUP_NAMES, loadColorTables, loadKits } from "../game/player";
import { Run, RunResult, TRADER_MARKUP } from "../game/run";
import {
    CHARACTER_SLOTS,
    Equipment,
    ItemStack,
    Loadout as SaveLoadout,
    MAX_BANK_TABS,
    MAX_FRIENDS,
    MAX_LOADOUTS,
    SaveData,
    UPGRADES,
    Upgrades,
    loadedSlot,
    newSave,
    packSize,
    parseSave,
    parseSaveCode,
    peekSlot,
    resetSave,
    saveCode,
    setActiveSlot,
    writeSave,
} from "../game/save";
import {
    BRIGHTNESS_MAX,
    BRIGHTNESS_MIN,
    HOTBAR_MAX,
    HOTBAR_MIN,
    MENU_LAYOUTS,
    MenuLayout,
    ZOOM_MAX,
    ZOOM_MIN,
    applyHotbarSize,
    saveSettings,
    settings,
} from "../game/settings";

const LAYOUT_NAMES: Record<MenuLayout, string> = { osrs: "Card and rooms", rail: "Rail", card: "Card and grid" };
import { HURT_SHARE, TouchControls, fullscreenButton, isTouch, touchControls, touchPrompt } from "./touch";

type Child = Node | string | null | undefined | false;

// The elemental runes, which the shop sells by the hundred (spells take
// several a cast; version 106)
const ELEMENTAL_RUNES = [AIR_RUNE, WATER, EARTH, FIRE];

type HotSlot = {
    kind: "food" | Potion;
    slot: HTMLElement;
    img: HTMLElement;
    count: HTMLElement;
    timer: HTMLElement;
    id?: number;
};

// The minimap's circle, in pixels (style.css sizes it the same)
const MINIMAP_SIZE = 176;

// The game's Discord server (version 131) and its code on GitHub (version
// 132), from the title screen's buttons
const DISCORD_URL = "https://discord.gg/DcCADFqG5n";
const GITHUB_URL = "https://github.com/OSRS-God/escape-from-runkov";

// The pages over a paused run: the pause menu and its two pages, and the
// trader's stall
type PauseView = "menu" | "settings" | "stats" | "trade";
type ClientTab = "combat" | "loot" | "tasks" | "pack" | "equipment" | "prayer" | "spells" | "friends" | "account" | "music";

const POTION_NAMES: Record<Potion, string> = {
    strength: "Strength potion",
    defence: "Defence potion",
    brew: "Saradomin brew",
    prayer: "Prayer potion",
};

// The hotbar's keys: F for food, 1 to 4 for the potions
const HOT_KEYS: [string, "food" | Potion, string][] = [
    ["F", "food", "F eats what fills the gap best"],
    ["1", "strength", "1 drinks a strength potion: " + POTION_EFFECT.strength],
    ["2", "defence", "2 drinks a defence potion: " + POTION_EFFECT.defence],
    ["3", "brew", "3 drinks a Saradomin brew: " + POTION_EFFECT.brew],
    ["4", "prayer", "4 drinks a prayer potion: " + POTION_EFFECT.prayer],
];

function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<HTMLElementTagNameMap[K]> & { class?: string; onclick?: (e: MouseEvent) => void } = {},
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (key === "class") {
            el.className = value as string;
        } else if (key === "onclick") {
            el.addEventListener("click", value as EventListener);
        } else {
            (el as unknown as Record<string, unknown>)[key] = value;
        }
    }
    for (const child of children) {
        if (child === null || child === undefined || child === false) {
            continue;
        }
        el.append(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return el;
}

function clientKeyboardButton(element: HTMLElement): void {
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.addEventListener("keydown", (event) => {
        if (event.code !== "Enter" && event.code !== "Space") return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) element.click();
    });
    element.addEventListener("keyup", (event) => {
        if (event.code === "Enter" || event.code === "Space") event.stopPropagation();
    });
}

// A share as a percentage, to a half point: 0.015 is "1.5%"
function percent(share: number): string {
    return `${Math.round(share * 200) / 2}%`;
}

function describe(item: ItemDef): string {
    const parts: string[] = [];
    if (item.damage !== undefined) {
        parts.push(`hit ${item.damage}`, `${item.speed}s`, item.ranged ? `range ${item.range}` : `reach ${item.range}`);
        if (item.twoHanded) {
            parts.push("two handed");
        }
    }
    if (item.defence) {
        parts.push(`def ${item.defence}`);
    }
    if (item.style) {
        parts.push(`${item.style} armour: half as good against ${WEAK_TO[item.style]}, helps ${item.style} hits and hinders the rest`);
    }
    if (item.strength) {
        parts.push(`+${percent(item.strength)} ${STRENGTH_NAME[item.style!]}`);
    }
    if (item.perk?.damage) {
        parts.push(`perk: +${percent(item.perk.damage.share)} ${item.perk.damage.style} damage`);
    }
    if (item.perk?.ward) {
        parts.push(`perk: +${item.perk.ward.defence} defence vs ${item.perk.ward.style}`);
    }
    if (item.hp) {
        parts.push(`+${item.hp} hp`);
    }
    if (item.prayer) {
        parts.push(`+${item.prayer} prayer (the bar drains ${Math.round((item.prayer / PRAYER_BONUS_SCALE) * 100)}% slower and refills that much faster)`);
    }
    if (item.heal) {
        parts.push(`heals ${item.heal}`);
    }
    if (item.potion) {
        parts.push(POTION_EFFECT[item.potion]);
    }
    if (item.uses) {
        parts.push(`shoots the best ${item.uses} in the pack (hit ${item.damage} with its own ${"★".repeat(item.tier)} kind, more with better, less with worse)`);
    } else if (item.ranged && item.slot === "weapon") {
        parts.push(item.splash ? "thrown, needs no ammunition; what's beside the target takes half" : "thrown, needs no ammunition");
    }
    if (item.ammo) {
        const made = `made for ${"★".repeat(item.tier)} ${item.ammo === "arrows" ? "bows" : "staves"}`;
        parts.push(item.ammo === "arrows" ? `for bows, one a shot, ${made}` : `for staves, one a cast, ${made}`);
    }
    if (item.key) {
        parts.push("opens this map's vault");
    }
    if (item.bossKey) {
        parts.push("opens this map's golden chest");
    }
    if (item.clue) {
        parts.push("names a spot to dig");
    }
    if (item.slot) {
        parts.push(item.slot);
    }
    if (isPrize(item.id)) {
        parts.push("the prize of its tier: only from a boss's chest, a vault, a champion or a clue");
    }
    return parts.join(", ");
}

// The scroll of everything that scrolls under a root, and the same put back
// on a root drawn again with the same shape
function scrollTops(root: ParentNode): number[] {
    return [...root.querySelectorAll<HTMLElement>(".screen, .panel, .inventory")].map((e) => e.scrollTop);
}

function restoreScroll(root: ParentNode, tops: number[]): void {
    const els = [...root.querySelectorAll<HTMLElement>(".screen, .panel, .inventory")];
    tops.forEach((top, i) => {
        if (top > 0 && els[i]) {
            els[i].scrollTop = top;
        }
    });
}

// What the armour worn does to the weapon's hits, when it does anything
function styleNote(stats: GearStats): string {
    const share = Math.round(stats.styleBonus * 100);
    if (share === 0) {
        return "";
    }
    return ` (${share > 0 ? "+" : ""}${share}% from ${weaponStyle(stats.weapon)} armour)`;
}

// What the prayer bonus of what's worn does to the prayer bar, when anything
function prayerNote(stats: GearStats): string {
    if (stats.prayer <= 0) {
        return "";
    }
    return ` · +${stats.prayer} prayer: the bar lasts ${Math.round((stats.prayer / PRAYER_BONUS_SCALE) * 100)}% longer and refills that much faster`;
}

// A map tier's word, as the war room puts it
const DIFFICULTY = ["", "Easy", "Medium", "Hard", "Elite", "Master"];

// A link that opens the game and joins this party (main.ts reads ?join=)
function inviteLink(code: string): string {
    return `${location.origin}${location.pathname}?join=${encodeURIComponent(code)}`;
}

// "12 sharks", "1 shark"
function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 || word.endsWith("s") ? "" : "s"}`;
}

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

// How long ago, in a word or two
function timeAgo(at: number): string {
    const minutes = Math.max(0, (Date.now() - at) / 60_000);
    if (minutes < 2) {
        return "just now";
    }
    if (minutes < 60) {
        return `${Math.round(minutes)} minutes ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 36) {
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    return `${Math.round(hours / 24)} days ago`;
}

// A contract's words, the number to reach in yellow
function contractText(contract: Contract): Child[] {
    const number = contract.kind === "haul" ? formatCoins(contract.target) : String(contract.target);
    const at = contract.kind === "boss" ? -1 : contract.text.indexOf(number);
    if (at < 0) {
        return [contract.text];
    }
    return [contract.text.slice(0, at), h("span", { class: "yellow" }, number), contract.text.slice(at + number.length)];
}

function tierName(tier: number): string {
    return ["", "common", "uncommon", "rare", "epic", "legendary"][tier] ?? "";
}

function icon(item: ItemDef): HTMLElement {
    const el = iconElement(item.id, item.name);
    el.title = `${item.name}: ${describe(item)}`;
    return el;
}

// An item's stats as rows of a table, for the card a right click opens
// (version 136)
function statRows(item: ItemDef): [string, string][] {
    const rows: [string, string][] = [];
    if (item.slot) {
        rows.push(["Slot", capitalize(item.slot) + (item.twoHanded ? " (two handed)" : "")]);
    }
    if (item.damage !== undefined) {
        rows.push(["Max hit", String(item.damage)]);
        rows.push(["Attack speed", `${item.speed}s`]);
        rows.push([item.ranged ? "Range" : "Reach", `${item.range} tiles`]);
        if (item.slot === "weapon") {
            rows.push(["Style", capitalize(weaponStyle(item))]);
        }
    }
    if (item.defence) {
        rows.push(["Defence", String(item.defence)]);
    }
    if (item.style) {
        rows.push(["Armour", `${capitalize(item.style)}: helps ${item.style} hits, half as good against ${WEAK_TO[item.style]}`]);
    }
    if (item.strength) {
        rows.push([capitalize(STRENGTH_NAME[item.style!]), `+${percent(item.strength)} (with a ${item.style} weapon)`]);
    }
    if (item.perk?.damage) {
        rows.push(["Perk", `+${percent(item.perk.damage.share)} ${item.perk.damage.style} damage (with a ${item.perk.damage.style} weapon)`]);
    }
    if (item.perk?.ward) {
        rows.push(["Perk", `+${item.perk.ward.defence} defence against ${item.perk.ward.style}`]);
    }
    if (item.hp) {
        rows.push(["Hitpoints", `+${item.hp}`]);
    }
    if (item.prayer) {
        rows.push(["Prayer", `+${item.prayer} (the bar lasts ${Math.round((item.prayer / PRAYER_BONUS_SCALE) * 100)}% longer)`]);
    }
    if (item.heal) {
        rows.push(["Heals", `${item.heal} hitpoints`]);
    }
    if (item.potion) {
        rows.push(["Effect", POTION_EFFECT[item.potion]]);
    }
    if (item.uses) {
        rows.push(["Shoots", `the best ${item.uses} packed`]);
    }
    if (item.ammo) {
        rows.push(["For", item.ammo === "arrows" ? "bows, one a shot" : "staves, one a cast"]);
    }
    const special = item.slot === "weapon" ? specialOf(item) : undefined;
    if (special) {
        rows.push(["Special", special.name]);
    }
    if (item.slot) {
        rows.push(["Worth", `${formatCoins(price(item))} coins`]);
    }
    return rows;
}

// The open right-click menu or stats card, closed by the next click
// anywhere, Escape, or another one opening
let itemPopup: HTMLElement | undefined;

function closeItemPopup(): void {
    itemPopup?.remove();
    itemPopup = undefined;
}

// Somewhere on screen by the pointer, kept inside the window
function placePopup(el: HTMLElement, x: number, y: number): void {
    document.body.append(el);
    const box = el.getBoundingClientRect();
    el.style.left = `${Math.max(4, Math.min(x, innerWidth - box.width - 4))}px`;
    el.style.top = `${Math.max(4, Math.min(y, innerHeight - box.height - 4))}px`;
    itemPopup = el;
}

// An item's stats card: its name and tier in the tier's colour, then each
// stat (version 136)
function showItemStats(item: ItemDef, x: number, y: number): void {
    closeItemPopup();
    const card = h(
        "div",
        { class: "item-stats" },
        h(
            "div",
            { class: "stats-head" },
            iconElement(item.id, item.name),
            h("div", {}, h("div", { class: "stats-name" }, item.name), h("div", { class: "stats-tier" }, `${"★".repeat(item.tier)} ${tierName(item.tier)}`)),
        ),
        h("table", {}, ...statRows(item).map(([label, value]) => h("tr", {}, h("td", {}, label), h("td", {}, value)))),
        isPrize(item.id) ? h("div", { class: "stats-note" }, "The prize of its tier: only from a boss's chest, a vault, a champion or a clue.") : null,
    );
    if (tierGlows(item)) {
        card.style.setProperty("--tier", TIER_COLOURS[item.tier]);
    }
    placePopup(card, x, y);
}

// The right-click menu on an item: View stats, and whatever else the place
// it's in offers (the run's pack: Drop)
function showItemMenu(item: ItemDef, x: number, y: number, extra: [string, () => void][] = []): void {
    closeItemPopup();
    const choose = (act: () => void) => (e: Event) => {
        e.stopPropagation();
        closeItemPopup();
        act();
    };
    const menu = h(
        "div",
        { class: "item-menu" },
        h("div", { class: "menu-title" }, item.name),
        h("button", { onclick: choose(() => showItemStats(item, x, y)) }, "View stats"),
        ...extra.map(([label, act]) => h("button", { onclick: choose(act) }, label)),
    );
    if (tierGlows(item)) {
        (menu.firstChild as HTMLElement).style.color = TIER_COLOURS[item.tier];
    }
    placePopup(menu, x, y);
}

// A right click on any item's icon, anywhere a screen hasn't its own use
// for one, opens the menu; any click elsewhere closes it
document.addEventListener("contextmenu", (e) => {
    if (e.defaultPrevented) {
        return;
    }
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-item]");
    const item = el && ITEM_BY_ID.get(Number(el.dataset.item));
    if (!item) {
        return;
    }
    e.preventDefault();
    showItemMenu(item, e.clientX, e.clientY);
});
document.addEventListener("pointerdown", (e) => {
    if (itemPopup && !itemPopup.contains(e.target as Node)) {
        closeItemPopup();
    }
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeItemPopup();
    }
});

function itemRow(item: ItemDef, count: number, ...buttons: HTMLElement[]): HTMLElement {
    return h(
        "div",
        { class: "item-row" },
        icon(item),
        h("span", { class: "name" }, count > 1 ? `${item.name} x${count}` : item.name),
        h("span", { class: "stats" }, describe(item)),
        ...buttons,
    );
}

export type UIHooks = {
    startRun(worldId: string): void;
};

export class UI {
    private hud?: {
        hp: HTMLElement;
        hpLabel: HTMLElement;
        // The special attack bar, and the prayer bar with what's protected
        spec: HTMLElement;
        specLabel: HTMLElement;
        prayer: HTMLElement;
        prayerLabel: HTMLElement;
        boss: HTMLElement;
        bossFill: HTMLElement;
        bossLabel: HTMLElement;
        coins: HTMLElement;
        // How long until the way out closes
        clock: HTMLElement;
        prompt: HTMLElement;
        inventory: HTMLElement;
        inventoryOpen: boolean;
        // Which page of it is up: the pack, or the spellbook (version 106)
        inventoryView: ClientTab;
        tabs: HTMLElement;
        signature: string;
        run: Run;
        // The whole HUD (it's marked hurt when hitpoints are low), and a
        // phone's controls
        root: HTMLElement;
        touch?: TouchControls;
        // Food and potions at hand: what each key would use
        hotbar: HotSlot[];
        minimap: CanvasRenderingContext2D;
        // The pause menu over the run, and which of its pages is up (the
        // trader's is one, on its own)
        pause: HTMLElement;
        pauseView: PauseView;
        // The party in a co-op run, drawn again when it changes
        party: HTMLElement;
        partySignature: string;
        // The pack's Drop switch: on, a click on a thing drops it instead
        dropMode: boolean;
        // The full map over the run (version 91; fullmap.ts)
        fullMap: FullMap;
    };
    // The chat box at the top (version 105): the run's messages, and the
    // party's chat in a co-op room
    private readonly chat: Chat;
    // A line for the title screen's record card, set from outside (a save
    // cleared by a new version, say)
    notice?: string;
    // The co-op screen's room code as typed, kept across its redraws; and
    // whether there's a relay to play through at all (main.ts asks once),
    // without which the title screen has no Co-op room
    private joinCode = "";
    coopEnabled = false;
    // Version 115: a party to join or host once the relay's there (a
    // friend's Join, an invite link, the title screen's Party), the title
    // screen's Solo or Party, the friend code being typed, whether the war
    // room's list of open parties is out, and what each party member was
    // last doing (the chat says when one opens the vault)
    private pendingCoop?: { join?: string; host?: string };
    private playMode: "solo" | "party" = "solo";
    private friendTyped = "";
    private friendNote = "";
    private browsing = false;
    private activities = new Map<string, FriendStatus | undefined>();
    // The stash screen's coins: how many to move, as typed, and a word on
    // the last move
    private coinAmount = "";
    private coinNote = "";
    // The bank's amount for a picked thing (version 102), and what the last
    // move of it said
    private itemAmount = "";
    private itemNote = "";
    // The bank (version 92): the tab open, the search typed, and the thing
    // picked to see and wear or pack (an item id; COINS for the coins)
    private bankTab = "all";
    private bankSearch = "";
    private bankSelected?: number;
    // The vault's quantity for a move, as OSRS's bank has it (version 115),
    // the X amount last asked for, and what dragging a cell onto another
    // does: swap the two, or put it in before
    private bankQty: 1 | 5 | 10 | "x" | "all" = "all";
    private bankX = 25;
    private bankRearrange: "swap" | "insert" = "swap";

    constructor(
        private readonly root: HTMLElement,
        private readonly save: SaveData,
        private readonly menu: MenuScene,
        private readonly session: Session,
        private readonly hooks: UIHooks,
    ) {
        this.chat = new Chat(session);
        window.addEventListener("keydown", (e) => {
            if (!this.hud) {
                return;
            }
            // The full map first: M or Esc shuts it, M opens it
            if (this.hud.fullMap.isOpen && (e.code === "Escape" || e.code === "KeyM")) {
                e.preventDefault();
                this.hud.fullMap.close();
                return;
            }
            if (e.code === "KeyM" && this.hud.pause.hidden && !(document.activeElement instanceof HTMLInputElement)) {
                e.preventDefault();
                this.openFullMap();
                return;
            }
            // Esc pauses; paused, it backs out of a page or resumes
            if (e.code === "Escape") {
                e.preventDefault();
                this.togglePause();
            } else if ((e.code === "KeyI" || e.code === "Tab") && !this.hud.run.paused) {
                e.preventDefault();
                this.toggleInventory("pack");
            } else if (e.code === "KeyB" && !this.hud.run.paused && !(document.activeElement instanceof HTMLInputElement)) {
                e.preventDefault();
                this.toggleInventory("spells");
            }
        });
    }

    // A phone turned upright: the cover (index.html) hides the game, and a
    // run stands still under it until it's turned back
    onOrientation(portrait: boolean): void {
        const hud = this.hud;
        if (!hud) {
            return;
        }
        if (portrait) {
            hud.touch?.cancel();
            hud.run.setPaused(true);
        } else if (hud.pause.hidden) {
            hud.run.setPaused(false);
        }
    }

    get controllerModal(): boolean {
        return !this.hud || !this.hud.pause.hidden || this.hud.fullMap.isOpen || this.hud.inventoryOpen || this.chat.isOpen || !!this.hud.root.querySelector(".client-camera-panel:not([hidden])");
    }

    get controllerMapOpen(): boolean {
        return this.hud?.fullMap.isOpen ?? false;
    }

    controllerMapInput(x: number, y: number, panX: number, panY: number, zoom: number, dt: number): void {
        this.hud?.fullMap.controllerInput(x, y, panX, panY, zoom, dt);
    }

    controllerMapConfirm(): void {
        this.hud?.fullMap.controllerConfirm();
    }

    controllerAction(action: "inventory" | "map" | "pause" | "back" | "nextTab" | "previousTab"): boolean {
        const hud = this.hud;
        if (!hud) {
            if (action !== "back") return false;
            const buttons = [...this.root.querySelectorAll<HTMLButtonElement>("button")].filter((button) => !button.disabled && button.getClientRects().length > 0);
            const back = ["Back", "Close", "Done", "Title screen"].map((name) => buttons.find((button) => button.textContent?.trim() === name)).find(Boolean);
            if (!back) return false;
            back.click();
            return true;
        }
        if (action === "back") {
            if (hud.fullMap.isOpen) hud.fullMap.close();
            else if (hud.root.querySelector(".client-camera-panel:not([hidden])")) {
                hud.root.querySelector<HTMLElement>(".client-camera-panel")!.hidden = true;
                hud.root.querySelector(".client-camera")?.setAttribute("aria-expanded", "false");
            }
            else if (this.chat.isOpen) this.chat.close();
            else if (!hud.pause.hidden) this.togglePause();
            else if (hud.inventoryOpen) {
                hud.inventoryOpen = false;
                this.updateHud();
            } else return false;
            return true;
        }
        if (action === "pause") {
            if (hud.fullMap.isOpen) hud.fullMap.close();
            this.togglePause();
            return true;
        }
        if (action === "map") {
            if (hud.fullMap.isOpen) hud.fullMap.close();
            else if (hud.pause.hidden) this.openFullMap();
            else return false;
            return true;
        }
        if (!hud.pause.hidden || hud.fullMap.isOpen) return false;
        if (action === "inventory") {
            this.toggleInventory("pack");
            if (hud.inventoryOpen) this.focusControllerPanel();
            return true;
        }
        const views: ClientTab[] = ["combat", "prayer", "tasks", "friends", "account", "music", "pack", "equipment", "loot", "spells"];
        const index = views.indexOf(hud.inventoryView);
        hud.inventoryView = views[(index + (action === "nextTab" ? 1 : views.length - 1)) % views.length];
        hud.inventoryOpen = true;
        hud.signature = "";
        this.updateHud();
        this.focusControllerPanel();
        return true;
    }

    private focusControllerPanel(): void {
        const hud = this.hud;
        if (!hud?.inventoryOpen) return;
        const selectors: Partial<Record<ClientTab, string>> = {
            pack: ".slot[tabindex]",
            prayer: "button[data-protect]",
            equipment: "button.equip-slot:not(.empty)",
            spells: '.spell:not([aria-disabled="true"])',
            music: 'input[type="range"]',
            combat: ".client-special-button:not(:disabled)",
        };
        const preferred = selectors[hud.inventoryView];
        const element = (preferred ? hud.inventory.querySelector<HTMLElement>(preferred) : undefined)
            ?? hud.inventory.querySelector<HTMLElement>('button:not(.client-panel-close):not(:disabled), input:not(:disabled)')
            ?? hud.inventory.querySelector<HTMLElement>(".client-panel-close");
        element?.focus({ preventScroll: true });
    }

    // The full map over the run: it takes the controls (and stops the world
    // alone) while it's up, as the pause menu does
    private openFullMap(): void {
        const hud = this.hud;
        if (!hud || !hud.pause.hidden || hud.fullMap.isOpen) {
            return;
        }
        if (hud.fullMap.show()) {
            hud.touch?.cancel();
            hud.run.setPaused(true);
        }
    }

    // The pack panel, on its pack or its spellbook: the key for the page up
    // shuts it, the other's turns the page
    private toggleInventory(view: ClientTab = "pack"): void {
        if (!this.hud) {
            return;
        }
        if (this.hud.inventoryOpen && this.hud.inventoryView !== view) {
            this.hud.inventoryView = view;
        } else {
            this.hud.inventoryOpen = !this.hud.inventoryOpen;
            this.hud.inventoryView = view;
        }
        this.hud.signature = "";
        this.updateHud();
    }

    // The spell to autocast, picked in the spellbook (none: the strongest
    // the staff can cast); kept in the save for the next run
    private pickSpell(run: Run, id: string | undefined): void {
        run.autocast = id;
        if (id) {
            this.save.autocast = id;
        } else {
            delete this.save.autocast;
        }
        this.persist();
        if (this.hud) {
            this.hud.signature = "";
            this.updateHud();
        }
    }

    // A guild screen: the world behind it, with the character as the save
    // has them now
    private show(...children: Child[]): void {
        // Another screen starts at the top
        this.screenKey = "";
        this.place(...children);
        this.menu.focus = 0;
        this.menu.raise = 0.1;
        this.menu.hold = false;
        this.menu.spin = 0;
        this.menu.setLook(this.save.character, this.save.equipment);
        this.menu.setPet(this.save.pet);
        this.menu.start();
    }

    // The same, for a screen that draws itself again after something on it
    // is done (a buy, a repair, a piece worn): drawn again under the same
    // key, its panels keep their scroll
    private screenKey = "";

    private showKeyed(key: string, ...children: Child[]): void {
        const tops = this.screenKey === key ? scrollTops(this.root) : [];
        this.show(...children);
        this.screenKey = key;
        restoreScroll(this.root, tops);
    }

    // A screen over a run, or while one loads: the world is the run's, and
    // no guild screen is up to be drawn again
    private showOverRun(...children: Child[]): void {
        this.menu.stop();
        this.screenKey = "";
        this.place(...children);
    }

    private place(...children: Child[]): void {
        this.hud?.touch?.dispose();
        this.hud = undefined;
        this.loading = false;
        // Only the co-op screen wants the list of servers (it asks again),
        // and only it holds the chat in a panel (it docks it again)
        this.session.browse(false);
        this.chat.dock(undefined);
        this.root.replaceChildren(...children.filter((c): c is Node | string => !!c));
        this.updateChat();
        // Once the screen's key is set (showKeyed sets it after this)
        queueMicrotask(() => this.tellFriends());
    }

    // The chat box shows in a run, and in a co-op room's lobby
    private updateChat(): void {
        this.chat.setActive(this.hud !== undefined || this.session.room !== undefined);
        this.chat.root.classList.toggle("client-chat", this.hud !== undefined);
        this.chat.setReferenceLayout(this.hud !== undefined);
    }

    private persist(): void {
        writeSave(this.save);
    }

    // -----------------------------------------------------------------------
    // Menu

    // The title screen: the world in full with the character in it, the name
    // up top, and the guild's rooms either down a rail on the right, each
    // with a line on what's waiting there, or (by the settings) a grid beside
    // the character's card with the way in along the bottom. A phone gets the
    // rail: it fits under a thumb.
    showMenu(): void {
        if (this.save.pickStarter) {
            this.showStarter();
            return;
        }
        const layout = isTouch ? "rail" : settings.menuLayout;
        this.showKeyed("menu", layout === "card" ? this.cardMenu() : layout === "osrs" ? this.osrsMenu() : this.railMenu());
        // The character stands clear of the rail, or above the play bar;
        // between the card and the rooms
        this.menu.focus = layout === "card" ? 0 : layout === "osrs" ? 0.02 : 0.12;
        this.menu.raise = layout === "card" ? 0.14 : layout === "osrs" ? 0.08 : 0.05;
    }

    // A new character's first screen (version 127): a starter kit for each
    // combat style, each shown as what it wears and packs; the one picked is
    // theirs, and on into the guild
    private showStarter(): void {
        const pick = (kit: StarterKit) => {
            applyStarter(this.save, kit);
            this.persist();
            this.showMenu();
        };
        const card = (kit: StarterKit) => {
            const ids = [...Object.values(kit.equipment), ...kit.backpack.map((s) => s.id)].filter((id): id is number => id !== undefined);
            const gear = h("span", { class: "starter-gear" }, ...ids.map((id) => h("span", { class: "starter-item", title: getItem(id).name }, this.itemIcon(id))));
            const sub = h("span", {}, kit.blurb, gear);
            return this.roomButton(`${capitalize(kit.style)} · ${kit.name}`, sub, this.itemIcon(kit.equipment.weapon!), () => pick(kit));
        };
        this.showKeyed(
            "starter",
            h(
                "div",
                { class: "screen account" },
                h("h1", {}, "Choose your style"),
                h(
                    "div",
                    { class: "panel account-panel starter-panel" },
                    h("div", { class: "subtitle" }, "The guild kits you out for one way of fighting. Whatever else you want, you'll find in runs or buy in the shop."),
                    ...STARTER_KITS.map(card),
                ),
            ),
        );
    }

    // What the title screen says about each room and the character
    private menuFacts() {
        const save = this.save;
        const s = save.stats;
        const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
        const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
        const last = save.recentMaps[0] !== undefined ? WORLD_BY_ID.get(save.recentMaps[0]) : undefined;
        const owned = [...Object.values(save.equipment), ...save.stash.map((x) => x.id), ...save.backpack.map((x) => x.id)].filter(
            (id): id is number => id !== undefined,
        );
        const pieces = owned.filter((id) => getItem(id).slot).length;
        const repairs = new Set(owned.filter((id) => wearOf(save.wear, id) > 0)).size;
        const tasksDone = TASKS.filter((t) => save.tasks.includes(t.id)).length;
        const grave = save.graves[0];
        const graveWorld = grave ? WORLD_BY_ID.get(grave.map) : undefined;
        const things = grave ? grave.items.reduce((n, x) => n + x.count, 0) : 0;
        return {
            play: last
                ? `Last: ${last.name} ${"★".repeat(last.tier)}${s.fastestEscape > 0 ? ` · best escape ${time(s.fastestEscape)}` : ""}`
                : "Twelve maps, one star to five",
            stash:
                plural(pieces, "piece") +
                ` · ${formatCoins(vaultWorth(save.stash, save.coins))}` +
                (repairs > 0 ? ` · ${repairs} need${repairs === 1 ? "s" : ""} repair` : ""),
            // The shelves fill again after every run (main.ts)
            shop: `${save.shop.length} on the shelves · restocks after a run`,
            tasks: `${tasksDone} of ${TASKS.length} done` + (save.pets.length > 0 ? ` · ${plural(save.pets.length, "pet")}` : ""),
            character: save.character.name,
            coop: this.coopLine(),
            record: `${plural(s.runs, "run")} · ${plural(s.extractions, "escape")} · ${plural(s.deaths, "death")} · hardest map ${s.deepest > 0 ? "★".repeat(s.deepest) : "none yet"}`,
            pet: save.pet ? `${petName(save.pet)} follows you: ${petBuff(save.pet)?.text ?? ""}` : undefined,
            grave:
                grave && graveWorld
                    ? `Gravestone on ${graveWorld.name} with ${plural(things, "thing")}, ${plural(grave.runsLeft, "run")} left`
                    : undefined,
        };
    }

    // A crowned browser's switch to its other character (save.ts's slots,
    // version 79): this one is saved and the page comes back as the other.
    // Nothing for anyone else.
    private switchCharacterButton(withSub: boolean): HTMLElement | null {
        if (!crownVerified(crownKey())) {
            return null;
        }
        const slot = loadedSlot();
        const other = (slot + 1) % CHARACTER_SLOTS;
        // In the selector the second is always "Test character", whatever
        // it's called in the game (its own name is set on the Character
        // screen as usual); the first goes by its name
        const label = (s: number, name: string | undefined) => (s === 0 ? (name ?? "your character") : "Test character");
        const otherName = other === 0 ? peekSlot(0)?.character.name : undefined;
        const here = slot === 0 ? `Character 1 of ${CHARACTER_SLOTS}` : "Test character";
        const sub =
            `${here} · ` + (other === 1 && !peekSlot(1) ? "make a test character" : `play as ${label(other, otherName)}`);
        return this.roomButton("Switch character", withSub ? sub : undefined, this.itemIcon(1163), () => {
            if (this.session.room) {
                alert("Leave the co-op server first.");
                return;
            }
            this.persist();
            setActiveSlot(other);
            location.reload();
        });
    }

    // A room's button: an icon, its name, and a line under it, with
    // something at its right end when there's more to say (a friend's Join,
    // the way in's arrow)
    private roomButton(name: string, sub: string | Node | undefined, icon: Node, open: () => void, primary = false, end?: Node): HTMLElement {
        return h(
            "button",
            { class: "room" + (primary ? " primary" : ""), onclick: open },
            // The icon sits in a well of its own: padding on the icon itself
            // would show its neighbours on the sheet
            h("span", { class: "room-well" }, icon),
            h("span", { class: "room-text" }, h("span", { class: "room-name" }, name), sub ? h("span", { class: "room-sub" }, sub) : null),
            end ? h("span", { class: "room-end" }, end) : null,
        );
    }

    // -----------------------------------------------------------------------
    // Friends (version 115): every character has a friend code; two who've
    // added each other see each other online, what they're doing, and can
    // join the other's party when it has a seat

    // This character's friend code (version 116): made here from its key
    // (friendcode.ts) the moment the character is, so it's there to give out
    // with or without the relay; the relay's word for it until it's made
    private codeFor?: string;

    friendCode(): string | undefined {
        const save = this.save;
        const key = save.friendKey;
        if (key && this.codeFor !== key) {
            this.codeFor = key;
            void friendCodeOf(key)
                .then((code) => {
                    if (code && save.friendKey === key && save.friendCode !== code) {
                        save.friendCode = code;
                        this.persist();
                        this.onSessionChange();
                    }
                })
                .catch(() => undefined);
        }
        return save.friendCode ?? this.session.view.friendCode;
    }

    // -----------------------------------------------------------------------
    // Accounts (version 116, account.ts): before the guild, a name nobody
    // else has and a password; the save is kept with the account, so it's
    // the same on every device logged in to it

    account?: Account;
    private accountMode: "create" | "login" = "create";
    private accountTyped = "";

    showAccount(mode: "create" | "login" = this.accountMode, note = ""): void {
        const account = this.account;
        if (!account) {
            this.showMenu();
            return;
        }
        this.accountMode = mode;
        const create = mode === "create";
        const nameInput = h("input", { type: "text", class: "account-name", maxLength: 12, placeholder: "Name", autocomplete: "username", spellcheck: false, value: this.accountTyped });
        const password = h("input", { type: "password", placeholder: "Password", autocomplete: create ? "new-password" : "current-password", maxLength: 128 });
        const again = create ? h("input", { type: "password", placeholder: "Password again", autocomplete: "new-password", maxLength: 128 }) : null;
        const nameState = h("div", { class: "account-check muted" }, create ? "1 to 12 letters, numbers, spaces, dashes or underscores." : "");
        const status = h("div", { class: "account-status" + (note ? " red" : "") }, note);
        const offline = h("button", { class: "quiet", hidden: true, onclick: () => this.showMenu() }, "Play on this device for now");
        let checkTimer: number | undefined;
        nameInput.addEventListener("input", () => {
            this.accountTyped = nameInput.value;
            if (!create) {
                return;
            }
            window.clearTimeout(checkTimer);
            const name = nameInput.value.trim();
            if (!name) {
                nameState.className = "account-check muted";
                nameState.textContent = "1 to 12 letters, numbers, spaces, dashes or underscores.";
                return;
            }
            checkTimer = window.setTimeout(async () => {
                const result = await account.checkName(name);
                if (nameInput.value.trim() !== name) {
                    return;
                }
                const free = result.ok && result.data.free;
                nameState.className = "account-check " + (free ? "green" : "red");
                nameState.textContent = result.ok ? (free ? "That name is free." : (result.data.why ?? "That name is taken by another player.")) : result.error;
            }, 350);
        });
        const button = h("button", { class: "go wide", type: "submit" }, create ? "Create account" : "Log in");
        const failWith = (text: string, unreachable = false) => {
            button.disabled = false;
            status.className = "account-status red";
            status.textContent = text;
            offline.hidden = !unreachable;
        };
        const submit = async () => {
            const name = nameInput.value.trim().replace(/\s+/g, " ");
            const pass = password.value;
            if (!name) {
                failWith("Pick a name first.");
                return;
            }
            if (create && pass.length < 6) {
                failWith("A password is at least 6 characters.");
                return;
            }
            if (again && pass !== again.value) {
                failWith("The two passwords aren't the same.");
                return;
            }
            button.disabled = true;
            status.className = "account-status muted";
            status.textContent = create ? "Making your account..." : "Logging in...";
            if (create) {
                // A copy of another account's save (this device was logged
                // out of it) is that account's: a new one starts from nothing
                if (account.previous && this.save.character.name === account.previous) {
                    this.replaceSave(newSave());
                }
                // This browser's progress goes up as the account's, named for it
                const before = this.save.character.name;
                this.save.character.name = name;
                const result = await account.signUp(name, pass, this.save);
                if (!result.ok) {
                    this.save.character.name = before;
                    failWith(result.error, result.status === 0);
                    return;
                }
                this.save.character.name = result.data.name;
                writeSave(this.save, true);
                this.accountChanged();
                this.accountTyped = "";
                await this.showWelcome();
                return;
            }
            const result = await account.logIn(name, pass);
            if (!result.ok) {
                failWith(result.error, result.status === 0);
                return;
            }
            this.adoptAccountSave(result.data.save, result.data.name);
            // An account with nothing kept yet takes this browser's progress
            if (!result.data.save) {
                account.push(this.save, false);
            }
            this.accountTyped = "";
            this.showMenu();
        };
        const form = h(
            "form",
            { class: "panel account-panel" },
            h(
                "div",
                { class: "seg account-tabs" },
                h("button", { type: "button", class: create ? "on" : "", onclick: () => this.showAccount("create") }, "Create account"),
                h("button", { type: "button", class: create ? "" : "on", onclick: () => this.showAccount("login") }, "Log in"),
            ),
            h(
                "div",
                { class: "subtitle" },
                create
                    ? "Your name is yours alone in the game: nobody else can take it. Your progress is kept with your account, so it's there on any phone or computer you log in on."
                    : "Log in to bring your account's progress to this device.",
            ),
            nameInput,
            nameState,
            password,
            again,
            create && this.save.stats.runs > 0 && this.save.character.name !== account.previous
                ? h("div", { class: "muted small-text" }, `The progress in this browser (${this.save.stats.runs} runs) becomes your account's.`)
                : null,
            create && account.previous ? h("div", { class: "muted small-text" }, `A new account starts fresh: ${account.previous}'s progress stays with ${account.previous}.`) : null,
            !create && this.save.stats.runs > 0 ? h("div", { class: "muted small-text" }, "The progress in this browser is replaced by the account's.") : null,
            button,
            status,
            offline,
        );
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            void submit();
        });
        this.showKeyed("account", h("div", { class: "screen account" }, h("h1", {}, "Escape from Runkov"), h("div", { class: "tagline muted" }, "Go in geared. Come out richer. Or don't come out."), form));
        (create || !nameInput.value ? nameInput : password).focus();
    }

    // Made: the friend code, given with the account, and on into the guild
    private async showWelcome(): Promise<void> {
        const key = this.save.friendKey;
        const code = key ? ((await friendCodeOf(key).catch(() => undefined)) ?? this.friendCode()) : this.friendCode();
        if (code && this.save.friendCode !== code) {
            this.save.friendCode = code;
            this.persist();
        }
        const copy = h(
            "button",
            {
                onclick: () => {
                    if (code) {
                        void navigator.clipboard?.writeText(code).then(() => (copy.textContent = "Copied")).catch(() => prompt("Your friend code:", code));
                    }
                },
            },
            "Copy",
        );
        this.showKeyed(
            "welcome",
            h(
                "div",
                { class: "screen account" },
                h("h1", {}, `Welcome, ${this.save.character.name}`),
                h(
                    "div",
                    { class: "panel account-panel" },
                    h("h2", {}, "Your friend code"),
                    h("div", { class: "friend-code-big" }, code ? formatFriendCode(code) : "…"),
                    h("div", { class: "row center-row" }, copy),
                    h(
                        "div",
                        { class: "subtitle" },
                        "Give it to your friends and add theirs in the War Room (Co-op). Once you've both added each other you see each other online, and can join each other's parties.",
                    ),
                    h("button", { class: "go wide", onclick: () => this.showMenu() }, "Into the guild"),
                ),
            ),
        );
    }

    // The first character's name is its account's
    private keepAccountName(): void {
        if (this.account?.name && loadedSlot() === 0) {
            this.save.character.name = this.account.name;
        }
    }

    // The account's save, as this device's now (the name always the
    // account's): every field replaced, none of this one's left over
    adoptAccountSave(raw: unknown, name: string): void {
        const parsed = raw ? parseSave(JSON.stringify(raw)) : undefined;
        if (parsed) {
            this.replaceSave(parsed);
        }
        this.save.character.name = name;
        // A crown's own pet (version 118) is this browser's crown's to give
        restoreCrownPets(this.save);
        writeSave(this.save, true);
        this.accountChanged();
    }

    // Another save in this one's place, every field (none of the old one's
    // left over), kept on this device only
    private replaceSave(next: SaveData): void {
        const target = this.save as unknown as Record<string, unknown>;
        for (const key of Object.keys(target)) {
            if (!(key in next)) {
                delete target[key];
            }
        }
        Object.assign(this.save, next);
        writeSave(this.save, true);
    }

    // A different account here (or none): the relay hears the new
    // character's friend key, so friends see the right one
    private accountChanged(): void {
        this.codeFor = undefined;
        if (this.coopEnabled && this.save.friendKey) {
            this.session.keepOnline(this.save.friendKey, this.presence());
        }
    }

    // Log out (version 117), to swap accounts or make another: what's
    // changed goes to the account first, then this device starts clean, so
    // a new account made here starts from nothing and one logged in to
    // brings only its own progress
    private async logOut(): Promise<void> {
        const account = this.account;
        if (!account?.name) {
            return;
        }
        if (this.session.room) {
            alert("Leave the party first.");
            return;
        }
        if (!confirm(`Log out of ${account.name}? Its progress stays with the account for when you log in again.`)) {
            return;
        }
        const sent = await account.flush(this.save);
        if (!sent && !confirm("Couldn't reach the account server, so the latest changes here aren't saved to the account yet. Log out anyway and lose them?")) {
            return;
        }
        await account.logOut();
        this.replaceSave(newSave());
        this.notice = undefined;
        this.accountChanged();
        this.showAccount("login", "");
    }

    // What this player tells the relay about themselves for their friends
    presence(): Presence {
        const crown = crownVerified(crownKey());
        return {
            name: this.save.character.name,
            crown: crown?.alt,
            color: nameColorOf(this.save.character, crownKey()),
            status: this.status(),
            map: this.hud ? this.save.recentMaps[0] : undefined,
            watch: (this.save.friends ?? []).map((f) => f.code),
        };
    }

    // What this player's doing, as friends and the party see it
    private status(): FriendStatus {
        if (this.hud || this.loading) {
            return "run";
        }
        if (this.screenKey === "stash") {
            return "vault";
        }
        if (this.screenKey === "shop") {
            return "shop";
        }
        return this.session.room ? "lobby" : "menu";
    }

    // Friends and the party hear what's changed: called as each screen goes up
    private tellFriends(): void {
        this.session.setPresence(this.presence());
        if (this.session.room) {
            this.session.setMe({ loadout: this.myLoadout() });
        }
    }

    // A friend's name as the friends list draws it: their crown (their
    // word for it) and their name's colour
    private friendName(friend: FriendView): HTMLElement {
        const crown = crownByAlt(friend.crown);
        const el = h("span", { class: "friend-name" }, crown ? crownIcon(crown) : null, friend.name);
        if (friend.color && NAME_COLORS.some((c) => c.color === friend.color)) {
            el.style.color = friend.color;
        }
        return el;
    }

    // What a friend's doing, in a few words
    private friendDoing(friend: FriendView): string {
        const map = friend.map ? WORLD_BY_ID.get(friend.map)?.name : undefined;
        switch (friend.status) {
            case "run":
                return map ? `in a run on ${map}` : "in a run";
            case "lobby":
                return friend.party ? `in a party, ${friend.party.players} of ${friend.party.max}${map ? ` · ${map}` : ""}` : "in a party";
            case "vault":
                return "in the vault";
            case "shop":
                return "in the shop";
            default:
                return "on the title screen";
        }
    }

    // Into a friend's party, from anywhere between runs
    private joinFriend(friend: FriendView): void {
        if (!friend.party) {
            return;
        }
        this.pendingCoop = { join: friend.party.code };
        this.showCoop();
    }

    // The online friends, the ones with a seat in their party first
    private onlineFriends(): FriendView[] {
        return [...(this.session.view.friends ?? [])].sort((a, b) => Number(!!b.party) - Number(!!a.party) || a.name.localeCompare(b.name));
    }

    // What the Co-op room says under its name: a friend online (with a Join
    // when there's a seat for you), or else how many servers and players are
    // about
    private coopLine(): { sub: string | Node; end?: Node } {
        if (this.session.room) {
            return { sub: `On a server: ${this.session.room.name}` };
        }
        const friends = this.onlineFriends();
        const first = friends[0];
        if (first) {
            const more = friends.length > 1 ? ` and ${friends.length - 1} more` : "";
            const sub = h("span", {}, this.friendName(first), ` is online${more}`);
            const join = first.party
                ? h(
                      "span",
                      {
                          class: "join-pill",
                          title: `Join ${first.name}'s party`,
                          onclick: (e: MouseEvent) => {
                              e.stopPropagation();
                              this.joinFriend(first);
                          },
                      },
                      "Join",
                  )
                : undefined;
            return { sub, end: join };
        }
        const live = this.session.view.live;
        if (live) {
            const servers = `${live.servers} server${live.servers === 1 ? "" : "s"} open`;
            return { sub: `${servers} · ${live.players} online` };
        }
        return { sub: "Up to four on one map together" };
    }

    private itemIcon(id: number): HTMLElement {
        const el = iconElement(id);
        el.classList.add("room-icon");
        return el;
    }

    // The one room with no item for it
    private gearIcon(): SVGElement {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("class", "room-icon");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "3");
        const path = document.createElementNS(ns, "path");
        path.setAttribute(
            "d",
            "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
        );
        svg.append(circle, path);
        return svg;
    }

    // The save code in a box over the menu, with a button that copies it
    // (version 101: it was the browser's prompt, where a phone made the
    // whole of a long code hard to select, and a part of one won't load)
    private showSaveCode(code: string): void {
        const text = h("textarea", { class: "save-code", readOnly: true, rows: 5, spellcheck: false });
        text.value = code;
        const status = h("div", { class: "stats" }, `${code.length.toLocaleString()} characters. Load code in another browser brings your progress there.`);
        const close = () => overlay.remove();
        const copy = h(
            "button",
            {
                class: "primary",
                onclick: async () => {
                    let copied = false;
                    try {
                        await navigator.clipboard.writeText(code);
                        copied = true;
                    } catch {
                        // No clipboard here (an old browser, or not allowed): the
                        // old way, from the box itself
                        text.focus();
                        text.select();
                        try {
                            copied = document.execCommand("copy");
                        } catch {
                            copied = false;
                        }
                    }
                    copy.textContent = copied ? "Copied" : "Copy";
                    status.textContent = copied
                        ? "Copied. Paste it with Load code in the other browser."
                        : "This browser wouldn't copy it: the code is selected, so copy it from the box yourself.";
                    if (!copied) {
                        text.focus();
                        text.select();
                    }
                },
            },
            "Copy",
        );
        const overlay = h(
            "div",
            { class: "screen code-dialog" },
            h("div", { class: "panel save-code-panel" }, h("h2", {}, "Save code"), text, status, h("div", { class: "code-buttons" }, copy, h("button", { onclick: close }, "Close"))),
        );
        // A tap on the dim around the box closes it too
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                close();
            }
        });
        text.addEventListener("focus", () => text.select());
        this.root.append(overlay);
    }

    // Progress lives in this browser; a code carries it to another, where
    // there's no account to carry it (version 133: a test character, or
    // playing on this device while the accounts can't be reached)
    private utilityButtons(): HTMLElement[] {
        const loggedIn = !!this.account?.name && loadedSlot() === 0;
        return [
            // The game's Discord server (version 131), in a new tab
            h("button", { class: "discord", title: "Join the game's Discord server", onclick: () => window.open(DISCORD_URL, "_blank", "noopener") }, "Discord"),
            // And its code (version 132)
            h("button", { class: "github", title: "The game's code on GitHub", onclick: () => window.open(GITHUB_URL, "_blank", "noopener") }, "GitHub"),
            // To switch accounts or make another (version 117)
            loggedIn
                ? h("button", { title: `Logged in as ${this.account!.name}: log out to switch accounts or make another`, onclick: () => void this.logOut() }, "Log out")
                : null,
            loggedIn ? null : h(
                "button",
                {
                    title: "Your progress as text, to paste into the game in another browser",
                    onclick: async () => {
                        this.showSaveCode(await saveCode(this.save));
                    },
                },
                "Save code",
            ),
            loggedIn ? null : h(
                "button",
                {
                    title: "Paste a save code from another browser; it replaces what's here",
                    onclick: async () => {
                        const code = prompt("Paste a save code. It replaces the progress in this browser.");
                        if (!code) {
                            return;
                        }
                        const loaded = await parseSaveCode(code);
                        if (!loaded) {
                            alert(
                                /^\s*DX2-/.test(code) && typeof DecompressionStream === "undefined"
                                    ? "This browser is too old to read that save code. Update it, or load the code in another browser."
                                    : "That isn't a save code from this game, or it's been cut short. Copy the whole code, from DX1- or DX2- to the end, and try again.",
                            );
                            return;
                        }
                        Object.assign(this.save, loaded);
                        // An account keeps its name whatever the code's was
                        this.keepAccountName();
                        this.persist();
                        this.showMenu();
                    },
                },
                "Load code",
            ),
            fullscreenButton(),
            h(
                "button",
                {
                    class: "quiet",
                    title: "Wipe the stash, coins and character and begin again",
                    onclick: () => {
                        if (confirm(this.account?.name ? "Start over? The stash, coins and character are wiped, on every device this account is on." : "Start over? The stash, coins and character are wiped.")) {
                            Object.assign(this.save, resetSave());
                            this.keepAccountName();
                            this.persist();
                            this.showMenu();
                        }
                    },
                },
                "Start over",
            ),
        ].filter((b): b is HTMLButtonElement => !!b);
    }

    private controlsHint(): string {
        const controls = isTouch
            ? "Left stick moves in 360° · right stick aims and attacks · tap ground to walk · tap an enemy to attack · Use opens chests and holds for the way out · tap the heart to eat, or the prayer orb for protection"
            : "WASD for 360° movement · click ground to walk · click an enemy or Space to attack · Q special · E interacts · F eats · 1 2 3 4 drink · I inventory · B magic · M map · Esc pauses";
        return controls + " · Xbox: LS move, RS camera, A confirm/attack, X hold to interact, RT attack, LT special, Y inventory, View map, Start pause, B back, LB/RB panels, D-pad navigate";
    }

    // The rooms down the right, the name and the record top left, the small
    // things along the bottom
    private railMenu(): HTMLElement {
        const f = this.menuFacts();
        return h(
            "div",
            { class: "screen title layout-rail" },
            h(
                "div",
                { class: "title-left" },
                h("h1", {}, "Escape from Runkov"),
                h(
                    "div",
                    { class: "subtitle" },
                    "Twelve OSRS maps, each with chests and a boss. Escape where you came in to keep the loot; die and lose what you carried.",
                ),
                h(
                    "div",
                    { class: "menu-box record" },
                    this.recordName(),
                    h("div", { class: "record-line" }, f.record),
                    this.friendCode() ? h("div", { class: "record-line" }, `Friend code ${formatFriendCode(this.friendCode()!)}`) : null,
                    f.pet ? h("div", { class: "record-line" }, f.pet) : null,
                    f.grave ? h("div", { class: "record-line grave" }, f.grave) : null,
                    this.notice ? h("div", { class: "record-line notice" }, this.notice) : null,
                ),
                this.contractPanel(true),
            ),
            h(
                "div",
                { class: "rail" },
                this.roomButton("Choose a map", f.play, this.itemIcon(2677), () => this.showMaps(), true),
                this.coopEnabled ? this.roomButton("Co-op", f.coop.sub, this.itemIcon(1019), () => this.showCoop(), false, f.coop.end) : null,
                this.roomButton("Bank & gear", f.stash, this.itemIcon(1127), () => this.showStash()),
                this.roomButton("Shop", f.shop, this.itemIcon(995), () => this.showShop()),
                this.roomButton("Tasks & pets", f.tasks, this.itemIcon(989), () => this.showTasks()),
                this.roomButton("Character", f.character, this.itemIcon(1163), () => this.showCharacter()),
                this.switchCharacterButton(true),
                this.roomButton("Settings", "Brightness, sound, camera", this.gearIcon(), () => this.showSettings()),
            ),
            h("div", { class: "title-foot" }, h("div", { class: "row small" }, ...this.utilityButtons()), h("div", { class: "hint" }, this.controlsHint())),
        );
    }

    // The character's card on the left, the rooms as a grid on the right,
    // and the way in along the bottom with the last maps played a tap away
    private cardMenu(): HTMLElement {
        const save = this.save;
        const s = save.stats;
        const f = this.menuFacts();
        const stat = (label: string, value: string) => [h("span", { class: "stat-label" }, label), h("span", { class: "stat-value" }, value)];
        const chips = save.recentMaps.flatMap((id) => {
            const world = WORLD_BY_ID.get(id);
            if (!world || !mapUnlocked(s.mapsBeaten, id)) {
                return [];
            }
            const grave = save.graves.some((g) => g.map === id);
            const sub = grave
                ? "your gravestone is here"
                : s.mapsBeaten.includes(id)
                  ? "beaten"
                  : s.bossesBeaten.includes(id)
                    ? "boss slain, not yet escaped"
                    : s.mapsEscaped.includes(id)
                      ? "escaped before"
                      : "boss not yet beaten";
            return [
                h(
                    "button",
                    { class: "chip", onclick: () => this.hooks.startRun(id) },
                    h("span", { class: "chip-name" }, `${world.name} ${"★".repeat(world.tier)}`),
                    h("span", { class: "chip-sub" + (grave ? " grave" : "") }, sub),
                ),
            ];
        });
        return h(
            "div",
            { class: "screen title layout-card" },
            h("h1", {}, "Escape from Runkov"),
            h(
                "div",
                { class: "menu-box record card-record" },
                this.recordName(),
                h(
                    "div",
                    { class: "record-grid" },
                    ...stat("Runs", String(s.runs)),
                    ...stat("Escapes", String(s.extractions)),
                    ...stat("Deaths", String(s.deaths)),
                    ...stat("Hardest map", s.deepest > 0 ? "★".repeat(s.deepest) : "none yet"),
                    ...stat("Best haul", `${formatCoins(s.bestHaul)} coins`),
                    ...stat("Banked", `${formatCoins(save.coins)} coins`),
                ),
                h("div", { class: "record-rule" }),
                save.insured !== undefined
                    ? h("div", { class: "record-line with-icon" }, this.itemIcon(save.insured), `${getItem(save.insured).name} insured for the next run`)
                    : null,
                f.grave ? h("div", { class: "record-line grave" }, f.grave) : null,
                f.pet ? h("div", { class: "record-line" }, f.pet) : null,
                this.notice ? h("div", { class: "record-line notice" }, this.notice) : null,
            ),
            h(
                "div",
                { class: "card-tiles" },
                this.roomButton("Bank & gear", undefined, this.itemIcon(1127), () => this.showStash()),
                this.roomButton("Shop", undefined, this.itemIcon(995), () => this.showShop()),
                this.roomButton("Tasks", undefined, this.itemIcon(989), () => this.showTasks()),
                this.roomButton("Character", undefined, this.itemIcon(1163), () => this.showCharacter()),
                this.switchCharacterButton(false),
                this.roomButton("Pets", undefined, this.itemIcon(1704), () => this.showTasks()),
                this.roomButton("Settings", undefined, this.gearIcon(), () => this.showSettings()),
            ),
            h(
                "div",
                { class: "menu-box playbar" },
                h("button", { class: "primary", onclick: () => this.showMaps() }, "Choose a map"),
                this.coopEnabled ? h("button", { onclick: () => this.showCoop() }, this.session.room ? `Server: ${this.session.room.name}` : "Co-op") : null,
                chips.length > 0 ? h("span", { class: "playbar-note" }, "or go straight back to") : null,
                ...chips,
                h("span", { class: "spacer" }),
                h("div", { class: "row small" }, ...this.utilityButtons()),
            ),
        );
    }

    // The OSRS-styled title screen (version 114): the character's
    // card on the left with what they wear as the equipment tab lays it out
    // and their record in big numbers, the rooms down the right with a line
    // on each, and along the bottom the way straight back into the last map
    private osrsMenu(): HTMLElement {
        const save = this.save;
        const s = save.stats;
        const f = this.menuFacts();
        const worn = (slot: Slot | "ammo" | undefined) => {
            if (slot === "ammo") {
                return this.ammoSlot("worn-slot");
            }
            const id = slot ? save.equipment[slot] : undefined;
            if (!slot) {
                return h("div", { class: "worn-slot none" });
            }
            if (id === undefined) {
                return h("div", { class: "worn-slot empty", title: slot });
            }
            const wear = wearOf(save.wear, id);
            return h(
                "div",
                { class: "worn-slot" + (wear > 0 ? " worn" : ""), title: getItem(id).name + (wear > 0 ? ` · ${Math.round(wear * 100)}% worn` : "") },
                iconElement(id),
            );
        };
        // The equipment tab's cross: head; cape, neck, (ammunition); weapon,
        // body, shield; legs; hands, feet, ring
        const layout: (Slot | "ammo" | undefined)[] = [undefined, "head", undefined, "cape", "neck", "ammo", "weapon", "body", "shield", undefined, "legs", undefined, "hands", "feet", "ring"];
        const escapeRate = s.runs > 0 ? `${Math.round((s.extractions / s.runs) * 100)}%` : "–";
        const tile = (value: string, label: string, color: string) => h("div", { class: "big-stat" }, h("span", { class: "big-value " + color }, value), h("span", { class: "big-label" }, label));
        const line = (label: string, value: Node | string, cls = "") => h("div", { class: "card-line" }, h("span", { class: "label" }, label), h("span", { class: "value " + cls }, value));
        const last = save.recentMaps.map((id) => WORLD_BY_ID.get(id)).find((w) => w && mapUnlocked(s.mapsBeaten, w.id));
        const worst = Object.values(save.equipment)
            .filter((id): id is number => id !== undefined)
            .map((id) => ({ id, wear: wearOf(save.wear, id) }))
            .sort((a, b) => b.wear - a.wear)[0];
        // Under the name: the crown's word, when there's one, and the gear's
        // combat level (gear.ts: the game has no skills)
        const crown = crownVerified(crownKey(), () => this.onSessionChange());
        const sub = h(
            "div",
            { class: "card-sub" },
            crown ? `${crown.word} · ` : "",
            "combat ",
            h("span", { class: "green" }, String(combatLevel(save.equipment))),
        );
        const lastRun = save.lastRun;
        const lastWord = lastRun
            ? h(
                  "span",
                  {},
                  `${timeAgo(lastRun.at)} · `,
                  h(
                      "span",
                      { class: lastRun.kind === "extracted" ? "green" : "red" },
                      lastRun.kind === "extracted" ? "escaped" : lastRun.kind === "died" ? "died" : "left",
                  ),
              )
            : undefined;
        const card = h(
            "div",
            { class: "osrs-card" },
            h(
                "div",
                { class: "card-head" },
                h("div", { class: "card-portrait" }, crown ? crownIcon(crown) : this.itemIcon(save.equipment.head ?? 1163)),
                h("div", { class: "card-who" }, this.recordName(), sub),
            ),
            h("div", { class: "rule-head" }, "Worn"),
            h("div", { class: "worn-grid" }, ...layout.map(worn)),
            h("div", { class: "big-stats" }, tile(escapeRate, "escaped", "green"), tile(formatCoins(s.bestHaul), "best run", "yellow"), tile(String(s.deaths), "deaths", "red")),
            h(
                "div",
                { class: "card-lines" },
                line("Vault worth", formatCoins(vaultWorth(save.stash, save.coins)), "yellow"),
                this.friendCode() ? line("Friend code", formatFriendCode(this.friendCode()!)) : null,
                lastWord ? line("Last run", lastWord) : line("Escapes", `${s.extractions} of ${s.runs}`),
                worst && worst.wear > 0 ? line(getItem(worst.id).name, `${Math.round(worst.wear * 100)}% worn`, "orange") : null,
                save.insured !== undefined ? line("Insured", getItem(save.insured).name, "green") : null,
                f.pet ? h("div", { class: "card-note" }, f.pet) : null,
                f.grave ? h("div", { class: "card-note grave" }, f.grave) : null,
                this.notice ? h("div", { class: "card-note notice" }, this.notice) : null,
            ),
            h(
                "div",
                { class: "card-buttons" },
                h("button", { onclick: () => this.showCharacter() }, "Character"),
                h("button", { title: "Sets of gear and food, worn and packed in one click", onclick: () => this.showStash() }, "Loadouts"),
            ),
            crownVerified(crownKey())
                ? (() => {
                      const b = this.switchCharacterButton(false)!;
                      b.className = "quiet card-switch";
                      b.replaceChildren("Switch character");
                      return b;
                  })()
                : null,
        );
        const coop = f.coop;
        const rooms = h(
            "div",
            { class: "osrs-rooms" },
            this.roomButton("Choose a map", f.play, this.itemIcon(2677), () => this.showMaps(), true, h("span", { class: "room-arrow" }, "▸")),
            this.coopEnabled ? this.roomButton("Co-op", coop.sub, this.itemIcon(1019), () => this.showCoop(), false, coop.end) : null,
            this.roomButton("Bank & gear", f.stash, this.itemIcon(1127), () => this.showStash()),
            this.roomButton("Shop", f.shop, this.itemIcon(995), () => this.showShop()),
            this.roomButton("Tasks & pets", f.tasks, this.itemIcon(989), () => this.showTasks()),
            this.roomButton("Settings", "Interface, sound, camera", this.gearIcon(), () => this.showSettings()),
        );
        // Solo, or with a party: a private server of this player's own on
        // the map, its code to give friends (or a friend's Join from Co-op)
        const party = this.playMode === "party" && this.coopEnabled;
        const seg = this.coopEnabled
            ? h(
                  "div",
                  { class: "seg" },
                  h("button", { class: party ? "" : "on", onclick: () => this.setPlayMode("solo") }, "Solo"),
                  h("button", { class: party ? "on" : "", onclick: () => this.setPlayMode("party") }, "Party"),
              )
            : null;
        const go = this.session.room
            ? h("button", { class: "go", onclick: () => this.showCoop() }, `Back to ${this.session.room.name}`)
            : last
              ? h(
                    "button",
                    { class: "go", onclick: () => (party ? this.hostParty(last.id) : this.hooks.startRun(last.id)) },
                    party ? `Gather a party for ${last.name}` : `Descend into ${last.name}`,
                )
              : h("button", { class: "go", onclick: () => this.showMaps() }, "Choose your first map");
        const play = h("div", { class: "osrs-play" }, this.contractPanel(false), h("div", { class: "osrs-go" }, this.session.room ? null : seg, go));
        const live = this.session.view.live;
        return h(
            "div",
            { class: "screen title layout-osrs" },
            h("div", { class: "osrs-title" }, h("h1", {}, "Escape from Runkov"), h("div", { class: "tagline" }, "Go in geared. Come out richer. Or don't come out.")),
            card,
            rooms,
            play,
            h(
                "div",
                { class: "osrs-build" },
                `Version ${GAME_BUILD}`,
                live ? h("span", {}, " · ", h("span", { class: "green" }, String(live.raiders)), ` raider${live.raiders === 1 ? "" : "s"} below right now`) : null,
            ),
            h("div", { class: "osrs-utility" }, ...this.utilityButtons()),
        );
    }

    // The ammunition slot beside the neck (version 115): what's packed for
    // the weapon held, the best kind with the count of them all
    private ammoSlot(cls: string): HTMLElement {
        const save = this.save;
        const weapon = save.equipment.weapon !== undefined ? getItem(save.equipment.weapon) : undefined;
        const uses = weapon?.uses;
        if (!uses) {
            return h("div", { class: `${cls} empty`, title: "ammunition" });
        }
        const packed = save.backpack.filter((s) => getItem(s.id).ammo === uses);
        const best = packed.sort((a, b) => getItem(b.id).tier - getItem(a.id).tier)[0];
        if (!best) {
            return h("div", { class: `${cls} empty`, title: `No ${uses} packed for the ${weapon.name.toLowerCase()}` });
        }
        const count = packed.reduce((n, s) => n + s.count, 0);
        return h("div", { class: cls, title: `${count} ${uses} packed` }, iconElement(best.id), h("span", { class: "count" }, String(count)));
    }

    private setPlayMode(mode: "solo" | "party"): void {
        this.playMode = mode;
        this.showMenu();
    }

    // A private party of this player's own on a map, gathered in the war
    // room (once the relay's there)
    private hostParty(mapId: string): void {
        this.pendingCoop = { host: mapId };
        this.showCoop();
    }

    // What waits to be done once the relay answers: a party to join or host
    private runPendingCoop(): void {
        const pending = this.pendingCoop;
        const view = this.session.view;
        if (!pending || view.status !== "online") {
            return;
        }
        this.pendingCoop = undefined;
        if (view.room) {
            return;
        }
        if (pending.join) {
            this.session.join(pending.join);
        } else if (pending.host) {
            this.session.create(pending.host, false);
        }
    }

    // The day's contract (contract.ts): what it asks, how near the best run
    // came, and what it pays. Compact on a phone's title, under the record.
    private contractPanel(compact: boolean): HTMLElement {
        const before = this.save.contract?.day;
        const contract = todaysContract(this.save);
        if (this.save.contract?.day !== before) {
            this.persist();
        }
        const progress = contractProgress(this.save, contract);
        const share = progress.done ? 1 : Math.min(1, progress.best / contract.target);
        const fill = h("div", { class: "gold-fill" });
        fill.style.width = `${Math.round(share * 100)}%`;
        const left = contractResetsIn();
        const resets = `resets in ${Math.floor(left / 3_600_000)}h ${Math.floor((left % 3_600_000) / 60_000)}m`;
        const best =
            contract.kind === "haul"
                ? formatCoins(progress.best)
                : contract.kind === "boss"
                  ? "not yet"
                  : `${progress.best} of ${contract.target}`;
        return h(
            "div",
            { class: "contract" + (compact ? " compact" : "") + (progress.done ? " done" : "") },
            h("div", { class: "contract-head" }, h("span", { class: "contract-title" }, "Daily contract"), h("span", { class: "contract-resets" }, resets)),
            h("div", { class: "contract-text" }, ...contractText(contract)),
            h("div", { class: "gold-bar" }, fill),
            h(
                "div",
                { class: "contract-foot" },
                h("span", {}, progress.done ? "Done today: paid" : `Best attempt ${best}`),
                h("span", {}, "Reward: ", h("span", { class: "yellow" }, formatCoins(contract.reward)), " + clue scroll"),
            ),
        );
    }

    // -----------------------------------------------------------------------
    // Co-op: the party room (coop.ts talks to the relay; main.ts starts the
    // run when the host does)

    // What this player brings to a party, as the room shows it
    private myLoadout(): Loadout {
        const save = this.save;
        const summary = packSummary(save.equipment, save.backpack, save.insured);
        const weapon = save.equipment.weapon !== undefined ? getItem(save.equipment.weapon) : undefined;
        const uses = weapon?.uses;
        const ammo = uses ? save.backpack.reduce((n, s) => n + (getItem(s.id).ammo === uses ? s.count : 0), 0) : undefined;
        return {
            character: save.character,
            equipment: { ...save.equipment },
            pet: save.pet,
            crown: crownKey(),
            activity: this.status(),
            pack: { ...summary, ammo },
        };
    }

    // The character's name on the title screen: with a crown when this
    // browser holds a key (so it's plain which browser does)
    private recordName(): HTMLElement {
        const crown = crownVerified(crownKey(), () => this.onSessionChange());
        const el = h("div", { class: "record-name" }, crown ? crownIcon(crown) : null, this.save.character.name);
        const color = nameColorOf(this.save.character, crownKey());
        if (color) {
            el.style.color = color;
        }
        return el;
    }

    // A member's name for a party row: their crown before it, once their
    // key has checked out (the check redraws the screen)
    private heroLabel(member: MemberView, members: MemberView[], suffix: string): HTMLElement {
        const crown = crownVerified(member.loadout?.crown, () => this.onSessionChange());
        const span = h("span", { class: "name" }, crown ? crownIcon(crown) : null, this.heroName(member, members) + suffix);
        const color = member.loadout ? nameColorOf(member.loadout.character, member.loadout.crown) : undefined;
        if (color) {
            span.style.color = color;
        }
        return span;
    }

    // A member's name in the party: their character's, and only that (the
    // relay's own name for them is never shown, version 74)
    private heroName(member: MemberView, _members: MemberView[]): string {
        return member.loadout?.character.name?.trim() || "Adventurer";
    }

    // A word on what a member's wearing: the weapon and the best tier worn
    private gearLine(loadout: Loadout | undefined): string {
        if (!loadout) {
            return "gear unknown";
        }
        const worn = Object.values(loadout.equipment).filter((id): id is number => id !== undefined);
        const weapon = loadout.equipment.weapon !== undefined ? getItem(loadout.equipment.weapon).name : "bare hands";
        const best = worn.reduce((n, id) => Math.max(n, getItem(id).tier), 0);
        return `${weapon}${best > 0 ? ` · best gear ${"★".repeat(best)}` : ""}`;
    }

    // Back from a guild screen: to the party while in one, else the title
    private back(): void {
        if (this.session.room) {
            this.showCoop();
        } else {
            this.showMenu();
        }
    }

    // The session changed (the relay said something): the co-op screen
    // draws itself again if it's up
    onSessionChange(): void {
        this.updateChat();
        this.noteActivities();
        // Never over a run, or while one loads
        if (this.hud || this.loading) {
            return;
        }
        this.runPendingCoop();
        if (this.screenKey === "coop") {
            this.showCoop();
        } else if (this.screenKey === "menu") {
            this.showMenu();
        }
    }

    // The chat says when someone in the party goes to the vault or the shop
    // (version 115)
    private noteActivities(): void {
        const room = this.session.room;
        if (!room) {
            this.activities.clear();
            return;
        }
        for (const m of room.members) {
            // Someone just in isn't news: only a change from what was seen
            const seen = this.activities.has(m.id);
            const was = this.activities.get(m.id);
            const now = m.loadout?.activity;
            this.activities.set(m.id, now);
            if (!seen || m.id === this.session.view.you || now === was) {
                continue;
            }
            const name = this.heroName(m, room.members);
            if (now === "vault") {
                this.chat.game(`${name} opened the vault.`);
            } else if (now === "shop") {
                this.chat.game(`${name} went to the shop.`);
            }
        }
    }

    // A party's code from an invite link (main.ts): joined once the relay's
    // there
    joinFromLink(code: string): void {
        this.pendingCoop = { join: code };
        // Not over the account screen: it's joined, and shown once in
        if (this.screenKey !== "account" && this.screenKey !== "welcome" && this.screenKey !== "starter" && !this.loading) {
            this.showCoop();
        }
    }

    // Whether a run is loading behind the loading screen
    private loading = false;

    showCoop(): void {
        const session = this.session;
        const view = session.view;
        session.setMe({
            characterId: this.save.character.name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40),
            loadout: this.myLoadout(),
            unlocks: { maps: WORLDS.filter((w) => mapUnlocked(this.save.stats.mapsBeaten, w.id)).map((w) => w.id), endless: [], hard: [] },
        });
        if (view.status === "offline" && !view.error) {
            void session.connect();
        }
        this.runPendingCoop();
        const room = view.room;
        const head: Child[] = [h("h1", { class: "war-title" }, "War Room")];
        let body: HTMLElement;
        let chatBody: HTMLElement | undefined;
        if (view.status !== "online") {
            body = h(
                "div",
                { class: "war-columns" },
                h(
                    "div",
                    { class: "panel coop war-main" },
                    h("div", { class: "subtitle" }, view.error ?? "Connecting to the co-op server..."),
                    view.error ? h("button", { onclick: () => void session.connect().then(() => this.onSessionChange()) }, "Try again") : null,
                ),
            );
        } else if (!room) {
            body = h(
                "div",
                { class: "war-columns" },
                h("div", { class: "war-main" }, this.findPartyPanel(undefined, true), this.hostPartyPanel()),
                h("div", { class: "war-side" }, this.friendsPanel(undefined)),
            );
        } else {
            head.push(this.partyCodeRow(room.code));
            chatBody = h("div", { class: "war-chat-body" });
            const here = room.members.length;
            body = h(
                "div",
                { class: "war-columns" },
                this.partyPanel(),
                h(
                    "div",
                    { class: "war-side" },
                    this.findPartyPanel(room, this.browsing),
                    this.friendsPanel(room),
                    h(
                        "div",
                        { class: "panel war-chat" },
                        h("h2", { class: "left" }, "Party chat ", h("span", { class: "muted" }, `${here} here`)),
                        chatBody,
                    ),
                ),
            );
        }
        const foot = h(
            "div",
            { class: "war-foot" },
            room ? h("button", { class: "quiet", onclick: () => session.leave() }, "Leave the party") : null,
            room && session.isHost && !room.started ? h("button", { class: "quiet", onclick: () => session.disband() }, "Disband") : null,
            h("span", { class: "spacer" }),
            room ? h("button", { onclick: () => this.showStash() }, "Vault") : null,
            room ? h("button", { onclick: () => this.showShop() }, "Shop") : null,
            room ? h("button", { onclick: () => this.showCharacter() }, "Character") : null,
            h("button", { onclick: () => this.showMenu() }, "Title screen"),
        );
        // Drawn again while a code's being typed (the list changed): the
        // typing carries on in the new box
        const active = document.activeElement;
        const typing = active instanceof HTMLInputElement && (active.classList.contains("code") || active.classList.contains("friend-code")) ? active.className : undefined;
        this.showKeyed("coop", h("div", { class: "screen war-room" }, h("div", { class: "war-head" }, ...head), body, foot));
        // The party's chat sits in its panel here (chat.ts), back over the
        // screen everywhere else
        if (chatBody) {
            this.chat.dock(chatBody);
        }
        // The list of public servers, asked for every few seconds while this
        // screen is up (place() stops it for any other)
        session.browse(view.status === "online");
        if (typing) {
            const again = this.root.querySelector<HTMLInputElement>(`input.${typing.split(" ")[0]}`);
            again?.focus();
            again?.setSelectionRange(again.value.length, again.value.length);
        }
    }

    // The party's code big, with Copy and an invite link (the game opened
    // with ?join=<code> joins it)
    private partyCodeRow(code: string): HTMLElement {
        const copy = (text: string, button: HTMLButtonElement, done: string) => {
            void navigator.clipboard
                ?.writeText(text)
                .then(() => (button.textContent = done))
                .catch(() => prompt("Copy this:", text));
        };
        const copyButton = h("button", { class: "small", onclick: () => copy(code, copyButton, "Copied") }, "Copy");
        const inviteButton = h(
            "button",
            { class: "small", title: "A link that opens the game straight into this party", onclick: () => copy(inviteLink(code), inviteButton, "Link copied") },
            "Invite link",
        );
        return h("div", { class: "war-code" }, h("span", { class: "muted" }, "Party code"), h("span", { class: "code" }, code), copyButton, inviteButton);
    }

    // The party: a seat each, with what they wear and carry and whether
    // they're ready, the open seats, a word on anyone short of food or
    // prayer, and along the bottom the map, the loot rule, who can join and
    // the way in
    private partyPanel(): HTMLElement {
        const session = this.session;
        const room = session.room!;
        const me = session.view.you;
        const isHost = session.isHost;
        const world = WORLD_BY_ID.get(room.mapId);
        const guests = room.members.filter((m) => m.id !== room.hostId);
        const readyCount = room.members.filter((m) => m.id === room.hostId || m.ready).length;
        const allReady = guests.every((m) => m.ready);
        const seats: HTMLElement[] = room.members.map((m) => this.seat(m, room.hostId, me, isHost));
        for (let i = room.members.length; i < 4; i++) {
            seats.push(
                h(
                    "div",
                    { class: "seat open" },
                    h("div", { class: "seat-portrait empty" }),
                    h("span", { class: "muted seat-open" }, "Open seat"),
                    h(
                        "button",
                        {
                            class: "small",
                            title: "Copy a link that brings a friend straight into this party",
                            onclick: (e: MouseEvent) => {
                                const button = e.currentTarget as HTMLButtonElement;
                                void navigator.clipboard
                                    ?.writeText(inviteLink(room.code))
                                    .then(() => (button.textContent = "Link copied"))
                                    .catch(() => prompt("Send a friend this link:", inviteLink(room.code)));
                            },
                        },
                        "Invite",
                    ),
                ),
            );
        }
        const warnings = room.members.flatMap((m) => {
            const text = this.headsUp(m, world?.tier ?? 1);
            return text ? [h("div", { class: "heads-up" }, h("span", { class: "orange" }, "Heads up: "), this.heroLabel(m, room.members, ""), ` ${text}`)] : [];
        });
        const seg = (options: [string, string, boolean][], pick: (value: string) => void, enabled: boolean) =>
            h(
                "div",
                { class: "seg" + (enabled ? "" : " fixed") },
                ...options.map(([value, label, on]) => h("button", { class: on ? "on" : "", disabled: !enabled && !on, onclick: () => enabled && !on && pick(value) }, label)),
            );
        const loot: LootRule = room.loot ?? "keep";
        const mapPick = isHost && !room.started
            ? (() => {
                  const select = h("select", { class: "war-select" });
                  for (const w of WORLDS) {
                      if (mapUnlocked(this.save.stats.mapsBeaten, w.id)) {
                          const option = h("option", { value: w.id }, `${w.name} ${"★".repeat(w.tier)}`);
                          option.selected = w.id === room.mapId;
                          select.append(option);
                      }
                  }
                  select.addEventListener("change", () => session.setMap(select.value));
                  return select;
              })()
            : h("div", { class: "yellow bold" }, world ? `${world.name} ${"★".repeat(world.tier)}` : room.mapId);
        const mine = room.members.find((m) => m.id === me);
        const go = room.started
            ? h("button", { class: "go", disabled: true }, "The run is under way")
            : isHost
              ? h(
                    "button",
                    {
                        class: "go",
                        disabled: !allReady,
                        title: allReady ? "Start the run for everyone here" : "Everyone has to be ready first",
                        onclick: () => this.startParty(),
                    },
                    room.members.length === 1 ? "Descend alone" : `Descend · ${readyCount}/${room.members.length} ready`,
                )
              : h("button", { class: mine?.ready ? "" : "go", onclick: () => session.setReady(!mine?.ready) }, mine?.ready ? "Not ready" : `Ready · ${readyCount}/${room.members.length}`);
        return h(
            "div",
            { class: "panel war-main" },
            h("h2", {}, "Party ", h("span", { class: "plain" }, `${room.members.length} / 4`)),
            h("div", { class: "seats" }, ...seats),
            ...warnings,
            session.view.error ? h("div", { class: "record-line notice" }, session.view.error) : null,
            h(
                "div",
                { class: "war-bar" },
                h(
                    "div",
                    { class: "war-field" },
                    h("div", { class: "muted" }, "Map"),
                    mapPick,
                    world ? h("div", { class: "green small-text" }, `${DIFFICULTY[world.tier] ?? ""} · ${world.boss.name.toLowerCase()}`) : null,
                ),
                h(
                    "div",
                    { class: "war-field" },
                    h("div", { class: "muted" }, "Loot"),
                    seg(
                        [
                            ["keep", "Keep what you grab", loot === "keep"],
                            ["split", "Split at the exit", loot === "split"],
                        ],
                        (v) => session.setLoot(v as LootRule),
                        isHost && !room.started,
                    ),
                ),
                h(
                    "div",
                    { class: "war-field" },
                    h("div", { class: "muted" }, "Who can join"),
                    seg(
                        [
                            ["code", "Code", !room.open],
                            ["anyone", "Anyone", room.open],
                        ],
                        (v) => session.setOpen(v === "anyone"),
                        isHost && !room.started,
                    ),
                ),
                go,
            ),
            h(
                "div",
                { class: "stats war-note" },
                loot === "split"
                    ? "Split: every coin anyone picks up is shared between everyone still in, and each keeps their share by getting out."
                    : "Keep: whoever reaches a drop first takes it.",
            ),
        );
    }

    // A party member's seat
    private seat(m: MemberView, hostId: string, me: string | undefined, isHost: boolean): HTMLElement {
        const lo = m.loadout;
        const host = m.id === hostId;
        const ready = host || m.ready;
        const weapon = lo?.equipment.weapon !== undefined ? getItem(lo.equipment.weapon) : undefined;
        const style = weaponStyle(weapon);
        const crown = crownVerified(lo?.crown, () => this.onSessionChange());
        const pack = lo?.pack;
        const away = lo?.activity === "vault" ? "in the vault" : lo?.activity === "shop" ? "in the shop" : undefined;
        const gear = (["head", "body", "weapon", "neck"] as Slot[]).map((slot) => {
            const id = lo?.equipment[slot];
            if (id === undefined) {
                return h("div", { class: "slot empty" });
            }
            return h(
                "div",
                { class: "slot", title: getItem(id).name },
                iconElement(id),
                slot === "weapon" && pack?.ammo !== undefined ? h("span", { class: "count" }, String(pack.ammo)) : null,
            );
        });
        const foodName = pack?.foodId !== undefined ? plural(pack.food, getItem(pack.foodId).name.toLowerCase()) : "no food";
        const prayer = pack ? `${pack.prayerPots} pot${pack.prayerPots === 1 ? "" : "s"} · ${Math.round(prayerSeconds(lo!.equipment, pack.prayerPots))}s` : "–";
        const low = pack ? this.lowFood(pack.heal) : false;
        return h(
            "div",
            { class: "seat" + (ready ? " ready" : " waiting") + (m.id === me ? " mine" : "") },
            h("div", { class: "seat-portrait" }, crown ? crownIcon(crown) : weapon ? iconElement(weapon.id) : null),
            h(
                "div",
                { class: "seat-who" },
                this.heroLabel(m, [], ""),
                h("div", { class: "muted" }, host ? `Leader · ${style}` : capitalize(style), away ? h("span", { class: "orange" }, ` · ${away}`) : null),
                lo ? h("div", { class: "green" }, `level-${combatLevel(lo.equipment)}`) : null,
            ),
            h("div", { class: "seat-gear" }, ...gear),
            h(
                "div",
                { class: "seat-pack" },
                h("div", { class: "card-line" }, h("span", { class: "label" }, "Food"), h("span", { class: "value" + (low ? " red" : "") }, pack ? foodName : "–")),
                h("div", { class: "card-line" }, h("span", { class: "label" }, "Prayer"), h("span", { class: "value" }, prayer)),
                h("div", { class: "card-line" }, h("span", { class: "label" }, "Risking"), h("span", { class: "value yellow" }, pack ? formatCoins(pack.risk) : "–")),
            ),
            h("div", { class: "seat-ready" }, h("span", { class: "check" + (ready ? " on" : " no") }), h("span", { class: ready ? "green bold" : "red bold" }, ready ? "Ready" : "Not ready")),
            isHost && !host ? h("button", { class: "small quiet seat-kick", title: "Remove them from the party", onclick: () => this.session.kick(m.id) }, "Kick") : null,
        );
    }

    // Whether this much healing is short for a run: under three minutes at
    // this player's own pace (gear.ts), or under 150 hitpoints before
    // there's a pace to go by
    private lowFood(heal: number): boolean {
        const minutes = foodMinutes({ food: 0, heal, prayerPots: 0, risk: 0 }, this.save.stats);
        return minutes !== undefined ? minutes < 3 : heal < 150;
    }

    // A word on a member who's short of food, or of prayer past the first
    // tier, or undefined when they're fine
    private headsUp(m: MemberView, tier: number): string | undefined {
        const pack = m.loadout?.pack;
        if (!pack) {
            return undefined;
        }
        const minutes = foodMinutes({ ...pack }, this.save.stats);
        const food = this.lowFood(pack.heal)
            ? pack.heal <= 0
                ? "has no food"
                : minutes !== undefined
                  ? `has food for ${minutesText(minutes)}`
                  : `has only ${pack.heal} hitpoints of food`
            : undefined;
        const prayer = tier >= 2 && pack.prayerPots === 0 ? "no prayer potions" : undefined;
        if (food && prayer) {
            return `${food} and ${prayer}.`;
        }
        if (food) {
            return `${food}.`;
        }
        return prayer ? `has ${prayer}.` : undefined;
    }

    // Other parties: how many wait (on this party's map, in one), a code to
    // join one by, and the list of them to pick from
    private findPartyPanel(room: RoomView | undefined, listed: boolean): HTMLElement {
        const session = this.session;
        const view = session.view;
        const servers = (view.servers ?? []).filter((s) => s.code !== room?.code);
        const onMap = room ? servers.filter((s) => s.mapId === room.mapId) : servers;
        const mapName = room ? (WORLD_BY_ID.get(room.mapId)?.name ?? room.mapId) : undefined;
        const input = h("input", {
            type: "text",
            class: "code",
            placeholder: "Enter a party code",
            value: this.joinCode,
            maxLength: 8,
            autocapitalize: "characters",
            spellcheck: false,
        });
        input.addEventListener("input", () => (this.joinCode = input.value.toUpperCase()));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                session.join(this.joinCode);
            }
        });
        const rows = servers.map((s) => {
            const world = WORLD_BY_ID.get(s.mapId);
            const locked = !view.anyMap && !mapUnlocked(this.save.stats.mapsBeaten, s.mapId);
            return h(
                "div",
                { class: "item-row server" },
                h("span", { class: "name" }, s.name),
                h("span", { class: "stats" }, `${world ? `${world.name} ${"★".repeat(world.tier)}` : s.mapId}${locked ? " (not unlocked for you)" : ""} · ${s.players} of ${s.max}`),
                h("button", { class: "small", disabled: locked, title: locked ? "Beat the map before it to play this one" : `Join ${s.name}`, onclick: () => session.join(s.code) }, "Join"),
            );
        });
        return h(
            "div",
            { class: "panel war-find" },
            h("h2", {}, "Find a party"),
            h(
                "div",
                {},
                room ? `Open parties on ${mapName} right now: ` : "Open parties right now: ",
                h("span", { class: "yellow" }, view.servers === undefined ? "…" : String(onMap.length)),
            ),
            h("div", { class: "war-join" }, input, h("button", { class: "small", onclick: () => session.join(this.joinCode) }, "Join")),
            room
                ? h(
                      "button",
                      {
                          class: "wide",
                          onclick: () => {
                              this.browsing = !this.browsing;
                              this.showCoop();
                          },
                      },
                      this.browsing ? "Hide open parties" : "Browse open parties",
                  )
                : null,
            listed
                ? rows.length > 0
                    ? h("div", { class: "item-list war-list" }, ...rows)
                    : h("div", { class: "muted" }, view.servers === undefined ? "Looking for parties..." : "No open parties right now. Host one, and it shows up here for everyone.")
                : null,
            !room && view.error ? h("div", { class: "record-line notice" }, view.error) : null,
        );
    }

    // A party of this player's own, out of one: the map from those unlocked,
    // open to anyone or by its code
    private hostPartyPanel(): HTMLElement {
        const session = this.session;
        const view = session.view;
        const startMap = this.save.recentMaps.find((id) => mapUnlocked(this.save.stats.mapsBeaten, id)) ?? WORLDS[0].id;
        return h(
            "div",
            { class: "panel war-host" },
            h("h2", {}, "Host a party"),
            h(
                "div",
                { class: "stats" },
                "Up to four on one map. Your browser runs the map and the others play through it, so the best connection should host. A party by code is for friends; one open to anyone is in everyone's list. The map, the loot rule and who can join can all change in the war room.",
            ),
            h(
                "div",
                { class: "row" },
                h("button", { class: "go", disabled: view.full, onclick: () => session.create(startMap, false) }, "Host for friends (code)"),
                h("button", { disabled: view.full, onclick: () => session.create(startMap, true) }, "Host for anyone"),
            ),
            view.full ? h("div", { class: "record-line notice" }, "The co-op server has no room for another party right now; try again in a bit.") : null,
        );
    }

    // Friends (version 115): this character's code to give, a box for a
    // friend's, and the friends with what they're doing, a Join when their
    // party has a seat
    private friendsPanel(room: RoomView | undefined): HTMLElement {
        const save = this.save;
        const session = this.session;
        const view = session.view;
        const online = new Map((view.friends ?? []).map((f) => [f.code, f]));
        // A friend online under a new name: kept, for when they're not
        let renamed = false;
        for (const friend of save.friends ?? []) {
            const now = online.get(friend.code);
            if (now && now.name !== friend.name) {
                friend.name = now.name;
                renamed = true;
            }
        }
        if (renamed) {
            this.persist();
        }
        const input = h("input", { type: "text", class: "friend-code", placeholder: "A friend's code", value: this.friendTyped, maxLength: 9, autocapitalize: "characters", spellcheck: false });
        const add = () => {
            const code = this.friendTyped.toUpperCase().replace(/[^A-Z0-9]/g, "");
            const friends = (save.friends ??= []);
            if (code.length !== 8) {
                this.friendNote = "A friend code is eight letters and numbers.";
            } else if (code === view.friendCode) {
                this.friendNote = "That's your own code.";
            } else if (friends.some((f) => f.code === code)) {
                this.friendNote = "They're on your list already.";
            } else if (friends.length >= MAX_FRIENDS) {
                this.friendNote = `Your list is full (${MAX_FRIENDS}).`;
            } else {
                friends.push({ code, name: "A friend" });
                this.friendTyped = "";
                this.friendNote = "Added. They show up here once they've added your code too.";
                this.persist();
                this.tellFriends();
            }
            this.showCoop();
        };
        input.addEventListener("input", () => (this.friendTyped = input.value));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                add();
            }
        });
        const friends = [...(save.friends ?? [])].sort((a, b) => Number(online.has(b.code)) - Number(online.has(a.code)) || a.name.localeCompare(b.name));
        const rows = friends.map((friend) => {
            const now = online.get(friend.code);
            const canJoin = now?.party && now.party.code !== room?.code;
            return h(
                "div",
                { class: "friend-row" + (now ? " online" : "") },
                h("span", { class: "friend-dot" + (now ? " on" : "") }),
                h("span", { class: "friend-who" }, now ? this.friendName(now) : h("span", { class: "friend-name muted" }, friend.name), h("span", { class: "muted" }, now ? this.friendDoing(now) : "offline")),
                canJoin ? h("button", { class: "small go", onclick: () => this.joinFriend(now!) }, "Join") : null,
                h(
                    "button",
                    {
                        class: "small quiet",
                        title: "Take them off your list",
                        onclick: () => {
                            save.friends = (save.friends ?? []).filter((f) => f.code !== friend.code);
                            this.persist();
                            this.tellFriends();
                            this.showCoop();
                        },
                    },
                    "×",
                ),
            );
        });
        const code = this.friendCode();
        const copy = h(
            "button",
            {
                class: "small",
                disabled: !code,
                onclick: () => {
                    if (code) {
                        void navigator.clipboard?.writeText(code).then(() => (copy.textContent = "Copied")).catch(() => prompt("Your friend code:", code));
                    }
                },
            },
            "Copy",
        );
        return h(
            "div",
            { class: "panel war-friends" },
            h("h2", {}, "Friends ", h("span", { class: "plain" }, `${online.size} online`)),
            h("div", { class: "friend-mine" }, h("span", { class: "muted" }, "Your code"), h("span", { class: "code" }, code ? formatFriendCode(code) : "…"), copy),
            h("div", { class: "war-join" }, input, h("button", { class: "small", onclick: add }, "Add")),
            this.friendNote ? h("div", { class: "muted small-text" }, this.friendNote) : null,
            rows.length > 0
                ? h("div", { class: "friend-list" }, ...rows)
                : h("div", { class: "muted small-text" }, "Give friends your code and add theirs. Once you've both added each other, you see each other online here and on the title screen."),
        );
    }

    // The host starts it: everyone's loadout goes with the start, and the
    // map's seed, so every browser lays the same map out
    private startParty(): void {
        const room = this.session.room;
        if (!room || !this.session.isHost) {
            return;
        }
        const world = WORLD_BY_ID.get(room.mapId) ?? WORLDS[0];
        const fallback = this.myLoadout();
        const heroes: GameStart["heroes"] = room.members.map((m) => ({
            id: m.id,
            name: this.heroName(m, room.members),
            characterId: m.characterId,
            loadout: m.loadout ?? { ...fallback, character: { ...fallback.character, name: "Adventurer" } },
        }));
        this.session.start({ seed: (Date.now() ^ (world.tier * 7919)) >>> 0, mapId: world.id, endless: false, hard: false, heroes, loot: room.loot ?? "keep" });
    }

    // -----------------------------------------------------------------------
    // Settings

    showSettings(): void {
        this.show(h("div", { class: "screen" }, this.settingsPanel(() => this.back())));
    }

    // The settings, changed on the spot, with a way back: from the guild and
    // from the pause menu
    private settingsPanel(back: () => void): HTMLElement {
        const row = (label: string, control: HTMLElement, note?: string) =>
            h("div", { class: "setting" }, h("label", {}, label), note ? h("span", { class: "stats" }, note) : null, control);
        const slider = (value: number, min: number, max: number, set: (v: number) => void) => {
            const input = h("input", {
                type: "range",
                min: String(Math.round(min * 100)),
                max: String(Math.round(max * 100)),
                value: String(Math.round(value * 100)),
            });
            input.oninput = () => {
                set(Number(input.value) / 100);
                saveSettings();
            };
            return input;
        };
        const toggle = (key: "muted" | "menuSpin" | "healthBars" | "fixedStick") => {
            const input = h("input", { type: "checkbox", checked: settings[key] });
            input.onchange = () => {
                settings[key] = input.checked;
                saveSettings();
                applyMusicVolume();
            };
            return input;
        };
        return h(
            "div",
            { class: "panel settings" },
            h("h2", {}, "Settings"),
            // The account (version 116), between runs: logging out leaves this
            // device's copy until another account logs in on it
            this.account?.name && !this.hud && loadedSlot() === 0
                ? row(
                      "Account",
                      h(
                          "button",
                          { onclick: () => void this.logOut() },
                          "Log out",
                      ),
                      `${this.account.name}: your progress is saved with it, on every device you log in on. Log out to switch accounts or make another`,
                  )
                : null,
            row(
                "Brightness",
                slider(settings.brightness, BRIGHTNESS_MIN, BRIGHTNESS_MAX, (v) => {
                    settings.brightness = v;
                    this.menu.setBrightness(v);
                }),
            ),
            row(
                "Sound volume",
                slider(settings.volume, 0, 1, (v) => (settings.volume = v)),
            ),
            row(
                "Music volume",
                slider(settings.music, 0, 1, (v) => {
                    settings.music = v;
                    applyMusicVolume();
                }),
            ),
            row("Sounds off", toggle("muted")),
            row("Camera circles the character in the guild", toggle("menuSpin")),
            row(
                "Camera distance in a run",
                slider(settings.zoom, ZOOM_MIN, ZOOM_MAX, (v) => {
                    settings.zoom = v;
                    this.hud?.run.setZoom(v);
                }),
                "the mouse wheel changes it too",
            ),
            row(
                "Hotbar size",
                slider(settings.hotbarSize, HOTBAR_MIN, HOTBAR_MAX, (v) => {
                    settings.hotbarSize = v;
                    applyHotbarSize();
                }),
                "the food and potion slots at the bottom of a run",
            ),
            row("Health bars over enemies", toggle("healthBars")),
            isTouch
                ? row("The stick stays in its ring", toggle("fixedStick"), "off, it appears under your thumb anywhere on the left")
                : null,
            row(
                "Title screen",
                h(
                    "button",
                    {
                        onclick: (e: MouseEvent) => {
                            const next = MENU_LAYOUTS[(MENU_LAYOUTS.indexOf(settings.menuLayout) + 1) % MENU_LAYOUTS.length];
                            settings.menuLayout = next;
                            saveSettings();
                            (e.currentTarget as HTMLButtonElement).textContent = LAYOUT_NAMES[next];
                        },
                    },
                    LAYOUT_NAMES[settings.menuLayout],
                ),
                isTouch ? "phones always use the rail" : "your card and the rooms, the rooms down a rail, or a card and a grid",
            ),
            h("div", { class: "subtitle" }, "Settings are this browser's; a save code doesn't carry them."),
            h("button", { onclick: back }, "Back"),
        );
    }

    // -----------------------------------------------------------------------
    // Pausing a run

    private togglePause(): void {
        const hud = this.hud;
        if (!hud) {
            return;
        }
        if (hud.pause.hidden) {
            hud.touch?.cancel();
            hud.run.setPaused(true);
            this.showPauseView("menu");
        } else if (hud.pauseView === "trade") {
            this.resume();
        } else if (hud.pauseView !== "menu") {
            this.showPauseView("menu");
        } else {
            this.resume();
        }
    }

    // The trader's stall, over the run while it stands still
    showTrade(): void {
        const hud = this.hud;
        if (!hud || !hud.pause.hidden) {
            return;
        }
        hud.touch?.cancel();
        hud.run.setPaused(true);
        this.showPauseView("trade");
    }

    private resume(): void {
        const hud = this.hud;
        if (!hud) {
            return;
        }
        hud.pause.hidden = true;
        hud.pause.replaceChildren();
        hud.run.setPaused(false);
    }

    private showPauseView(view: PauseView): void {
        const hud = this.hud;
        if (!hud) {
            return;
        }
        // The same page drawn again (a buy at the trader) keeps its scroll
        const tops = hud.pauseView === view && !hud.pause.hidden ? scrollTops(hud.pause) : [];
        hud.pauseView = view;
        hud.pause.hidden = false;
        const back = () => this.showPauseView("menu");
        let page: HTMLElement;
        if (view === "settings") {
            page = this.settingsPanel(back);
        } else if (view === "stats") {
            page = this.statsPanel(hud.run, back);
        } else if (view === "trade") {
            page = this.tradePanel(hud.run);
        } else {
            const run = hud.run;
            const leaveText = run.isDone
                ? "Back to the guild? Your part of the run is over; nothing more is lost."
                : run.coop?.role === "host"
                  ? "Leave the run? Everything you carry and wear stays behind, as if you'd died, and the run ends for the whole party (they keep what they carry)."
                  : "Leave the run? Everything you carry and wear stays behind, as if you'd died.";
            page = h(
                "div",
                { class: "menu-box pause-box" },
                h("h2", {}, run.coop ? "Menu" : "Paused"),
                run.coop ? h("div", { class: "hint" }, "The world doesn't wait in co-op") : null,
                h("button", { class: "primary", onclick: () => this.resume() }, "Resume"),
                h("button", { onclick: () => this.showPauseView("stats") }, "Stats"),
                h("button", { onclick: () => this.showPauseView("settings") }, "Settings"),
                h(
                    "button",
                    {
                        onclick: () => {
                            if (confirm(leaveText)) {
                                run.leave();
                            }
                        },
                    },
                    run.isDone ? "Back to the guild" : "Leave run",
                ),
                h("div", { class: "hint" }, "Esc resumes"),
            );
        }
        hud.pause.replaceChildren(page);
        restoreScroll(hud.pause, tops);
    }

    // The wandering trader's stall: the map's food, every potion and
    // ammunition by the bundle at half again the shop's prices, paid from
    // the coins carried; and he buys the gear in your pack at the shop's
    // price for it
    private tradePanel(run: Run): HTMLElement {
        const tier = run.world.tier;
        const stock: { id: number; count: number }[] = [
            { id: FOOD_BY_TIER[Math.min(FOOD_BY_TIER.length - 1, tier - 1)], count: 1 },
            ...SHOP_POTIONS.map((id) => ({ id, count: 1 })),
            // The map's own tier of arrows (its best kind), its spells'
            // catalyst, and air runes, which most spells take
            { id: ammoOfTier("arrows", tier, 0.99), count: 25 },
            { id: catalystOfTier(tier), count: 25 },
            { id: AIR_RUNE, count: 100 },
        ];
        const again = () => this.showPauseView("trade");
        const rows = stock.map(({ id, count }) => {
            const item = getItem(id);
            const cost = Math.round(price(item) * count * TRADER_MARKUP);
            return itemRow(
                item,
                count,
                h(
                    "button",
                    {
                        class: "primary",
                        disabled: run.coins < cost,
                        onclick: () => {
                            if (run.buy(id, count, cost)) {
                                again();
                            }
                        },
                    },
                    `Buy ${formatCoins(cost)}`,
                ),
            );
        });
        const sells = run.inventory
            .filter((s) => getItem(s.id).slot)
            .map((s) => {
                const item = getItem(s.id);
                return itemRow(
                    item,
                    s.count,
                    h(
                        "button",
                        {
                            onclick: () => {
                                if (run.sell(s.id)) {
                                    again();
                                }
                            },
                        },
                        `Sell ${formatCoins(sellPrice(item))}`,
                    ),
                );
            });
        return h(
            "div",
            { class: "panel trade" },
            h("h2", {}, "Wandering trader"),
            h("div", { class: "subtitle" }, `${formatCoins(run.coins)} coins in your purse · pack ${run.inventory.length}/${run.slots}`),
            h("h3", {}, "For sale"),
            h("div", { class: "item-list" }, ...rows),
            sells.length > 0 ? h("h3", {}, "He'll buy") : null,
            sells.length > 0 ? h("div", { class: "item-list" }, ...sells) : null,
            h("button", { class: "primary", onclick: () => this.resume() }, "Done"),
            h("div", { class: "hint" }, isTouch ? "Done, or Pause, closes" : "Esc closes"),
        );
    }

    // What the numbers are right now, what each one does, and where it
    // comes from: the gear worn and the potions in you
    private statsPanel(run: Run, back: () => void): HTMLElement {
        const s = run.stats;
        const special = specialOf(s.weapon);
        const soaked = Math.round(soak(s.defence) * 100);
        const perSecond = ((s.damage * 0.8) / s.speed).toFixed(1);
        const line = (label: string, value: string, note: string) =>
            h(
                "div",
                { class: "item-row stat-row" },
                h("span", { class: "name" }, label),
                h("span", { class: "value" }, value),
                h("span", { class: "stats" }, note),
            );
        const worn = SLOTS.flatMap((slot) => {
            const id = run.equipment[slot];
            if (id === undefined) {
                return [];
            }
            const w = wearOf(run.wear, id);
            return [itemRow(getItem(id), 1, w > 0 ? h("span", { class: "stats" }, `worn ${Math.round(w * 100)}%`) : h("span"))];
        });
        const potions = (Object.keys(run.boosts) as Potion[])
            .filter((kind) => run.boosts[kind] > 0)
            .map((kind) =>
                h(
                    "div",
                    { class: "item-row" },
                    h("span", { class: "name" }, POTION_NAMES[kind]),
                    h("span", { class: "stats" }, `${POTION_EFFECT[kind]}, ${Math.ceil(run.boosts[kind])}s left`),
                ),
            );
        return h(
            "div",
            { class: "panel stats" },
            h("h2", {}, "Stats"),
            h(
                "div",
                { class: "item-list" },
                line("Max hit", String(s.damage), "every hit lands for 60% to 100% of it"),
                line("Swing", `${s.speed}s`, `one attack every ${s.speed}s: about ${perSecond} damage a second`),
                line(
                    s.ranged ? "Range" : "Reach",
                    String(s.range),
                    s.ranged ? "tiles an arrow or spell flies" : "tiles the weapon reaches in front of you",
                ),
                line(
                    "Defence",
                    String(s.defence),
                    `soaks ${soaked}% of every hit you take; 80 soaks half, and never more than three quarters`,
                ),
                line(
                    "Hitpoints",
                    `${run.hp} / ${run.maxHp}`,
                    `${BASE_HP} plus your gear; half a point a second comes back after ${REGEN_DELAY}s unhurt with nothing after you`,
                ),
                line(
                    "Speed",
                    `${run.speed().toFixed(1)} tiles/s`,
                    run.weight() > 0
                        ? `the gear in your pack slows you ${Math.round(run.weight() * 100)}%`
                        : "nothing in the pack weighs you down; gear there would",
                ),
                line(
                    "Protection",
                    run.protect === "none" ? "none" : `from ${run.protect}`,
                    "halves hits of that style while the prayer bar lasts: Z melee, X ranged, C magic, or the Pray button; the bar refills slowly with none on, and holy gear's prayer bonus stretches it",
                ),
                line(
                    "Set",
                    s.set ? BARROWS_SETS[s.set].name : "none",
                    s.set ? SET_EFFECTS[s.set] : "a full Barrows set, helm to weapon, has an effect of its own",
                ),
                line(
                    "Special",
                    special ? special.name : "none",
                    special
                        ? `${special.hits > 1 ? `${special.hits} hits` : "one hit"} at ${Math.round(special.power * 100)}% of the usual` +
                              (special.heal ? `, healing ${Math.round(special.heal * 100)}% of what it deals` : "") +
                              "; Q, or the Spec button, when the bar is half full"
                        : "wear a weapon",
                ),
            ),
            h("h2", {}, "Worn"),
            h(
                "div",
                { class: "item-list" },
                ...(worn.length > 0 ? worn : [h("div", { class: "subtitle" }, "Nothing: bare hands hit 3 every 0.7s.")]),
            ),
            h("h2", {}, "Potions"),
            h("div", { class: "item-list" }, ...(potions.length > 0 ? potions : [h("div", { class: "subtitle" }, "None in you.")])),
            h("button", { onclick: back }, "Back"),
        );
    }

    // -----------------------------------------------------------------------
    // Map select

    showMaps(): void {
        const beaten = this.save.stats.mapsBeaten;
        const rows = WORLDS.map((world) => {
            // Your gravestone there, if you died on the map lately
            const grave = this.save.graves.find((g) => g.map === world.id);
            const things = grave ? grave.items.reduce((n, s) => n + s.count, 0) : 0;
            const open = mapUnlocked(beaten, world.id);
            const before = mapBefore(world.id);
            return h(
                "div",
                { class: "item-row map-row" + (open ? "" : " locked") },
                h(
                    "div",
                    { class: "name" },
                    h(
                        "div",
                        { class: "map-name" },
                        `${world.name} `,
                        h("span", { class: "stats" }, "★".repeat(world.tier)),
                        beaten.includes(world.id) ? h("span", { class: "beaten" }, " ✓ beaten") : null,
                    ),
                    h("div", { class: "stats" }, world.description),
                    h(
                        "div",
                        { class: "stats" },
                        `${world.enemies.map((e) => e.def.name).join(", ")}. Boss: ${world.boss.name}.`,
                    ),
                    !open && before
                        ? h("div", { class: "lock" }, `Locked: slay ${before.boss.name} on ${before.name} and escape with the loot first.`)
                        : null,
                    grave
                        ? h(
                              "div",
                              { class: "grave" },
                              `Your gravestone stands here with ${things} thing${things === 1 ? "" : "s"} in it, for ${grave.runsLeft} more run${grave.runsLeft === 1 ? "" : "s"}.`,
                          )
                        : null,
                ),
                h("button", { class: "primary", disabled: !open, onclick: () => this.hooks.startRun(world.id) }, open ? "Go" : "Locked"),
            );
        });
        this.show(
            h(
                "div",
                { class: "screen" },
                h("h2", {}, "Where to?"),
                h(
                    "div",
                    { class: "subtitle" },
                    "The maps open in order: slay a map's boss and escape in the same run, and the next opens. Stars are how hard a map is and how good its chests are; the guild's starter kit is good for one star.",
                ),
                h("div", { class: "panel maps" }, h("div", { class: "item-list" }, ...rows)),
                h("button", { onclick: () => this.back() }, "Back"),
            ),
        );
    }

    showLoading(text: string): void {
        this.loading = true;
        this.showOverRun(h("div", { class: "screen solid" }, h("h2", {}, text), h("div", { class: "loading" }, "Loading the floor...")));
    }

    // -----------------------------------------------------------------------
    // Stash

    // How a piece stands against what's worn in its slot (the vault's hover
    // card): a weapon's max hit, speed and special, armour's defence,
    // hitpoints and prayer
    private compareLine(item: ItemDef): HTMLElement[] {
        const slot = item.slot;
        if (!slot) {
            return [h("div", {}, describe(item))];
        }
        const wornId = this.save.equipment[slot];
        if (wornId === item.id) {
            return [h("div", { class: "green" }, "Worn now")];
        }
        const worn = wornId !== undefined ? getItem(wornId) : undefined;
        const diff = (n: number, word: string, lowerIsBetter = false): Child =>
            n === 0 ? null : h("span", { class: (n > 0) !== lowerIsBetter ? "green" : "red" }, `${n > 0 ? "+" : ""}${Math.round(n * 10) / 10} ${word}`);
        const parts: Child[] = [];
        if (slot === "weapon") {
            const hit = (item.damage ?? 0) - (worn?.damage ?? 3);
            const speed = Math.round(((item.speed ?? 0) - (worn?.speed ?? 0.7)) * 10) / 10;
            parts.push(
                diff(hit, "max hit") ?? "same max hit",
                ", ",
                speed === 0 ? "same speed" : h("span", { class: speed < 0 ? "green" : "red" }, speed < 0 ? "faster" : "slower"),
                ", ",
                `special: ${specialOf(item)?.name ?? "none"}`,
            );
        } else {
            const found = [
                diff((item.defence ?? 0) - (worn?.defence ?? 0), "defence"),
                diff((item.hp ?? 0) - (worn?.hp ?? 0), "hitpoints"),
                diff((item.prayer ?? 0) - (worn?.prayer ?? 0), "prayer"),
            ].filter(Boolean);
            if (found.length === 0) {
                parts.push("no better or worse");
            }
            found.forEach((part, i) => parts.push(...(i > 0 ? [", ", part] : [part])));
        }
        return [h("div", {}, worn ? `vs your ${worn.name}: ` : "Nothing worn there: ", ...parts)];
    }

    // How many a move takes, of so many there
    private quantity(have: number): number {
        const q = this.bankQty;
        return q === "all" ? have : q === "x" ? this.bankX : q;
    }

    private quantityWord(): string {
        const q = this.bankQty;
        return q === "all" ? "all" : q === "x" ? String(this.bankX) : String(q);
    }

    showStash(): void {
        const save = this.save;
        const stats = gearStats(save.equipment, save.wear);
        const render = () => this.showStash();
        // How worn a piece is, for its label
        const wornNote = (id: number) => {
            const w = wearOf(save.wear, id);
            return w > 0 ? ` Worn ${Math.round(w * 100)}%${w >= 1 ? ", half its defence gone" : ""}.` : "";
        };

        // What's worn as the client's equipment tab lays it out (version
        // 115): head; cape, neck, ammunition; weapon, body, shield; legs;
        // hands, feet, ring. A click takes a piece off into the bank.
        const cross: (Slot | "ammo" | undefined)[] = [undefined, "head", undefined, "cape", "neck", "ammo", "weapon", "body", "shield", undefined, "legs", undefined, "hands", "feet", "ring"];
        const equipment = h(
            "div",
            { class: "equip-cross" },
            ...cross.map((slot) => {
                if (slot === undefined) {
                    return h("div", { class: "equip-slot none" });
                }
                if (slot === "ammo") {
                    return this.ammoSlot("equip-slot");
                }
                const id = save.equipment[slot];
                const item = id !== undefined ? getItem(id) : undefined;
                const wear = id !== undefined ? wearOf(save.wear, id) : 0;
                return h(
                    "div",
                    {
                        class: "equip-slot" + (item ? "" : " empty") + (wear > 0 ? " worn" : ""),
                        title: item ? `${item.name}: ${describe(item)}.${wornNote(item.id)} Click to take off.` : slot,
                        onclick: () => {
                            if (unequip(save.equipment, save.stash, slot)) {
                                this.persist();
                                render();
                            }
                        },
                    },
                    item ? icon(item) : h("span", { class: "slot-name" }, slot),
                );
            }),
        );

        const backpack = h(
            "div",
            { class: "slots" },
            ...Array.from({ length: packSize(save) }, (_, i) => {
                const stack = save.backpack[i];
                if (!stack) {
                    return h("div", { class: "slot empty" });
                }
                const item = getItem(stack.id);
                const all = countOf(save.backpack, stack.id);
                return h(
                    "div",
                    {
                        class: "slot" + (this.bankSelected === stack.id ? " selected" : ""),
                        title: `${item.name}: ${describe(item)}. Click to put ${all > 1 ? `${this.quantityWord()} of them` : "it"} back in the vault.`,
                        onclick: () => {
                            // As many as the quantity says (version 115; 102
                            // asked how many when there was more than one)
                            const { id } = stack;
                            const n = Math.min(all, this.quantity(all));
                            removeItem(save.backpack, id, n);
                            if (id === COINS) {
                                save.coins += n;
                            } else {
                                addItem(save.stash, id, n);
                            }
                            this.persist();
                            render();
                        },
                    },
                    icon(item),
                    stack.count > 1 ? h("span", { class: "count" }, String(stack.count)) : null,
                );
            }),
        );

        // Insurance covers what's going in: worn gear, or gear in the backpack
        const insurable: number[] = [];
        for (const slot of SLOTS) {
            const id = save.equipment[slot];
            if (id !== undefined) {
                insurable.push(id);
            }
        }
        for (const stack of save.backpack) {
            if (getItem(stack.id).slot && !insurable.includes(stack.id)) {
                insurable.push(stack.id);
            }
        }
        const insuranceRows = insurable.map((id) => {
            const item = getItem(id);
            const cost = Math.max(10, Math.round(price(item) * 0.2 * (1 - 0.25 * save.upgrades.insurance)));
            const insured = save.insured === id;
            return itemRow(
                item,
                1,
                h(
                    "button",
                    {
                        disabled: insured || save.coins < cost,
                        onclick: () => {
                            save.coins -= cost;
                            save.insured = id;
                            this.persist();
                            render();
                        },
                    },
                    insured ? "Insured" : `Insure ${formatCoins(cost)}`,
                ),
            );
        });

        // Repairs: every worn piece of armour owned, at a tenth of its price
        // per full wear
        const repairable: number[] = [];
        for (const id of [...Object.values(save.equipment), ...save.stash.map((s) => s.id), ...save.backpack.map((s) => s.id)]) {
            if (id !== undefined && wearOf(save.wear, id) > 0 && !repairable.includes(id)) {
                repairable.push(id);
            }
        }
        const repairRows = repairable.map((id) => {
            const item = getItem(id);
            const cost = repairCost(item, save.wear);
            return itemRow(
                item,
                1,
                h("span", { class: "stats" }, `worn ${Math.round(wearOf(save.wear, id) * 100)}%`),
                h(
                    "button",
                    {
                        disabled: save.coins < cost,
                        onclick: () => {
                            save.coins -= cost;
                            delete save.wear[id];
                            this.persist();
                            render();
                        },
                    },
                    `Repair ${formatCoins(cost)}`,
                ),
            );
        });
        const repairAll = repairable.reduce((n, id) => n + repairCost(getItem(id), save.wear), 0);

        // Coins: the bank is the stash's, and some can be packed for a run
        // (the trader and the genie take them; they come home to the bank
        // with an escape and are lost with a death). The amount typed, or
        // everything on that side when nothing is.
        const packedCoins = countOf(save.backpack, COINS);
        const amountInput = h("input", { type: "text", inputMode: "numeric", placeholder: "How many", value: this.coinAmount });
        const amount = (): number => {
            const n = Math.floor(Number(this.coinAmount.replace(/[^0-9]/g, "")));
            return Number.isFinite(n) && n > 0 ? n : 0;
        };
        // The two buttons say what they'd move, as the amount is typed
        const packLabel = () => (amount() > 0 ? `Pack ${formatCoins(Math.min(amount(), save.coins))}` : "Pack all");
        const bankLabel = () => (amount() > 0 ? `Bank ${formatCoins(Math.min(amount(), packedCoins))}` : "Bank all");
        amountInput.addEventListener("input", () => {
            this.coinAmount = amountInput.value;
            packButton.textContent = packLabel();
            bankButton.textContent = bankLabel();
        });
        const setAmount = (n: number) => {
            this.coinAmount = String(n);
            this.coinNote = "";
            render();
        };
        const packCoins = (wanted: number) => {
            const n = Math.min(wanted, save.coins);
            if (n <= 0) {
                return;
            }
            if (!addItem(save.backpack, COINS, n, packSize(save))) {
                this.coinNote = "The pack is full: coins need a slot of their own.";
                render();
                return;
            }
            save.coins -= n;
            this.coinNote = `${formatCoins(n)} coins packed.`;
            this.persist();
            render();
        };
        const bankCoins = (wanted: number) => {
            const n = Math.min(wanted, packedCoins);
            if (n <= 0) {
                return;
            }
            removeItem(save.backpack, COINS, n);
            save.coins += n;
            this.coinNote = `${formatCoins(n)} coins banked.`;
            this.persist();
            render();
        };
        const packButton = h(
            "button",
            { disabled: save.coins <= 0, title: "From the bank into the pack: the amount typed, or all of it", onclick: () => packCoins(amount() || save.coins) },
            packLabel(),
        );
        const bankButton = h(
            "button",
            { disabled: packedCoins <= 0, title: "From the pack back into the bank: the amount typed, or all of it", onclick: () => bankCoins(amount() || packedCoins) },
            bankLabel(),
        );
        const coinsPanel = [
            h(
                "div",
                { class: "subtitle" },
                `${formatCoins(save.coins)} coins banked, ${formatCoins(packedCoins)} packed. Packed coins go in with you, for the trader and the genie; escape and they come home to the bank, die and they're gone. Type how many to move, or move them all.`,
            ),
            h(
                "div",
                { class: "coin-move" },
                amountInput,
                packButton,
                bankButton,
            ),
            h(
                "div",
                { class: "coin-move" },
                ...[100, 1000, 10000].map((n) => h("button", { onclick: () => setAmount(n) }, formatCoins(n))),
                h("button", { disabled: save.coins <= 1, onclick: () => setAmount(Math.floor(save.coins / 2)) }, "Half the bank"),
                h("button", { disabled: save.coins <= 0 && packedCoins <= 0, onclick: () => setAmount(0) }, "All"),
            ),
            this.coinNote ? h("div", { class: "subtitle" }, this.coinNote) : null,
        ];

        // The bank (version 92): the stash as a grid of icons, as OSRS's bank
        // is, in tabs and searchable, with what's picked shown under it to
        // wear or pack. One cell a kind of thing, its count on it; the coins
        // first. The exclusive pieces (a crowned test character's own) head
        // it, then the best tier first, by name within a tier.
        const held = new Map<number, number>();
        for (const stack of save.stash) {
            held.set(stack.id, (held.get(stack.id) ?? 0) + stack.count);
        }
        // Arranged by hand (version 115: dragged about, save.bankOrder) first
        // in that order, the rest after as before
        const order = new Map((save.bankOrder ?? []).map((id, i) => [id, i]));
        const kinds = [...held.keys()].sort(
            (a, b) =>
                (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) ||
                Number(!!getItem(b).exclusive) - Number(!!getItem(a).exclusive) ||
                getItem(b).tier - getItem(a).tier ||
                getItem(a).name.localeCompare(getItem(b).name),
        );
        // A cell dragged onto another: the two swap places, or it goes in
        // before the other, as Rearrange says; the order is then the whole
        // bank's as it stands
        const rearrange = (from: number, to: number) => {
            const list = kinds.slice();
            const a = list.indexOf(from);
            const b = list.indexOf(to);
            if (a < 0 || b < 0 || a === b) {
                return;
            }
            if (this.bankRearrange === "swap") {
                [list[a], list[b]] = [list[b], list[a]];
            } else {
                list.splice(a, 1);
                list.splice(list.indexOf(to), 0, from);
            }
            save.bankOrder = list;
            this.persist();
            render();
        };
        // A tab of the player's own (version 115) takes a thing dropped on it
        const addToTab = (index: number, id: number) => {
            const tab = save.bankTabs?.[index];
            if (tab && !tab.ids.includes(id)) {
                tab.ids.push(id);
                this.persist();
                render();
            }
        };
        // Tabs with nothing left in them go
        if (save.bankTabs?.some((t) => !t.ids.some((id) => held.has(id)))) {
            save.bankTabs = save.bankTabs.filter((t) => t.ids.some((id) => held.has(id)));
        }
        const firstExclusive = kinds.find((id) => getItem(id).exclusive);
        const armourSlots = ["head", "body", "legs", "feet", "hands", "shield"];
        const tabs: { key: string; name: string; icon?: number; has: (item: ItemDef) => boolean; own?: number }[] = [
            { key: "all", name: "All", has: () => true },
            ...(firstExclusive !== undefined ? [{ key: "yours", name: "Yours alone", icon: firstExclusive, has: (i: ItemDef) => !!i.exclusive }] : []),
            { key: "weapons", name: "Weapons", icon: 1333, has: (i) => i.slot === "weapon" },
            { key: "armour", name: "Armour", icon: 1127, has: (i) => !!i.slot && armourSlots.includes(i.slot) },
            { key: "jewellery", name: "Jewellery and capes", icon: 1704, has: (i) => i.slot === "neck" || i.slot === "ring" || i.slot === "cape" },
            { key: "supplies", name: "Food and potions", icon: 379, has: (i) => !!i.heal || !!i.potion },
            { key: "ammo", name: "Arrows and runes", icon: 882, has: (i) => !!i.ammo },
            ...(save.bankTabs ?? []).map((t, index) => ({
                key: `own:${index}`,
                name: `${t.name} (your tab: drop things on it to add them)`,
                icon: t.ids.find((id) => held.has(id)),
                has: (i: ItemDef) => t.ids.includes(i.id),
                own: index,
            })),
        ];
        if (!tabs.some((t) => t.key === this.bankTab)) {
            this.bankTab = "all";
        }
        const tab = tabs.find((t) => t.key === this.bankTab)!;
        // The cells showing: the tab's, and the search's (the coins are in All)
        const shown = (): number[] => {
            const words = this.bankSearch.trim().toLowerCase();
            const ids = [...(save.coins > 0 && tab.key === "all" ? [COINS] : []), ...kinds.filter((id) => tab.has(getItem(id)))];
            return words ? ids.filter((id) => getItem(id).name.toLowerCase().includes(words)) : ids;
        };
        const countOfKind = (id: number) => (id === COINS ? save.coins : (held.get(id) ?? 0));
        // OSRS's stack counts: yellow, white over a hundred thousand (K),
        // green over ten million (M)
        const stackLabel = (n: number) =>
            n >= 10_000_000
                ? h("span", { class: "count big" }, `${Math.floor(n / 1_000_000)}M`)
                : n >= 100_000
                  ? h("span", { class: "count mid" }, `${Math.floor(n / 1000)}K`)
                  : h("span", { class: "count" }, String(n));
        const grid = h("div", { class: "bank-grid" });
        // Out into the pack, as many as the quantity says, as the pack's
        // limits and slots allow
        const withdraw = (id: number) => {
            if (id === COINS) {
                const n = Math.min(save.coins, this.quantity(save.coins));
                if (n > 0 && addItem(save.backpack, COINS, n, packSize(save))) {
                    save.coins -= n;
                    this.persist();
                    render();
                }
                return;
            }
            const item = getItem(id);
            const have = countOfKind(id);
            const wanted = Math.min(have, this.quantity(have));
            const allowed = roomFor(save.backpack, id, wanted);
            const free = packSize(save) - save.backpack.length;
            const n = item.stackable ? (save.backpack.some((s) => s.id === id) || free > 0 ? allowed : 0) : Math.max(0, Math.min(allowed, free));
            this.bankSelected = id;
            if (n <= 0) {
                this.itemNote = canCarry(save.backpack, id, 1) ? "The pack is full." : carryLimitText(id);
            } else {
                addItem(save.backpack, id, n, packSize(save));
                removeItem(save.stash, id, n);
                this.itemNote = n < wanted ? `${formatCoins(n)} packed: no room for more.` : `${formatCoins(n)} packed.`;
                this.persist();
            }
            render();
        };
        // The hover card, under the cell (a computer's: a phone has no hover)
        const tip = h("div", { class: "bank-tip" });
        const gridWrap = h("div", { class: "bank-grid-wrap" }, grid, tip);
        const showTip = (cell: HTMLElement, id: number, n: number) => {
            if (isTouch) {
                return;
            }
            const item = getItem(id);
            const kind = item.slot
                ? `Tier ${item.tier} ${item.slot === "weapon" ? weaponStyle(item) : (item.style ? `${item.style} ` : "") + item.slot}`
                : item.heal
                  ? `Food · heals ${item.heal}`
                  : item.potion
                    ? POTION_EFFECT[item.potion]
                    : item.ammo
                      ? `${capitalize(item.ammo)} for ${"★".repeat(item.tier)}`
                      : "";
            tip.replaceChildren(
                h("div", { class: "tip-head" }, h("span", { class: "orange bold" }, item.name), n > 1 ? h("span", { class: "muted" }, `x${formatCoins(n)}`) : null),
                id === COINS
                    ? h("div", { class: "muted" }, `${n.toLocaleString()} coins`)
                    : h("div", { class: "muted" }, [kind, `${formatCoins(price(item))} each`].filter(Boolean).join(" · ")),
                ...(id === COINS ? [] : this.compareLine(item)),
            );
            const r = cell.getBoundingClientRect();
            const g = gridWrap.getBoundingClientRect();
            tip.style.left = `${Math.max(0, Math.min(r.left - g.left, g.width - 320))}px`;
            tip.style.top = `${r.bottom - g.top + 6}px`;
            tip.classList.add("shown");
        };
        const fillGrid = () => {
            const ids = shown();
            grid.replaceChildren(
                ...ids.map((id) => {
                    const item = getItem(id);
                    const n = countOfKind(id);
                    const cell = h(
                        "button",
                        {
                            class: "bank-slot" + (this.bankSelected === id ? " selected" : "") + (item.exclusive ? " exclusive" : ""),
                            onclick: () => {
                                this.bankSelected = this.bankSelected === id ? undefined : id;
                                this.itemAmount = "";
                                this.itemNote = "";
                                render();
                            },
                        },
                        iconElement(id, item.name),
                        n > 1 || item.stackable ? stackLabel(n) : null,
                    );
                    // A double click takes the quantity out into the pack
                    cell.addEventListener("dblclick", () => withdraw(id));
                    // The hover card: what it is, what it's worth, and how it
                    // stands against what's worn (version 115)
                    cell.addEventListener("mouseenter", () => showTip(cell, id, n));
                    cell.addEventListener("mouseleave", () => tip.classList.remove("shown"));
                    // Dragged onto another cell to rearrange, or onto a tab of
                    // the player's own to add it there
                    if (id !== COINS && !isTouch) {
                        cell.draggable = true;
                        cell.addEventListener("dragstart", (e) => {
                            tip.classList.remove("shown");
                            e.dataTransfer?.setData("text/plain", String(id));
                        });
                        cell.addEventListener("dragover", (e) => e.preventDefault());
                        cell.addEventListener("drop", (e) => {
                            e.preventDefault();
                            const from = Number(e.dataTransfer?.getData("text/plain"));
                            if (from && from !== id) {
                                rearrange(from, id);
                            }
                        });
                    }
                    return cell;
                }),
            );
            if (ids.length === 0) {
                grid.append(h("div", { class: "subtitle" }, this.bankSearch ? "Nothing here by that name." : "Nothing in this tab."));
            }
        };
        fillGrid();
        const search = h("input", { type: "search", placeholder: "Search the bank", value: this.bankSearch, className: "bank-search" });
        search.addEventListener("input", () => {
            this.bankSearch = search.value;
            fillGrid();
        });
        const tabBar = h(
            "div",
            { class: "bank-tabs" },
            ...tabs.map((t) => {
                const button = h(
                    "button",
                    {
                        class: "bank-tab" + (t.key === this.bankTab ? " active" : "") + (t.own !== undefined ? " own" : ""),
                        title: t.name,
                        onclick: () => {
                            this.bankTab = t.key;
                            render();
                        },
                    },
                    t.icon !== undefined ? iconElement(t.icon, t.name) : h("span", { class: "bank-tab-text" }, t.key === "all" ? "∞" : t.name),
                );
                if (t.own !== undefined) {
                    const index = t.own;
                    button.addEventListener("dragover", (e) => e.preventDefault());
                    button.addEventListener("drop", (e) => {
                        e.preventDefault();
                        const id = Number(e.dataTransfer?.getData("text/plain"));
                        if (id) {
                            addToTab(index, id);
                        }
                    });
                }
                return button;
            }),
            // A tab of the player's own: made from what's picked (or dropped
            // on it), and more added by dropping things on its tab
            (save.bankTabs ?? []).length < MAX_BANK_TABS
                ? (() => {
                      const make = (id: number | undefined) => {
                          if (id === undefined || id === COINS || !held.has(id)) {
                              this.itemNote = "Pick something in the vault first (or drag it onto +), and + makes a tab of it.";
                              render();
                              return;
                          }
                          const tabsNow = (save.bankTabs ??= []);
                          tabsNow.push({ name: getItem(id).name.split(" ")[0], ids: [id] });
                          this.bankTab = `own:${tabsNow.length - 1}`;
                          this.persist();
                          render();
                      };
                      const plus = h("button", { class: "bank-tab add", title: "A tab of your own, from what's picked; drag things onto it to add them", onclick: () => make(this.bankSelected) }, "+");
                      plus.addEventListener("dragover", (e) => e.preventDefault());
                      plus.addEventListener("drop", (e) => {
                          e.preventDefault();
                          make(Number(e.dataTransfer?.getData("text/plain")) || undefined);
                      });
                      return plus;
                  })()
                : null,
        );

        // What's picked, to wear or pack: the coins' amounts, or a thing's
        // stats and buttons
        // Still picked while some is in the bank or the pack
        if (this.bankSelected !== undefined && countOfKind(this.bankSelected) <= 0 && countOf(save.backpack, this.bankSelected) <= 0) {
            this.bankSelected = undefined;
        }
        const picked = this.bankSelected;
        let detail: HTMLElement;
        if (picked === COINS) {
            detail = h("div", { class: "bank-detail" }, h("div", { class: "bank-detail-head" }, iconElement(COINS, "Coins"), h("span", { class: "name" }, `Coins x${formatCoins(save.coins)}`)), ...coinsPanel);
        } else if (picked !== undefined) {
            const item = getItem(picked);
            const have = countOfKind(picked);
            const buttons: HTMLElement[] = [];
            if (item.slot && have > 0) {
                buttons.push(
                    h(
                        "button",
                        {
                            onclick: () => {
                                equip(save.equipment, save.stash, item.id);
                                this.persist();
                                render();
                            },
                        },
                        "Wear",
                    ),
                );
            }
            // Any amount either way, as coins are (version 102: a stack went
            // all at once, a piece of gear one at a time): the amount typed or
            // picked, or all of it when none is, up to the pack's limit for
            // food and ammunition and its free slots
            const packed = countOf(save.backpack, item.id);
            // The vault's quantity (version 115; it was typed here): none
            // for all of it
            const typed = (): number => (this.bankQty === "all" ? 0 : this.quantity(0));
            const roomForIt = (wanted: number): number => {
                const allowed = roomFor(save.backpack, item.id, wanted);
                const free = packSize(save) - save.backpack.length;
                if (item.stackable) {
                    return save.backpack.some((s) => s.id === item.id) || free > 0 ? allowed : 0;
                }
                return Math.max(0, Math.min(allowed, free));
            };
            const askedToPack = () => Math.min(typed() || have, have);
            const toPack = () => roomForIt(askedToPack());
            const toBank = () => Math.min(typed() || packed, packed);
            // Why fewer go in than asked
            const short = () => (canCarry(save.backpack, item.id, Math.min(askedToPack(), toPack() + 1)) ? "the pack is full" : `the pack's limit for it`);
            const packButton = h("button", {
                onclick: () => {
                    const asked = askedToPack();
                    const n = toPack();
                    if (n <= 0 || !addItem(save.backpack, item.id, n, packSize(save))) {
                        return;
                    }
                    const why = n < asked ? short() : "";
                    removeItem(save.stash, item.id, n);
                    this.itemNote = why ? `${formatCoins(n)} packed: ${why}.` : `${formatCoins(n)} packed.`;
                    this.persist();
                    render();
                },
            });
            const bankButton = h("button", {
                onclick: () => {
                    const n = toBank();
                    if (n <= 0) {
                        return;
                    }
                    removeItem(save.backpack, item.id, n);
                    addItem(save.stash, item.id, n);
                    this.itemNote = `${formatCoins(n)} banked.`;
                    this.persist();
                    render();
                },
            });
            // The buttons say what they'd move, as the amount changes
            const label = () => {
                const n = toPack();
                packButton.disabled = n <= 0;
                packButton.textContent = have > 1 || n > 1 ? `Pack ${formatCoins(n)}` : "Pack";
                packButton.title =
                    have <= 0
                        ? "None in the bank"
                        : n <= 0
                          ? canCarry(save.backpack, item.id, 1)
                              ? "The pack is full."
                              : carryLimitText(item.id)
                          : n < askedToPack()
                            ? `Packs ${formatCoins(n)}: ${short()}`
                            : "From the bank into the pack for the next run";
                const b = toBank();
                bankButton.disabled = b <= 0;
                bankButton.textContent = packed > 1 || b > 1 ? `Bank ${formatCoins(b)}` : "Bank";
                bankButton.title = "From the pack back into the bank";
            };
            if (have > 0) {
                buttons.push(packButton);
            }
            if (packed > 0) {
                buttons.push(bankButton);
            }
            // The player's own tabs it's in, or could be: a click puts it in
            // or takes it out
            const ownTabs = (save.bankTabs ?? []).map((t) =>
                h(
                    "button",
                    {
                        class: "small" + (t.ids.includes(item.id) ? " on" : ""),
                        title: t.ids.includes(item.id) ? `Take it out of the ${t.name} tab` : `Put it in the ${t.name} tab too`,
                        onclick: () => {
                            t.ids = t.ids.includes(item.id) ? t.ids.filter((x) => x !== item.id) : [...t.ids, item.id];
                            this.persist();
                            render();
                        },
                    },
                    t.name,
                ),
            );
            const amountRows: HTMLElement[] = ownTabs.length > 0 ? [h("div", { class: "row" }, ...buttons), h("div", { class: "row own-tabs" }, h("span", { class: "muted" }, "Tabs:"), ...ownTabs)] : [];
            label();
            detail = h(
                "div",
                { class: "bank-detail" },
                h(
                    "div",
                    { class: "bank-detail-head" },
                    iconElement(item.id, item.name),
                    h("span", { class: "name" }, have > 1 ? `${item.name} x${formatCoins(have)}` : item.name),
                    packed > 0 ? h("span", { class: "stats" }, `${formatCoins(packed)} packed`) : null,
                ),
                h("div", { class: "stats" }, `${describe(item)}.${wornNote(item.id)}${isKept(item.id) ? " Kept: it always comes back." : ""}`),
                ...(amountRows.length > 0 ? amountRows : [h("div", { class: "row" }, ...buttons)]),
                this.itemNote ? h("div", { class: "subtitle" }, this.itemNote) : null,
            );
        } else {
            // A word on the last thing done (a loadout put on, say), once
            const note = this.itemNote;
            this.itemNote = "";
            detail = h(
                "div",
                { class: "bank-detail empty" },
                note || "Pick something to see it, wear it or pack it; a double click packs the quantity; drag to rearrange.",
            );
        }

        // OSRS's two quick buttons: everything packed back in, everything
        // worn taken off into the bank
        const depositPack = h(
            "button",
            {
                disabled: save.backpack.length === 0,
                title: "Everything in the backpack back into the bank",
                onclick: () => {
                    for (const stack of save.backpack) {
                        if (stack.id === COINS) {
                            save.coins += stack.count;
                        } else {
                            addItem(save.stash, stack.id, stack.count);
                        }
                    }
                    save.backpack = [];
                    this.persist();
                    render();
                },
            },
            "Whole pack",
        );
        const depositWorn = h(
            "button",
            {
                disabled: Object.keys(save.equipment).length === 0,
                title: "Take off everything worn, into the bank",
                onclick: () => {
                    for (const slot of SLOTS) {
                        unequip(save.equipment, save.stash, slot);
                    }
                    this.persist();
                    render();
                },
            },
            "Worn gear",
        );
        const depositCoins = h(
            "button",
            {
                disabled: packedCoins <= 0,
                title: "The coins packed back into the vault",
                onclick: () => bankCoins(packedCoins),
            },
            "Loose coins",
        );
        const kindsCount = kinds.length + (save.coins > 0 ? 1 : 0);
        const pieces = save.stash.reduce((n, s) => n + s.count, 0);
        const worth = vaultWorth(save.stash, save.coins);
        const shownValue = shown().reduce((n, id) => n + (id === COINS ? save.coins : price(getItem(id)) * countOfKind(id)), 0);

        // The bonuses of what's worn, a row each
        const bonus = (label: string, value: string, n?: number) =>
            h("div", { class: "card-line" }, h("span", { class: "label" }, label), h("span", { class: "value" + (n === undefined ? "" : n > 0 ? " green" : n < 0 ? " red" : "") }, value));
        const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
        const worstWorn = Object.values(save.equipment)
            .filter((id): id is number => id !== undefined)
            .map((id) => ({ id, wear: wearOf(save.wear, id) }))
            .sort((a, b) => b.wear - a.wear)[0];
        const bonuses = h(
            "div",
            { class: "card-lines" },
            bonus("Max hit", `${stats.damage} every ${stats.speed}s`),
            stats.styleBonus !== 0 ? bonus(`${capitalize(weaponStyle(stats.weapon))} armour`, `${signed(Math.round(stats.styleBonus * 100))}%`, stats.styleBonus) : null,
            stats.strength > 0 ? bonus(capitalize(STRENGTH_NAME[weaponStyle(stats.weapon)]), `+${percent(stats.strength)}`, stats.strength) : null,
            stats.perkDamage > 0 ? bonus("Perks' damage", `+${percent(stats.perkDamage)}`, stats.perkDamage) : null,
            bonus("Defence vs melee", signed(stats.defenceVs.melee), stats.defenceVs.melee),
            bonus("Defence vs ranged", signed(stats.defenceVs.ranged), stats.defenceVs.ranged),
            bonus("Defence vs magic", signed(stats.defenceVs.magic), stats.defenceVs.magic),
            bonus("Hitpoints", String(BASE_HP + stats.hp), stats.hp),
            bonus("Prayer", signed(stats.prayer), stats.prayer),
            stats.set ? h("div", { class: "card-note" }, `${BARROWS_SETS[stats.set].name} set: ${SET_EFFECTS[stats.set]}`) : null,
        );

        // Loadouts (version 115): a set of gear and its pack, saved, and put on
        // in one click (what's on now goes back in the vault first)
        const loadouts = save.loadouts ?? [];
        const sameGear = (a: Equipment, b: Equipment) => SLOTS.every((slot) => a[slot] === b[slot]);
        const applyLoadout = (loadout: SaveLoadout) => {
            for (const stack of save.backpack) {
                if (stack.id === COINS) {
                    save.coins += stack.count;
                } else {
                    addItem(save.stash, stack.id, stack.count);
                }
            }
            save.backpack = [];
            for (const slot of SLOTS) {
                unequip(save.equipment, save.stash, slot);
            }
            const missing: string[] = [];
            for (const slot of SLOTS) {
                const id = loadout.equipment[slot];
                if (id === undefined) {
                    continue;
                }
                if (countOf(save.stash, id) > 0) {
                    equip(save.equipment, save.stash, id);
                } else {
                    missing.push(getItem(id).name);
                }
            }
            for (const stack of loadout.backpack) {
                if (stack.id === COINS) {
                    const n = Math.min(stack.count, save.coins);
                    if (n > 0 && addItem(save.backpack, COINS, n, packSize(save))) {
                        save.coins -= n;
                    }
                    continue;
                }
                const have = countOf(save.stash, stack.id);
                const allowed = roomFor(save.backpack, stack.id, Math.min(have, stack.count));
                const free = packSize(save) - save.backpack.length;
                const n = getItem(stack.id).stackable ? (free > 0 || save.backpack.some((s) => s.id === stack.id) ? allowed : 0) : Math.min(allowed, free);
                if (n > 0) {
                    addItem(save.backpack, stack.id, n, packSize(save));
                    removeItem(save.stash, stack.id, n);
                }
                if (n < stack.count) {
                    missing.push(`${getItem(stack.id).name}${n > 0 ? ` (${n} of ${stack.count})` : ""}`);
                }
            }
            this.itemNote = missing.length
                ? `${loadout.name} on. Not in the vault: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? ` and ${missing.length - 4} more` : ""}.`
                : `${loadout.name} on, its pack packed.`;
            this.persist();
            render();
        };
        const saveLoadout = () => {
            const style = capitalize(weaponStyle(stats.weapon));
            const name = prompt("Name this loadout (what's worn and packed now):", loadouts.some((l) => l.name === style) ? "" : style)?.trim().slice(0, 16);
            if (!name) {
                return;
            }
            const loadout: SaveLoadout = { name, equipment: { ...save.equipment }, backpack: save.backpack.map((s) => ({ ...s })) };
            const at = loadouts.findIndex((l) => l.name === name);
            if (at >= 0) {
                loadouts[at] = loadout;
            } else if (loadouts.length < MAX_LOADOUTS) {
                loadouts.push(loadout);
            }
            save.loadouts = loadouts;
            this.itemNote = `${name} saved.`;
            this.persist();
            render();
        };
        const loadoutRow = h(
            "div",
            { class: "loadouts" },
            ...loadouts.map((l) => {
                const b = h(
                    "button",
                    {
                        class: sameGear(l.equipment, save.equipment) ? "on" : "",
                        title: `Wear ${l.name} and pack its pack. Right click (or hold) to forget it.`,
                        onclick: () => applyLoadout(l),
                    },
                    l.name,
                );
                b.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    if (confirm(`Forget the ${l.name} loadout?`)) {
                        save.loadouts = loadouts.filter((x) => x !== l);
                        this.persist();
                        render();
                    }
                });
                return b;
            }),
            loadouts.length < MAX_LOADOUTS ? h("button", { title: "Save what's worn and packed now as a loadout", onclick: saveLoadout }, "+") : null,
        );

        // The pack's word on the run ahead: how long the food and prayer
        // last, and what a death would cost
        const summary = packSummary(save.equipment, save.backpack, save.insured);
        const minutes = foodMinutes(summary, save.stats);
        const prayerSecs = prayerSeconds(save.equipment, summary.prayerPots);
        const packNote = h(
            "div",
            { class: "pack-note" },
            h(
                "div",
                {},
                summary.heal <= 0
                    ? h("span", { class: "red" }, "No food packed")
                    : minutes !== undefined
                      ? h("span", {}, "Food for ", h("span", { class: minutes < 3 ? "red" : "" }, minutesText(minutes)))
                      : `Food heals ${summary.heal} hitpoints`,
            ),
            h("div", {}, `Protection prayer for ${minutesText(prayerSecs / 60)}`),
            h("div", {}, "If you die you lose ", h("span", { class: "red" }, formatCoins(summary.risk))),
        );
        const last = save.recentMaps.map((id) => WORLD_BY_ID.get(id)).find((w) => w && mapUnlocked(save.stats.mapsBeaten, w.id));
        const room = this.session.room;
        const readyGo = h(
            "button",
            {
                class: "go",
                onclick: () => {
                    if (room) {
                        if (!this.session.isHost) {
                            this.session.setReady(true);
                        }
                        this.showCoop();
                    } else if (last) {
                        this.hooks.startRun(last.id);
                    } else {
                        this.showMaps();
                    }
                },
            },
            room ? (this.session.isHost ? "Back to the party" : "Ready · back to the party") : last ? `Ready · Descend into ${last.name}` : "Ready · Choose a map",
        );
        const segOf = <T extends string | number>(options: [T, string][], current: T, pick: (value: T) => void) =>
            h("div", { class: "seg" }, ...options.map(([value, label]) => h("button", { class: value === current ? "on" : "", onclick: () => pick(value) }, label)));
        const quantityBar = segOf<1 | 5 | 10 | "x" | "all">(
            [
                [1, "1"],
                [5, "5"],
                [10, "10"],
                ["x", this.bankQty === "x" ? String(this.bankX) : "X"],
                ["all", "All"],
            ],
            this.bankQty,
            (value) => {
                if (value === "x") {
                    const n = Math.floor(Number(prompt("How many at a time?", String(this.bankX))?.replace(/[^0-9]/g, "")));
                    if (!Number.isFinite(n) || n <= 0) {
                        return;
                    }
                    this.bankX = n;
                }
                this.bankQty = value;
                render();
            },
        );
        const rearrangeBar = segOf<"swap" | "insert">(
            [
                ["swap", "Swap"],
                ["insert", "Insert"],
            ],
            this.bankRearrange,
            (value) => {
                this.bankRearrange = value;
                render();
            },
        );
        const crown = crownVerified(crownKey());
        const usedSlots = save.backpack.length;

        // The vault (version 115, the mockup's): what's worn with its
        // bonuses and the loadouts on the left, the bank in the middle with
        // its quantity, rearranging and deposits along the foot, the pack
        // on the right with its word on the run ahead and the way in
        this.showKeyed(
            "stash",
            h(
                "div",
                { class: "screen vault" },
                h(
                    "div",
                    { class: "vault-head" },
                    h("h1", {}, "The Vault"),
                    h(
                        "span",
                        { class: "vault-of" },
                        "of ",
                        h("span", { class: "vault-name" }, crown ? crownIcon(crown) : null, save.character.name),
                        ` · ${kindsCount} kinds · ${pieces.toLocaleString()} pieces · ${formatCoins(worth)}`,
                    ),
                    h("button", { class: "vault-close", title: "Back", onclick: () => this.back() }, "✕"),
                ),
                h(
                    "div",
                    { class: "vault-columns" },
                    h(
                        "div",
                        { class: "panel vault-worn" },
                        h("h2", {}, "Worn equipment"),
                        equipment,
                        worstWorn && worstWorn.wear > 0 ? h("div", { class: "orange center" }, `${getItem(worstWorn.id).name} is ${Math.round(worstWorn.wear * 100)}% worn`) : null,
                        h("h2", {}, "Bonuses"),
                        bonuses,
                        h("h2", {}, "Loadouts"),
                        loadoutRow,
                        h("div", { class: "muted center small-text" }, loadouts.length > 0 ? "One click wears the set and packs its food." : "Wear and pack a set, then + saves it to put on in one click."),
                        h(
                            "details",
                            { class: "vault-more" },
                            h("summary", {}, save.insured !== undefined ? `Insurance: ${getItem(save.insured).name}` : "Insurance"),
                            h(
                                "div",
                                { class: "subtitle" },
                                save.insured !== undefined
                                    ? `Your ${getItem(save.insured).name.toLowerCase()} is insured for the next run: it comes home even if you don't. The fee is spent either way.`
                                    : "Pay the guild a fifth of a piece's price to bring it home if you don't make it. One piece, worn or packed, for one run; the fee is spent either way.",
                            ),
                            h("div", { class: "item-list" }, ...insuranceRows),
                            insuranceRows.length === 0 ? h("div", { class: "subtitle" }, "Wear or pack some gear first.") : null,
                        ),
                        h(
                            "details",
                            { class: "vault-more" },
                            h("summary", {}, repairable.length > 0 ? `Repairs (${repairable.length})` : "Repairs"),
                            h(
                                "div",
                                { class: "subtitle" },
                                "Every hit you take wears the armour you're wearing; worn through, a piece has lost half its defence. The guild repairs a piece for a tenth of its price.",
                            ),
                            repairRows.length > 0 ? h("div", { class: "item-list" }, ...repairRows) : h("div", { class: "subtitle" }, "Nothing needs repair."),
                            repairable.length > 1
                                ? h(
                                      "button",
                                      {
                                          disabled: save.coins < repairAll,
                                          onclick: () => {
                                              save.coins -= repairAll;
                                              for (const id of repairable) {
                                                  delete save.wear[id];
                                              }
                                              this.persist();
                                              render();
                                          },
                                      },
                                      `Repair everything ${formatCoins(repairAll)}`,
                                  )
                                : null,
                        ),
                    ),
                    h(
                        "div",
                        { class: "panel vault-bank" },
                        h("div", { class: "bank-top" }, tabBar, search),
                        gridWrap,
                        detail,
                        kindsCount === 0 ? h("div", { class: "subtitle" }, "Empty. Gear is found in the dungeon's chests.") : null,
                        h(
                            "div",
                            { class: "bank-foot" },
                            h("div", { class: "bank-control" }, h("span", { class: "muted" }, "Quantity"), quantityBar),
                            isTouch ? null : h("div", { class: "bank-control" }, h("span", { class: "muted" }, "Rearrange"), rearrangeBar),
                        ),
                        h(
                            "div",
                            { class: "bank-foot" },
                            h("div", { class: "bank-control" }, h("span", { class: "muted" }, "Deposit"), depositPack, depositWorn, depositCoins),
                            h("span", { class: "muted bank-value" }, "Value shown ", h("span", { class: "plain" }, shownValue.toLocaleString())),
                        ),
                    ),
                    h(
                        "div",
                        { class: "panel vault-pack" },
                        h("h2", {}, "Pack ", h("span", { class: "plain" }, `${usedSlots} / ${packSize(save)}`)),
                        backpack,
                        h(
                            "div",
                            { class: "muted small-text" },
                            `Food ${FOOD_LIMIT} pieces at most, arrows ${AMMO_LIMITS.arrows} of every kind together and ${AMMO_LIMITS.runes} of each kind of rune. A click puts ${this.quantityWord() === "all" ? "a stack" : this.quantityWord()} back in the vault.`,
                        ),
                        packNote,
                        h("button", { class: "wide", disabled: save.backpack.length === 0, onclick: () => depositPack.click() }, "Empty pack into vault"),
                        readyGo,
                    ),
                ),
            ),
        );
    }

    // -----------------------------------------------------------------------
    // Shop

    showShop(): void {
        const save = this.save;
        const render = () => this.showShop();
        // Gear costs a quarter more for each map tier you've escaped from
        // above the piece's own tier: cheap for a beginner, and a veteran
        // goes and finds it instead
        const escapedTier = WORLDS.filter((w) => save.stats.mapsEscaped.includes(w.id)).reduce((n, w) => Math.max(n, w.tier), 0);
        const shelfPrice = (item: ItemDef) => Math.round(price(item) * (1 + 0.25 * Math.max(0, escapedTier - item.tier)));
        const buy = (id: number, count: number, fromShelf: boolean) => {
            const item = getItem(id);
            const cost = (fromShelf ? shelfPrice(item) : price(item)) * count;
            if (save.coins < cost) {
                return;
            }
            save.coins -= cost;
            addItem(save.stash, id, count);
            if (fromShelf) {
                save.shop.splice(save.shop.indexOf(id), 1);
            }
            this.persist();
            render();
        };
        const food = [...SHOP_FOOD, ...SHOP_POTIONS].map((id) => {
            const item = getItem(id);
            const cost = price(item);
            return itemRow(
                item,
                1,
                h("button", { disabled: save.coins < cost, onclick: () => buy(id, 1, false) }, `Buy ${formatCoins(cost)}`),
                h("button", { disabled: save.coins < cost * 5, onclick: () => buy(id, 5, false) }, "x5"),
            );
        });
        // Arrows and runes by the bundle, each kind once a map of its tier
        // is open
        const ammoTier = tierUnlocked(save.stats.mapsBeaten);
        const ammo = SHOP_AMMO.filter((id) => getItem(id).tier <= ammoTier).map((id) => {
            const item = getItem(id);
            const cost = price(item);
            // Elemental runes by the hundred (spells take several a cast)
            const [small, big] = ELEMENTAL_RUNES.includes(id) ? [100, 500] : [25, 100];
            return itemRow(
                item,
                1,
                h("button", { disabled: save.coins < cost * small, onclick: () => buy(id, small, false) }, `Buy ${small} for ${formatCoins(cost * small)}`),
                h("button", { disabled: save.coins < cost * big, onclick: () => buy(id, big, false) }, `x${big}`),
            );
        });
        const gear = save.shop.map((id) => {
            const item = getItem(id);
            const cost = shelfPrice(item);
            return itemRow(
                item,
                1,
                h("span", { class: "stats" }, tierName(item.tier) + (cost > price(item) ? ", marked up for you" : "")),
                h("button", { disabled: save.coins < cost, onclick: () => buy(id, 1, true) }, `Buy ${formatCoins(cost)}`),
            );
        });
        // The guild's own upgrades, a level at a time
        const upgrades = (Object.keys(UPGRADES) as (keyof Upgrades)[]).map((key) => {
            const def = UPGRADES[key];
            const level = save.upgrades[key];
            const cost = def.costs[level];
            return h(
                "div",
                { class: "item-row" },
                h("span", { class: "name" }, `${def.name} ${level > 0 ? `(${level}/${def.costs.length})` : ""}`),
                h("span", { class: "stats" }, def.effect),
                cost === undefined
                    ? h("span", { class: "stats" }, "done")
                    : h(
                          "button",
                          {
                              disabled: save.coins < cost,
                              onclick: () => {
                                  save.coins -= cost;
                                  save.upgrades[key]++;
                                  this.persist();
                                  render();
                              },
                          },
                          `Buy ${formatCoins(cost)}`,
                      ),
            );
        });
        const selling = save.stash
            .slice()
            .sort((a, b) => price(getItem(b.id)) - price(getItem(a.id)))
            .map((stack) => {
                const item = getItem(stack.id);
                const price = sellPrice(item);
                // The owner's kept kit (kit.ts) isn't for selling
                if (isKept(item.id)) {
                    return itemRow(item, stack.count, h("span", { class: "stats" }, "Kept: always comes back"));
                }
                const sell = (count: number) => {
                    if (removeItem(save.stash, item.id, count)) {
                        save.coins += price * count;
                        this.persist();
                        render();
                    }
                };
                const buttons = [h("button", { onclick: () => sell(1) }, `Sell ${formatCoins(price)}`)];
                if (stack.count > 1) {
                    buttons.push(h("button", { onclick: () => sell(stack.count) }, "All"));
                }
                return itemRow(item, stack.count, ...buttons);
            });
        this.showKeyed(
            "shop",
            h(
                "div",
                { class: "screen" },
                h("h2", {}, "The Guild Shop"),
                h("div", { class: "subtitle" }, h("span", { class: "coins" }, `${formatCoins(save.coins)} coins`)),
                h(
                    "div",
                    { class: "columns" },
                    h(
                        "div",
                        { class: "panel" },
                        h("h2", {}, "Gear on the shelves"),
                        h("div", { class: "item-list" }, ...gear),
                        gear.length === 0 ? h("div", { class: "subtitle" }, "Sold out.") : null,
                        h(
                            "div",
                            { class: "subtitle" },
                            `New stock after every run, up to tier ${Math.max(1, save.stats.deepest)}: better comes in as you reach harder maps, and a tier's prizes are never sold, only found.` +
                                (escapedTier > 1
                                    ? ` Gear below tier ${escapedTier} costs a quarter more per tier below the hardest map you've escaped from.`
                                    : ""),
                        ),
                        h("h2", {}, "Food, potions and ammunition"),
                        h("div", { class: "item-list" }, ...food, ...ammo),
                    ),
                    h(
                        "div",
                        { class: "panel" },
                        h("h2", {}, "Sell from your stash"),
                        h("div", { class: "item-list" }, ...selling),
                        selling.length === 0 ? h("div", { class: "subtitle" }, "Nothing to sell.") : null,
                        h("h2", {}, "The guild"),
                        h("div", { class: "subtitle" }, "Coins into the guild itself, for every run after."),
                        h("div", { class: "item-list" }, ...upgrades),
                    ),
                ),
                h("button", { onclick: () => this.back() }, "Back"),
            ),
        );
    }

    // -----------------------------------------------------------------------
    // Character

    // The character stands in the world on the left, in what's worn, facing
    // a camera that holds still, with the choices down the right. Dragging
    // on the world, or the turn buttons, turns them round.
    showCharacter(): void {
        const c = this.save.character;
        const name = h("input", { type: "text", value: c.name, maxLength: 16 });
        // With an account (version 116) the name is the account's, nobody
        // else's, so it isn't changed here (a test character's still is)
        const accountName = loadedSlot() === 0 ? this.account?.name : undefined;
        if (accountName) {
            name.value = accountName;
            name.readOnly = true;
            name.title = "Your account's name: nobody else can have it";
        }
        const size = h("input", { type: "range", min: "85", max: "120", value: String(Math.round(c.size * 100)) });
        const parts = h("div", { class: "item-list" }, h("div", { class: "loading" }, "Loading looks..."));
        const colors = h("div", { class: "item-list" });
        size.oninput = () => {
            c.size = Number(size.value) / 100;
            this.menu.applyLook(c);
        };
        const changed = () => this.menu.setLook(c, this.save.equipment);
        const turn = (by: number) => {
            this.menu.spin += by;
        };
        // A crowned browser picks the name's colour (crown.ts); the name box
        // shows it
        name.style.color = nameColorOf(c, crownKey()) ?? "";
        let nameColors: HTMLElement | null = null;
        if (crownVerified(crownKey(), () => this.showCharacter())) {
            const swatches = NAME_COLORS.map(({ name: label, color }) => {
                const chosen = (c.nameColor ?? DEFAULT_NAME_COLOR) === color;
                return h("button", {
                    class: "swatch" + (chosen ? " selected" : ""),
                    title: label,
                    style: `background:${color}`,
                    onclick: () => {
                        c.nameColor = color === DEFAULT_NAME_COLOR ? undefined : color;
                        name.style.color = color === DEFAULT_NAME_COLOR ? "" : color;
                        for (const s of swatches) {
                            s.classList.remove("selected");
                        }
                        swatches[NAME_COLORS.findIndex((n) => n.color === color)].classList.add("selected");
                    },
                } as never);
            });
            nameColors = h("div", { class: "field" }, h("label", {}, "Name colour"), h("div", { class: "swatches" }, ...swatches));
        }

        const screen = h(
            "div",
            { class: "screen side" },
            h(
                "div",
                { class: "panel" },
                h("h2", {}, "Character"),
                h("div", { class: "subtitle" }, "Shown in what you're wearing from the stash. Drag on the world to turn them round."),
                h("div", { class: "field" }, h("label", {}, "Name"), name),
                nameColors,
                h(
                    "div",
                    { class: "field" },
                    h("label", {}, "Turn"),
                    h("button", { title: "Turn the character to the left", onclick: () => turn(-Math.PI / 6) }, "<"),
                    h("button", { title: "Turn the character to the right", onclick: () => turn(Math.PI / 6) }, ">"),
                ),
                h("h2", {}, "Body"),
                parts,
                h("h2", {}, "Colours"),
                colors,
                h("div", { class: "field" }, h("label", {}, "Height"), size),
                h(
                    "button",
                    {
                        class: "primary",
                        onclick: () => {
                            c.name = accountName ?? (name.value.trim() || "Adventurer");
                            this.persist();
                            this.back();
                        },
                    },
                    "Save",
                ),
            ),
        );
        // Dragging anywhere but the panel turns the character, the side under
        // the pointer following it
        let dragFrom: number | undefined;
        screen.onpointerdown = (e) => {
            if (e.target !== screen) {
                return;
            }
            dragFrom = e.clientX;
            screen.setPointerCapture(e.pointerId);
            screen.classList.add("dragging");
        };
        screen.onpointermove = (e) => {
            if (dragFrom !== undefined) {
                turn((e.clientX - dragFrom) * 0.012);
                dragFrom = e.clientX;
            }
        };
        screen.onpointerup = screen.onpointercancel = () => {
            dragFrom = undefined;
            screen.classList.remove("dragging");
        };

        this.show(screen);
        // The panel is down the right, and the character left of it; on a
        // phone held upright it's a sheet across the bottom instead, and the
        // character stands in the top half
        const sheet = isTouch && window.matchMedia("(orientation: portrait)").matches;
        this.menu.focus = sheet ? 0 : 0.22;
        this.menu.raise = sheet ? 0.32 : 0.1;
        this.menu.hold = true;

        void (async () => {
            const kits = await loadKits();
            const tables = await loadColorTables();
            // The screen may have gone meanwhile
            if (!parts.isConnected) {
                return;
            }
            parts.replaceChildren(
                ...BODY_PART_NAMES.map((label, part) => {
                    const options = kits.filter((k) => k.bodyPart === part && k.selectable).map((k) => k.id);
                    if (!options.includes(c.kits[part])) {
                        options.unshift(c.kits[part]);
                    }
                    const count = h("span", { class: "stats" });
                    const show = () => {
                        count.textContent = `${options.indexOf(c.kits[part]) + 1} / ${options.length}`;
                    };
                    const turn = (by: number) => {
                        const i = (options.indexOf(c.kits[part]) + by + options.length) % options.length;
                        c.kits[part] = options[i];
                        show();
                        changed();
                    };
                    show();
                    return h(
                        "div",
                        { class: "item-row" },
                        h("span", { class: "name" }, label),
                        h("button", { onclick: () => turn(-1) }, "<"),
                        count,
                        h("button", { onclick: () => turn(1) }, ">"),
                    );
                }),
            );
            colors.replaceChildren(
                ...COLOR_GROUP_NAMES.map((label, group) => {
                    const swatches = (tables.tables[group] ?? []).map((color, choice) => {
                        return h("button", {
                            class: "swatch" + (c.colors[group] === choice ? " selected" : ""),
                            title: `${label} ${choice + 1}`,
                            style: `background:${color.swatch}`,
                            onclick: () => {
                                c.colors[group] = choice;
                                for (const s of swatches) {
                                    s.classList.remove("selected");
                                }
                                swatches[choice].classList.add("selected");
                                changed();
                            },
                        } as never);
                    });
                    return h(
                        "div",
                        { class: "item-row" },
                        h("span", { class: "name" }, label),
                        h("div", { class: "swatches" }, ...swatches),
                    );
                }),
            );
        })();
    }

    // -----------------------------------------------------------------------
    // The HUD during a run

    showHud(run: Run): void {
        const hp = h("div", { class: "fill" });
        const hpLabel = h("div", { class: "label" });
        const spec = h("div", { class: "fill" });
        const specLabel = h("div", { class: "label" });
        const prayer = h("div", { class: "fill" });
        const prayerLabel = h("div", { class: "label" });
        const bossFill = h("div", { class: "fill" });
        const bossLabel = h("div", { class: "label" });
        const boss = h("div", { class: "boss-bar", hidden: true }, h("div", { class: "bar" }, bossFill, bossLabel));
        const coins = h("div", { class: "label" });
        const clock = h("div", { class: "clock" });
        const prompt = h("div", { class: "prompt", hidden: true });
        const inventory = h("div", { class: "inventory client-panel", hidden: true });
        inventory.id = "client-tab-panel";
        inventory.setAttribute("role", "tabpanel");
        const tabs = h("div", { class: "pack-tabs client-tabs" });
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", "Game panels");
        const minimap = document.createElement("canvas");
        minimap.className = "minimap";
        minimap.width = MINIMAP_SIZE;
        minimap.height = MINIMAP_SIZE;
        minimap.title =
            "You are the white dot. Yellow is an enemy, red the boss, orange a chest, gold the golden one, light blue the vault, green a way out, lilac your gravestone, blue the trader. Click (or M) for the full map.";
        // The full map: the minimap, or M, opens it over the run
        const fullMap = new FullMap(run, () => {
            if (this.hud?.pause.hidden) {
                run.setPaused(false);
            }
        });
        minimap.addEventListener("click", () => this.openFullMap());
        const hotbar = h("div", { class: "hotbar" });
        const pause = h("div", { class: "pause", hidden: true });
        const party = h("div", { class: "party", hidden: !run.coop });
        const hotSlots: HotSlot[] = HOT_KEYS.map(([key, kind, title]) => {
            const img = iconElement(0);
            setIcon(img, undefined);
            const count = h("div", { class: "count" });
            const timer = h("div", { class: "timer" });
            const slot = h(
                "div",
                {
                    class: `hotslot empty ${kind}`,
                    title,
                    onclick: () => (kind === "food" ? run.eatHotkey() : run.drinkKind(kind)),
                },
                h("div", { class: "key" }, key),
                img,
                count,
                timer,
            );
            hotbar.append(slot);
            return { kind, slot, img, count, timer };
        });
        // On a touch screen, the stick's zone goes in first so everything
        // after it takes its own taps
        const touch = isTouch ? touchControls(run, { togglePack: () => this.toggleInventory(), pause: () => this.togglePause(), openMap: () => this.openFullMap() }) : undefined;
        const orb = (kind: string, fill: HTMLElement, label: HTMLElement, symbol: Node, title: string, click: () => void) => h(
            "button", { class: `client-orb ${kind}`, title, onclick: click },
            fill, label, h("span", { class: "client-orb-icon" }, symbol),
        );
        const location = h("div", { class: "client-world-label" }, run.world.name);
        const minimapFrame = h("div", { class: "client-minimap-frame" },
            minimap,
            h("button", { class: "client-compass", title: "Open the world map (M)", onclick: () => this.openFullMap() }, interfaceIcon("compass")),
            h("div", { class: "client-meters" },
                orb("hitpoints", hp, hpLabel, interfaceIcon("heart"), "Hitpoints: click to eat food (F)", () => run.eatHotkey()),
                orb("prayer", prayer, prayerLabel, interfaceIcon("prayer-orb"), "Open protection prayers", () => this.toggleInventory("prayer")),
                orb("pack", h("div", { class: "fill" }), coins, interfaceIcon("coins"), "Coins and inventory", () => this.toggleInventory("pack")),
                orb("special", spec, specLabel, interfaceIcon("special"), "Use your weapon's special attack (Q)", () => run.useSpecial()),
            ),
            h("div", { class: "client-map-caption" }, location, clock),
        );
        const cameraValue = h("output", {}, `${Math.round(settings.zoom * 100)}%`);
        const cameraZoom = h("input", { type: "range", min: String(ZOOM_MIN), max: String(ZOOM_MAX), step: "0.05", value: String(settings.zoom) });
        cameraZoom.setAttribute("aria-label", "Camera distance");
        const zoomTo = (value: number) => {
            settings.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
            run.setZoom(settings.zoom);
            saveSettings();
            cameraZoom.value = String(settings.zoom);
            cameraValue.textContent = `${Math.round(settings.zoom * 100)}%`;
        };
        cameraZoom.addEventListener("input", () => zoomTo(Number(cameraZoom.value)));
        const cameraPanel = h("div", { class: "client-camera-panel", hidden: true },
            h("h3", {}, "Camera"),
            h("div", { class: "client-camera-label" }, "Distance", cameraValue), cameraZoom,
            h("div", { class: "client-camera-buttons" },
                h("button", { title: "Zoom in", onclick: () => zoomTo(settings.zoom - .1) }, "−"),
                h("button", { onclick: () => { run.resetCamera(); zoomTo(1); } }, "Reset"),
                h("button", { title: "Zoom out", onclick: () => zoomTo(settings.zoom + .1) }, "+"),
            ),
            h("div", { class: "hint" }, "Middle-drag to orbit · wheel to zoom"),
        );
        const cameraButton = h("button", { class: "client-camera", title: "Camera controls", onclick: () => {
            cameraPanel.hidden = !cameraPanel.hidden;
            cameraZoom.value = String(settings.zoom);
            cameraValue.textContent = `${Math.round(settings.zoom * 100)}%`;
            cameraButton.setAttribute("aria-expanded", String(!cameraPanel.hidden));
        } }, "Camera");
        cameraButton.setAttribute("aria-expanded", "false");
        const hudRoot = h(
                "div",
                { class: "hud classic-client reference-client" },
                touch?.zone,
                minimapFrame,
                cameraButton,
                cameraPanel,
                tabs,
                inventory,
                party,
                boss,
                prompt,
                hotbar,
                touch?.corner,
                touch?.cluster,
                fullMap.root,
                pause,
            );
        this.showOverRun(hudRoot);
        this.hud = {
            root: hudRoot,
            touch,
            hp,
            hpLabel,
            spec,
            specLabel,
            prayer,
            prayerLabel,
            boss,
            bossFill,
            bossLabel,
            coins,
            clock,
            prompt,
            inventory,
            inventoryOpen: false,
            inventoryView: "pack",
            tabs,
            signature: "",
            run,
            hotbar: hotSlots,
            minimap: minimap.getContext("2d")!,
            pause,
            pauseView: "menu",
            party,
            partySignature: "",
            dropMode: false,
            fullMap,
        };
        tabs.append(...Array.from(this.packTabs().childNodes));
        this.updateChat();
        this.updateHud();
    }

    // A hit landed: a phone buzzes for a big one (a seventh of the
    // hitpoints or more), and three times as the hitpoints go low
    hurt(hit: number): void {
        const run = this.hud?.run;
        if (!run || !isTouch || typeof navigator.vibrate !== "function") {
            return;
        }
        const low = run.hp < run.maxHp * HURT_SHARE;
        const wasLow = run.hp + hit < run.maxHp * HURT_SHARE;
        try {
            if (low && !wasLow) {
                navigator.vibrate([40, 50, 40, 50, 40]);
            } else if (hit >= run.maxHp / 7) {
                navigator.vibrate(50);
            }
        } catch {
            // Vibration can be refused; nothing lost
        }
    }

    // The run's own messages go in the chat box (version 105; before, a few
    // lines faded at the bottom left)
    message(text: string): void {
        this.chat.game(text);
    }

    updateHud(): void {
        const hud = this.hud;
        if (!hud) {
            return;
        }
        const run = hud.run;
        hud.hp.style.width = `${(100 * run.hp) / run.maxHp}%`;
        hud.hpLabel.textContent = String(run.hp);
        hud.hp.parentElement!.title = `Hitpoints ${run.hp}/${run.maxHp}: click to eat food (F)`;
        hud.hp.parentElement!.style.setProperty("--orb-fill", `${100 * run.hp / run.maxHp}%`);
        const special = specialOf(run.stats.weapon);
        hud.spec.style.width = `${run.spec}%`;
        hud.specLabel.textContent = String(Math.round(run.spec));
        hud.spec.parentElement!.style.setProperty("--orb-fill", `${run.spec}%`);
        hud.spec.parentElement!.title = special ? `${special.name}: ${Math.round(run.spec)}%` : "Equip a weapon to use a special attack";
        hud.spec.parentElement?.classList.toggle("ready", run.specReady);
        hud.prayer.style.width = `${run.prayer}%`;
        hud.prayerLabel.textContent = String(Math.round(run.prayer));
        hud.prayer.parentElement!.style.setProperty("--orb-fill", `${run.prayer}%`);
        hud.prayer.parentElement!.title = run.protect === "none" ? "No protection prayer active" : `Protect from ${run.protect}`;
        hud.prayer.parentElement?.classList.toggle("on", run.protect !== "none");
        const uses = run.stats.weapon?.uses;
        let ammoText = "";
        if (uses === "runes") {
            // A staff: the spell it casts and how many casts the runes hold
            const { spell } = run.castingSpell();
            const casts = spell ? castsLeft(spell, run.runesGiven(), run.count) : 0;
            ammoText = spell ? ` · ${spell.name}, ${casts === Infinity ? "no runes needed" : `${casts} cast${casts === 1 ? "" : "s"}`}` : " · no spell (B)";
        } else if (uses) {
            const ammo = run.ammo();
            ammoText = ` · ${ammo ? `${ammo.count} ${getItem(ammo.id).name.toLowerCase()}` : `no ${uses}`}`;
        }
        hud.coins.textContent = formatCoins(run.coins);
        hud.coins.parentElement!.title = `${formatCoins(run.coins)} coins · inventory ${run.inventory.length}/${run.slots}${ammoText}. Open inventory.`;
        const left = run.timeLeft;
        hud.clock.textContent = run.closed
            ? "Way out closed"
            : `Way out closes in ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
        hud.clock.classList.toggle("urgent", run.closed || left < 60);
        const location = hud.root.querySelector<HTMLElement>(".client-world-label");
        if (location) location.title = `${run.world.name} · tier ${run.world.tier}${run.night ? " · night" : ""} · ${hud.clock.textContent}`;
        hud.boss.hidden = !run.boss;
        if (run.boss) {
            hud.bossFill.style.width = `${(100 * run.boss.hp) / run.boss.maxHp}%`;
            hud.bossLabel.textContent = `${run.boss.name} ${run.boss.hp} / ${run.boss.maxHp}`;
        }
        hud.prompt.hidden = !run.prompt;
        // The prompts name the key; a touch screen has the big button instead
        hud.prompt.textContent = isTouch ? touchPrompt(run.prompt) : run.prompt;
        hud.touch?.update();
        hud.root.classList.toggle("hurt", run.hp < run.maxHp * HURT_SHARE && !run.dead);
        run.drawMinimap(hud.minimap, MINIMAP_SIZE);
        for (const slot of hud.hotbar) {
            const stack =
                slot.kind === "food" ? run.foodToEat() : run.inventory.find((s) => getItem(s.id).potion === slot.kind);
            const id = stack?.id;
            if (id !== slot.id) {
                slot.id = id;
                setIcon(slot.img, id);
                slot.img.style.visibility = id !== undefined ? "visible" : "hidden";
            }
            slot.count.textContent = stack && stack.count > 1 ? String(stack.count) : "";
            const left = slot.kind === "food" ? 0 : run.boosts[slot.kind];
            slot.timer.textContent = left > 0 ? `${Math.ceil(left)}s` : "";
            slot.slot.classList.toggle("empty", !stack);
            slot.slot.classList.toggle("active", left > 0);
        }
        hud.inventory.hidden = !hud.inventoryOpen;
        hud.inventory.dataset.side = ["combat", "prayer", "tasks", "friends", "account", "music"].includes(hud.inventoryView) ? "left" : "right";
        hud.root.classList.toggle("client-panel-open", hud.inventoryOpen);
        for (const button of hud.tabs.querySelectorAll<HTMLButtonElement>("button[data-view]")) {
            const selected = hud.inventoryOpen && button.dataset.view === hud.inventoryView;
            button.classList.toggle("on", selected);
            button.setAttribute("aria-selected", String(selected));
        }
        if (hud.inventoryOpen) {
            const pageState = hud.inventoryView === "prayer" ? []
                : hud.inventoryView === "loot" ? [run.loot.revision]
                : hud.inventoryView === "friends" ? [run.party(), this.session.view.friends, this.save.friends]
                : [run.inventory, run.equipment, run.autocast, run.spellbook];
            const signature = JSON.stringify([hud.inventoryView, ...pageState]);
            if (signature !== hud.signature) {
                hud.signature = signature;
                const scroll = hud.inventory.scrollTop;
                switch (hud.inventoryView) {
                    case "spells": this.renderSpellbook(run); break;
                    case "equipment": this.renderEquipment(run); break;
                    case "prayer": this.renderPrayer(run); break;
                    case "loot": this.renderLootTracker(run.loot); break;
                    case "combat": this.renderCombat(run); break;
                    case "tasks": this.renderRunTasks(); break;
                    case "friends": this.renderRunFriends(run); break;
                    case "account": this.renderRunAccount(); break;
                    case "music": this.renderRunMusic(); break;
                    default: this.renderInventory(run);
                }
                hud.inventory.prepend(h("button", { class: "client-panel-close", title: "Close panel", ariaLabel: "Close panel", onclick: () => {
                    hud.inventoryOpen = false;
                    this.updateHud();
                } }, "×"));
                hud.inventory.scrollTop = scroll;
            }
            if (hud.inventoryView === "prayer") {
                const points = hud.inventory.querySelector(".client-prayer-points");
                if (points) points.textContent = `Prayer: ${Math.round(run.prayer)} / 100`;
                for (const button of hud.inventory.querySelectorAll<HTMLButtonElement>("button[data-protect]")) {
                    const active = button.dataset.protect === run.protect;
                    button.classList.toggle("on", active);
                    button.setAttribute("aria-pressed", String(active));
                    const status = button.querySelector("small");
                    if (status) status.textContent = active ? "Active" : button.dataset.key ?? "";
                }
            }
            if (hud.inventoryView === "combat") {
                const button = hud.inventory.querySelector<HTMLButtonElement>(".client-special-button");
                if (button) {
                    const label = special ? `${special.name} · ${Math.round(run.spec)}%` : "Equip a weapon for a special attack";
                    if (button.textContent !== label) button.textContent = label;
                    button.disabled = !run.specReady || !special;
                    button.classList.toggle("ready", run.specReady);
                }
                const values = hud.inventory.querySelectorAll(".client-stat-list strong");
                [String(run.stats.damage), `${run.stats.speed}s`, `${run.stats.range} tiles`].forEach((value, index) => {
                    if (values[index] && values[index].textContent !== value) values[index].textContent = value;
                });
            }
        }
        // The party: everyone's health at a glance, this player first
        if (run.coop) {
            const members = run.party();
            const signature = members.map((m) => `${m.name}:${m.hp}/${m.maxHp}:${m.dead}:${m.done}`).join("|");
            if (signature !== hud.partySignature) {
                hud.partySignature = signature;
                hud.party.replaceChildren(
                    ...members.map((m) => {
                        const fill = h("div", { class: "fill" });
                        fill.style.width = `${Math.round((100 * m.hp) / Math.max(1, m.maxHp))}%`;
                        const label = h("span", {}, m.name + (m.me ? " (you)" : "") + (m.done ? (m.dead ? " · dead" : " · out") : m.dead ? " · down" : ""));
                        if (m.color) {
                            label.style.color = m.color;
                        }
                        return h(
                            "div",
                            { class: "mate" + (m.done || m.dead ? " gone" : "") },
                            label,
                            m.done || m.dead ? null : h("div", { class: "bar" }, fill),
                        );
                    }),
                );
            }
        }
    }

    private renderInventory(run: Run): void {
        const hud = this.hud!;
        const slots = h(
            "div",
            { class: "slots" },
            ...Array.from({ length: run.slots }, (_, i) => {
                const stack = run.inventory[i];
                if (!stack) {
                    return h("div", { class: "slot empty" });
                }
                const item = getItem(stack.id);
                const action = hud.dropMode
                    ? "Click to drop it."
                    : item.heal
                      ? "Click to eat, or press F."
                      : item.potion
                        ? "Click to drink, or press 1 to 4."
                        : item.clue
                          ? "Click to read it again from where you stand."
                          : item.slot
                            ? "Click to wear."
                            : "";
                const slot = h(
                    "div",
                    {
                        class: "slot" + (hud.dropMode ? " dropping" : ""),
                        title: `${item.name} (${tierName(item.tier)}): ${describe(item)}. ${action} Right-click for its stats, or to drop it.`,
                        onclick: () => {
                            if (hud.dropMode) {
                                run.dropItem(stack.id, stack.count);
                            } else if (item.heal) {
                                run.eat(item.id);
                            } else if (item.potion) {
                                run.drink(item.id);
                            } else if (item.clue) {
                                run.readClue();
                            } else if (item.slot) {
                                run.equipFromInventory(item.id);
                            }
                        },
                    },
                    icon(item),
                    stack.count > 1 ? h("span", { class: "count" }, String(stack.count)) : null,
                );
                clientKeyboardButton(slot);
                slot.setAttribute("aria-label", `${item.name}${stack.count > 1 ? ` ×${stack.count}` : ""}. ${action}`);
                // A right click offers its stats, or to drop it (version 136;
                // it dropped it straight away before)
                slot.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    showItemMenu(item, e.clientX, e.clientY, [["Drop", () => run.dropItem(stack.id, stack.count)]]);
                });
                return slot;
            }),
        );
        hud.inventory.replaceChildren(
            h(
                "div",
                { class: "row pack-head" },
                h("h3", {}, `Inventory ${run.inventory.length}/${run.slots}`),
                h(
                    "button",
                    {
                        class: "quiet" + (hud.dropMode ? " on" : ""),
                        title: "On, a click on a thing in the pack drops it a step ahead of you: to make room, or for a friend to take. A right click drops without it.",
                        onclick: () => {
                            hud.dropMode = !hud.dropMode;
                            hud.signature = "";
                            this.updateHud();
                        },
                    },
                    hud.dropMode ? "Dropping: click a thing" : "Drop",
                ),
            ),
            slots,
            h("div", { class: "hint" }, `${formatCoins(run.coins)} coins · Click to use or wear. Right-click for item options.`),
        );
    }

    // All client tabs stay visible while the selected page is open or folded.
    private packTabs(): HTMLElement {
        const hud = this.hud!;
        const tab = (view: ClientTab, label: string, symbol: Child, key?: string) => {
            const button = h(
                "button",
                {
                    class: "pack-tab client-tab" + (hud.inventoryView === view ? " on" : ""),
                    title: key && !isTouch ? `${label} (${key})` : label,
                    onclick: () => this.toggleInventory(view),
                },
                h("span", { class: "client-tab-symbol" }, symbol),
                h("span", { class: "client-tab-name" }, label === "Inventory" ? "Pack" : label === "Equipment" ? "Equip" : label),
            );
            button.dataset.view = view;
            button.setAttribute("role", "tab");
            button.setAttribute("aria-controls", "client-tab-panel");
            button.setAttribute("aria-label", label);
            return button;
        };
        const action = (label: string, symbol: Child, click: () => void) => h("button", { class: "client-tab", title: label, ariaLabel: label, onclick: click }, h("span", { class: "client-tab-symbol" }, symbol), h("span", { class: "client-tab-name" }, label));
        return h(
            "div", { class: "pack-tabs client-tabs" },
            h("div", { class: "client-tabs-left" },
                tab("combat", "Combat", interfaceIcon("combat")),
                tab("prayer", "Prayer", interfaceIcon("prayer")),
                tab("tasks", "Tasks", interfaceIcon("tasks")),
                tab("friends", "Friends", interfaceIcon("friends")),
                tab("account", "Character", interfaceIcon("character")),
                tab("music", "Music", interfaceIcon("music")),
            ),
            h("div", { class: "client-tabs-right" },
                tab("pack", "Inventory", interfaceIcon("inventory"), "I"),
                tab("equipment", "Equipment", interfaceIcon("equipment")),
                tab("loot", "Loot", interfaceIcon("loot")),
                tab("spells", "Magic", interfaceIcon("magic"), "B"),
                action("Map", interfaceIcon("map"), () => this.openFullMap()),
                action("Settings", interfaceIcon("settings"), () => {
                    hud.touch?.cancel();
                    hud.run.setPaused(true);
                    this.showPauseView("settings");
                }),
                action("Logout", interfaceIcon("logout"), () => {
                    hud.touch?.cancel();
                    hud.run.setPaused(true);
                    this.showPauseView("menu");
                }),
            ),
        );
    }

    private renderEquipment(run: Run): void {
        const cross: (Slot | "ammo" | undefined)[] = [undefined, "head", undefined, "cape", "neck", "ammo", "weapon", "body", "shield", undefined, "legs", undefined, "hands", "feet", "ring"];
        const equipment = h("div", { class: "equip-cross client-equipment" }, ...cross.map((slot) => {
            if (!slot) return h("div", { class: "equip-slot none" });
            const ammo = slot === "ammo" ? run.ammo() : undefined;
            const id = slot === "ammo" ? ammo?.id : run.equipment[slot];
            const item = id !== undefined ? getItem(id) : undefined;
            const button = h("button", {
                class: "equip-slot" + (item ? "" : " empty"),
                title: item ? `${item.name}: ${describe(item)}.${slot === "ammo" ? " Click to view ammunition in your inventory." : " Click to take off."}` : slot,
                onclick: () => { if (slot === "ammo") this.toggleInventory("pack"); else run.unequipSlot(slot); },
            }, item ? icon(item) : h("span", { class: "slot-name" }, slot));
            if (item && slot !== "ammo") button.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                showItemMenu(item, e.clientX, e.clientY, [["Take off", () => run.unequipSlot(slot)]]);
            });
            return button;
        }));
        const s = run.stats;
        this.hud!.inventory.replaceChildren(
            h("h3", {}, "Worn equipment"), equipment,
            h("div", { class: "client-stat-list" },
                h("div", {}, "Max hit", h("strong", {}, String(s.damage))),
                h("div", {}, "Attack speed", h("strong", {}, `${s.speed}s`)),
                h("div", {}, "Melee defence", h("strong", {}, String(s.defenceVs.melee))),
                h("div", {}, "Ranged defence", h("strong", {}, String(s.defenceVs.ranged))),
                h("div", {}, "Magic defence", h("strong", {}, String(s.defenceVs.magic))),
            ),
            h("div", { class: "hint" }, `Click a worn item to remove it.${prayerNote(s)}${run.weight() > 0 ? ` Packed gear slows you ${Math.round(run.weight() * 100)}%.` : ""}`),
        );
    }

    private renderPrayer(run: Run): void {
        const choices = [["melee", "Z"], ["ranged", "X"], ["magic", "C"]] as const;
        this.hud!.inventory.replaceChildren(
            h("h3", {}, "Protection prayers"),
            h("div", { class: "client-prayer-points" }, `Prayer: ${Math.round(run.prayer)} / 100`),
            h("div", { class: "client-prayers" }, ...choices.map(([style, key]) => {
                const active = run.protect === style;
                const button = h("button", {
                    class: "client-prayer" + (active ? " on" : ""),
                    title: `Protect from ${style}: halves hits of this style (${key}). Click again to turn off.`,
                    onclick: () => { run.setProtect(style); this.updateHud(); },
                }, h("img", { src: assetUrl(`ui/headicons/${style}.png`), alt: "" }), h("span", {}, `Protect from ${style}`), h("small", {}, active ? "Active" : key));
                button.dataset.protect = style;
                button.dataset.key = key;
                button.setAttribute("aria-pressed", String(active));
                return button;
            })),
            h("div", { class: "hint" }, "Protection halves incoming hits of the chosen style. Prayer drains while active and recovers when no prayer is active. Holy equipment makes it last longer."),
        );
    }

    private renderLootTracker(loot: LootTracker): void {
        const entries = [...loot.entries].sort((a, b) => (b.id === COINS ? b.count : price(getItem(b.id)) * b.count) - (a.id === COINS ? a.count : price(getItem(a.id)) * a.count));
        this.hud!.inventory.replaceChildren(
            h("h3", {}, "Loot tracker"),
            h("div", { class: "client-loot-total" }, iconElement(COINS, "Coins"), h("div", {}, h("strong", {}, `${formatCoins(loot.value)} gp`), h("span", {}, "Estimated value this run"))),
            h("div", { class: "hint" }, `${entries.length} item types · ${loot.totalCount.toLocaleString()} collected`),
            entries.length ? h("div", { class: "client-loot-list" }, ...entries.map(({ id, count }) => {
                const item = getItem(id);
                const value = id === COINS ? count : price(item) * count;
                return h("div", { class: "client-loot-row", title: `${item.name}: ${count.toLocaleString()} collected, estimated ${formatCoins(value)} gp` }, icon(item), h("div", {}, h("span", { class: "name" }, item.name), h("small", {}, `×${count.toLocaleString()}`)), h("span", { class: "coins" }, `${formatCoins(value)} gp`));
            })) : h("div", { class: "client-empty" }, h("span", { class: "client-empty-symbol" }, "▥"), h("strong", {}, "No loot collected yet"), h("span", {}, "Pick up loot in the world to track it here.")),
            h("div", { class: "hint client-loot-note" }, "Tracks new loot picked up this run, including items later used or dropped. Brought gear and purchases are excluded. Resets on the next run."),
        );
    }

    private renderCombat(run: Run): void {
        const s = run.stats;
        const special = specialOf(s.weapon);
        this.hud!.inventory.replaceChildren(
            h("h3", {}, "Combat"),
            h("div", { class: "client-weapon" }, s.weapon ? icon(s.weapon) : null, h("strong", {}, s.weapon?.name ?? "Unarmed")),
            h("div", { class: "client-stat-list" },
                h("div", {}, "Max hit", h("strong", {}, String(s.damage))),
                h("div", {}, "Attack speed", h("strong", {}, `${s.speed}s`)),
                h("div", {}, s.ranged ? "Range" : "Reach", h("strong", {}, `${s.range} tiles`)),
            ),
            h("div", { class: "hint" }, styleNote(s) || (s.ranged ? "Ranged attacks" : "Melee attacks")),
            h("button", { class: "client-special-button" + (run.specReady ? " ready" : ""), disabled: !run.specReady || !special, title: "Use special attack (Q)", onclick: () => run.useSpecial() }, special ? `${special.name} · ${Math.round(run.spec)}%` : "Equip a weapon for a special attack"),
            h("div", { class: "hint" }, "Attack using the existing combat controls. Special attacks use half the special bar. Open Equipment to change your weapon."),
        );
    }

    private renderRunTasks(): void {
        const done = this.save.tasks;
        this.hud!.inventory.replaceChildren(
            h("h3", {}, `Task journal ${done.length}/${TASKS.length}`),
            this.contractPanel(true),
            h("div", { class: "hint" }, "Tasks and contracts are checked and paid when a run ends."),
            h("div", { class: "client-task-list" }, ...TASKS.map((task) => h("div", { class: "client-task" + (done.includes(task.id) ? " done" : "") }, h("span", {}, `${done.includes(task.id) ? "✓ " : ""}${task.name}`), h("small", {}, done.includes(task.id) ? "Completed" : `${formatCoins(task.reward)} coins`)))),
        );
    }

    private renderRunFriends(run: Run): void {
        const online = new Map((this.session.view.friends ?? []).map((friend) => [friend.code, friend]));
        const code = this.friendCode();
        this.hud!.inventory.replaceChildren(
            h("h3", {}, "Friends & party"),
            h("div", { class: "hint" }, `Your friend code: ${code ? formatFriendCode(code) : "connecting…"}`),
            h("button", { disabled: !code, onclick: () => {
                if (code) void navigator.clipboard?.writeText(code).catch(() => prompt("Your friend code:", formatFriendCode(code)));
            } }, "Copy friend code"),
            h("h3", {}, run.coop ? "Current party" : "Solo run"),
            ...run.party().map((member) => h("div", { class: "client-friend-row" }, h("span", {}, `${member.name}${member.me ? " (you)" : ""}`), h("small", {}, member.dead ? "Down" : member.done ? "Out" : `${member.hp}/${member.maxHp} HP`))),
            h("h3", {}, "Friends"),
            ...(this.save.friends?.length ? this.save.friends.map((friend) => {
                const active = online.get(friend.code);
                return h("div", { class: "client-friend-row" + (active ? " online" : "") }, h("span", {}, active?.name ?? friend.name), h("small", {}, active ? this.friendDoing(active) : "Offline"));
            }) : [h("div", { class: "hint" }, "No friends added yet. Manage your friends in the War Room between runs.")]),
            h("button", { onclick: () => this.chat.openForParty() }, "Open chat"),
        );
    }

    private renderRunAccount(): void {
        this.hud!.inventory.replaceChildren(
            h("h3", {}, "Character"),
            h("div", { class: "client-character-name" }, this.save.character.name),
            h("div", { class: "hint" }, this.account?.name ? `Account: ${this.account.name}` : "Progress is saved in this browser."),
            h("div", { class: "client-stat-list" },
                h("div", {}, "Runs", h("strong", {}, String(this.save.stats.runs))),
                h("div", {}, "Escapes", h("strong", {}, String(this.save.stats.extractions))),
                h("div", {}, "Enemies slain", h("strong", {}, String(this.save.stats.kills))),
                h("div", {}, "Banked coins", h("strong", {}, formatCoins(this.save.coins))),
            ),
            h("div", { class: "hint" }, "Appearance, account and bank management are available at the guild between runs."),
        );
    }

    private renderRunMusic(): void {
        const music = h("input", { type: "range", min: "0", max: "1", step: "0.05", value: String(settings.music) });
        music.setAttribute("aria-label", "Music volume");
        const amount = h("span", {}, `${Math.round(settings.music * 100)}%`);
        music.addEventListener("input", () => {
            settings.music = Number(music.value);
            amount.textContent = `${Math.round(settings.music * 100)}%`;
            saveSettings();
            applyMusicVolume();
        });
        const mute = h("button", { onclick: () => {
            settings.muted = !settings.muted;
            saveSettings();
            applyMusicVolume();
            this.hud!.signature = "";
            this.updateHud();
        } }, settings.muted ? "Unmute sounds" : "Mute sounds");
        this.hud!.inventory.replaceChildren(h("h3", {}, "Music & sound"), h("div", { class: "client-music-label" }, "Music volume", amount), music, mute, h("div", { class: "hint" }, "Music follows the area you are exploring. Your volume settings are saved for this browser."));
    }

    // Opens the other spellbook (version 107): as in OSRS, a spell picked
    // from the old one stops being autocast; kept in the save
    private openBook(run: Run, book: Book): void {
        if (run.spellbook === book) {
            return;
        }
        run.spellbook = book;
        this.save.spellbook = book;
        if (run.autocast && SPELL_BY_ID.get(run.autocast)?.book !== book) {
            this.pickSpell(run, undefined);
        } else {
            this.persist();
            if (this.hud) {
                this.hud.signature = "";
                this.updateHud();
            }
        }
    }

    // The spellbook (version 106): the standard spellbook's twenty combat
    // spells, strikes to surges down, wind, water, earth and fire across; or
    // (version 107) Ancient Magicks' sixteen, rushes to barrages down, smoke,
    // shadow, blood and ice across. A click picks one to autocast (again:
    // back to the strongest the staff can of the book open); the staff's tier
    // decides how high it casts, and the runes packed how often.
    private renderSpellbook(run: Run): void {
        const hud = this.hud!;
        const weapon = run.stats.weapon;
        const staff = weapon?.uses === "runes";
        const ahrim = run.ahrimCasts();
        const book = run.spellbook;
        // A powered staff's own spell, and a staff's own spells (version 110)
        const powered = poweredSpell(weapon);
        const own = ownSpells(weapon);
        const ancients = castsAncients(weapon, ahrim);
        const given = run.runesGiven();
        const casting = run.castingSpell();
        const maxHit = (spell: SpellDef) => Math.max(1, Math.round(run.stats.damage * spellScale(weapon, spell)));
        const runeName = (id: number) => getItem(id).name.replace(/s$/, "").toLowerCase();
        const effectText = (spell: SpellDef): string => {
            const e = spell.effect;
            const area = spell.area ? "Hits everything within a tile of the target too. " : "";
            if (!e) {
                return area;
            }
            const often = e.chance !== undefined ? `One hit in ${Math.round(1 / e.chance)}: ` : "";
            switch (e.kind) {
                case "poison":
                    return area + often + `poisons: ${POISON_HITS} hits of ${Math.round(e.share * 100)}% of its max hit, every ${POISON_EVERY}s. `;
                case "weaken":
                    return area + often + `its target hits ${Math.round(e.share * 100)}% less for ${WEAKEN_SECONDS}s. `;
                case "heal":
                    return area + often + `heals you ${Math.round(e.share * 100)}% of what it deals. `;
                case "freeze":
                    return area + often + `freezes its target for ${e.seconds}s (not a boss). `;
            }
        };
        const status = (spell: SpellDef): string => {
            if (!staff) {
                return "Wield a staff to cast it.";
            }
            if (powered && spell !== powered) {
                return `Your ${weapon!.name.toLowerCase()} casts only its own spell.`;
            }
            if (spell.book === "ancient" && !ancients) {
                return "Your staff can't cast Ancient Magicks.";
            }
            if (spell.book === "staff" && !staffCasts(weapon, spell, ahrim)) {
                return "Only certain staves cast it.";
            }
            if (!staffCasts(weapon, spell, ahrim)) {
                return weapon!.tier < spell.tier ? `It takes a tier ${spell.tier} staff; yours is tier ${weapon!.tier}.` : `Your ${weapon!.name.toLowerCase()} doesn't cast it.`;
            }
            const casts = castsLeft(spell, given, run.count);
            return casts <= 0 ? "Not enough runes packed." : `Max hit ${maxHit(spell)}, ${casts === Infinity ? "no runes needed" : `${casts} cast${casts === 1 ? "" : "s"} packed`}.`;
        };
        const rows: string[] = book === "ancient" ? ANCIENT_FAMILIES : FAMILIES;
        const columns: string[] = book === "ancient" ? ANCIENT_ELEMENTS : ELEMENTS;
        // A spell's cell: its icon (a powered staff's is the staff's own),
        // greyed when it can't be cast, a click to autocast it
        const cell = (spell: SpellDef) => {
            const usable = staff && staffCasts(weapon, spell, ahrim) && castsLeft(spell, given, run.count) > 0;
            const picked = run.autocast === spell.id;
            const cost = spell.runes.map((r) => `${r.n} ${runeName(r.id)}${given.has(r.id) ? " (your staff gives these)" : ""}`).join(", ");
            let img: HTMLElement;
            if (spell.poweredBy !== undefined) {
                img = iconElement(spell.poweredBy, spell.name);
            } else {
                const pic = document.createElement("img");
                pic.src = assetUrl(`ui/spells/${spell.icon}.png`);
                pic.alt = spell.name;
                pic.draggable = false;
                img = pic;
            }
            const tierText = spell.poweredBy !== undefined ? "its staff's own" : `tier ${spell.tier}`;
            const element = h(
                "div",
                {
                    class: "spell" + (usable ? "" : " off") + (picked ? " on" : "") + (casting.spell?.id === spell.id ? " now" : ""),
                    title:
                        `${spell.name} (${tierText}): ${cost}. ${effectText(spell)}${status(spell)} ` +
                        (spell.poweredBy !== undefined ? "" : picked ? "Click again to cast the strongest you can." : "Click to autocast it."),
                    onclick: () => {
                        if (spell.poweredBy === undefined) {
                            this.pickSpell(run, picked ? undefined : spell.id);
                        }
                    },
                },
                img,
            );
            clientKeyboardButton(element);
            element.setAttribute("aria-label", `${spell.name}. ${status(spell)}`);
            element.setAttribute("aria-disabled", String(!usable));
            return element;
        };
        const grid = h(
            "div",
            { class: "spellbook" + (powered ? " dim" : "") },
            ...rows.flatMap((family) => columns.map((element) => cell(SPELL_BY_ID.get(`${element}_${family}`)!))),
        );
        // The staff's own: a powered staff's one spell, or the god spells and
        // the like it casts besides the books
        const ownRow =
            powered || own.length > 0
                ? h(
                      "div",
                      { class: "spell-own" },
                      h("div", { class: "spell-own-head" }, powered ? "Your staff's own spell: the only one it casts" : "Your staff's own"),
                      h("div", { class: "spellbook" }, ...(powered ? [powered] : own).map(cell)),
                  )
                : null;
        // What's cast now, and what it takes from the pack
        const shown = casting.spell ?? (run.autocast ? SPELL_BY_ID.get(run.autocast) : undefined);
        const detail = shown
            ? h(
                  "div",
                  { class: "spell-detail" },
                  h("div", { class: "spell-name" }, shown.name, h("span", { class: "stats" }, ` · ${status(shown)}`)),
                  shown.effect || shown.area ? h("div", { class: "stats" }, effectText(shown)) : null,
                  h(
                      "div",
                      { class: "spell-runes" },
                      ...shown.runes.map((r) =>
                          h(
                              "div",
                              { class: "rune" + (!given.has(r.id) && run.count(r.id) < r.n ? " short" : ""), title: getItem(r.id).name },
                              icon(getItem(r.id)),
                              h("span", { class: "count" }, String(r.n)),
                              h("span", { class: "have" }, given.has(r.id) ? "staff" : String(run.count(r.id))),
                          ),
                      ),
                  ),
              )
            : null;
        const head = h(
            "div",
            { class: "row pack-head" },
            h("span", { class: "stats" }, run.autocast ? `Autocast: ${SPELL_BY_ID.get(run.autocast)?.name}` : "Autocast: strongest"),
            h(
                "button",
                {
                    class: "quiet" + (run.autocast ? "" : " on"),
                    title: "Cast the strongest spell your staff can, with the runes you have packed",
                    onclick: () => this.pickSpell(run, undefined),
                },
                "Strongest",
            ),
        );
        const hint = h(
            "div",
            { class: "hint" },
            !staff ? "Wield a staff, wand or sceptre to cast these. " : casting.why ? casting.why + " " : "",
            powered
                ? "A powered staff casts its own spell and nothing else, as in OSRS, for the runes a charge of it costs. It hits the staff's own max hit."
                : book === "ancient"
                  ? "Needs an ancient staff or sceptre, a master, Kodai or dragon hunter wand, a nightmare staff but the harmonised, Zuriel's staff, Thammaron's or the accursed sceptre, or Ahrim's with its set and the amulet of the damned. Rushes at tier 3, bursts and blitzes 4, barrages 5."
                  : `Your staff's tier is how high it casts: strikes at 1 up to surges at 5. Elemental staffs and tomes give their runes. Enemies here drop elemental and ${getItem(catalystOfTier(run.world.tier)).name.toLowerCase()}.`,
        );
        // Which book is open: the standard spellbook or Ancient Magicks
        const books = h(
            "div",
            { class: "book-tabs" },
            ...BOOKS.map((b) =>
                h(
                    "button",
                    {
                        class: "quiet" + (book === b ? " on" : ""),
                        title: b === "ancient" ? "Ancient Magicks: smoke, shadow, blood and ice" : "The standard spellbook: wind, water, earth and fire",
                        onclick: () => this.openBook(run, b),
                    },
                    b === "ancient" ? "Ancient" : "Standard",
                ),
            ),
        );
        // One page the pack's width, so the words wrap
        // A powered staff's page is its own spell: the books are no use to it
        hud.inventory.replaceChildren(
            h(
                "div",
                { class: "spell-page" },
                h("h3", {}, "Magic"),
                ...(powered ? [ownRow!] : [books, head, grid, ...(ownRow ? [ownRow] : [])]),
                ...(detail ? [detail] : []),
                hint,
            ),
        );
    }

    // -----------------------------------------------------------------------
    // After a run

    showSummary(
        result: RunResult,
        kept: ItemStack[],
        extras: { tasks: Task[]; insured?: number; grave?: boolean; graveHalved?: boolean; pet?: string; contract?: Contract },
    ): void {
        const extracted = result.kind === "extracted";
        const report = result.report;
        const minutes = `${Math.floor(report.seconds / 60)}:${String(Math.floor(report.seconds % 60)).padStart(2, "0")}`;
        // The recap: the map as it was seen with where it ended, and the numbers
        const recap = h(
            "div",
            { class: "recap" },
            h("div", { class: "recap-map" }, report.map),
            h(
                "div",
                { class: "recap-lines" },
                h(
                    "div",
                    {},
                    extracted
                        ? `Out in ${minutes}.`
                        : result.kind === "left"
                          ? `Left after ${minutes}.`
                          : `${report.killer ?? "Something"} killed you after ${minutes}.`,
                ),
                h(
                    "div",
                    {},
                    `${report.kills} kill${report.kills === 1 ? "" : "s"}` +
                        (report.bossKills > 0 ? ", the boss among them" : "") +
                        (report.championKills > 0 ? `, ${report.championKills} champion${report.championKills > 1 ? "s" : ""}` : "") +
                        `; ate ${report.ate}.`,
                ),
                h(
                    "div",
                    {},
                    `${formatCoins(result.carry.coins)} coins ${extracted ? "brought home" : "left behind"}, ${report.packItems} thing${report.packItems === 1 ? "" : "s"} in the pack.`,
                ),
                report.graveTaken ? h("div", {}, "You took back what you'd left at your gravestone.") : null,
                report.clues > 0 ? h("div", {}, `Dug up ${report.clues} casket${report.clues === 1 ? "" : "s"} from clue scrolls.`) : null,
                report.vaults > 0 ? h("div", {}, "Unlocked the vault.") : null,
                h("div", { class: "stats" }, "White: where you arrived. Green: the ways out you found. Gold or red: where it ended."),
            ),
        );
        const tasks =
            extras.tasks.length > 0
                ? h(
                      "div",
                      { class: "panel tasks-done" },
                      h("h2", {}, "Tasks done"),
                      ...extras.tasks.map((t) =>
                          h("div", { class: "item-row" }, h("span", { class: "name" }, t.name), h("span", { class: "coins" }, `+${formatCoins(t.reward)} coins`)),
                      ),
                  )
                : null;
        const insured =
            extras.insured !== undefined
                ? h("div", { class: "subtitle" }, `Your ${getItem(extras.insured).name.toLowerCase()} came home: it was insured.`)
                : null;
        const grave = extras.grave
            ? h(
                  "div",
                  { class: "subtitle" },
                  extras.graveHalved
                      ? "A gravestone marks where you fell. Your insurance paid out, so it holds only half of the rest. Go back for it within your next two runs, or it's gone."
                      : "A gravestone marks where you fell, with the rest in it. Go back for it within your next two runs, or it's gone.",
              )
            : null;
        const pet = extras.pet
            ? h(
                  "div",
                  { class: "subtitle pet" },
                  `${petName(extras.pet)} followed you home. It waits in the courtyard and comes along on runs; the Tasks screen picks which pet does.`,
              )
            : null;
        const contract = extras.contract
            ? h(
                  "div",
                  { class: "subtitle contract-paid" },
                  `Daily contract done: ${formatCoins(extras.contract.reward)} coins and a clue scroll, both in the bank.`,
              )
            : null;
        const list = h(
            "div",
            { class: "summary-list" },
            ...kept.map((stack) => {
                const item = getItem(stack.id);
                return h(
                    "div",
                    { class: "slot", title: `${item.name}: ${describe(item)}` },
                    icon(item),
                    stack.count > 1 ? h("span", { class: "count" }, String(stack.count)) : null,
                );
            }),
        );
        // In a box of its own, drawn bigger on a big screen (style.css's
        // .summary-box; version 97, it was hard to read at 1440p and 4K)
        this.show(
            h(
                "div",
                { class: "screen summary-screen" },
                h(
                "div",
                { class: "summary-box" },
                h("h1", {}, extracted ? "Extracted!" : result.kind === "left" ? "You left" : "You died"),
                h(
                    "div",
                    { class: "subtitle" },
                    extracted
                        ? `You escaped ${result.world.name} with ${formatCoins(result.carry.coins)} coins and, still in your pack:`
                        : extras.grave
                          ? `What you carried, including what you wore, is in your gravestone on ${result.world.name}:`
                          : `${result.world.name} keeps what you carried, including what you wore:`,
                ),
                list,
                kept.length === 0 ? h("div", { class: "subtitle" }, "nothing at all") : null,
                extracted && kept.length > 0
                    ? h("div", { class: "subtitle" }, "It stays packed for your next run until you put it in the bank (Bank & gear).")
                    : null,
                insured,
                grave,
                pet,
                contract,
                recap,
                tasks,
                this.session.room
                    ? h("button", { class: "primary", onclick: () => this.showCoop() }, "Back to the party")
                    : h("button", { class: "primary", onclick: () => this.showMenu() }, "Back to the guild"),
                ),
            ),
        );
    }

    // -----------------------------------------------------------------------
    // Tasks and the record

    showTasks(): void {
        const s = this.save.stats;
        const done = TASKS.filter((t) => this.save.tasks.includes(t.id)).length;
        const time = (seconds: number) =>
            seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}` : "none yet";
        const rows = TASKS.map((t) => {
            const finished = this.save.tasks.includes(t.id);
            return h(
                "div",
                { class: "item-row" + (finished ? " done" : "") },
                h("span", { class: "name" }, (finished ? "✓ " : "") + t.name),
                h("span", { class: finished ? "stats" : "coins" }, finished ? "paid" : `${formatCoins(t.reward)} coins`),
            );
        });
        const record = (label: string, value: string | number) =>
            h("div", { class: "item-row stat-row" }, h("span", { class: "name" }, label), h("span", { class: "value" }, String(value)));
        // Pets: which one comes along, shown beside the character behind
        const choosePet = (id: string | undefined) => {
            this.save.pet = id;
            this.persist();
            this.menu.setPet(id);
            this.showTasks();
        };
        const pets = this.save.pets.map((id) => {
            const following = this.save.pet === id;
            return h(
                "div",
                { class: "item-row" + (following ? " done" : "") },
                h("span", { class: "name" }, petName(id)),
                h("span", { class: "stats" }, `${petFrom(id)}: ${petBuff(id)?.text ?? ""}${following ? " (following you)" : ""}`),
                following
                    ? h("button", { onclick: () => choosePet(undefined) }, "Stay")
                    : h("button", { class: "primary", onclick: () => choosePet(id) }, "Follow"),
            );
        });
        this.showKeyed(
            "tasks",
            h(
                "div",
                { class: "screen" },
                h("h2", {}, "Tasks"),
                h(
                    "div",
                    { class: "columns" },
                    h(
                        "div",
                        { class: "panel" },
                        h("h2", {}, `Tasks (${done} of ${TASKS.length} done)`),
                        h("div", { class: "subtitle" }, "Each pays once, when a run ends with it done."),
                        h("div", { class: "item-list" }, ...rows),
                    ),
                    h(
                        "div",
                        { class: "panel" },
                        h("h2", {}, "Record"),
                        h(
                            "div",
                            { class: "item-list" },
                            record("Runs", s.runs),
                            record("Escapes", s.extractions),
                            record("Deaths", s.deaths),
                            record("Hardest map tier", s.deepest),
                            record("Kills", s.kills),
                            record("Bosses killed", s.bossKills),
                            record("Champions killed", s.championKills),
                            record("Kills with bows and staves", s.rangedKills),
                            record("Best haul", `${formatCoins(s.bestHaul)} coins`),
                            record("Fastest escape", time(s.fastestEscape)),
                            record("Maps escaped from", `${s.mapsEscaped.length} of ${WORLDS.length}`),
                            record("Clue caskets dug up", s.clues),
                            record("Gravestones emptied", s.graves),
                            record("Vaults unlocked", s.vaults),
                        ),
                        h("h2", {}, "Pets"),
                        h(
                            "div",
                            { class: "subtitle" },
                            `One boss in ${PET_ONE_IN} leaves a small copy of itself behind. It waits in the courtyard, follows you on runs, and is yours whatever happens out there. The one that follows gives you a small gift of its boss's.`,
                        ),
                        pets.length > 0 ? h("div", { class: "item-list" }, ...pets) : h("div", { class: "stats" }, "None yet."),
                    ),
                ),
                h("button", { onclick: () => this.back() }, "Back"),
            ),
        );
    }
}
