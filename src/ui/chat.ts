// The chat box at the top of the screen (version 105; at the bottom left on
// a computer since version 113, style.css's): the run's own
// messages ("You pick up shrimps.") and, in a co-op room, what the party
// says to each other, in the lobby and in the run. It folds to a bar that
// shows the newest line for a moment, with a count of the party's lines
// missed; open, it keeps the last CHAT_KEEP lines and a box to type in.
//
// It lives on the page's body, over the guild's screens and the HUD, so
// it stays the same box from the lobby into the run and back. What anyone
// types is only ever drawn as text, never as HTML.
import { ChatLine, MAX_CHAT_CHARS, MemberView, Session } from "../game/coop";
import { crownIcon, crownVerified, nameColorOf } from "../game/crown";
import { saveSettings, settings } from "../game/settings";

type Kind = "game" | "party" | "system";
type Entry = { kind: Kind; text: string; at: number; from?: string; name?: string };
type Channel = "all" | "game" | "public" | "private" | "clan" | "trade" | "about";

const CHAT_KEEP = 100;
// How long a line shows on the folded bar
const TICKER_MS = 6000;

export class Chat {
    readonly root: HTMLDivElement;
    private readonly bar: HTMLButtonElement;
    private readonly latest: HTMLSpanElement;
    private readonly badge: HTMLSpanElement;
    private readonly ticker: HTMLDivElement;
    private readonly panel: HTMLDivElement;
    private readonly log: HTMLDivElement;
    private readonly form: HTMLFormElement;
    private readonly input: HTMLInputElement;
    private readonly filters: HTMLElement;
    private readonly filterButtons = new Map<Channel, HTMLButtonElement>();
    private readonly filterStates = new Map<Channel, HTMLElement>();
    private referenceLayout = false;
    private referenceOpen = false;
    private channel: Channel = "all";
    private entries: Entry[] = [];
    private unread = 0;
    private active = false;
    private tickTimer?: number;

