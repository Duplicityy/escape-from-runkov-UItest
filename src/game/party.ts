// What goes between the host's run and the guests' during a co-op run
// (coop.ts carries it; run.ts sends and reads it). The host's browser runs
// the map: every enemy, drop, chest and hit is decided there. A guest's
// browser runs its own character (walking, swinging, eating, the pack) and
// mirrors everything else from what the host sends.
//
// Down (host to every guest, through the relay's "down"): a snapshot of
// what moves at SNAPSHOT_HZ, and events for the rest. Up (a guest to the
// host, "up"): where the guest is at the same rate, and what it did.
// Positions are rounded to a hundredth of a tile; the snapshot is a few
// KB a second a party.
import { ProtectStyle } from "./run";
import { Equipment } from "./save";

export const SNAPSHOT_HZ = 15;
// An idle enemy that hasn't moved is still sent every this many snapshots
export const KEYFRAME_EVERY = 12;
// Enemies this far from every hero aren't in the snapshot (they're sent
// when they come near), and at most this many go in one snapshot, the
// nearest first (the rest wait for the next): with the relay allowing a
// host 64 KB a second, the snapshot has to stay a few KB
export const SNAPSHOT_RANGE = 28;
export const SNAPSHOT_MAX_ENEMIES = 36;
// The host waits this long for guests to load before the run goes on
export const LOAD_WAIT_SECONDS = 30;

// What a hero's doing, for the others' copy of them: standing, running,
// swinging, or dying
export type HeroAnim = 0 | 1 | 2 | 3;
export const HERO_IDLE = 0;
export const HERO_RUN = 1;
export const HERO_ATTACK = 2;
export const HERO_DEATH = 3;

// What an enemy's playing, for the guests' copy
export type EnemyClip = 0 | 1 | 2 | 3;
export const CLIP_IDLE = 0;
export const CLIP_WALK = 1;
export const CLIP_ATTACK = 2;
export const CLIP_DEATH = 3;

// An enemy's state: idle, chasing, attacking, fleeing, dead
export type EnemyState = 0 | 1 | 2 | 3 | 4;
export const STATE_CODES = { idle: 0, chase: 1, attack: 2, flee: 3, dead: 4 } as const;
export const STATE_NAMES = ["idle", "chase", "attack", "flee", "dead"] as const;

// A hero in a snapshot: id, x, z, facing, hp, max hp, anim, attack count,
// dead, and (version 103) the protection prayer they have on, for its icon
// over their head
export type HeroState = [string, number, number, number, number, number, HeroAnim, number, 0 | 1, PrayCode?];

// A protection prayer as a code: none, melee, ranged, magic
export type PrayCode = 0 | 1 | 2 | 3;
export const PRAY_NAMES = ["none", "melee", "ranged", "magic"] as const;
export function prayCode(style: (typeof PRAY_NAMES)[number]): PrayCode {
    return PRAY_NAMES.indexOf(style) as PrayCode;
}

// An enemy in a snapshot: uid, x, z, facing, hp, clip, attack count, state
export type EnemyShot = [number, number, number, number, number, EnemyClip, number, EnemyState];

// Everything a guest needs to draw an enemy, sent once with its spawn
export type EnemyDefLite = {
    npc: number;
    name: string;
    hp: number;
    radius: number;
    scale?: number;
    boss?: 1;
    champion?: 1;
    shoots?: "magic" | "ranged";
};

export type Snapshot = {
    k: "s";
    // The run's clock, and how long the way out has left
    t: number;
    left: number;
    // Bit 0 the map's awake, bit 1 the way out has closed
    f: number;
    h: HeroState[];
    e: EnemyShot[];
};

