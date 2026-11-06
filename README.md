# Escape from Runkov

A browser extraction game built on Old School RuneScape's art (the folder and package are still
called `dungeon-extraction`, as is the browser's save key): pick a map, fight what lives there,
open the chests scattered about, and get back to where you came in with the loot. Die and
everything you carried stays out there.

Twelve real OSRS places, cut from the game cache with their ground, buildings and collision:
Lumbridge, Barrows, the Wilderness, the Kharidian Desert, the Fremennik Province, Karamja, Kourend,
Varlamore, Morytania, the God Wars Dungeon, Prifddinas and the Inferno. Each is rated one to five
stars, has the enemies Run Escape puts there, chests on open ground and a boss far from the start
with a golden chest beside it.

## Running it

Needs Node.js 20 or newer, and the exported asset set in `../full-assets` (made with
`Run-Escape/scripts/cache/export-assets.ts`; see `../full-assets/README.md`). From the Run-Escape
folder, the pieces this game needs on top of the full set:

```
npx tsx scripts/cache/export-assets.ts player kits --out ../full-assets
npx tsx scripts/cache/export-assets.ts player items ../dungeon-extraction/assets.json --out ../full-assets
npx tsx scripts/cache/export-assets.ts map lumbridge barrows wilderness desert fremennik karamja kourend varlamore morytania god_wars prifddinas inferno --tiles --full --out ../full-assets
npx tsx scripts/cache/make-game-worlds.ts ../dungeon-extraction/src/content/worlds.json
```

Then here:

```
npm install
npm run assets      # compresses what the game uses from ../full-assets into public/assets (about 300 MB)
npm run dev         # http://localhost:5173
```

`npm run build` type checks and writes a static site to `dist/`, with relative paths so it runs
from a sub-folder on a host as well as from a root. `PLAYTEST.md` says how to put it on itch.io
or elsewhere for testers; the menu's Save code and Load code carry a player's progress between
browsers.

## How it plays

- **WASD** to move. Your weapon attacks on its own whenever an enemy is in its range and in sight
  (**Space** or a click swings anyway), and you can keep moving while it does. **E** opens a chest.
  The ways out are four portals (Clan Wars' Free-for-all portal, a white swirl spinning between
  two stone pillars, with its own animation, version 63), each somewhere else on the map each
  run, a good walk from where you arrived and spread out from each other (a third of the map's
  longer side apart where the ground allows, closer where it doesn't; version 69). The opening
  message says roughly which way the nearest lies, each shows green on the minimap once you've
  been within ten tiles of it, the boss's death message says exactly where the nearest one is,
  and holding **E** at any of them for ten seconds escapes. A way out is loud: the moment you start holding,
  everything idle within fifteen tiles comes running, so the run ends on a last stand rather
  than a quiet walk out. You can't move while holding, but your weapon still swings at whatever
  reaches you, and letting go to deal with it starts the ten seconds over. **I** opens your pack.
- A run is on the clock. After four minutes the map wakes: enemies notice you from twice as far,
  and nothing heals on its own any more. After twelve the ways out close, with warnings at two
  minutes, one and thirty seconds; after that there's no leaving with the loot.
- A fight is noise: an enemy roused, by noticing you or by being hit, rouses everything idle
  within eight tiles.
- You heal half a hitpoint a second only standing still, with nothing after you, eight seconds
  after the last hit, and only before the map wakes. After that, food is the plan.
- Enemies act on what you do: a mage or archer backs away while you're within half its range
  and shoots from further out (cornered, it shoots from where it is); a melee enemy within four
  tiles goes for your side instead of queueing up in front, where your swings land (each one
  picks a side); and an ordinary enemy below a third of its health runs for help for four
  seconds, rousing everything idle within six tiles as it goes, then comes back and won't give
  up the chase for twelve seconds. Bosses and champions do none of this.
- **Chickens and imps are passive** (version 93; `passive` on `EnemyDef`, `PASSIVE_NAMES` in
  `worlds.ts`): Lumbridge's chickens and imps, and God Wars' imps, never come at you on sight,
  nor for a fight, a noise, a fleeing friend or a watched chest near them, and the weapon's own
  swings leave them be; Space, a click or a tap swings at one, and then it fights back. A gentler
  first map. (Until version 98 a click or a tap never reached the world, the HUD layer took it,
  so only Space did; a press while the weapon recovers now waits 0.6 seconds for it.)
- **No safe spots behind trees** (version 94; `lineOfSight`, `clearWalk` and `nearestFlow` in
  `region.ts`, `chase` in `run.ts`): a tree's or bush's canopy no longer stops a swing, an arrow
  or a spell, only its trunk does; an enemy under a canopy steps off it onto the flow field
  instead of standing there; and an enemy close by with a clear straight walk takes it, so one
  no longer circles a tree while you shoot it from under the leaves.
- **Hills and objects** (version 109; `openHills` and `fits` in `region.ts`, the exporter's
  `collision` command): the cache blocks a lot of hillside by its floor, not by anything on
  it, so a dune ridge or a mountainside stopped you like a wall. Blocked ground that slopes a
  quarter of a tile to three tiles across one is run over now; steeper is a cliff and stays,
  and so do water, flat blocked ground (a mountain top, the map's edge, but for small flat
  pockets among the hills) and anything under a roof or with a wall on it (Rellekka's longhall
  stands on sloping blocked floor). The hills opened don't count as more ground for a map's
  chests and enemies (`isHill`). Objects block where they stand, as in Run Escape
  (`ArenaGrid`): a free standing one by its model's base (a signpost by its post), one beside
  open ground a fifth of a tile in from that side, and one that draws nothing not at all; the
  body's circle is checked against each box it reaches, so it slides round corners too.
- **Water** (version 112; `WATER_TEXTURES` in `region.ts`, the exporter's `collision` writes
  each textured overlay's texture as `overlayTextures`): the cache blocks deep water but not
  all of it, since in OSRS the banks keep you out, and with the hills open heroes and enemies
  waded out over rivers and the sea (Lumbridge's river, 609 tiles of it, could be walked on).
  Every tile of a water texture (1, 130 to 133, 135, 140, 141, 150 to 154, 175, 176) is
  solid now on every map; swamp (25), lava (31) and the paved and planked overlays are as the
  cache has them. Water stops a body but not sight: arrows, spells and a look still go across
  it, and a pond is never taken for a tree. Three tiles of land, cut off by water, went with
  it (one on Fremennik, two on Varlamore).
- One enemy in twenty is a champion: gilded, a third bigger, two and a half times the hitpoints,
  twice the damage, four times the coins, and always carrying a piece of gear. On four and five
  star maps champions come in pairs. One enemy in twelve is an elite, shown by its tint (`TRAITS`
  in `run.ts`) and called out when it comes: fast (yellow, half again as quick), armoured (grey,
  your hits do six tenths), venomous (green, its hits poison you for four ticks of 3% of your
  hitpoints; any food settles it) or regenerating (pink, heals 2% a second once left alone for
  three seconds). An elite is worth twice the coins.
- A boss below sixty percent is enraged: redder, attacking a third faster, with a few of the
  map's commonest enemy at its side, and every seven seconds it slams the ground, a red ring on
  the ground warning where a second ahead; stand in it and the hit is half again as hard. An
  enraged boss left alone for ten seconds catches its breath and heals a tenth, so it can't be
  waited out at range. Every boss has a move by its map's tier (`defaultMoves` in `worlds.ts`):
  none at one star; hits through armour and protection at two; burning floor at three; a second
  form (or, for a shooter, swapping styles) at four; both at five. A few have their own instead
  (`MOVES`): both Jads swap between fire and arrows every cast and say which is coming, so
  protection has to swap with them; Verac's hits go through armour and protection; the Kalphite
  Queen sheds her shell and rises again at most of her health, quicker; the Hunllef marks tiles
  round you every eight seconds that burst for a share of your hitpoints a moment later.
- One chest in fifteen is a mimic: open it and a champion of the map's enemies is there
  instead. One in five of the rest is watched: opening it brings everything idle within twelve
  tiles running.
- Every map has a **vault**, the crystal chest, a walk from where you arrive and light blue on
  the minimap. It's locked: one of the map's champions carries the crystal key (there's always
  at least one champion), and picking the key up says which way the vault lies and marks it.
  Inside are two pieces of the map's own tier (with a better chance of its prize than a chest
  has) and a purse. The key is no use off the map.
- The gear in your pack weighs on you: each piece slows you 1.5%, up to 30%. What you wear
  doesn't count.
- **Food can't be spammed**: the pack holds fifteen pieces of food at most, in all (`FOOD_LIMIT`
  in `items.ts`; the stash's Pack button, pickups and the trader all stop there; a stack on the
  ground gives what fits and leaves the rest, since version 100), and a bite takes
  1.8 seconds before the next (`EAT_DELAY`): "You're still chewing." Ammunition is 150 arrows
  and 2,000 runes at most, every kind together (`AMMO_LIMITS`; runes were 100 before the
  spellbook, version 106), at 3 to 150 coins each in the shop by the kind, and a kill drops
  ammunition one time in four: three to six arrows of its map's tier, or 15 to 30 of one
  elemental rune, or four to eight of the map tier's catalyst (`runeDrop` in `spells.ts`). A roused melee boss moves nearly as fast as you do unburdened
  (`BOSS_CHASE_SPEED`), so it can't be shot from a walk backwards for ever; a boss that shoots
  keeps its own pace.
- **Armour has a kind**, the combat triangle's way (`style` on each piece in `items.ts`, from its
  name): plate, mail and metal helms are melee armour, leather, hides, coifs and Karil's ranged,
  robes, hoods, Ahrim's and the books magic; jewellery, capes and void are neutral. A piece's
  defence counts half against the style its kind is weak to (melee armour to magic, ranged to
  melee, magic to ranged: `WEAK_TO`), so a knight in full plate takes a mage's spells on half his
  armour. And armour helps the weapon it suits: each piece of the weapon's kind adds 3% to its
  hits, each piece of another kind takes 4% off, between -30% and +20% (`STYLE_HELP`,
  `STYLE_HINDER` in `inventory.ts`): plate with a bow or a staff is a poor idea. The stash and
  pack panels show the defence against each style and what the armour does to the max hit.
