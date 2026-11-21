# DEADLANDS (v2)

Co-op 2D zombie survival for you and up to 5 friends. Stickman survivors, real-style guns (Glock, pump shotgun, MP5, AK-47, hunting rifle), 7 monster types and a follow camera (mouse turns, W walks forward; V switches to classic top-down). Explore, loot guns, gather wood/stone/scrap,
build a base, level up and survive the nightly hordes. Worlds save so you can keep playing later.

## Put it online (Render, same as Backyard Six)

1. Make a new GitHub repo, e.g. `deadlands`, and upload everything in this folder **except** `node_modules`
   (keep the `public` folder as a folder).
2. On Render: **New → Web Service** → pick the repo.
   - Runtime: **Node** · Build command: `npm install` · Start command: `npm start`
   - Free instance is fine (it sleeps when idle; the first visit can take ~1 minute).
3. Open your Render link, type your name, make a world with **New world (online)** and send the room code.

## What's in v2

- Huge 240x240-tile map: 11 named towns, 2 military bases, police stations, hospitals, farms, gas stations, rivers, lakes and a desert.
- Drivable cars and pickup trucks (E to get in/out, R to refuel with a fuel can or repair with 2 scrap). Refuel at gas pumps. Run over zombies.
- Daily airdrop with the best loot (marked on the map), guarded by zombies.
- New guns: Revolver, M4, .50 Sniper. Grenades (G).
- Hunger: eat canned beans, bread, chips, apples or soda, or hunt deer and cook the meat at a campfire (F to eat).
- Furnished buildings: houses have kitchens (fridge, stove, sink, cupboard), dining tables, sofas, TVs and plants. Hospitals have beds and medicine cabinets, police stations have desks and lockers, barracks have bunks and ammo crates, barns have hay, and gas stations have a shop shelf and a drinks fridge.
- Loot boxes match where they are: fridges and cupboards give food, lockers give guns, medicine cabinets give medkits, ammo crates give rifles. Each one shows a sparkle until it is searched and opens up when looted. Furniture is solid, so you walk around it.
- New buildings: Barbed Wire, Lamp Post, Landmine, Metal Wall, Metal Door.
- Rain, chat (Enter), scoreboard (hold Tab). Up to 8 players.
- Building: press B (or pick the Build Hammer in your hotbar). A build bar shows every piece with its cost; mouse wheel / Q chooses, click builds, hold the mouse and walk to build a line of walls, click a damaged piece to repair it, right-click removes. Quick Base builds a whole 5x5 walled shelter with a door in one click (130 wood).
- Gathering: hit trees (wood), rocks (stone) and wrecked cars (scrap) — they shake and show a health bar; the Axe is fastest.
- Realistic 2D look: textured ground that blends naturally, road markings, moving water, buildings with wall height and roofs that fade when you walk in, sun shadows that move through the day, glowing lights, realistic survivors and zombies (switch to stickmen in the Esc menu), muzzle flashes, bullet shells, blood splatter and tyre skid marks.
- Inventory (Minecraft-style): 9-slot hotbar (1–9 or mouse wheel) with a health bar, food bar and XP bar above it; press I or C for the inventory screen with your character, crafting and 27 backpack slots. Drag to move, Shift-click to quick-move, drag out to drop on the ground. Items stack (bullets 120, wood/stone/scrap 100, food 10, medkits 5).
- Saves from v1 can't be loaded (the map changed) — start a new world.

## War update: the world evolves

**Eras.** Every 2 days the world moves into a new era. A big "THE WORLD EVOLVED" banner tells you what's new.
- **Era 1 Outbreak** (days 1–2): walkers, runners and dogs.
- **Era 2 Collapse** (days 3–4): armored **Soldier zombies**, which take 40% less bullet damage and drop Gun Parts. **Military convoys** crash every day, and their cargo boxes always hold **Tank Parts**.
- **Era 3 Military Fallen** (days 5–6): **Screamers**. When one sees you it screams, calls every zombie nearby and makes them faster for a while. **Fighter jets** crash every day with **Jet Parts**.
- **Era 4 War Zone** (day 7+): **Juggernauts**, armored giants that bullets barely scratch. Use explosives.

