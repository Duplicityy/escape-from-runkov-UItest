// Click walking uses the same circle and wall checks as free movement. The
// grid only chooses the route; the player still moves continuously along it.
import type { Tile } from "./region";

type WalkMap = {
    baseX: number;
    baseY: number;
    sizeX: number;
    sizeY: number;
    fits(x: number, z: number, radius: number): boolean;
    crossesWall(fromX: number, fromY: number, toX: number, toY: number): boolean;
    moveAxis(x: number, z: number, dx: number, dz: number, radius: number): [number, number];
};

function pointSegmentDistanceSquared(p: Tile, a: Tile, b: Tile): number {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = dx * dx + dz * dz;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length));
    return (p.x - a.x - dx * t) ** 2 + (p.z - a.z - dz * t) ** 2;
}

function segmentDistanceSquared(a: Tile, b: Tile, c: Tile, d: Tile): number {
    const rx = b.x - a.x;
    const rz = b.z - a.z;
    const sx = d.x - c.x;
    const sz = d.z - c.z;
    const cross = rx * sz - rz * sx;
    if (Math.abs(cross) > 1e-10) {
        const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / cross;
        const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / cross;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
    }
    return Math.min(
        pointSegmentDistanceSquared(a, c, d), pointSegmentDistanceSquared(b, c, d),
        pointSegmentDistanceSquared(c, a, b), pointSegmentDistanceSquared(d, a, b),
    );
}

// A directional wall's endpoint can fall exactly between movement samples.
// Check the entire swept circle against its segment so a diagonal cannot be
// approved just because every sampled move happened to skip a blocked corner.
function clearsWalls(map: WalkMap, from: Tile, to: Tile, radius: number): boolean {
    const clearance = radius + 0.001;
    const minX = Math.floor(Math.min(from.x, to.x) - clearance);
    const maxX = Math.floor(Math.max(from.x, to.x) + clearance);
    const minY = Math.floor(Math.min(-from.z, -to.z) - clearance);
    const maxY = Math.floor(Math.max(-from.z, -to.z) + clearance);
    const clears = (a: Tile, b: Tile): boolean => {
        if (segmentDistanceSquared(from, to, a, b) >= clearance * clearance) return true;
        // A free-movement position may already touch a wall. Allow joining
        // the grid by moving away from it, while actual moveAxis checks below
        // still reject crossing from that starting side through the wall.
        const before = pointSegmentDistanceSquared(from, a, b);
        const after = pointSegmentDistanceSquared(to, a, b);
        const nearT = Math.max(0, Math.min(1, ((from.x - a.x) * (b.x - a.x) + (from.z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2)));
        const away = (from.x - a.x - (b.x - a.x) * nearT) * (to.x - from.x) + (from.z - a.z - (b.z - a.z) * nearT) * (to.z - from.z);
        return before < clearance * clearance && after > before && away >= 0;
    };
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (map.crossesWall(x, y, x + 1, y) && !clears({ x: x + 1, z: -y }, { x: x + 1, z: -(y + 1) })) return false;
            if (map.crossesWall(x, y, x, y + 1) && !clears({ x, z: -(y + 1) }, { x: x + 1, z: -(y + 1) })) return false;
        }
    }
    return true;
}

// Check the actual movement operation, including the leading edge of a body
// at walls. A line-of-sight check alone would let a route cut a wall's corner.
export function canWalkStraight(map: WalkMap, from: Tile, to: Tile, radius: number): boolean {
    if (!clearsWalls(map, from, to, radius)) return false;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.2));
    let x = from.x;
    let z = from.z;
    for (let i = 1; i <= steps; i++) {
        const nx = from.x + (to.x - from.x) * i / steps;
        const nz = from.z + (to.z - from.z) * i / steps;
        [x, z] = map.moveAxis(x, z, nx - x, 0, radius);
        [x, z] = map.moveAxis(x, z, 0, nz - z, radius);
        if (Math.abs(x - nx) > 0.00001 || Math.abs(z - nz) > 0.00001) {
            return false;
        }
    }
    return true;
}

class Frontier {
    private heap: { id: number; score: number }[] = [];

    push(id: number, score: number): void {
        const entry = { id, score };
        let i = this.heap.length;
        this.heap.push(entry);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.heap[parent].score <= score) break;
            this.heap[i] = this.heap[parent];
            i = parent;
        }
        this.heap[i] = entry;
    }

    pop(): number | undefined {
        const first = this.heap[0];
        const last = this.heap.pop();
        if (!first || !last) return undefined;
        if (this.heap.length > 0) {
            let i = 0;
            while (i * 2 + 1 < this.heap.length) {
                let child = i * 2 + 1;
                if (child + 1 < this.heap.length && this.heap[child + 1].score < this.heap[child].score) child++;
                if (last.score <= this.heap[child].score) break;
                this.heap[i] = this.heap[child];
                i = child;
            }
            this.heap[i] = last;
        }
        return first.id;
    }
}

