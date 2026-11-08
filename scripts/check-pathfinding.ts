import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { canWalkStraight, findWalkPath } from "../src/game/pathfinding";
import { Region, type Tile } from "../src/game/region";

function makeMap(width: number, height: number, edit: (tiles: number[], index: (x: number, y: number) => number) => void = () => {}): Region {
    const tiles = Array(width * height).fill(0);
    edit(tiles, (x, y) => x + y * width);
    return new Region({
        id: "path-test", name: "Path test", baseX: 3000, baseY: 3200,
        sizeX: width, sizeY: height, plane: 0,
        spawn: { x: 3001.5, y: 3201.5 }, tiles,
        heights: Array((width + 1) * (height + 1)).fill(0),
        tileFlags: Array(width * height).fill(0),
    });
}
const point = (x: number, y: number): Tile => ({ x: 3000 + x + 0.5, z: -(3200 + y + 0.5) });
const radius = 0.25;
function validate(map: Region, start: Tile, route: Tile[]): void {
    assert(route.length > 0, "a reachable target must return a route");
    let previous = start;
    for (const waypoint of route) {
        assert(map.fits(waypoint.x, waypoint.z, radius), "waypoints must fit the player's body");
        assert(canWalkStraight(map, previous, waypoint, radius), "every segment must obey actual movement collisions");
        previous = waypoint;
    }
}

// Follow the route with the run's actual x-then-z operation and frame-sized
// strides. Merely asking canWalkStraight again can repeat a planner bug.
function follow(map: Region, start: Tile, route: Tile[]): void {
    for (const speed of [3.5, 5.46]) {
        let { x, z } = start;
        let frame = 0;
        for (const waypoint of route) {
            let stuck = 0;
            let reached = false;
            for (let i = 0; i < 20_000; i++) {
                const distance = Math.hypot(waypoint.x - x, waypoint.z - z);
                if (distance <= 0.00001) {
                    reached = true;
                    break;
                }
                const dt = [0.05, 1 / 60, 0.033][frame++ % 3];
                const step = Math.min(speed * dt, distance);
                const beforeX = x;
                const beforeZ = z;
                [x, z] = map.moveAxis(x, z, (waypoint.x - x) / distance * step, 0, radius);
                [x, z] = map.moveAxis(x, z, 0, (waypoint.z - beforeZ) / distance * step, radius);
                stuck = Math.hypot(x - beforeX, z - beforeZ) < step * 0.1 ? stuck + dt : 0;
                assert(stuck <= 0.5, `route follower stalled before ${JSON.stringify(waypoint)} at speed ${speed}`);
            }
            assert(reached, "each route waypoint must be reached with real frame-sized movement");
        }
        assert(Math.hypot(x - route.at(-1)!.x, z - route.at(-1)!.z) <= 0.00001);
    }
}

const open = makeMap(16, 16);
const diagonal = findWalkPath(open, point(1, 1), point(13, 12), radius);
assert.deepEqual(diagonal, [point(13, 12)], "clear diagonal walking should stay continuous");

const detour = makeMap(16, 16, (tiles, index) => {
    for (let y = 0; y < 13; y++) tiles[index(7, y)] = 1 | 2;
});
const detourRoute = findWalkPath(detour, point(2, 2), point(12, 2), radius);
validate(detour, point(2, 2), detourRoute);
assert.deepEqual(detourRoute.at(-1), point(12, 2));
assert(detourRoute.some((p) => -p.z > 3213), "the route must go round the wall's distant opening");

const wall = makeMap(16, 16, (tiles, index) => {
    // No solid tiles: directional collision alone must stop a body.
    for (let y = 0; y < 12; y++) tiles[index(7, y)] = 4;
});
const wallRoute = findWalkPath(wall, point(2, 2), point(12, 2), radius);
validate(wall, point(2, 2), wallRoute);
assert.deepEqual(wallRoute.at(-1), point(12, 2));
assert(wallRoute.some((p) => -p.z > 3212), "directional walls cannot be crossed diagonally");

const isolated = makeMap(16, 16, (tiles, index) => {
    for (let y = 0; y < 16; y++) tiles[index(7, y)] = 1 | 2;
});
assert.deepEqual(findWalkPath(isolated, point(2, 2), point(12, 2), radius), [], "unreachable areas must not start a misleading route");

const blocked = makeMap(16, 16, (tiles, index) => { tiles[index(8, 8)] = 1 | 2; });
const nearBlocked = findWalkPath(blocked, point(2, 2), point(8, 8), radius);
validate(blocked, point(2, 2), nearBlocked);
assert(Math.hypot(nearBlocked.at(-1)!.x - point(8, 8).x, nearBlocked.at(-1)!.z - point(8, 8).z) <= 2, "blocked destination must snap nearby");

// Regression for a real Lumbridge corner: a north/south wall terminates
// beside a round obstacle. A 45-degree segment sampled in exact eighth-tile
// increments appeared clear, but real frame strides hit the wall endpoint.
const corner = makeMap(16, 16, (tiles, index) => {
    tiles[index(7, 7)] = 34;
    tiles[index(8, 7)] = 34;
    tiles[index(7, 8)] = 40;
    tiles[index(8, 8)] = 40;
    tiles[index(9, 8)] = 129;
});
const cornerStart = point(9, 7);
const cornerTarget = point(8, 8);
assert(!canWalkStraight(corner, cornerStart, cornerTarget, radius), "a sampled diagonal must not skip a wall endpoint");
const cornerRoute = findWalkPath(corner, cornerStart, cornerTarget, radius);
validate(corner, cornerStart, cornerRoute);
follow(corner, cornerStart, cornerRoute);
assert.deepEqual(cornerRoute.at(-1), cornerTarget);

const offCentre = { x: 3002.18, z: -3202.27 };
validate(detour, offCentre, findWalkPath(detour, offCentre, point(12, 2), radius));
assert.deepEqual(findWalkPath(open, point(2, 2), { x: 2999, z: -3202 }, radius), [], "off-map destinations must be rejected");

// A route crossing a 192 x 256 region through alternating distant gates
// exercises a full-map journey, rather than a short local click.
const large = makeMap(192, 256, (tiles, index) => {
    for (let x = 24; x < 170; x += 24) {
        const bottomGate = (x / 24) % 2 === 1;
        for (let y = 0; y < 256; y++) {
            if (bottomGate ? y < 248 : y > 7) tiles[index(x, y)] = 1 | 2;
        }
    }
});
const started = performance.now();
const longRoute = findWalkPath(large, point(2, 2), point(185, 250), radius);
validate(large, point(2, 2), longRoute);
follow(large, point(2, 2), longRoute);
assert.deepEqual(longRoute.at(-1), point(185, 250), "long map routes must reach their destination without a local search cutoff");
console.log(`Pathfinding checks passed (long map route: ${longRoute.length} waypoints, ${Math.round(performance.now() - started)} ms).`);
