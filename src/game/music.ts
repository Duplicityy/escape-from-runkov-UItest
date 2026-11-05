// Music: one recording looped quietly under the guild and each map, when
// there is one. The cache keeps its tracks as the client's own packed MIDI
// with its own instrument bank, which nothing here can play, so the tracks
// are recordings dropped into full-assets/music as <map id>.ogg and
// menu.ogg (scripts/copy-assets.mjs brings them over); a map without one is
// quiet.
import { settings } from "./settings";

let element: HTMLAudioElement | undefined;
let current = "";

export function playMusic(url: string): void {
    if (current === url && element) {
        applyMusicVolume();
        return;
    }
    stopMusic();
    current = url;
    const audio = new Audio(url);
    audio.loop = true;
    element = audio;
    applyMusicVolume();
    audio.play().catch(() => {
        // No file, or the page hasn't been touched yet (a browser won't
        // play before that): once more on the first touch
        const retry = () => {
            if (element === audio) {
                audio.play().catch(() => undefined);
            }
        };
        window.addEventListener("pointerdown", retry, { once: true });
        window.addEventListener("keydown", retry, { once: true });
    });
}

export function stopMusic(): void {
    if (element) {
        element.pause();
        element.removeAttribute("src");
        element.load();
        element = undefined;
    }
    current = "";
}

export function applyMusicVolume(): void {
    if (element) {
        element.volume = settings.muted ? 0 : settings.music;
    }
}
