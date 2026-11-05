// The character's look: body kit pieces and worn item pieces, each an
// animated model cut from the same full player model by the exporter, played
// together so they move as one. Body colours are applied by tinting the
// pieces' group_<n> materials.
import * as THREE from "three";

import { Slot, Stance, getItem } from "../content/items";
import { Actor, createActorFromUrl, play, worldLight } from "./assets";
import { assetUrl } from "./paths";
import { Equipment } from "./save";
import { addShadow } from "./shadows";

// The character's shadow, in tiles, before their height scale
const SHADOW_RADIUS = 0.45;

// The client's equipment slot for each of the game's slots (rings have no model)
export const EQUIP_SLOT: Record<Slot, number> = {
    head: 0,
    cape: 1,
    neck: 2,
    weapon: 3,
    body: 4,
    shield: 5,
    legs: 7,
    hands: 9,
    feet: 10,
    ring: -1,
};

// The slot each body part (hair, jaw, torso, arms, hands, legs, feet) fills
// when nothing is worn over it
export const BODY_PART_SLOTS = [8, 11, 4, 6, 9, 7, 10];
export const BODY_PART_NAMES = ["Hair", "Beard", "Torso", "Arms", "Hands", "Legs", "Feet"];
export const COLOR_GROUP_NAMES = ["Hair", "Torso", "Legs", "Feet", "Skin"];

// Character creation's default male look
export const DEFAULT_KITS = [0, 10, 18, 26, 33, 36, 42];
export const DEFAULT_COLORS = [0, 0, 0, 0, 0];

export type Look = { kits: number[]; colors: number[] };

export type KitInfo = { id: number; bodyPart: number; selectable: boolean };
type ItemPieceInfo = { slot: number; hides: number[] };
export type ColorChoice = { tint: number[]; swatch: string };
export type ColorTables = { groups: string[]; tables: ColorChoice[][] };

const jsonCache = new Map<string, Promise<unknown>>();

function fetchJson<T>(url: string): Promise<T | undefined> {
    let promise = jsonCache.get(url);
    if (!promise) {
        promise = fetch(url)
            .then((r) => (r.ok ? r.json() : undefined))
            .catch(() => undefined);
        jsonCache.set(url, promise);
    }
    return promise as Promise<T | undefined>;
}

export function loadKits(): Promise<KitInfo[]> {
    return fetchJson<KitInfo[]>(assetUrl("assets/player/kits.json")).then((kits) => kits ?? []);
}

// Every worn piece's slot and what it hides, in one file
function loadPieceInfos(): Promise<Record<string, ItemPieceInfo>> {
    return fetchJson<Record<string, ItemPieceInfo>>(assetUrl("assets/player/items.json")).then((infos) => infos ?? {});
}

export function loadColorTables(): Promise<ColorTables> {
    return fetchJson<ColorTables>(assetUrl("assets/player/colors.json")).then(
        (tables) => tables ?? { groups: [], tables: [[], [], [], [], []] },
    );
}

export function colorOf(tables: ColorTables, group: number, choice: number): THREE.Color {
    const rgb = tables.tables[group]?.[choice]?.tint ?? [1, 1, 1];
    return new THREE.Color(rgb[0], rgb[1], rgb[2]);
}

export class PlayerLook {
    readonly root = new THREE.Group();
    readonly pieces: Actor[] = [];
    // Where each piece came from, in the same order
    readonly urls: string[] = [];
    current?: string;
    height = 1.6;

    private constructor(
        readonly look: Look,
        private readonly tables: ColorTables,
    ) {}

