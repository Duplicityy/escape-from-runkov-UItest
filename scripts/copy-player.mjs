// Copies just the character's pieces into public/assets/player, compressed
// the way copy-assets.mjs does it: for a change to the player clips (Run
// Escape's PLAYER_CLIPS) without copying every map and model again.
//
//   node scripts/copy-player.mjs [source folder]   (default ../full-assets)
//
// Stop the dev server first: its watcher dies on files changing under it.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(process.argv[2] ?? path.join(root, "..", "full-assets"), "player");
const target = path.join(root, "public", "assets", "player");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets.json"), "utf8"));

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
async function compress(from, to) {
    const doc = await io.read(from);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    await io.write(to, doc);
}

const jobs = [];
for (const kit of fs.readdirSync(path.join(source, "kits"))) {
    jobs.push([path.join(source, "kits", kit, "model.glb"), path.join(target, "kits", `${kit}.glb`)]);
}
const infos = {};
for (const id of manifest.items) {
    const from = path.join(source, "items", String(id));
    if (fs.existsSync(from)) {
        jobs.push([path.join(from, "model.glb"), path.join(target, "items", `${id}.glb`)]);
        infos[id] = JSON.parse(fs.readFileSync(path.join(from, "info.json"), "utf8"));
    }
}
let raw = 0;
let packed = 0;
for (let i = 0; i < jobs.length; i++) {
    const [from, to] = jobs[i];
    await compress(from, to);
    raw += fs.statSync(from).size;
    packed += fs.statSync(to).size;
    if ((i + 1) % 100 === 0 || i === jobs.length - 1) {
        console.log(`compressed ${i + 1} of ${jobs.length}`);
    }
}
fs.writeFileSync(path.join(target, "items.json"), JSON.stringify(infos));
for (const file of ["kits.json", "colors.json"]) {
    fs.copyFileSync(path.join(source, file), path.join(target, file));
}
const mb = (b) => Math.round(b / 1048576);
console.log(`player pieces: ${jobs.length}, ${mb(raw)} MB compressed to ${mb(packed)} MB`);
