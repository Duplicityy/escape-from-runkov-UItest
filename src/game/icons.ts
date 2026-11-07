// Item icons come from one sheet (scripts/icon-sheet.mjs packs every
// public/assets/items/<id>.png into assets/items.png, with items.json saying
// where each sits): one request for all of them instead of one a slot,
// fetched with retries, so a slow host can't leave a broken image in the
// pack. The interface draws an icon as a span showing its cell of a lifted
// copy of the sheet, made in a canvas (version 99; version 90 fetched
// items-lit.png, and before that index.html's SVG filter did the lift in
// the browser, where Safari drew some icons plain white); an item on the
// ground gets a texture cut from the unlifted sheet. If the sheet never
// comes, the icons fall back to their own files, each lifted the same way.
import * as THREE from "three";

import { ITEM_BY_ID, TIER_COLOURS, iconUrl, tierGlows } from "../content/items";
import { loadTexture } from "./assets";
import { assetUrl } from "./paths";

export const ICON_WIDTH = 36;
export const ICON_HEIGHT = 32;

type SheetIndex = { w: number; h: number; cols: number; ids: number[] };
type Sheet = SheetIndex & { image: HTMLImageElement; at: Map<number, number>; texture: THREE.Texture };

let sheet: Sheet | undefined;
// The lifted sheet the interface shows (the texture is cut from items.png)
let sheetUrl = "";
let failed = false;
// Seconds between tries, then the fallback
const RETRY_WAITS = [1000, 3000, 8000];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchIndex(): Promise<SheetIndex> {
    const response = await fetch(assetUrl("assets/items.json"));
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    return (await response.json()) as SheetIndex;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("The icon sheet didn't load"));
        image.src = url;
    });
}

// An asset's address in full: a relative one in an element's style would
// do, but one in a stylesheet variable is read against the stylesheet's
// own folder, which in a build is assets/, not the page's (so icons went
// looking for assets/assets/items.png on itch)
function absolute(path: string): string {
    return new URL(path, document.baseURI).href;
}

// The lift: an exponent of 0.625 on each sRGB channel, as
// scripts/icon-sheet.mjs does for items-lit.png
const LIFT = new Uint8Array(256).map((_, c) => Math.round(255 * Math.pow(c / 255, 0.625)));

// An image lifted in a canvas, as a URL for a background (version 99: no
// browser filter at all now; index.html's SVG one was left for the icons
// when the sheet never came, and Safari drew some through it plain white).
// Undefined if the canvas can't do it.
async function liftedUrl(image: HTMLImageElement): Promise<string | undefined> {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
            return undefined;
        }
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = LIFT[data[i]];
            data[i + 1] = LIFT[data[i + 1]];
            data[i + 2] = LIFT[data[i + 2]];
        }
        context.putImageData(pixels, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        return blob ? URL.createObjectURL(blob) : undefined;
    } catch {
        return undefined;
    }
}

// The sheet, tried a few times before giving up on it. The lifted copy the
// interface shows is made here from items.png (version 99), so there's one
// file to fetch, not two; items-lit.png is only for a browser whose canvas
// can't.
export async function loadIconSheet(): Promise<void> {
    const url = absolute(assetUrl("assets/items.png"));
    const litUrl = absolute(assetUrl("assets/items-lit.png"));
    for (let attempt = 0; ; attempt++) {
        try {
            const retry = attempt > 0 ? `?retry=${attempt}` : "";
            const [index, image] = await Promise.all([fetchIndex(), loadImage(url + retry)]);
            let lit = await liftedUrl(image);
            if (!lit) {
                await loadImage(litUrl + retry);
                lit = litUrl + retry;
            }
            const texture = new THREE.Texture(image);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            sheet = { ...index, image, at: new Map(index.ids.map((id, i) => [id, i])), texture };
            sheetUrl = lit;
            break;
        } catch (e) {
            if (attempt >= RETRY_WAITS.length) {
                console.warn("Item icons: the sheet never came; each icon loads on its own", e);
                failed = true;
                document.documentElement.classList.add("no-icon-sheet");
                break;
            }
            await wait(RETRY_WAITS[attempt]);
        }
    }
    // Icons drawn before the sheet came, or that need the fallback
    for (const el of document.querySelectorAll<HTMLElement>("[data-icon]")) {
        placeIcon(el);
    }
}

