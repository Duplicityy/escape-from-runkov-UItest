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
    WEAK_TO,
    formatCoins,
    getItem,
    isPrize,
    price,
    specialOf,
    weaponStyle,
    PRAYER_BONUS_SCALE,
} from "../content/items";
import { iconElement, setIcon } from "../game/icons";
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
import { isKept } from "../game/kit";
import { Chat } from "./chat";
import { FullMap } from "./fullmap";
import { REGEN_DELAY, soak } from "../game/combat";
import { GAME_BUILD, GameStart, Loadout, MemberView, Session } from "../game/coop";
import { DEFAULT_NAME_COLOR, NAME_COLORS, crownIcon, crownKey, crownVerified, nameColorOf } from "../game/crown";
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
import { applyMusicVolume } from "../game/music";
import { PET_ONE_IN, petBuff, petName } from "../game/pets";
import { BODY_PART_NAMES, COLOR_GROUP_NAMES, loadColorTables, loadKits } from "../game/player";
import { Run, RunResult, TRADER_MARKUP } from "../game/run";
import {
    CHARACTER_SLOTS,
    ItemStack,
    SaveData,
    UPGRADES,
    Upgrades,
    loadedSlot,
    packSize,
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

// The pages over a paused run: the pause menu and its two pages, and the
// trader's stall
type PauseView = "menu" | "settings" | "stats" | "trade";

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

function tierName(tier: number): string {
    return ["", "common", "uncommon", "rare", "epic", "legendary"][tier] ?? "";
}

function icon(item: ItemDef): HTMLElement {
    const el = iconElement(item.id, item.name);
    el.title = `${item.name}: ${describe(item)}`;
    return el;
}

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
        inventoryView: "pack" | "spells";
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
            hud.run.setPaused(true);
        } else if (hud.pause.hidden) {
            hud.run.setPaused(false);
        }
    }

    // The full map over the run: it takes the controls (and stops the world
    // alone) while it's up, as the pause menu does
    private openFullMap(): void {
        const hud = this.hud;
        if (!hud || !hud.pause.hidden || hud.fullMap.isOpen) {
            return;
        }
        if (hud.fullMap.show()) {
            hud.run.setPaused(true);
        }
    }

    // The pack panel, on its pack or its spellbook: the key for the page up
    // shuts it, the other's turns the page
    private toggleInventory(view: "pack" | "spells" = "pack"): void {
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
        this.hud = undefined;
        this.loading = false;
        // Only the co-op screen wants the list of servers (it asks again)
        this.session.browse(false);
        this.root.replaceChildren(...children.filter((c): c is Node | string => !!c));
        this.updateChat();
    }

    // The chat box shows in a run, and in a co-op room's lobby
    private updateChat(): void {
        this.chat.setActive(this.hud !== undefined || this.session.room !== undefined);
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
        const layout = isTouch ? "rail" : settings.menuLayout;
        this.showKeyed("menu", layout === "card" ? this.cardMenu() : layout === "osrs" ? this.osrsMenu() : this.railMenu());
        // The character stands clear of the rail, or above the play bar;
        // between the card and the rooms
        this.menu.focus = layout === "card" ? 0 : layout === "osrs" ? 0.02 : 0.12;
        this.menu.raise = layout === "card" ? 0.14 : layout === "osrs" ? 0.08 : 0.05;
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
                (repairs > 0 ? ` · ${repairs} need${repairs === 1 ? "s" : ""} repair` : "") +
                (save.insured !== undefined ? ` · ${getItem(save.insured).name.toLowerCase()} insured` : ""),
            shop: `${save.shop.length} on the shelves · ${formatCoins(save.coins)} coins`,
            tasks: `${tasksDone} of ${TASKS.length} done` + (save.pets.length > 0 ? ` · ${plural(save.pets.length, "pet")}` : ""),
            character: save.character.name,
            coop: this.session.room ? `On a server: ${this.session.room.name}` : "Up to four on one map together",
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

    // A room's button: an icon, its name, and a line under it
    private roomButton(name: string, sub: string | undefined, icon: Node, open: () => void, primary = false): HTMLElement {
        return h(
            "button",
            { class: "room" + (primary ? " primary" : ""), onclick: open },
            // The icon sits in a well of its own: padding on the icon itself
            // would show its neighbours on the sheet
            h("span", { class: "room-well" }, icon),
            h("span", { class: "room-text" }, h("span", { class: "room-name" }, name), sub ? h("span", { class: "room-sub" }, sub) : null),
        );
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

    // Progress lives in this browser; a code carries it to another
    private utilityButtons(): HTMLElement[] {
        return [
            h(
                "button",
                {
                    title: "Your progress as text, to paste into the game in another browser",
                    onclick: async () => {
                        this.showSaveCode(await saveCode(this.save));
                    },
                },
                "Save code",
            ),
            h(
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
                        if (confirm("Start over? The stash, coins and character are wiped.")) {
                            Object.assign(this.save, resetSave());
                            this.showMenu();
                        }
                    },
                },
                "Start over",
            ),
        ].filter((b): b is HTMLButtonElement => !!b);
    }

    private controlsHint(): string {
        return isTouch
            ? "Drag on the left to move · tap the world to swing · the big button opens chests and holds for the way out · Eat eats · tap Pray, or hold it to pick a protection"
            : "WASD to move · your weapon attacks on its own · Q special · E opens chests and the way out · F eats · 1 2 3 4 drink · I pack · M map · Esc pauses";
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
                    f.pet ? h("div", { class: "record-line" }, f.pet) : null,
                    f.grave ? h("div", { class: "record-line grave" }, f.grave) : null,
                    this.notice ? h("div", { class: "record-line notice" }, this.notice) : null,
                ),
            ),
            h(
                "div",
                { class: "rail" },
                this.roomButton("Choose a map", f.play, this.itemIcon(2677), () => this.showMaps(), true),
                this.coopEnabled ? this.roomButton("Co-op", f.coop, this.itemIcon(1019), () => this.showCoop()) : null,
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
        const worn = (slot: Slot | undefined) => {
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
        const layout: (Slot | undefined)[] = [undefined, "head", undefined, "cape", "neck", undefined, "weapon", "body", "shield", undefined, "legs", undefined, "hands", "feet", "ring"];
        const escapeRate = s.runs > 0 ? `${Math.round((s.extractions / s.runs) * 100)}%` : "–";
        const tile = (value: string, label: string, color: string) => h("div", { class: "big-stat" }, h("span", { class: "big-value " + color }, value), h("span", { class: "big-label" }, label));
        const line = (label: string, value: Node | string, cls = "") => h("div", { class: "card-line" }, h("span", { class: "label" }, label), h("span", { class: "value " + cls }, value));
        const last = save.recentMaps.map((id) => WORLD_BY_ID.get(id)).find((w) => w && mapUnlocked(s.mapsBeaten, w.id));
        const worst = Object.values(save.equipment)
            .filter((id): id is number => id !== undefined)
            .map((id) => ({ id, wear: wearOf(save.wear, id) }))
            .sort((a, b) => b.wear - a.wear)[0];
        const card = h(
            "div",
            { class: "osrs-card" },
            h(
                "div",
                { class: "card-head" },
                h("div", { class: "card-portrait" }, this.itemIcon(save.equipment.head ?? 1163)),
                h("div", { class: "card-who" }, this.recordName(), h("div", { class: "card-sub" }, `${s.runs} runs · hardest map ${s.deepest > 0 ? "★".repeat(s.deepest) : "none yet"}`)),
            ),
            h("div", { class: "rule-head" }, "Worn"),
            h("div", { class: "worn-grid" }, ...layout.map(worn)),
            h("div", { class: "big-stats" }, tile(escapeRate, "escaped", "green"), tile(formatCoins(s.bestHaul), "best haul", "yellow"), tile(String(s.deaths), "deaths", "red")),
            h(
                "div",
                { class: "card-lines" },
                line("Banked", `${formatCoins(save.coins)} coins`, "yellow"),
                line("Escapes", `${s.extractions} of ${s.runs}`),
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
                crownVerified(crownKey()) ? (() => {
                    const b = this.switchCharacterButton(false)!;
                    b.className = "";
                    b.replaceChildren("Switch character");
                    return b;
                })() : null,
            ),
        );
        const rooms = h(
            "div",
            { class: "osrs-rooms" },
            this.roomButton("Choose a map", f.play, this.itemIcon(2677), () => this.showMaps(), true),
            this.coopEnabled ? this.roomButton("Co-op", f.coop, this.itemIcon(1019), () => this.showCoop()) : null,
            this.roomButton("Bank & gear", f.stash, this.itemIcon(1127), () => this.showStash()),
            this.roomButton("Shop", f.shop, this.itemIcon(995), () => this.showShop()),
            this.roomButton("Tasks & pets", f.tasks, this.itemIcon(989), () => this.showTasks()),
            this.roomButton("Settings", "Brightness, sound, camera", this.gearIcon(), () => this.showSettings()),
        );
        const play = h(
            "div",
            { class: "osrs-play" },
            this.session.room
                ? h("button", { class: "go", onclick: () => this.showCoop() }, `Back to ${this.session.room.name}`)
                : last
                  ? h("button", { class: "go", onclick: () => this.hooks.startRun(last.id) }, `Descend into ${last.name}`)
                  : h("button", { class: "go", onclick: () => this.showMaps() }, "Choose your first map"),
            h("div", { class: "osrs-hint" }, this.controlsHint()),
        );
        return h(
            "div",
            { class: "screen title layout-osrs" },
            h("div", { class: "osrs-title" }, h("h1", {}, "Escape from Runkov"), h("div", { class: "tagline" }, "Go in geared. Come out richer. Or don't come out.")),
            card,
            rooms,
            play,
            h("div", { class: "osrs-build" }, `Build ${GAME_BUILD}`),
            h("div", { class: "osrs-utility" }, ...this.utilityButtons()),
        );
    }

    // -----------------------------------------------------------------------
    // Co-op: the party room (coop.ts talks to the relay; main.ts starts the
    // run when the host does)

    // What this player brings to a party, as the room shows it
    private myLoadout(): Loadout {
        const save = this.save;
        return { character: save.character, equipment: { ...save.equipment }, pet: save.pet, crown: crownKey() };
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
        // Never over a run, or while one loads
        if (this.hud || this.loading) {
            return;
        }
        if (this.screenKey === "coop") {
            this.showCoop();
        } else if (this.screenKey === "menu") {
            this.showMenu();
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
        const room = view.room;
        const children: Child[] = [
            h("h2", {}, "Co-op"),
            h(
                "div",
                { class: "subtitle" },
                "Up to four on one map together. One of you hosts: the map runs in their browser and the rest play through it, so the host wants the best connection. Everyone brings their own gear and keeps their own loot; whoever reaches a drop first takes it. The boss and its guards have more in them for a bigger party.",
            ),
        ];
        if (view.status !== "online") {
            children.push(
                h("div", { class: "panel coop" }, h("div", { class: "subtitle" }, view.error ?? "Connecting to the co-op server...")),
                view.error ? h("button", { onclick: () => void session.connect().then(() => this.onSessionChange()) }, "Try again") : null,
            );
        } else if (!room) {
            const input = h("input", {
                type: "text",
                class: "code",
                placeholder: "Code",
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
            const startMap = this.save.recentMaps.find((id) => mapUnlocked(this.save.stats.mapsBeaten, id)) ?? WORLDS[0].id;
            const servers = view.servers;
            const serverRows = (servers ?? []).map((s) => {
                const world = WORLD_BY_ID.get(s.mapId);
                const locked = !view.anyMap && !mapUnlocked(this.save.stats.mapsBeaten, s.mapId);
                const mapName = world ? `${world.name} ${"★".repeat(world.tier)}` : s.mapId;
                return h(
                    "div",
                    { class: "item-row server" },
                    h("span", { class: "name" }, s.name),
                    h("span", { class: "stats" }, `${s.host} hosting · ${mapName}${locked ? " (not unlocked for you)" : ""} · ${s.players} of ${s.max}`),
                    h("button", { disabled: locked, title: locked ? "Beat the map before it to play this one" : `Join ${s.name}`, onclick: () => session.join(s.code) }, "Join"),
                );
            });
            children.push(
                h(
                    "div",
                    { class: "panel coop" },
                    h("h3", {}, "Servers"),
                    h("div", { class: "stats" }, "Every public server waiting for players. Join one and you're in its party."),
                    servers === undefined
                        ? h("div", { class: "record-line" }, "Looking for servers...")
                        : serverRows.length > 0
                          ? h("div", { class: "item-list" }, ...serverRows)
                          : h("div", { class: "record-line" }, "No public servers right now. Host one, and it shows up here for everyone."),
                    h("h3", {}, "Host a server"),
                    h(
                        "div",
                        { class: "stats" },
                        "A public server is in the list above for anyone to join. A private one is reachable by its code only: you get the code to give your friends. Either way you pick the map, from the ones you've unlocked, and you can switch public and private later.",
                    ),
                    h(
                        "div",
                        { class: "row" },
                        h("button", { class: "primary", disabled: view.full, onclick: () => session.create(startMap, true) }, "Host a public server"),
                        h("button", { disabled: view.full, onclick: () => session.create(startMap, false) }, "Host a private server"),
                    ),
                    view.full ? h("div", { class: "record-line notice" }, "The co-op server has no room for another one right now; try again in a bit.") : null,
                    h("h3", {}, "Join a private server"),
                    h("div", { class: "stats" }, "Got a code from a friend? Type it here."),
                    h("div", { class: "row" }, input, h("button", { onclick: () => session.join(this.joinCode) }, "Join")),
                    view.error ? h("div", { class: "record-line notice" }, view.error) : null,
                ),
            );
        } else {
            const isHost = session.isHost;
            const me = view.you;
            const world = WORLD_BY_ID.get(room.mapId);
            const guests = room.members.filter((m) => m.id !== room.hostId);
            const allReady = guests.every((m) => m.ready);
            const rows = room.members.map((m) => {
                const host = m.id === room.hostId;
                const mine = m.id === me;
                return h(
                    "div",
                    { class: "item-row member" + (mine ? " mine" : "") },
                    this.heroLabel(m, room.members, host ? " · host" : mine ? " · you" : ""),
                    h("span", { class: "stats" }, this.gearLine(m.loadout)),
                    h("span", { class: "ready" + (host || m.ready ? " on" : "") }, host ? "hosting" : m.ready ? "ready" : "not ready"),
                    isHost && !host ? h("button", { class: "quiet", onclick: () => session.kick(m.id) }, "Kick") : null,
                );
            });
            const mapRow = isHost
                ? (() => {
                      const select = h("select", {});
                      for (const w of WORLDS) {
                          if (mapUnlocked(this.save.stats.mapsBeaten, w.id)) {
                              const option = h("option", { value: w.id }, `${w.name} ${"★".repeat(w.tier)}`);
                              option.selected = w.id === room.mapId;
                              select.append(option);
                          }
                      }
                      select.addEventListener("change", () => session.setMap(select.value));
                      return h("div", { class: "row" }, h("span", { class: "stats" }, "Map:"), select);
                  })()
                : h("div", { class: "record-line" }, `Map: ${world ? `${world.name} ${"★".repeat(world.tier)}` : room.mapId} (the host picks)`);
            const mine = room.members.find((m) => m.id === me);
            const actions: Child[] = [];
            if (room.started) {
                actions.push(h("div", { class: "subtitle" }, "The run is under way. The others are still in; wait here, or leave the party."));
            } else if (isHost) {
                actions.push(
                    h(
                        "button",
                        {
                            class: "primary",
                            disabled: !allReady,
                            title: allReady ? "Start the run for everyone here" : "Everyone has to be ready first",
                            onclick: () => this.startParty(),
                        },
                        room.members.length === 1 ? "Start alone" : allReady ? "Start the run" : "Waiting for everyone to be ready",
                    ),
                    h("button", { class: "quiet", onclick: () => session.disband() }, "Disband"),
                );
            } else {
                actions.push(
                    h("button", { class: "primary", onclick: () => session.setReady(!mine?.ready) }, mine?.ready ? "Not ready" : "Ready"),
                    h("div", { class: "stats" }, "The host starts the run once everyone's ready."),
                );
            }
            // Public or private: the host's switch, and everyone's word on
            // which it is (the code matters for a private one)
            const privacy = isHost
                ? h(
                      "div",
                      { class: "row privacy" },
                      h("span", { class: "stats" }, room.open ? "Public: anyone can join from the server list." : "Private: only the code gets anyone in."),
                      h("button", { class: "quiet", disabled: room.started, onclick: () => session.setOpen(!room.open) }, room.open ? "Make it private" : "Make it public"),
                  )
                : h("div", { class: "record-line" }, room.open ? "A public server: anyone can join from the list." : "A private server: only the code gets anyone in.");
            children.push(
                h(
                    "div",
                    { class: "panel coop" },
                    h("div", { class: "record-line server-name" }, room.name),
                    privacy,
                    h(
                        "div",
                        { class: "party-code" },
                        h("span", { class: "stats" }, room.open ? "Code" : "Code for your friends"),
                        h("span", { class: "code" }, room.code),
                        h(
                            "button",
                            {
                                class: "quiet",
                                onclick: () => void navigator.clipboard?.writeText(room.code).catch(() => undefined),
                            },
                            "Copy",
                        ),
                    ),
                    mapRow,
                    h("h3", {}, `Party (${room.members.length} of 4)`),
                    h("div", { class: "item-list" }, ...rows),
                    h("div", { class: "row" }, ...actions),
                    view.error ? h("div", { class: "record-line notice" }, view.error) : null,
                    h("h3", {}, "While you wait"),
                    h("div", { class: "stats" }, "The guild's rooms, and back here when you're done; what you wear and pack goes with you."),
                    h(
                        "div",
                        { class: "row small" },
                        h("button", { onclick: () => this.showStash() }, "Bank & gear"),
                        h("button", { onclick: () => this.showShop() }, "Shop"),
                        h("button", { onclick: () => this.showTasks() }, "Tasks & pets"),
                        h("button", { onclick: () => this.showCharacter() }, "Character"),
                        h("button", { onclick: () => this.showSettings() }, "Settings"),
                    ),
                ),
            );
        }
        children.push(
            h(
                "div",
                { class: "row" },
                room ? h("button", { onclick: () => session.leave() }, "Leave the server") : null,
                h("button", { onclick: () => this.showMenu() }, "Title screen"),
            ),
        );
        // Drawn again while a code's being typed (the list changed): the
        // typing carries on in the new box
        const typing = document.activeElement instanceof HTMLInputElement && document.activeElement.classList.contains("code");
        this.showKeyed("coop", h("div", { class: "screen" }, ...children));
        // The list of public servers, asked for every few seconds while this
        // screen is up out of a server (place() stops it for any other)
        session.browse(view.status === "online" && !room);
        if (typing) {
            const again = this.root.querySelector<HTMLInputElement>("input.code");
            again?.focus();
            again?.setSelectionRange(again.value.length, again.value.length);
        }
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
        this.session.start({ seed: (Date.now() ^ (world.tier * 7919)) >>> 0, mapId: world.id, endless: false, hard: false, heroes });
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

    showStash(): void {
        const save = this.save;
        const stats = gearStats(save.equipment, save.wear);
        const render = () => this.showStash();
        // How worn a piece is, for its label
        const wornNote = (id: number) => {
            const w = wearOf(save.wear, id);
            return w > 0 ? ` Worn ${Math.round(w * 100)}%${w >= 1 ? ", half its defence gone" : ""}.` : "";
        };

        const equipment = h(
            "div",
            { class: "equipment" },
            ...SLOTS.map((slot) => {
                const id = save.equipment[slot];
                const item = id !== undefined ? getItem(id) : undefined;
                return h(
                    "div",
                    {
                        class: "equip-slot",
                        title: item ? `${item.name}: ${describe(item)}.${wornNote(item.id)} Click to take off.` : slot,
                        onclick: () => {
                            if (unequip(save.equipment, save.stash, slot)) {
                                this.persist();
                                render();
                            }
                        },
                    },
                    item ? icon(item) : slot,
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
                        class: "slot",
                        title: `${item.name}: ${describe(item)}. ${all > 1 ? "Click to pick how many go back in the bank." : "Click to put back in the bank."}`,
                        onclick: () => {
                            // More than one: picked in the bank, to say how many
                            // (version 102; it was the whole stack)
                            if (all > 1) {
                                this.bankSelected = stack.id;
                                this.itemAmount = "";
                                this.itemNote = "";
                                render();
                                return;
                            }
                            // The count first: taking the stack out of the pack empties it
                            const { id, count } = stack;
                            removeItem(save.backpack, id, count);
                            if (id === COINS) {
                                save.coins += count;
                            } else {
                                addItem(save.stash, id, count);
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
        const kinds = [...held.keys()].sort(
            (a, b) =>
                Number(!!getItem(b).exclusive) - Number(!!getItem(a).exclusive) ||
                getItem(b).tier - getItem(a).tier ||
                getItem(a).name.localeCompare(getItem(b).name),
        );
        const firstExclusive = kinds.find((id) => getItem(id).exclusive);
        const armourSlots = ["head", "body", "legs", "feet", "hands", "shield"];
        const tabs: { key: string; name: string; icon?: number; has: (item: ItemDef) => boolean }[] = [
            { key: "all", name: "All", has: () => true },
            ...(firstExclusive !== undefined ? [{ key: "yours", name: "Yours alone", icon: firstExclusive, has: (i: ItemDef) => !!i.exclusive }] : []),
            { key: "weapons", name: "Weapons", icon: 1333, has: (i) => i.slot === "weapon" },
            { key: "armour", name: "Armour", icon: 1127, has: (i) => !!i.slot && armourSlots.includes(i.slot) },
            { key: "jewellery", name: "Jewellery and capes", icon: 1704, has: (i) => i.slot === "neck" || i.slot === "ring" || i.slot === "cape" },
            { key: "supplies", name: "Food and potions", icon: 379, has: (i) => !!i.heal || !!i.potion },
            { key: "ammo", name: "Arrows and runes", icon: 882, has: (i) => !!i.ammo },
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
        const fillGrid = () => {
            const ids = shown();
            grid.replaceChildren(
                ...ids.map((id) => {
                    const item = getItem(id);
                    const n = countOfKind(id);
                    return h(
                        "button",
                        {
                            class: "bank-slot" + (this.bankSelected === id ? " selected" : "") + (item.exclusive ? " exclusive" : ""),
                            title: `${item.name}${n > 1 ? ` x${formatCoins(n)}` : ""}: ${describe(item)}`,
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
            ...tabs.map((t) =>
                h(
                    "button",
                    {
                        class: "bank-tab" + (t.key === this.bankTab ? " active" : ""),
                        title: t.name,
                        onclick: () => {
                            this.bankTab = t.key;
                            render();
                        },
                    },
                    t.icon !== undefined ? iconElement(t.icon, t.name) : h("span", { class: "bank-tab-text" }, t.name),
                ),
            ),
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
            const typed = (): number => {
                const n = Math.floor(Number(this.itemAmount.replace(/[^0-9]/g, "")));
                return Number.isFinite(n) && n > 0 ? n : 0;
            };
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
            // The amount: typed, or a quick one, or all (only where there's
            // more than one to move)
            let amountRows: HTMLElement[] = [];
            if (have > 1 || packed > 1) {
                const amountInput = h("input", { type: "text", inputMode: "numeric", placeholder: "How many", value: this.itemAmount });
                amountInput.addEventListener("input", () => {
                    this.itemAmount = amountInput.value;
                    label();
                });
                const setAmount = (n: number) => {
                    this.itemAmount = n > 0 ? String(n) : "";
                    this.itemNote = "";
                    render();
                };
                const most = Math.max(have, packed);
                amountRows = [
                    h("div", { class: "coin-move" }, amountInput, ...buttons),
                    h(
                        "div",
                        { class: "coin-move" },
                        ...[1, 5, 10, 100].filter((n) => n < most).map((n) => h("button", { onclick: () => setAmount(n) }, String(n))),
                        h("button", { onclick: () => setAmount(0) }, "All"),
                    ),
                ];
            }
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
            detail = h("div", { class: "bank-detail empty" }, "Pick something in the bank to see it, and wear it or pack it for the next run.");
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
            "Deposit pack",
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
            "Deposit worn",
        );
        const kindsCount = kinds.length + (save.coins > 0 ? 1 : 0);

        this.showKeyed(
            "stash",
            h(
                "div",
                { class: "screen" },
                h("h2", {}, "Bank & gear"),
                h(
                    "div",
                    { class: "columns" },
                    h(
                        "div",
                        { class: "panel" },
                        h("h2", {}, "Worn"),
                        equipment,
                        h(
                            "div",
                            { class: "subtitle" },
                            `Max hit ${stats.damage} every ${stats.speed}s${styleNote(stats)} · defence vs melee ${stats.defenceVs.melee}, ranged ${stats.defenceVs.ranged}, magic ${stats.defenceVs.magic} · ${100 + stats.hp} hitpoints` +
                                prayerNote(stats) +
                                (stats.set ? ` · ${BARROWS_SETS[stats.set].name} set: ${SET_EFFECTS[stats.set]}` : ""),
                        ),
                        h("h2", {}, "Backpack for the next run"),
                        backpack,
                        h(
                            "div",
                            { class: "subtitle" },
                            `What's packed goes in with you. Extract and it comes home; die and it's gone. The pack takes ${FOOD_LIMIT} pieces of food at most, and ${AMMO_LIMITS.arrows} arrows and ${AMMO_LIMITS.runes} runes (every kind together). A bow shoots the best arrows packed; a staff casts the spell picked in its spellbook (B in a run), taking that spell's runes. Pick a thing in the bank to pack as many as you like; click a packed thing to bank it, or to say how many when there's more than one. Coins are packed from the bank's Coins.`,
                        ),
                        h("h2", {}, "Insurance"),
                        h(
                            "div",
                            { class: "subtitle" },
                            save.insured !== undefined
                                ? `Your ${getItem(save.insured).name.toLowerCase()} is insured for the next run: it comes home even if you don't. The fee is spent either way.`
                                : "Pay the guild a fifth of a piece's price to bring it home if you don't make it. One piece, worn or packed, for one run; the fee is spent either way.",
                        ),
                        h("div", { class: "item-list" }, ...insuranceRows),
                        insuranceRows.length === 0 ? h("div", { class: "subtitle" }, "Wear or pack some gear first.") : null,
                        h("h2", {}, "Repairs"),
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
                    h(
                        "div",
                        { class: "panel bank" },
                        h("h2", {}, `Bank (${kindsCount})`),
                        tabBar,
                        h("div", { class: "bank-tools" }, search, depositPack, depositWorn),
                        grid,
                        detail,
                        kindsCount === 0 ? h("div", { class: "subtitle" }, "Empty. Gear is found in the dungeon's chests.") : null,
                    ),
                ),
                h("button", { onclick: () => this.back() }, "Back"),
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
                            c.name = name.value.trim() || "Adventurer";
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
        const coins = h("div", { class: "floor" });
        const clock = h("div", { class: "clock" });
        const prompt = h("div", { class: "prompt", hidden: true });
        const inventory = h("div", { class: "inventory", hidden: true });
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
        const hudRoot = h(
                "div",
                { class: "hud" },
                touch?.zone,
                h(
                    "div",
                    { class: "top" },
                    h("div", { class: "bar" }, hp, hpLabel),
                    h("div", { class: "bar spec-bar" }, spec, specLabel),
                    h("div", { class: "bar prayer-bar" }, prayer, prayerLabel),
                    h("div", { class: "floor" }, `${run.world.name} · tier ${run.world.tier}${run.night ? " · night" : ""}${run.coop ? " · co-op" : ""}`),
                    coins,
                    clock,
                    party,
                ),
                boss,
                prompt,
                inventory,
                hotbar,
                minimap,
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
        hud.hpLabel.textContent = `${run.hp} / ${run.maxHp}`;
        const special = specialOf(run.stats.weapon);
        hud.spec.style.width = `${run.spec}%`;
        hud.specLabel.textContent = special ? `${special.name} ${Math.round(run.spec)}%` : "";
        hud.spec.parentElement?.classList.toggle("ready", run.specReady);
        hud.prayer.style.width = `${run.prayer}%`;
        hud.prayerLabel.textContent =
            run.protect === "none"
                ? `Prayer ${Math.round(run.prayer)}%${isTouch ? "" : " · Z melee X ranged C magic"}`
                : `Protect from ${run.protect} ${Math.round(run.prayer)}%`;
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
        hud.coins.textContent = `${formatCoins(run.coins)} coins · pack ${run.inventory.length}/${run.slots}` + ammoText;
        const left = run.timeLeft;
        hud.clock.textContent = run.closed
            ? "Way out closed"
            : `Way out closes in ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
        hud.clock.classList.toggle("urgent", run.closed || left < 60);
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
        if (hud.inventoryOpen) {
            const signature = JSON.stringify([run.inventory, run.equipment, hud.inventoryView, run.autocast]);
            if (signature !== hud.signature) {
                hud.signature = signature;
                if (hud.inventoryView === "spells") {
                    this.renderSpellbook(run);
                } else {
                    this.renderInventory(run);
                }
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
        const equipment = h(
            "div",
            { class: "equipment" },
            ...SLOTS.map((slot) => {
                const id = run.equipment[slot];
                const item = id !== undefined ? getItem(id) : undefined;
                return h(
                    "div",
                    {
                        class: "equip-slot",
                        title: item ? `${item.name}: ${describe(item)}. Click to take off.` : slot,
                        onclick: () => run.unequipSlot(slot as Slot),
                    },
                    item ? icon(item) : slot,
                );
            }),
        );
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
                        title: `${item.name} (${tierName(item.tier)}): ${describe(item)}. ${action} Right-click drops it.`,
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
                // A right click drops it, whatever the switch says
                slot.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    run.dropItem(stack.id, stack.count);
                });
                return slot;
            }),
        );
        const stats = run.stats;
        const weight = run.weight();
        hud.inventory.replaceChildren(
            this.packTabs(),
            h("h3", {}, "Worn"),
            equipment,
            h(
                "div",
                { class: "hint" },
                `Max hit ${stats.damage} every ${stats.speed}s${styleNote(stats)} · defence vs melee ${stats.defenceVs.melee}, ranged ${stats.defenceVs.ranged}, magic ${stats.defenceVs.magic}` +
                    prayerNote(stats) +
                    (weight > 0 ? ` · the gear in your pack slows you ${Math.round(weight * 100)}%` : ""),
            ),
            h(
                "div",
                { class: "row pack-head" },
                h("h3", {}, "Pack"),
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
        );
    }

    // The pack panel's two pages: the pack (I) and the spellbook (B)
    private packTabs(): HTMLElement {
        const hud = this.hud!;
        const tab = (view: "pack" | "spells", label: string, key: string) =>
            h(
                "button",
                {
                    class: "pack-tab" + (hud.inventoryView === view ? " on" : ""),
                    title: isTouch ? label : `${label} (${key})`,
                    onclick: () => {
                        hud.inventoryView = view;
                        hud.signature = "";
                        this.updateHud();
                    },
                },
                label,
            );
        return h("div", { class: "pack-tabs" }, tab("pack", "Pack", "I"), tab("spells", "Spellbook", "B"));
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
            return h(
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
                this.packTabs(),
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
        extras: { tasks: Task[]; insured?: number; grave?: boolean; graveHalved?: boolean; pet?: string },
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
                h("span", { class: "stats" }, `from ${getWorld(id).name}: ${petBuff(id)?.text ?? ""}${following ? " (following you)" : ""}`),
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
