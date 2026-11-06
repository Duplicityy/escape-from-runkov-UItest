// Co-op's connection to the relay (relay/coop-relay.mjs): the room this
// player is in, who else is in it, and the run's traffic once it starts.
// The relay only passes things on; one player hosts the run (their browser
// runs it, party.ts says what it sends) and the rest are guests.
//
// The messages are JSON over a WebSocket, in the relay's own shapes: a
// room is made or joined by code, each player says who they are ("me"),
// the host starts it with a GameStart everyone gets, then guests send "up"
// (to the host) and the host sends "down" (to everyone else).
import { Character, Equipment } from "./save";

// The build a game is: a room only takes players on the host's (the relay
// compares them). Raised with every push to itch.
export const GAME_BUILD = "111";

// Where the relay is: the build's VITE_COOP_URL, a saved override (for
// trying one), the local relay beside a dev server, or the one on Fly.io
const DEFAULT_RELAY = "wss://escape-from-runkov-relay.fly.dev/coop";
const OVERRIDE_KEY = "dungeon-extraction-coop";

export function relayUrl(): string {
    try {
        const saved = localStorage.getItem(OVERRIDE_KEY);
        if (saved) {
            return saved;
        }
    } catch {
        // No storage
    }
    const built = import.meta.env.VITE_COOP_URL as string | undefined;
    if (built) {
        return built;
    }
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        return "ws://localhost:8787/coop";
    }
    return DEFAULT_RELAY;
}

export function setRelayOverride(url: string | undefined): void {
    try {
        if (url) {
            localStorage.setItem(OVERRIDE_KEY, url);
        } else {
            localStorage.removeItem(OVERRIDE_KEY);
        }
    } catch {
        // No storage
    }
}

// What a player brings: their look, so everyone draws them, and their
// gear's numbers, so the host fights for them (see party.ts)
export type Loadout = {
    character: Character;
    equipment: Equipment;
    pet?: string;
    // The moderator's crown key, for the lobby to check (crown.ts)
    crown?: string;
};

export type MemberView = {
    id: string;
    // Given by the relay
    name: string;
    characterId: string;
    ready: boolean;
    loadout?: Loadout;
    build?: string;
    // The maps this player has unlocked (the relay only lets a room be made
    // on one its host has; with MULTIPLAYER_ANY_MAP on, as the Fly relay
    // runs, guests can join any)
    unlocks?: { maps: string[]; endless: string[]; hard: string[] };
};

export type RoomView = {
    code: string;
    name: string;
    // Public: in the list for anyone to join. Private: by code only.
    open: boolean;
    hostId: string;
    mapId: string;
    started: boolean;
    members: MemberView[];
};

// A public server as the list shows it (the relay's listing)
export type RoomListing = {
    code: string;
    name: string;
    host: string;
    players: number;
    max: number;
    mapId: string;
};

// How often the list of public servers is asked for while it's on screen
const LIST_EVERY_MS = 3000;
const LIST_PAGE = 20;

// Everything a guest's run needs from the host: the map, the seed its
// layout comes from, and everyone in the party in order
export type GameStart = {
    seed: number;
    mapId: string;
    endless: false;
    hard: false;
    heroes: { id: string; name: string; characterId: string; loadout: Loadout }[];
};

export type GoneReason = "left" | "kicked" | "disbanded" | "hostLeft" | "idle";

const GONE_TEXT: Record<GoneReason, string> = {
    left: "",
    kicked: "The host removed you from the party.",
    disbanded: "The host disbanded the party.",
    hostLeft: "The host left, so the party's over.",
    idle: "The room closed after half an hour with nothing happening.",
};

type ServerMessage =
    | { t: "welcome"; id: string; name: string; anyMap?: boolean }
    | { t: "named"; name: string }
    | { t: "pong" }
    | { t: "rooms"; rooms: RoomListing[]; page: number; pages: number; total: number; full: boolean }
    | { t: "room"; room: RoomView; you: string }
    | { t: "gone"; reason: GoneReason }
    | { t: "error"; message: string }
    | { t: "start"; game: GameStart }
    | { t: "left"; id: string }
    | { t: "up"; from: string; d: unknown }
    | { t: "down"; d: unknown }
    | { t: "chat"; from: string; name: string; text: string; system?: boolean };

