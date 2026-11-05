// Behind the guild's screens: the character, as the save has them, standing
// in Lumbridge castle's courtyard while the camera circles them slowly, the
// way Run Escape's title screen does. It draws to the game canvas whenever a
// run isn't.
import * as THREE from "three";

import { getItem } from "../content/items";
import { Actor } from "./assets";
import { loadMap } from "./mapload";
import { playMusic } from "./music";
import { assetUrl } from "./paths";
import { createPet } from "./pets";
import { PlayerLook } from "./player";
import { loadRegion } from "./region";
import { Character, Equipment } from "./save";
import { settings } from "./settings";

const MENU_WORLD = "lumbridge";
// The camera: this far from the character (the courtyard's inner walls are
// four and a half tiles off), this far down from level (in radians), and
// this fast round them (radians a second: a turn takes most of a minute)
const ORBIT_DISTANCE = 4.6;
const ORBIT_PITCH = 0.5;
const ORBIT_SPEED = 0.12;
// The camera looks this far up the character
const LOOK_HEIGHT = 1.0;
// The view is drawn from this far down the frame, so the character stands
// above the slab of interface at the bottom
const RAISE = 0.1;

export class MenuScene {
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
    private readonly clock = new THREE.Clock();
    private readonly size = new THREE.Vector2();
    private frame?: number;
    private yaw = 0;
    private loading?: Promise<void>;
    // The courtyard's map squares (mapload.ts), kept so they can be taken
    // back after a run on this map has had them in its own scene
    private readonly map = new THREE.Group();
    private readonly parts: THREE.Object3D[] = [];
    // Where the character stands
    private stand?: THREE.Vector3;
    private look?: PlayerLook;
    private lookSignature = "";
    private lookGeneration = 0;
    // The pet that follows, standing by the character
    private pet?: Actor;
    private petId?: string;
    private petGeneration = 0;
    // How far left of the middle the character stands on screen, as a share
    // of the width, for a screen with a panel down its right side; and how
    // far up, as a share of the height, for one with a panel across the
    // bottom (RAISE keeps them above the title's slab otherwise)
    focus = 0;
    raise = RAISE;
    // The camera stays in front instead of circling: for the character
    // screen, where the player turns the character themselves, by this much
    // (radians)
    hold = false;
    spin = 0;

    constructor(private readonly renderer: THREE.WebGLRenderer) {
        // Daylight, as a run has it
        this.scene.background = new THREE.Color(0x7d96b8);
        this.scene.fog = new THREE.Fog(0x7d96b8, 28, 70);
    }

    start(): void {
        if (this.frame !== undefined) {
            return;
        }
        this.loading ??= this.load();
        // A run on this map takes its squares into its own scene and hides
        // floors as it goes: back here, whole
        this.scene.add(this.map);
        for (const part of this.parts) {
            this.map.add(part);
        }
        this.map.traverse((o) => {
            if (/^level\d+$/.test(o.name)) {
                o.visible = true;
            }
        });
        this.clock.start();
        playMusic(assetUrl("assets/music/menu.ogg"));
        const loop = () => {
            this.frame = requestAnimationFrame(loop);
            this.update(this.clock.getDelta());
        };
        loop();
    }

    stop(): void {
        if (this.frame !== undefined) {
            cancelAnimationFrame(this.frame);
            this.frame = undefined;
        }
    }

    // The settings' brightness, on the renderer the menu and runs share
    setBrightness(amount: number): void {
        this.renderer.toneMappingExposure = amount;
    }

    private async load(): Promise<void> {
        const region = await loadRegion(MENU_WORLD);
        const { x, z } = region.spawn;
        this.stand = new THREE.Vector3(x, region.heightAt(x, z), z);
        this.look?.root.position.copy(this.stand);
        this.placePet();
        // The squares round the courtyard only; a run that started meanwhile
        // has them in its own scene, and start() takes them back
        await loadMap(
            region,
            x,
            z,
            (part) => {
                this.parts.push(part);
                if (this.frame !== undefined) {
                    this.map.add(part);
                }
            },
            false,
        ).near;
    }

