// A crown's own pet (version 118): no boss's drop, its own NPC from the
// cache, given to that crown's characters alone (kit.ts's restoreCrownPets
// gives it, and takes it from any save without the crown). The owner's is
// Yami, Yama's pet (NPC 14203, idle 12140 and walk 12143); the playtester's
// Vorki (version 119). Apart from
// pets.ts so the tasks can ask about it without the three.js side.
import type { PetBuff } from "../game/pets";

export type CrownPet = { npcId: number; name: string; crown: string; from: string; buff: PetBuff };

export const CROWN_PETS: Record<string, CrownPet> = {
    yami: { npcId: 14203, name: "Yami", crown: "owner", from: "the owner's own", buff: { text: "your hits land 6% harder", damage: 0.06 } },
    // The playtester's (Salmon Dev's crown): Vorki, Vorkath's pet (NPC 8025,
    // idle 7948 and walk 7959; the rest of model 35023's skeleton's
    // animations are the boss's)
    vorki: { npcId: 8025, name: "Vorki", crown: "developer", from: "Salmon Dev's own", buff: { text: "your hits land 6% harder", damage: 0.06 } },
};

// A boss's pet, as against a crown's
export function isBossPet(id: string): boolean {
    return !(id in CROWN_PETS);
}
