// Checks that every wearable item in the catalog has a worn piece the game
// can draw: public/assets/player/items/<id>.glb and its entry in items.json,
// in the client slot the game expects, with every clip.
//
//   npx tsx scripts/check-gear.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ITEMS } from "../src/content/items";
import { EQUIP_SLOT } from "../src/game/player";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pieces = path.join(root, "public", "assets", "player", "items");
// Every clip the exporter's player command gives a piece, and the game plays
const CLIPS = [
    "idle",
    "walk",
    "run",
    "death",
    "attack",
    "attack_stab",
    "attack_whip",
    "attack_2h",
    "attack_bow",
    "attack_cast",
    "idle_2h",
    "run_2h",
    "idle_staff",
    "run_staff",
    "run_whip",
    // Version 81's two handed holds
    "idle_godsword",
    "run_godsword",
    "idle_maul",
    "run_maul",
    "attack_maul",
    "idle_bulwark",
    "run_bulwark",
    "attack_spear",
];

const infos: Record<string, { slot: number; animations: string[] }> = JSON.parse(
    fs.readFileSync(path.join(root, "public", "assets", "player", "items.json"), "utf8"),
);
let checked = 0;
const problems: string[] = [];
for (const item of ITEMS) {
    if (!item.slot || item.slot === "ring") {
        continue;
    }
    checked++;
    // The flat layout copy-assets.mjs writes: items/<id>.glb, and every
    // piece's info in items.json
    const model = path.join(pieces, `${item.id}.glb`);
    const info = infos[item.id];
    if (!info || !fs.existsSync(model)) {
        problems.push(`${item.id} ${item.name}: no exported piece`);
        continue;
    }
    const expected = EQUIP_SLOT[item.slot];
    if (info.slot !== expected) {
        problems.push(`${item.id} ${item.name}: cache slot ${info.slot}, game slot ${item.slot} (${expected})`);
    }
    const clips = (info.animations as string[]).map((a) => a.split(" ")[0]);
    const missing = CLIPS.filter((c) => !clips.includes(c));
    if (missing.length > 0) {
        problems.push(`${item.id} ${item.name}: missing clips ${missing.join(", ")}`);
    }
    if (fs.statSync(model).size < 2000) {
        problems.push(`${item.id} ${item.name}: ${item.id}.glb is only ${fs.statSync(model).size} bytes`);
    }
}
console.log(`${checked} wearable items checked, ${problems.length} problems`);
for (const p of problems) {
    console.log("  " + p);
}
process.exitCode = problems.length > 0 ? 1 : 0;
