import { assetUrl } from "../game/paths";

// Original, unmodified OSRS cache frames. Provenance and file hashes live
// beside the PNGs in public/ui/osrs/sources.json.
const SPRITES = {
    combat: [168, 20, 20],
    inventory: [900, 26, 28],
    equipment: [901, 27, 32],
    prayer: [779, 26, 30],
    magic: [780, 25, 24],
    tasks: [776, 22, 22],
    friends: [782, 23, 23],
    character: [909, 19, 28],
    music: [910, 22, 26],
    map: [1439, 22, 22],
    settings: [908, 24, 24],
    logout: [907, 21, 30],
    loot: [6390, 25, 23],
    heart: [1067, 15, 14],
    "prayer-orb": [1068, 20, 20],
    special: [1610, 16, 16],
    coins: [1453, 15, 15],
    compass: [169, 51, 51],
} as const;

export function interfaceIcon(name: keyof typeof SPRITES): HTMLImageElement {
    const [sprite, width, height] = SPRITES[name];
    const image = document.createElement("img");
    image.className = `osrs-interface-icon osrs-icon-${name}`;
    image.src = assetUrl(`ui/osrs/${name}.png`);
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.draggable = false;
    image.width = width;
    image.height = height;
    image.dataset.osrsSprite = `${sprite}:0`;
    return image;
}
