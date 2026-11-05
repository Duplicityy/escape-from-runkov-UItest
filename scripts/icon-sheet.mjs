// Packs every item icon in public/assets/items into one sheet,
// public/assets/items.png, with public/assets/items.json saying where each
// id sits, so the game fetches one file for all its icons instead of one a
// slot (a request that fails on a slow host left a broken image before).
// copy-assets.mjs runs this at its end; it can be run on its own too:
//
//   node scripts/icon-sheet.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { PNG } from "pngjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(root, "public", "assets", "items");
const ids = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .map((f) => parseInt(f))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

const icons = ids.map((id) => PNG.sync.read(fs.readFileSync(path.join(dir, `${id}.png`))));
const w = Math.max(...icons.map((i) => i.width));
const h = Math.max(...icons.map((i) => i.height));
const cols = Math.ceil(Math.sqrt(ids.length));
const rows = Math.ceil(ids.length / cols);
const sheet = new PNG({ width: cols * w, height: rows * h });
icons.forEach((icon, i) => {
    const ox = (i % cols) * w;
    const oy = Math.floor(i / cols) * h;
    for (let y = 0; y < icon.height; y++) {
        for (let x = 0; x < icon.width; x++) {
            const from = (y * icon.width + x) * 4;
            const to = ((oy + y) * sheet.width + ox + x) * 4;
            sheet.data[to] = icon.data[from];
            sheet.data[to + 1] = icon.data[from + 1];
            sheet.data[to + 2] = icon.data[from + 2];
            sheet.data[to + 3] = icon.data[from + 3];
        }
    }
});
fs.writeFileSync(path.join(root, "public", "assets", "items.png"), PNG.sync.write(sheet));
// The same sheet with the icons lifted out of the cache's darkness, for the
// interface (version 90): the gamma curve index.html's #icon-lift filter
// used to apply in the browser, an exponent of 0.625 on each sRGB channel,
// done here instead. Safari (and every browser on an iPhone) drew a share
// of the filtered icons as plain white shapes. items.png stays as it was
// for the icons on the ground, which the world's own brightness lifts.
const lift = new Uint8Array(256).map((_, c) => Math.round(255 * Math.pow(c / 255, 0.625)));
const lit = new PNG({ width: sheet.width, height: sheet.height });
for (let i = 0; i < sheet.data.length; i += 4) {
    lit.data[i] = lift[sheet.data[i]];
    lit.data[i + 1] = lift[sheet.data[i + 1]];
    lit.data[i + 2] = lift[sheet.data[i + 2]];
    lit.data[i + 3] = sheet.data[i + 3];
}
fs.writeFileSync(path.join(root, "public", "assets", "items-lit.png"), PNG.sync.write(lit));
fs.writeFileSync(path.join(root, "public", "assets", "items.json"), JSON.stringify({ w, h, cols, ids }));
console.log(`${ids.length} icons in a ${sheet.width}x${sheet.height} sheet (${cols} across, ${w}x${h} each)`);
