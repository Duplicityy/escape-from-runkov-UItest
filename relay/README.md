# The co-op relay

Co-op needs one small server that the players' browsers all connect to: they find each other in
rooms here, and the host's game reaches the guests through it. It is Run Escape's relay
(`coop-relay.mjs` and its two helpers), plain Node with no packages, copied here unchanged. It
runs no game of its own and keeps nothing once a room is empty.

The game looks for it at the address built in (`VITE_COOP_URL` at build time, or the default in
`src/game/coop.ts`), and offers co-op only when a plain GET of that address answers
`{"coop":true}`.

## Hosting it on Fly.io (Dallas, always on, about $2 to $3 a month)

Once, on your PC:

1. Install flyctl: https://fly.io/docs/flyctl/install/ (on Windows, in PowerShell:
   `pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"`).
2. Sign in: `fly auth login` (opens the browser; make the account there, with a card on it: the
   free allowance covers most of this).
3. From this folder (`dungeon-extraction/relay`):

```bash
fly launch --copy-config --no-deploy
```

   It reads `fly.toml`. If the app name `escape-from-runkov-relay` is taken, let it pick another
   and tell me the name. Say no to a database and to anything else it offers.

```bash
fly deploy --ha=false
```

   `--ha=false` matters: without it Fly makes two machines, and a room made on one doesn't exist
   on the other (rooms live in the relay's memory). If there are ever two, `fly scale count 1`.
   The app was made on 3 November 2026 (organization `osrs-god`, shared IPv4 66.241.125.140);
   `fly status` shows its one machine, `fly logs` what it's doing.

4. Check it answers: open `https://escape-from-runkov-relay.fly.dev/coop` (with the app's name) in
   a browser; it should show `{"coop":true}`.

Then the game is built with that address:

```bash
$env:VITE_COOP_URL = "wss://escape-from-runkov-relay.fly.dev/coop"; npm run build
```

or the default in `src/game/coop.ts` is changed to it, and pushed to itch as usual.

## Running it on this PC for testing

```bash
node relay/coop-relay.mjs --any-map
```

serves it on `ws://localhost:8787/coop`, which the dev server's game uses on its own when the page
is on localhost. `--any-map` (what the Fly config sets with `MULTIPLAYER_ANY_MAP=on`) lets guests
join a room on a map they haven't unlocked themselves; without it the relay only lets players in
who have the map, going by what each game says it has unlocked. `relay/coop-relay.mjs` has every
limit at its top (rooms, players a room, bytes a second); Run Escape's `docs/DEVELOPMENT.md`
describes them.
