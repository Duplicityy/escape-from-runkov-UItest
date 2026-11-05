// Loading the exported cache assets: glTF models with morph target
// animations, item icons and sounds.
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { assetUrl } from "./paths";
import { settings } from "./settings";

// The models in public/assets are compressed (scripts/copy-assets.mjs):
// positions, colours and texture coordinates quantized to integers, which
// three.js reads on its own, and the geometry, morph target frames and
// animation tracks packed with meshoptimizer, which needs this decoder.
// A quantized mesh's node carries the scale and offset that turn its
// integer positions back into world units, so anything that reads the
// position attribute directly goes through the mesh's world matrix.
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const textureLoader = new THREE.TextureLoader();

// Brightness, the client's way: a power curve on every colour, which lifts
// the middle tones without blowing out the light ones. The renderer's tone
// mapping exposure is the amount (settings.brightness; main.ts sets it), so
// it changes on the spot with no shader rebuilt.
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
    "vec3 CustomToneMapping( vec3 color ) { return color; }",
    "vec3 CustomToneMapping( vec3 color ) { return pow( max( color, vec3( 0.0 ) ), vec3( 1.0 / toneMappingExposure ) ); }",
);

// A little more contrast and colour on everything drawn, put in after the
// output colour space conversion so it works on what's seen
THREE.ShaderChunk.colorspace_fragment += `
{
    vec3 graded = gl_FragColor.rgb;
    float luma = dot(graded, vec3(0.299, 0.587, 0.114));
    graded = mix(vec3(luma), graded, 1.12);
    graded = (graded - 0.5) * 1.1 + 0.5;
    gl_FragColor.rgb = clamp(graded, 0.0, 1.0);
}
`;

const models = new Map<string, Promise<GLTF>>();

export function loadModel(url: string): Promise<GLTF> {
    let promise = models.get(url);
    if (!promise) {
        promise = gltfLoader.loadAsync(url).then((gltf) => {
            // The last frame of a death animation can sink the body into the
            // ground, the way the cache hides dead NPCs. Cut that frame off so
            // a finished death clip holds the body lying there.
            for (const clip of gltf.animations) {
                if (clip.name === "death") {
                    trimSinkFrame(gltf, clip);
                }
            }
            linearizeColors(gltf.scene);
            if (url.includes("/maps/")) {
                dedupeTriangles(gltf.scene);
            }
            return gltf;
        });
        models.set(url, promise);
    }
    return promise;
}

// The exporter writes the client's palette colours, which are sRGB, as glTF
// vertex colours, which three.js takes as linear and brightens again on the
// way out: everything came out pale and flat. Converting them to linear
// here gives the client's colours back.
function linearizeColors(root: THREE.Object3D): void {
    const done = new Set<THREE.BufferAttribute>();
    root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) {
            return;
        }
        const color = mesh.geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
        if (!color || done.has(color)) {
            return;
        }
        done.add(color);
        for (let i = 0; i < color.count; i++) {
            color.setXYZ(i, srgbToLinear(color.getX(i)), srgbToLinear(color.getY(i)), srgbToLinear(color.getZ(i)));
        }
        color.needsUpdate = true;
    });
}

// A map's model holds many triangles that lie exactly on another's three
// points (the exporter writes some faces twice, and some tiles' underlay
// and overlay both), and two at the same depth with different colours
// shimmer as the camera moves. This keeps one of each, the one drawn
// later, since the client draws an overlay after what's under it. On
// Lumbridge that is one triangle in twelve gone.
function dedupeTriangles(root: THREE.Object3D): void {
    root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) {
            return;
        }
        const geometry = mesh.geometry;
        const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
        if (!position) {
            return;
        }
        const index = geometry.getIndex();
        const count = index ? index.count : position.count;
        const vertex = (i: number) => (index ? index.getX(i) : i);
        // Quantized positions are integers, so a string of them is exact
        const key = (v: number) => `${position.getX(v)},${position.getY(v)},${position.getZ(v)}`;
        const groups = geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
        const kept: number[] = [];
        const newGroups: { start: number; count: number; materialIndex: number }[] = [];
        let dropped = 0;
        for (const group of groups) {
            const seen = new Set<string>();
            const keep = new Uint8Array(group.count / 3);
            // From the end, so the later of two wins
            for (let t = group.count / 3 - 1; t >= 0; t--) {
                const base = group.start + t * 3;
                const k = [key(vertex(base)), key(vertex(base + 1)), key(vertex(base + 2))].sort().join("|");
                if (seen.has(k)) {
                    dropped++;
                } else {
                    seen.add(k);
                    keep[t] = 1;
                }
            }
            const start = kept.length;
            for (let t = 0; t < keep.length; t++) {
                if (keep[t]) {
                    const base = group.start + t * 3;
                    kept.push(vertex(base), vertex(base + 1), vertex(base + 2));
                }
            }
            newGroups.push({ start, count: kept.length - start, materialIndex: group.materialIndex ?? 0 });
        }
        if (dropped === 0) {
            return;
        }
        geometry.setIndex(kept);
        if (geometry.groups.length > 0) {
            geometry.clearGroups();
            for (const g of newGroups) {
                geometry.addGroup(g.start, g.count, g.materialIndex);
            }
        }
    });
}

