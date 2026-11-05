// Touch controls for a run on a phone or tablet: a stick that appears under
// the thumb anywhere on the left of the screen (or stays in a ring at the
// bottom left, with the setting), and under the right thumb a cluster: one
// big button for whatever's near (open a chest, dig, trade, hold to escape;
// it's E), with Eat, Pray and Spec in an arc above it. Pack and Pause sit
// by the minimap, out of the fight. The potion slots are tapped as they
// are, and a tap on the world swings. Only on a coarse pointer; style.css
// shows them there and nowhere else.
import { getItem } from "../content/items";
import { Run } from "../game/run";
import { settings } from "../game/settings";

type Protect = Run["protect"];

export const isTouch = (() => {
    try {
        return window.matchMedia("(pointer: coarse)").matches;
    } catch {
        return false;
    }
})();

// How far the knob travels, in pixels, and how far it has to go to count
const STICK_RADIUS = 56;
const DEAD_ZONE = 0.15;
// Holding Pray this long opens the fan of protections; letting go sooner is
// a tap, which toggles the last one
const PRAY_HOLD_MS = 220;
// Below this share of hitpoints the HUD shouts (the red edges, the Eat ring)
export const HURT_SHARE = 0.4;

// A phone's browser scrolls the page to bring a focused input into view
// (the keyboard, the name box) and can leave it scrolled afterwards, with
// everything drawn one place and touched another. Keep the page at the top.
if (isTouch) {
    const home = () => window.scrollTo(0, 0);
    window.addEventListener("focusout", () => setTimeout(home, 50));
    window.addEventListener("orientationchange", () => setTimeout(home, 100));
    window.visualViewport?.addEventListener("resize", home);
    window.visualViewport?.addEventListener("scroll", home);

    // An iPhone ignores the viewport's no-scaling rule: a pinch (two thumbs
    // on the screen, with a stick, is easy) or a double tap zooms the whole
    // page, and a zoomed page draws in one place and takes touches in
    // another. Safari's own gesture events are what stop it there.
    const stop = (e: Event) => e.preventDefault();
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
        document.addEventListener(type, stop, { passive: false });
    }
    document.addEventListener(
        "touchmove",
        (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        },
        { passive: false },
    );
}

export type TouchHooks = {
    togglePack(): void;
    pause(): void;
    // The full map (version 91)
    openMap(): void;
};

export type TouchControls = {
    // The stick's zone: first into the HUD, so everything after it takes
    // its own taps
    zone: HTMLElement;
    // Pack, Map and Pause, under the minimap
    corner: HTMLElement;
    // The right thumb's buttons
    cluster: HTMLElement;
    // The labels, badges and states, from the run (each HUD update)
    update(): void;
};

function div(className: string, text?: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = className;
    if (text !== undefined) {
        el.textContent = text;
    }
    return el;
}

// Keeps the pointer's moves coming to the element once it's left it; a
// pointer the browser doesn't know (a scripted one) can't be captured, and
// that's no reason to stop
function capture(el: Element, e: PointerEvent): void {
    try {
        el.setPointerCapture(e.pointerId);
    } catch {
        // Not a live pointer
    }
}

// What the big button does right now, from the run's prompt (which names
// the E key for a keyboard): its word, a second line, and whether it's
// lit. It presses E whatever it says, so holding always works.
export function mainButtonText(prompt: string): { label: string; sub: string; lit: boolean } {
    if (/^Escaping/.test(prompt)) {
        return { label: "Escaping", sub: "keep holding", lit: true };
    }
    if (/^Hold E to escape/.test(prompt)) {
        return { label: "Escape", sub: "hold", lit: true };
    }
    if (/^Reviving/.test(prompt)) {
        return { label: "Reviving", sub: "keep holding", lit: true };
    }
    if (/^Hold E to revive/.test(prompt)) {
        return { label: "Revive", sub: "hold", lit: true };
    }
    const press = /^Press E to (\w+)/.exec(prompt);
    if (press) {
        const verb = press[1];
        return { label: verb[0].toUpperCase() + verb.slice(1), sub: "", lit: true };
    }
    if (/locked|closed/i.test(prompt)) {
        return { label: "Locked", sub: "", lit: false };
    }
    return { label: "Use", sub: "", lit: false };
}

// What the run's prompt says on a touch screen, where the big button is E
export function touchPrompt(prompt: string): string {
    return prompt
        .replace(/^Hold E to escape/, "Hold Escape")
        .replace(/^Hold E to revive/, "Hold the button to revive")
        .replace(/^Press E to /, "Tap the button to ");
}

