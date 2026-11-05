# Sharing a playtest build

The game is a static site, so a playtest is a folder of files on any web host. Progress saves in
each player's own browser (localStorage), so everyone who opens the link has their own stash, coins
and character, and nothing is shared or sent anywhere. The menu's **Save code** button turns that
progress into text a player can paste into **Load code** in another browser or on another machine.

Everything under `assets` is Jagex's art from the game cache. Keep the page private (a password or
a restricted link), don't list it publicly, and don't sell it.

## Making the package

```
npm run build
```

writes `dist/`: `index.html`, one script, one stylesheet, and the `assets` and `ui` folders (about
310 MB; a player downloads only what their map uses, roughly 20 to 40 MB the first time). Every
model is compressed on its way into `public/assets` by `npm run assets`, three times smaller than
the exported files, because itch.io unpacks an HTML game to at most 500 MB. The build uses
relative paths, so it runs from a sub-folder on a host as well as from a root.

Zip the *contents* of `dist` (so `index.html` is at the top of the zip, not inside a folder) with
Windows' built-in `tar`, which writes the forward-slash names a Linux host expects (PowerShell's
`Compress-Archive` writes backslashes, and itch.io then can't find the files):

```
tar -a -cf ..\dungeon-extraction-playtest.zip -C dist index.html assets ui
```

The zip is about 100 MB: the compressed models are made to squeeze further under zip.

## Uploading with butler

itch.io's command line uploader takes a folder and sends only what changed since the last push,
so a new build is a minute's upload. It lives in `../tools/butler`; `butler login` once (it opens
a page to approve), then:

```
..\tools\butler\butler.exe push dist osrs-god/escape-from-runkov:html --userversion 49
```

(itch's last version is 49: later builds are past its caps.)

## Cloudflare Pages (the main address since 4 November 2026)

The game is hosted on Cloudflare Pages, which has no 500 MB or 1,000-file cap (20,000 files a
deploy, 25 MB a file): `https://escape-from-runkov.pages.dev/`. From version 50 the build is past
itch's limits, so itch keeps version 49 and the itch page should link here. The account is the user's
Cloudflare account (signed in here with `wrangler login`; the project is `escape-from-runkov`).
After `npm run build`:

```bash
npx wrangler@latest pages deploy dist --project-name escape-from-runkov --branch main --commit-dirty=true
```

Later deploys upload only the files that changed. Saves are per site address, so a player moving
from itch brings progress over with Save code and Load code on the title screen. itch's page can
stay as a link to this address, or keep getting pushes while everyone moves.

```bash
```

with a version number higher than last time. The game's own address, with no itch.io page around it, is
`https://html-classic.itch.zone/html/<upload id>-<build id>/index.html`, both numbers from
`butler status`; it changes with every push, and it has no password on it. It's the way round
itch.io's page on an iPhone held sideways, where touches inside the page's rotated or scaled
frame land off target (the game's own page is fine); setting the embed's orientation back to
its default may do the same. The channel name must contain `html` for itch.io to
mark the upload as played in the browser, which it then does on its own. itch.io allows an HTML
game at most a thousand files and folders and 500 MB unpacked, which is why `npm run assets`
writes the flat layout and compresses every model. An upload itch.io has rejected keeps its error
banner on the page until that file is deleted on the project's edit page (Uploads, Delete file),
even after a good push to the same channel; deleting it, or the whole project and making it
again, and pushing afresh clears it.

## Hosting on itch.io (recommended)

itch.io is made for exactly this: free, takes big HTML games, and a page can be hidden behind a
password.

1. Make an account at itch.io, then **Upload new project** (or Dashboard, Create new project).
2. Title: anything. **Kind of project: HTML.**
3. **Uploads**: upload `dungeon-extraction-playtest.zip`, and tick **This file will be played in
   the browser**.
4. **Embed options**: choose **Click to launch in fullscreen**, or set a viewport of at least
   1280 by 800 and tick **Fullscreen button**. The game fills whatever it's given. Tick
   **Mobile friendly** too, and set the orientation to **Landscape**: without the first, itch.io
   tells a phone the game won't work on it and hides the Run game button.
5. **Visibility & access**: **Restricted**, and set a password; give the link and password to
   your testers. (Draft also works: only you and the people you add as collaborators can see it.)
6. Save. The page's **View page** link is what you share.

A new build is the same zip uploaded again on the same project; players keep their saves, since
the save lives in their browser, not in the upload. If a size limit stops you (a browser game must
unpack to 500 MB, and uploads are capped at 1 GB for most accounts), ask itch.io to raise it from
the project's edit page, or drop the heaviest maps from `assets.json`'s `maps` list, run
`npm run assets` and build again.

## Other hosts

- **Netlify** (netlify.com, Sites, drag and drop the `dist` folder): works, no password on the
  free plan, so keep the address to yourselves.
- **Firebase Hosting**: works, needs their command line tool.
- **GitHub Pages and Cloudflare Pages don't work**: Cloudflare caps files at 25 MB and most maps
  are bigger; GitHub Pages' site limit is about the size of the build.
- **No host at all**: send the zip. The player unzips it and runs a one-line web server in that
  folder (`npx serve` with Node.js installed, or `python -m http.server`), then opens the address
  it prints. Opening `index.html` straight from the folder doesn't work: browsers won't let a
  page fetch its files that way.

## Playing from your own PC (quick, while it's on)

Run the dev server for your network and share your machine's address, or put a tunnel in front
of it (cloudflared or ngrok, both free for this) and share the link it gives you:

```
npx vite --host --port 5180
```

```
cloudflared tunnel --url http://localhost:5180
```

Testers play the live code from your machine; their saves are still in their own browsers.
