// An exported OSRS region: its collision, ground heights and where things
// are, from public/assets/maps/<id>/region.json. The exporter's coordinates
// are OSRS world tiles (x east, y north); in the scene x stays x, up is y,
// and north runs along -z. Tile (tx, ty) covers scene x in [tx, tx+1) and z
// in (-(ty+1), -ty].
import { Rng } from "./dungeon";
import { assetUrl } from "./paths";

export type Tile = { x: number; z: number };

type RegionJson = {
    id: string;
    name: string;
    baseX: number;
    baseY: number;
    sizeX: number;
    sizeY: number;
    plane: number;
    spawn: { x: number; y: number };
    tiles: number[];
    heights: number[];
    // The plane above's heights: the deck on a bridge tile
    bridgeHeights?: number[];
    tileFlags: number[];
    // Per tile, bit n when floor n above the plane has something over it
    cover?: number[];
    // The map's model as one file per 64 tile map square (the exporter's
    // --tiles), by map square; without it the map is one <id>.glb
    squares?: [number, number][];
    // What blocks on a solid object tile that blocks less than all of it
    // (the exporter's collision, version 109): [tile, x0, y0, x1, y1] each,
    // the box in hundredths of a tile from its south-west corner
    boxes?: number[];
    // Each textured overlay's tile and texture: [tile, texture] each
    // (version 112)
    overlayTextures?: number[];
};

// The cache's water textures: sea, river and pond in their shades (the
// rest of the textured overlays are swamp, lava, planks and paving). The
// cache blocks deep water but not all of it, since in OSRS its banks keep
// you out; with the hills open (version 109) the banks no longer did, and
// heroes and enemies walked out over rivers and the sea. Water is solid to
// walk on since version 112, and seen and shot across as before.
const WATER_TEXTURES = new Set([1, 130, 131, 132, 133, 135, 140, 141, 150, 151, 152, 153, 154, 175, 176]);

// Per tile bits from the exporter
const SOLID = 1;
const WALL_NORTH = 2;
const WALL_EAST = 4;
const WALL_SOUTH = 8;
const WALL_WEST = 16;
// (version 109) floor the cache blocks that isn't water, and an object or
// floor decoration on the tile
const GROUND = 64;
const OBJECT = 128;
// Any wall flag at all on the tile, a side's or a corner post's
const ANY_WALL = 32;

// Hills (version 109): blocked ground that slopes at least HILL_MIN and at
// most HILL_MAX (its corners' heights apart, in tiles) is run over; steeper
// is a cliff and stays. Flat blocked ground (a mountain top, the map's edge)
// stays too, unless it's a pocket of no more than HILL_POCKET tiles among
// the hills.
const HILL_MIN = 0.25;
const HILL_MAX = 3;
const HILL_POCKET = 6;
// tileFlags bits: a bridge's deck, and under a roof (a building's inside,
// or beneath a walkway)
const BRIDGE = 1;
const INSIDE = 2;

// The tiles already used, by region index: a Set, or a look at one that
// takes nothing (for trying tiles before choosing)
export type TileSet = { has(i: number): boolean; add(i: number): unknown };

export class Region {
    readonly id: string;
    readonly baseX: number;
    readonly baseY: number;
    readonly sizeX: number;
    readonly sizeY: number;
    // The model's map squares, when it comes in squares (mapload.ts)
    readonly squares?: [number, number][];
    // The floor the map plays on; map.glb's level<n> nodes above it are
    // buildings' upper storeys and roofs
    readonly plane: number;
    readonly tiles: Uint8Array;
    readonly tileFlags: Uint8Array;
    readonly cover: Uint8Array;
    readonly heights: Int32Array;
    readonly bridgeHeights: Int32Array;
    // Where you arrive, in scene coordinates
    readonly spawn: { x: number; z: number };
    // How many tiles can be stood on
    readonly openTiles: number;
    // Trees and the like: a tree blocks its whole footprint in the cache, two
    // or three tiles square, while its trunk is a stride across, so you'd
    // stop a tile short of it with grass under your feet. Every free
    // standing block of solid tiles up to three a side, outdoors and with no
    // wall on it, is a round obstacle at its middle instead: the ground
    // under the canopy can be walked, and only the trunk stops you. The
    // tiles stay solid for pathing and sight.
    private readonly obstacles: { x: number; z: number; r: number }[] = [];
    private readonly obstacleAt: Int32Array;
    // The box that blocks on each solid tile, x0, y0, x1, y1 in tiles from
    // its south-west corner (y north): all of it but where the export says
    // less (version 109: a signpost by its post, a crate a little in from
    // its open sides)
    private readonly boxes: Float32Array;
    // The hillsides opened (version 109), which don't count as more ground
    // for the map's chests and enemies
    readonly hills: Uint8Array;
    readonly hillTiles: number;
    // Water tiles (version 112): solid, but nothing to sight or a shot
    private readonly water: Uint8Array;

