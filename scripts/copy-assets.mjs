// Copies the assets the game uses from ../full-assets into public/assets,
// as a flat layout with few files: itch.io allows an HTML game at most a
// thousand files and folders, and one file per thing (plus one pack for
// every sound) keeps a map's worth of enemies and gear well under it.
//
//   npm run assets
//
// What's written (see src/game/paths.ts for how the game finds them):
//   items/<id>.png                  inventory icons
//   npcs/<id>.glb, locs/<id>.glb, spotanims/<id>.glb
//   maps/<id>/<x>_<y>.glb, maps/<id>.json   each map a square at a time
//                                   (or maps/<id>.glb whole), and its collision
//   player/kits/<id>.glb, player/items/<id>.glb, player/items.json (every
//   worn piece's info in one file), player/kits.json, player/colors.json
//   sounds.pack, sounds.json        every sound, and where each is in the pack
//
// Every model is compressed on the way (see compressModel): three to four
// times smaller, which keeps the build under itch.io's 500 MB for an HTML
// game. scripts/compare-glb.mjs checks a compressed copy against its
// original.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = process.argv[2] ?? path.join(root, "..", "full-assets");
const target = path.join(root, "public", "assets");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets.json"), "utf8"));

// The worlds' enemies and bosses come from src/content/worlds.json
const worldsFile = path.join(root, "src", "content", "worlds.json");
if (fs.existsSync(worldsFile)) {
    const worlds = JSON.parse(fs.readFileSync(worldsFile, "utf8"));
    for (const world of worlds) {
        for (const enemy of [...world.enemies, world.boss]) {
            if (enemy && !manifest.npcs.includes(enemy.npcId)) {
                manifest.npcs.push(enemy.npcId);
            }
        }
    }
}

function findFolder(kind, id) {
    const dir = path.join(source, kind);
    const match = fs.readdirSync(dir).find((name) => name.split("-")[0] === String(id));
    return match ? path.join(dir, match) : undefined;
}

// A clean slate, so nothing from an older layout lingers
fs.rmSync(target, { recursive: true, force: true });
let copied = 0;
const missing = [];
const copy = (from, to) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
};

// Models are collected and compressed at the end, one at a time: positions,
// colours and texture coordinates quantized to integers
// (KHR_mesh_quantization, which three.js reads on its own; the mesh's node
// gets the scale and offset back to world units), and the geometry, the
// morph target frames that hold every animation and the animation tracks
// packed with meshoptimizer (EXT_meshopt_compression, decoded by the
// decoder src/game/assets.ts gives the loader). Lossless but for the
// quantization: 14 bits across a mesh and all its frames, under a
// millimetre on a character and under a centimetre on a map.
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const models = [];
const copyModel = (from, to) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    models.push({ from, to });
};
async function compressModel(from, to) {
    const doc = await io.read(from);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    await io.write(to, doc);
    copied++;
}

// Sounds go in one pack: the file's bytes end to end, and an index of
// where each is
const pack = [];
const packIndex = {};
let packOffset = 0;
const packSound = (key, file) => {
    const data = fs.readFileSync(file);
    packIndex[key] = [packOffset, data.length];
    pack.push(data);
    packOffset += data.length;
};

