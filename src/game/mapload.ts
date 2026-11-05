// A map's model, a map square at a time: the exporter's --tiles writes each
// 64 tile square as its own file and region.json lists them, so a run can
// start on the squares round the player while the rest of the map comes
// in, and no file is bigger than a square (version 68; before it a map was
// one file, which a full map made 25 to 90 MB). A map exported whole still
// loads as one.
import * as THREE from "three";

import { loadModel } from "./assets";
import { assetUrl } from "./paths";
import { Region } from "./region";

const SQUARE = 64;
// The squares this many squares from the one the point is in come first,
// and the run waits for them
const NEAR = 1;
// How many of the rest are fetched at once
const AT_ONCE = 2;

export type MapLoad = {
    // Settled when the squares round the point are in
    near: Promise<void>;
    // Settled when every square is in
    all: Promise<void>;
    // Nothing more is fetched or handed over
    cancel: () => void;
};

// Hands each part of the map to `onPart` as it arrives (a whole map, or a
// square), the nearest squares first; `farToo` false leaves the far
// squares out altogether (the guild's courtyard only needs its own)
export function loadMap(
    region: Region,
    x: number,
    z: number,
    onPart: (part: THREE.Object3D) => void,
    farToo = true,
): MapLoad {
    let cancelled = false;
    const cancel = () => {
        cancelled = true;
    };
    const squares = region.squares;
    if (!squares) {
        const one = loadModel(assetUrl(`assets/maps/${region.id}.glb`)).then((gltf) => {
            if (!cancelled) {
                onPart(gltf.scene);
            }
        });
        return { near: one, all: one, cancel };
    }
    const sx = Math.floor(x / SQUARE);
    const sy = Math.floor(-z / SQUARE);
    const byDistance = squares
        .map(([mx, my]) => ({ mx, my, d: Math.max(Math.abs(mx - sx), Math.abs(my - sy)) }))
        .sort((a, b) => a.d - b.d);
    const load = (s: { mx: number; my: number }) =>
        loadModel(assetUrl(`assets/maps/${region.id}/${s.mx}_${s.my}.glb`)).then((gltf) => {
            if (!cancelled) {
                onPart(gltf.scene);
            }
        });
    const near = Promise.all(byDistance.filter((s) => s.d <= NEAR).map(load)).then(() => undefined);
    const queue = farToo ? byDistance.filter((s) => s.d > NEAR) : [];
    const all = near.then(async () => {
        const worker = async () => {
            while (queue.length > 0 && !cancelled) {
                await load(queue.shift()!);
            }
        };
        await Promise.all(Array.from({ length: AT_ONCE }, worker));
    });
    return { near, all, cancel };
}
