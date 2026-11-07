// The other players in a co-op run, as this run draws them: their look
// (built from the loadout they brought), where they are as the last word
// from the network put them, eased towards, their name over their head and
// a health bar under it. run.ts feeds these from the host's snapshots (on a
// guest) or the guests' moves (on the host).
import * as THREE from "three";

import { Actor, play } from "./assets";
import { Loadout } from "./coop";
import { CROWN_SHEET_HEIGHT, DEFAULT_NAME_COLOR, crownSprite, crownVerified, nameColorOf } from "./crown";
import { gearStats } from "./inventory";
import { Overhead } from "./overhead";
import { HERO_ATTACK, HERO_DEATH, HERO_IDLE, HERO_RUN, HeroAnim, HeroState, PRAY_NAMES, prayCode } from "./party";
import { createPet } from "./pets";
import { PlayerLook, RUN_CLIP_SPEED } from "./player";
import { ProtectStyle } from "./run";
import { Equipment } from "./save";

// Eased towards the last position this fast; snapped from further than this
const EASE = 12;
const SNAP_DISTANCE = 5;
const BAR_WIDTH = 0.9;
// A mate's pet (version 72) trots this far behind them, a little to one
// side, at this speed at least, and is put straight there from further than
// this (it's a picture: each browser walks it, through walls if it must)
const PET_FOLLOW = 1.2;
const PET_SPEED = 3.5;
const PET_LEASH = 12;

type MatePet = { actor: Actor; x: number; z: number; facing: number };

// What an enemy on the host needs to know about any hero, this player or
// a mate
export type Hero = {
    id: string;
    name: string;
    x: number;
    z: number;
    facing: number;
    hp: number;
    maxHp: number;
    dead: boolean;
    // Their armour against each style of attack (melee, ranged, magic)
    defenceVs: [number, number, number];
    protect: ProtectStyle;
    // This browser's own
    me: boolean;
};

export class Mate implements Hero {
    x: number;
    z: number;
    facing = 0;
    hp = 100;
    maxHp = 100;
    dead = false;
    defenceVs: [number, number, number] = [0, 0, 0];
    protect: ProtectStyle = "none";
    readonly me = false;
    // Out of the run: extracted, dead and gone, or left
    done = false;
    // Out of it dead: the body stays lying where they fell (version 76)
    corpse = false;
    // When this browser last saw them revived, so a revive isn't sent twice
    // before their word that they're up comes
    revivedAt = -100;
    // Where the last word put them
    private targetX: number;
    private targetZ: number;
    private targetFacing = 0;
    private anim: HeroAnim = HERO_IDLE;
    private attackCount = 0;
    private playedAttacks = 0;
    private diedShown = false;
    look?: PlayerLook;
    // Their name's colour, once their crown has checked out (the HUD's
    // party list uses it too)
    nameColor?: string;
    private label: THREE.Sprite;
    private readonly bar: THREE.Group;
    private readonly fill: THREE.Sprite;
    // A crown and its word over the name, for the game's maker or their
    // playtester (crown.ts)
    private crown?: THREE.Sprite;
    // Their protection prayer's icon (version 103)
    private readonly overhead: Overhead;
    private crownKey?: string;
    private readonly size: number;
    private readonly character: Loadout["character"];
    private readonly crownKeyOf?: string;
    private attackClip: string;
    // Whether they hold a staff, and the animation of the last spell they
    // cast (version 108)
    private staff = false;
    private spellClip?: string;
    // Counts the looks asked for, so a slow one never replaces a newer one
    private lookGeneration = 0;
    private pet?: MatePet;
    private removed = false;

    constructor(
        readonly id: string,
        readonly name: string,
        loadout: Loadout,
        x: number,
        z: number,
        private readonly scene: THREE.Scene,
        private readonly groundY: (x: number, z: number) => number,
    ) {
        this.x = this.targetX = x;
        this.z = this.targetZ = z;
        this.size = loadout.character.size;
        this.character = loadout.character;
        this.attackClip = "attack";
        this.label = nameSprite(name);
        this.scene.add(this.label);
        const { group, fill } = healthBar();
        this.bar = group;
        this.fill = fill;
        this.scene.add(group);
        this.overhead = new Overhead(scene);
        this.crownKey = loadout.crown;
        this.crownKeyOf = loadout.crown;
        if (crownVerified(loadout.crown, () => this.wearCrown())) {
            this.wearCrown();
        }
        this.wear(loadout.equipment);
        if (loadout.pet) {
            void createPet(loadout.pet).then((actor) => {
                if (this.removed || this.corpse) {
                    return;
                }
                this.pet = { actor, x: this.x, z: this.z, facing: 0 };
                actor.root.position.set(this.x, this.groundY(this.x, this.z), this.z);
                this.scene.add(actor.root);
            });
        }
    }