**Workbench** (build it with the hammer, then press E next to it). It has four sections:
- **Guns**, which come out Rare: Crossbow (silent, pierces), Desert Eagle, AK-47, M4, M249 LMG, Grenade Launcher, .50 Sniper, Flamethrower (sets zombies on fire), RPG-7 and Minigun (spins up, slows you down). Each one unlocks in a certain era.
- **Ammo**: crossbow bolts, bullets, 40mm grenades, rockets and flamer fuel.
- **Attachments**: scope, silencer and extended mag.
- **War machines**:
  - **Tank** (4 tank parts + 40 scrap): drive with W/A/S/D and aim the cannon with the mouse. It crushes trees, rocks, wrecks, furniture and zombies. A friend can ride the top machine gun.
  - **Fighter Jet** (4 jet parts + 60 scrap + 3 fuel): hold W on a clear road or field to take off. In the air you fly over everything and zombies can't reach you. Click fires the guns, right-click or Space drops bombs, and holding S slows you down to land.
- **Gun Parts** come from police and military boxes, convoys, crashed jets, soldier zombies and smashed car wrecks.

**Bot survivors.** Pick 0–4 bots on the menu, for solo or when you host online.
- Bots follow the nearest player, fight with the best gun they have and search nearby boxes.
- They heal, eat, revive downed friends, jump on the machine gun of your Gun Truck or Tank, call out big zombies in chat, and level up and pick perks.
- They keep their gear and levels in the saved world.

## Fun update

