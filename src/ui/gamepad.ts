// Native standard-mapped Xbox controllers use the browser's Gamepad API.
// No keyboard events are synthesized: game and UI actions share their real APIs.
export type ControllerAction = "inventory" | "map" | "pause" | "back" | "nextTab" | "previousTab";
export type FocusDirection = "up" | "down" | "left" | "right";

export type ControllerRun = {
    readonly controlsEnabled: boolean;
    setControllerMove(x: number, z: number): void;
    setControllerInteract(down: boolean): void;
    requestAttack(down?: boolean): void;
    releaseControllerInput(): void;
    orbitCamera(dx: number, dy: number): void;
    useSpecial(): void;
};

type PadLike = Pick<Gamepad, "axes" | "buttons">;
export type PlatformGamepad = Pick<Gamepad, "id" | "index" | "connected" | "mapping" | "axes" | "buttons" | "timestamp">;

declare global {
    interface Window {
        // The Android host supplies native InputDevice events for USB-C and
        // Bluetooth pads, including WebViews without navigator.getGamepads.
        __runkovAndroidGamepads?: readonly PlatformGamepad[];
        __runkovNativeBack?: () => boolean;
        __runkovNativePause?: () => void;
    }
}

export function platformGamepads(android: readonly PlatformGamepad[] | undefined, browser: () => readonly (PlatformGamepad | null)[]): readonly (PlatformGamepad | null)[] {
    // An empty host list means all native pads disconnected. Do not revive a
    // stale WebView pad after unplugging a USB controller.
    if (Array.isArray(android)) return android;
    return browser();
}

export type ControllerHost = {
    run(): ControllerRun | undefined;
    action(action: ControllerAction): boolean;
    modal(): boolean;
    mapOpen(): boolean;
    mapInput(x: number, y: number, panX: number, panY: number, zoom: number, dt: number): void;
    mapConfirm(): void;
    typing(): boolean;
    navigate(direction: FocusDirection): void;
    confirm(): void;
    focusOwned(): boolean;
    markFocus(): void;
    clearFocus(): void;
};

// A circular dead zone preserves arbitrary walking angles and full stick
// travel, while a resting controller cannot nudge a click-to-walk route.
export function radialStick(x: number, y: number, deadZone = 0.18): { x: number; y: number } {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    const magnitude = Math.hypot(x, y);
    if (magnitude <= deadZone) return { x: 0, y: 0 };
    const strength = Math.min(1, (magnitude - deadZone) / (1 - deadZone));
    return { x: x / magnitude * strength, y: y / magnitude * strength };
}

export function readController(pad: PadLike): {
    move: { x: number; y: number }; look: { x: number; y: number }; down: boolean[]; triggers: number[];
} {
    return {
        move: radialStick(pad.axes[0] ?? 0, pad.axes[1] ?? 0),
        look: radialStick(pad.axes[2] ?? 0, pad.axes[3] ?? 0),
        down: Array.from({ length: 17 }, (_, i) => !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.5),
        triggers: [6, 7].map((i) => Math.min(1, Math.max(0, pad.buttons[i]?.value ?? 0))),
    };
}

// The input state machine is independent of the browser poller so releases,
// button edges, modal routing and disconnects can be verified deterministically.
export class ControllerDriver {
    private previous: boolean[] = [];
    private run?: ControllerRun;
    private direction?: FocusDirection;
    private repeatAt = 0;
    private neutralRequired = false;
    private aWorld = false;
    private rtWorld = false;
    private xWorld = false;

    release(requireNeutral = false): void {
        this.run?.releaseControllerInput();
        this.previous = [];
        this.direction = undefined;
        this.repeatAt = 0;
        this.neutralRequired = requireNeutral;
        this.aWorld = false;
        this.rtWorld = false;
        this.xWorld = false;
    }

