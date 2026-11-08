// The full map (version 91): the whole map of the run over the screen, as
// the minimap shows it (the ground from above, the fog over what hasn't been
// walked, and what's been found), dragged about with a finger or the mouse
// and zoomed with the wheel, a pinch or its buttons. A click on explored
// ground queues a walk there and closes the map. M, or a click on the
// minimap, opens it; M, Esc or Close shuts it. It takes the controls while
// it's up (and stops the world, alone; co-op's world doesn't wait).
import { Run } from "../game/run";

// Pixels a tile, smallest to largest; it opens at OPEN_ZOOM on you
const ZOOM_MAX = 24;
const OPEN_ZOOM = 5;
const ZOOM_STEP = 1.35;

type Legend = [string, string];
const LEGEND: Legend[] = [
    ["#ffffff", "You"],
    ["#ff66cc", "Where you came in"],
    ["#00ff00", "A way out"],
    ["#ff6a00", "A chest"],
    ["#ffd700", "The golden chest"],
    ["#60e0ff", "The vault"],
    ["#40e8ff", "The trader"],
    ["#b8b0ff", "Your gravestone"],
    ["#2e8bff", "The party"],
    ["#ffff00", "An enemy"],
    ["#ff0000", "The boss"],
];

export class FullMap {
    readonly root: HTMLElement;
    private readonly canvas: HTMLCanvasElement;
    private open = false;
    private frame = 0;
    // The view: the scene point at the middle, and pixels a tile
    private cx = 0;
    private cz = 0;
    private zoom = OPEN_ZOOM;
    private readonly notice: HTMLElement;
    private controllerCursor?: { x: number; z: number };
    // Fingers or the mouse down on the map, for dragging and pinching
    private readonly pointers = new Map<number, { x: number; y: number; fromX: number; fromY: number; dragged: boolean }>();