- **Revive your friends:** at 0 HP you go down instead of dying. You can crawl and shoot a pistol, revolver or MP5. A friend holds **E** next to you for 3.5 seconds to pick you up. Alone? Hold **H** to use a medkit and get up. You bleed out after 30 seconds, and zombies hitting you make it faster.
- **Rare loot:** guns come as Common, Rare (blue), Epic (purple) or Legendary (gold). Better guns hit harder, shoot faster, reload faster and are more accurate. Good drops shoot a coloured light beam and the whole group sees a message. You keep the better version when you find a duplicate.
- **Attachments:** Scope (accuracy and range), Silencer (quiet shots, so zombies don't hear you) and Extended Mag (+50% bullets). They fit your best gun automatically, or you can drag one onto a gun in the inventory.
- **Random events:**
  - **Blood Moon:** some nights the sky turns red, the horde is twice as big and faster, and kills give +50% XP.
  - **Crashed helicopter:** most days a chopper goes down somewhere on the map with 3 military supply boxes full of high-rarity guns and attachments. Zombies guard it.
  - **Wandering trader:** from day 2 a trader often sets up in a town until nightfall. Trade scrap for ammo, medkits, Rare, Epic or even Legendary guns, attachments, grenades and fuel.
- **Car fights:**
  - **Gun Truck** (military bases and some towns): one friend drives and another presses E to jump on the machine gun and shoot all around. Alone, the driver fires it with a click. The gun overheats if you hold the trigger too long.
  - **Dirt Bike** (every town): the fastest vehicle. Hold a pistol, revolver or MP5 to shoot while riding.
  - Ramming throws zombies further and you get ROADKILL combos. The Gun Truck has a ram bar.
- **Perks:** every level gives a perk point. Press **P** and pick 1 of 3: Tough, Sharpshooter, Fast Hands, Lumberjack, Medic, Marathon, Iron Stomach, Scavenger, Ammo Saver, Engineer, Road Warrior and Second Wind. Older characters get perk points for the levels they already have.
- Old saved worlds still load. Gun Trucks and Dirt Bikes are added to them.
- **Jump (Space):** hop over furniture, crates, rocks, car wrecks, campfires and spikes. It costs a bit of stamina, and a zombie that swipes while you're in the air misses ("DODGED!"). You can't jump over walls, trees or buildings.
- **Zombies see and hear:**
  - **Seeing:** a zombie spots you if you are in front of it and nothing blocks the view. Building walls, trees, rocks and your own walls and closed doors all block it. Sight is about 13 m by day, 20 m at night and 25 m on a Blood Moon. A red "!" pops up over a zombie when it spots you.
  - **Hearing:** gunshots (silencers are much quieter), explosions, engines, sprinting, chopping and building make zombies walk to where the sound came from. If they don't find anyone there, they wander off again. If they see you, they chase you.
  - Night hordes still always find your base.
- **Smash furniture:** hit sofas, counters, fridges, lockers, crates and so on with the axe, hammer, machete or fists to break them for wood, scrap or stone. Smashing a box you haven't searched spills its loot. Grenades break furniture too. Broken furniture comes back after about 20 minutes.
- **Fix:** on high-resolution screens (most laptops and phones) the game used to show only the top-left part of the picture, so the item bar at the bottom was cut off. It now fits the window. The item bar also stays on screen while you drive.
- **Doors:** zombies shoulder-charge doors and can barge them open. Wood doors open easily, especially for Brutes; metal doors hold much better. A barged door stays open for about 5 seconds and then swings shut.

## How saving works

- The world is saved in the **host's browser** (autosave every 45 seconds, plus Esc → Save).
  This means nothing is lost when the free server sleeps or restarts.
- Everyone's level, gear and position is saved inside the host's world, matched by player name —
  so friends should use the same name each time.
- To continue: the host opens the site, presses **Host online** on the saved world, and shares the new code.
- **Export** downloads a save file (backup, or to move the world to another computer); **Import** loads one.

## Run on your own PC

```
npm install
npm start
```
Then open http://localhost:3000

## Tuning

Numbers live at the top of `public/world.js`: `WEAPONS`, `BUILD` (costs, HP, unlock level), `CRAFT`,
`ZT` (zombie types), `DAY_LEN` / `NIGHT_LEN`, and the loot tables in `loot()` (world.js).

## New look: Field Kit UI
- DEADLANDS now has its own interface style: dark chamfered plates with acid-green accents (no more grey Minecraft slots).
- Bottom dock: quick slots with a raised selected slot, slanted segment gauges for Health and Food, XP strip, and a hex level badge.
- Inventory (I) is now the **Field Kit**: survivor card with stat gauges and perk chips, backpack + quick slots, and field-crafting cards with MAKE buttons.
- Workbench, trader, perk and build bar use the same style.

## The jet is now an F-4 Phantom II
- The Fighter Jet is now an **F-4 Phantom** in the VF-84 "Jolly Rogers" scheme: light-gull-grey top, white radome, black anti-glare panel, black chevron with orange edge, tandem canopy, red intake chevrons, star-and-bar on the port wing, "211" on the starboard wing, orange wingtips.
- The black tail fin stands up in 3D, so you see the skull & crossbones, "A E" and VF-84 on it from any camera angle.
- Twin afterburners, Phantom-shaped shadow, and downed Phantom wrecks (with the skull fin lying in the dirt) at jet crash sites.

## Mobile / touch controls
Phones and tablets switch to touch controls automatically (force with `?touch=1` or `?touch=0` in the URL).
- **Left thumb** anywhere on the left side: move. Push all the way to sprint.
- **Right thumb** on the right side: aim. Push further to shoot (light auto-aim snaps to the zombie you point at).
- **Tap the item bar** to switch items. With the hammer, tap a build piece and aim with the right stick to place.
- **Buttons** change with what you are doing: USE · JUMP · RELOAD · NADE · HEAL · EAT on foot; EXIT · BRAKE · FIX in cars; EXIT · BOMB · LAND in the F-4 Phantom; PIECE · REMOVE while building.
- **Driving / flying**: point the left stick where you want to go — the car steers, brakes and reverses by itself.
- **Top buttons**: MENU (pause/save, or close a panel), MAP, KIT (inventory), CHAT, PERK (when one is ready).
- **KIT**: tap an item, then tap the slot to move it to (or Quick move / Drop).
- The whole HUD scales down to fit the phone, the game goes full screen and asks you to turn the phone sideways.

## Seas & Survivors update
- **New map (new worlds only)**: an ocean coast all around the map, 4–7 islands offshore, and up to 3 lakes with an island in the middle. Every island has a **sea chest** with top loot (rare guns, gun parts, tank/jet parts later). Old saves keep their map exactly as it was.
- **Swimming**: walk into any water. You swim slower, can't shoot or jump, and your **AIR** runs out after ~20 s (then you start drowning). Zombies can't swim — water is an escape route.
- **Boats**: Rowboat (Workbench, Era 1: 30 wood + 4 scrap, no fuel) and Speedboat (Era 2: fast, needs fuel, a friend or bot can man the bow gun). Boats launch on the nearest water. A few boats are also moored near towns (added to old saves too).
- **Survivors**: every day an SOS comes in — a survivor is stranded somewhere (often on an island) with zombies around. Get there, press E (USE) to rescue them. Each has a role (Medic, Soldier, Mechanic, Scout, Cook, Engineer), gives you a gift, and joins your team as an AI teammate. After 4 teammates, extra survivors stay at your camp and bring supplies every morning.
- **Goals**: an 18-step goal chain on the left of the screen walks you through the game — wood → building → looting → first night → first rescue → swimming → workbench → boat → island → guns → tank → Phantom → tame a dog → call the evac → ESCAPE — with rewards for each step.

## Landmarks update (new worlds)
- **FUNLAND** amusement park: spinning Ferris wheel, carousel with bobbing horses, game stalls (snacks + a shooting-gallery ammo box), light-up arch — all lit up with coloured bulbs at night.
- **Lighthouses** (one on a sea island): red & white towers with sweeping light beams at night. Press E at the door to climb it and reveal the map around you.
- **Radio towers**: blinking red lights. Press E to scan for survivors — once a day it triggers a new SOS.
- **Wind farm** with turning turbines, **shipwrecks** run aground with cargo crates, **graveyards** with a mausoleum and buried chest, **campsites** with tents and a campfire.
- **Piers** out to the moored boats, **street lamps** in every town that light up at night, **bridge railings** where roads cross rivers.
- **Wildlife**: crows and seagulls that circle and scatter when you get close, fish jumping in lakes and the sea, fireflies at night.
- **Map (M)**: icons for every landmark, islands and unopened sea chests, a compass, grid coordinates (A–H / 1–8) and a legend.
- Existing worlds keep their map; the new lights, wildlife, bridges and map upgrades work everywhere.

## Server worlds (always-on online worlds)
- On the menu, press **Make server** next to any of your worlds (or **New server world**). The world is uploaded to the game server and gets a permanent **5-letter code**.
- Anyone can join it with that code (or from the **SERVER WORLDS** list on the menu) at any time — even when you're offline. Up to 8 players.
- The world pauses when nobody is on and wakes up when someone joins. It autosaves to the server every minute and when everyone leaves.
- The owner's browser keeps a backup copy. Free Render servers forget their files when they restart or redeploy — when the owner next opens the menu, the browser puts the world back automatically (same code).
- Owner buttons: **Copy to my worlds** (download a copy to play solo) and **Delete**.
- Optional: on a paid Render plan, add a Persistent Disk and set the environment variable `DATA_DIR` to the disk's mount path (e.g. `/var/data`) so server worlds survive restarts on their own.
- The old **Host online** mode (4-letter room code, saved in the host's browser) still works too.

## Huge maps, military camps & attack helicopters
- **New worlds are ~10x bigger**: 760 x 760 tiles instead of 240 x 240 (about 10x the area). ~35 towns, 6 military bases, 14 farms, 20 gas stations, 7 rivers, ~15 islands, 10 lakes, and 3x the landmarks. Older worlds keep their original size — a server can run small and big worlds side by side.
- **Military camps** (16 per big map): sandbag walls with a gate, army tents, a camo-netted ammo dump, a watchtower with a sweeping searchlight at night, a flag, and a helipad. Loot: ammo crates, a police-style locker, a supply box and military cargo (can contain tank parts). Soldier zombies guard every camp — they come back each day (Screamers and Juggernauts join them in later eras).
- **Attack helicopters** sit on the helipads of half the camps. Get in with E: press W (or A/D) and it lifts straight up by itself, hovers and turns on the spot. Click = chin minigun (aims with the mouse), right-click/Space = rocket pods (8, they reload over time). Hold S when slow to land (only on open ground). Zombies can't reach you in the air. On phones: left stick flies, right thumb aims the minigun, ROCKETS and LAND buttons.
- The big map (M) shows town names and icons for every camp, landmark and helicopter.

## The Escape update: start with nothing, evac ending, bosses, dog, defenses & special guns
- **Start with almost nothing** (new worlds): choose on the menu — *an axe and a can of beans* (default), *only your fists and a can of beans* (hardcore), or the old full kit. Craft a **Build Hammer** (5 wood) and an **Axe** (10 wood + 4 stone) in the C menu. Old saves keep the full kit.
- **The ending — EVAC**: from Era 3, press E at a **Radio Tower** (fixing it costs 20 scrap, 6 gun parts, 2 fuel) or craft an **Emergency Radio** at the Workbench. A rescue helicopter is called to a landing zone (a military camp if one is near). Hold the zone for 3 minutes while the biggest horde of the game attacks — with Rotwing flocks, the Colossus and the Abomination. When the helicopter lands you have 35 seconds to stand in the zone. Everyone on board **escapes** (victory screen with days, kills and rescues). If nobody makes it, you can call again tomorrow. The world keeps going after you win.
- **New bosses**: the **Colossus** (huge, armored; ground-pounds and **throws cars and boulders** — comes on every 6th night and at the evac) and **Rotwings** — zombie birds that fly over walls in flocks (Era 2+) and chase you even in a jet or helicopter.
- **Dog companion**: stray dogs show up near you. Feed one a can of beans (or meat) with E and it's yours: it follows you, bites zombies, hunts deer for meat, **sniffs out unopened crates** (a paw marker shows where), swims, rides along in vehicles, and is saved with your character. If it gets hurt it lies down — press E next to it to help it up.
- **Base defenses**: **Searchlight** (sweeps at night, locks onto zombies; lit zombies are slowed and take +25% damage), **Flame Trap** (walkable, bursts into flames when zombies step on it), **Mortar** (lobs shells over walls at the biggest group of zombies 6–24 m away).
- **Special weapons**: **Katana** (fast, wide slash), **Chainsaw** (shreds crowds and trees, loud), **Dual Pistols**, **AA-12 auto shotgun**, **Harpoon Gun** (pulls zombies to you, works while swimming), **Tesla Gun** (chain lightning through 6 zombies, stuns), **Freeze Ray** (freezes zombies solid — frozen ones **shatter**). Throwables: **Molotov** (fire zone) and **Sticky Bomb** (sticks to a zombie, big blast). New ammo: Energy Cells and Harpoons. Find them in loot or craft them at the Workbench / C menu.
- New goals at the end of the goal chain: tame a dog → call the evac → ESCAPE.

## The Big World update: Haven, jobs, bunkers, weather, car upgrades, Zombie King, looks & photo mode
- **HAVEN (safe trader town)**: one town is fenced off — zombies can't get in and you can't build there. Press E at the HAVEN SHOP to buy guns, ammo, food, parts and hats/outfits with **cash**, sell your loot, and take **jobs**. You earn cash from every zombie you kill and from jobs.
- **Jobs (team missions)**: 3 new jobs every morning on the job board — *Clear a zombie nest*, *Defend the gas station for 90 s*, *Deliver a supply crate* (whoever takes it carries the crate) and *Hunt BIG MIKE* (an elite zombie). One job at a time for the whole team; everyone gets the cash. The job shows on the HUD, the map and with a big marker in the world.
- **Underground bunkers**: look for the yellow-black **hatch** (BUNKER on the map). Press E to climb down: it's pitch dark (your flashlight only), 6 rooms full of zombies with a Juggernaut/Brute in the last room and the best loot. Zombies come back every day. Press E at the ladder to get out.
- **Weather**: rain (zombies hear less), fog (zombies see less — so do you), thunderstorms from Era 2 (lightning strikes near you, sets trees on fire, hurts anything close) and sandstorms.
- **Car upgrades** at the Workbench (park the car next to it): Ram Spikes, Zombie Plow, Armor Plates, **Nitro** (hold Shift / NITRO button) and a **Roof Gun** that shoots zombies by itself. Works on cars, trucks, bikes and tanks.
- **The Zombie King**: lives in a castle on the biggest sea island (map v2+ worlds). Get close and he rises with his guards: fire fans, summons, ground slams and a rage mode at half health. Kill him and every zombie on the map dies, 2 days of peace, +$1000 and the **Crown** for everyone.
- **Looks**: hats and outfits — pick them in your kit (I). Some unlock with goals, some you buy in Haven, the Pirate Hat for escaping and the Crown for killing the King.
- **Photo mode**: press **O** (or the camera button on phones). The HUD disappears; WASD moves the camera, mouse wheel zooms, Q/E turns, Enter saves a picture.

## Easier start update
- Everyone now starts with **just fists and a can of beans** (no start menu option). Search houses, fridges and cupboards — you're sure to find an **axe** within your first few searches.
- **Longer days**: day is now 7 minutes (night still 2.5 minutes). Older saves keep their day number.
- **Fewer zombies** around you, smaller night hordes, and the first 2 days are gentler (zombies hit 40% softer on day 1, 20% softer on day 2, and walk a bit slower on day 1).
