-- Player accounts (version 116): functions/api/[[path]].ts keeps them in
-- Cloudflare D1, one database for the main site and one for the playtest
-- (wrangler.toml). The function makes these tables too, if they're not
-- there; this file is for `wrangler d1 execute <db> --remote --file`.

-- An account: the name as it was typed, the name as it's compared (lower
-- case, spaces, underscores and dashes alike, as OSRS has it), the
-- password's PBKDF2 hash with its salt and rounds, and the save with its
-- revision (each write makes the next; a write from a device that hasn't
-- seen the latest is turned down)
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    canon TEXT NOT NULL UNIQUE,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    rounds INTEGER NOT NULL,
    created INTEGER NOT NULL,
    save TEXT,
    rev INTEGER NOT NULL DEFAULT 0,
    saved INTEGER
);

-- A device that's logged in: the SHA-256 of its token (the token itself is
-- only ever on the device)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    account INTEGER NOT NULL,
    created INTEGER NOT NULL,
    seen INTEGER NOT NULL
);

-- Failed logins and sign-ups, for the limits on guessing
CREATE TABLE IF NOT EXISTS attempts (
    key TEXT NOT NULL,
    at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS attempts_key ON attempts (key, at);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account);
