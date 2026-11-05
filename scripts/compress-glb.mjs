// Compresses one exported model into public/assets the way copy-assets.mjs
// does (quantized, meshopt packed), for adding a single thing without
// rerunning the whole copy; or every player piece again after a re-export:
//
//   node scripts/compress-glb.mjs <from.glb> <to.glb>
//   node scripts/compress-glb.mjs player        # ../full-assets/player -> public/assets/player
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

async function compress(from, to) {
    const doc = await io.read(from);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    await io.write(to, doc);
    return [fs.statSync(from).size, fs.statSync(to).size];
}

const mb = (bytes) => (bytes / 1048576).toFixed(1);

if (process.argv[2] === "player") {
    const source = path.join(root, "..", "full-assets", "player");
    const target = path.join(root, "public", "assets", "player");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets.json"), "utf8"));
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
        const [a, b] = await compress(jobs[i][0], jobs[i][1]);
        raw += a;
        packed += b;
        if ((i + 1) % 50 === 0 || i === jobs.length - 1) {
            console.log(`compressed ${i + 1} of ${jobs.length} player pieces`);
        }
    }
    fs.writeFileSync(path.join(target, "items.json"), JSON.stringify(infos));
    for (const file of ["kits.json", "colors.json"]) {
        fs.copyFileSync(path.join(source, file), path.join(target, file));
    }
    console.log(`player pieces: ${mb(raw)} MB compressed to ${mb(packed)} MB`);
} else {
    const [from, to] = process.argv.slice(2);
    if (!from || !to) {
        console.log("usage: node scripts/compress-glb.mjs <from.glb> <to.glb> | player");
        process.exit(1);
    }
    const [a, b] = await compress(from, to);
    console.log(`${mb(a)} MB compressed to ${mb(b)} MB: ${to}`);
}