    // Builds the look: worn items in their slots, body kits where nothing is
    // worn or hidden by what is
    static async create(look: Look, equipment: Equipment): Promise<PlayerLook> {
        const tables = await loadColorTables();
        const result = new PlayerLook(look, tables);

        // What's worn, and what it hides
        const worn = new Map<number, number>();
        for (const [slot, id] of Object.entries(equipment)) {
            const clientSlot = EQUIP_SLOT[slot as Slot];
            if (id !== undefined && clientSlot >= 0) {
                worn.set(clientSlot, id);
            }
        }
        const hidden = new Set<number>();
        const pieceInfos = await loadPieceInfos();
        const infos = [...worn.entries()].map(([slot, id]) => ({
            slot,
            id,
            info: pieceInfos[id] as ItemPieceInfo | undefined,
        }));
        for (const { info } of infos) {
            for (const h of info?.hides ?? []) {
                hidden.add(h);
            }
        }
        // A two handed weapon hides the shield slot
        if (worn.has(3) && getItem(worn.get(3)!).twoHanded) {
            worn.delete(5);
        }

        const urls: string[] = [];
        for (let slot = 0; slot < 12; slot++) {
            const wornHere = infos.find((i) => i.slot === slot);
            if (wornHere) {
                if (wornHere.info) {
                    urls.push(assetUrl(`assets/player/items/${wornHere.id}.glb`));
                }
                continue;
            }
            if (hidden.has(slot)) {
                continue;
            }
            const bodyPart = BODY_PART_SLOTS.indexOf(slot);
            if (bodyPart !== -1 && look.kits[bodyPart] !== undefined && look.kits[bodyPart] !== -1) {
                urls.push(assetUrl(`assets/player/kits/${look.kits[bodyPart]}.glb`));
            }
        }
        const actors = await Promise.all(
            urls.map((url) => createActorFromUrl(url).catch(() => undefined)),
        );
        actors.forEach((actor, i) => {
            if (actor) {
                result.pieces.push(actor);
                result.urls.push(urls[i]);
                result.root.add(actor.root);
                result.height = Math.max(result.height, actor.height);
            }
        });
        result.restore();
        result.play("idle");
        addShadow(result.root, SHADOW_RADIUS);
        return result;
    }

    // How the weapon in hand is held: idle and run have a clip per stance.
    // A look starts its idle as it's made, before anyone says what's in
    // hand, so a new stance plays the idle or run again in it (else the
    // plain idle held until the first step)
    private held?: Stance;

    get stance(): Stance | undefined {
        return this.held;
    }

    set stance(stance: Stance | undefined) {
        if (stance === this.held) {
            return;
        }
        this.held = stance;
        const now = this.current;
        if (now === "idle" || now === "run") {
            this.current = undefined;
            this.play(now);
        }
    }

    play(name: string, options: { once?: boolean; speed?: number } = {}): number {
        if (this.current === name && !options.once) {
            return 0;
        }
        const clip = this.stanceClip(name);
        let length = 0;
        for (const piece of this.pieces) {
            piece.current = undefined;
            length = Math.max(length, play(piece, clip, options));
        }
        this.current = name;
        return length;
    }

    private stanceClip(name: string): string {
        if (!this.stance || (name !== "idle" && name !== "run")) {
            return name;
        }
        const wanted = `${name}_${this.stance}`;
        return this.has(wanted) ? wanted : name;
    }

    has(name: string): boolean {
        return this.pieces.some((p) => p.clips.has(name));
    }

    update(dt: number): void {
        for (const piece of this.pieces) {
            piece.mixer.update(dt);
        }
    }

    // Body colours on the colour groups, white on the rest, under the
    // world's light (the night's blue on a night run)
    restore(): void {
        for (const piece of this.pieces) {
            for (const m of piece.materials) {
                const group = /^group_(\d)/.exec(m.name);
                if (group) {
                    const g = Number(group[1]) - 1;
                    m.color.copy(colorOf(this.tables, g, this.look.colors[g] ?? 0)).multiply(worldLight);
                } else {
                    m.color.copy(worldLight);
                }
            }
        }
    }

    // A flat tint over everything, for the hurt flash
    flash(color: THREE.Color): void {
        for (const piece of this.pieces) {
            for (const m of piece.materials) {
                m.color.copy(color).multiply(worldLight);
            }
        }
    }
}