export type DownMessage =
    | Snapshot
    // The map as the host laid it out, once the host's loaded
    | {
          k: "world";
          // The ways out
          exits: [number, number][];
          // x, z, kind: 0 a chest, 1 the boss's golden one, 2 the vault
          chests: [number, number, 0 | 1 | 2][];
          trader?: [number, number, number];
          // The genie beside the spawn: x, z, which way he faces
          ferry?: [number, number, number];
          defs: EnemyDefLite[];
          spawns: SpawnMessage[];
      }
    | SpawnMessage
    // An enemy's colour changed: enraged (1), reborn (2), or back to its own (0)
    | { k: "tint"; u: number; c: 0 | 1 | 2 }
    // Something dropped, and something picked up (given to `to`, if anyone)
    | { k: "drop"; u: number; i: number; n: number; x: number; z: number }
    // n of it, when only part was taken (version 100): `left` stays on the ground
    | { k: "taken"; u: number; to?: string; n?: number; left?: number }
    // A chest opened (by whom, for their count of vaults)
    | { k: "opened"; c: number; by: string }
    // A patch of ground about to hurt
    | { k: "hazard"; x: number; z: number; r: number; l: number }
    // An enemy's shot at a hero, from here, and a hero's at an enemy
    | { k: "shot"; x: number; z: number; y: number; to: string; p: number; i?: number; c?: number }
    // s: the spell's id, for its cast animation and sounds (version 108)
    | { k: "pshot"; from: string; u: number; p?: number; i?: number; s?: string }
    // A hit on a guest, as the host rolled it (the guest halves it with its
    // own protection)
    | { k: "hurt"; to: string; hit: number; style: ProtectStyle; pierce?: 1; fixed?: 1; by: string; venom?: 1 }
    // An enemy fell: who killed it, and what it was
    | { k: "kill"; u: number; by: string; boss?: 1; champion?: 1 }
    // A word for everyone, or for one
    | { k: "msg"; text: string; to?: string }
    // A hero's worn gear changed (the host's own, or a guest's passed on),
    // so everyone draws them in it (version 72)
    | { k: "gear"; id: string; e: Equipment }
    // Everyone's loaded: the clock starts
    | { k: "go" }
    // A hero who was down is revived, by whom (version 76): that hero
    // stands up
    | { k: "revive"; id: string; by: string }
    // A hero's out of the run, one way or another
    | { k: "gone"; id: string; how: "extracted" | "died" | "left" }
    // Coins found in a party that splits its loot (version 115): who found
    // how many, and each hero's share of them
    | { k: "share"; by: string; n: number; s: [string, number][] }
    // The host's run is over
    | { k: "over" };

// An enemy appearing: its number, its def's place in the table (with the
// def itself when it's one the table didn't have at the start), where, which
// way it faces, its elite trait, and whether it carries the vault's key
export type SpawnMessage = {
    k: "spawn";
    u: number;
    d: number;
    x: number;
    z: number;
    f: number;
    t?: string;
    key?: 1;
    def?: EnemyDefLite;
};

export type UpMessage =
    // Where the guest is: x, z, facing, hp, max hp, anim, attack count,
    // defence against melee, ranged and magic, dead
    // p: the protection prayer on (version 103)
    | { k: "move"; x: number; z: number; f: number; hp: number; mh: number; a: HeroAnim; ac: number; d: [number, number, number]; dead: 0 | 1; p?: PrayCode }
    // A hit on an enemy; slow and stall are Ahrim's and Torag's; frz, wk and
    // psn an Ancient spell's freeze seconds, weaken share and poison per hit
    // (version 107)
    | { k: "hit"; u: number; d: number; slow?: 1; stall?: 1; frz?: number; wk?: number; psn?: number }
    | { k: "shot"; u: number; p?: number; i?: number; s?: string }
    // n: as many as the guest has room for, when that's not all of it
    | { k: "take"; u: number; n?: number }
    // Something put down from the pack, here, for anyone to take
    | { k: "drop"; i: number; n: number; x: number; z: number }
    | { k: "open"; c: number }
    | { k: "dig"; x: number; z: number }
    // Holding E at the way out: what's near hears it
    | { k: "wake"; x: number; z: number }
    // The guest's worn gear changed
    | { k: "gear"; e: Equipment }
    // The guest held E beside this downed hero long enough
    | { k: "revive"; id: string }
    | { k: "loaded" }
    | { k: "gone"; how: "extracted" | "died" | "left" };

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

// A tenth of a tile: enough for something eased along every frame
export function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

export function isDown(message: unknown): message is DownMessage {
    return typeof message === "object" && message !== null && typeof (message as { k?: unknown }).k === "string";
}

export function isUp(message: unknown): message is UpMessage {
    return isDown(message);
}
