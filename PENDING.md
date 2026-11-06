# Pending for the next push

Version 107 (built 5 November 2026, not deployed): Ancient Magicks (README's "Ancient
Magicks"): the sixteen combat spells on the spellbook's Ancient page, OSRS's costs, effects
(smoke poison, shadow weaken, blood heal, ice freeze; bursts and barrages hit a 3x3), OSRS's
autocasting staves only. 25 more spotanims (360-391) and the cache's icons 325-340 in
`public/ui/spells/`; soul runes (566) added; `spellbook` in the save; `frz`/`wk`/`psn` on the
co-op `hit` message. `GAME_BUILD` 107.

Version 106 (built 5 November 2026, not deployed): the spellbook (README's "The spellbook";
`src/content/spells.ts`). Staves cast the standard spellbook's twenty combat spells, strike to
surge in wind, water, earth and fire, with OSRS's rune costs and spot animations (42 new
spotanims exported and packed into `public/assets/spotanims`, ids in `assets.json`); the staff's
tier is how high it casts; elemental, battle, mystic and combination staves, the Kodai wand and
the tomes give their runes. B (or the pack panel's Spellbook tab) picks a spell to autocast,
kept in the save as `autocast`. New item: wrath runes (21880, tier 5, surges' catalyst; icon in
the sheet). Runes re-tiered (the four elemental runes tier 1, chaos 2, death 3, blood 4, wrath
5), `AMMO_LIMITS.runes` 100 to 2,000, kills drop 15 to 30 elemental runes or 4 to 8 of the map's
catalyst, the shop sells elemental runes by 100/500, and the trader sells the map's catalyst
and 100 air runes. The staff special is now "Power surge". `GAME_BUILD` 106. Spell icons are
the cache's sprites in `public/ui/spells/`.

Version 36 (3 November 2026): co-op for up to four players (README's "Co-op"), with the relay
live on Fly.io (`relay/README.md`). Version 37 fixed the host being thrown back to the guild
screen when the room updated as the run loaded. Version 38 bounded the host's snapshot (nearest
36 enemies a snapshot, a tenth of a tile) and raised the relay's host allowance to 160 KB a
second, since the relay had been cutting hosts off on a roused map, which sent everyone home.
(The real cause of that was Fly's trial stopping the machine every five minutes; a card on the
account ended it.) Version 39 fixed depositing from the pack into the stash, which left an empty
stack in the stash (the count was read after the pack was emptied of it); old empty stacks are
dropped on load. Version 40: enemies' sounds fade with distance from the player (full within 7
tiles, gone at 26, `hear()` in `run.ts`), so a mate's fight across the map isn't heard; and the
guild's rooms open from the party screen, with Back returning to the party while in one.
Version 41: the pack holds eight pieces of food and sixty arrows or runes at most, a bite takes
1.8 seconds, arrows and runes cost 12 and drop one kill in ten (three to six), and a roused boss
moves nearly as fast as the player. Version 42 rebalanced gear for that: defence soaks more
(`SOAK_HALF_AT` 80 to 60 in `combat.ts`: 60 defence halves a hit), and a piercing hit gets through
half the armour instead of all of it. `scripts/balance.ts` now chews at the real pace, caps food
and plays each tier's own full set. Version 43 fixed guests being unable to ready up for a second
run: the relay resets everyone's ready at a start, but the game still thought it was ready and
dropped the next press as no change. Version 44: armour kinds (melee, ranged, magic) with the
combat triangle's defence and the weapon bonus and penalty (README's "Armour has a kind").
Version 45: only melee bosses get the chase speed, and any boss gives up thirty tiles off and
walks back to where it stood. Version 46: the food limit is fifteen, and things can be dropped
from the pack in a run (right click, or the pack's Drop switch), laid down by the host in a party.
Version 47: a boss gives up at twenty tiles, not thirty. Version 48: a melee boss gives up at
eight, and a boss only notices you from three quarters of its give-up distance. Version 49: 132
more pieces of gear (the ranged and magic progressions in full, the missing metal slots, the
end-game prizes), tiered by what OSRS asks to wear them; `GEAR-NOT-ADDED.md` lists what's
still out. Version 50 (4 November 2026, Cloudflare Pages from here on): about a hundred more
pieces, and the emotes are gone for good (every player piece exported with `--no-emotes`, the
courtyard code removed), a quarter off every piece's size. Version 51: the Santa hat is gone
(no cosmetic gear, no trims; a save that held one loses it on load), and a fourth batch of real
combat gear: Fremennik and Temple Knight sets, white, slayer helmets, every defender and metal
glove, more shields and books, jewellery, god capes, 3rd age, the god hides, more bows and
sceptres, every elemental staff, and the newer weapons. Version 52: the fifth and last gear
batch, 270 pieces, everything in the export that is real combat gear (README's "The gear" says
what it holds and what stays out); about 850 pieces in all. Version 53: the same-stat twins the
user then asked for after all (every plateskirt the game lacked, the lower Shayzien tiers, the
Proselyte tasset, Fancy boots), 33 pieces; the other left-out kinds (prayer and diary gear, skill
capes, recolours and trims) stay out. Version 54: prayer gear does something: every piece with
an OSRS prayer bonus has it (`PRAYER_BONUS` in `items.ts`, about 130 pieces), each point making
the prayer bar drain a thirtieth slower and refill a thirtieth faster; tooltips and the worn
line show it (README's protection bullet). Version 55: harder, since a map is meant to take a
few runs to beat unless you're lucky: enemies have about a fifth more hitpoints and hit a fifth
harder, bosses have a third to twice the hitpoints (600 / 980 / 1300 / 2500 / 4000 by tier,
from 299 / 598 / 966 / 1403 / 1955) and hit harder (18 / 25 / 29 / 45 / 60), so in the sim a
tier's own full set beats its boss about one run in three on all its food, and the tier below's
set never does (README's "Balance"; `BALANCE_SEEDS=12` gives the sim a steadier read). Version
56: the phone controls laid out again (README's "On a phone or tablet"): one big button under the
right thumb that says what it does (Open, Dig, Escape...), Eat, Pray and Spec in an arc above it,
Pray held opening a fan of protections, Pack and Pause under the minimap, the potion slots alone
in the hotbar, a resting ring for the stick (and a setting to keep it there), red edges and a
ring on Eat when hitpoints are low, a buzz on big hits, and a ring under the enemy being hit.
Version 57: bosses hit for less (16 / 22 / 26 / 39 / 52 by tier, from 18 / 25 / 29 / 45 / 60)
and their rolls lean low (`bossRoll` in `combat.ts`: the lower of two, so the max is rare and the
usual hit two thirds of it); in the sim a tier's own set now beats its boss about four runs in
five on all its food (README's "Balance"). Version 58: co-op is servers, not codes: the Co-op
screen lists every public server (name, host, map, players), joined with one press; hosting makes
a public server by default, or a private one, which stays off the list and takes its code only;
the host switches between the two until the run starts (README's "Co-op"). The relay already
had all of it (open rooms, the list), so only the game changed. Version 59: ammunition in kinds,
and ranged and magic filled out. Eight kinds of arrow (bronze to dragon) and eight of rune (mind
to blood), each of a tier with a power: a bow or staff hits its max with the best kind of its
own tier, more with better and less with worse, and shoots the best kind packed (`AMMO`,
`MATCH_POWER` in `items.ts`, `ammoScale` in `combat.ts`); each shot looks like its kind; enemies
drop their map's tier, the shop sells each kind once a map of its tier is open, the trader the
map's own; the pack holds sixty arrows and sixty runes of every kind together; an old save's
arrows and runes are the bronze and mind kinds. A seventh gear batch, 85 pieces: every dart,
knife and throwing axe, Morrigan's javelin and axe, chinchompas (a burst takes half off what's
beside the target), salamanders, the phoenix crossbow, wands, plain staves and sceptres, and the
magic robes the game lacked (README's "The gear" says what, and why melee still has about twice
as many). The balance sim is unchanged (its sets use their own tier's ammunition, so a scale of
one). Version 60: the moderator's crown, a gold crown with an M by the maker's name in co-op
party lists, for the browser that holds the key (README's "Co-op", `crown.ts`). Version 61: the
crown over the maker's head in a run too (over the name, for the others), by their name on the
title screen, and a notice when a browser takes the key, so it's plain which browser holds it;
the crown link with `&home` keeps the key in the address, for a phone's home-screen icon (its
storage is apart from the browser's). Version 62: on a phone the guild's screens scroll from a
drag on anything, items included: the panels in them were scroll boxes of their own (taking the
drag and moving nothing), so only a touch on the gaps between things moved the screen; now the
screen is the one scroller, and the pause pages in a run the same (README's "On a phone or
tablet"). Version 63: the way out is Clan Wars' Free-for-all portal, a white swirl spinning
between two stone pillars (loc 26645, `EXIT_LOC` in `run.ts`), in place of the trapdoor; Run
Escape's scenery exporter now carries an object's own animation as a "play" clip (the lobby's
Clan Wars portal, 29667, a low yellow vortex, is in the assets too, unused). Version 64: the
crown is the grey owner's crown with a blue jewel and O from an RSPS forum crown pack
(`public/ui/mod-crown.png`), a little smaller over the head, with "Owner" under it in the
jewel's blue (one sprite drawn into a canvas, `crownSprite()` in `crown.ts`). Version 65: a
second crown for the playtester, the pack's grey mod crown with a green jewel and its M redrawn
as an S (`public/ui/dev-crown.png`), with "Salmon Dev" under it in the letter's green; the
crowns are a table by key hash in `crown.ts`, so each key draws its own. Version 66: the pack
holds 150 arrows and 100 runes (`AMMO_LIMITS` in `items.ts`, one limit a kind in place of sixty
for both), and a kill drops arrows or runes one time in four instead of ten
(`AMMO_DROP_CHANCE` in `run.ts`). Version 67: the pet that follows gives a small gift of its
boss's, one each (`PET_BUFFS` in `pets.ts`, README's pets bullet lists the twelve; `run.ts`
applies them, the Tasks screen and the title screen say which). Version 68: every map is Run
Escape's whole arena (3 by 3 map squares for most, 3 by 4 for Lumbridge; before, 2 by 2 round
the spawn, and one square for Kourend, Varlamore and Prifddinas), exported one file per square
(the exporter's `--tiles`) and loaded a square at a time, nearest the player first
(`mapload.ts`; README's "The maps"); the way out's closing time grows with the map's area
(`closeSeconds` in `run.ts`). Version 69: four ways out a map instead of one (`EXIT_COUNT` in
`run.ts`), each a good walk from the spawn and kept a third of the map's longer side from the
others where the ground allows (`EXIT_SPREAD_SHARE`, halved until a spot is found); any of them
escapes, each shows green on the minimap once seen, the opening message and the boss's death
point at the nearest, and the host sends them all to guests (`exits` in the `world` message).
Version 70: a genie (NPC 326) two tiles from the spawn grants a wish out of the map for coins,
at once and without waking anything (`FERRY_NPC`, `ferryFee` in `run.ts`: 150 coins at one star,
2.2 times more a tier; the host sends him as `ferry` in the `world` message); nothing once the
ways out have closed. Version 71: coins can be packed for a run. The stash screen's Coins section
(and a Coins row at the head of the stash) moves a typed amount, or all, between the bank
(`save.coins`) and a coins stack (item 995) in the backpack; `packUp` in `main.ts` turns the stack
into the run's starting purse (`broughtCoins`, taken off the best haul), and an escape banks the
purse as before. Version 72: two co-op fixes. A player's gear swap in a run now reaches the
party (a `gear` message up from a guest, passed down by the host; `Mate.wear` in `mates.ts`
rebuilds the look, swing and stance), where before a mate was drawn in the gear they joined with
for the whole run. And mates' pets are drawn now: `Mate` creates the loadout's pet and walks it
after them in each browser (no network traffic; it may clip a wall), where before only your own
pet was ever made. Version 73: a crowned browser (the owner's or the playtester's key) picks a
colour for the character's name on the Character screen (`NAME_COLORS` in `crown.ts`, ten
swatches, yellow the default); it's kept in `character.nameColor`, travels with the loadout, and
is drawn on the title screen, in party rows, the HUD's party list and over the head in a run, in
every browser only after that player's crown key has checked out (`nameColorOf`). Version 74: the
relay's made-up names ("Mighty Miner") are shown nowhere: party rows, the HUD and over-head
labels use the character's name alone (`heroName` in `ui.ts`, "Adventurer" for a player with no
loadout), the "You're X here" line is gone, and the relay names a room for its host's character
("Cody's server") and lists the host by it (`characterName` in `relay/coop-relay.mjs`, so the
relay needs deploying too). Version 75: forty more tasks (sixty in all; README's Tasks bullet
lists them). The run's report grew for them (`RunReport`: hits taken, chests opened, the golden
chest, potions drunk, specials used, trader buys, the genie, seconds left, party size). Version
76: in co-op a fallen player is down for a minute while anyone else stands, and a mate holding E
beside them for four seconds revives them at 30% hitpoints (README's "Down, not dead"); a dead
player's body now stays lying on the map for the whole party, where before it was removed the
moment their death was announced. A guest still down when the host's run ends counts as dead.
Only the game changed (the relay passes the new `revive` message on like any other). Version
77: more chests on the maps that had few for their size, and every map's chests spread apart
(README's "A map holds a crowd" paragraph has the counts). Version 78, balance: the genie takes
only coins found in the run and his wish no longer counts for the fastest escape or the no food,
no kills, no hits and last minute tasks; enemies go by walkable ground (40 to 200 a map, about ten
a thousand tiles); a co-op fall's revive window halves with each fall (60, 30, 15 seconds) and the
party boss gains three quarters more hitpoints a player, from half; chest purses 60 to 150 (golden
chest 150 to 300, vault 200 to 400); boss hitpoints scaled per map to even out each tier
(`BOSS_HP_SCALE`). README has the numbers. Version 79: the owner's and the playtester's crowned
browsers have a second character, a separate save switched from the title screen (README's
Co-op section, after the name colours). Version 80: the switch calls the second character "Test
character", and the owner's test character keeps a Saradomin rune set and godsword that always
comes back (`kit.ts`). Version 81: two handers held as OSRS holds them (godswords, mauls and
heavy two handers, the bulwark, spears and halberds; README's "How the character is drawn"), with
every player piece exported again with eight more clips (`full-assets/player`; the old export is
in `full-assets/player-before-v81`, safe to delete), and a look plays its stance from the start.
Version 82: both crowned test characters keep every item in the game in the stash for good
(README's two characters paragraph). Version 83: the 18 gilded pieces for the owner's test
character alone, at the head of its stash (worn models and icons added to the assets; README's
two characters paragraph). Version 84: the gilded armour has Zamorak's red trim (worn pieces and
icons exported again with `--retint 6057:937`). Version 85: the gilded scimitar is the Zamorak
ornamented rune scimitar's model with a gilded blade (`--like 12389:23334 --recolor 36133:7114`).
Version 86: the gilded scimitar's blade has a red edge (`--edge 37090,37157:36133:937` added).
Version 87: the gilded armour in iron's colours with the Zamorak red trim kept (README's gilded
paragraph has the export options), with the recolour order fixed so the shoulder pads are grey
with a red trim rather than solid red. Version 88: the gilded weapons match, iron with Zamorak red
(README's gilded paragraph). Version 89: Salmon Dev's test character gets an iron and Guthix green
Sunfire fanatic set of its own (README's two characters section). Version 90: item icons come
already lightened in a second sheet, `items-lit.png` (`scripts/icon-sheet.mjs` writes both), in
place of index.html's live SVG filter, which Safari drew some icons through as plain white
shapes; the filter is kept only for the fallback icons when the sheet never loads, and items on
the ground still use the unlightened `items.png`. Version 91: a full map in every run (M, the
minimap or a phone's Map button), dragged and zoomed, unwalked ground dimmed (README's full map
bullet). Version 92: the stash is a bank, a grid of icons in tabs with a search, the picked thing
shown under it to wear or pack, and Deposit pack and Deposit worn (README's Bank & gear bullet).
Version 93: chickens and imps are passive, fighting only once hit, and the weapon's own swings
leave them be (README's passive bullet). Version 94: trees and bushes are no longer safe spots;
canopies are see-through, enemies step off them and walk straight in when nothing's in the way
(README's safe spots bullet). Version 95: every clue scroll in the pack has its own dig spot
(there was one per run, so with two, solving one left the other with nothing to dig); reading
lists each, the nearest first. Version 96: a Hotbar size slider in Settings (1 to 2.5 times; until
it's set, bigger on a screen over 800 pixels high), with the prompt and the messages kept clear
of it. Version 97: the end of a run's screen sits in a darker box, drawn 1.4 times bigger on a
screen at least 1200 by 900, 1.75 at 1700 by 1250 and 2.2 at 2300 by 1600 (style.css's
.summary-box); it scrolls from its top when taller than the screen. Version 98: a click or a tap
on the world swings again (the HUD layer had taken every click since `#ui > *` gave it pointer
events, so only Space swung, and passive imps and chickens couldn't be fought by mouse or touch);
the run listens for pointerdown, and a press while the weapon recovers waits 0.6 s for it. On a
phone on its side Pack, Map and Pause sit in a row beside the minimap (under it they ran into
Spec and Pray), a screen under 330 high gets smaller buttons, and the hotbar is capped at 1.4.
Version 99: no SVG filter anywhere; icons.ts lifts items.png in a canvas for the interface (the
same pixels as items-lit.png, which is now only fetched if the canvas can't), and lifts each
fallback icon's own file the same way. Some icons showed as plain white shapes, which only the
old filter on the fallback icons could do (Safari's engine). Version 100: a stack on the ground
gives what fits and leaves the rest (it was all or nothing, so 14 food turned down a stack of
2); a guest asks the host for `n`, and `taken` carries `n` and `left` for everyone else.
Version 101: save codes are DX2, the stash and pack as bare ids, deflated, in URL-safe base64
(a 48-stack bank's code from 2,315 characters to about 730); DX1 codes still load, and a
browser without CompressionStream still writes DX1. Save code opens a box with the code and a
Copy button (the clipboard, or the old select-and-copy) in place of the browser's prompt, and
Load code says a code may have been cut short. Version 102: the bank moves any amount of a
thing either way, as coins: a How many box, 1/5/10/100 and All, and Pack N and Bank N buttons
capped by the food and ammunition limits and the pack's free slots; a packed stack of more
than one opens those instead of going back whole. Version 103: a protection prayer switched on
plays the client's sound (2676 melee, 2677 missiles, 2675 magic, ids from the OSRS wiki's sound
files) and shows its overhead icon (the cache's headicons_prayer frames 0 to 2, exported with
Run Escape's new scripts/cache/export-sprites.ts into public/ui/headicons), over this player
and over every mate: a guest's move carries `p`, a snapshot's hero state a tenth element.
Version 104: the owner's crown is dark grey with a red jewel and O (`public/ui/owner-crown.png`:
the pack's grey one with blue, each blue pixel made the red of the same shade the pack's gold
crown with red uses), and "Owner" under it is red (#e01b1b).
Version 105: a chat box at the top (ui/chat.ts), folding to a bar: the run's own messages (no
longer at the bottom left) and, in a co-op room, the party's chat in the lobby and the run.
Enter opens it to type, Esc leaves it without pausing. The relay passes `chat` to everyone in
the room, the sayer too, naming who said it itself, one line of at most 120 characters with
control, hidden and backwards-text characters taken out, five at once then one every 1.5
seconds. Lines are drawn as text only. The relay needs deploying for chat to work.

Version 35 (3 November 2026): food prices up another 250% (shrimps 105, shark 7,875).

Version 34 (3 November 2026): what you escape with stays in your pack (the stash screen puts it
away), and the boss's golden chest is locked until the boss drops its key, which it does every
time.

Version 33 (3 November 2026) shipped the balance changes made while co-op was being written: no
gear better than the map's tier from anything on it, the Santa hat one legendary roll in five
hundred, the boss's ring of flame gone (the boss never gives up the chase instead), bosses with
15% more hitpoints, food half again as dear, and a fresh start for everyone (save version 3).

Version 20 shipped the harder game, the two title screen layouts and the three investigated
fixes; README.md's "How it plays" and "The guild" describe all of it. New fixes found later go here.
