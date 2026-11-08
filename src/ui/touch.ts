// Two narrow thumbstick zones leave the rest of the world free for tap
// walking and camera gestures. Move keeps the existing continuous movement;
// Aim/attack uses the existing manual swing and its cooldown. The contextual
// button still holds E for extraction, revival and nearby interactions.
import { Run } from "../game/run";
import { settings } from "../game/settings";

export const isTouch = (() => {
    try {
        return window.matchMedia("(pointer: coarse)").matches;
    } catch {
        return false;
    }
})();

// A small dead zone keeps resting thumbs from moving or turning a character.
const DEAD_ZONE = 0.15;
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
    // Pausing releases the captured thumbs as well as the run's input state.
    cancel(): void;
    // A run's HUD is discarded on leaving: no held input survives it.
    dispose(): void;
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

// The controls, wired to the run
export function touchControls(run: Run, hooks: TouchHooks): TouchControls {
    run.markTarget = true;
    let disposed = false;

    const makeStick = (aim: boolean) => {
        const root = div(aim ? "touch-aim-zone" : "touch-zone");
        root.setAttribute("role", "group");
        root.setAttribute("aria-label", aim ? "Aim and attack joystick" : "360 degree movement joystick");
        const rest = div("touch-rest");
        rest.append(div("touch-rest-knob"));
        const base = div("touch-stick");
        const knob = div("touch-knob");
        base.append(knob);
        base.hidden = true;
        root.append(rest, base, div("reference-stick-label", aim ? "Aim / attack" : "Move"));
        let pointer: number | undefined;
        let originX = 0;
        let originY = 0;
        let direction = { x: 0, z: 0 };

        const reset = () => {
            const held = pointer;
            pointer = undefined;
            if (held !== undefined) {
                try { root.releasePointerCapture(held); } catch { /* A cancelled or synthetic pointer has no capture. */ }
            }
            direction = { x: 0, z: 0 };
            base.hidden = true;
            rest.hidden = false;
            root.classList.remove("active");
            knob.style.transform = "";
            if (aim && held !== undefined) {
                run.aimDirection(0, 0);
                run.setTouchAttack(false);
            } else if (!aim && held !== undefined) {
                run.stick.x = 0;
                run.stick.z = 0;
            }
        };

        const apply = () => {
            if (pointer === undefined) return;
            if (aim) {
                run.aimDirection(direction.x, direction.z);
                // A held request has its own input flag, so releasing a
                // thumb never clears a buffered keyboard or world click.
                // Existing cooldown, range and target rules govern swings.
                run.setTouchAttack(true);
            } else {
                run.stick.x = direction.x;
                run.stick.z = direction.z;
            }
        };
        const steer = (clientX: number, clientY: number) => {
            const dx = clientX - originX;
            const dy = clientY - originY;
            const length = Math.hypot(dx, dy);
            const travel = Math.max(28, root.getBoundingClientRect().width * 0.35);
            const reach = Math.min(1, length / travel);
            const x = length > 0 ? dx / length : 0;
            const z = length > 0 ? dy / length : 0;
            knob.style.transform = `translate(${x * reach * travel}px, ${z * reach * travel}px)`;
            direction = reach < DEAD_ZONE ? { x: 0, z: 0 } : { x: x * reach, z: z * reach };
            if (!aim && reach >= DEAD_ZONE) run.cancelWalk();
            apply();
        };
        root.onpointerdown = (e) => {
            if (disposed || pointer !== undefined || e.button !== 0 || !run.controlsEnabled) return;
            e.preventDefault();
            e.stopPropagation();
            pointer = e.pointerId;
            capture(root, e);
            const rect = root.getBoundingClientRect();
            // The movement preference still permits a floating origin, but
            // only inside this ring: the world outside it receives taps.
            originX = aim || settings.fixedStick ? rect.left + rect.width / 2 : e.clientX;
            originY = aim || settings.fixedStick ? rect.top + rect.height / 2 : e.clientY;
            base.style.left = `${originX - rect.left}px`;
            base.style.top = `${originY - rect.top}px`;
            base.hidden = false;
            rest.hidden = true;
            root.classList.add("active");
            steer(e.clientX, e.clientY);
        };
        root.onpointermove = (e) => {
            if (e.pointerId === pointer) {
                if (!run.controlsEnabled) reset();
                else steer(e.clientX, e.clientY);
            }
        };
        root.onpointerup = root.onpointercancel = root.onlostpointercapture = (e) => {
            if (e.pointerId === pointer) reset();
        };
        return { root, reset, apply };
    };

    const move = makeStick(false);
    const aim = makeStick(true);
    const zone = move.root;

    // The screenshot's side rails provide these actions; the return slot is
    // retained for the HUD interface, without a duplicate corner toolbar.
    const corner = div("touch-corner");
    corner.hidden = true;
    void hooks;
    const cluster = div("touch-cluster");
    const main = document.createElement("button");
    main.className = "touch-button touch-main reference-touch-use";
    main.type = "button";
    const mainLabel = div("touch-label", "Use");
    const mainSub = div("touch-sub");
    main.append(mainLabel, mainSub);
    let interactionPointer: number | undefined;
    let interactionTimer: number | undefined;
    let interactionHeld = false;
    const releaseInteraction = () => {
        const held = interactionPointer;
        interactionPointer = undefined;
        if (held !== undefined) {
            try { main.releasePointerCapture(held); } catch { /* Capture may already have ended. */ }
        }
        window.clearTimeout(interactionTimer);
        interactionTimer = undefined;
        if (interactionHeld) run.press("KeyE", false);
        interactionHeld = false;
        main.classList.remove("pressed");
    };
    main.onpointerdown = (e) => {
        if (disposed || !run.controlsEnabled || e.button !== 0 || interactionPointer !== undefined) return;
        e.preventDefault();
        e.stopPropagation();
        interactionPointer = e.pointerId;
        capture(main, e);
        main.classList.add("pressed");
        interactionHeld = true;
        run.press("KeyE", true);
    };
    main.onpointerup = main.onpointercancel = main.onlostpointercapture = (e) => {
        if (e.pointerId === interactionPointer) releaseInteraction();
    };
    main.onkeydown = (e) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            interactionHeld = true;
            run.press("KeyE", true);
        }
    };
    main.onkeyup = (e) => {
        if (e.key === " " || e.key === "Enter") releaseInteraction();
    };
    main.onclick = (e) => {
        // A native accessibility/controller click has no pointer sequence.
        if (e.detail === 0 && run.controlsEnabled) {
            interactionHeld = true;
            run.press("KeyE", true);
            interactionTimer = window.setTimeout(releaseInteraction, 180);
        }
    };
    cluster.append(aim.root, main);

    const reset = () => {
        move.reset();
        aim.reset();
        releaseInteraction();
    };
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    const update = () => {
        if (disposed) return;
        if (!run.controlsEnabled) reset();
        else {
            move.apply();
            aim.apply();
        }
        const text = mainButtonText(run.prompt);
        mainLabel.textContent = text.label;
        mainSub.textContent = text.sub;
        main.hidden = !text.lit;
        main.title = touchPrompt(run.prompt);
        main.setAttribute("aria-label", touchPrompt(run.prompt) || "Interact");
        main.classList.toggle("lit", text.lit);
        if (!text.lit) releaseInteraction();
    };
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        reset();
        window.removeEventListener("blur", reset);
        document.removeEventListener("visibilitychange", visibility);
    };
    update();
    return { zone, corner, cluster, update, cancel: reset, dispose };
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
