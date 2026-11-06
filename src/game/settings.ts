// Settings for how the game sounds and looks. They're this browser's, not
// the character's, so they live apart from the save and stay out of save
// codes.
export type Settings = {
    // Sound volume, 0 to 1, the music's, and whether sound is off altogether
    volume: number;
    music: number;
    muted: boolean;
    // The camera circles the character behind the guild's screens
    menuSpin: boolean;
    // How far off the camera stands in a run; the mouse wheel changes it too
    zoom: number;
    // Health bars over enemies that are fighting or hurt
    healthBars: boolean;
    // How bright the world is drawn: 1 is the client's normal, more is
    // brighter, the way its brightness option works (a gamma lift)
    brightness: number;
    // The title screen's layout: the rooms down a rail on the right, or a
    // character card with a grid of rooms (phones always get the rail)
    menuLayout: MenuLayout;
    // A phone's stick: under the thumb wherever it lands on the left (off),
    // or always in the ring at the bottom left (on)
    fixedStick: boolean;
    // How big the hotbar is drawn in a run, 1 the old size (version 96:
    // on a 1440p or 4K screen its keys were too small to read)
    hotbarSize: number;
    // The chat box (version 105) open, or folded to its bar
    chatOpen: boolean;
    // The version whose title screens these settings have seen (114 on):
    // before it, "rail" was only ever the default, never a choice
    layoutVersion: number;
};

// "osrs" (version 114, the default): the character's card with what they wear
// on the left, the rooms down the right, the way back in along the bottom
export type MenuLayout = "osrs" | "rail" | "card";
export const MENU_LAYOUTS: MenuLayout[] = ["osrs", "rail", "card"];

// How far the camera goes in and out
export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 1.4;
export const BRIGHTNESS_MIN = 0.7;
export const BRIGHTNESS_MAX = 1.8;
export const HOTBAR_MIN = 1;
export const HOTBAR_MAX = 2.5;

// Until it's set, the hotbar starts bigger on a tall screen: 1 up to 800
// pixels high, growing with it, at most 2
function defaultHotbar(): number {
    try {
        return Math.min(2, Math.max(HOTBAR_MIN, Math.round((window.innerHeight / 800) * 10) / 10));
    } catch {
        return 1;
    }
}

function coarsePointer(): boolean {
    try {
        return window.matchMedia("(pointer: coarse)").matches;
    } catch {
        return false;
    }
}

// The hotbar's size, for the stylesheet (style.css's --hotbar)
export function applyHotbarSize(): void {
    try {
        document.documentElement.style.setProperty("--hotbar", String(settings.hotbarSize));
    } catch {
        // No page to set it on
    }
}

const KEY = "dungeon-extraction-settings";

// The menu camera stands still for anyone who's asked their system for less motion
function defaults(): Settings {
    let reducedMotion = false;
    try {
        reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
        // No window to ask
    }
    return {
        volume: 0.6,
        music: 0.4,
        muted: false,
        menuSpin: !reducedMotion,
        zoom: 1,
        healthBars: true,
        brightness: 1.3,
        menuLayout: "osrs",
        fixedStick: false,
        hotbarSize: defaultHotbar(),
        // Open on a computer; folded on a phone, where the screen is small
        chatOpen: !coarsePointer(),
        layoutVersion: 114,
    };
}

function load(): Settings {
    const s = defaults();
    try {
        const raw = localStorage.getItem(KEY);
        const data = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
        if (typeof data.volume === "number") {
            s.volume = Math.min(1, Math.max(0, data.volume));
        }
        if (typeof data.music === "number") {
            s.music = Math.min(1, Math.max(0, data.music));
        }
        if (typeof data.zoom === "number") {
            s.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, data.zoom));
        }
        if (typeof data.brightness === "number") {
            s.brightness = Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, data.brightness));
        }
        if (typeof data.hotbarSize === "number") {
            s.hotbarSize = Math.min(HOTBAR_MAX, Math.max(HOTBAR_MIN, data.hotbarSize));
        }
        for (const key of ["muted", "menuSpin", "healthBars", "fixedStick", "chatOpen"] as const) {
            if (typeof data[key] === "boolean") {
                s[key] = data[key];
            }
        }
        // A "rail" saved before version 114 was the old default, so it moves
        // to the new one once; the card was picked, and stays
        const old = typeof data.layoutVersion !== "number" && data.menuLayout === "rail";
        if (data.menuLayout && MENU_LAYOUTS.includes(data.menuLayout) && !old) {
            s.menuLayout = data.menuLayout;
        }
    } catch {
        // Unreadable: the defaults
    }
    return s;
}

// The one copy everything reads. Change it, then saveSettings().
export const settings: Settings = load();
applyHotbarSize();

export function saveSettings(): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // Storage can be off; the settings then last the session
    }
}