    // Their look in this gear: at the start, and again whenever they change
    // what they wear in the run (the "gear" message). The new look takes the
    // old one's place mid-step.
    wear(equipment: Equipment): void {
        const stats = gearStats(equipment);
        const generation = ++this.lookGeneration;
        void PlayerLook.create(this.character, equipment).then((look) => {
            if (this.removed || generation !== this.lookGeneration) {
                return;
            }
            const old = this.look;
            if (old) {
                this.scene.remove(old.root);
            }
            this.look = look;
            // A staff casts as their last spell was cast, the staff cast
            // until one has been (version 108)
            this.staff = stats.weapon?.uses === "runes";
            this.attackClip = this.staff ? (this.spellClip ?? "cast_staff") : (stats.weapon?.attackClip ?? "attack");
            look.stance = stats.weapon?.stance;
            look.root.scale.setScalar(this.size);
            look.root.position.set(this.x, this.groundY(this.x, this.z), this.z);
            look.root.rotation.y = this.facing;
            look.play(old?.current === "death" ? "death" : old?.current === "run" ? "run" : "idle", { once: old?.current === "death" });
            this.scene.add(look.root);
        });
    }

    // The pet trots after them, to a spot behind and a little to the side
    private updatePet(dt: number): void {
        const pet = this.pet;
        if (!pet) {
            return;
        }
        pet.actor.mixer.update(dt);
        const sin = Math.sin(this.facing);
        const cos = Math.cos(this.facing);
        const tx = this.x - sin * PET_FOLLOW + cos * 0.5;
        const tz = this.z - cos * PET_FOLLOW - sin * 0.5;
        const dx = tx - pet.x;
        const dz = tz - pet.z;
        const dist = Math.hypot(dx, dz);
        if (dist > PET_LEASH) {
            pet.x = tx;
            pet.z = tz;
        } else if (dist > 0.3) {
            const step = Math.min(dist, Math.max(PET_SPEED, dist * 2) * dt);
            pet.x += (dx / dist) * step;
            pet.z += (dz / dist) * step;
            pet.facing = Math.atan2(dx, dz);
            play(pet.actor, "walk");
        } else {
            play(pet.actor, "idle");
        }
        pet.actor.root.position.set(pet.x, this.groundY(pet.x, pet.z), pet.z);
        pet.actor.root.rotation.y = pet.facing;
    }

    private wearCrown(): void {
        const crown = crownVerified(this.crownKey);
        if (!crown || this.crown || this.removed) {
            return;
        }
        this.crown = crownSprite(crown);
        this.scene.add(this.crown);
        // A crown colours the name, if they picked a colour
        const color = nameColorOf(this.character, this.crownKeyOf);
        if (color) {
            this.nameColor = color;
            const old = this.label;
            this.scene.remove(old);
            (old.material as THREE.SpriteMaterial).map?.dispose();
            (old.material as THREE.SpriteMaterial).dispose();
            this.label = nameSprite(this.name, color);
            this.label.position.copy(old.position);
            this.scene.add(this.label);
        }
    }

    // A spell they cast (its shot's word): its own animation from now on
    castWith(clip: string): void {
        this.spellClip = clip;
        if (this.staff) {
            this.attackClip = clip;
        }
    }

    // The last word on where they are and what they're doing
    apply(state: HeroState): void {
        const [, x, z, facing, hp, maxHp, anim, attackCount, dead, pray] = state;
        if (pray !== undefined) {
            this.protect = PRAY_NAMES[pray] ?? "none";
        }
        this.targetX = x;
        this.targetZ = z;
        this.targetFacing = facing;
        this.hp = hp;
        this.maxHp = maxHp;
        this.anim = anim;
        this.attackCount = attackCount;
        const wasDead = this.dead;
        this.dead = dead === 1;
        // Revived: the next fall plays the death again
        if (wasDead && !this.dead) {
            this.diedShown = false;
        }
        if (Math.hypot(x - this.x, z - this.z) > SNAP_DISTANCE) {
            this.x = x;
            this.z = z;
        }
    }

    // The same from a guest's own report (the host's side)
    move(
        x: number,
        z: number,
        facing: number,
        hp: number,
        maxHp: number,
        anim: HeroAnim,
        attackCount: number,
        defenceVs: [number, number, number],
        dead: boolean,
    ): void {
        this.apply([this.id, x, z, facing, hp, maxHp, anim, attackCount, dead ? 1 : 0]);
        this.defenceVs = defenceVs;
    }