// Returns tile-centred waypoints, excluding the starting position. Clicking
// blocked ground stops at the nearest reachable tile within two tiles of it.
// The search can cover the whole region, including long routes from the map.
export function findWalkPath(map: WalkMap, start: Tile, target: Tile, radius: number): Tile[] {
    const tx = Math.floor(target.x) - map.baseX;
    const ty = Math.floor(-target.z) - map.baseY;
    if (tx < 0 || ty < 0 || tx >= map.sizeX || ty >= map.sizeY) return [];
    const centre = (id: number): Tile => ({
        x: map.baseX + id % map.sizeX + 0.5,
        z: -(map.baseY + Math.floor(id / map.sizeX) + 0.5),
    });
    const goal = centre(tx + ty * map.sizeX);
    if (map.fits(goal.x, goal.z, radius) && canWalkStraight(map, start, goal, radius)) return [goal];

    const total = map.sizeX * map.sizeY;
    const cost = new Float64Array(total).fill(Infinity);
    const previous = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const standable = new Int8Array(total);
    const fits = (id: number): boolean => {
        if (standable[id] === 0) {
            const p = centre(id);
            standable[id] = map.fits(p.x, p.z, radius) ? 1 : -1;
        }
        return standable[id] === 1;
    };
    let goalDistance = Infinity;
    for (let y = Math.max(0, ty - 2); y <= Math.min(map.sizeY - 1, ty + 2); y++) {
        for (let x = Math.max(0, tx - 2); x <= Math.min(map.sizeX - 1, tx + 2); x++) {
            const id = x + y * map.sizeX;
            if (fits(id)) goalDistance = Math.min(goalDistance, Math.hypot(x - tx, y - ty));
        }
    }
    if (goalDistance > 2.01) return [];
    const open = new Frontier();
    const sx = Math.floor(start.x) - map.baseX;
    const sy = Math.floor(-start.z) - map.baseY;
    // Free movement can leave a character off centre or under a canopy. Join
    // the grid through any nearby centre reachable without crossing a trunk.
    for (let y = Math.max(0, sy - 2); y <= Math.min(map.sizeY - 1, sy + 2); y++) {
        for (let x = Math.max(0, sx - 2); x <= Math.min(map.sizeX - 1, sx + 2); x++) {
            const id = x + y * map.sizeX;
            const point = centre(id);
            if (!fits(id) || !canWalkStraight(map, start, point, radius)) continue;
            cost[id] = Math.hypot(point.x - start.x, point.z - start.z);
            open.push(id, cost[id] + Math.hypot(point.x - goal.x, point.z - goal.z));
        }
    }
    let best = -1;
    let closest = Infinity;
    for (let count = 0; count < total; count++) {
        let id = open.pop();
        while (id !== undefined && closed[id]) id = open.pop();
        if (id === undefined) break;
        closed[id] = 1;
        const point = centre(id);
        const distance = Math.hypot(point.x - goal.x, point.z - goal.z);
        if (distance < closest) {
            closest = distance;
            best = id;
        }
        if (distance <= goalDistance) break;
        const x = id % map.sizeX;
        const y = Math.floor(id / map.sizeX);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if ((dx === 0 && dy === 0) || x + dx < 0 || y + dy < 0 || x + dx >= map.sizeX || y + dy >= map.sizeY) continue;
                const next = x + dx + (y + dy) * map.sizeX;
                const nextCost = cost[id] + Math.hypot(dx, dy);
                if (closed[next] || nextCost >= cost[next]) continue;
                const dest = centre(next);
                if (!fits(next) || !canWalkStraight(map, point, dest, radius)) continue;
                cost[next] = nextCost;
                previous[next] = id;
                open.push(next, nextCost + Math.hypot(dest.x - goal.x, dest.z - goal.z));
            }
        }
    }
    if (best < 0 || closest > 2.01) return [];
    const path: Tile[] = [];
    for (let id = best; id !== -1; id = previous[id]) path.push(centre(id));
    path.reverse();
    // Smooth short stretches, always checking the same collision rules. This
    // keeps 360-degree walking rather than forcing the player onto grid axes.
    const smooth: Tile[] = [];
    let from = start;
    for (let i = 0; i < path.length;) {
        let next = i;
        for (let j = i + 1; j < Math.min(path.length, i + 12); j++) {
            if (canWalkStraight(map, from, path[j], radius)) next = j;
        }
        smooth.push(path[next]);
        from = path[next];
        i = next + 1;
    }
    return smooth;
}
