// The crowns (version 60): the game's maker wears the owner's crown by
// their name on the title screen and in co-op lobbies, and over their head
// in a run, and their playtester the developer's crown (version 65), and
// nobody else can. A browser holds a key (given once by a link: the page
// opened with ?crown=<key> keeps it and drops it from the address), the key
// goes to the party with their loadout, and everyone's game checks it
// against the keys' SHA-256 here before drawing a crown: the keys
// themselves are in no build.
import * as THREE from "three";

import { assetUrl } from "./paths";

export type Crown = {
    // A 19 by 18 crown from an RSPS forum crown pack, grey with a jewel
    // and a letter in its colour
    image: string;
    // The word under it over a head, in the letter's colour
    word: string;
    color: string;
    alt: string;
};

// By the SHA-256 of the key
const CROWNS: Record<string, Crown> = {
    // The owner's: a blue jewel and an O
    "4e0f860e8d27645123e773042753a6cf8ad67908bf69c0a660d06809cbb539bd": {
        image: "ui/mod-crown.png",
        word: "Owner",
        color: "#00aeff",
        alt: "owner",
    },
    // The developer's: a green jewel and an S (the pack's mod crown, its M
    // redrawn)
    "355ef517371c4a0d44209d2ec6ce627ecfed14eabc61695fc7dd94ecc07ef6ca": {
        image: "ui/dev-crown.png",
        word: "Salmon Dev",
        color: "#14a214",
        alt: "developer",
    },
};

const CROWN_STORAGE = "dungeon-extraction-crown";

// A crowned player may colour their name (version 73): over their head, in
// the party, on the title screen. One of these, or the client's yellow.
export const DEFAULT_NAME_COLOR = "#ffff00";
export const NAME_COLORS: { name: string; color: string }[] = [
    { name: "Yellow", color: DEFAULT_NAME_COLOR },
    { name: "White", color: "#ffffff" },
    { name: "Red", color: "#ff3232" },
    { name: "Orange", color: "#ff981f" },
    { name: "Green", color: "#00ff00" },
    { name: "Cyan", color: "#00ffff" },
    { name: "Blue", color: "#6fa8ff" },
    { name: "Purple", color: "#c070ff" },
    { name: "Pink", color: "#ff80c8" },
    { name: "Gold", color: "#ffd700" },
];

// The colour a character's name is drawn in, when their browser's crown key
// has checked out and they picked one of the palette; else nothing (the
// default). Everyone's game checks, so only a crown colours a name.
export function nameColorOf(character: { nameColor?: string }, key: string | undefined): string | undefined {
    const color = character.nameColor;
    if (!color || color === DEFAULT_NAME_COLOR || !NAME_COLORS.some((c) => c.color === color) || !crownVerified(key)) {
        return undefined;
    }
    return color;
}

// The key this browser holds, if any
export function crownKey(): string | undefined {
    try {
        return localStorage.getItem(CROWN_STORAGE) ?? undefined;
    } catch {
        return undefined;
    }
}

// A key in the address (?crown=...) is kept, and the address cleaned;
// true when one was kept. With &home as well the address stays as it is:
// a home-screen icon made from the page then opens with the key every
// time (a phone's home-screen app has its own storage, apart from the
// browser's, so a key the browser holds doesn't reach it).
export function takeCrownFromUrl(): boolean {
    const params = new URLSearchParams(location.search);
    const key = params.get("crown");
    if (key === null) {
        return false;
    }
    let kept = false;
    try {
        if (key) {
            localStorage.setItem(CROWN_STORAGE, key);
            kept = true;
        } else {
            localStorage.removeItem(CROWN_STORAGE);
        }
    } catch {
        // No storage: no crown
    }
    if (params.has("home")) {
        return kept;
    }
    params.delete("crown");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
    return kept;
}

// Which crown a key is for, if any: known once checked (the check is a
// hash, so it takes a moment the first time; `then` is called when it's
// known)
const checked = new Map<string, Crown | null>();

export function crownVerified(key: string | undefined, then?: () => void): Crown | undefined {
    if (!key) {
        return undefined;
    }
    const known = checked.get(key);
    if (known !== undefined) {
        return known ?? undefined;
    }
    void hash(key).then((hex) => {
        checked.set(key, CROWNS[hex] ?? null);
        then?.();
    });
    return undefined;
}

async function hash(text: string): Promise<string> {
    try {
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
        return "";
    }
}

// The crown to sit in a line of text (the pixels kept sharp by the CSS)
export function crownIcon(crown: Crown): HTMLImageElement {
    const img = document.createElement("img");
    img.className = "crown";
    img.src = assetUrl(crown.image);
    img.alt = crown.alt;
    img.draggable = false;
    return img;
}

// The crown with its word under it in the letter's colour, as a sprite to
// float over a head in a run (drawn once per crown into a canvas and
// shared; the crown's pixels stay sharp, drawn four times over)
// Drawn at twice the size it shows, for a phone's screen
const SHEET_WIDTH = 256;
const SHEET_HEIGHT = 128;
const CROWN_SCALE = 4;
const WORD_SIZE = 40;
// How wide the sheet is in the world: the crown comes out a bit under a
// third of a tile across
export const CROWN_SHEET_WIDTH = 1;
export const CROWN_SHEET_HEIGHT = (CROWN_SHEET_WIDTH * SHEET_HEIGHT) / SHEET_WIDTH;
const textures = new Map<Crown, THREE.CanvasTexture>();

export function crownSprite(crown: Crown): THREE.Sprite {
    let texture = textures.get(crown);
    if (!texture) {
        texture = drawSheet(crown);
        textures.set(crown, texture);
    }
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false, fog: false }),
    );
    sprite.scale.set(CROWN_SHEET_WIDTH, CROWN_SHEET_HEIGHT, 1);
    sprite.renderOrder = 16;
    return sprite;
}

function drawSheet(crown: Crown): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_WIDTH;
    canvas.height = SHEET_HEIGHT;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.src = assetUrl(crown.image);
    // Drawn once the crown and the font are both here
    void Promise.all([
        new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
        }),
        document.fonts.load(`${WORD_SIZE}px 'OSRS Bold'`).catch(() => undefined),
    ]).then(() => {
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        const w = img.naturalWidth * CROWN_SCALE;
        const h = img.naturalHeight * CROWN_SCALE;
        if (w > 0) {
            ctx.drawImage(img, (SHEET_WIDTH - w) / 2, 4, w, h);
        }
        // A long word is drawn smaller so it fits
        let size = WORD_SIZE;
        ctx.font = `${size}px 'OSRS Bold', sans-serif`;
        while (size > 24 && ctx.measureText(crown.word).width > SHEET_WIDTH - 16) {
            size -= 2;
            ctx.font = `${size}px 'OSRS Bold', sans-serif`;
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.lineWidth = 8;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000";
        ctx.strokeText(crown.word, SHEET_WIDTH / 2, SHEET_HEIGHT - 10);
        ctx.fillStyle = crown.color;
        ctx.fillText(crown.word, SHEET_WIDTH / 2, SHEET_HEIGHT - 10);
        texture.needsUpdate = true;
    });
    return texture;
}