    constructor(json: RegionJson) {
        this.id = json.id;
        this.squares = json.squares;
        this.baseX = json.baseX;
        this.baseY = json.baseY;
        this.sizeX = json.sizeX;
        this.sizeY = json.sizeY;
        this.plane = json.plane;
        this.tiles = Uint8Array.from(json.tiles);
        this.tileFlags = Uint8Array.from(json.tileFlags);
        this.cover = json.cover ? Uint8Array.from(json.cover) : new Uint8Array(json.sizeX * json.sizeY);
        this.heights = Int32Array.from(json.heights);
        this.bridgeHeights = Int32Array.from(json.bridgeHeights ?? json.heights);
        this.spawn = { x: json.spawn.x, z: -json.spawn.y };
        this.water = new Uint8Array(json.sizeX * json.sizeY);
        const textures = json.overlayTextures ?? [];
        for (let k = 0; k + 1 < textures.length; k += 2) {
            const i = textures[k];
            if (WATER_TEXTURES.has(textures[k + 1]) && (this.tileFlags[i] & BRIDGE) === 0) {
                this.water[i] = 1;
                this.tiles[i] |= SOLID;
            }
        }
        let open = 0;
        for (const t of this.tiles) {
            if ((t & SOLID) === 0) {
                open++;
            }
        }
        this.openTiles = open;
        this.hills = new Uint8Array(this.sizeX * this.sizeY);
        this.hillTiles = this.openHills();
        this.boxes = new Float32Array(this.sizeX * this.sizeY * 4);
        for (let i = 0; i < this.sizeX * this.sizeY; i++) {
            this.boxes[i * 4 + 2] = 1;
            this.boxes[i * 4 + 3] = 1;
        }
        const b = json.boxes ?? [];
        for (let k = 0; k + 4 < b.length; k += 5) {
            const i = b[k];
            this.boxes.set([b[k + 1] / 100, b[k + 2] / 100, b[k + 3] / 100, b[k + 4] / 100], i * 4);
        }
        this.obstacleAt = new Int32Array(this.sizeX * this.sizeY).fill(-1);
        this.findObstacles();
        this.spawn = this.standable(this.spawn);
    }

