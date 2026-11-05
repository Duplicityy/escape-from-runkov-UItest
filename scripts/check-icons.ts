// Lists every item in items.ts whose icon isn't in public/assets/items (an id
// missing from assets.json, or one the exporter couldn't draw):
//
//   npx tsx scripts/check-icons.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ITEMS } from "../src/content/items";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets.json"), "utf8")) as { items: number[] };
let missing = 0;
for (const item of ITEMS) {
    const file = path.join(root, "public", "assets", "items", `${item.id}.png`);
    const problems: string[] = [];
    if (!manifest.items.includes(item.id)) {
        problems.push("not in assets.json");
    }
    if (!fs.existsSync(file)) {
        problems.push("no icon in public/assets/items");
    } else if (fs.statSync(file).size < 100) {
        problems.push(`icon is only ${fs.statSync(file).size} bytes`);
    }
    if (problems.length > 0) {
        missing++;
        console.log(`${item.id} ${item.name}: ${problems.join(", ")}`);
    }
}
console.log(missing === 0 ? `every one of the ${ITEMS.length} items has an icon` : `${missing} of ${ITEMS.length} items have a problem`);