- **Dropping**: a right click on a thing in the pack (I) drops it a step ahead of you, the whole
  stack of a stackable, and the pack's Drop switch does the same for a left click (or a tap on a
  phone) until it's switched off. Dropped things lie there like any loot: for making room, or for
  a friend in a co-op run to walk over and take (the boss's key, say). In a party a guest's drop is
  laid down by the host, so everyone sees it.
- **F** eats, picking the food that fills the gap best. **1**, **2** and **3** drink a strength
  potion (hits a quarter harder), a defence potion (20 more defence) or a Saradomin brew (heals
  40, and 15 more hitpoints), each for 90 seconds; **4** drinks a prayer potion, which puts 40
  back on the prayer bar at once. The hotbar at the bottom shows what each key would use and how
  long a potion has left. Enemies drop prayer potions one kill in twenty-five, and the shop and
  chests have them.
- About a third of the enemies that walk (not mages, archers or champions) patrol a round of
  two or three tiles near where they stand, slowly, until they notice you; the rest stand.
- Die, and a gravestone goes up where you fell (`graves` in `save.ts`) with everything you
  carried and wore in it, bar what was insured; if the insurance paid out, the stone holds only
  every other thing (one safety net a death). It stands for your next two runs, on any map
  (the maps screen says where and how long); go back to that map, walk to it (it's the lilac
  dot on the minimap, always) and **E** takes back what fits in your pack, and the stone goes
  once it's empty. One stone a map: dying there again moves it and puts the rest in with it.
  Walking out from the pause menu leaves no stone.
- Now and then a kill drops a **clue scroll** (one in thirty-three, one a run; some supply chests
  hold one). Pick it up and it names a spot a good walk off, as paces and a compass point from
  where you stand; click it in your pack to read it again from somewhere else, which narrows
  the spot down. Within six tiles the ground says it's close, within three **E** digs up a
  casket: two pieces of gear of the map's tier, and a purse. With more than one scroll (a mate's,
  say), each has its own spot and reading lists them all, the nearest first (version 95; before,
  solving one left the other with nothing to dig). The scroll crumbles on the way out
  if it's still in the pack.
- One boss in eight leaves a **pet** behind: a small copy of itself that follows a step behind
  you on runs (catching up by itself if it's left behind or stuck), stands beside your character
  in the courtyard, and is yours whatever happens out there. The Tasks screen lists them and
  picks which one comes along (`pets.ts`). A boss drops no second pet. The pet that follows
  gives one small gift of its boss's (`PET_BUFFS`, applied by `run.ts`): the Wise Old Man's +6
  prayer bonus, Verac's hits that never roll below a third of the max, the Chaos Fanatic's
  special bar 20% faster, the Kalphite Queen's 6% more defence, Dagannoth Prime's one shot in
  five taking no ammunition, TzTok-Jad's 8 hitpoints, Skotizo's 1 off every hit taken, the
  Javelin Colossus's 5% faster walking, Sotetseg's breath caught twice as fast, K'ril's hits 5%
  harder, the Hunllef's 15% more coins from kills (the host's pet, for a party's drops), and
  JalTok-Jad's burning floor at half. A crown's **own pet** (version 118,
  `content/crownpets.ts`) is no boss's: the owner's crown has **Yami**, Yama's pet (NPC 14203,
  model 10339, its idle 12140 and walk 12143, exported with `export-assets.ts npc 14203` and in
  `assets.json`), whose hits land 6% harder; Salmon Dev's (the playtester's) crown has **Vorki**,
  Vorkath's pet (version 119: NPC 8025, model 35023 at the pet's own size, its idle 7948 and walk
  7959; the other sequences on that skeleton are the boss's own), the same 6%. Every character of a browser holding that crown has
  it, following unless another pet's picked (`restoreCrownPets` in `kit.ts`, once the crown's
  check is done); a save without the crown has it taken away. It counts for none of the pet tasks,
  and the party sees it like any pet.
- One run in four is at **night**: the sky and fog close in, the map and everything on it go
  down to a blue dark (the map's materials are darkened in place and put back when the run
  stops, since the menu shares the model; `worldLight` in `assets.ts` is the light on everything
  made during the run), and enemies notice you from only six tenths of their usual distance, so
  you can slip past things. The minimap is drawn by day either way. The HUD says "night". Since
  version 114 each hero carries a **torch** (`src/game/torch.ts`): a warm, flickering light
  round them, done in each material's shader with no real lights. `?night` in the address makes
  every solo run a night, to try it.
- Once the **boss** has noticed you it chases until you're some way off, so a fight you aren't
  ready for can be fled: a melee boss gives up eight tiles from you, one that shoots twenty
  (`BOSS_GIVE_UP_MELEE`, `BOSS_GIVE_UP`), and a boss only notices you from three quarters of
  that, so it can't rouse and give up by turns. Then it loses interest, says so, and walks back
  to where it stood. Protection drains twice as fast while it's after you: you can halve its hits,
  not for the whole fight. The boss stands where the fight has room: a spot with at least 150 open tiles reachable
  within nine of it (`bossTile`, `roomAround` in `run.ts`), never in a building or a lane; on a
  map with no such spot it takes the roomiest found. (There is no ring round the fight any more.)
- **Durability**: every hit you take wears each piece of armour you're wearing a little (two
  hundred hits from new to worn through), and a worn through piece has lost half its defence.
  A piece says so at half worn and when it's through. The stash's Repairs list fixes a piece for
  a tenth of its price per full wear (`WEAR_PER_HIT`, `REPAIR_SHARE` in `inventory.ts`; the wear
  is kept by item id in the save and comes and goes with the gear).
- Gear of the fourth and fifth tier drops under a **shaft of light** (lilac, or gold for the
  fifth) with a chime (`playChime` in `assets.ts`: nothing in the cache rings, so it's three sine
  notes) and a message, so a good drop is seen across the clearing.
- Somewhere on every map a **wandering trader** (the Mysterious Old Man's model) has set up, a
  good walk from where you arrive and a blue dot on the minimap once seen. **E** at his side
  opens his stall over the run, which stands still meanwhile: the map's food, every potion and
  arrows and runes by the bundle, at half again the shop's prices, paid from the coins you're
  carrying; and he buys the gear in your pack at the shop's price for it, which lightens the
  pack. The coins are still only yours if you get out.
- A **genie** floats two tiles from where you arrived (version 70). **E** at his side pays him
  for a wish out of the map, at once and quietly, with everything you carry: 150 coins on a one
  star map and 2.2 times more a tier (330, 730, 1,600, 3,510; `ferryFee` in `run.ts`), about a
  third of a run's takings, paid only from coins found on the map this run (picked up, or the
  trader's for what you sold him; version 78), not from coins packed from the bank. He grants
  nothing once the ways out have closed. So a run can end by walking back to the start and paying,
  or by finding a portal for nothing. A wish isn't a run to the way out: it sets no fastest escape,
  and doesn't count for the tasks about how a run went (no food, no kills, no hits, the last
  minute), which it would otherwise give away in a few seconds.
- **Esc** pauses: the world stands still behind a menu with Resume, **Stats** (your numbers, what
  each one does, and what the gear you wear and the potions in you give), Settings, and **Leave
  run**, which walks out of the map leaving everything you carry and wear behind, as dying does,
  though it isn't counted as a death.
- Nothing hits through a wall, in either direction, and an enemy with no way round to you waits
  rather than walking into one.
- Some enemies are mages or archers: they stop six or seven tiles off and shoot instead of
  closing in, and the spell or arrow flies at you, a spell bursting where it lands (`SHOOTERS` in
  `worlds.ts`: the Wise Old Man, the Chaos Fanatic, Dagannoth Prime, both Jads, Sotetseg and the
  Hunllef throw fire waves; revenants, serpent shamans and TzHaar-Mej throw fire strikes; desert
  bandits, the God Wars rangers and aviansies, nylocas toxobolos, Iorwerth archers, TzHaar-Xil
  and the Javelin Colossus shoot).
- Bows take an arrow a shot from the pack, the best kind packed. Arrows come in eight kinds
  (bronze, iron, steel, mithril, adamant, rune, amethyst, dragon), each of a tier (version 59;
  `AMMO` in `items.ts`): a bow hits what its max hit says with the best kind of its own tier,
  more with a better kind and less with a worse one (`ammoScale` in `combat.ts`: the kind's power
  over the tier's, `MATCH_POWER`; a ★★★ bow hits 58% with bronze arrows and 121% with dragon), and
  the shot flies as the arrow it is. Enemies drop a few of their map's tier, the shop sells each
  kind by the bundle once a map of its tier is open, the trader sells the map's own, and without
  any a bow shoots nothing. Thrown weapons (darts, knives, throwing axes, chinchompas,
  salamanders) need none: they're their own, and hit less than a bow of their tier for it; a
  chinchompa's burst takes half off everything beside what it hit (`splash`).
- **The spellbook** (version 106, `content/spells.ts`): staves, wands and sceptres cast the
  standard spellbook's twenty combat spells, OSRS's own: Wind, Water, Earth and Fire Strike, Bolt,
  Blast, Wave and Surge, with OSRS's rune costs (Fire Bolt is 4 fire, 3 air and a chaos rune;
  Water Surge 10 water, 7 air and a wrath rune) and their own cast, flight and impact animations.
  The game has no Magic level, so a staff's tier is how high it casts: strikes at tier 1, bolts
  at 2, blasts at 3, waves at 4, surges at 5. A spell hits what the staff's max hit says when it's
  the staff's own tier's fire spell, a little less for earth, water and wind (97%, 94%, 91%), and
  less again for a lower family (`spellScale`: the spell's power over `MATCH_POWER`). As in OSRS,
  elemental staves, battlestaves and mystic staves give their element's runes for nothing, the
  combination staves (smoke, mist, dust, mud, lava, steam) both of theirs, the Kodai wand water,
  and the tomes of fire, water and earth theirs from the shield hand (`GIVES`). **B** opens the
  spellbook, a page of the pack panel (the Pack and Spellbook tabs switch, on a phone too): a
  click picks a spell to autocast, kept in the save (`autocast`), and **Strongest** goes back to
  the default, the strongest spell the staff can cast with the runes packed. A spell the staff
  can't cast or hasn't the runes for is greyed, and the page shows the cast's runes against
  what's packed. The HUD says the spell being cast and the casts left. Runes are nine kinds: the
  four elemental runes, every tier's; and each family's catalyst, of its tier: mind for strikes,
  chaos bolts, death blasts, blood waves and wrath surges. The shop sells elemental runes by the
  hundred and the catalysts by twenty-five, and the trader the map's catalyst and air runes. A
  staff's special attack is called Power surge, so it isn't taken for a Surge spell.
- **Ancient Magicks** (version 107, the spellbook's Ancient page; the open book is kept in the
  save as `spellbook`, and opening the other one stops a spell picked from this one being
  autocast, as in OSRS): Smoke, Shadow, Blood and Ice Rush, Burst, Blitz and Barrage, the
  sixteen with OSRS's rune costs (Ice Barrage is 6 water, 2 blood and 4 death runes) and
  animations. Only OSRS's staves cast them (`ANCIENT_STAVES`: the ancient staff and sceptres,
  the master, Kodai and dragon hunter wands, the nightmare staves, Thammaron's and the accursed
  sceptre; Ahrim's staff with Ahrim's whole set), rushes at tier 3, bursts and blitzes at 4,
  barrages at 5. Their power follows their OSRS max hits along the line the standard fire spells
  draw (`powerOfMaxHit`), so they hit about a seventh harder than a standard spell of the same
  tier and cost more runes. Bursts and barrages hit everything within a tile of the target too,
  up to nine (OSRS's three by three; the others roll 75% to 100% of the target's hit) and land
  with no flight, as in OSRS. Smoke poisons (five green hits of 15% of the max, 17% for blitz
  and barrage, three seconds apart), shadow takes 10% off the target's hits for 30 seconds (15%
  for blitz and barrage; `weakScale`), blood heals the caster a quarter of what it dealt, and
  ice freezes the target in place for OSRS's 4.8, 9.6, 14.4 or 19.2 seconds (a boss shrugs it
  off; a frozen enemy still swings at what's beside it). Soul runes (566, tier 4) are new for
  the shadow spells and Blood Barrage; tier 3 and up maps also drop chaos runes, and tier 4 and
  up death and soul runes, beside their own catalyst. In co-op a guest's spell effects go up
  with the hit (`frz`, `wk`, `psn`).