    // The hillsides (HILL_MIN to HILL_MAX) and the small flat pockets among
    // them, made open ground; how many
    private openHills(): number {
        const { sizeX, sizeY, tiles } = this;
        // Blocked ground in the open: not under a roof or anything over it,
        // and with no wall on it (a building's log walls stand on blocked
        // floor that slopes, Rellekka's longhall's do)
        const blockedGround = (i: number) =>
            (tiles[i] & (SOLID | GROUND | OBJECT | ANY_WALL)) === (SOLID | GROUND) &&
            (this.tileFlags[i] & INSIDE) === 0 &&
            this.cover[i] === 0;
        const slope = (i: number) => {
            const x = i % sizeX;
            const y = Math.floor(i / sizeX);
            const stride = sizeX + 1;
            const c = x + y * stride;
            const h = [this.heights[c], this.heights[c + 1], this.heights[c + stride], this.heights[c + stride + 1]];
            return (Math.max(...h) - Math.min(...h)) / 128;
        };
        let opened = 0;
        const open = (i: number) => {
            tiles[i] &= ~SOLID;
            this.hills[i] = 1;
            opened++;
        };
        const flat: number[] = [];
        for (let i = 0; i < tiles.length; i++) {
            if (!blockedGround(i)) {
                continue;
            }
            const s = slope(i);
            if (s >= HILL_MIN && s <= HILL_MAX) {
                open(i);
            } else if (s < HILL_MIN) {
                flat.push(i);
            }
        }
        // A flat patch of blocked ground small enough to be a step in a hill
        const seen = new Uint8Array(tiles.length);
        for (const start of flat) {
            if (seen[start] || !blockedGround(start)) {
                continue;
            }
            const patch = [start];
            seen[start] = 1;
            for (let head = 0; head < patch.length; head++) {
                const i = patch[head];
                const x = i % sizeX;
                const y = Math.floor(i / sizeX);
                for (const [dx, dy] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                ]) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= sizeX || ny >= sizeY) {
                        continue;
                    }
                    const n = nx + ny * sizeX;
                    if (!seen[n] && blockedGround(n) && slope(n) < HILL_MIN) {
                        seen[n] = 1;
                        patch.push(n);
                    }
                }
            }
            if (patch.length <= HILL_POCKET) {
                patch.forEach(open);
            }
        }
        return opened;
    }

    // Whether a region tile index is a hillside opened (version 109)
    isHill(i: number): boolean {
        return this.hills[i] === 1;
    }

    // The spawn as the map gives it can be inside something (Karamja's is
    // in a tree's footprint, which no body fits on, so nobody could take a
    // step): the nearest open tile a body fits on, searched outward a few
    // tiles, or the spawn itself when it's fine
    private standable(p: { x: number; z: number }): { x: number; z: number } {
        const radius = 0.3;
        if (this.isOpen(p.x, p.z) && this.fits(p.x, p.z, radius)) {
            return p;
        }
        for (let ring = 1; ring <= 8; ring++) {
            for (let dy = -ring; dy <= ring; dy++) {
                for (let dx = -ring; dx <= ring; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
                        continue;
                    }
                    const x = p.x + dx;
                    const z = p.z + dy;
                    if (this.isOpen(x, z) && this.fits(x, z, radius)) {
                        return { x, z };
                    }
                }
            }
        }
        return p;
    }

    private findObstacles(): void {
        const { sizeX, sizeY, tiles } = this;
        const seen = new Uint8Array(sizeX * sizeY);
        const walls = WALL_NORTH | WALL_EAST | WALL_SOUTH | WALL_WEST;
        for (let start = 0; start < tiles.length; start++) {
            if (seen[start] || (tiles[start] & SOLID) === 0) {
                continue;
            }
            // The block of solid tiles this one is part of
            const block = [start];
            seen[start] = 1;
            let minX = sizeX;
            let maxX = 0;
            let minY = sizeY;
            let maxY = 0;
            let plain = true;
            for (let head = 0; head < block.length; head++) {
                const i = block[head];
                const x = i % sizeX;
                const y = Math.floor(i / sizeX);
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                // (a pond is no tree)
                if ((tiles[i] & walls) !== 0 || (this.tileFlags[i] & INSIDE) !== 0 || this.water[i] === 1) {
                    plain = false;
                }
                for (const [dx, dy] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                ]) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= sizeX || ny >= sizeY) {
                        continue;
                    }
                    const n = nx + ny * sizeX;
                    if (!seen[n] && (tiles[n] & SOLID) !== 0) {
                        seen[n] = 1;
                        block.push(n);
                    }
                }
            }
            const w = maxX - minX + 1;
            const h = maxY - minY + 1;
            // A full square or oblong, small enough to be one thing
            if (!plain || w > 3 || h > 3 || block.length !== w * h) {
                continue;
            }
            const index = this.obstacles.length;
            this.obstacles.push({
                x: this.baseX + minX + w / 2,
                z: -(this.baseY + minY + h / 2),
                // A bush fills its tile; a bigger thing's trunk is thicker
                r: 0.2 + 0.25 * Math.min(w, h),
            });
            for (const i of block) {
                this.obstacleAt[i] = index;
            }
        }
    }

    // Whether a tile is part of a round obstacle: solid for pathing, but
    // walked around by its circle
    private isRound(tileX: number, tileY: number): boolean {
        const x = tileX - this.baseX;
        const y = tileY - this.baseY;
        if (x < 0 || y < 0 || x >= this.sizeX || y >= this.sizeY) {
            return false;
        }
        return this.obstacleAt[x + y * this.sizeX] !== -1;
    }

    // The tile index of a scene position, -1 off the map
    private index(x: number, z: number): number {
        const tx = this.tileX(x) - this.baseX;
        const ty = this.tileY(z) - this.baseY;
        if (tx < 0 || ty < 0 || tx >= this.sizeX || ty >= this.sizeY) {
            return -1;
        }
        return tx + ty * this.sizeX;
    }

    // Whether a scene position is under a roof, as the cache flags it
    isInside(x: number, z: number): boolean {
        const i = this.index(x, z);
        return i !== -1 && (this.tileFlags[i] & INSIDE) !== 0;
    }

    // Whether anything on a floor above hangs over a scene position: a roof,
    // or an eave, walkway or ledge the roof flag misses
    isCovered(x: number, z: number): boolean {
        const i = this.index(x, z);
        return i !== -1 && ((this.tileFlags[i] & INSIDE) !== 0 || this.cover[i] !== 0);
    }

    // World tile for a scene position
    tileX(x: number): number {
        return Math.floor(x);
    }

    tileY(z: number): number {
        return Math.floor(-z);
    }

    private flags(tileX: number, tileY: number): number {
        const x = tileX - this.baseX;
        const y = tileY - this.baseY;
        if (x < 0 || y < 0 || x >= this.sizeX || y >= this.sizeY) {
            return SOLID;
        }
        return this.tiles[x + y * this.sizeX];
    }

    isOpenTile(tileX: number, tileY: number): boolean {
        return (this.flags(tileX, tileY) & SOLID) === 0;
    }

    isOpen(x: number, z: number): boolean {
        return this.isOpenTile(this.tileX(x), this.tileY(z));
    }

    // Can a circle of this radius sit here? Clear of what blocks on each
    // solid tile it reaches (version 109: the tile's box, all of it but for
    // an object that stands on less), unless the tile is a round obstacle's,
    // and then off its circle
    fits(x: number, z: number, radius: number): boolean {
        const north = -z;
        const r2 = radius * radius;
        for (let ty = Math.floor(north - radius); ty <= Math.floor(north + radius); ty++) {
            for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++) {
                if (this.isOpenTile(tx, ty) || this.isRound(tx, ty)) {
                    continue;
                }
                const lx = tx - this.baseX;
                const ly = ty - this.baseY;
                const inside = lx >= 0 && ly >= 0 && lx < this.sizeX && ly < this.sizeY;
                const b = inside ? (lx + ly * this.sizeX) * 4 : -1;
                const x0 = tx + (b >= 0 ? this.boxes[b] : 0);
                const y0 = ty + (b >= 0 ? this.boxes[b + 1] : 0);
                const x1 = tx + (b >= 0 ? this.boxes[b + 2] : 1);
                const y1 = ty + (b >= 0 ? this.boxes[b + 3] : 1);
                const dx = x - Math.min(Math.max(x, x0), x1);
                const dy = north - Math.min(Math.max(north, y0), y1);
                if (dx * dx + dy * dy < r2) {
                    return false;
                }
            }
        }
        // An obstacle's circle lies within its own tiles, so any that could
        // touch the circle here has a tile under it or next to it
        const tx = this.tileX(x) - this.baseX;
        const ty = this.tileY(z) - this.baseY;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const ox = tx + dx;
                const oy = ty + dy;
                if (ox < 0 || oy < 0 || ox >= this.sizeX || oy >= this.sizeY) {
                    continue;
                }
                const o = this.obstacleAt[ox + oy * this.sizeX];
                if (o !== -1) {
                    const obstacle = this.obstacles[o];
                    if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.r + radius) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    // Whether a step from one tile to a neighbour crosses a wall
    crossesWall(fromX: number, fromY: number, toX: number, toY: number): boolean {
        const from = this.flags(fromX, fromY);
        const to = this.flags(toX, toY);
        if (toY > fromY) {
            return (from & WALL_NORTH) !== 0 || (to & WALL_SOUTH) !== 0;
        }
        if (toY < fromY) {
            return (from & WALL_SOUTH) !== 0 || (to & WALL_NORTH) !== 0;
        }
        if (toX > fromX) {
            return (from & WALL_EAST) !== 0 || (to & WALL_WEST) !== 0;
        }
        if (toX < fromX) {
            return (from & WALL_WEST) !== 0 || (to & WALL_EAST) !== 0;
        }
        return false;
    }

    // Whether a straight line between two scene positions crosses a wall or
    // a solid tile: what a swing, an arrow or a bite can reach. The line is
    // walked tile by tile, one side at a time, so every crossing is a side.
    // A tree's tiles don't stop it (version 94): you walk under the canopy,
    // so you see and swing under it too; only its trunk does, by its circle
    // (else an enemy under a tree, or beside you under one, could neither
    // hit nor be hit fairly, and a tree made a safe spot).
    lineOfSight(x0: number, z0: number, x1: number, z1: number): boolean {
        const trunks: number[] = [];
        if (!this.lineThroughTiles(x0, z0, x1, z1, trunks)) {
            return false;
        }
        for (const o of trunks) {
            const t = this.obstacles[o];
            if (segmentDistance(x0, z0, x1, z1, t.x, t.z) < t.r) {
                return false;
            }
        }
        return true;
    }

    private lineThroughTiles(x0: number, z0: number, x1: number, z1: number, trunks: number[]): boolean {
        let tx = this.tileX(x0);
        let ty = this.tileY(z0);
        const ex = this.tileX(x1);
        const ey = this.tileY(z1);
        const dx = x1 - x0;
        const dy = -(z1 - z0);
        const y0 = -z0;
        const stepX = Math.sign(dx);
        const stepY = Math.sign(dy);
        let nextX = dx !== 0 ? (stepX > 0 ? tx + 1 - x0 : x0 - tx) / Math.abs(dx) : Infinity;
        let nextY = dy !== 0 ? (stepY > 0 ? ty + 1 - y0 : y0 - ty) / Math.abs(dy) : Infinity;
        const perX = dx !== 0 ? 1 / Math.abs(dx) : Infinity;
        const perY = dy !== 0 ? 1 / Math.abs(dy) : Infinity;
        for (let steps = 0; (tx !== ex || ty !== ey) && steps < 512; steps++) {
            let nx = tx;
            let ny = ty;
            if (nextX < nextY) {
                nx += stepX;
                nextX += perX;
            } else {
                ny += stepY;
                nextY += perY;
            }
            if (this.crossesWall(tx, ty, nx, ny)) {
                return false;
            }
            if (!this.isOpenTile(nx, ny) && !this.isWaterTile(nx, ny) && !(nx === ex && ny === ey)) {
                // A tree's tile: the line goes on, and its trunk is checked
                const o = this.obstacleAtTile(nx, ny);
                if (o === -1) {
                    return false;
                }
                if (!trunks.includes(o)) {
                    trunks.push(o);
                }
            }
            tx = nx;
            ty = ny;
        }
        // The ends' own tiles may be under a tree too
        for (const [x, z] of [
            [x0, z0],
            [x1, z1],
        ]) {
            const o = this.obstacleAtTile(this.tileX(x), this.tileY(z));
            if (o !== -1 && !trunks.includes(o)) {
                trunks.push(o);
            }
        }
        return true;
    }

    // Whether a body this big could walk straight from one point to another:
    // it fits all along the way (a few points on it, past any trunk) and no
    // wall is crossed
    clearWalk(x0: number, z0: number, x1: number, z1: number, radius: number): boolean {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const steps = Math.max(2, Math.ceil(len / 0.25));
        let px = this.tileX(x0);
        let py = this.tileY(z0);
        for (let i = 1; i <= steps; i++) {
            const x = x0 + ((x1 - x0) * i) / steps;
            const z = z0 + ((z1 - z0) * i) / steps;
            if (!this.fits(x, z, radius)) {
                return false;
            }
            const tx = this.tileX(x);
            const ty = this.tileY(z);
            if ((tx !== px || ty !== py) && Math.abs(tx - px) + Math.abs(ty - py) === 1 && this.crossesWall(px, py, tx, ty)) {
                return false;
            }
            px = tx;
            py = ty;
        }
        return true;
    }

    // Whether a world tile is water, which blocks a body but not a look or
    // a shot (version 112)
    private isWaterTile(tileX: number, tileY: number): boolean {
        const x = tileX - this.baseX;
        const y = tileY - this.baseY;
        if (x < 0 || y < 0 || x >= this.sizeX || y >= this.sizeY) {
            return false;
        }
        return this.water[x + y * this.sizeX] === 1 && (this.tiles[x + y * this.sizeX] & OBJECT) === 0;
    }

    // The round obstacle a tile is part of, or -1
    private obstacleAtTile(tileX: number, tileY: number): number {
        const x = tileX - this.baseX;
        const y = tileY - this.baseY;
        if (x < 0 || y < 0 || x >= this.sizeX || y >= this.sizeY) {
            return -1;
        }
        return this.obstacleAt[x + y * this.sizeX];
    }

    // Steps from a position to the target on a flow field, from where it
    // stands or, if that's no step at all (under a tree's canopy, whose tiles
    // the field goes round), from the nearest tile within two that has one
    // and can be walked to straight (not through the trunk); with that tile,
    // to walk to. -1 when there's none near.
    nearestFlow(flow: Int16Array, x: number, z: number, radius: number): { steps: number; x: number; z: number } {
        const here = this.flowAt(flow, x, z);
        if (here !== -1) {
            return { steps: here, x, z };
        }
        const tx = this.tileX(x);
        const ty = this.tileY(z);
        let best = { steps: -1, x, z };
        let bestScore = Infinity;
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const cx = tx + dx + 0.5;
                const cz = -(ty + dy + 0.5);
                const n = this.flowAt(flow, cx, cz);
                if (n === -1 || !this.clearWalk(x, z, cx, cz, radius)) {
                    continue;
                }
                // The nearest way off, the shorter way round on a tie
                const score = Math.hypot(cx - x, cz - z) + n * 0.1;
                if (score < bestScore) {
                    bestScore = score;
                    best = { steps: n, x: cx, z: cz };
                }
            }
        }
        return best;
    }

    // A move along one axis, stopped by solid tiles and walls
    moveAxis(x: number, z: number, dx: number, dz: number, radius: number): [number, number] {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.fits(nx, nz, radius)) {
            return [x, z];
        }
        const fromX = this.tileX(x);
        const fromY = this.tileY(z);
        // The leading edge of the circle decides the tile it enters
        const toX = this.tileX(nx + Math.sign(dx) * radius);
        const toY = this.tileY(nz + Math.sign(dz) * radius);
        if ((toX !== fromX || toY !== fromY) && this.crossesWall(fromX, fromY, toX, toY)) {
            return [x, z];
        }
        return [nx, nz];
    }

    // The tile under a position: which, how far across it, and its four
    // corner heights in scene units (the deck's on a bridge, kept a plane up)
    private tileCorners(x: number, z: number): { fx: number; fy: number; h00: number; h10: number; h01: number; h11: number } {
        const lx = Math.min(Math.max(x - this.baseX, 0), this.sizeX - 0.001);
        const ly = Math.min(Math.max(-z - this.baseY, 0), this.sizeY - 0.001);
        const tx = Math.floor(lx);
        const ty = Math.floor(ly);
        const stride = this.sizeX + 1;
        const i = tx + ty * stride;
        const heights = (this.tileFlags[tx + ty * this.sizeX] & BRIDGE) !== 0 ? this.bridgeHeights : this.heights;
        return {
            fx: lx - tx,
            fy: ly - ty,
            h00: -heights[i] / 128,
            h10: -heights[i + 1] / 128,
            h01: -heights[i + stride] / 128,
            h11: -heights[i + stride + 1] / 128,
        };
    }

    // Ground height in scene units at a position, from the tile corner heights
    heightAt(x: number, z: number): number {
        const { fx, fy, h00, h10, h01, h11 } = this.tileCorners(x, z);
        const south = h00 + (h10 - h00) * fx;
        const north = h01 + (h11 - h01) * fx;
        return south + (north - south) * fy;
    }

    // How much the tile under a position slopes: its highest corner less its
    // lowest, in scene units (tiles)
    cornerRange(x: number, z: number): number {
        const { h00, h10, h01, h11 } = this.tileCorners(x, z);
        return Math.max(h00, h10, h01, h11) - Math.min(h00, h10, h01, h11);
    }

    // The tile's highest corner: where a flat thing (a chest, the trapdoor)
    // stands with no part of it under the ground
    topAt(x: number, z: number): number {
        const { h00, h10, h01, h11 } = this.tileCorners(x, z);
        return Math.max(h00, h10, h01, h11);
    }

    // Steps from every tile to the target, for chasing; -1 where unreachable.
    // Indexed x + y * sizeX in region tiles.
    flowField(target: Tile): Int16Array {
        const dist = new Int16Array(this.sizeX * this.sizeY).fill(-1);
        const tx = this.tileX(target.x) - this.baseX;
        const ty = this.tileY(target.z) - this.baseY;
        if (tx < 0 || ty < 0 || tx >= this.sizeX || ty >= this.sizeY) {
            return dist;
        }
        const queue: number[] = [tx + ty * this.sizeX];
        dist[queue[0]] = 0;
        for (let head = 0; head < queue.length; head++) {
            const cur = queue[head];
            const x = cur % this.sizeX;
            const y = Math.floor(cur / this.sizeX);
            for (const [dx, dy] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= this.sizeX || ny >= this.sizeY) {
                    continue;
                }
                const n = nx + ny * this.sizeX;
                if (dist[n] !== -1 || (this.tiles[n] & SOLID) !== 0) {
                    continue;
                }
                if (this.crossesWall(this.baseX + x, this.baseY + y, this.baseX + nx, this.baseY + ny)) {
                    continue;
                }
                dist[n] = dist[cur] + 1;
                queue.push(n);
            }
        }
        return dist;
    }

    // The flow field's value at a scene position
    flowAt(flow: Int16Array, x: number, z: number): number {
        const tx = this.tileX(x) - this.baseX;
        const ty = this.tileY(z) - this.baseY;
        if (tx < 0 || ty < 0 || tx >= this.sizeX || ty >= this.sizeY) {
            return -1;
        }
        return flow[tx + ty * this.sizeX];
    }

    // The middle of a random open tile that can be walked to from the spawn
    // and is at least minDistance tiles from it
    randomTile(rng: Rng, reach: Int16Array, minDistance: number, taken: TileSet): Tile | undefined {
        for (let tries = 0; tries < 200; tries++) {
            const x = Math.floor(rng() * this.sizeX);
            const y = Math.floor(rng() * this.sizeY);
            const i = x + y * this.sizeX;
            if (reach[i] < minDistance || taken.has(i)) {
                continue;
            }
            taken.add(i);
            return { x: this.baseX + x + 0.5, z: -(this.baseY + y + 0.5) };
        }
        return undefined;
    }
}

// How far a point is from a line segment
function segmentDistance(x0: number, z0: number, x1: number, z1: number, px: number, pz: number): number {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / len2)) : 0;
    return Math.hypot(x0 + t * dx - px, z0 + t * dz - pz);
}

export async function loadRegion(id: string): Promise<Region> {
    const response = await fetch(assetUrl(`assets/maps/${id}.json`));
    if (!response.ok) {
        throw new Error(`No region for map ${id}`);
    }
    return new Region((await response.json()) as RegionJson);
}
