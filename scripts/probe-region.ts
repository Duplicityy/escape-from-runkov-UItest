// Prints the collision around a spot and walks a line across it
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Region } from "../src/game/region";

const here = path.dirname(fileURLToPath(import.meta.url));
const [id, sx, sy, ex, ey] = process.argv.slice(2);
const json = JSON.parse(fs.readFileSync(path.join(here, "..", "public", "assets", "maps", `${id}.json`), "utf8"));
const region = new Region(json);
const x0 = parseInt(sx);
const y0 = parseInt(sy);
const x1 = parseInt(ex);
const y1 = parseInt(ey);
for (let y = y1; y >= y0; y--) {
    let line = `${y} `;
    for (let x = x0; x <= x1; x++) {
        const i = x - region.baseX + (y - region.baseY) * region.sizeX;
        const t = region.tiles[i];
        const f = region.tileFlags[i];
        let c = ".";
        if (t & 1) c = "#";
        else if (t & 30) c = (t & 2 ? "n" : "") + (t & 4 ? "e" : "") + (t & 8 ? "s" : "") + (t & 16 ? "w" : "");
        if (c.length > 1) c = c[0].toUpperCase();
        if (f & 1) c = c === "." ? "b" : c;
        line += c.padEnd(2);
    }
    console.log(line);
}
// Walk east along the middle row
const midY = Math.floor((y0 + y1) / 2);
let px = x0 + 0.5;
let pz = -(midY + 0.5);
let last = px;
for (let step = 0; step < (x1 - x0) * 20; step++) {
    const [nx, nz] = region.moveAxis(px, pz, 0.05, 0, 0.35);
    if (nx === px) {
        console.log(`walking east along y ${midY}: stopped at x ${px.toFixed(2)} (tile ${Math.floor(px)}), ground ${region.heightAt(px, pz).toFixed(2)}`);
        break;
    }
    px = nx;
    pz = nz;
    last = px;
}
console.log(`reached x ${last.toFixed(2)}`);
