// A character's friend code (version 116): made from the key its save
// keeps (save.ts's friendKey) with the same sum the relay does
// (coop-relay.mjs's friendCode), so every character has its code from the
// moment it's made, whether or not the relay can be reached. The relay
// makes it again from the key, so nobody can say they're a code that isn't
// theirs.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

// Undefined where the browser can't hash (a page that isn't https or local)
export async function friendCodeOf(key: string): Promise<string | undefined> {
    if (!crypto.subtle) {
        return undefined;
    }
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`runkov-friend:${key}`)));
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS[hash[i] % CODE_CHARS.length];
    }
    return code;
}

// As it's shown and given out: two halves of four
export function formatFriendCode(code: string): string {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
}