- **Casting as OSRS casts** (version 108): every spell has OSRS's own cast animation and sounds
  (`clip`, `castSound`, `hitSound` in `spells.ts`). Strikes, bolts and blasts are cast with the
  staff cast (seq 1162), waves with the wave cast (1167), surges with the surge cast (7855),
  rushes and blitzes with Ancient Magicks' single cast (1978), and bursts and barrages with the
  area cast (1979). The cast sound plays as the spell leaves and the hit sound where it lands
  (Fire Strike 160 and 161, Ice Barrage 171 and 168, the wiki's sound ids). In co-op a shot
  carries its spell (`s`), so mates are seen and heard casting it too.
- **What each staff casts, and the staves' own spells** (version 110; `STAFF_MAGIC`,
  `STAFF_SPELL_DEFS` and `POWERED_DEFS` in `spells.ts`): OSRS's rules, from the wiki's autocast
  tables and item pages. A staff, wand or sceptre casts the standard spells unless listed.
  Ancient Magicks: the ancient staff and sceptres, the master, Kodai and dragon hunter wands,
  the nightmare staves but the harmonised, Zuriel's staff, Thammaron's and the accursed
  sceptre, and Ahrim's staff only with all of Ahrim's set and the amulet of the damned. The
  Slayer's staff casts only waves and surges of the standard spells. The staves' own spells,
  shown under the book as "Your staff's own", with OSRS's runes, max hits, cast animations,
  graphics and sounds: Saradomin Strike (Saradomin staff, staff of light), Claws of Guthix
  (Guthix staff), Flames of Zamorak (Zamorak staff, staff of the dead and its toxic one,
  Thammaron's and the accursed sceptre), Iban Blast (Iban's staff) and Magic Dart (Slayer's
  staff, staff of light, staff of the dead and its toxic one). OSRS doesn't let a god staff
  autocast its god spell; the game only autocasts, so it does, and the strongest a staff
  casts (with no spell picked) counts its own spells too. Powered staves cast their built-in
  spell and nothing else, for the runes a charge costs, at the staff's own max hit: the
  tridents of the seas and the swamp (venom one hit in four), the Sanguinesti staff (heals
  half a hit one in five), Tumeken's shadow, the warped sceptre, the bone staff, the Eye of
  Ayak and the lithic sceptre (body runes, new, and earth). Six weapons that aren't magic
  weapons in OSRS are swung now: the mjolnirs, Pharaoh's sceptre, the Dramen staff, the
  Merfolk trident, the skull sceptre and the demonic sceptre.
- Every hit shows its number as a hitsplat, the client's red square, floating up off whoever
  took it. An enemy shows a health bar over its head, the client's way, while it's fighting and
  for six seconds after it's hurt. The boss has the bar at the top of the screen instead.
- **Z**, **X** and **C** (or the Pray button, which cycles) protect from melee, ranged or magic:
  hits of that style do half while the prayer bar under the special bar lasts. It drains while
  protection is on and refills slowly with it off; the same key again takes it off. Switched on,
  it plays the client's sound for it and shows its icon over your head, and over a mate's in
  co-op (version 103; `overhead.ts`, the icons in `public/ui/headicons`, from Run Escape's
  `scripts/cache/export-sprites.ts headicons_prayer`). Holy gear
  helps: every piece with a prayer bonus in OSRS has it here (`PRAYER_BONUS` in `items.ts`:
  Initiate and Proselyte, monk's robes, Zealot's, Sunfire fanatic, Verac's, the god books and
  spirit shields, the blessed hides, the god rune sets, the godswords, fury and the big amulets,
  the fire capes, the Dragonbone necklace), and each point makes the bar drain a thirtieth slower
  under protection and refill a thirtieth faster without, so +30 in all is twice as long and
  twice as quick. A piece's tooltip says its bonus, and the worn gear's line totals it.
- A full Barrows set, helm to weapon, has its effect (`SET_EFFECTS` in `inventory.ts`): Dharok's
  hits harder the lower you are, up to double; Guthan's heals a quarter of what it deals;
  Verac's never rolls low; Ahrim's spells slow what they hit; Karil's bolts hit again one time
  in three; Torag's hits put another half second between the target's attacks.
- Every weapon has a special attack, on **Q** (or the Spec button) when the blue bar under your
  hitpoints is half full; it fills in twenty seconds. The next swing then lands the special:
  most weapons hit half again as hard, bows shoot twice, staves surge, and the named ones have
  their own (the dragon dagger's double puncture, the whip's drain that heals, the godsword's
  judgement at more than double). `specialOf` in `items.ts` is the table.
- The minimap, top right, is the map around you from above, north up: you're the white dot,
  enemies yellow, the boss red, chests orange, the golden chest gold, the way out green. It's
  drawn from one render of the map from straight above when a run starts, under fog that clears
  twelve tiles round you as you walk; what hasn't been seen isn't shown, enemies and chests
  included. The **mouse wheel** takes the camera a little in and out.
- The **full map** (version 91; `src/ui/fullmap.ts`, `drawFullMap` in `run.ts`): **M**, a click on
  the minimap or a phone's Map button (between Pack and Pause) puts the whole map over the
  screen, opened on you. Drag it about with the mouse or a finger, zoom with the wheel, a pinch
  or its + and − buttons (from the whole map on the screen to 24 pixels a tile), and Whole map
  and On me jump to those. The ground not yet walked shows dimmed rather than black, so it reads
  as a map, but the marks (chests, enemies, the boss, the trader, the vault) still show only once
  you've been near them, the ways out once found; where you came in (the genie's spot), your
  gravestone and the party always. A key to the colours sits in a corner (not on a phone's short
  landscape screen). M, Esc or Close shuts it. It takes the controls while it's up and stops the
  world on a run alone; in co-op the world goes on, as with the pause menu.
- A run ends on a recap: the map as you saw it with where you arrived, the way out if you found
  it and where it ended, what killed you, how long it took, the kills, what you ate and what you
  carried.
- Melee weapons hit everything in front of you within reach. Bows shoot arrows at the nearest
  enemy in range (the arrows packed, bolts from any crossbow), staves cast at it, and the shot
  flies nose first and lands with its own impact.
- Two handed swords, mauls and godswords are carried in the two handed stance, staves in the
  staff stance and the whip in its own, standing and running. Daggers stab, the whip lashes, and
  every other weapon swings.
- Two kills in five drop coins (a boss or a champion always does), one kill in twelve some food,
  one in twenty a purse of several times the usual, and one in fifty
  was carrying a piece of gear rolled the way a chest's is. Otherwise **weapons and armour only
  come out of chests.** A map has thirteen to fifty-odd
  chests by its size, spread apart: about half hold a piece of gear (two on four and five star maps), the map's own
  star tier or, about one piece in three, the one under it; the rest hold a piece or two of food
  for the map, a potion, or a purse. **Nothing on a map drops gear better than the map's tier**:
  not a chest, a champion, a kill, the golden chest, the vault or a clue casket. Better gear is
  the next map's, or the shop's, which stocks up to the hardest tier you've been to. An opened
  chest is
  gone, and what was in it lies exactly where it stood. Food is dear in the
  shop (shrimps 105 coins, a shark 7,875, potions 200 to 300, arrows 3 to 100 each, runes 3 to 150), so a run's
  supplies are a cost against its takings. The boss's golden chest is locked: the boss drops its
  key every time it falls (`BOSS_KEY` in `items.ts`, the muddy key's icon; picking it up says
  where the chest is, and it's no use off the map), and inside are two or three pieces of the
  map's tier, a potion and a bigger purse.
- **The best gear is rare.** The strongest piece of each tier and slot is that tier's prize
  (`PRIZES` in `items.ts`, ranked by damage a second for weapons and defence with hitpoints for
  armour: the abyssal whip, the dragon full helm, the magic shortbow and the like), and a prize
  never comes from an ordinary chest, an ordinary kill or the shop: only the boss's golden chest,
  the vault, a champion's drop or a clue casket can give one. From a champion one piece in six is
  a prize, from the golden chest one in fifteen, from the vault or a clue casket one in thirty-two
  (`PRIZE_FULL`, `PRIZE_BOSS_CHEST` and `PRIZE_CASKET` in `run.ts`), the prize picked evenly among
  the tier's. The rest of a tier drops by weight,
  the weakest third of a tier and slot four times as often as the strongest third (`rollGear`).
  A piece's tooltip says when it's a prize. There is no cosmetic gear: nothing that's worn for
  looks alone, and no trimmed, gilded or ornamented versions of pieces the game has.
- Extract, and what you're wearing and carrying comes home as it is, the pack still packed for the
  next run (nothing goes into the stash by itself: the Stash screen puts things away), with the
  coins. Die, and
  the pack and what you wore are left in your gravestone, which lasts two runs. The stash and
  banked coins are always safe.

## On a phone or tablet

On a touch screen (`(pointer: coarse)`, `src/ui/touch.ts`) a run has a stick that appears under
your thumb anywhere on the left of the screen (a faint ring at the bottom left shows where it
rests; Settings can keep it in that ring), and under the right thumb a cluster (version 56): one
big button for whatever's near, which reads **Open**, **Unlock**, **Dig**, **Trade**, **Take**
or **Escape** (hold) from the run's prompt and **Use** when nothing is (it's E either way, so
holding always works), with **Eat** (eats what fills the gap best; the badge is how much food is
left), **Pray** and **Spec** in an arc above it. A tap on Pray turns the last protection on or
off; held, it opens a fan of Melee, Ranged, Magic and Off under the thumb, chosen by sliding onto
one and letting go, and the button then shows what's on. **Pack** and **Pause** sit under the
minimap, out of the fight, and the hotbar is the four potion slots. Below 40% hitpoints the
edges go red and the health bar pulses, Eat gets a ring, and the phone buzzes for a big hit and
as the hitpoints go low (where the browser allows); the enemy being hit has a ring under it,
since there's no cursor. A tap on the world swings. The page is pinned so a phone's browser can't leave
it scrolled after the keyboard, and pinch and double-tap zoom are stopped through Safari's own
gesture events (an iPhone ignores the viewport's no-scaling rule): either would put every touch
off from where things are drawn. The HUD, the pack and the guild's screens
are laid out again for a small screen (the second half of `style.css`): a guild screen is one
column that scrolls as a whole from a drag on anything in it, items included (nothing inside it
is a scroll box of its own, which would take the drag and move nothing; version 62), and the
pause pages in a run the same. The title screen has a **Fullscreen** button. Phones play sideways only: held upright, a cover asks for the phone to
be turned and a run stands still underneath until it is, and in full screen the orientation is
locked where the browser allows (not on an iPhone). Pinch and
double-tap zoom are off; the camera's distance is in Settings.

## Co-op

Up to four play one map together. The title screen's **Co-op** room (there only when the relay
answers) connects to a small relay server and shows the servers: one player hosts a server, picks
the map from the ones they've unlocked, and starts once everyone's pressed Ready; the others join
it. A **public** server (the default) is in the list on the Co-op screen for anyone to join, with
its host, map and how many are in; a **private** server stays off the list and is joined by typing
its eight-letter code, which the host gives their friends. The host can switch a server between
public and private until the run starts. (The list is asked for every three seconds while the
screen is up; `browse()` in `coop.ts`.)