    update(pad: PadLike | undefined, now: number, dt: number, host: ControllerHost): void {
        const run = host.run();
        if (this.run !== run) {
            this.run?.releaseControllerInput();
            this.run = run;
        }
        if (!pad) {
            this.release();
            return;
        }
        const input = readController(pad);
        if (this.neutralRequired) {
            if (input.down.some(Boolean) || Math.hypot(input.move.x, input.move.y, input.look.x, input.look.y) > 0) return;
            this.neutralRequired = false;
        }
        const pressed = (i: number) => input.down[i] && !this.previous[i];
        const typing = host.typing();
        // Back is still available from a focused text field; all game inputs
        // stay off while the player enters a name or a chat message.
        if (pressed(1)) host.action("back");
        if (pressed(9)) host.action("pause");
        if (!typing) {
            if (pressed(8)) host.action("map");
            if (pressed(3) && host.action("inventory")) host.markFocus();
            if (pressed(4) || pressed(5)) {
                host.action(pressed(4) ? "previousTab" : "nextTab");
                host.markFocus();
            }
        }

        const map = host.mapOpen();
        // A confirmation keeps that role until released, even if it closes
        // a panel or starts walking. It must not become an attack next frame.
        if (!input.down[0] || typing || map || host.modal() || !run?.controlsEnabled) this.aWorld = false;
        else if (pressed(0)) this.aWorld = true;
        if (!input.down[7] || typing || map || !run?.controlsEnabled) this.rtWorld = false;
        else if (pressed(7)) this.rtWorld = true;
        if (!input.down[2] || typing || map || !run?.controlsEnabled) this.xWorld = false;
        else if (pressed(2)) this.xWorld = true;
        let direction: FocusDirection | undefined = input.down[12] ? "up" : input.down[13] ? "down" : input.down[14] ? "left" : input.down[15] ? "right" : undefined;
        if (!direction && !typing && !map && (!run || !run.controlsEnabled) && Math.max(Math.abs(input.move.x), Math.abs(input.move.y)) > 0.5) {
            direction = Math.abs(input.move.x) > Math.abs(input.move.y) ? input.move.x > 0 ? "right" : "left" : input.move.y > 0 ? "down" : "up";
        }
        if (direction && (direction !== this.direction || now >= this.repeatAt)) {
            host.navigate(direction);
            this.repeatAt = now + (direction !== this.direction ? 320 : 120);
        }
        this.direction = direction;

        if (typing || !run?.controlsEnabled || map) run?.releaseControllerInput();
        else {
            run.setControllerMove(input.move.x, input.move.y);
            run.setControllerInteract(input.down[2] && this.xWorld);
            run.orbitCamera(input.look.x * 220 * dt, input.look.y * 170 * dt);
            run.requestAttack((input.down[7] && this.rtWorld) || (input.down[0] && this.aWorld && !host.focusOwned()));
            if (pressed(6)) run.useSpecial();
        }
        if (!typing && map) {
            if (Math.hypot(input.move.x, input.move.y) > 0) host.clearFocus();
            host.mapInput(input.move.x, input.move.y, input.look.x, input.look.y, input.triggers[1] - input.triggers[0], dt);
        }
        if (pressed(0)) {
            if (host.focusOwned()) host.confirm();
            else if (!typing && map) host.mapConfirm();
            else if (!typing && (host.modal() || !run)) host.confirm();
        }
        this.previous = input.down;
    }
}

function visible(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    return element.getClientRects().length > 0 && style.visibility !== "hidden" && style.display !== "none" && !element.closest("[hidden], [inert]");
}

function textEntry(element: Element | null): HTMLElement | undefined {
    return element instanceof HTMLElement && (element.matches("textarea, input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset])") || element.isContentEditable) ? element : undefined;
}

function focusTargets(): HTMLElement[] {
    const scope = document.querySelector<HTMLElement>(".full-map:not([hidden])")
        ?? document.querySelector<HTMLElement>(".pause:not([hidden])")
        ?? document.querySelector<HTMLElement>(".client-camera-panel:not([hidden])")
        ?? document.querySelector<HTMLElement>("#client-tab-panel:not([hidden])")
        ?? document;
    return [...scope.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])")]
        .filter((element) => visible(element) && element.getAttribute("aria-disabled") !== "true");
}

class ControllerFocus {
    private selected?: HTMLElement;

    get owned(): boolean {
        return this.selected !== undefined && this.selected === document.activeElement && visible(this.selected) && focusTargets().includes(this.selected);
    }

