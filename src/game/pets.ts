// Pets: a boss drops one now and then, a small copy of itself that follows
// you about on runs and stands by you in the guild's courtyard. A pet is
// kept whatever happens to you out there; the Tasks screen picks which one
// comes along, and the one that does gives you a small gift of its boss's
// (PET_BUFFS; run.ts applies them).
import * as THREE from "three";

import { getWorld } from "../content/worlds";
import { Actor, createActor, play, tint } from "./assets";
import { GearStats } from "./inventory";
import { addShadow } from "./shadows";

// One boss in this many drops its pet
export const PET_ONE_IN = 8;
// How tall a pet stands, in tiles
const PET_HEIGHT = 0.9;

export function petName(worldId: string): string {
    return `Little ${getWorld(worldId).boss.name.toLowerCase()}`;
}

// What a pet does for you while it follows, one small thing each, after
// its boss: the Tasks screen says it in `text`
export type PetBuff = {
    text: string;
    // A share onto the max hit
    damage?: number;
    // Your hits never roll below this share of the max
    floor?: number;
    // A share faster special bar
    spec?: number;
    // A share onto every defence
    defence?: number;
    // The chance a shot takes no arrow or rune
    ammoSave?: number;
    // Max hitpoints
    hp?: number;
    // Hitpoints off every real hit taken
    soak?: number;
    // A share faster walking
    speed?: number;
    // Catching your breath this many times as fast
    regen?: number;
    // A share more coins from kills
    coins?: number;
    // The share of a boss's burning floor you take
    burn?: number;
    // Prayer bonus
    prayer?: number;
};

export const PET_BUFFS: Record<string, PetBuff> = {
    // The Wise Old Man: prayer
    lumbridge: { text: "+6 prayer bonus", prayer: 6 },
    // Verac: hits that always find their mark
    barrows: { text: "your hits never roll below a third of the max", floor: 1 / 3 },
    // The Chaos Fanatic: special attacks
    wilderness: { text: "the special bar fills 20% faster", spec: 0.2 },
    // The Kalphite Queen: a hard shell
    desert: { text: "6% more defence", defence: 0.06 },
    // Dagannoth Prime: spells
    fremennik: { text: "one shot in five takes no arrow or rune", ammoSave: 0.2 },
    // TzTok-Jad: hitpoints
    karamja: { text: "8 more hitpoints", hp: 8 },
    // Skotizo: a demon's hide
    kourend: { text: "every hit on you does 1 less", soak: 1 },
    // The Javelin Colossus: long strides
    varlamore: { text: "you walk 5% faster", speed: 0.05 },
    // Sotetseg: the maze's rest
    morytania: { text: "you catch your breath twice as fast", regen: 2 },
    // K'ril Tsutsaroth: a demon's strength
    god_wars: { text: "your hits land 5% harder", damage: 0.05 },
    // The Corrupted Hunllef: the gauntlet's loot
    prifddinas: { text: "kills drop 15% more coins", coins: 0.15 },
    // JalTok-Jad: born in the fire
    inferno: { text: "a boss's burning floor does you half", burn: 0.5 },
};

export function petBuff(worldId: string | undefined): PetBuff | undefined {
    return worldId !== undefined ? PET_BUFFS[worldId] : undefined;
}

// The buff's part in the gear's numbers (the rest is run.ts's, as the
// moments come)
export function applyPetStats(stats: GearStats, buff: PetBuff | undefined): void {
    if (!buff) {
        return;
    }
    if (buff.damage) {
        stats.damage = Math.max(1, Math.round(stats.damage * (1 + buff.damage)));
    }
    if (buff.defence) {
        stats.defence = Math.round(stats.defence * (1 + buff.defence));
        stats.defenceVs.melee = Math.round(stats.defenceVs.melee * (1 + buff.defence));
        stats.defenceVs.ranged = Math.round(stats.defenceVs.ranged * (1 + buff.defence));
        stats.defenceVs.magic = Math.round(stats.defenceVs.magic * (1 + buff.defence));
    }
    stats.hp += buff.hp ?? 0;
    stats.prayer += buff.prayer ?? 0;
}

// The boss's own model, shrunk to a pet, standing idle
export async function createPet(worldId: string): Promise<Actor> {
    const actor = await createActor("npcs", getWorld(worldId).boss.npcId);
    const scale = petScale(actor);
    actor.root.scale.setScalar(scale);
    tint(actor, new THREE.Color(1, 1, 1));
    play(actor, "idle");
    // A small shadow, whatever the model's own scale
    addShadow(actor.root, 0.35 / scale);
    return actor;
}

// The scale that stands the model PET_HEIGHT tall, within reason
function petScale(actor: Actor): number {
    return Math.min(1, Math.max(0.12, PET_HEIGHT / Math.max(0.5, actor.height)));
}
