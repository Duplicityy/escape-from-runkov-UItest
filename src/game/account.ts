// The player's account (version 116; functions/api/[[path]].ts): a name
// nobody else has and a password, with the save kept on the server, so the
// same progress is there on any phone or computer logged in to it. This
// browser keeps only the account's name, its token (never the password)
// and which revision of the save it last had; every change to the save is
// sent a moment later, and one from another device that's newer comes back
// in its place.
import { SaveData } from "./save";

const STORAGE = "dungeon-extraction-account";
// A save is sent this long after the last change to it, so a run of clicks
// in the vault is one write
const PUSH_DELAY_MS = 2500;
const TIMEOUT_MS = 10_000;

export type AccountState = { name: string; token: string; rev: number };

// Where the API is: beside the page on the site itself (the playtest's has
// its own accounts), `wrangler pages dev dist --port 8790` beside a local
// dev server (the local relay's metrics have 8788), and the main site's
// from anywhere else (itch.io)
const LOCAL_API_PORT = "8790";

export function apiBase(): string {
    const host = location.hostname;
    if (host.endsWith(".pages.dev") || location.port === LOCAL_API_PORT) {
        return `${location.origin}/api`;
    }
    if (host === "localhost" || host === "127.0.0.1") {
        return `http://${host}:${LOCAL_API_PORT}/api`;
    }
    return "https://escape-from-runkov.pages.dev/api";
}

export function savedAccount(): AccountState | undefined {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as AccountState | null;
        return data && typeof data.name === "string" && typeof data.token === "string" ? { ...data, rev: Number(data.rev) || 0 } : undefined;
    } catch {
        return undefined;
    }
}

function keep(state: AccountState | undefined): void {
    try {
        if (state) {
            localStorage.setItem(STORAGE, JSON.stringify(state));
        } else {
            localStorage.removeItem(STORAGE);
        }
    } catch {
        // No storage: logged in for this visit only
    }
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; data?: T };

async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<ApiResult<T>> {
    try {
        const response = await fetch(`${apiBase()}/${path}`, {
            method,
            headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(TIMEOUT_MS),
            keepalive: method === "PUT" && JSON.stringify(body ?? "").length < 60_000,
        });
        const data = (await response.json().catch(() => ({}))) as T & { error?: string };
        if (!response.ok) {
            return { ok: false, status: response.status, error: data.error ?? "The account server said no.", data };
        }
        return { ok: true, data };
    } catch {
        return { ok: false, status: 0, error: "Couldn't reach the account server. Check the connection and try again." };
    }
}

export class Account {
    state = savedAccount();
    // A save waiting to go, and what came back when another device's was
    // newer (main.ts loads it)
    private timer?: number;
    private sending = false;
    private again = false;
    onNewer?: (save: SaveData) => void;
    onLoggedOut?: () => void;

    get name(): string | undefined {
        return this.state?.name;
    }

    checkName(name: string): Promise<ApiResult<{ free: boolean; why?: string }>> {
        return call("GET", `name?name=${encodeURIComponent(name)}`);
    }

    async signUp(name: string, password: string, save: SaveData): Promise<ApiResult<{ token: string; name: string; rev: number }>> {
        const result = await call<{ token: string; name: string; rev: number }>("POST", "signup", { name, password, save });
        if (result.ok) {
            this.state = { name: result.data.name, token: result.data.token, rev: result.data.rev };
            keep(this.state);
        }
        return result;
    }

    async logIn(name: string, password: string): Promise<ApiResult<{ token: string; name: string; save: SaveData | null; rev: number }>> {
        const result = await call<{ token: string; name: string; save: SaveData | null; rev: number }>("POST", "login", { name, password });
        if (result.ok) {
            this.state = { name: result.data.name, token: result.data.token, rev: result.data.rev };
            keep(this.state);
        }
        return result;
    }

    // The account's save as the server has it now
    async pull(): Promise<ApiResult<{ name: string; save: SaveData | null; rev: number }>> {
        if (!this.state) {
            return { ok: false, status: 401, error: "Not logged in." };
        }
        const result = await call<{ name: string; save: SaveData | null; rev: number }>("GET", "save", undefined, this.state.token);
        if (result.ok) {
            this.state = { ...this.state, name: result.data.name, rev: result.data.rev };
            keep(this.state);
        } else if (result.status === 401) {
            this.forget();
        }
        return result;
    }

    // The save's changed: it goes in a moment (now, with `soon` false: a
    // run's end, the page going away)
    push(save: SaveData, soon = true): void {
        if (!this.state) {
            return;
        }
        window.clearTimeout(this.timer);
        if (soon) {
            this.timer = window.setTimeout(() => void this.send(save), PUSH_DELAY_MS);
        } else {
            void this.send(save);
        }
    }

    private async send(save: SaveData): Promise<void> {
        if (!this.state) {
            return;
        }
        if (this.sending) {
            this.again = true;
            return;
        }
        this.sending = true;
        const result = await call<{ rev: number; save?: SaveData | null }>("PUT", "save", { save, rev: this.state.rev }, this.state.token);
        this.sending = false;
        if (result.ok && this.state) {
            this.state = { ...this.state, rev: result.data.rev };
            keep(this.state);
        } else if (!result.ok && result.status === 409 && result.data) {
            // Played on another device since: that's the save now
            if (this.state) {
                this.state = { ...this.state, rev: result.data.rev };
                keep(this.state);
            }
            if (result.data.save) {
                this.onNewer?.(result.data.save);
            }
            return;
        } else if (!result.ok && result.status === 401) {
            this.forget();
            return;
        } else if (!result.ok) {
            // Offline or the server's down: tried again with the next change,
            // or in a while
            this.timer = window.setTimeout(() => void this.send(save), 30_000);
        }
        if (this.again) {
            this.again = false;
            void this.send(save);
        }
    }

    async logOut(): Promise<void> {
        const token = this.state?.token;
        window.clearTimeout(this.timer);
        this.forget();
        if (token) {
            await call("POST", "logout", {}, token);
        }
    }

    private forget(): void {
        this.state = undefined;
        keep(undefined);
        this.onLoggedOut?.();
    }
}