    clear = (): void => {
        this.selected?.classList.remove("gamepad-focus");
        this.selected = undefined;
        document.body.classList.remove("gamepad-active");
    };

    mark = (): void => {
        const element = document.activeElement;
        if (element instanceof HTMLElement && visible(element)) this.select(element);
    };

    private select(element: HTMLElement): void {
        this.selected?.classList.remove("gamepad-focus");
        this.selected = element;
        element.classList.add("gamepad-focus");
        document.body.classList.add("gamepad-active");
        element.focus({ preventScroll: true });
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    navigate = (direction: FocusDirection): void => {
        if (this.owned && this.selected instanceof HTMLInputElement && this.selected.type === "range" && (direction === "left" || direction === "right")) {
            direction === "right" ? this.selected.stepUp() : this.selected.stepDown();
            this.selected.dispatchEvent(new Event("input", { bubbles: true }));
            this.selected.dispatchEvent(new Event("change", { bubbles: true }));
            return;
        }
        const targets = focusTargets();
        if (!targets.length) return;
        if (!this.owned || !targets.includes(this.selected!)) {
            this.select(targets[0]);
            return;
        }
        const current = this.selected!.getBoundingClientRect();
        const cx = current.left + current.width / 2;
        const cy = current.top + current.height / 2;
        const vector = direction === "left" ? [-1, 0] : direction === "right" ? [1, 0] : direction === "up" ? [0, -1] : [0, 1];
        let best: HTMLElement | undefined;
        let score = Infinity;
        for (const target of targets) {
            if (target === this.selected) continue;
            const rect = target.getBoundingClientRect();
            const dx = rect.left + rect.width / 2 - cx;
            const dy = rect.top + rect.height / 2 - cy;
            const forward = dx * vector[0] + dy * vector[1];
            const across = Math.abs(dx * vector[1] - dy * vector[0]);
            const distance = Math.hypot(dx, dy) + across * 2;
            if (forward > 3 && distance < score) { score = distance; best = target; }
        }
        if (best) this.select(best);
    };

    confirm = (): void => {
        if (!this.owned) {
            const first = focusTargets()[0];
            if (first) this.select(first);
            return;
        }
        const target = this.selected!;
        if (target instanceof HTMLInputElement && !["button", "submit", "checkbox", "radio"].includes(target.type)) {
            target.focus();
            return;
        }
        const cells = target.matches(".slot") ? ".slot[tabindex]"
            : target.matches(".spell") ? ".spell[tabindex]"
            : target.matches(".equip-slot") ? ".equip-slot:not(.empty):not(.none)" : undefined;
        const identity = (element: HTMLElement): string => {
            if (element.matches(".spell")) {
                return element.querySelector<HTMLImageElement>("img[alt]")?.alt
                    ?? element.getAttribute("aria-label")?.split(".")[0] ?? "";
            }
            const icon = element.querySelector<HTMLElement>("[data-item], [data-icon]");
            return element.dataset.item ?? icon?.dataset.item ?? icon?.dataset.icon
                ?? element.dataset.view ?? element.getAttribute("title") ?? element.getAttribute("aria-label") ?? element.textContent ?? "";
        };
        const key = identity(target);
        const previousCells = cells ? focusTargets().filter((element) => element.matches(cells)) : [];
        const position = previousCells.indexOf(target);
        const occurrence = previousCells.filter((element) => identity(element) === key).indexOf(target);
        const panel = target.closest<HTMLElement>(".full-map, .pause, #client-tab-panel, .client-camera-panel");
        target.click();
        const targets = focusTargets();
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== target && targets.includes(active)) this.select(active);
        else if (panel && (!panel.isConnected || !visible(panel))) this.clear();
        else if (!target.isConnected || !targets.includes(target)) {
            const currentCells = cells ? targets.filter((element) => element.matches(cells)) : [];
            const matchingCells = currentCells.filter((element) => identity(element) === key);
            // A food stack or spell can be redrawn after every action. Keep
            // the same item, then its next safe cell; never jump to Drop.
            const next = cells
                ? matchingCells[Math.min(Math.max(0, occurrence), matchingCells.length - 1)]
                    ?? currentCells[Math.min(Math.max(0, position), currentCells.length - 1)]
                    ?? targets.find((element) => element.classList.contains("client-panel-close"))
                : targets.find((element) => identity(element) === key)
                    ?? targets.find((element) => !element.classList.contains("client-panel-close")) ?? targets[0];
            next ? this.select(next) : this.clear();
        }
    };
}