// Each icon's own file lifted, once a session
const liftedIcons = new Map<number, Promise<string | undefined>>();

function liftedIcon(id: number): Promise<string | undefined> {
    let lifted = liftedIcons.get(id);
    if (!lifted) {
        lifted = loadImage(absolute(iconUrl(id)))
            .then(liftedUrl)
            .catch(() => undefined);
        liftedIcons.set(id, lifted);
    }
    return lifted;
}

// Where an icon's cell is on the sheet, as a background position
function placeIcon(el: HTMLElement): void {
    const id = Number(el.dataset.icon);
    if (!el.dataset.icon || Number.isNaN(id)) {
        el.style.backgroundImage = "none";
        return;
    }
    if (!sheet && !failed) {
        // Blank until the sheet comes; loadIconSheet fills it in then
        el.style.backgroundImage = "none";
        return;
    }
    if (failed || !sheet || !sheet.at.has(id)) {
        // Its own file, lifted in a canvas once it's here (unlifted till then)
        el.style.backgroundImage = `url("${absolute(iconUrl(id))}")`;
        el.style.backgroundSize = `${ICON_WIDTH}px ${ICON_HEIGHT}px`;
        el.style.backgroundPosition = "0 0";
        void liftedIcon(id).then((lifted) => {
            if (lifted && el.dataset.icon === String(id)) {
                el.style.backgroundImage = `url("${lifted}")`;
            }
        });
        return;
    }
    const i = sheet.at.get(id)!;
    el.style.backgroundImage = `url("${sheetUrl}")`;
    el.style.backgroundSize = `${sheet.image.width}px ${sheet.image.height}px`;
    el.style.backgroundPosition = `${-(i % sheet.cols) * sheet.w}px ${-Math.floor(i / sheet.cols) * sheet.h}px`;
}

// An icon in the interface; a piece of gear glows its tier's colour
// (version 136), and a right click on any item's opens its stats (ui.ts)
export function iconElement(id: number, name = ""): HTMLElement {
    const el = document.createElement("span");
    el.className = "icon-sprite";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", name);
    const item = ITEM_BY_ID.get(id);
    if (item) {
        el.dataset.item = String(id);
    }
    if (tierGlows(item)) {
        el.classList.add("tier-glow");
        el.style.setProperty("--tier", TIER_COLOURS[item.tier] ?? TIER_COLOURS[1]);
    }
    setIcon(el, id);
    return el;
}

// Changes which icon an element shows, or clears it
export function setIcon(el: HTMLElement, id: number | undefined): void {
    if (id === undefined) {
        delete el.dataset.icon;
        el.style.backgroundImage = "none";
        return;
    }
    el.dataset.icon = String(id);
    placeIcon(el);
}

// An icon as a texture for a sprite in the world: its cell of the sheet,
// or its own file while the sheet isn't here
export function iconTexture(id: number): THREE.Texture {
    const i = sheet?.at.get(id);
    if (!sheet || i === undefined) {
        return loadTexture(iconUrl(id));
    }
    const texture = sheet.texture.clone();
    const sw = sheet.image.width;
    const sh = sheet.image.height;
    texture.repeat.set(sheet.w / sw, sheet.h / sh);
    // Texture space starts at the bottom; the sheet's rows start at the top
    texture.offset.set(((i % sheet.cols) * sheet.w) / sw, 1 - ((Math.floor(i / sheet.cols) + 1) * sheet.h) / sh);
    texture.needsUpdate = true;
    return texture;
}
