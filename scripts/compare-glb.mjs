// Compares an exported glb with the compressed copy npm run assets writes
// of it: vertex and triangle counts, the world-space bounds of the rest
// pose and of every morph target frame, colour bounds, and clip lengths.
// The compressor reorders vertices, so bounds are compared, not values.
//
//   node scripts/compare-glb.mjs ../full-assets/npcs/10623-JalTok-Jad/model.glb public/assets/npcs/10623.glb
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

function transform(m, v) {
    const x = v[0], y = v[1], z = v[2];
    return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
}

function describe(doc) {
    const out = { prims: [], clips: [] };
    const root = doc.getRoot();
    for (const node of root.listNodes()) {
        const mesh = node.getMesh();
        if (!mesh) continue;
        const m = node.getWorldMatrix();
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute("POSITION");
            const col = prim.getAttribute("COLOR_0");
            const idx = prim.getIndices();
            const n = pos.getCount();
            const base = [];
            const v = [0, 0, 0];
            for (let i = 0; i < n; i++) {
                pos.getElement(i, v);
                base.push([v[0], v[1], v[2]]);
            }
            const bounds = (pts) => {
                const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
                for (const p of pts) {
                    const w = transform(m, p);
                    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], w[k]); max[k] = Math.max(max[k], w[k]); }
                }
                return [min, max];
            };
            const colBounds = () => {
                if (!col) return undefined;
                const min = [1, 1, 1], max = [0, 0, 0];
                const c = [0, 0, 0, 0];
                for (let i = 0; i < col.getCount(); i++) {
                    col.getElement(i, c);
                    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], c[k]); max[k] = Math.max(max[k], c[k]); }
                }
                return [min, max];
            };
            const targets = prim.listTargets().map((t) => {
                const tp = t.getAttribute("POSITION");
                const pts = [];
                for (let i = 0; i < n; i++) {
                    tp.getElement(i, v);
                    const b = base[i];
                    pts.push([b[0] + v[0], b[1] + v[1], b[2] + v[2]]);
                }
                return bounds(pts);
            });
            out.prims.push({
                name: mesh.getName(),
                vertices: n,
                triangles: idx ? idx.getCount() / 3 : n / 3,
                bounds: bounds(base),
                colors: colBounds(),
                targets,
            });
        }
    }
    for (const anim of root.listAnimations()) {
        let end = 0;
        for (const s of anim.listSamplers()) {
            end = Math.max(end, s.getInput().getMax([0])[0]);
        }
        out.clips.push({ name: anim.getName(), end, samplers: anim.listSamplers().length });
    }
    return out;
}

const fmt = (n) => (Math.round(n * 1000) / 1000).toString();
const [a, b] = await Promise.all(process.argv.slice(2, 4).map((f) => io.read(f).then(describe)));
let worst = 0;
let problems = 0;
for (let i = 0; i < a.prims.length; i++) {
    const p = a.prims[i], q = b.prims[i];
    if (!q) { console.log(`missing primitive ${i}`); problems++; continue; }
    if (p.vertices !== q.vertices || p.triangles !== q.triangles) {
        console.log(`${p.name}: ${p.vertices} verts/${p.triangles} tris -> ${q.vertices}/${q.triangles}`);
        problems++;
    }
    if (p.targets.length !== q.targets.length) {
        console.log(`${p.name}: ${p.targets.length} morph targets -> ${q.targets.length}`);
        problems++;
    }
    const size = Math.max(...[0, 1, 2].map((k) => p.bounds[1][k] - p.bounds[0][k]), 1e-6);
    const cmp = (label, x, y) => {
        for (let k = 0; k < 3; k++) {
            const err = Math.max(Math.abs(x[0][k] - y[0][k]), Math.abs(x[1][k] - y[1][k]));
            worst = Math.max(worst, err / size);
            if (err > size * 0.002) {
                console.log(`${p.name} ${label} axis ${k}: ${fmt(x[0][k])}..${fmt(x[1][k])} -> ${fmt(y[0][k])}..${fmt(y[1][k])}`);
                problems++;
            }
        }
    };
    cmp("rest", p.bounds, q.bounds);
    for (let t = 0; t < Math.min(p.targets.length, q.targets.length); t++) {
        cmp(`target ${t}`, p.targets[t], q.targets[t]);
    }
    if (p.colors && q.colors) {
        for (let k = 0; k < 3; k++) {
            const err = Math.max(Math.abs(p.colors[0][k] - q.colors[0][k]), Math.abs(p.colors[1][k] - q.colors[1][k]));
            if (err > 1 / 200) {
                console.log(`${p.name} colour axis ${k}: ${fmt(p.colors[0][k])}..${fmt(p.colors[1][k])} -> ${fmt(q.colors[0][k])}..${fmt(q.colors[1][k])}`);
                problems++;
            }
        }
    }
}
for (let i = 0; i < a.clips.length; i++) {
    const c = a.clips[i], d = b.clips[i];
    if (!d || c.name !== d.name || Math.abs(c.end - d.end) > 1e-4 || c.samplers !== d.samplers) {
        console.log(`clip ${c.name}: ${c.end}s/${c.samplers} samplers -> ${d?.name} ${d?.end}s/${d?.samplers}`);
        problems++;
    }
}
console.log(
    `${a.prims.length} primitives, ${a.prims.reduce((s, p) => s + p.targets.length, 0)} morph targets, ${a.clips.length} clips; worst bounds error ${(worst * 100).toFixed(4)}% of size; ${problems} problems`,
);
process.exitCode = problems > 0 ? 1 : 0;
