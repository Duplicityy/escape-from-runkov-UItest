// The test characters' kit: a crowned browser's second character (save.ts's
// slots) is for trying things, so it keeps every item in the game in its
// stash, for good (version 82; version 80 gave the owner's a Saradomin rune
// set and godsword, which this includes). Only a browser holding a crown key
// (crown.ts), the owner's or the playtester's, playing its second character,
// has it. Whatever of it is short, worn, packed and stashed together, is
// topped back up in the stash whenever the save is looked at (the page
// opening, a run ending), unworn, so a death, a drop or a meal costs nothing
// of it; it can't be sold, and it stays out of gravestones so coming back
// doesn't make two.
import { AMMO_LIMITS, ANKOU, COINS, FOOD_LIMIT, GILDED, GUTHIX_SUNFIRE, ITEMS, ItemDef, RED_GHOSTLY, SANGUINE_TORVA } from "../content/items";
import { CROWN_PETS } from "../content/crownpets";
import { crownKey, crownKnown, crownVerified } from "./crown";
import { addItem, countOf } from "./inventory";
import { SaveData, loadedSlot } from "./save";

const TEST_SLOT = 1;
const POTIONS_KEPT = 10;

// How many of a thing the kit keeps: a pack's worth of food and of each
// arrow and rune, ten of each potion, one of everything else. Nothing of
// what's no use off a map (coins, clue scrolls, keys).
function keptCount(item: ItemDef): number {
    if (item.id === COINS || item.clue || item.key || item.bossKey) {
        return 0;
    }
    if (item.heal) {
        return FOOD_LIMIT;
    }
    if (item.ammo) {
        return AMMO_LIMITS[item.ammo];
    }
    if (item.potion) {
        return POTIONS_KEPT;
    }
    return 1;
}

// Every test character's kit, and the owner's, which has the gilded pieces
// too (version 83: exclusive items are the owner's test character's alone)
const KIT: { id: number; count: number }[] = ITEMS.filter((item) => !item.exclusive)
    .map((item) => ({ id: item.id, count: keptCount(item) }))
    .filter((k) => k.count > 0);
const OWNER_KIT = [...KIT, ...GILDED.map((id) => ({ id, count: 1 }))];
// The playtester's, which has their Guthix sunfire set (version 89)
const PLAYTESTER_KIT = [...KIT, ...GUTHIX_SUNFIRE.map((id) => ({ id, count: 1 }))];
// The owner's own character, the first (version 120, as the user asked): the
// Ankou outfit, kept the same way, (version 121) the red ghostly robes and
// (version 128) Sanguine torva
const OWNER_MAIN_KIT = [...ANKOU, ...RED_GHOSTLY, ...SANGUINE_TORVA].map((id) => ({ id, count: 1 }));
// The playtester's own character, the first (version 138, as the user
// asked): their Guthix sunfire set, kept the same way
const PLAYTESTER_MAIN_KIT = GUTHIX_SUNFIRE.map((id) => ({ id, count: 1 }));

// The kit this page's character keeps: a test character's, or the owner's
// first character's Ankou outfit, red ghostly robes and Sanguine torva, or
// the playtester's first character's Guthix sunfire set
function kitHere(): { id: number; count: number }[] {
    const crown = crownVerified(crownKey());
    if (loadedSlot() !== TEST_SLOT) {
        return crown?.alt === "owner" ? OWNER_MAIN_KIT : crown?.alt === "developer" ? PLAYTESTER_MAIN_KIT : [];
    }
    return !crown ? [] : crown.alt === "owner" ? OWNER_KIT : crown.alt === "developer" ? PLAYTESTER_KIT : KIT;
}

// Whether a piece is one this character keeps (and so can't sell)
export function isKept(id: number): boolean {
    return kitHere().some((k) => k.id === id);
}

// A crown's own pet (version 118, content/crownpets.ts): every character of
// a browser holding that crown has it, following unless another pet was
// picked; a save without the crown has it taken away (once the crown's check
// is done, so it isn't taken from its owner while that's still going). True
// if anything changed (the caller saves).
export function restoreCrownPets(save: SaveData): boolean {
    const key = crownKey();
    if (!crownKnown(key)) {
        return false;
    }
    const crown = crownVerified(key);
    let changed = false;
    for (const [id, pet] of Object.entries(CROWN_PETS)) {
        const theirs = crown?.alt === pet.crown;
        const has = save.pets.includes(id);
        if (theirs && !has) {
            save.pets.push(id);
            save.pet ??= id;
            changed = true;
        } else if (!theirs && has) {
            save.pets = save.pets.filter((p) => p !== id);
            if (save.pet === id) {
                save.pet = undefined;
            }
            changed = true;
        }
    }
    return changed;
}

// Tops the stash back up with whatever of the kit is short; true if anything
// changed (the caller saves)
export function restoreKit(save: SaveData): boolean {
    const kit = kitHere();
    if (kit.length === 0) {
        return false;
    }
    const KIT_IDS = new Set(kit.map((k) => k.id));
    let changed = false;
    // Never in a gravestone: it comes home on its own
    for (const grave of save.graves) {
        const before = grave.items.length;
        grave.items = grave.items.filter((s) => !KIT_IDS.has(s.id));
        changed ||= grave.items.length !== before;
    }
    const graves = save.graves.length;
    save.graves = save.graves.filter((g) => g.items.length > 0);
    changed ||= save.graves.length !== graves;
    const worn = Object.values(save.equipment);
    for (const { id, count } of kit) {
        const have = countOf(save.stash, id) + countOf(save.backpack, id) + worn.filter((w) => w === id).length;
        if (have >= count) {
            continue;
        }
        addItem(save.stash, id, count - have);
        delete save.wear[id];
        changed = true;
    }
    return changed;
}