    constructor(
        private readonly run: Run,
        private readonly onClose: () => void,
    ) {
        this.canvas = document.createElement("canvas");
        this.canvas.className = "full-map-canvas";
        const button = (label: string, title: string, act: () => void) => {
            const b = document.createElement("button");
            b.textContent = label;
            b.title = title;
            b.addEventListener("click", (e) => {
                e.stopPropagation();
                act();
            });
            return b;
        };
        const bar = document.createElement("div");
        bar.className = "full-map-bar";
        const title = document.createElement("div");
        title.className = "full-map-title";
        title.textContent = `${run.world.name}: click discovered ground to walk; drag to pan, wheel or pinch to zoom`;
        bar.append(
            title,
            button("−", "Zoom out", () => this.zoomBy(1 / ZOOM_STEP)),
            button("+", "Zoom in", () => this.zoomBy(ZOOM_STEP)),
            button("Whole map", "See all of it", () => this.fit()),
            button("On me", "Back to where you are", () => this.centreOnMe()),
            button("Stop walking", "Cancel your walking destination", () => {
                run.cancelWalk();
                this.notice.textContent = "Walking destination cleared. Click discovered ground to set another.";
            }),
            button("Close", "Close the map (M)", () => this.close()),
        );
        const legend = document.createElement("div");
        legend.className = "full-map-legend";
        for (const [color, text] of LEGEND) {
            const row = document.createElement("div");
            const swatch = document.createElement("span");
            swatch.className = "swatch";
            swatch.style.background = color;
            row.append(swatch, text);
            legend.append(row);
        }
        this.notice = document.createElement("div");
        this.notice.className = "full-map-notice";
        this.notice.setAttribute("role", "status");
        this.notice.textContent = "Click discovered ground to walk there. Dim ground is unexplored.";
        this.root = document.createElement("div");
        this.root.className = "full-map";
        this.root.hidden = true;
        this.root.append(this.canvas, bar, legend, this.notice);

        this.canvas.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            this.canvas.setPointerCapture(e.pointerId);
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, fromX: e.clientX, fromY: e.clientY, dragged: false });
            if (this.pointers.size > 1) {
                for (const pointer of this.pointers.values()) pointer.dragged = true;
            }
        });
        this.canvas.addEventListener("pointermove", (e) => this.onMove(e));
        const up = (e: PointerEvent) => {
            const pointer = this.pointers.get(e.pointerId);
            this.pointers.delete(e.pointerId);
            if (e.type === "pointerup" && pointer && !pointer.dragged &&
                Math.hypot(e.clientX - pointer.fromX, e.clientY - pointer.fromY) < 6) {
                this.walkAt(e.clientX, e.clientY);
            }
        };
        this.canvas.addEventListener("pointerup", up);
        this.canvas.addEventListener("pointercancel", up);
        this.canvas.addEventListener(
            "wheel",
            (e) => {
                e.preventDefault();
                this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
            },
            { passive: false },
        );
    }

    get isOpen(): boolean {
        return this.open;
    }

    // Opens on you, at a size you can read the ground at
    show(): boolean {
        if (this.open || !this.run.mapBounds) {
            return false;
        }
        this.open = true;
        this.root.hidden = false;
        this.zoom = OPEN_ZOOM;
        this.controllerCursor = undefined;
        this.notice.textContent = "Click discovered ground to walk there. Dim ground is unexplored.";
        this.centreOnMe();
        const loop = () => {
            if (!this.open) {
                return;
            }
            this.draw();
            this.frame = requestAnimationFrame(loop);
        };
        loop();
        return true;
    }

    close(): void {
        if (!this.open) {
            return;
        }
        this.open = false;
        this.root.hidden = true;
        cancelAnimationFrame(this.frame);
        this.pointers.clear();
        this.controllerCursor = undefined;
        this.onClose();
    }

    // Controller coordinates remain in world tiles, sharing precisely the
    // same discovered-ground and collision checks as a mouse or touch click.
    controllerInput(x: number, y: number, panX: number, panY: number, zoom: number, dt: number): void {
        if (!this.open || ![x, y, panX, panY, zoom, dt].every(Number.isFinite)) return;
        const step = Math.min(0.05, Math.max(0, dt));
        const moving = Math.hypot(x, y) > 0;
        if (moving || Math.hypot(panX, panY) > 0 || zoom !== 0) {
            this.controllerCursor ??= { ...this.run.mapHere };
            this.notice.textContent = "Left stick: destination · right stick: pan · triggers: zoom · A: walk · B: close";
        }
        if (!this.controllerCursor) return;
        this.cx += panX * 260 * step / this.zoom;
        this.cz += panY * 260 * step / this.zoom;
        if (zoom !== 0) this.zoomBy(Math.exp(zoom * step * 1.5));
        this.controllerCursor.x += x * 180 * step / this.zoom;
        this.controllerCursor.z += y * 180 * step / this.zoom;
        const bounds = this.run.mapBounds;
        if (bounds) {
            this.controllerCursor.x = Math.min(bounds.maxX - 0.001, Math.max(bounds.minX, this.controllerCursor.x));
            this.controllerCursor.z = Math.min(bounds.maxZ - 0.001, Math.max(bounds.minZ, this.controllerCursor.z));
        }
        if (moving) {
            const { width, height } = this.size();
            const edgeX = Math.max(1, width / 2 - 60) / this.zoom;
            const edgeZ = Math.max(1, height / 2 - 70) / this.zoom;
            this.cx = Math.min(this.controllerCursor.x + edgeX, Math.max(this.controllerCursor.x - edgeX, this.cx));
            this.cz = Math.min(this.controllerCursor.z + edgeZ, Math.max(this.controllerCursor.z - edgeZ, this.cz));
        }
        this.clamp();
    }

    controllerConfirm(): void {
        if (!this.open) return;
        this.controllerCursor ??= { ...this.run.mapHere };
        this.walkToPoint(this.controllerCursor.x, this.controllerCursor.z);
    }

    private centreOnMe(): void {
        const here = this.run.mapHere;
        this.cx = here.x;
        this.cz = here.z;
        this.clamp();
    }

    // The whole map on the screen at once
    private fit(): void {
        const b = this.run.mapBounds;
        if (!b) {
            return;
        }
        const { width, height } = this.size();
        this.zoom = Math.min(width / (b.maxX - b.minX), height / (b.maxZ - b.minZ)) * 0.95;
        this.cx = (b.minX + b.maxX) / 2;
        this.cz = (b.minZ + b.maxZ) / 2;
    }

    // The smallest zoom is the whole map; the view never leaves it
    private minZoom(): number {
        const b = this.run.mapBounds;
        if (!b) {
            return 1;
        }
        const { width, height } = this.size();
        return Math.min(width / (b.maxX - b.minX), height / (b.maxZ - b.minZ)) * 0.95;
    }

    private clamp(): void {
        const b = this.run.mapBounds;
        if (!b) {
            return;
        }
        this.zoom = Math.min(ZOOM_MAX, Math.max(this.minZoom(), this.zoom));
        this.cx = Math.min(b.maxX, Math.max(b.minX, this.cx));
        this.cz = Math.min(b.maxZ, Math.max(b.minZ, this.cz));
    }

    private zoomBy(factor: number): void {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    // Zooms keeping the point under the cursor (or the pinch) where it is
    private zoomAt(factor: number, clientX: number, clientY: number): void {
        const rect = this.canvas.getBoundingClientRect();
        const ox = clientX - rect.left - rect.width / 2;
        const oy = clientY - rect.top - rect.height / 2;
        const before = this.zoom;
        const wx = this.cx + ox / before;
        const wz = this.cz + oy / before;
        this.zoom = before * factor;
        this.clamp();
        this.cx = wx - ox / this.zoom;
        this.cz = wz - oy / this.zoom;
        this.clamp();
    }

    private onMove(e: PointerEvent): void {
        const last = this.pointers.get(e.pointerId);
        if (!last) {
            return;
        }
        if (Math.hypot(e.clientX - last.fromX, e.clientY - last.fromY) >= 6) last.dragged = true;
        if (this.pointers.size >= 2) {
            // A pinch: the distance between the two fingers, before and after
            const others = [...this.pointers.entries()].filter(([id]) => id !== e.pointerId);
            const other = others[0][1];
            const before = Math.hypot(last.x - other.x, last.y - other.y);
            const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
            if (before > 0) {
                this.zoomAt(after / before, (e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
            }
        } else if (last.dragged) {
            this.cx -= (e.clientX - last.x) / this.zoom;
            this.cz -= (e.clientY - last.y) / this.zoom;
            this.clamp();
        }
        this.pointers.set(e.pointerId, { ...last, x: e.clientX, y: e.clientY });
    }

    private walkAt(clientX: number, clientY: number): void {
        if (!this.open) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = this.cx + (clientX - rect.left - rect.width / 2) / this.zoom;
        const z = this.cz + (clientY - rect.top - rect.height / 2) / this.zoom;
        this.walkToPoint(x, z);
    }

    private walkToPoint(x: number, z: number): void {
        if (!this.run.isDiscovered(x, z)) {
            this.notice.textContent = "Explore that area first. Choose the light, discovered ground.";
            return;
        }
        if (!this.run.walkToMap(x, z)) {
            this.notice.textContent = "You can't reach that spot. Choose another point on discovered ground.";
            return;
        }
        this.close();
    }

    private size(): { width: number; height: number } {
        const rect = this.canvas.getBoundingClientRect();
        return { width: rect.width || window.innerWidth, height: rect.height || window.innerHeight };
    }

    private draw(): void {
        const { width, height } = this.size();
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(width * ratio);
        const h = Math.round(height * ratio);
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        const ctx = this.canvas.getContext("2d")!;
        this.run.drawFullMap(ctx, w, h, this.cx, this.cz, this.zoom * ratio);
        if (this.controllerCursor) {
            const x = w / 2 + (this.controllerCursor.x - this.cx) * this.zoom * ratio;
            const y = h / 2 + (this.controllerCursor.z - this.cz) * this.zoom * ratio;
            ctx.save();
            ctx.strokeStyle = "#ffe16a";
            ctx.lineWidth = 2 * ratio;
            ctx.beginPath();
            ctx.arc(x, y, 8 * ratio, 0, Math.PI * 2);
            ctx.moveTo(x - 13 * ratio, y); ctx.lineTo(x + 13 * ratio, y);
            ctx.moveTo(x, y - 13 * ratio); ctx.lineTo(x, y + 13 * ratio);
            ctx.stroke();
            ctx.restore();
        }
    }
}