// A line of chat from the room (version 105): who said it (the relay's id
// and their character's name, both set by the relay), or a word from the
// relay itself
export type ChatLine = { from: string; name: string; text: string; system: boolean };

// How long a line can be (the relay cuts it there too)
export const MAX_CHAT_CHARS = 120;

export type SessionView = {
    status: "offline" | "connecting" | "online";
    error?: string;
    room?: RoomView;
    you?: string;
    name: string;
    // The public servers, while browsing (undefined until the relay's said)
    servers?: RoomListing[];
    // The relay has no room for another server right now
    full?: boolean;
    // The relay lets players join a map they haven't unlocked
    anyMap?: boolean;
};

const PING_INTERVAL_MS = 15_000;
const AVAILABLE_TIMEOUT_MS = 4000;

export class Session {
    private socket?: WebSocket;
    private pingTimer?: number;
    private listTimer?: number;
    private me: Partial<MemberView> = {};
    view: SessionView = { status: "offline", name: "" };

    // The UI redraws on these; the run takes the rest
    onChange?: () => void;
    onStart?: (game: GameStart) => void;
    onUp?: (from: string, message: unknown) => void;
    onDown?: (message: unknown) => void;
    onLeft?: (id: string) => void;
    onGone?: (reason: GoneReason) => void;
    onChat?: (line: ChatLine) => void;

    get room(): RoomView | undefined {
        return this.view.room;
    }

    get id(): string | undefined {
        return this.view.you;
    }

    get isHost(): boolean {
        return this.view.room !== undefined && this.view.room.hostId === this.view.you;
    }

    private update(changes: Partial<SessionView>): void {
        this.view = { ...this.view, ...changes };
        this.onChange?.();
    }

