// The protection prayer's icon over a head (version 103), as OSRS draws it:
// the cache's headicons_prayer sprites (Run Escape's
// scripts/cache/export-sprites.ts), in public/ui/headicons. One for this
// player and one for each mate.
import * as THREE from "three";

import { loadTexture } from "./assets";
import { assetUrl } from "./paths";

export type PrayStyle = "none" | "melee" | "ranged" | "magic";

// How big it is in the world, and how far above what's under it it floats
const SIZE = 0.55;

const textures = new Map<PrayStyle, THREE.Texture>();

function textureFor(style: Exclude<PrayStyle, "none">): THREE.Texture {
    let texture = textures.get(style);
    if (!texture) {
        texture = loadTexture(assetUrl(`ui/headicons/${style}.png`));
        textures.set(style, texture);
    }
    return texture;
}

export class Overhead {
    readonly sprite: THREE.Sprite;
    private style: PrayStyle = "none";

    constructor(private readonly scene: THREE.Scene) {
        this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, toneMapped: false, fog: false }));
        this.sprite.scale.set(SIZE, SIZE, 1);
        // Over the world and the names, as the crown is
        this.sprite.renderOrder = 17;
        this.sprite.visible = false;
        scene.add(this.sprite);
    }

    // The prayer on now, and where: bottom at y
    show(style: PrayStyle, x: number, y: number, z: number): void {
        if (style !== this.style) {
            this.style = style;
            if (style !== "none") {
                this.sprite.material.map = textureFor(style);
                this.sprite.material.needsUpdate = true;
            }
        }
        this.sprite.visible = style !== "none";
        this.sprite.position.set(x, y + SIZE / 2, z);
    }

    remove(): void {
        this.scene.remove(this.sprite);
        this.sprite.material.dispose();
    }
}
