// The daily contract (version 115): one job a day on the title screen, made
// from the day's date and the maps the character has open, paid once in
// coins and a clue scroll when a run does it. A run's attempt is what it
// did towards it; only an escape from the contract's map counts.
import { CLUE_SCROLL, formatCoins } from "../content/items";
import { WORLDS, WORLD_BY_ID, WorldDef, mapUnlocked } from "../content/worlds";
import type { RunResult } from "./run";
import type { SaveData } from "./save";

export type ContractKind = "haul" | "kills" | "chests" | "boss";

export type Contract = {
    day: number;
    kind: ContractKind;
    world: WorldDef;
    // What a run has to reach, and what it pays
    target: number;
    reward: number;
    rewardItem: number;
    text: string;
};

const DAY_MS = 86_400_000;
// A run's takings grow 2.2 times a tier, as the purses do (run.ts's ferryFee)
const TIER_GROWTH = 2.2;
const HAUL_BASE = 600;
const REWARD_BASE = 400;

export function contractDay(now = Date.now()): number {
    return Math.floor(now / DAY_MS);
}

// Until the next contract, at midnight UTC
export function contractResetsIn(now = Date.now()): number {
    return (contractDay(now) + 1) * DAY_MS - now;
}

// The same day always rolls the same numbers
function dayRandom(day: number): () => number {
    let a = (day * 2654435761) >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const round = (n: number, to: number) => Math.max(to, Math.round(n / to) * to);

// Today's: on the newest map open or one of the two before it, picked the
// first time it's looked at today and kept (a map opening later in the day
// doesn't change it)
export function todaysContract(save: SaveData, now = Date.now()): Contract {
    const day = contractDay(now);
    const random = dayRandom(day);
    const open = WORLDS.filter((w) => mapUnlocked(save.stats.mapsBeaten, w.id));
    const near = open.slice(-3);
    const rolled = near[Math.floor(random() * near.length)] ?? WORLDS[0];
    const kept = save.contract?.day === day ? WORLD_BY_ID.get(save.contract.map) : undefined;
    const world = kept ?? rolled;
    if (!kept) {
        save.contract = { day, map: world.id, best: 0, done: false };
    }
    const kinds: ContractKind[] = ["haul", "haul", "kills", "chests", "boss"];
    const kind = kinds[Math.floor(random() * kinds.length)];
    const growth = Math.pow(TIER_GROWTH, world.tier - 1);
    const reward = round(REWARD_BASE * growth, 50);
    let target: number;
    let text: string;
    switch (kind) {
        case "haul":
            target = round(HAUL_BASE * growth * (0.8 + random() * 0.4), 50);
            text = `Escape ${world.name} carrying ${formatCoins(target)} coins of loot.`;
            break;
        case "kills":
            target = 15 + 5 * world.tier + Math.floor(random() * 10);
            text = `Kill ${target} enemies on ${world.name} in one run, and escape.`;
            break;
        case "chests":
            target = 3 + world.tier;
            text = `Open ${target} chests on ${world.name} in one run, and escape.`;
            break;
        case "boss":
            target = 1;
            text = `Slay ${world.boss.name} on ${world.name} and escape.`;
            break;
    }
    return { day, kind, world, target, reward, rewardItem: CLUE_SCROLL, text };
}

// What a run did towards it: nothing unless it escaped from the map
export function contractAttempt(contract: Contract, result: RunResult, haul: number): number {
    if (result.kind !== "extracted" || result.world.id !== contract.world.id) {
        return 0;
    }
    switch (contract.kind) {
        case "haul":
            return Math.max(0, haul);
        case "kills":
            return result.report.kills;
        case "chests":
            return result.report.chestsOpened;
        case "boss":
            return result.report.bossKills > 0 ? 1 : 0;
    }
}

// The save's progress on today's (a new day starts again from nothing)
export function contractProgress(save: SaveData, contract: Contract): { best: number; done: boolean } {
    const kept = save.contract;
    return kept && kept.day === contract.day ? { best: kept.best, done: kept.done } : { best: 0, done: false };
}

// A run's attempt, kept; true when it's the one that did it (and pays)
export function recordAttempt(save: SaveData, result: RunResult, haul: number, now = Date.now()): Contract | undefined {
    const contract = todaysContract(save, now);
    const progress = contractProgress(save, contract);
    const attempt = contractAttempt(contract, result, haul);
    const done = progress.done || attempt >= contract.target;
    save.contract = { day: contract.day, map: contract.world.id, best: Math.max(progress.best, attempt), done };
    return done && !progress.done ? contract : undefined;
}