    // The character as the save has them: a new look when the body, colours
    // or what's worn change; height straight away
    setLook(character: Character, equipment: Equipment): void {
        const signature = JSON.stringify([character.kits, character.colors, equipment]);
        if (signature === this.lookSignature) {
            this.applyLook(character);
            return;
        }
        this.lookSignature = signature;
        const generation = ++this.lookGeneration;
        void PlayerLook.create({ kits: character.kits.slice(), colors: character.colors }, equipment).then((look) => {
            if (generation !== this.lookGeneration) {
                return;
            }
            if (this.look) {
                this.scene.remove(this.look.root);
            }
            this.look = look;
            const weapon = equipment.weapon !== undefined ? getItem(equipment.weapon) : undefined;
            look.stance = weapon?.stance;
            look.current = undefined;
            look.play("idle");
            if (this.stand) {
                look.root.position.copy(this.stand);
            }
            // Facing the camera where it starts, turned as far as the player has
            look.root.rotation.y = this.spin;
            this.scene.add(look.root);
            this.applyLook(character);
        });
    }

    // Colours and height, which change under the same look
    applyLook(character: Character): void {
        if (!this.look) {
            return;
        }
        this.look.restore();
        this.look.root.scale.setScalar(character.size);
    }

    // The pet beside the character: the one the save says follows, or none
    setPet(worldId: string | undefined): void {
        if (worldId === this.petId) {
            return;
        }
        this.petId = worldId;
        const generation = ++this.petGeneration;
        if (this.pet) {
            this.scene.remove(this.pet.root);
            this.pet = undefined;
        }
        if (!worldId) {
            return;
        }
        void createPet(worldId).then((actor) => {
            if (generation !== this.petGeneration) {
                return;
            }
            this.pet = actor;
            this.placePet();
            this.scene.add(actor.root);
        });
    }

    // A step to the character's left and a little back, facing the front
    private placePet(): void {
        if (this.pet && this.stand) {
            this.pet.root.position.set(this.stand.x + 0.9, this.stand.y, this.stand.z + 0.3);
            this.pet.root.rotation.y = 0;
        }
    }

    private update(dt: number): void {
        this.resize();
        const turn = Math.PI * 2;
        if (settings.menuSpin && !this.hold) {
            this.yaw = (this.yaw + dt * ORBIT_SPEED) % turn;
        } else if (this.yaw !== 0) {
            // Back round to the front the short way
            let offset = this.yaw > Math.PI ? this.yaw - turn : this.yaw;
            offset *= Math.exp(-3 * dt);
            this.yaw = Math.abs(offset) < 0.003 ? 0 : (offset + turn) % turn;
        }
        if (this.look) {
            this.look.update(dt);
            this.look.root.rotation.y = this.spin;
        }
        this.pet?.mixer.update(dt);
        const stand = this.stand;
        if (stand) {
            const flat = ORBIT_DISTANCE * Math.cos(ORBIT_PITCH);
            this.camera.position.set(
                stand.x + Math.sin(this.yaw) * flat,
                stand.y + LOOK_HEIGHT + ORBIT_DISTANCE * Math.sin(ORBIT_PITCH),
                stand.z + Math.cos(this.yaw) * flat,
            );
            this.camera.lookAt(stand.x, stand.y + LOOK_HEIGHT, stand.z);
        }
        this.renderer.render(this.scene, this.camera);
    }

    private resize(): void {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.getSize(this.size);
        if (this.size.x !== w || this.size.y !== h) {
            this.renderer.setSize(w, h, false);
        }
        this.camera.aspect = w / h;
        // Drawing the view from this far across and down puts the character
        // left of the middle and above the bottom
        this.camera.setViewOffset(w, h, this.focus * w, this.raise * h, w, h);
        this.camera.updateProjectionMatrix();
    }
}