    // Whether there's a relay to play through
    async available(): Promise<boolean> {
        try {
            const url = new URL(relayUrl());
            url.protocol = url.protocol === "wss:" ? "https:" : "http:";
            const response = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(AVAILABLE_TIMEOUT_MS) });
            const status = response.ok ? ((await response.json()) as { coop?: boolean }) : undefined;
            return status?.coop === true;
        } catch {
            return false;
        }
    }

    connect(): Promise<boolean> {
        if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
            return Promise.resolve(this.view.status === "online");
        }
        this.update({ status: "connecting", error: undefined });
        return new Promise((resolve) => {
            let socket: WebSocket;
            try {
                socket = new WebSocket(relayUrl());
            } catch {
                this.update({ status: "offline", error: "Couldn't reach the co-op server." });
                resolve(false);
                return;
            }
            this.socket = socket;
            socket.onmessage = (event) => {
                let message: ServerMessage;
                try {
                    message = JSON.parse(String(event.data)) as ServerMessage;
                } catch {
                    return;
                }
                this.receive(message);
                if (message.t === "welcome") {
                    resolve(true);
                }
            };
            socket.onclose = () => {
                if (this.socket !== socket) {
                    return;
                }
                const wasOnline = this.view.status === "online";
                this.socket = undefined;
                window.clearInterval(this.pingTimer);
                this.update({
                    status: "offline",
                    room: undefined,
                    you: undefined,
                    name: "",
                    servers: undefined,
                    error: wasOnline ? "Lost the connection to the co-op server." : "Couldn't reach the co-op server.",
                });
                if (wasOnline) {
                    this.onGone?.("hostLeft");
                }
                resolve(false);
            };
        });
    }

    close(): void {
        const socket = this.socket;
        this.socket = undefined;
        window.clearInterval(this.pingTimer);
        socket?.close();
        this.browse(false);
        this.update({ status: "offline", room: undefined, you: undefined, name: "", servers: undefined });
    }

    // Whether the list of public servers is wanted: on, it's asked for now
    // and every few seconds until it's off (the co-op screen, out of a room)
    browse(on: boolean): void {
        if (on === (this.listTimer !== undefined)) {
            return;
        }
        window.clearInterval(this.listTimer);
        this.listTimer = undefined;
        if (on) {
            this.list();
            this.listTimer = window.setInterval(() => this.list(), LIST_EVERY_MS);
        }
    }

    private list(): void {
        if (this.view.status === "online" && !this.view.room) {
            this.send({ t: "list", size: LIST_PAGE });
        }
    }

    private send(message: unknown): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    private receive(message: ServerMessage): void {
        switch (message.t) {
            case "welcome":
                this.update({ status: "online", you: message.id, name: message.name, error: undefined, anyMap: message.anyMap === true });
                this.pingTimer = window.setInterval(() => this.send({ t: "ping" }), PING_INTERVAL_MS);
                if (this.listTimer !== undefined) {
                    this.list();
                }
                break;
            case "rooms":
                // Only a change redraws the screen (it's asked every few
                // seconds, and someone may be typing a code on it)
                if (JSON.stringify(message.rooms) !== JSON.stringify(this.view.servers) || message.full !== this.view.full) {
                    this.update({ servers: message.rooms, full: message.full });
                }
                break;
            case "named":
                this.update({ name: message.name });
                break;
            case "room": {
                // The relay's word on this player's ready is the truth (it
                // resets everyone's when a run starts)
                const mine = message.room.members.find((m) => m.id === message.you);
                if (mine) {
                    this.me = { ...this.me, ready: mine.ready };
                }
                this.update({ room: message.room, you: message.you, error: undefined });
                break;
            }
            case "gone":
                this.update({ room: undefined, error: GONE_TEXT[message.reason] || undefined });
                this.onGone?.(message.reason);
                break;
            case "error":
                this.update({ error: message.message });
                break;
            case "start":
                this.onStart?.(message.game);
                break;
            case "up":
                this.onUp?.(message.from, message.d);
                break;
            case "down":
                this.onDown?.(message.d);
                break;
            case "left":
                this.onLeft?.(message.id);
                break;
            case "chat":
                if (typeof message.text === "string") {
                    this.onChat?.({ from: String(message.from ?? ""), name: String(message.name ?? ""), text: message.text, system: message.system === true });
                }
                break;
        }
    }

    // A line of chat for everyone in the room, in the lobby or in the run
    sendChat(text: string): boolean {
        const line = text.trim().slice(0, MAX_CHAT_CHARS);
        if (!line || !this.view.room) {
            return false;
        }
        this.send({ t: "chat", text: line });
        return true;
    }

    // Who this player is, for the room: sent on joining and whenever it
    // changes (the same again is nothing)
    setMe(changes: Partial<MemberView>): void {
        const next = { ...this.me, ...changes };
        if (JSON.stringify(next) === JSON.stringify(this.me)) {
            return;
        }
        this.me = next;
        if (this.view.room) {
            this.send({ t: "me", ...changes });
        }
    }

    private joinAs(): Partial<MemberView> {
        return { ...this.me, ready: false, build: GAME_BUILD };
    }

    // A server of this player's own: public (in the list for anyone) or
    // private (by its code only)
    create(mapId: string, open: boolean): void {
        this.update({ error: undefined });
        this.send({ t: "create", open, mapId, endless: false, hard: false, me: this.joinAs() });
    }

    // The host's: public or private from here on
    setOpen(open: boolean): void {
        this.send({ t: "settings", open });
    }

    join(code: string): void {
        const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
        if (!clean) {
            return;
        }
        this.update({ error: undefined });
        this.send({ t: "join", code: clean, me: this.joinAs() });
    }

    leave(): void {
        this.send({ t: "leave" });
        this.update({ room: undefined });
    }

    // Always sent: a press is a press, whatever this side thinks it was
    setReady(ready: boolean): void {
        this.me = { ...this.me, ready };
        if (this.view.room) {
            this.send({ t: "me", ready });
        }
    }

    // The host's
    setMap(mapId: string): void {
        this.send({ t: "settings", mapId });
    }

    kick(id: string): void {
        this.send({ t: "kick", id });
    }

    disband(): void {
        this.send({ t: "disband" });
    }

    start(game: GameStart): void {
        this.send({ t: "start", game });
    }

    // The host's back in the lobby after a run
    end(): void {
        this.send({ t: "end" });
    }

    sendUp(message: unknown): void {
        this.send({ t: "up", d: message });
    }

    sendDown(message: unknown): void {
        this.send({ t: "down", d: message });
    }
}