export type GamepadBindings = Omit<ControllerHost, "typing" | "navigate" | "confirm" | "focusOwned" | "markFocus" | "clearFocus"> & { message(text: string): void };

export class GamepadControls {
    private readonly driver = new ControllerDriver();
    private readonly focus = new ControllerFocus();
    private frame?: number;
    private lastTime = 0;
    private connected?: number;
    private suspended = false;
    private readonly host: ControllerHost;

    constructor(private readonly bindings: GamepadBindings) {
        this.host = {
            ...bindings,
            action: (action) => {
                const field = textEntry(document.activeElement);
                if (action === "back" && field) {
                    field.blur();
                    this.focus.clear();
                    return true;
                }
                return bindings.action(action);
            },
            typing: () => !!textEntry(document.activeElement),
            navigate: this.focus.navigate,
            confirm: this.focus.confirm,
            focusOwned: () => this.focus.owned,
            markFocus: this.focus.mark,
            clearFocus: this.focus.clear,
        };
    }

    start(): void {
        if (this.frame !== undefined) return;
        this.lastTime = 0;
        this.suspended = document.hidden;
        this.driver.release(true);
        window.addEventListener("blur", this.onBlur);
        window.addEventListener("focus", this.onFocus);
        window.addEventListener("gamepaddisconnected", this.onDisconnected);
        document.addEventListener("visibilitychange", this.onVisibility);
        document.addEventListener("pointerdown", this.focus.clear, true);
        document.addEventListener("keydown", this.focus.clear, true);
        this.frame = requestAnimationFrame(this.poll);
    }

    stop = (): void => {
        if (this.frame !== undefined) cancelAnimationFrame(this.frame);
        this.frame = undefined;
        this.driver.release();
        this.focus.clear();
        window.removeEventListener("blur", this.onBlur);
        window.removeEventListener("focus", this.onFocus);
        window.removeEventListener("gamepaddisconnected", this.onDisconnected);
        document.removeEventListener("visibilitychange", this.onVisibility);
        document.removeEventListener("pointerdown", this.focus.clear, true);
        document.removeEventListener("keydown", this.focus.clear, true);
    };

    private onBlur = (): void => { this.suspended = true; this.driver.release(true); };
    private onFocus = (): void => { this.suspended = false; this.lastTime = 0; };
    private onVisibility = (): void => { document.hidden ? this.onBlur() : this.onFocus(); };
    private onDisconnected = (event: GamepadEvent): void => {
        if (event.gamepad.index === this.connected) {
            this.driver.release();
            this.focus.clear();
            this.connected = undefined;
        }
    };

    private poll = (now: number): void => {
        this.frame = requestAnimationFrame(this.poll);
        const dt = this.lastTime ? Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000)) : 0;
        this.lastTime = now;
        if (this.suspended || document.hidden) return;
        let pads: readonly (PlatformGamepad | null)[];
        try {
            pads = platformGamepads(window.__runkovAndroidGamepads, () =>
                typeof navigator.getGamepads === "function" ? navigator.getGamepads() : []);
        } catch { this.driver.release(); return; }
        const supported = [...pads].filter((pad): pad is PlatformGamepad => !!pad?.connected && pad.mapping === "standard" && pad.axes.length >= 4 && pad.buttons.length >= 16);
        const pad = supported.find((candidate) => candidate.index === this.connected) ?? supported.find((candidate) => /xbox|xinput/i.test(candidate.id)) ?? supported[0];
        if (pad && pad.index !== this.connected) {
            this.driver.release(true);
            this.connected = pad.index;
            this.bindings.message("Controller connected: left stick moves, right stick controls the camera. A confirms, X interacts, Y opens inventory, Menu pauses.");
        } else if (!pad && this.connected !== undefined) {
            this.connected = undefined;
            this.focus.clear();
        }
        this.driver.update(pad, now, dt, this.host);
    };
}
