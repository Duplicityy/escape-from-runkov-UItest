import assert from "node:assert/strict";
import { ControllerDriver, platformGamepads, radialStick, readController, type ControllerHost, type ControllerRun, type PlatformGamepad } from "../src/ui/gamepad";

const button = (pressed: boolean) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 });
const pad = (buttons: number[] = [], axes = [0, 0, 0, 0]) => ({ axes, buttons: Array.from({ length: 17 }, (_, i) => button(buttons.includes(i))) });
assert.deepEqual(radialStick(0.1, -0.1), { x: 0, y: 0 });
const diagonal = radialStick(0.6, -0.8);
assert(Math.abs(diagonal.x - 0.6) < 1e-8 && Math.abs(diagonal.y + 0.8) < 1e-8);
assert(Math.abs(Math.hypot(...Object.values(radialStick(1, 1))) - 1) < 1e-8);
assert.deepEqual(radialStick(NaN, 1), { x: 0, y: 0 });
assert.equal(readController(pad([7])).down[7], true);
const wiredPad: PlatformGamepad = { ...pad([2], [0.6, -0.8, 0, 0]), id: "USB-C gamepad", index: 10001, connected: true, mapping: "standard", timestamp: 1 };
assert.deepEqual(platformGamepads([wiredPad], () => []), [wiredPad], "native Android USB-C input works independently of browser Gamepad support");
assert.deepEqual(platformGamepads([], () => [wiredPad]), [], "unplugging the native pad must not revive a stale browser state");
assert.deepEqual(platformGamepads(undefined, () => [wiredPad]), [wiredPad], "ordinary browser controllers retain their original path");

let enabled = true;
let modal = false;
let mapOpen = false;
let typing = false;
let focused = false;
const actions: string[] = [];
let move = [0, 0];
let interact = false;
let attacks = 0;
let specials = 0;
let camera = [0, 0];
let confirms = 0;
let mapConfirms = 0;
let mapInput: number[] = [];
const run: ControllerRun = {
    get controlsEnabled() { return enabled; },
    setControllerMove(x, z) { move = [x, z]; },
    setControllerInteract(down) { interact = down; },
    requestAttack(down = true) { if (down) attacks++; },
    releaseControllerInput() { move = [0, 0]; interact = false; },
    orbitCamera(x, y) { camera = [x, y]; },
    useSpecial() { specials++; },
};
const host: ControllerHost = {
    run: () => run,
    action: (action) => { actions.push(action); return true; },
    modal: () => modal,
    mapOpen: () => mapOpen,
    mapInput: (...input) => { mapInput = input; },
    mapConfirm: () => { mapConfirms++; },
    typing: () => typing,
    navigate: (direction) => { actions.push(direction); focused = true; },
    confirm: () => { confirms++; },
    focusOwned: () => focused,
    markFocus: () => { focused = true; },
    clearFocus: () => { focused = false; },
};
const driver = new ControllerDriver();
driver.update(pad([2, 7], [0.6, -0.8, 0.8, 0.4]), 0, 0.02, host);
assert.deepEqual(move, [0.6, -0.8]);
assert(interact && attacks === 1 && camera[0] > 0 && camera[1] > 0);
driver.update(pad([6]), 20, 0.02, host);
driver.update(pad([6]), 40, 0.02, host);
assert.equal(specials, 1, "special triggers only on a fresh press");
assert.equal(interact, false, "letting go of X releases interaction");
driver.update(pad([3, 8, 9]), 60, 0.02, host);
assert.deepEqual(actions, ["pause", "map", "inventory"]);
driver.update(pad([3, 8, 9]), 80, 0.02, host);
assert.equal(actions.length, 3, "held UI buttons do not repeatedly toggle panels");

driver.update(pad(), 100, 0.02, host);
driver.update(pad([13]), 120, 0.02, host);
assert.equal(actions.at(-1), "down");
driver.update(pad([13]), 140, 0.02, host);
assert.equal(actions.filter((action) => action === "down").length, 1);
driver.update(pad([13]), 460, 0.02, host);
assert.equal(actions.filter((action) => action === "down").length, 2, "held D-pad repeats after its delay");
driver.update(pad([0]), 480, 0.02, host);
assert.equal(confirms, 1, "A activates owned UI focus");

focused = false;
mapOpen = true;
driver.update(pad([6], [0.8, 0, 0.3, 0.4]), 500, 0.02, host);
assert.deepEqual(move, [0, 0]);
assert.equal(interact, false);
assert(mapInput[0] > 0 && mapInput[4] === -1);
driver.update(pad([0]), 520, 0.02, host);
assert.equal(mapConfirms, 1, "map A uses the discovered-ground route chooser");
assert.equal(specials, 1, "map triggers zoom instead of spending special attack");

mapOpen = false;
const beforeConfirmRelease = attacks;
driver.update(pad([0]), 530, 0.01, host);
assert.equal(attacks, beforeConfirmRelease, "holding a map confirmation cannot become a world attack");
typing = true;
const beforeTyping = attacks;
driver.update(pad([0, 2, 7], [1, 0, 1, 0]), 540, 0.02, host);
assert.deepEqual(move, [0, 0]);
assert.equal(interact, false);
assert.equal(attacks, beforeTyping, "typing never sends controller combat inputs");
const beforeInputNavigation = actions.length;
driver.update(pad([13]), 550, 0.01, host);
assert.equal(actions.length, beforeInputNavigation + 1, "D-pad can leave a focused text field without sending game input");
typing = false;
enabled = false;
driver.update(pad([2, 7], [1, 0, 1, 0]), 560, 0.02, host);
assert.deepEqual(move, [0, 0]);
assert.equal(attacks, beforeTyping, "paused runs reject game inputs");

enabled = true;
driver.update(pad([2], [1, 0, 0, 0]), 580, 0.02, host);
driver.update(undefined, 600, 0.02, host);
assert.deepEqual(move, [0, 0]);
assert.equal(interact, false, "disconnect releases held interaction");
driver.release(true);
driver.update(pad([2], [1, 0, 0, 0]), 620, 0.02, host);
assert.deepEqual(move, [0, 0], "a held stick cannot resume after blur until neutral");
driver.update(pad(), 640, 0.02, host);
driver.update(pad([], [1, 0, 0, 0]), 660, 0.02, host);
assert.equal(move[0], 1);
console.log("Native controller checks passed.");
