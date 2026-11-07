// The starter kits (version 127): a new character picks one of three, one a
// combat style, in place of the guild's old bronze sword, leather body and
// shrimps. Each is that style's tier 1 gear, matched (bronze, leather, blue
// wizard), with food, and the arrows or runes its weapon needs.
import { removeItem } from "./inventory";
import { Equipment, ItemStack, SaveData } from "./save";

export type StarterKit = {
    style: "melee" | "ranged" | "magic";
    name: string;
    blurb: string;
    equipment: Equipment;
    backpack: ItemStack[];
};

const SHRIMPS = 315;

export const STARTER_KITS: StarterKit[] = [
    {
        style: "melee",
        name: "Squire",
        blurb: "Bronze armour and a longsword. Takes hits well and needs nothing else: the safest way to learn the maps.",
        equipment: { weapon: 1291, head: 1139, body: 1103, legs: 1087, shield: 1171 },
        backpack: [{ id: SHRIMPS, count: 10 }],
    },
    {
        style: "ranged",
        name: "Archer",
        blurb: "A shortbow, 100 bronze arrows and leather. Hits from range, but the armour's light and the arrows run out.",
        equipment: { weapon: 841, head: 1167, body: 1129, legs: 1095, hands: 1063 },
        backpack: [
            { id: 882, count: 100 },
            { id: SHRIMPS, count: 8 },
        ],
    },
    {
        style: "magic",
        name: "Apprentice",
        blurb: "A staff of air (its air runes are free, so Wind Strike costs a mind rune), 150 mind runes and blue wizard robes. The longest reach, the weakest armour.",
        equipment: { weapon: 1381, head: 579, body: 577, legs: 1011 },
        backpack: [
            { id: 558, count: 150 },
            { id: SHRIMPS, count: 8 },
        ],
    },
];

// The old kit newSave() still makes, swapped for the one picked
const OLD_STASHED = 1129;

export function applyStarter(save: SaveData, kit: StarterKit): void {
    removeItem(save.stash, OLD_STASHED, 1);
    save.equipment = { ...kit.equipment };
    save.backpack = kit.backpack.map((s) => ({ ...s }));
    delete save.pickStarter;
}