const PROTECT_LABEL: Record<Protect, string> = { none: "Pray", melee: "Melee", ranged: "Ranged", magic: "Magic" };

// The controls, wired to the run
export function touchControls(run: Run, hooks: TouchHooks): TouchControls {
    run.markTarget = true;

    // The stick
    const zone = div("touch-zone");
    const rest = div("touch-rest");
    rest.append(div("touch-rest-knob"));
    const base = div("touch-stick");
    const knob = div("touch-knob");
    base.append(knob);
    base.hidden = true;
    zone.append(rest, base);

    let pointer: number | undefined;
    let originX = 0;
    let originY = 0;
    const place = (x: number, y: number) => {
        knob.style.transform = `translate(${x}px, ${y}px)`;
    };
    const steer = (clientX: number, clientY: number) => {
        const dx = clientX - originX;
        const dy = clientY - originY;
        const len = Math.hypot(dx, dy);
        const reach = Math.min(1, len / STICK_RADIUS);
        place(len > 0 ? (dx / len) * reach * STICK_RADIUS : 0, len > 0 ? (dy / len) * reach * STICK_RADIUS : 0);
        // Screen right is east and screen up is north, which is -z
        if (reach < DEAD_ZONE || len === 0) {
            run.stick.x = 0;
            run.stick.z = 0;
        } else {
            run.stick.x = (dx / len) * reach;
            run.stick.z = (dy / len) * reach;
        }
    };
    zone.onpointerdown = (e) => {
        if (pointer !== undefined) {
            return;
        }
        e.preventDefault();
        pointer = e.pointerId;
        capture(zone, e);
        const rect = zone.getBoundingClientRect();
        if (settings.fixedStick) {
            // The stick stays in its ring; the thumb steers from its centre
            const ring = rest.getBoundingClientRect();
            originX = ring.left + ring.width / 2;
            originY = ring.top + ring.height / 2;
        } else {
            originX = e.clientX;
            originY = e.clientY;
        }
        base.style.left = `${originX - rect.left}px`;
        base.style.top = `${originY - rect.top}px`;
        base.hidden = false;
        rest.hidden = true;
        steer(e.clientX, e.clientY);
    };
    zone.onpointermove = (e) => {
        if (e.pointerId === pointer) {
            steer(e.clientX, e.clientY);
        }
    };
    const release = (e: PointerEvent) => {
        if (e.pointerId !== pointer) {
            return;
        }
        pointer = undefined;
        base.hidden = true;
        rest.hidden = false;
        run.stick.x = 0;
        run.stick.z = 0;
    };
    zone.onpointerup = release;
    zone.onpointercancel = release;

    // A round or square button: label lines, pressed on the way down
    const button = (className: string, lines: string[], down: (e: PointerEvent) => void, up?: (e: PointerEvent) => void) => {
        const b = document.createElement("button");
        b.className = `touch-button ${className}`;
        b.append(...lines.map((text, i) => div(i === 0 ? "touch-label" : "touch-sub", text)));
        b.onpointerdown = (e) => {
            e.preventDefault();
            capture(b, e);
            down(e);
        };
        if (up) {
            b.onpointerup = up;
            b.onpointercancel = up;
        }
        return b;
    };

    // Pack, Map and Pause, by the minimap
    const corner = div("touch-corner");
    corner.append(
        button("touch-square", ["Pack"], () => hooks.togglePack()),
        button("touch-square", ["Map"], () => hooks.openMap()),
        button("touch-square", ["Pause"], () => hooks.pause()),
    );

    // The right thumb's cluster
    const cluster = div("touch-cluster");
    const main = button(
        "touch-main",
        ["Use", ""],
        () => run.press("KeyE", true),
        () => run.press("KeyE", false),
    );
    const mainLabel = main.firstElementChild as HTMLElement;
    const mainSub = main.lastElementChild as HTMLElement;
    const eat = button("touch-eat", ["Eat"], () => run.eatHotkey());
    const badge = div("touch-badge");
    eat.append(badge);
    const spec = button("touch-spec", ["Spec"], () => run.useSpecial());

    // Pray: a tap toggles the last protection; a hold opens the fan
    let last: Protect = "melee";
    let prayPointer: number | undefined;
    let holdTimer: number | undefined;
    let fanOpen = false;
    const fan = div("touch-fan");
    fan.hidden = true;
    const options: HTMLElement[] = (["melee", "ranged", "magic", "none"] as const).map((style) => {
        const o = div(`touch-option ${style}`, style === "none" ? "Off" : PROTECT_LABEL[style]);
        o.dataset.style = style;
        fan.append(o);
        return o;
    });
    const optionAt = (x: number, y: number): Protect | undefined => {
        const hit = document.elementFromPoint(x, y)?.closest(".touch-option") as HTMLElement | null;
        return hit?.dataset.style as Protect | undefined;
    };
    const highlight = (style: Protect | undefined) => {
        for (const o of options) {
            o.classList.toggle("under", o.dataset.style === style);
        }
    };
    const openFan = () => {
        holdTimer = undefined;
        fanOpen = true;
        fan.hidden = false;
        cluster.classList.add("fan-open");
        for (const o of options) {
            o.classList.toggle("on", o.dataset.style === run.protect);
        }
    };
    const closeFan = () => {
        fanOpen = false;
        fan.hidden = true;
        cluster.classList.remove("fan-open");
        highlight(undefined);
    };
    const choose = (style: Protect) => {
        if (style === "none") {
            run.setProtect("none");
        } else {
            last = style;
            // setProtect turns the same style off again; picking it keeps it
            if (run.protect !== style) {
                run.setProtect(style);
            }
        }
    };
    const pray = button("touch-pray", ["Pray"], (e) => {
        prayPointer = e.pointerId;
        window.clearTimeout(holdTimer);
        holdTimer = window.setTimeout(openFan, PRAY_HOLD_MS);
    });
    const prayLabel = pray.firstElementChild as HTMLElement;
    pray.onpointermove = (e) => {
        if (fanOpen && e.pointerId === prayPointer) {
            highlight(optionAt(e.clientX, e.clientY));
        }
    };
    const prayUp = (e: PointerEvent, cancelled: boolean) => {
        if (e.pointerId !== prayPointer) {
            return;
        }
        prayPointer = undefined;
        window.clearTimeout(holdTimer);
        holdTimer = undefined;
        if (fanOpen) {
            const pick = cancelled ? undefined : optionAt(e.clientX, e.clientY);
            closeFan();
            if (pick) {
                choose(pick);
            }
        } else if (!cancelled) {
            if (run.protect !== "none") {
                last = run.protect;
                run.setProtect("none");
            } else {
                run.setProtect(last);
            }
        }
    };
    pray.onpointerup = (e) => prayUp(e, false);
    pray.onpointercancel = (e) => prayUp(e, true);

    const dim = div("touch-dim");
    cluster.append(dim, main, eat, spec, fan, pray);

    let labelShown = "";
    const update = () => {
        const text = mainButtonText(run.prompt);
        if (text.label !== labelShown) {
            labelShown = text.label;
            mainLabel.textContent = text.label;
        }
        mainSub.textContent = text.sub;
        main.classList.toggle("lit", text.lit);
        const food = run.inventory.reduce((n, s) => n + (getItem(s.id).heal ? s.count : 0), 0);
        badge.textContent = food > 0 ? String(food) : "";
        eat.classList.toggle("none", food === 0);
        eat.classList.toggle("urgent", food > 0 && run.hp < run.maxHp * HURT_SHARE);
        prayLabel.textContent = PROTECT_LABEL[run.protect];
        pray.classList.toggle("on", run.protect !== "none");
        pray.classList.toggle("none", run.prayer <= 0 && run.protect === "none");
        spec.classList.toggle("ready", run.specReady);
        rest.classList.toggle("fixed", settings.fixedStick);
    };
    update();
    return { zone, corner, cluster, update };
}

// Whether the page can go full screen, and a switch for it
export function fullscreenButton(): HTMLButtonElement | undefined {
    if (!document.fullscreenEnabled) {
        return undefined;
    }
    const b = document.createElement("button");
    b.textContent = "Fullscreen";
    b.title = "The game over the whole screen; press again, or Esc, to come back";
    b.onclick = () => {
        if (document.fullscreenElement) {
            void document.exitFullscreen();
        } else {
            void document.documentElement
                .requestFullscreen()
                .then(lockLandscape)
                .catch(() => undefined);
        }
    };
    return b;
}

// Phones play sideways only: where the browser allows it (full screen, and
// not an iPhone), the screen is held there
export function lockLandscape(): void {
    const orientation = screen.orientation as unknown as { lock?: (kind: string) => Promise<void> } | undefined;
    orientation?.lock?.("landscape").catch(() => undefined);
}

if (isTouch) {
    document.addEventListener("fullscreenchange", () => {
        if (document.fullscreenElement) {
            lockLandscape();
        }
    });
}