// The sRGB transfer function, as three.js applies it to colours it's told are sRGB
function srgbToLinear(c: number): number {
    return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

function trimSinkFrame(gltf: GLTF, clip: THREE.AnimationClip): void {
    const track = clip.tracks[0];
    const times = track.times;
    if (times.length < 3) {
        return;
    }
    // Which target the second to last key (the last real frame) turns on
    const targets = track.values.length / times.length;
    const lastKey = times.length - 2;
    let target = -1;
    for (let t = 0; t < targets; t++) {
        if (track.values[lastKey * targets + t] > 0.5) {
            target = t;
        }
    }
    if (target === -1) {
        return;
    }
    let mesh: THREE.Mesh | undefined;
    gltf.scene.traverse((o) => {
        if (!mesh && (o as THREE.Mesh).isMesh) {
            mesh = o as THREE.Mesh;
        }
    });
    if (!mesh) {
        return;
    }
    const morph = mesh.geometry.morphAttributes.position?.[target];
    const base = mesh.geometry.attributes.position;
    if (!morph || !base) {
        return;
    }
    gltf.scene.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    let maxY = -Infinity;
    for (let i = 0; i < morph.count; i++) {
        point
            .set(base.getX(i) + morph.getX(i), base.getY(i) + morph.getY(i), base.getZ(i) + morph.getZ(i))
            .applyMatrix4(mesh.matrixWorld);
        maxY = Math.max(maxY, point.y);
    }
    // Everything at or under the floor: a sink frame, so end on the one before
    if (maxY < 0.1 && times.length >= 3) {
        clip.duration = times[times.length - 3];
    } else {
        clip.duration = times[times.length - 2];
    }
}

export type Actor = {
    root: THREE.Group;
    mixer: THREE.AnimationMixer;
    clips: Map<string, THREE.AnimationClip>;
    materials: THREE.MeshBasicMaterial[];
    current?: string;
    height: number;
    radius: number;
};

// A fresh copy of a model that can be posed and tinted on its own
export function createActor(kind: "npcs" | "locs" | "spotanims", id: number): Promise<Actor> {
    return createActorFromUrl(assetUrl(`assets/${kind}/${id}.glb`));
}

export async function createActorFromUrl(url: string): Promise<Actor> {
    const gltf = await loadModel(url);
    const root = gltf.scene.clone(true);
    const materials: THREE.MeshBasicMaterial[] = [];
    root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const copies = mats.map((m) => {
                const copy = (m as THREE.MeshBasicMaterial).clone();
                materials.push(copy);
                return copy;
            });
            mesh.material = Array.isArray(mesh.material) ? copies : copies[0];
            mesh.frustumCulled = false;
        }
    });
    // Measured from the rest pose only: the morph targets hold every
    // animation frame, and a death frame lying down or a leap would
    // stretch the box far past the standing body
    const bounds = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
            const box = new THREE.Box3().setFromBufferAttribute(
                mesh.geometry.attributes.position as THREE.BufferAttribute,
            );
            bounds.union(box.applyMatrix4(mesh.matrixWorld));
        }
    });
    const size = bounds.getSize(new THREE.Vector3());
    const mixer = new THREE.AnimationMixer(root);
    const clips = new Map(gltf.animations.map((c) => [c.name, c]));
    return {
        root,
        mixer,
        clips,
        materials,
        height: size.y,
        radius: Math.max(size.x, size.z) / 2,
    };
}