**The war room** (version 115, the mockup's): the Co-op screen. Out of a party, Find a party (the
open ones, joined from the list or by code) and Host a party (for friends by code, or for anyone).
In one, the party's code big with Copy and an **Invite link** (the game opened with `?join=<code>`
joins it once connected), and a seat each: the crown or weapon, the name, leader and fighting
style, what they're doing if not waiting (in the vault, in the shop), the combat level, head,
body, weapon (with the ammunition packed) and neck, their food, prayer potions with the seconds of
protection they give, and what they're **risking** (worn and packed, the insured piece and kept
kit aside), and ready or not; open seats have an Invite that copies the link. A **heads up** names
anyone short of food (under three minutes at this player's own pace of damage, or 150 hitpoints
before there's a pace) or, past the first tier, without prayer potions. Along the bottom the map
(the host's to change), the **loot** rule (Keep what you grab; or **Split at the exit**: every
coin picked up is shared on the host between everyone still in, the odd coins the finder's, each
share in its owner's purse to keep by getting out; `shareCoins` in `run.ts`, a `share` message
down), **who can join** (Code or Anyone), and Descend with how many are ready (a guest's Ready).
On the right, Find a party (how many wait on this map, Browse open parties), Friends, and the
**party chat** docked in its panel (chat.ts's `dock`; it's the box over the screen everywhere
else, and the typing carries on as the room redraws). The chat says when someone opens the vault
or goes to the shop. A member's activity and pack go in their loadout (`Loadout.activity`,
`.pack`), so the relay needs nothing for them.

**Accounts** (version 116): before the guild, the game asks for an account: **Create account**
(a name of 1 to 12 letters, numbers, spaces, dashes or underscores, checked as it's typed and
turned down only when another player has it, compared without case and with spaces, dashes and
underscores alike; and a password of at least 6) or **Log in**. The save is kept with the account
on the server, so the same progress is on every phone and computer logged in to it: this
browser's progress becomes a new account's; logging in brings the account's here. The character's
name is the account's (the Character screen doesn't change it). Every write of the save is sent
2.5 s after the last (`account.ts`, through `save.ts`'s `setOnWrite`), and at once as the page
goes; each write carries the revision it came from, so a device that's behind is turned down and
gets the newer save instead ("played on another device since", never mid-run). If the server
can't be reached the game plays from this device's copy and sends it later. **Log out** (version
117) is on the title screen's bottom row and in Settings, to switch accounts or make another: it
sends what's changed first (asking before losing anything the server can't be reached for), then
starts this device clean, so a new account made here starts from nothing and one logged in to
brings only its own; a device logged out by the server (a token gone stale) keeps that account's
copy, and a new account made on it starts fresh too. A crowned browser's test character stays this browser's alone. The account's welcome
screen gives its **friend code**, made in the game from the save's key (`friendcode.ts`, the
relay's sum), so every character has one from the start, shown on the title card too.

The server is a Cloudflare Pages Function, `functions/api/[[path]].ts`, with D1 (`wrangler.toml`):
`runkov-accounts` for the main site, `runkov-accounts-playtest` for the playtest and every other
preview, so the playtest's kit never reaches a real save. Passwords are PBKDF2-SHA256 (100,000
rounds, a salt each), a device's token is kept as its SHA-256, a session lasts 180 days unseen,
and wrong passwords are limited to 8 a name and 30 an address in 15 minutes, new accounts to 10
an address an hour. `db/accounts.sql` has the tables (the function makes them too). Locally:
`npx wrangler pages dev dist --port 8790` serves a build with the API and a local database, and the
Vite dev server's game uses it there.

**Friends** (version 115): every character has a friend code, eight letters and numbers made by
the relay from a key the save keeps (`friendKey`, never shown; so nobody can be another player's
code), shown in the war room's Friends panel to copy and give out. Adding a friend's code keeps
them in the save (`friends`, at most 50). Once two players have each other's codes, each sees the
other online with what they're doing (title screen, vault, shop, a party with seats free, a run
on a map) and a Join for a party with a seat, there and on the title screen; until both have
added each other neither sees the other. The game connects to the relay as the page opens and
stays connected (tried again 5 s after a drop, doubling to a minute) and says hello with the key,
its character's name, crown name and name colour, what it's doing and the codes it watches; the
relay (`hello`, `friends`, `friendCode`, and `stats` for the counts, in `coop-relay.mjs`) sends
each player their friends who are both online and mutual, again whenever one changes, and keeps a
connection that said hello past the ten-minute idle close. A friend's crown is their game's word
for it (`crownByAlt`): keys go to nobody.

**Chat** (version 105, `src/ui/chat.ts`): a box at the top of the screen on a phone, and since
version 113 at the bottom left on a computer, left of the hotbar and opening upward. It folds to a
bar (it remembers which; folded on a phone to begin with). It holds the run's own messages and, in
a co-op room, what the party says, in the lobby and through the run. Enter opens it to type and Esc
leaves it without pausing; folded, the newest lines show beside the bar (under it at the top, over
it at the bottom) for a moment and a count shows what the party said. The relay (`chat` in
`relay/coop-relay.mjs`) sends a line to everyone in the room, the sayer included. The relay names
who said it, from their character. A line is one line of at most 120 characters, with control,
hidden and backwards-text characters taken out, and five can be sent at once, then one every 1.5
seconds. The game only ever draws lines as text, never as HTML.