for (const id of manifest.npcs) {
    const from = findFolder("npcs", id);
    if (!from) {
        missing.push(`npcs/${id}`);
        continue;
    }
    copyModel(path.join(from, "model.glb"), path.join(target, "npcs", `${id}.glb`));
    for (const name of ["attack", "hit", "death"]) {
        const file = path.join(from, `${name}.wav`);
        if (fs.existsSync(file)) {
            packSound(`npcs/${id}/${name}`, file);
        }
    }
}
for (const id of manifest.items) {
    const from = findFolder("items", id);
    if (!from) {
        missing.push(`items/${id}`);
        continue;
    }
    copy(path.join(from, "icon.png"), path.join(target, "items", `${id}.png`));
}
for (const kind of ["locs", "spotanims"]) {
    for (const id of manifest[kind] ?? []) {
        const from = findFolder(kind, id);
        if (!from) {
            missing.push(`${kind}/${id}`);
            continue;
        }
        copyModel(path.join(from, "model.glb"), path.join(target, kind, `${id}.glb`));
    }
}
for (const id of manifest.maps ?? []) {
    const from = path.join(source, "maps", id);
    if (!fs.existsSync(from)) {
        missing.push(`maps/${id}`);
        continue;
    }
    // A map exported in squares (--tiles) is one file a square, under the
    // map's own folder; one exported whole is one file
    const squares = path.join(from, "squares");
    if (fs.existsSync(squares)) {
        for (const file of fs.readdirSync(squares)) {
            if (file.endsWith(".glb")) {
                copyModel(path.join(squares, file), path.join(target, "maps", id, file));
            }
        }
    } else {
        copyModel(path.join(from, "map.glb"), path.join(target, "maps", `${id}.glb`));
    }
    copy(path.join(from, "region.json"), path.join(target, "maps", `${id}.json`));
}
for (const id of manifest.sounds) {
    const from = path.join(source, "sounds", `${id}.wav`);
    if (!fs.existsSync(from)) {
        missing.push(`sounds/${id}`);
        continue;
    }
    packSound(`sounds/${id}`, from);
}
fs.writeFileSync(path.join(target, "sounds.pack"), Buffer.concat(pack));
fs.writeFileSync(path.join(target, "sounds.json"), JSON.stringify(packIndex));
copied += 2;

// Music, if there is any: recordings named <map id>.ogg, and menu.ogg
// (src/game/music.ts plays whichever exist)
const musicSource = path.join(source, "music");
if (fs.existsSync(musicSource)) {
    for (const file of fs.readdirSync(musicSource)) {
        if (file.endsWith(".ogg") || file.endsWith(".mp3")) {
            copy(path.join(musicSource, file), path.join(target, "music", file));
        }
    }
}

// The character's pieces: every body kit, and the worn model of every item
// in the manifest that has one, with all their infos in one file
const playerSource = path.join(source, "player");
if (fs.existsSync(playerSource)) {
    for (const kit of fs.readdirSync(path.join(playerSource, "kits"))) {
        copyModel(path.join(playerSource, "kits", kit, "model.glb"), path.join(target, "player", "kits", `${kit}.glb`));
    }
    const infos = {};
    for (const id of manifest.items) {
        const from = path.join(playerSource, "items", String(id));
        if (fs.existsSync(from)) {
            copyModel(path.join(from, "model.glb"), path.join(target, "player", "items", `${id}.glb`));
            infos[id] = JSON.parse(fs.readFileSync(path.join(from, "info.json"), "utf8"));
        }
    }
    fs.writeFileSync(path.join(target, "player", "items.json"), JSON.stringify(infos));
    copied++;
    for (const file of ["kits.json", "colors.json"]) {
        copy(path.join(playerSource, file), path.join(target, "player", file));
    }
} else {
    missing.push("player (run export-assets.ts player kits, then player items assets.json)");
}

let rawBytes = 0;
let packedBytes = 0;
for (let i = 0; i < models.length; i++) {
    const { from, to } = models[i];
    await compressModel(from, to);
    rawBytes += fs.statSync(from).size;
    packedBytes += fs.statSync(to).size;
    if ((i + 1) % 50 === 0 || i === models.length - 1) {
        console.log(`compressed ${i + 1} of ${models.length} models`);
    }
}
const mb = (bytes) => Math.round(bytes / 1048576);

// Every icon into one sheet (the game fetches that, not the icons)
await import("./icon-sheet.mjs");
copied += 2;

const count = (dir) => {
    let files = 0;
    let dirs = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            dirs++;
            const inner = count(path.join(dir, entry.name));
            files += inner.files;
            dirs += inner.dirs;
        } else {
            files++;
        }
    }
    return { files, dirs };
};
const total = count(target);
console.log(
    `wrote ${copied} files into ${target}: ${total.files} files in ${total.dirs} folders, ${Object.keys(packIndex).length} sounds in the pack, models ${mb(rawBytes)} MB compressed to ${mb(packedBytes)} MB`,
);
if (missing.length > 0) {
    console.log(`missing from ${source}: ${missing.join(", ")}`);
    process.exitCode = 1;
}