// Plays a clip: looping by default, once (held at the end) for attack and
// death. Returns the clip's length in seconds.
export function play(actor: Actor, name: string, options: { once?: boolean; speed?: number } = {}): number {
    const clip = actor.clips.get(name);
    if (!clip) {
        return 0;
    }
    if (actor.current === name && !options.once) {
        return clip.duration;
    }
    actor.mixer.stopAllAction();
    const action = actor.mixer.clipAction(clip);
    action.reset();
    action.timeScale = options.speed ?? 1;
    if (options.once) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
    } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
    }
    action.play();
    actor.current = name;
    return clip.duration / (options.speed ?? 1);
}

// The light on everything that moves: white by day, the night's blue on a
// night run (run.ts sets it for the run and puts it back after). tint()
// and the character's colours (player.ts) go under it.
export const worldLight = new THREE.Color(1, 1, 1);

export function setWorldLight(color: THREE.Color): void {
    worldLight.copy(color);
}

export function tint(actor: Actor, color: THREE.Color): void {
    for (const m of actor.materials) {
        m.color.copy(color).multiply(worldLight);
    }
}

const textures = new Map<string, THREE.Texture>();

export function loadTexture(url: string): THREE.Texture {
    let texture = textures.get(url);
    if (!texture) {
        texture = textureLoader.load(url);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.set(url, texture);
    }
    return texture;
}

// Sounds through the Web Audio API, so several can overlap. They all sit in
// one pack (scripts/copy-assets.mjs), fetched once, with an index of where
// each one is; a sound is decoded the first time it's played.
let audio: AudioContext | undefined;
const buffers = new Map<string, Promise<AudioBuffer | undefined>>();
type SoundPack = { data: ArrayBuffer; index: Record<string, [number, number]> };
let soundPack: Promise<SoundPack | undefined> | undefined;

function context(): AudioContext {
    if (!audio) {
        audio = new AudioContext();
    }
    if (audio.state === "suspended") {
        void audio.resume();
    }
    return audio;
}

function loadSoundPack(): Promise<SoundPack | undefined> {
    if (!soundPack) {
        soundPack = Promise.all([
            fetch(assetUrl("assets/sounds.pack")).then((r) =>
                r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText)),
            ),
            fetch(assetUrl("assets/sounds.json")).then((r) =>
                r.ok ? (r.json() as Promise<SoundPack["index"]>) : Promise.reject(new Error(r.statusText)),
            ),
        ])
            .then(([data, index]) => ({ data, index }))
            .catch(() => undefined);
    }
    return soundPack;
}

// A sound by its key in the pack: npcs/<id>/attack, hit or death (see
// npcSound), or sounds/<id> for a weapon's
export function playSound(key: string, volume = 0.5): void {
    if (settings.muted || settings.volume <= 0) {
        return;
    }
    const ctx = context();
    let buffer = buffers.get(key);
    if (!buffer) {
        buffer = loadSoundPack()
            .then((pack) => {
                const entry = pack?.index[key];
                if (!pack || !entry) {
                    return undefined;
                }
                return ctx.decodeAudioData(pack.data.slice(entry[0], entry[0] + entry[1]));
            })
            .catch(() => undefined);
        buffers.set(key, buffer);
    }
    void buffer.then((b) => {
        if (!b) {
            return;
        }
        const source = ctx.createBufferSource();
        source.buffer = b;
        const gain = ctx.createGain();
        gain.gain.value = volume * settings.volume;
        source.connect(gain).connect(ctx.destination);
        source.start();
    });
}

export function npcSound(npcId: number, name: "attack" | "hit" | "death"): string {
    return `npcs/${npcId}/${name}`;
}

// A chime for a good drop: nothing in the cache rings like one, so three
// rising notes are made here, a step higher for the best tier
export function playChime(high = false): void {
    if (settings.muted || settings.volume <= 0) {
        return;
    }
    const ctx = context();
    const base = high ? 880 : 660;
    for (const [i, ratio] of [1, 1.25, 1.5].entries()) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = base * ratio;
        const at = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.25 * settings.volume, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.7);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.75);
    }
}