    constructor(private readonly session: Session) {
        this.root = el("div", "chat");
        this.root.hidden = true;
        this.bar = el("button", "chat-bar");
        this.bar.type = "button";
        this.bar.title = "Open or fold the chat (Enter to type, when you're in a party)";
        const label = el("span", "chat-title");
        label.textContent = "Chat";
        this.latest = el("span", "chat-latest");
        this.badge = el("span", "chat-badge");
        const caret = el("span", "chat-caret");
        this.bar.append(label, this.latest, this.badge, caret);
        this.bar.addEventListener("click", () => this.setOpen(!this.opened));
        this.ticker = el("div", "chat-ticker");
        this.log = el("div", "chat-log");
        this.log.tabIndex = 0;
        this.log.setAttribute("role", "log");
        this.log.setAttribute("aria-label", "Chat messages");
        this.input = el("input", "chat-input");
        this.input.type = "text";
        this.input.maxLength = MAX_CHAT_CHARS;
        this.input.placeholder = "Say something to your party";
        this.input.autocomplete = "off";
        this.input.enterKeyHint = "send";
        this.input.spellcheck = true;
        const send = el("button", "chat-send");
        send.type = "submit";
        send.textContent = "Send";
        this.form = el("form", "chat-form");
        this.form.append(this.input, send);
        this.form.addEventListener("submit", (e) => {
            e.preventDefault();
            this.send();
        });
        // Esc gets out of the box without pausing the run; the run's own keys
        // never see what's typed (run.ts skips keys meant for an input). A
        // key let go of still reaches the run, so one held when the box
        // opened doesn't stay down
        this.input.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
                e.preventDefault();
                this.input.blur();
            }
        });
        this.panel = el("div", "chat-panel");
        this.panel.append(this.log, this.form);
        this.filters = el("nav", "reference-chat-filters");
        this.filters.setAttribute("aria-label", "Chat controls");
        const channels: [Channel, string, string][] = [
            ["all", "All", "Show all game and party messages"],
            ["game", "Game", "Show game messages"],
            ["public", "Public", "Public chat is unavailable; view channel information"],
            ["private", "Private", "Private messages are unavailable; view channel information"],
            ["clan", "Clan", "Show your current party's chat"],
            ["trade", "Trade", "Trade chat is unavailable; view channel information"],
            ["about", "About", "View chat and game controls"],
        ];
        for (const [channel, name, title] of channels) {
            const button = el("button", `reference-chat-filter channel-${channel}`);
            button.type = "button";
            button.title = title;
            button.dataset.channel = channel;
            const label = el("span", "reference-chat-name");
            label.textContent = name;
            const state = el("span", "reference-chat-state");
            button.append(label, state);
            button.addEventListener("click", () => {
                if (channel === "all" && this.channel === "all" && this.opened) {
                    this.setOpen(false);
                    return;
                }
                this.channel = channel;
                this.refreshForm();
                this.redraw();
                this.setOpen(true);
            });
            this.filterButtons.set(channel, button);
            this.filterStates.set(channel, state);
            this.filters.append(button);
        }
        this.root.append(this.filters, this.bar, this.ticker, this.panel);
        document.body.append(this.root);
        // Enter opens the box to type in, when there's a party to talk to
        window.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" || !this.active || this.form.hidden || isTyping()) {
                return;
            }
            e.preventDefault();
            this.setOpen(true);
            this.input.focus();
        });
        // How tall it is, for what sits under it (style.css's --chat-h)
        new ResizeObserver(() => this.measure()).observe(this.root);
        session.onChat = (line) => this.heard(line);
        this.setOpen(settings.chatOpen, false);
    }

    private get opened(): boolean {
        return this.referenceLayout ? this.referenceOpen : settings.chatOpen;
    }

    get isOpen(): boolean {
        return this.opened;
    }

    close(): void {
        if (this.opened) this.setOpen(false);
    }

    // The floating reference HUD starts with only its top buttons showing.
    // The guild's saved chat preference is kept independently.
    setReferenceLayout(enabled: boolean): void {
        if (enabled === this.referenceLayout) return;
        this.referenceLayout = enabled;
        this.channel = "all";
        this.root.classList.toggle("reference-chat", enabled);
        this.setOpen(enabled ? false : settings.chatOpen, false);
        this.refreshForm();
        this.redraw();
    }

    // Shown in a run, or in a co-op room's lobby; the box to type in only
    // with a party
    setActive(active: boolean): void {
        if (active === this.active) {
            this.refreshForm();
            return;
        }
        this.active = active;
        this.root.hidden = !active;
        document.body.classList.toggle("chat-shown", active);
        this.refreshForm();
        this.measure();
        window.clearInterval(this.tickTimer);
        this.tickTimer = active ? window.setInterval(() => this.renderTicker(), 1000) : undefined;
    }

    // The party changed (joined, left, a run started): who can be talked to
    refreshForm(): void {
        const party = this.session.room !== undefined;
        this.form.hidden = !party || (this.referenceLayout && this.channel !== "all" && this.channel !== "clan");
        this.input.placeholder = party ? "Say something to your party" : "";
        if (!party && document.activeElement === this.input) {
            this.input.blur();
        }
        this.renderBar();
    }

    // One of the run's own messages
    game(text: string): void {
        this.add({ kind: "game", text, at: performance.now() });
    }

    // The client's Friends tab opens the same chat used by Enter.
    openForParty(): void {
        if (this.referenceLayout) {
            this.channel = "clan";
            this.refreshForm();
            this.redraw();
        }
        this.setOpen(true);
        if (!this.form.hidden) {
            this.input.focus();
        }
    }

    private heard(line: ChatLine): void {
        if (line.system) {
            this.add({ kind: "system", text: line.text, at: performance.now() });
            return;
        }
        this.add({ kind: "party", text: line.text, from: line.from, name: line.name, at: performance.now() });
        if (!this.opened && line.from !== this.session.id) {
            this.unread++;
            this.renderBar();
        }
    }

    private send(): void {
        if (this.form.hidden) return;
        const text = this.input.value.trim();
        if (!text) {
            this.input.blur();
            return;
        }
        if (this.session.view.status !== "online" || !this.session.sendChat(text)) {
            this.add({ kind: "system", text: "Not connected to the co-op server: nothing was sent.", at: performance.now() });
            return;
        }
        this.input.value = "";
        // Back to the run's controls on a computer; a phone's keyboard
        // stays up for the next line until it's put away
        if (!window.matchMedia("(pointer: coarse)").matches) {
            this.input.blur();
        }
    }

    private add(entry: Entry): void {
        this.entries.push(entry);
        if (this.entries.length > CHAT_KEEP) {
            this.entries.shift();
        }
        const stuck = this.log.scrollTop + this.log.clientHeight >= this.log.scrollHeight - 4;
        const scrollTop = this.log.scrollTop;
        if (this.referenceLayout) {
            this.redraw();
            if (!stuck) this.log.scrollTop = scrollTop;
        } else {
            this.log.append(this.line(entry));
        }
        while (this.log.childElementCount > CHAT_KEEP) {
            this.log.firstElementChild?.remove();
        }
        // Kept at the newest unless they've scrolled back to read
        if (stuck) {
            this.log.scrollTop = this.log.scrollHeight;
        }
        this.renderBar();
        this.renderTicker();
    }

    private setOpen(open: boolean, save = true): void {
        if (this.referenceLayout) {
            this.referenceOpen = open;
        } else {
            settings.chatOpen = open;
            if (save) saveSettings();
        }
        this.root.classList.toggle("open", open);
        this.panel.hidden = !open;
        if (open) {
            this.unread = 0;
            this.log.scrollTop = this.log.scrollHeight;
        } else if (document.activeElement === this.input) {
            this.input.blur();
        }
        this.renderBar();
        this.renderTicker();
        this.measure();
    }

    // The bar: a word on how to talk, and folded, what's been missed (the
    // newest lines show under it, renderTicker's)
    private renderBar(): void {
        const open = this.opened;
        const party = this.session.room !== undefined;
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        this.latest.textContent = party && !this.form.hidden ? (coarse ? "tap to talk" : "Enter to talk") : open ? "" : "game messages";
        this.badge.textContent = !open && this.unread > 0 ? String(this.unread) : "";
        this.badge.hidden = open || this.unread === 0;
        this.renderFilters();
    }

    private renderFilters(): void {
        const party = this.session.room !== undefined;
        const states: Record<Channel, string> = {
            all: !this.opened && this.unread ? String(this.unread) : "",
            game: "On",
            public: "Off",
            private: "Off",
            clan: party ? "On" : "Off",
            trade: "Off",
            about: "",
        };
        for (const [channel, button] of this.filterButtons) {
            const selected = this.opened && this.channel === channel;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
            const state = this.filterStates.get(channel)!;
            state.textContent = states[channel];
            state.classList.toggle("on", states[channel] === "On");
            state.classList.toggle("off", states[channel] === "Off");
        }
        this.filterButtons.get("all")?.setAttribute("aria-expanded", String(this.opened));
    }

    // Folded, the last few lines show under the bar for a moment, as the
    // messages over the run did
    private renderTicker(): void {
        if (this.opened || this.referenceLayout || !this.active || this.root.classList.contains("docked")) {
            this.ticker.replaceChildren();
            return;
        }
        const now = performance.now();
        const recent = this.entries.filter((e) => now - e.at < TICKER_MS).slice(-3);
        this.ticker.replaceChildren(...recent.map((e) => this.line(e)));
    }

    // A line as it's drawn: a party member's name (in their crown's colour,
    // with the crown, when it checks out) and what they said, or the game's
    // own words
    private line(entry: Entry): HTMLDivElement {
        const row = el("div", `chat-line ${entry.kind}`);
        if (entry.kind === "party") {
            const member = this.member(entry.from);
            const crown = crownVerified(member?.loadout?.crown, () => this.redraw());
            const name = el("span", "chat-name");
            if (crown) {
                name.append(crownIcon(crown));
            }
            name.append(document.createTextNode(`${entry.name || "Adventurer"}:`));
            const color = member?.loadout ? nameColorOf(member.loadout.character, member.loadout.crown) : undefined;
            if (color) {
                name.style.color = color;
            }
            const text = el("span", "chat-text");
            text.textContent = ` ${entry.text}`;
            row.append(name, text);
        } else {
            row.textContent = entry.text;
        }
        return row;
    }

    // Lines drawn again (a crown has just checked out)
    private redraw(): void {
        const visible = this.referenceLayout ? this.entries.filter((entry) =>
            this.channel === "all" || (this.channel === "game" && entry.kind !== "party") || (this.channel === "clan" && entry.kind === "party"),
        ) : this.entries;
        this.log.replaceChildren(...visible.map((e) => this.line(e)));
        if (this.referenceLayout && visible.length === 0) {
            const note = el("div", "reference-chat-empty");
            const messages: Record<Channel, string> = {
                all: "No messages yet.",
                game: "Your game messages appear here.",
                public: "Public chat is unavailable. Use Clan to talk with your current party.",
                private: "Private messaging is unavailable. Your friends and party are listed in the Friends panel.",
                clan: this.session.room ? "Your party's messages appear here. Type below to talk to the party." : "Join a party at the guild to chat with friends here.",
                trade: "Trade chat is unavailable. Use the bank and trader's item controls to trade.",
                about: "Click a top button to open this chat box; click All again or the Chat bar to close it. Clan shows your party's messages. Public, Private and Trade are unavailable. Move with the left stick or WASD; click ground to walk. The minimap opens the full map, where discovered ground can be selected as a destination.",
            };
            note.textContent = messages[this.channel];
            this.log.append(note);
        }
        this.log.setAttribute("aria-label", this.referenceLayout ? `${this.channel === "clan" ? "Party" : this.channel[0].toUpperCase() + this.channel.slice(1)} chat messages` : "Chat messages");
        this.log.scrollTop = this.log.scrollHeight;
        this.renderTicker();
    }

    private member(id: string | undefined): MemberView | undefined {
        return id ? this.session.room?.members.find((m) => m.id === id) : undefined;
    }

    // Docked (version 115): the war room's Party chat panel holds it, open,
    // with no bar; undocked, it's the box over the screen again
    dock(into: HTMLElement | undefined): void {
        const docked = this.root.classList.contains("docked");
        // Moved while typing (the war room draws itself again as the party
        // changes): the typing carries on
        const typing = document.activeElement === this.input;
        const caret = this.input.selectionStart;
        const refocus = () => {
            if (typing && document.activeElement !== this.input) {
                this.input.focus();
                this.input.setSelectionRange(caret, caret);
            }
        };
        queueMicrotask(refocus);
        if (into) {
            into.append(this.root);
            this.root.classList.add("docked");
            this.panel.hidden = false;
            this.log.scrollTop = this.log.scrollHeight;
            this.unread = 0;
            this.renderBar();
        } else if (docked) {
            document.body.append(this.root);
            this.root.classList.remove("docked");
            this.panel.hidden = !this.opened;
        }
        this.renderTicker();
        this.measure();
    }

    private measure(): void {
        const height = this.active && !this.root.classList.contains("docked") ? this.root.getBoundingClientRect().height : 0;
        document.documentElement.style.setProperty("--chat-h", `${Math.round(height)}px`);
    }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.className = className;
    return element;
}

// Whether something else that takes typing has the keyboard
function isTyping(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable);
}