The game's maker wears the owner's crown, dark grey with
a red jewel and O (`public/ui/owner-crown.png` since version 104: the RSPS forum crown pack's
grey one with blue, `mod-crown.png`, its blue pixels made red), and their
playtester the developer's, grey with a green jewel and S (`public/ui/dev-crown.png`): by
their name on the title screen and in the party list, and over their head in a run with their
title under it ("Owner" in the blue, "Salmon Dev" in the green; over the name, for the others),
and nobody else can (`crown.ts`, a table of crowns by key hash): their browser holds a key, given once by
opening the game with `?crown=<key>` (the title screen says "This browser holds the crown now";
with `&home` too the address keeps the key, for a phone's home-screen icon, which has storage of
its own),
the key goes to the party with their loadout, and each game checks it against the keys' SHA-256
before drawing a crown. The keys are in no build. A crowned browser also picks a colour for the
character's name on the Character screen (ten swatches, version 73): it shows on the title
screen, in party rows, in the HUD's party list and over the head in a run, and every game draws
it only after that player's key has checked out. A crowned browser has **two characters**
(version 79): a Switch character button on the title screen saves this one and reloads the page
as the other, each a whole save of its own (stash, coins, progress, look, name), the second
starting fresh. The second is kept under its own storage key (`CHARACTER_SLOTS`, `activeSlot`
in `save.ts`), and a page writes only to the slot it loaded, so a second tab can't write one
character over the other. With no key, or one that doesn't check, the game plays the first.
Save code, Load code and Start over act on the character being played. On the switch the second
is always called "Test character" (version 80); in the game it has whatever name it's given on
the Character screen. Both test characters, the owner's and the playtester's, keep every item in
the game in the stash (`kit.ts`, version 82; version 80's kit was the owner's Saradomin rune set
and godsword alone): one of every piece of gear, fifteen of each food, a pack's worth of each kind
of arrow and rune (150 and 2,000), and ten of each potion, 992 items; nothing of coins, clue scrolls
or keys. Whatever is short is topped back up in the stash, unworn, on opening the page and at
every run's end, so a death, a drop or a meal costs none of it. None of it can be sold (the guild
shop shows it as kept, the trader turns it down; that goes for copies found in a run too), and
none of it goes into a gravestone, so coming back never makes two. The owner's own first
character (not the test one) keeps the **Ankou outfit** the same way (version 120, `ANKOU` in
`items.ts`, `OWNER_MAIN_KIT` in `kit.ts`, as the user asked): the mask, top, gloves, leggings and
socks (OSRS ids 20095 to 20107, the cache's own looks with the ghostly robe's bright red, 960,
made a deeper red, 937, and kept see-through: every face of the outfit has the cache's alpha 150,
which the exporter and game keep, exported with `player items` and `item` `--recolor 960:937`;
OSRS's are cosmetic, so each has the Infinity robe piece's numbers for its slot), `exclusive:
"owner"`, and the **red ghostly robes** (version 121, `RED_GHOSTLY`): the Ghostly robes, whose
grey 10266 has the cache's alpha 140, in the same 937 (the cloak's light grey trim, 17467, a
lighter red, 955), each with its Ghostly piece's numbers. The regular Ghostly robes stay grey for
everyone. Their ids are spares in the cache: 27166 to 27168 are its second Ghostly hood, top and
bottom, and 27170 to 27172 (unused copies of other items) carry the gloves', boots' and cloak's
looks, exported with `player items` and `item` `27166 27167 27168 27170 27171 27172 --like
27170:6110,27171:6106,27172:6111 --recolor 10266:937,17467:955`. The owner's test character has
the gilded pieces as well (version 83, `GILDED` in `items.ts`), at the head of its stash under the
coins: the full and med helms, platebody, chainbody, platelegs, plateskirt, kiteshield, square
shield and boots (rune's numbers), the coif and d'hide body, chaps and vambraces (green d'hide's;
the coif a three star ranged helm of its own), and the scimitar, two handed sword, spear, hasta and
axe (rune's). Since version 87 the armour is in iron's colours with the red trim kept: each
plate piece takes its iron twin's colours (Run Escape's `--colours-from 3481:1115,... --keep
937`: the light and dark greys, and what iron leaves as the model has it), and the hides and coif,
which have no iron twin, iron's two greys (`--retint 7114:33,7097:24`). Iron's dark grey (24) is
also the colour the trim starts as, and an item's recolours apply one after another, so the
exporter orders them so nothing is recoloured twice (`safeRecolourOrder`); before that the plate's
dark parts (the shoulder pads, the hides' darker scales) came out red too. The armour has Zamorak's
red trim (version 84). Version 88 matched the weapons: the scimitar's blade iron grey with its red
edge and Zamorak hilt (`--recolor 36133:33`), the two handed sword iron with a red edge and its
gold hilt red (`--colours-from 20155:1309 --edge 546,2754:61:937 --recolor 7110:937`), and the
spear, hasta and axe in their iron twins' colours with their trim red (`--colours-from
20158:1239,20161:11369,23279:1349 --keep 937`). Before that the armour had the trim: the cache's gilded pieces colour
their trim a darker gold (HSL 6057) where Zamorak's colour the same faces red (937), so the
armour's worn pieces and icons were exported with Run Escape's `--retint 6057:937`; the weapons
stay all gold (the two handed sword has no trim to colour), but for the scimitar, which since
version 85 is the Zamorak ornamented rune scimitar's model (23334: the red Zamorak hilt, the
symbol at the pommel) with its rune blue blade gilded and, since version 86, the blade's edge and
spine painted Zamorak red (exported with `--like 12389:23334 --recolor 36133:7114 --edge
37090,37157:36133:937`: the ten blade faces not facing the blade's flat sides). They're `exclusive`: in no chest, drop, shop, prize or balance set, not in the
playtester's kit, and they can't be dropped in a run, so a mate can't take one. The game's no
gilded or trimmed gear rule stands for everyone else. The playtester's test character has a set of
its own the same way (version 89, `GUTHIX_SUNFIRE`, `exclusive: "playtester"`): the Sunfire
fanatic helm, cuirass and chausses (the Sunfire pieces' twins, on the cache's unused noted ids
28934, 28937 and 28940) with the plate and the sun mask in iron's greys and the trim, hood and leg
wraps in Guthix's green (21939), exported with `--like 28934:28933,28937:28936,28940:28939
--recolor 5223:41,5347:41,5210:33,5334:33,5202:24,5198:24,7872:33,7989:24,7987:24,7975:16,7969:16,6608:21939,4550:21939`.
Since 6 November 2026 (asked for by the user) the helm and cuirass are exported each on their
own: the mask light grey (its points 7987 and 7969, its face 7989) with the points' thin sides
(7975) green as their edge, the face's marks (7872) and the chin piece (the rest of 5656) dark
grey, the eyes and mouth green (5656's faces 23, 24, 40, 41, 61, 65 and 92, on both the worn
model 50791 and the inventory one 52235), and the hood dark grey: `item`/`player items 28934
--like 28934:28933 --paint "50791:23,24,40,41,61,65,92:21939;52235:23,24,40,41,61,65,92:21939"
--recolor 7987:41,7969:41,7975:21939,7989:41,7872:16,5656:16,6608:24`; the spiked shoulder pads dark grey
with a green trim round the whole pad, zigzags and collar: the pads' faces that face up, forward
and back (the lists below) get a smaller dark grey copy laid over them by Run Escape's
`--inset-each` (added for this: each face's copy moved in 2.5 units from the pad's outline, so the
pad's green shows as a band round it, with fine lines where the pad's faces meet at an angle; the
user preferred this to `--inset`'s plainer band), `item`/`player items 28937 --like 28937:28936
--inset-each "50889:2,4,5,6,16,17,18,19,177,178,179,181,182,183,184,185,198,199,200,201,202,203,204,205,206,207,208,209,247,248,249,250,258,259,260,261,262,263,264,265,266,267,273,274:24:2.5;52237:1,2,4,5,6,14,16,17,18,19,92,99,100,108,109,118,119,120,122,123,124,125,126,137,138,143,144,145,146,147,148,149,150,198,199,206,246,260,261,262,273,274,275:24:2.5"
--recolor 5223:41,5347:41,5210:33,5334:33,5202:24,5198:21939,6608:21939,4550:21939` (the first model
the worn one, the second the inventory one; 5198 is the chest sun's points, green, its middle left
as it was; `scripts/cache/dump-face-normals.ts <model> 6608`
lists the faces). The chausses' dark grey tassets have a green trim round them the same way:
their own panel's faces (5198's faces above the knee guards: 315 to 324, 329 to 338, 342 to 345,
359 to 364, 374 to 384 and 394 to 397) inset 3 units, the copies keeping their own colour and
the faces underneath painted the trim, `player items 28940 --like 28940:28939 --inset
"50855:<those faces>:-1:3:21939" --recolor 5347:41,5210:33,5334:33,5202:24,5198:24,6608:21939,4550:21939`
(the cracked pattern is separate shards laid over the panel, and stays on top; the chausses' icon
is as it was). `--inset` moves the patch's outline in as a whole, corner by corner, so a panel cut
into thin slivers still gets an even band. The relay is Run Escape's (`relay/coop-relay.mjs`, plain Node), hosted on
Fly.io in Dallas; `relay/README.md` has the steps, and `src/game/coop.ts` the address it's built
with (`VITE_COOP_URL`, or `DEFAULT_RELAY`). A room only takes players on the same build of the game
(`GAME_BUILD` in `coop.ts`, raised with every push).

How it works (`src/game/party.ts` has the messages, `run.ts` sends and reads them, `mates.ts` draws
the others):

- **The host's browser runs the map**: every enemy, drop, chest and hit is decided there, so the
  host wants the best connection. Fifteen times a second it sends everyone a snapshot (where each
  hero and each enemy that's up or near one is, what they're playing) and events for the rest
  (a drop, a pickup, a chest opened, a hazard, a shot, a hit on a guest, a kill, a word for all).
  A guest's browser runs its own character (walking, swinging, eating, the pack, the prayer bar)
  and mirrors the rest, sending the host where it is and what it did (a hit, a pickup it wants, a
  chest it opened, where it dug). The world holds until everyone's loaded (thirty seconds at most).
- **Everyone's own**: gear, pack, coins, gravestone, pet, wear and stats stay each player's, in
  their own browser's save. Whoever reaches a drop first takes it (the host hands it over). A
  guest's clue scroll names a spot for them; the host spills the casket where they dig. The boss's
  key and the vault's go to whoever picks them up. Everyone is drawn in what they wear, swaps
  during the run included, and with their pet trotting after them (version 72; a mate's pet is
  walked by each browser on its own, so it can clip a wall).
- **Tougher for a party**: every enemy has a quarter more hitpoints for each player past the
  first, the boss three quarters more (half until version 78; `PARTY_ENEMY_HP`, `PARTY_BOSS_HP`).
  Enemies go for the nearest hero
  standing (sticking a little to the one they're on). A kill is the killer's; the boss's fall is
  everyone's, so the map counts as beaten for the whole party when they escape.
- **Down, not dead** (version 76): a player who falls while someone else in the party is still
  standing is down for a minute (`REVIVE_WINDOW` in `run.ts`): lying there, out of the fight,
  nothing able to hurt them, a red dot on everyone's minimap and "down" in the party list, with
  the countdown in their prompt and a word to the whole party. A mate who holds E (the big button's
  Revive on a phone) at their side for four seconds brings them back with 30% of their hitpoints
  and three seconds when nothing can hurt them (a `revive` message, a guest's asked of the host).
  Each fall in a run gives half the last one's time (version 78): a minute, then thirty seconds,
  then fifteen. Nobody comes, or nobody's left standing to come, and they die as before. A player who dies stays
  lying where they fell for everyone in the party until the run's over (`Mate.lieDown`), named,
  a grey dot on the minimap; before, the body vanished for the others the moment they died.
- **Out one at a time**: each player escapes (or dies) on their own. Out, you watch the others
  (the camera follows whoever's still in; Esc, then Leave run, goes back to the guild now) until
  they're all out too. The host leaving ends the run for everyone: the others keep what they carry.
  Losing the connection to the party does the same for a guest. Back in the guild the room is a
  lobby again, with "Back to the party" on the summary.
- **The world doesn't wait**: Esc opens the menu in co-op but nothing pauses, and the trader's
  stall is the same. The HUD lists the party with their health under the clock; the minimap shows
  them blue. Each other player is drawn from the loadout they brought, with their name over their
  head and a health bar when hurt.
- Not shared yet: others' pets and gravestones, and gear changed mid-run (a mate's look stays as
  it was at the start).

Testing it on this PC: `node relay/coop-relay.mjs --any-map` beside the dev server, then one tab on
`http://localhost:5180` and another on `http://127.0.0.1:5180` (two origins, two saves). A hidden
tab gets no animation frames, so a scripted test drives `run.update(0.05)` (or `updateHold` while
the world holds) with an `await` every few ticks so the relay's messages arrive.

## The guild

The guild's screens sit over Lumbridge castle's courtyard, where the character stands in what
they're wearing while the camera circles them slowly (`src/game/menu.ts`), the way Run Escape's
title screen does, with the pet that follows them beside them. Since version 114 the screens
between runs and the pause menu wear OSRS-styled panels (`src/skin.css`, over `style.css`): warm
bevelled panels, gold-ruled headings, raised buttons, a green way in, sunk slots and bank cells;
the HUD over a run is as it was. The title screen comes in three layouts (Settings, "Title
screen"; `osrsMenu`, `railMenu` and `cardMenu` in `ui.ts`):

- **Card and rooms** (the default on a computer since version 114): the character's card on the
  left with what they wear laid out as the equipment tab does and their record in big numbers,
  the rooms down the right, and "Descend into" the last map along the bottom. Since version 115,
  as the mockups have it: under the name the crown's word and a **combat level** (`gear.ts`: the
  game has no skills, so it's the gear's, each slot's piece against the best there is for it, the
  weapon 45%, from 3 to 126); the packed ammunition beside the neck; the vault's worth and how the
  last run went and when; Character and **Loadouts** (the vault). The Co-op room names a friend
  who's online with a **Join** when their party has a seat, or else how many servers are open and
  players online; Bank & gear says the vault's worth; the shop that it restocks after a run.
  Above the way in, the **daily contract** (`contract.ts`): one job a day from the date, on the
  newest map open or one of the two before it (kept once seen that day), to escape it with so many
  coins found, kill so many, open so many chests or slay its boss; the best escape of the day
  shows as a gold bar, and the run that does it pays 400 coins (2.2 times more a tier) and a clue
  scroll into the bank (a scroll taken into a run names its spot as one picked up does). **Solo /
  Party** beside the way in: Party hosts a private party on the map and opens the war room. Along
  the bottom the build and how many are in a run right now (the relay's count).
- **Rail** (the only one on a phone): the name and the character's record top
  left, the character in the middle, and the rooms down a rail on the right, each with a line on
  what's waiting there: the last map played and the best escape, how many pieces are in the
  stash and how many need repair, what's insured, what's on the shelves and the coins banked,
  tasks done and pets, and a gravestone if one stands. The save code, fullscreen and start over
  buttons sit small along the bottom. On a phone the way in sits under the left thumb and the
  rail under the right.
- **Card**: the record as a table in a card on the left, a grid of six room tiles on the right,
  and a play bar along the bottom with the way in and the last three maps played as chips that
  start a run there straight away, each saying whether the boss is beaten or a gravestone waits.

Item icons everywhere (the rooms, the stash, the pack, the shop, the hotbar, the summary) come
from one sheet: `scripts/icon-sheet.mjs` (run by `npm run assets`) packs every
`public/assets/items/<id>.png` into `assets/items.png` with `items.json` saying where each sits,
and `src/game/icons.ts` fetches that once, with retries, and draws an icon as a span showing its
cell (`.icon-sprite`). One request for all of them instead of one a slot: a request that failed on
a slow host used to leave a broken image in the pack. If the sheet never comes, the icons fall
back to their own files. They all go through a gamma lift with the same curve as the world's
brightness, because the cache lights them so dark that black items vanished on the brown panels;
since version 99 `icons.ts` does it in a canvas (to the sheet, or to each fallback file), with no
browser filter anywhere (the SVG filter `index.html` had drew some icons as plain white shapes in
Safari); an item on the ground gets its cell of the sheet as a texture, through
the renderer's own curve.

- **Choose a map**: every map, its stars, what lives there and its boss. The maps open in order
  (`worlds.json`'s, by tier, Lumbridge first): a map is locked until the one before it is beaten,
  which means escaping from it in a run where its boss fell (`stats.mapsBeaten`, `mapUnlocked`
  in `worlds.ts`), and a beaten map is marked on the list. The starter kit is good for one star.
- **Bank & gear** (the Stash & gear screen until version 92): the stash is a bank, as OSRS's is:
  a grid of icons, one cell a kind of thing with its count on it (yellow, white past 100K,
  green past 10M), the coins first, in tabs (All, the exclusive pieces when a test character has
  any, weapons, armour, jewellery and capes, food and potions, arrows and runes), searchable by
  name. A click picks a thing and shows it under the grid with Wear and Pack (or, for the coins,
  the amounts to pack and bank). Since version 102 any thing moves in any amount, as coins do: a
  How many box, 1, 5, 10, 100 and All, and Pack N and Bank N, held to the food and ammunition
  limits and the pack's free slots; a packed stack of more than one, clicked, opens the same
  instead of going back whole. Deposit pack puts the whole backpack back, Deposit worn takes
  everything off into it. Wear things, and pack up to 28 slots for the next run. Since version
  115 it's **The Vault**, as the mockup has it: worn equipment in the equipment tab's cross (the
  ammunition packed beside the neck), the most worn piece, the **bonuses** a row each, and
  **loadouts** (up to six sets of gear and pack: + saves what's on now, a click puts one on with
  what's on going back first and says what the vault was short of, right click or hold forgets
  one), with insurance and repairs folded under; the bank in the middle with a **hover card** for
  each thing (its tier, kind and price, and against what's worn there: max hit, speed and special,
  or defence, hitpoints and prayer), **Quantity** 1, 5, 10, X or All for every move (a double
  click packs that many, a click on the pack banks that many; it was the How many box),
  **Rearrange** by dragging a cell onto another (Swap or Insert; `bankOrder`), **tabs of your
  own** (+ makes one of what's picked, things dragged onto it go in, the picked thing's panel puts
  it in or out; `bankTabs`, at most eight, gone once empty), Deposit whole pack, worn gear and
  loose coins, and the value of what's shown; the pack on the right as its 28 slots with how long
  the food lasts at this player's pace of damage (`stats.damageTaken`, `secondsPlayed`, once five
  minutes of runs say), the protection prayer the bar and potions give, what a death would cost,
  Empty pack into vault, and Ready · Descend (back to the party, ready, when in one). OSRS's
  Withdraw as Note isn't there: nothing in a run takes a note. Food in the pack can be
  eaten during a run from the pack panel. **Coins** are here too (version 71): the bank's coins
  head the stash as a stack, and the Coins section packs some for the next run (type how many, or
  pack them all; a hundred, a thousand, ten thousand and half the bank are a press each) and banks
  them again. Packed coins take one pack slot, go into the run's purse for the trader and the
  genie, come home to the bank with an escape and are lost with a death; the best haul counts
  only what came out over them. **Insurance** is here too: a fifth of a piece's price
  brings one worn or packed piece home if you don't make it, for one run, spent either way.
- **Tasks**: sixty things to do across runs (version 75 added forty), each paid once in coins when a
  run ends with it done (`content/tasks.ts`). Long roads: kills (100 to 1,000), bow and staff kills,
  bosses, champions, escapes (one to fifty), a hundred runs, five deaths, escapes within six and
  four minutes, hauls of 1,000 and 10,000 coins, banks of 5,000 to 250,000, each map tier, six
  maps, every map, every map beaten, caskets, a gravestone, vaults, pets (one, three, all), guild
  upgrades (one, all to the top). Things one run can do: escape without eating, without a kill,
  without taking a hit, with ten things or a full pack, at night, in a co-op party (of two, of
  four), with the genie, with under a minute left, wearing every slot, a Barrows set, a prize piece
  or a five star piece; open ten chests, open the golden chest, use five specials, buy from the
  trader, kill a boss at night. The run's report carries what they need (`RunReport` in `run.ts`).
  The screen also shows the record (runs, escapes, deaths, kills, best haul, fastest escape, maps
  escaped, caskets, gravestones), and the **pets** found, with which one follows you.
- **Shop**: eight random pieces of gear, restocked every time you come back from a map, mostly low
  tiers with the odd good piece and never above the hardest map tier you've reached (so a strong
  piece is found out there before it's ever on the shelves), plus food and potions. Gear is priced
  by its tier and slot (a weapon costs more than boots of the same tier), steeply by tier (`TIER_PRICE`
  in `items.ts`: 120 coins at one star to 80,000 at five, times the slot), so a map's takings buy
  a piece of its own tier after a few runs and nothing from far above it, and
  a quarter more for each map tier you've escaped from above the piece's own tier, so the shop
  sells cheaply to beginners and a veteran goes and finds it. It
  sells arrows and runes by the bundle. The shop buys anything from the stash at a quarter of that
  price (`SELL_SHARE` in `inventory.ts`; the trader pays the same).
  The shop's **The guild** list sells upgrades to the guild itself, two levels each: four more
  pack slots, two more pieces on the shelves, cheaper insurance, a faster special bar
  (`UPGRADES` in `save.ts`).
- **Character**: a name, a body built the way the client builds a player (a choice of hair, beard,
  torso, arms, hands, legs and feet from the cache's body kits, with the client's own hair, torso,
  legs, feet and skin colours) and a height. What you wear shows on you: each worn item's model
  goes on in its slot, hiding the body part under it, and the character in the courtyard wears
  what's in the stash as you change things. The camera holds still in front of them there;
  dragging on the world, or the Turn buttons, turns them round.
- **Settings**: brightness (a gamma lift the way the client's brightness option works; the default
  is a step above the client's normal), sound and music volume and sounds off, whether the camera circles the character behind the
  menus (off by default for anyone whose system asks for less motion), the camera's distance in a
  run (the mouse wheel changes it too, and it's kept), the hotbar's size (version 96; 1 to 2.5
  times, bigger by default on a screen over 800 pixels high, so its keys read on 1440p and 4K;
  the prompt and the messages keep clear of it), and health bars over enemies. They're this
  browser's, kept apart from the save, so a save code doesn't carry them.
- **The end of a run's screen** (version 97; `.summary-box` in `style.css`) is a darker box, drawn
  bigger on a big screen (1.4 times from 1200 by 900, 1.75 from 1700 by 1250, 2.2 from 2300 by
  1600), and scrolls from its top when it's taller than the screen.

Progress saves to the browser's localStorage. "Start over" on the menu wipes it. The save carries
a version (`SAVE_VERSION` in `save.ts`); a save from an older version is dropped on load, with a
line on the title screen saying so, which is how a version starts everyone fresh (versions 21
and 33 did). Save codes from an older version are refused the same way.

A save code (`saveCode` in `save.ts`) starts `DX2-` since version 101: the save with its stash and
pack as bare ids (or `[id, count]`), deflated with the browser's `CompressionStream`, in URL-safe
base64, a third of the old length or less. `DX1-` codes, the JSON as it is in plain base64, still
load, and a browser without the compressor still writes one; a build before 101 can't read a DX2
code. Save code shows the code in a box with a Copy button (the clipboard, or select-and-copy
where that's refused); spaces and line breaks a chat app adds are ignored on loading.

## Layout

- `src/content/`: the data. `items.ts` (every item, its slot, tier, stats, stance, projectile,
  special attack and value, the shop's prices and stock roll), `worlds.ts` and `worlds.json`
  (each map's enemies and boss, scaled to the map's tier), `enemies.ts` (what an enemy is),
  `tasks.ts`, `bodies.ts`.
- `src/game/`: `region.ts` (a map's collision, walls and heights, and the flow field enemies chase
  along), `run.ts` (one run: scene, player, enemies, loot, chests and the way out), `player.ts`
  (the character's look from body kit and worn item pieces, and its stances), `menu.ts` (the
  courtyard and circling camera behind the guild's screens), `settings.ts`, `combat.ts`,
  `inventory.ts`, `save.ts`, `assets.ts` (glTF loading, animation, sounds), `music.ts`; co-op's
  `coop.ts` (the relay connection and rooms), `party.ts` (what the host and guests send each
  other) and `mates.ts` (the other players as drawn here).
- `relay/`: the co-op relay (Run Escape's `coop-relay.mjs` and its helpers) with its Dockerfile
  and `fly.toml` for Fly.io; `relay/README.md` has the steps.

Ambient sound: every map plays its own scenery's ambient sounds now and then, quietly: the ones
the cache gives the trees, fountains and fires in that map's region, tallied by Run Escape's
`scripts/cache/list-ambient.ts` over the map's `region.json` and listed in `AMBIENT` in
`worlds.ts` (the ids go in `assets.json`'s sounds too). The desert and the Wilderness have none
on their blocking scenery, so they're quiet.

Music: the cache keeps its tracks as the client's own packed MIDI with its own instrument bank,
which nothing here can play, so music is recordings: drop `<map id>.ogg` (and `menu.ogg` for the
guild) into `../full-assets/music` and run `npm run assets`; `music.ts` loops whichever exist
quietly, and a map without one is quiet.
- `src/ui/ui.ts`: every screen and the HUD, as plain DOM in the OSRS interface style
  (`public/ui` has the interface tiles and fonts), over the game canvas.
- `assets.json` and `scripts/copy-assets.mjs`: which cache ids the game uses and how they get into
  `public/assets`. Enemies and bosses are read from `worlds.json`, so they don't need listing. The
  layout there is flat, one file per thing (`npcs/<id>.glb`, `items/<id>.png`, a map's squares
  `maps/<id>/<x>_<y>.glb` and its `maps/<id>.json`, `player/kits/<id>.glb`, `player/items/<id>.glb` with every piece's info in
  `player/items.json`) and every sound in `sounds.pack` with its index in `sounds.json`, because
  itch.io allows an HTML game at most a thousand files and folders. Every model is compressed on
  the way (positions, colours and texture coordinates quantized to integers, and the geometry,
  animation frames and tracks packed with meshoptimizer), three times smaller, because itch.io
  unpacks a browser game to at most 500 MB; `assets.ts` gives the loader the decoder, and
  `scripts/compare-glb.mjs` checks a compressed copy against its export.

## The maps

The exporter's `map` command writes each map as one `squares/<x>_<y>.glb` per 64 tile map square
(`--tiles`; the ground and everything standing on it, welded, with the cache's textures) and `region.json` (per tile: solid, and which of its four
sides is a wall; whether it's under a roof or a bridge's deck; tile corner heights, and the
deck's on a bridge; the spawn). The game walks `region.json`: movement slides along solid tiles
and walls, enemies follow a flow field that respects them, and everything stands at the
interpolated ground height. Only straight walls count as sides: the cache's diagonal flags (fence
posts, a railing's end pillar) only stop the client's diagonal steps, and read as sides they
walled every bridge off at its posts. Everything that moves has a quarter tile footprint,
whatever its size, so a one tile gap between trees or a doorway can be walked through without
lining up on it. A tree blocks its whole footprint in the cache, two or three tiles square, while
its trunk is a stride across, so every free standing block of solid tiles up to three a side,
outdoors and without a wall on it, is a round obstacle at its middle for movement (`region.ts`):
the ground under the canopy can be walked and only the trunk stops you. The tiles stay solid for
pathing and sight. Since version 109 the exporter's `collision <ids> --out ../full-assets`
rewrites just a map's `region.json` collision (no models, about a minute for all twelve): the
tile bits from Run Escape's `ArenaGrid`, bit 6 for blocked ground that isn't water and bit 7
for an object on the tile, and `boxes`, what blocks on an object tile that blocks less than all
of it. Copy the region files to `public/assets/maps/<id>.json` with the dev server stopped. A map is Run Escape's whole arena (version 68; 3 by 3 map squares of 64
tiles for most, 3 by 4 for Lumbridge, 2 by 2 for God Wars, Prifddinas and the Inferno), which
runs to 90 MB for the fullest, so it comes a square at a time (`mapload.ts`): a run starts once
the squares round the spawn are in and the rest arrive nearest first, two at a time, joining the
scene and the minimap as they come, and the guild's courtyard loads only the squares round it. No
file is bigger than a square, which keeps Cloudflare Pages' 25 MB file limit. The way out closes
12 minutes into a run on a 128 tile map and longer by the square root of the area on a bigger
one (`closeSeconds` in `run.ts`: 18 on 3 by 3, 21 on Lumbridge).

`npx tsx scripts/probe-region.ts lumbridge 3236 3224 3252 3230` prints a map's collision over a
range of tiles (`#` solid, `n e s w` a wall on that side, a capital for more than one) and walks
a line across it, for finding out what stops you somewhere.

A map holds a crowd: `enemyCount` and `chests` in `worlds.ts` are a full 128 by 128 map's worth
(a hundred and more enemies, twenty or so chests), and a run takes a share of them by the map's
open ground, never under half. Chests (version 77) take the larger of that share and the ground
that can be walked to from the spawn over 12,000 tiles (`CHEST_FULL_REACH` in `run.ts`), since the
share's 1.2 cap had left the widest maps a third as many chests for their ground as the others:
Lumbridge went from 22 to 39, the Wilderness and the desert from 24 and 26 to 52, Kourend from 29
to 34, Karamja 26 to 27, the rest as they were. Each chest is the best of twelve candidate spots
by its distance to the nearest chest already placed (`spreadTile`), so the closest two on a map
are 11 to 22 tiles apart where random spots had put some side by side.

Enemies (version 78) go by the walkable ground alone: the world's count for every 14,000 tiles
that can be walked to from the spawn (`ENEMY_FULL_REACH`), never under 40 or over 200
(`ENEMY_MIN`, `ENEMY_MAX`, the ceiling for phones). The open-ground share had put 4.6 enemies on
every thousand walkable tiles of the Wilderness and 36 on God Wars'. Now most maps have about ten
a thousand, the three widest (Lumbridge, the Wilderness, the desert) six to eight at the ceiling of
200, and God Wars 19 at the floor of 40: Barrows went from 144 to 54, the Inferno from 75 to 43,
Prifddinas 106 to 71, Morytania 168 to 127, Varlamore 168 to 139, Fremennik and Karamja 156 to 134
and 138; Lumbridge 132 to 200, the Wilderness 144 to 200, the desert 156 to 200; Kourend stayed at
168.

A chest's purse (version 78) is 60 to 150 coins times 2.2 a tier past the first, from 15 to 40,
which was less than the food the same chest might have held; the boss's golden chest's is 150 to
300 (from 60 to 120) and the vault's 200 to 400 (from 80 to 160).

Colours: the exporter writes the client's palette colours, which are sRGB, as glTF vertex
colours, which three.js takes as linear and would brighten again on the way out. `assets.ts`
converts them to linear as a model loads, which gives the client's colours back, and a small
contrast and saturation curve goes on everything drawn after the output colour space conversion.

A map's model holds many triangles that lie exactly on another's three points (the exporter writes
some faces twice, and some tiles' underlay and overlay both), and two at the same depth with
different colours shimmer as the camera moves. `assets.ts` drops the duplicates as a map loads,
keeping the one drawn later (the client draws an overlay after what's under it): on Lumbridge
that's one triangle in twelve gone and no shimmer. Roofs and upper storeys hide the instant you
step under cover and come back only after you've been clear for a moment, so a walk along a wall
doesn't flick them.

The spawn is where the map's data puts it unless that's inside something (Karamja's is in a
tree's footprint, where no body fits and no step is possible): then it's the nearest open tile a
body fits on (`Region.standable`).

Scenery stands on flat ground: the way out, the chests, the vault and the trader take the first
reachable tile in a few tries whose corners are within a sixth of a tile of each other, else the
flattest tried (`flatTile` in `run.ts`), and a placed thing stands on its tile's highest corner
(`Region.topAt`), so a chest isn't half buried on a slope. Scenery with an animation of its own
(the portal out) is exported with it as a "play" clip (`exportLoc` in Run Escape's
`export-assets.ts`), played on the actor and stepped each frame like an enemy's.

Everything that stands on the ground has a blob shadow under it (`src/game/shadows.ts`): a soft
dark disc under the character, enemies, the pet, the trader, chests, the gravestone and dropped
items. The maps carry the client's own lighting and no shadows, and the disc grounds things on the
terrain, especially on a slope. It goes under an actor's root, so it moves and scales with it.

Buildings have their upper storeys and roofs: the glb holds a node per floor (`level0` is the
map's plane, `level1` and up the floors above it, sorted the way the client sorts them, so a wall
stored a level up but shown on the ground is on the ground). The run hides the floors above while
anything up there hangs over you (`region.json` flags tiles under a roof the way the cache does,
and `cover` marks the tiles under eaves, walkways and ledges the flag misses), the way the client
takes roofs off indoors, and while one a few tiles south of you would stand between you and the
camera.

`make-game-worlds.ts` picks each map's enemies and boss from Run Escape's tables (seven regular
enemies spread by hitpoints, and the map's own boss with attack and death clips that isn't huge).
`worlds.ts` then scales each map so its average enemy and its boss land on the map's star tier.

## The gear

About 900 pieces, each a real cache item with its icon and its worn model: every metal from bronze
to rune in every slot, dragon, granite, obsidian, the Barrows sets, void, Bandos, Armadyl, Torva,
Justiciar, Inquisitor, Masori, crystal, Ancestral, the full ranged line from studded leather
through every d'hide to Armadyl and Masori, the magic line from blue wizard through mystic and
infinity to Ancestral, bows, crossbows, the blowpipe and ballista, staves from battlestaves to
tridents, the Sanguinesti staff and Tumeken's shadow, and the end-game melee prizes (claws,
the warhammer, elder maul, scythe, rapier, fang, Voidwaker, the godswords). Tiers follow what OSRS
asks to wear a piece: levels 1 to 10 are tier 1, 20 to 30 tier 2, 40 tier 3, 50 to 60 tier 4, 70
and up tier 5; stats sit on the scale of what was there (`items.ts`, the second and third batches
at the end of `ITEMS`: snakeskin, red d'hide, xerician, splitbark, Dagon'hai, elder chaos,
Virtus, every battlestaff and mystic staff, the nightmare staves, hastas and spears, the demon
slayer blades, the anchor, Dinh's bulwark, the ancient godsword and the soulreaper axe among them;
the fourth adds the Fremennik and Temple Knight sets, white, the slayer helmet, every defender and
metal glove, more shields and books, jewellery, god capes, 3rd age, the god hides, Morrigan's and
Zuriel's, lunar, the barks, more bows and sceptres, every elemental staff and the newer weapons;
the fifth, version 52, takes everything that was left: black and white weapons, the metal claws,
halberds, hastas and spears, the god rune armour, every wooden and d'hide shield, the god d'hide
boots, the Armadyl and Bandos hides, the three Moon sets, Oathplate, Sunfire, Dragonstone, elite
void, the Barbarian Assault hats, the quest armours, the mjolnirs and god staves, the ancient
sceptres, 3rd age's weapons and druidic robes, Ava's devices, the blessed quiver, Zaryte
vambraces, Avernic treads, the Eye of Ayak and the rest; the sixth, version 53, the same-stat
twins: every plateskirt, the lower Shayzien tiers, the Proselyte tasset and Fancy boots; the
seventh, version 59, fills ranged and magic out with everything real the export had left: every
dart, knife and throwing axe from bronze to dragon, Morrigan's javelin and axe, the three
chinchompas, the five salamanders, the phoenix crossbow, the three wands, the plain and Dramen
staves, the mist staff, Pharaoh's, Lithic and Demonic sceptres, the Merfolk trident, the black
wizard's, Shade, Druid's, ghostly, Moonclan and dark squall robes and the Book of the Dead).
That leaves melee with about twice the weapons and armour of ranged or magic (195 melee weapons
to 84 ranged and 79 magic): OSRS itself has six metals in ten shapes for melee and nothing like
it for the others, so the rest of the difference is the ammunition's sixteen kinds. What's
left out on purpose: league and holiday cosmetics, skilling outfits, achievement capes and diary
rewards, prayer vestments, and anything with a charge, an ornament kit or a colour in its name.
Nothing cosmetic is in: no piece worn for looks alone, and no trimmed, gilded or ornamented
versions of pieces the game has. `GEAR-NOT-ADDED.md` lists every wearable in the cache export the game still lacks
(a session script made it). Every player piece is exported without the client's emote clips
(`--no-emotes` in Run Escape's `export-assets.ts`): the game doesn't play them, and they were a
quarter of every piece's size. The game is hosted on Cloudflare Pages (PLAYTEST.md), which has
no cap the gear can reach; itch's 500 MB and 1,000 files are behind it, so itch's copy stops at
version 49.

## How the character is drawn

The exporter's `player` command cuts a player model into pieces: every body kit, and every worn
item's model, each as its own glb with the same twenty-three clips (idle, walk, run and death;
attack, stab, lash, two handed, bow and cast; the two handed, staff and whip stances' idle and
run; and since version 81 the godsword's, the maul's and the bulwark's idle and run, the maul's
swing and the spear's thrust).

Two handers are held as OSRS holds them (version 81; `Stance` and `HOLDS` in `items.ts`): two
handed swords, the colossal blade and the scythe the two handed sword's way (seqs 2561 and 2563);
the godswords and the Saradomin swords upright in one hand (7053, 7043); the mauls, the
Tzhaar-ket-om, the hill giant club, the bludgeon, the anchor, Dharok's greataxe and the
soulreaper axe two hands on the haft (1662, 1664), swinging the granite maul's swing (1665);
Dinh's bulwark planted in front (7508, 7509); and spears and halberds as a staff stands (813,
1210), thrusting the spear's thrust (2080). Before, every one of them stood the two handed
sword's way, which put a godsword's hilt through the chest and a maul's head over the head. Each
was checked on a whole posed player exported for it (Run Escape's `--clips` and `--whole`). Long
clips are thinned to 8 to 12 frames, each kept frame lasting as long as the ones it stands for
(`maxFrames`, `thinFrames`), since every frame is a morph target in every piece: the eight clips
grew the pieces from 541 MB to 902 MB. `scripts/copy-player.mjs` packs just the player pieces into
`public/assets/player` (stop the dev server first). A look also plays its stance from the start
now: it began its idle before the stance was set, so a stanced weapon stood the plain way until
the first step.
Every frame of every clip is a morph target in every piece, so a clip added there grows every
piece: the three emote clips the exporter can add (`--no-emotes` leaves them out) were a quarter
of each, and the game doesn't use them.
A graphics card holds every morph target a mesh has at once, and WebGL2 promises only 256 (many
phones and older cards give no more). The spells' cast clips took the pieces from 234 targets to
459, and on those cards characters were drawn as nothing but their shadow. Since version 111
`assets.ts` cuts any model of more than 128 targets up as it loads (`MORPH_SPLIT`): each clip gets
a geometry holding only its own frames, padded to one count so every clip draws with the same
shader (24 for a body kit, 19 for most items, 51 for the biggest NPC), and `play()` swaps the
clip's geometry in. The files are unchanged, and the poses come out exactly as before.
Every piece is cut from a full player model posed by the same animations, so the pieces move in
step when played together. The game stacks the pieces for the slots in use: a worn item's piece in
its slot, the body kit's piece where nothing is worn, and nothing where a worn item hides the part
(a platebody hides the arms, a full helm the hair and beard). Faces in a body colour are exported
as lighting only, in a `group_<n>` material, and the game multiplies in the chosen colour from
`public/assets/player/colors.json`. The game uses the male body kits and item models only.

## Checking the gear

`npm run check-gear` confirms every wearable item in the catalog has an exported worn piece in the
client slot the game expects, with all twenty-three clips. For the browser half, open the game and run
this in the console; it equips every item on the character and reports any piece that doesn't
load with geometry and clips:

```js
const { ITEMS, PlayerLook } = window.game;
const look = { kits: [0, 10, 18, 26, 33, 36, 42], colors: [0, 0, 0, 0, 0] };
for (const item of ITEMS.filter((i) => i.slot && i.slot !== "ring")) {
    const pl = await PlayerLook.create(look, { [item.slot]: item.id });
    const i = pl.urls.findIndex((u) => u.endsWith(`/player/items/${item.id}.glb`));
    if (i === -1 || pl.pieces[i].clips.size !== 23) console.log("problem", item.id, item.name);
}
```

## Balance

`npm run balance` plays every map on paper with a few loadouts (starter, iron, mithril, rune,
dragon with Barrows, the best there is, and each tier's own full set: the strongest piece a map of
that tier gives for every slot) and prints damage taken, food eaten, time and boss results. A run
fights a share of the map's crowd, two at a time with a breather between, eating what the enemies
drop before what it brought, a bite every `EAT_DELAY` and never more than `FOOD_LIMIT` pieces.
The combat maths lives in `src/game/combat.ts`, shared by the game and the script, so what it
measures is what the game does: defence soaks a share of every hit, 30 defence a third, 60 half,
never more than three quarters (`SOAK_HALF_AT`, `SOAK_MAX`), and a piercing hit gets through
half the armour and all of a prayer. An ordinary enemy hits for half to all of its max; a boss's
roll leans low (`bossRoll` in `combat.ts`, the lower of two rolls, since version 57), so its
usual hit is two thirds of its max and a hit in the top tenth of its range comes one time in a
hundred, not one in ten. The game isn't meant to be easy: a map should take a few runs to beat
unless you're lucky. Version 55 raised every enemy and boss table by about a fifth to a third,
aiming for a tier's own full set, with its own food, beating that tier's boss about one time in
three in the sim; version 57 then took boss hits down (the max a tenth lower, the roll leaning
low), after which that set wins about four times in five in the sim, with nearly all its food
eaten, the tier below's set lives through the map's crowd but can't take the boss, and the tier
above's set wins easily on a little food. The sim has no prayer, potions or footwork, so a
player who protects and steps out of the big hits does better than its numbers; it also doesn't
model the clock, champions, enraged bosses, ammunition or distance.

The curve it's tuned to, by stars: the starter kit lives through Lumbridge about half the time
and can't take its boss; a full one-star set takes the Wise Old Man most runs on all its food,
two stars wants a full two-star set for the same odds, and so on up, each tier's set dying in
the next tier's crowd more often than not. Hitpoints come back on their own at half a point a
second after eight seconds without being hit, and in a run only while nothing is after you, so
food is for the fights, not the walk between them. The tier targets are the `TIER_*` tables in
`worlds.ts`; `BALANCE_SEEDS=12 npm run balance` plays more runs for a steadier read.

Version 78 evened out the maps of a tier with a per-map scale on the boss's hitpoints
(`BOSS_HP_SCALE` in `worlds.ts`): Fremennik, Karamja and Prifddinas 0.92, Kourend and Morytania
0.9, the desert 1.06, the Inferno 1.2. At 24 seeds a tier's own set now beats each three to five
star boss 19 to 22 fights in 24 (before, 8 to 12 in 12 at 12 seeds); the Wise Old Man and the
Wilderness's Chaos Fanatic 23 in 24, Verac 21.

## Adding things

- A map: add it to `assets.json`'s `maps`, export it with the `map` command, give it a tier in
  `make-game-worlds.ts` and rerun that, write it a blurb in `worlds.ts`, run `npm run assets`.
- An enemy on a map: it comes from Run Escape's enemy table for that map; the exporter's `npc`
  command gets its model into `../full-assets`. To make one a mage or an archer, add it to
  `SHOOTERS` in `worlds.ts` by its id with its spell's or arrow's spot animations (the exporter's
  `spotanim` command gets them; put the ids in `assets.json`), how far off it stands and how
  long between shots.
- An item: add it to `items.ts` with its tier (and stance or projectile), put the id in
  `assets.json`, export its worn piece (`export-assets.ts player items <id>`), run
  `npm run assets`. Wearable items join that tier's chest pool and the shop's stock on their own.
- One model without the whole copy: `node scripts/compress-glb.mjs <from.glb> <to.glb>` writes
  it into `public/assets` compressed the same way, and `node scripts/compress-glb.mjs player`
  redoes every player piece after a `player` export (a new clip in `PLAYER_CLIPS`, say).

Everything in `public/assets` is Jagex's copyrighted art, fine for a fan project, not for sale.