    // What the snapshot says of them
    state(): HeroState {
        return [this.id, this.targetX, this.targetZ, this.targetFacing, this.hp, this.maxHp, this.anim, this.attackCount, this.dead ? 1 : 0, prayCode(this.protect)];
    }

    update(dt: number, showBars: boolean): void {
        const k = 1 - Math.exp(-EASE * dt);
        this.x += (this.targetX - this.x) * k;
        this.z += (this.targetZ - this.z) * k;
        let turn = this.targetFacing - this.facing;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        this.facing += turn * k;
        const y = this.groundY(this.x, this.z);
        const look = this.look;
        if (look) {
            look.root.position.set(this.x, y, this.z);
            look.root.rotation.y = this.facing;
            if (this.anim === HERO_DEATH || this.dead) {
                if (!this.diedShown) {
                    this.diedShown = true;
                    look.play("death", { once: true });
                }
            } else if (this.attackCount !== this.playedAttacks) {
                this.playedAttacks = this.attackCount;
                look.play(this.attackClip, { once: true });
            } else if (look.current !== this.attackClip || this.anim !== HERO_ATTACK) {
                // Standing or running; a swing that's played out gives way too
                look.play(this.anim === HERO_RUN ? "run" : "idle", this.anim === HERO_RUN ? { speed: RUN_CLIP_SPEED } : {});
            }
            look.update(dt);
        }
        this.updatePet(dt);
        const top = (this.look?.height ?? 1.6) * this.size;
        this.label.position.set(this.x, y + top + 0.55, this.z);
        // Crown and word over the name
        this.crown?.position.set(this.x, y + top + 0.82 + CROWN_SHEET_HEIGHT / 2, this.z);
        // Their protection over the name (and the crown, if they wear one)
        this.overhead.show(this.dead || this.corpse ? "none" : this.protect, this.x, y + top + (this.crown ? 0.86 + CROWN_SHEET_HEIGHT : 0.78), this.z);
        this.bar.position.set(this.x, y + top + 0.3, this.z);
        this.bar.visible = showBars && !this.dead && this.hp < this.maxHp;
        this.fill.scale.x = Math.max(0.001, this.hp / Math.max(1, this.maxHp)) * BAR_WIDTH;
    }

    // Dead and out of the run: the body stays where it fell, lying down,
    // with the name over it; the health bar and the pet go
    lieDown(): void {
        if (this.removed || this.corpse) {
            return;
        }
        this.corpse = true;
        this.dead = true;
        this.anim = HERO_DEATH;
        if (this.pet) {
            this.scene.remove(this.pet.actor.root);
            this.pet = undefined;
        }
        this.bar.visible = false;
    }

    remove(): void {
        this.removed = true;
        if (this.look) {
            this.scene.remove(this.look.root);
        }
        if (this.pet) {
            this.scene.remove(this.pet.actor.root);
        }
        this.scene.remove(this.label, this.bar);
        this.overhead.remove();
        if (this.crown) {
            this.scene.remove(this.crown);
            this.crown.material.dispose();
        }
        (this.label.material as THREE.SpriteMaterial).map?.dispose();
        (this.label.material as THREE.SpriteMaterial).dispose();
    }
}

// A name floating over a head, in the client's yellow (or a crowned
// player's chosen colour) with a dark edge; a long name is drawn smaller so
// it fits
function nameSprite(name: string, color = DEFAULT_NAME_COLOR): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    let size = 26;
    ctx.font = `${size}px 'OSRS Bold', sans-serif`;
    while (size > 14 && ctx.measureText(name).width > canvas.width - 16) {
        size -= 2;
        ctx.font = `${size}px 'OSRS Bold', sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000";
    ctx.strokeText(name, canvas.width / 2, 25);
    ctx.fillStyle = color;
    ctx.fillText(name, canvas.width / 2, 25);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false, fog: false }),
    );
    sprite.scale.set(3.6, 0.45, 1);
    sprite.renderOrder = 15;
    return sprite;
}

function healthBar(): { group: THREE.Group; fill: THREE.Sprite } {
    const group = new THREE.Group();
    const sprite = (color: number, x: number, width: number, height: number, order: number) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, fog: false, depthWrite: false, toneMapped: false }));
        s.center.set(0, 0.5);
        s.position.set(x, 0, 0);
        s.scale.set(width, height, 1);
        s.renderOrder = order;
        group.add(s);
        return s;
    };
    sprite(0x000000, -BAR_WIDTH / 2 - 0.03, BAR_WIDTH + 0.06, 0.18, 10);
    sprite(0xff0000, -BAR_WIDTH / 2, BAR_WIDTH, 0.12, 11);
    const fill = sprite(0x00ff00, -BAR_WIDTH / 2, BAR_WIDTH, 0.12, 12);
    group.visible = false;
    return { group, fill };
}
