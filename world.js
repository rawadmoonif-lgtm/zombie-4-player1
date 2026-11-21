// DEADLANDS — shared game engine (server for online co-op, browser for solo play)
(function (root) {
  'use strict';

  const TILE = 40; let MW = 240, MH = 240, WORLD = MW * TILE;
  // map size depends on the world's map version: v4+ worlds are ~10x the area (760 x 760 tiles)
  const sizeOf = (mv) => (mv >= 4 ? 760 : 240);
  function setSize(n) { if (MW !== n) { MW = MH = n; WORLD = MW * TILE; } }
  const DAY_LEN = 420, NIGHT_LEN = 150, CYCLE = DAY_LEN + NIGHT_LEN, OLD_CYCLE = 390;
  // terrain
  const T_GRASS = 0, T_WATER = 1, T_SAND = 2, T_ROAD = 3, T_FLOOR = 4, T_BWALL = 5, T_FOREST = 6, T_CONC = 7, T_DESERT = 8, T_FARM = 9, T_HOSP = 10;
  // resource nodes
  const N_TREE = 1, N_ROCK = 2, N_CAR = 3;
  const NODE = {
    1: { name: 'Tree', hp: 60, res: 'wood', per: 2, bonus: 4, regrow: 600, tool: 1.6 },
    2: { name: 'Rock', hp: 100, res: 'stone', per: 2, bonus: 4, regrow: 900, tool: 1.0 },
    3: { name: 'Car wreck', hp: 120, res: 'scrap', per: 1, bonus: 5, regrow: 1200, tool: 1.0 },
  };

  // buildings players can place. code = value stored in the sType grid
  const BUILD = {
    wall:   { code: 1, name: 'Wood Wall', cost: { wood: 8 }, hp: 300, lvl: 1, key: '1' },
    door:   { code: 2, name: 'Wood Door', cost: { wood: 10 }, hp: 250, lvl: 1, key: '2' },
    fire:   { code: 3, name: 'Campfire', cost: { wood: 5 }, hp: 120, lvl: 1, key: '3' },
    bed:    { code: 4, name: 'Bed', cost: { wood: 15 }, hp: 150, lvl: 1, key: '4' },
    spikes: { code: 5, name: 'Spikes', cost: { wood: 6, scrap: 2 }, hp: 200, lvl: 2, key: '5' },
    stone:  { code: 6, name: 'Stone Wall', cost: { stone: 10 }, hp: 800, lvl: 3, key: '6' },
    turret: { code: 7, name: 'Turret', cost: { scrap: 12, stone: 8 }, hp: 400, lvl: 5, key: '7' },
    wire:   { code: 8, name: 'Barbed Wire', cost: { scrap: 3, wood: 2 }, hp: 160, lvl: 2, key: '8' },
    lamp:   { code: 9, name: 'Lamp Post', cost: { scrap: 4, wood: 4 }, hp: 150, lvl: 2, key: '9' },
    mine:   { code: 10, name: 'Landmine', cost: { scrap: 5, stone: 2 }, hp: 50, lvl: 4, key: '0' },
    metal:  { code: 11, name: 'Metal Wall', cost: { scrap: 8, stone: 4 }, hp: 1500, lvl: 7, key: '-' },
    mdoor:  { code: 12, name: 'Metal Door', cost: { scrap: 10, stone: 4 }, hp: 1000, lvl: 7, key: '=' },
    bench:  { code: 13, name: 'Workbench', cost: { wood: 20, scrap: 6 }, hp: 450, lvl: 1, key: 'b' },
    slight: { code: 15, name: 'Searchlight', cost: { scrap: 10, wood: 6 }, hp: 300, lvl: 3, key: 'l' },
    ftrap:  { code: 16, name: 'Flame Trap', cost: { scrap: 6, fuel: 1 }, hp: 220, lvl: 4, key: 'f' },
    mortar: { code: 14, name: 'Mortar', cost: { scrap: 20, stone: 10, gunparts: 2 }, hp: 500, lvl: 6, key: 'm' },
  };
  const SOLID_P = { 1: 1, 3: 1, 6: 1, 7: 1, 9: 1, 11: 1, 13: 1, 14: 1, 15: 1 }, DOORS = { 2: 1, 12: 1 }, WALKABLE_S = { 4: 1, 5: 1, 8: 1, 10: 1, 16: 1 };
  const BUILD_BY_CODE = {}; for (const k in BUILD) BUILD_BY_CODE[BUILD[k].code] = k;

  const CRAFT = {
    hammer: { name: 'Build Hammer', cost: { wood: 5 }, give: { hammer: 1 }, lvl: 1, tool: 1 },
    axe:    { name: 'Axe', cost: { wood: 10, stone: 4 }, give: { axe: 1 }, lvl: 1, tool: 1 },
    ammo:   { name: '20 Bullets', cost: { scrap: 3 }, give: { bullets: 20 }, lvl: 1 },
    medkit: { name: 'Medkit', cost: { scrap: 2, wood: 4 }, give: { medkit: 1 }, lvl: 2 },
    fuel:   { name: 'Biofuel can', cost: { wood: 6 }, give: { fuel: 1 }, lvl: 3 },
    grenade:{ name: 'Grenade', cost: { scrap: 3, stone: 2 }, give: { grenade: 1 }, lvl: 4 },
    molotov:{ name: '2 Molotovs', cost: { scrap: 2, fuel: 1 }, give: { molotov: 2 }, lvl: 2 },
    sticky: { name: 'Sticky Bomb', cost: { scrap: 4, stone: 3 }, give: { sticky: 1 }, lvl: 5 },
  };

  const WEAPONS = {
    fists:   { name: 'Fists', melee: true, dmg: 10, rate: 0.45, range: 46, gather: 0.5, noItem: true },
    hammer:  { name: 'Build Hammer', melee: true, dmg: 8, rate: 0.4, range: 50, gather: 0.3, tool: true },
    axe:     { name: 'Axe', melee: true, dmg: 22, rate: 0.5, range: 54, gather: 1.0 },
    machete: { name: 'Machete', melee: true, dmg: 38, rate: 0.4, range: 60, gather: 0.7 },
    revolver:{ name: 'Revolver', dmg: 48, rate: 0.45, mag: 6, spread: 0.03, speed: 1150, life: 0.75, pellets: 1, reload: 1.8 },
    pistol:  { name: 'Glock 17', dmg: 22, rate: 0.3, mag: 17, spread: 0.04, speed: 1000, life: 0.7, pellets: 1, reload: 1.1 },
    shotgun: { name: 'Pump Shotgun', dmg: 12, rate: 0.9, mag: 6, spread: 0.25, speed: 900, life: 0.42, pellets: 8, reload: 1.8 },
    smg:     { name: 'MP5', dmg: 14, rate: 0.09, mag: 30, spread: 0.1, speed: 1050, life: 0.6, pellets: 1, reload: 1.6 },
    ak:      { name: 'AK-47', dmg: 27, rate: 0.11, mag: 30, spread: 0.07, speed: 1300, life: 0.75, pellets: 1, reload: 2.0 },
    m4:      { name: 'M4', dmg: 24, rate: 0.085, mag: 30, spread: 0.05, speed: 1350, life: 0.75, pellets: 1, reload: 1.9 },
    sniper:  { name: '.50 Sniper', dmg: 220, rate: 1.5, mag: 5, spread: 0.002, speed: 2600, life: 1.0, pellets: 1, reload: 2.6, pierce: 5 },
    rifle:   { name: 'Hunting Rifle', dmg: 80, rate: 1.0, mag: 5, spread: 0.006, speed: 1700, life: 0.9, pellets: 1, reload: 2.0, pierce: 3 },
    deagle:  { name: 'Desert Eagle', dmg: 72, rate: 0.42, mag: 7, spread: 0.025, speed: 1250, life: 0.8, pellets: 1, reload: 1.6, pierce: 2 },
    crossbow:{ name: 'Crossbow', dmg: 140, rate: 0.6, mag: 1, spread: 0.004, speed: 1100, life: 0.85, pellets: 1, reload: 1.05, pierce: 3, ammo: 'bolts', silent: true },
    lmg:     { name: 'M249 LMG', dmg: 25, rate: 0.075, mag: 100, spread: 0.1, speed: 1350, life: 0.8, pellets: 1, reload: 4.2, heavy: 0.85 },
    glauncher:{ name: 'Grenade Launcher', dmg: 0, rate: 0.75, mag: 6, spread: 0.03, speed: 720, life: 0.85, pellets: 1, reload: 2.8, ammo: 'shells', proj: 'nade' },
    flamer:  { name: 'Flamethrower', dmg: 8, rate: 0.05, mag: 100, spread: 0.2, speed: 0, life: 0, pellets: 1, reload: 2.4, ammo: 'gas', flame: true },
    rpg:     { name: 'RPG-7', dmg: 0, rate: 1.2, mag: 1, spread: 0.01, speed: 950, life: 1.3, pellets: 1, reload: 2.3, ammo: 'rockets', proj: 'rocket', heavy: 0.9 },
    minigun: { name: 'Minigun', dmg: 22, rate: 0.038, mag: 200, spread: 0.11, speed: 1450, life: 0.75, pellets: 1, reload: 5.0, heavy: 0.62, spin: true },
    katana:  { name: 'Katana', melee: true, dmg: 58, rate: 0.36, range: 72, gather: 0.6, arc: 1.25 },
    chainsaw:{ name: 'Chainsaw', melee: true, dmg: 11, rate: 0.1, range: 64, gather: 1, arc: 0.8, saw: true },
    dual:    { name: 'Dual Pistols', dmg: 20, rate: 0.13, mag: 34, spread: 0.07, speed: 1000, life: 0.7, pellets: 1, reload: 1.9, dual: true },
    aa12:    { name: 'AA-12 Auto Shotgun', dmg: 11, rate: 0.2, mag: 20, spread: 0.22, speed: 900, life: 0.42, pellets: 7, reload: 2.6, heavy: 0.88 },
    harpoon: { name: 'Harpoon Gun', dmg: 95, rate: 0.9, mag: 1, spread: 0.01, speed: 1000, life: 0.7, pellets: 1, reload: 1.2, ammo: 'harpoons', harp: true, swimOk: true, silent: true },
    tesla:   { name: 'Tesla Gun', dmg: 55, rate: 0.5, mag: 12, spread: 0, speed: 0, life: 0, pellets: 1, reload: 2.2, ammo: 'cells', tesla: true },
    freeze:  { name: 'Freeze Ray', dmg: 5, rate: 0.08, mag: 60, spread: 0.2, speed: 0, life: 0, pellets: 1, reload: 2.2, ammo: 'cells', freeze: true },
  };
  const ammoOf = (k) => (WEAPONS[k] && WEAPONS[k].ammo) || 'bullets';
  // ---------- inventory items ----------
  const HOTBAR = 9, BACKPACK = 27, NSLOTS = HOTBAR + BACKPACK;
  const STACK = { cells: 200, harpoons: 20, molotov: 5, sticky: 5, bolts: 40, shells: 24, rockets: 10, gas: 300, gunparts: 40, tracks: 5, tengine: 5, barrel: 5, plates: 5, jengine: 5, wings: 5, cockpit: 5, avionics: 5, scope: 5, silencer: 5, extmag: 5, bullets: 120, wood: 100, stone: 100, scrap: 100, medkit: 5, food: 10, cooked: 10, meat: 10, bread: 10, chips: 10, apple: 10, soda: 10, grenade: 5, fuel: 5 };
  // how much hunger each food fills (cooked also heals a bit)
  const FOOD = { cooked: 45, food: 35, bread: 25, chips: 18, apple: 15, meat: 15, soda: 12 };
  const FOOD_ORDER = ['cooked', 'food', 'bread', 'chips', 'apple', 'soda', 'meat'];
  const ITEM_NAMES = { bullets: 'Bullets', wood: 'Wood', stone: 'Stone', scrap: 'Scrap', medkit: 'Medkit', food: 'Canned Beans', cooked: 'Cooked Meat', meat: 'Raw Meat', bread: 'Bread', chips: 'Chips', apple: 'Apple', soda: 'Soda', grenade: 'Grenade', fuel: 'Fuel Can', scope: 'Scope', silencer: 'Silencer', extmag: 'Extended Mag',
    cells: 'Energy Cells', harpoons: 'Harpoons', molotov: 'Molotov', sticky: 'Sticky Bomb',
    bolts: 'Crossbow Bolts', shells: '40mm Grenades', rockets: 'Rockets', gas: 'Flamer Fuel', gunparts: 'Gun Parts',
    tracks: 'Tank Tracks', tengine: 'Tank Engine', barrel: 'Cannon Barrel', plates: 'Armor Plates',
    jengine: 'Jet Engine', wings: 'Jet Wings', cockpit: 'Cockpit', avionics: 'Avionics' };
  const TANK_PARTS = ['tracks', 'tengine', 'barrel', 'plates'], JET_PARTS = ['jengine', 'wings', 'cockpit', 'avionics'];
  // ---------- the world evolves: every 2 days a new era ----------
  const ERAS = [
    null,
    { name: 'Outbreak', news: ['Walkers, runners and zombie dogs', 'Workbench: Crossbow, Desert Eagle, attachments'] },
    { name: 'Collapse', news: ['Armored SOLDIER zombies roam', 'Military convoys crash — TANK PARTS can be found', 'Workbench: LMG, Grenade Launcher, AK-47, M4, Tank'] },
    { name: 'Military Fallen', news: ['SCREAMERS call the horde when they see you', 'F-4 Phantoms go down — JET PARTS can be found', 'Workbench: Flamethrower, RPG, .50 Sniper, F-4 Phantom'] },
    { name: 'War Zone', news: ['JUGGERNAUTS walk the night — only explosives hurt them much', 'Workbench: Minigun', 'Everything drops better loot'] },
  ];
  const eraOf = (day) => day <= 2 ? 1 : day <= 4 ? 2 : day <= 6 ? 3 : 4;
  // ---------- workbench recipes (crafted guns come out Rare) ----------
  const BENCH = {
    crossbow: { cat: 'gun', era: 1, cost: { wood: 15, gunparts: 2 } },
    deagle:   { cat: 'gun', era: 1, cost: { scrap: 10, gunparts: 3 } },
    ak:       { cat: 'gun', era: 2, cost: { scrap: 15, gunparts: 4 } },
    m4:       { cat: 'gun', era: 2, cost: { scrap: 16, gunparts: 4 } },
    lmg:      { cat: 'gun', era: 2, cost: { scrap: 25, gunparts: 6 } },
    glauncher:{ cat: 'gun', era: 2, cost: { scrap: 20, gunparts: 5 } },
    sniper:   { cat: 'gun', era: 3, cost: { scrap: 22, gunparts: 6 } },
    flamer:   { cat: 'gun', era: 3, cost: { scrap: 20, fuel: 2, gunparts: 5 } },
    rpg:      { cat: 'gun', era: 3, cost: { scrap: 30, gunparts: 7 } },
    minigun:  { cat: 'gun', era: 4, cost: { scrap: 45, gunparts: 10 } },
    katana:   { cat: 'gun', era: 1, cost: { scrap: 12, gunparts: 1 } },
    chainsaw: { cat: 'gun', era: 1, cost: { scrap: 14, fuel: 1, gunparts: 2 } },
    dual:     { cat: 'gun', era: 1, cost: { scrap: 12, gunparts: 3 } },
    harpoon:  { cat: 'gun', era: 1, cost: { wood: 10, scrap: 8, gunparts: 2 } },
    aa12:     { cat: 'gun', era: 2, cost: { scrap: 24, gunparts: 6 } },
    tesla:    { cat: 'gun', era: 3, cost: { scrap: 26, fuel: 1, gunparts: 7 } },
    freeze:   { cat: 'gun', era: 3, cost: { scrap: 24, gunparts: 6 } },
    bolts:    { cat: 'ammo', era: 1, cost: { wood: 5 }, give: { bolts: 10 } },
    bullets:  { cat: 'ammo', era: 1, cost: { scrap: 3 }, give: { bullets: 20 } },
    shells:   { cat: 'ammo', era: 2, cost: { scrap: 4, stone: 2 }, give: { shells: 4 } },
    rockets:  { cat: 'ammo', era: 3, cost: { scrap: 6, fuel: 1 }, give: { rockets: 2 } },
    gas:      { cat: 'ammo', era: 3, cost: { fuel: 1 }, give: { gas: 100 } },
    harpoons: { cat: 'ammo', era: 1, cost: { wood: 3, scrap: 1 }, give: { harpoons: 4 } },
    cells:    { cat: 'ammo', era: 3, cost: { scrap: 4, fuel: 1 }, give: { cells: 30 } },
    scope:    { cat: 'mod', era: 1, cost: { scrap: 8, gunparts: 1 }, give: { scope: 1 } },
    silencer: { cat: 'mod', era: 1, cost: { scrap: 6, gunparts: 2 }, give: { silencer: 1 } },
    extmag:   { cat: 'mod', era: 1, cost: { scrap: 8, gunparts: 2 }, give: { extmag: 1 } },
    rowboat:  { cat: 'veh', era: 1, veh: 6, name: 'Rowboat', cost: { wood: 30, scrap: 4 } },
    speedboat: { cat: 'veh', era: 2, veh: 7, name: 'Speedboat', cost: { scrap: 30, wood: 15, fuel: 2, gunparts: 2 } },
    tank:     { cat: 'veh', era: 2, veh: 4, name: 'Tank', cost: { tracks: 1, tengine: 1, barrel: 1, plates: 1, scrap: 40 } },
    jet:      { cat: 'veh', era: 3, veh: 5, name: 'F-4 Phantom', cost: { jengine: 1, wings: 1, cockpit: 1, avionics: 1, scrap: 60, fuel: 3 } },
    radio:    { cat: 'evac', era: 3, name: 'Emergency Radio', cost: { scrap: 20, gunparts: 6, fuel: 2 } },
    up_spikes: { cat: 'car', era: 1, up: 'spikes', name: 'Ram Spikes — double ram damage, no dents', cost: { scrap: 12 } },
    up_plow:   { cat: 'car', era: 1, up: 'plow', name: 'Zombie Plow — smash through slowly too', cost: { scrap: 16, wood: 10 } },
    up_armor:  { cat: 'car', era: 2, up: 'armor', name: 'Armor Plates — +60% health, -40% damage', cost: { scrap: 20, stone: 10 } },
    up_nitro:  { cat: 'car', era: 2, up: 'nitro', name: 'Nitro — hold Shift for a boost', cost: { fuel: 2, scrap: 10, gunparts: 2 } },
    up_gun:    { cat: 'car', era: 2, up: 'gun', name: 'Roof Gun — shoots zombies by itself', cost: { scrap: 18, gunparts: 4 } },
  };
  const EVAC_COST = { scrap: 20, gunparts: 6, fuel: 2 };
  // car upgrades (Workbench, park the car next to it)
  const CAR_UPS = { spikes: { bit: 1, name: 'Ram Spikes' }, plow: { bit: 4, name: 'Zombie Plow' }, armor: { bit: 2, name: 'Armor Plates' }, gun: { bit: 8, name: 'Roof Gun' }, nitro: { bit: 16, name: 'Nitro' } };
  // Haven: the safe trader town — buy with cash, sell loot, take jobs
  const SHOP = [['bullets', 30, 20], ['shells', 6, 40], ['medkit', 1, 40], ['food', 2, 15], ['fuel', 1, 25], ['grenade', 1, 35], ['molotov', 2, 30], ['scrap', 10, 45], ['gunparts', 2, 70], ['harpoons', 4, 20], ['cells', 30, 60], ['rockets', 2, 80],
    ['pistol', 1, 80], ['shotgun', 1, 160], ['smg', 1, 240], ['katana', 1, 220], ['ak', 1, 380], ['chainsaw', 1, 320], ['sniper', 1, 480], ['aa12', 1, 650], ['tesla', 1, 950]];
  const SELL = { scrap: 3, wood: 1, stone: 1, meat: 6, gunparts: 25, fuel: 12, bullets: 1 };
  const JOB_KINDS = ['clear', 'defend', 'deliver', 'hunt'];
  // looks: hats and outfits, unlocked by goals, money or big wins
  const SKINS = {
    cap: { h: 1, name: 'Cap' }, beanie: { h: 1, name: 'Beanie' }, hood: { h: 1, name: 'Hood' },
    helmet: { h: 1, name: 'Army Helmet', goal: 4 }, cowboy: { h: 1, name: 'Cowboy Hat', goal: 8 }, headband: { h: 1, name: 'Headband', goal: 12 },
    party: { h: 1, name: 'Party Hat', cash: 150 }, tophat: { h: 1, name: 'Top Hat', cash: 400 }, pirate: { h: 1, name: 'Pirate Hat', esc: 1 }, crown: { h: 1, name: 'Crown', king: 1 },
    default: { o: 1, name: 'Team colour' }, camo: { o: 1, name: 'Camo', goal: 6 }, hazmat: { o: 1, name: 'Hazmat Suit', goal: 10 }, ninja: { o: 1, name: 'Ninja', goal: 14 },
    doctor: { o: 1, name: 'Doctor', resc: 3 }, hivis: { o: 1, name: 'Hi-Vis', cash: 200 }, biker: { o: 1, name: 'Biker Jacket', cash: 300 }, suit: { o: 1, name: 'Black Suit', cash: 500 },
  };
  const WEATHER = ['Clear', 'Rain', 'Fog', 'Thunderstorm', 'Sandstorm'];
  const DOG_NAMES = ['Buddy', 'Max', 'Luna', 'Rocky', 'Bella', 'Duke', 'Scout', 'Daisy', 'Bear', 'Ziggy', 'Biscuit', 'Shadow'];
  const KITS = { axe: 'Axe & a can of beans', fists: 'Fists & a can of beans', full: 'Full kit (axe, pistol, hammer)' };
  const stackOf = k => WEAPONS[k] ? 1 : (STACK[k] || 1);
  const itemName = k => WEAPONS[k] ? WEAPONS[k].name : (ITEM_NAMES[k] || k);
  const WEAPON_ORDER = ['axe', 'machete', 'pistol', 'revolver', 'shotgun', 'smg', 'ak', 'm4', 'rifle', 'sniper'];

  // minDay = first day it can appear; w = spawn weight [day, night]
  const ZT = [
    { name: 'Walker', hp: 50, spd: 72, dmg: 10, r: 15, xp: 10, sdmg: 12, minDay: 1, w: [60, 40] },
    { name: 'Runner', hp: 35, spd: 145, dmg: 8, r: 13, xp: 15, sdmg: 8, minDay: 2, w: [15, 22] },
    { name: 'Brute', hp: 320, spd: 58, dmg: 28, r: 24, xp: 70, sdmg: 45, minDay: 3, w: [5, 9] },
    { name: 'Zombie Dog', hp: 30, spd: 195, dmg: 7, r: 12, xp: 12, sdmg: 4, minDay: 1, w: [8, 12] },
    { name: 'Spitter', hp: 60, spd: 66, dmg: 6, r: 15, xp: 25, sdmg: 6, minDay: 2, w: [7, 10] },
    { name: 'Bloater', hp: 90, spd: 55, dmg: 0, r: 21, xp: 30, sdmg: 0, minDay: 2, w: [4, 7] },
    { name: 'Abomination', hp: 2400, spd: 70, dmg: 40, r: 38, xp: 400, sdmg: 140, minDay: 99, w: [0, 0], boss: true },
    { name: 'Deer', hp: 40, spd: 175, dmg: 0, r: 14, xp: 6, sdmg: 0, minDay: 99, w: [0, 0], animal: true },
    { name: 'Soldier', hp: 150, spd: 82, dmg: 14, r: 15, xp: 35, sdmg: 16, minDay: 1, minEra: 2, w: [7, 11], armor: 0.4 },
    { name: 'Screamer', hp: 70, spd: 92, dmg: 5, r: 14, xp: 40, sdmg: 4, minDay: 1, minEra: 3, w: [4, 6] },
    { name: 'Juggernaut', hp: 1300, spd: 54, dmg: 45, r: 27, xp: 260, sdmg: 120, minDay: 1, minEra: 4, w: [0.6, 2.2], armor: 0.7 },
    { name: 'Colossus', hp: 4200, spd: 60, dmg: 50, r: 44, xp: 700, sdmg: 220, minDay: 99, w: [0, 0], boss: true, armor: 0.2 },
    { name: 'Rotwing', hp: 40, spd: 235, dmg: 8, r: 11, xp: 22, sdmg: 0, minDay: 1, minEra: 2, w: [2.5, 5], fly: true },
    { name: 'Zombie King', hp: 9000, spd: 66, dmg: 45, r: 34, xp: 2000, sdmg: 250, minDay: 99, w: [0, 0], boss: true, armor: 0.3 },
  ];
  const VT = [
    { name: 'Car', hp: 300, maxV: 520, acc: 380, r: 22, turn: 2.6, ram: 1 },
    { name: 'Pickup Truck', hp: 520, maxV: 440, acc: 320, r: 25, turn: 2.2, ram: 1.15 },
    { name: 'Gun Truck', hp: 700, maxV: 430, acc: 310, r: 25, turn: 2.2, ram: 1.5, gun: true },
    { name: 'Dirt Bike', hp: 150, maxV: 660, acc: 560, r: 15, turn: 3.6, ram: 0.7, bike: true },
    { name: 'Tank', hp: 2600, maxV: 250, acc: 170, r: 30, turn: 1.25, ram: 3.5, tank: true, gun: true },
    { name: 'F-4 Phantom', hp: 700, maxV: 1150, acc: 430, r: 28, turn: 1.55, ram: 1, jet: true },
    { name: 'Rowboat', hp: 260, maxV: 300, acc: 230, r: 20, turn: 2.0, ram: 0.5, boat: true, nofuel: true },
    { name: 'Speedboat', hp: 560, maxV: 640, acc: 430, r: 24, turn: 2.2, ram: 0.8, boat: true, gun: true },
    { name: 'Attack Helicopter', hp: 950, maxV: 560, acc: 620, r: 30, turn: 2.5, ram: 1, heli: true },
  ];
  // boats only go on water
  function blockedBoat(ws, tx, ty) {
    if (tx < 1 || ty < 1 || tx >= MW - 1 || ty >= MH - 1) return true;
    return ws.map.t[ty * MW + tx] !== T_WATER;
  }
  // a tank rolls over trees, rocks, wrecks and furniture — only water, buildings and walls stop it
  function blockedTank(ws, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    const i = ty * MW + tx, t = ws.map.t[i];
    if (t === T_WATER || t === T_BWALL) return true;
    return SOLID_P[ws.sType[i]] === 1 || DOORS[ws.sType[i]] === 1;
  }
  function blockedAir(ws, tx, ty) { return tx < 1 || ty < 1 || tx >= MW - 1 || ty >= MH - 1; }
  const vehBlock = (type, alt) => VT[type].boat ? blockedBoat : VT[type].tank ? blockedTank : (VT[type].jet || VT[type].heli) && alt > 0.08 ? blockedAir : blockedP;
  // ---------- loot rarity, attachments, perks ----------
  const RARITY = [
    { name: 'Common', col: '#cfd8dc', dmg: 1, rate: 1, rel: 1, spr: 1 },
    { name: 'Rare', col: '#42a5f5', dmg: 1.2, rate: 0.95, rel: 0.9, spr: 0.85 },
    { name: 'Epic', col: '#c160e0', dmg: 1.45, rate: 0.9, rel: 0.8, spr: 0.75 },
    { name: 'Legendary', col: '#ffb300', dmg: 1.8, rate: 0.82, rel: 0.7, spr: 0.6 },
  ];
  const ATT = { scope: 1, silencer: 2, extmag: 4 };
  const ATT_NAMES = { scope: 'Scope', silencer: 'Silencer', extmag: 'Extended Mag' };
  const ONE_HAND = { pistol: 1, revolver: 1, smg: 1, deagle: 1 };
  const PERKS = {
    tough:   { name: 'Tough', desc: '+30 max health' },
    sharp:   { name: 'Sharpshooter', desc: '+15% gun damage' },
    hands:   { name: 'Fast Hands', desc: 'Reload 35% faster' },
    lumber:  { name: 'Lumberjack', desc: '+60% melee damage, gather faster' },
    medic:   { name: 'Medic', desc: 'Medkits heal double · revive friends 2x faster' },
    runner:  { name: 'Marathon', desc: 'Run 12% faster' },
    stomach: { name: 'Iron Stomach', desc: 'Get hungry 40% slower' },
    scav:    { name: 'Scavenger', desc: 'Better loot rarity and more ammo from boxes' },
    saver:   { name: 'Ammo Saver', desc: '25% of shots use no ammo' },
    builder: { name: 'Engineer', desc: 'Your buildings have +50% health' },
    road:    { name: 'Road Warrior', desc: 'Cars take half damage, ramming hits harder' },
    second:  { name: 'Second Wind', desc: 'Stay down 2x longer before bleeding out, crawl faster' },
  };
  const PERK_KEYS = Object.keys(PERKS);
  const BOT_NAMES = ['Rex', 'Mia', 'Doc', 'Ghost', 'Viper', 'Jade'];
  const SURV_NAMES = ['Sam', 'Lena', 'Omar', 'Kai', 'Nora', 'Jules', 'Rosa', 'Tariq', 'Ivy', 'Marco', 'Zara', 'Ben', 'Hana', 'Leo', 'Maya', 'Finn', 'Yusuf', 'Clara', 'Dex', 'Noor', 'Eli', 'Sofia', 'Karim', 'Tess'];
  const ROLES = {
    medic:    { name: 'Medic',    kit: [['pistol'], ['medkit', 3], ['food', 2]], gift: { medkit: 2 }, say: 'I can patch you up.' },
    soldier:  { name: 'Soldier',  kit: [['m4'], ['medkit', 1], ['food', 1]], ammo: 150, gift: { bullets: 60, grenade: 1 }, say: 'Point me at them.' },
    mechanic: { name: 'Mechanic', kit: [['shotgun'], ['medkit', 1], ['food', 2]], gift: { fuel: 2, scrap: 15 }, say: 'Got spare parts for your rides.' },
    scout:    { name: 'Scout',    kit: [['rifle'], ['medkit', 1], ['food', 2]], gift: { scope: 1, bullets: 20 }, say: 'I know a few hiding spots.' },
    cook:     { name: 'Cook',     kit: [['smg'], ['cooked', 4], ['medkit', 1]], gift: { cooked: 4, food: 2 }, say: 'Nobody goes hungry on my watch.' },
    engineer: { name: 'Engineer', kit: [['crossbow'], ['medkit', 1], ['food', 2]], bolts: 40, gift: { gunparts: 3 }, say: 'I build things. Good things.' },
  };
  const ROLE_KEYS = Object.keys(ROLES);
  // the goal chain that walks you through the game (rewards on every step)
  const GOALS = [
    { t: 'Gather 15 wood — chop (or punch!) trees', f: (g, p) => [p.inv.wood, 15], r: { xp: 30, give: { food: 1 } } },
    { t: 'Craft a Build Hammer (C) and build 3 pieces', f: (g, p) => [p.st.built || 0, 3], r: { xp: 40, give: { wood: 10, stone: 10 } } },
    { t: 'Search 5 crates, fridges or cupboards', f: (g, p) => [p.st.looted || 0, 5], r: { xp: 40, give: { bullets: 20 } } },
    { t: 'Survive your first night', f: (g) => [g.day() >= 2 ? 1 : 0, 1], r: { xp: 80, give: { medkit: 1 } } },
    { t: 'Rescue a survivor — follow the SOS radio signal', f: (g) => [g.rescued.length, 1], r: { xp: 80, give: { bullets: 30 } } },
    { t: 'Swim across some water (zombies can\'t swim!)', f: (g, p) => [Math.floor((p.st.swam || 0) / 40), 6], r: { xp: 40, give: { food: 2 } } },
    { t: 'Build a Workbench with the hammer', f: (g, p) => [p.st.bench || 0, 1], r: { xp: 60, give: { gunparts: 2 } } },
    { t: 'Build a Rowboat at the Workbench and sail it', f: (g, p) => [Math.floor((p.st.sailed || 0) / 40), 15], r: { xp: 80, give: { scrap: 10 } } },
    { t: 'Reach an island and open its sea chest', f: (g, p) => [p.st.island || 0, 1], r: { xp: 120, give: { gunparts: 3 } }, isl: true },
    { t: 'Craft a gun at the Workbench', f: (g, p) => [p.st.gc || 0, 1], r: { xp: 80, give: { bullets: 40 } } },
    { t: 'Rescue 3 survivors', f: (g) => [g.rescued.length, 3], r: { xp: 150, give: { medkit: 2 } } },
    { t: 'Build a Speedboat (Era 2)', f: (g, p) => [p.st.sboat || 0, 1], r: { xp: 120, give: { fuel: 2 } } },
    { t: 'Build a Tank from 4 tank parts', f: (g, p) => [p.st.tank || 0, 1], r: { xp: 200, give: { shells: 6 } } },
    { t: 'Rescue 6 survivors', f: (g) => [g.rescued.length, 6], r: { xp: 250, give: { grenade: 3 } } },
    { t: 'Build the F-4 Phantom', f: (g, p) => [p.st.jet || 0, 1], r: { xp: 300, give: { rockets: 4 } } },
    { t: 'Tame a stray dog — feed it a can of beans (E)', f: (g, p) => [p.st.dog ? 1 : 0, 1], r: { xp: 100, give: { meat: 2 } } },
    { t: 'Era 3: fix the RADIO TOWER (or make an Emergency Radio) and call the evac', f: (g) => [g.evac.fixed ? 1 : 0, 1], r: { xp: 200, give: { grenade: 3 } } },
    { t: 'ESCAPE — hold the landing zone and get on the evac helicopter', f: (g, p) => [p.st.escaped ? 1 : 0, 1], r: { xp: 1000, give: { gunparts: 10 } } },
  ];
  // breakable furniture and loot containers: health, what you get, and what it's called
  const FURN_INFO = {
    counter: { hp: 60, drop: { wood: 2, stone: 2 }, name: 'kitchen counter' }, stove: { hp: 70, drop: { scrap: 3 }, name: 'stove' }, sink: { hp: 60, drop: { scrap: 2, stone: 1 }, name: 'sink' },
    sofa: { hp: 50, drop: { wood: 4 }, name: 'sofa' }, tv: { hp: 25, drop: { scrap: 2 }, name: 'TV' }, plant: { hp: 15, drop: { wood: 1 }, name: 'plant' },
    hbed: { hp: 50, drop: { scrap: 2, wood: 2 }, name: 'hospital bed' }, desk: { hp: 60, drop: { wood: 5 }, name: 'desk' }, bunk: { hp: 60, drop: { wood: 3, scrap: 1 }, name: 'bunk bed' },
    hay: { hp: 30, drop: { wood: 2 }, name: 'hay bale' },
    fridge: { hp: 90, drop: { scrap: 4 }, name: 'fridge' }, cabinet: { hp: 50, drop: { wood: 4 }, name: 'cupboard' }, dresser: { hp: 50, drop: { wood: 4 }, name: 'drawers' },
    box: { hp: 15, drop: { wood: 1 }, name: 'box' }, crate: { hp: 50, drop: { wood: 4 }, name: 'crate' }, ammo: { hp: 45, drop: { scrap: 2 }, name: 'ammo crate' },
    locker: { hp: 110, drop: { scrap: 4 }, name: 'locker' }, medcab: { hp: 50, drop: { scrap: 2 }, name: 'medicine cabinet' }, supply: { hp: 30, drop: { scrap: 1 }, name: 'supply box' },
    shelf: { hp: 70, drop: { scrap: 3 }, name: 'shelf' }, cooler: { hp: 90, drop: { scrap: 4 }, name: 'drinks fridge' },
  };
  const FURN_BACK = 1200; // broken furniture is back after ~20 minutes
  const gunStats = (k, r, at) => {
    const W = WEAPONS[k]; if (!W) return WEAPONS.fists;
    const R = RARITY[r | 0] || RARITY[0];
    if (W.melee) return Object.assign({}, W, { dmg: W.dmg * R.dmg });
    at = at | 0;
    return Object.assign({}, W, { dmg: W.dmg * R.dmg, rate: W.rate * R.rate, reload: W.reload * R.rel, spread: W.spread * R.spr * (at & 1 ? 0.5 : 1), life: W.life * (at & 1 ? 1.4 : 1), mag: Math.round(W.mag * (at & 4 ? 1.5 : 1)) });
  };
  const fullName = (k, r) => (r ? RARITY[r].name + ' ' : '') + itemName(k);
  const CAR_COLORS = ['#c62828', '#1565c0', '#f9a825', '#2e7d32', '#eceff1', '#6a1b9a', '#37474f', '#ef6c00'];
  const P_COLORS = ['#4fc3f7', '#9ccc65', '#ffb74d', '#f06292', '#ba68c8', '#4db6ac'];

  const needXp = l => Math.round(80 * Math.pow(l, 1.4));
  const maxHpOf = l => 100 + 10 * (l - 1);
  const dmgMult = l => 1 + 0.06 * (l - 1);

  // ---------- helpers ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  function makeNoise(R) {
    const P = new Float32Array(65536); for (let i = 0; i < 65536; i++) P[i] = R();
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const h = (a, b) => P[((a & 255) << 8) | (b & 255)];
      const s = t => t * t * (3 - 2 * t);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      const u = s(xf), v = s(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  const fbm = (n, x, y) => n(x, y) * 0.6 + n(x * 2.1 + 17, y * 2.1 + 3) * 0.3 + n(x * 4.3 + 7, y * 4.3 + 11) * 0.1;

  // compact bitset <-> string (portable base64)
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function bitsToStr(arr) { let s = ''; for (let i = 0; i < arr.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) if (arr[i + k]) v |= 1 << k; s += B64[v]; } return s; }
  function strToBits(s, n) { const out = new Uint8Array(n); for (let i = 0; i < s.length; i++) { const v = B64.indexOf(s[i]); for (let k = 0; k < 6; k++) if (v & (1 << k) && i * 6 + k < n) out[i * 6 + k] = 1; } return out; }

  // ---------- world generation ----------
  const TOWN_NAMES = ['Ashford', 'Briar Creek', 'Cold Harbor', 'Dunmore', 'Eastwood', 'Fallow', 'Greystone', 'Hollow Pines', 'Ironvale', 'Juniper', 'Kingsbridge', 'Lowmoor', 'Millbrook', 'Northgate',
    'Oakridge', 'Pinecrest', 'Quarry Falls', 'Redwater', 'Silverton', 'Thornbury', 'Umber Hill', 'Valewood', 'Westmere', 'Yarrow', 'Zephyr Bay', 'Ashgrove', 'Blackmoor', 'Cedar Gap', 'Dry Gulch', 'Elm Hollow', 'Fox Run', 'Glenhaven', 'Harrow', 'Iron Creek', 'Jasper', 'Kestrel Point', 'Larkspur', 'Mosswood', 'New Haven', 'Old Mill'];
  function makeWorldMap(seed, mv) {
    mv = mv || 1; setSize(sizeOf(mv));
    const BIG = MW > 300, SC = BIG ? 1 : 0;
    const R = rng(seed);
    const nE = makeNoise(R), nF = makeNoise(R), nR = makeNoise(R), nT = makeNoise(R), nW = makeNoise(R);
    const N = MW * MH;
    const t = new Uint8Array(N), node = new Uint8Array(N), town = new Uint8Array(N);
    const I = (x, y) => y * MW + x;
    const inb = (x, y) => x > 1 && y > 1 && x < MW - 2 && y < MH - 2;
    const C = MW >> 1;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const edge = Math.min(x, y, MW - 1 - x, MH - 1 - y);
      const e = fbm(nE, x / 26, y / 26) - (mv >= 2 ? (edge < 26 ? Math.pow((26 - edge) / 26, 1.6) * 0.55 : 0) : (edge < 10 ? (10 - edge) * 0.05 : 0));
      const f = fbm(nF, x / 15, y / 15), temp = fbm(nT, x / (BIG ? 95 : 45), y / (BIG ? 95 : 45));
      let v = T_GRASS;
      if (e < 0.3) v = T_WATER; else if (e < 0.33) v = T_SAND; else if (temp > 0.64) v = T_DESERT; else if (f > 0.6) v = T_FOREST;
      t[I(x, y)] = v;
    }
    // rivers
    for (let r = 0; r < (BIG ? 7 : 2); r++) {
      let x, y, dx, dy;
      if (R() < 0.5) { x = 15 + Math.floor(R() * (MW - 30)); y = 2; dx = 0; dy = 1; } else { x = 2; y = 15 + Math.floor(R() * (MH - 30)); dx = 1; dy = 0; }
      let ang = Math.atan2(dy, dx);
      for (let k = 0; k < (BIG ? 3200 : 900); k++) {
        ang += (nW(k / 18 + r * 50, r * 7) - 0.5) * 0.25;
        const base = Math.atan2(dy, dx); ang = base + clamp(angDiff(ang, base), -0.9, 0.9);
        x += Math.cos(ang); y += Math.sin(ang);
        const ix = Math.round(x), iy = Math.round(y);
        if (ix < 1 || iy < 1 || ix >= MW - 1 || iy >= MH - 1) break;
        if (Math.hypot(ix - C, iy - C) < 14) continue;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const nx = ix + ox, ny = iy + oy; if (inb(nx, ny)) { t[I(nx, ny)] = T_WATER; } }
        for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const nx = ix + ox, ny = iy + oy; if (inb(nx, ny) && t[I(nx, ny)] !== T_WATER) t[I(nx, ny)] = T_SAND; }
      }
    }
    // map v2: islands off the coast, and lakes with an island in the middle
    const islands = [];
    if (mv >= 2) {
      const RI = rng((seed ^ 0x51A7D) >>> 0);
      for (let k = 0; k < (BIG ? 6000 : 900) && islands.length < (BIG ? 24 : 7); k++) {
        const x = 6 + Math.floor(RI() * (MW - 12)), y = 6 + Math.floor(RI() * (MH - 12)), r = 4 + Math.floor(RI() * 5);
        const edge = Math.min(x, y, MW - 1 - x, MH - 1 - y); if (edge > 24 || edge < r + 3) continue;
        if (islands.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 12)) continue;
        let ok = true; const R4 = r + 4;
        for (let oy = -R4; oy <= R4 && ok; oy++) for (let ox = -R4; ox <= R4; ox++) { if (ox * ox + oy * oy > R4 * R4) continue; if (!inb(x + ox, y + oy) || t[I(x + ox, y + oy)] !== T_WATER) { ok = false; break; } }
        if (ok) islands.push({ x, y, r, kind: 'sea' });
      }
      for (let k = 0, n = 0; k < (BIG ? 3000 : 400) && n < (BIG ? 10 : 3); k++) {
        const x = 34 + Math.floor(RI() * (MW - 68)), y = 34 + Math.floor(RI() * (MH - 68)), r = 9 + Math.floor(RI() * 5);
        if (Math.hypot(x - C, y - C) < 42 || islands.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 16)) continue;
        let land = 0, tot = 0; for (let oy = -r - 2; oy <= r + 2; oy++) for (let ox = -r - 2; ox <= r + 2; ox++) { tot++; if (t[I(x + ox, y + oy)] !== T_WATER) land++; }
        if (land < tot * 0.85) continue;
        for (let oy = -r - 3; oy <= r + 3; oy++) for (let ox = -r - 3; ox <= r + 3; ox++) {
          const d = Math.hypot(ox, oy) / (r * (0.82 + 0.36 * nW(x + ox / 4, y + oy / 4))), i = I(x + ox, y + oy);
          if (d < 1) t[i] = T_WATER; else if (d < 1.22 && t[i] !== T_WATER) t[i] = T_SAND;
        }
        islands.push({ x, y, r: 3 + Math.floor(RI() * 2), kind: 'lake' }); n++;
      }
      for (const o of islands) for (let oy = -o.r - 2; oy <= o.r + 2; oy++) for (let ox = -o.r - 2; ox <= o.r + 2; ox++) {
        if (!inb(o.x + ox, o.y + oy)) continue;
        const d = Math.hypot(ox, oy) / (o.r * (0.8 + 0.4 * nF(o.x + ox / 3, o.y + oy / 3))), i = I(o.x + ox, o.y + oy);
        if (d < 0.72) t[i] = nF((o.x + ox) / 15, (o.y + oy) / 15) > 0.52 ? T_FOREST : T_GRASS; else if (d < 1) t[i] = T_SAND;
      }
    }
    // points of interest
    const pois = [{ x: C, y: C, kind: 'town', size: 26 }];
    const place = (kind, size, count, minOther, minCenter) => {
      let placed = 0;
      for (let tries = 0; tries < (BIG ? 9000 : 1500) && placed < count; tries++) {
        const x = 20 + Math.floor(R() * (MW - 40)), y = 20 + Math.floor(R() * (MH - 40));
        if (Math.hypot(x - C, y - C) < minCenter) continue;
        if (pois.some(o => Math.hypot(o.x - x, o.y - y) < minOther + (o.size + size) / 4)) continue;
        let water = 0; for (let k = 0; k < 20; k++) { const xx = x + Math.floor((R() - 0.5) * size), yy = y + Math.floor((R() - 0.5) * size); if (t[I(xx, yy)] === T_WATER) water++; }
        if (water > 8) continue;
        pois.push({ x, y, kind, size }); placed++;
      }
    };
    place('town', 26, BIG ? 34 : 10, 26, 0);
    place('military', 20, BIG ? 6 : 2, 26, 60);
    place('farm', 16, BIG ? 14 : 4, 18, 20);
    place('gas', 8, BIG ? 20 : 6, 14, 12);
    let tn = 0; for (const o of pois) if (o.kind === 'town') o.name = TOWN_NAMES[tn++ % TOWN_NAMES.length];
    const crates = [], pumps = [], vspawns = [], labels = [], buildings = [], furn = [], extra = [], solid = new Uint8Array(MW * MH), furnAt = new Int32Array(MW * MH), crateAt = new Int32Array(MW * MH);
    const NOSOLID = { kfloor: 1, rug: 1, table: 1 };

    const road = (x, y) => { if (inb(x, y) && t[I(x, y)] !== T_BWALL && t[I(x, y)] !== T_FLOOR && t[I(x, y)] !== T_CONC && t[I(x, y)] !== T_HOSP) { t[I(x, y)] = T_ROAD; node[I(x, y)] = 0; } };
    const roadL = (ax, ay, bx, by) => {
      const sx = Math.sign(bx - ax) || 1, sy = Math.sign(by - ay) || 1;
      for (let x = ax; x !== bx + sx; x += sx) { road(x, ay); road(x, ay + 1); }
      for (let y = ay; y !== by + sy; y += sy) { road(bx, y); road(bx + 1, y); }
    };
    // road network: connect each POI to the nearest already-connected one
    const connected = [pois[0]];
    for (const o of pois.slice(1).sort((a, b) => Math.hypot(a.x - C, a.y - C) - Math.hypot(b.x - C, b.y - C))) {
      let best = connected[0], bd = 1e9; for (const c of connected) { const d = Math.hypot(c.x - o.x, c.y - o.y); if (d < bd) { bd = d; best = c; } }
      roadL(o.x, o.y, best.x, best.y); connected.push(o);
    }
    const clearArea = (x0, y0, w, h) => {
      for (let y = y0 - 2; y < y0 + h + 2; y++) for (let x = x0 - 2; x < x0 + w + 2; x++) {
        if (!inb(x, y)) continue; const i = I(x, y);
        town[i] = 1; node[i] = 0;
        if (t[i] === T_WATER || t[i] === T_FOREST || t[i] === T_SAND || t[i] === T_DESERT) t[i] = T_GRASS;
      }
    };
    const building = (bx, by, w, h, floorT, tier, ncr, kind) => {
      const bIdx = buildings.length; buildings.push({ x: bx, y: by, w, h, f: floorT, kind: kind || 'house' });
      for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) {
        const edge = x === bx || y === by || x === bx + w - 1 || y === by + h - 1;
        t[I(x, y)] = edge ? T_BWALL : floorT; node[I(x, y)] = 0;
      }
      const sides = [0, 1, 2, 3].filter(() => R() < 0.5); if (!sides.length) sides.push(Math.floor(R() * 4));
      const mx = bx + (w >> 1) - 1, my = by + (h >> 1) - 1;
      for (const s of sides) {
        if (s === 0) { t[I(mx, by)] = floorT; t[I(mx + 1, by)] = floorT; }
        if (s === 1) { t[I(mx, by + h - 1)] = floorT; t[I(mx + 1, by + h - 1)] = floorT; }
        if (s === 2) { t[I(bx, my)] = floorT; t[I(bx, my + 1)] = floorT; }
        if (s === 3) { t[I(bx + w - 1, my)] = floorT; t[I(bx + w - 1, my + 1)] = floorT; }
      }
      const spots = [[bx + 1, by + 1], [bx + w - 2, by + h - 2], [bx + w - 2, by + 1], [bx + 1, by + h - 2]];
      for (let k = 0; k < ncr; k++) { const sp = spots[k % 4]; if (!crates.some(c => c.tx === sp[0] && c.ty === sp[1])) crates.push({ tx: sp[0], ty: sp[1], tier }); }
      furnish(bx, by, w, h, kind || 'house', sides, tier);
    };
    // ---- interiors: kitchens, living rooms, wards, offices… (own RNG so the rest of the map stays the same)
    const furnish = (bx, by, w, h, kind, doorSides, tier) => {
      const FR = rng((seed ^ Math.imul(bx + 1, 73856093) ^ Math.imul(by + 1, 19349663)) >>> 0);
      const iw = w - 2, ih = h - 2;
      const wall = (s) => {
        const len = s < 2 ? iw : ih, din = (w >> 1) - 2, dinY = (h >> 1) - 2, door = doorSides.includes(s);
        const dIdx = s < 2 ? din : dinY;
        const tile = (i) => s === 0 ? [bx + 1 + i, by + 1] : s === 1 ? [bx + 1 + i, by + h - 2] : s === 2 ? [bx + 1, by + 1 + i] : [bx + w - 2, by + 1 + i];
        const inw = s === 0 ? [0, 1] : s === 1 ? [0, -1] : s === 2 ? [1, 0] : [-1, 0];
        return { s, len, door, isDoor: (i) => door && (i === dIdx || i === dIdx + 1), tile, a: Math.atan2(-inw[0], inw[1]), inw };
      };
      const W4 = [0, 1, 2, 3].map(wall);
      const crateAt = (tx, ty) => crates.find(c => c.tx === tx && c.ty === ty) || extra.find(c => c.tx === tx && c.ty === ty);
      const put = (t, tx, ty, a, o) => { const f = Object.assign({ t, x: tx * TILE + 20, y: ty * TILE + 20, a }, o || {}); furn.push(f); if (!NOSOLID[t]) { solid[I(tx, ty)] = 1; f.tiles = [I(tx, ty)]; furnAt[I(tx, ty)] = furn.length; } };
      const put2 = (t, w0, i, o) => { const [ax, ay] = w0.tile(i), [bx2, by2] = w0.tile(i + 1); furn.push(Object.assign({ t, x: (ax + bx2) * TILE / 2 + 20, y: (ay + by2) * TILE / 2 + 20, a: w0.a, tiles: [I(ax, ay), I(bx2, by2)] }, o || {})); solid[I(ax, ay)] = 1; solid[I(bx2, by2)] = 1; furnAt[I(ax, ay)] = furn.length; furnAt[I(bx2, by2)] = furn.length; };
      const loot = (k, tx, ty, a, tr) => { const c = crateAt(tx, ty); if (c) { c.k = k; c.a = a; if (tr !== undefined) c.tier = tr; } else extra.push({ tx, ty, tier: tr === undefined ? tier : tr, k, a }); };
      // existing loot spots get a look that fits the building (corner -> faces in from the top/bottom wall)
      const dressCorners = (k) => { for (const c of crates) if (c.tx > bx && c.tx < bx + w - 1 && c.ty > by && c.ty < by + h - 1 && !c.k) { c.k = k; c.a = c.ty === by + 1 ? 0 : Math.PI; } };
      const pick = (arr) => arr[Math.floor(FR() * arr.length)];
      const free = W4.filter(q => !q.door);
      if (kind === 'house' || kind === 'farmhouse') {
        const kw = free.length ? pick(free) : pick(W4), opp = W4[kw.s ^ 1];
        put('kfloor', 0, 0, kw.a, { x: (kw.tile(0)[0] + kw.tile(kw.len - 1)[0]) * TILE / 2 + 20 + kw.inw[0] * 20, y: (kw.tile(0)[1] + kw.tile(kw.len - 1)[1]) * TILE / 2 + 20 + kw.inw[1] * 20, w: kw.len * TILE, d: TILE * 2 });
        for (let i = 0; i < kw.len; i++) {
          if (kw.isDoor(i)) continue;
          const [tx, ty] = kw.tile(i), last = i === kw.len - 1;
          if (i === 0) loot('fridge', tx, ty, kw.a, 6);
          else if (last) loot('cabinet', tx, ty, kw.a, 7);
          else if (i === 1) put('stove', tx, ty, kw.a);
          else if (i === 2) put('sink', tx, ty, kw.a);
          else put('counter', tx, ty, kw.a);
        }
        // dining table in the middle, nudged towards the kitchen
        const cx = (bx + w / 2) * TILE + kw.inw[0] * -10, cy = (by + h / 2) * TILE + kw.inw[1] * -10;
        furn.push({ t: 'rug', x: cx, y: cy, a: kw.a, c: Math.floor(FR() * 4) });
        furn.push({ t: 'table', x: cx, y: cy, a: kw.a, c: Math.floor(FR() * 3) });
        const lw = !opp.door ? opp : free.find(q => q !== kw && q !== opp);
        if (lw) put2('sofa', lw, 1, { c: Math.floor(FR() * 5) });
        const dw = lw || opp;
        if (!dw.isDoor(dw.len - 1)) { const [tx, ty] = dw.tile(dw.len - 1); if (!crateAt(tx, ty)) put(FR() < 0.5 ? 'plant' : 'tv', tx, ty, dw.a); }
        dressCorners(FR() < 0.5 ? 'dresser' : 'box');
      } else if (kind === 'hospital') {
        for (const q of W4) if (!q.door) { for (let i = 1; i < q.len - 1; i++) { const [tx, ty] = q.tile(i); put('hbed', tx, ty, q.a); } }
        dressCorners('medcab');
      } else if (kind === 'police') {
        const q = free.length ? pick(free) : null;
        if (q) put2('desk', q, 1);
        dressCorners('locker');
      } else if (kind === 'barracks') {
        for (const q of W4) if (!q.door && q.s < 2) { for (let i = 1; i < q.len - 1; i++) { const [tx, ty] = q.tile(i); put('bunk', tx, ty, q.a); } }
        dressCorners('ammo');
      } else if (kind === 'barn') {
        for (const q of W4) if (!q.door) { const [tx, ty] = q.tile(1); put('hay', tx, ty, q.a); }
        dressCorners('crate');
      } else if (kind === 'store') {
        const q = free.length ? pick(free) : W4[0];
        for (let i = 0; i < q.len; i++) { if (q.isDoor(i)) continue; const [tx, ty] = q.tile(i); loot(i === 0 ? 'shelf' : 'cooler', tx, ty, q.a, i === 0 ? 8 : 6); }
        dressCorners('supply');
      }
    };
    let townIdx = 0; const vextra = [];
    for (const o of pois) {
      const size = o.size, x0 = o.x - (size >> 1), y0 = o.y - (size >> 1);
      clearArea(x0, y0, size, size);
      if (o.kind === 'military') {
        for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) {
          const edge = x === x0 || y === y0 || x === x0 + size - 1 || y === y0 + size - 1;
          t[I(x, y)] = edge ? T_BWALL : T_CONC;
        }
        const mid = x0 + (size >> 1), my = y0 + (size >> 1);
        for (let k = -1; k <= 1; k++) { t[I(mid + k, y0)] = T_CONC; t[I(mid + k, y0 + size - 1)] = T_CONC; t[I(x0, my + k)] = T_CONC; t[I(x0 + size - 1, my + k)] = T_CONC; }
        building(x0 + 3, y0 + 3, 6, 5, T_CONC, 1, 3, 'barracks');
        building(x0 + size - 9, y0 + size - 8, 6, 5, T_CONC, 1, 3, 'barracks');
        for (let k = 0; k < 3; k++) { const cx = x0 + 3 + Math.floor(R() * (size - 6)), cy = y0 + 10 + Math.floor(R() * 4); if (t[I(cx, cy)] === T_CONC && !crates.some(c => c.tx === cx && c.ty === cy)) crates.push({ tx: cx, ty: cy, tier: 1, k: 'ammo', a: 0 }); }
        vspawns.push({ x: (x0 + 12) * TILE, y: (y0 + 5) * TILE, a: 0, type: 1 }, { x: (x0 + 6) * TILE, y: (y0 + size - 4) * TILE, a: 0, type: 1 });
        vextra.push({ x: (x0 + size - 5) * TILE, y: (y0 + 5) * TILE + 20, a: Math.PI / 2, type: 2 });
        labels.push({ x: o.x, y: y0 - 2, text: 'MILITARY BASE', kind: 'military' });
        continue;
      }
      if (o.kind === 'farm') {
        for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size - 7; x++) t[I(x, y)] = T_FARM;
        building(x0 + size - 6, y0 + 2, 6, 6, T_FLOOR, 4, 2, 'farmhouse');
        building(x0 + size - 6, y0 + 9, 6, 5, T_FLOOR, 0, 1, 'barn');
        vspawns.push({ x: (x0 + size - 3) * TILE, y: (y0 + 15) * TILE + 20, a: 0, type: 1 });
        labels.push({ x: o.x, y: y0 - 2, text: 'FARM', kind: 'farm' });
        continue;
      }
      if (o.kind === 'gas') {
        for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) t[I(x, y)] = T_CONC;
        building(x0 + 4, y0 + 1, 4, 4, T_FLOOR, 4, 1, 'store');
        pumps.push({ x: (x0 + 1) * TILE + 20, y: (y0 + 2) * TILE + 20 }, { x: (x0 + 1) * TILE + 20, y: (y0 + 5) * TILE + 20 });
        vspawns.push({ x: (x0 + 3) * TILE, y: (y0 + 6) * TILE + 20, a: -Math.PI / 2, type: 0 });
        labels.push({ x: o.x, y: y0 - 2, text: 'GAS', kind: 'gas' });
        continue;
      }
      // town
      const myIdx = townIdx++;
      const blocks = [];
      for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) {
        const rx = (x - x0) % 8, ry = (y - y0) % 8;
        if (rx < 2 || ry < 2) { t[I(x, y)] = T_ROAD; if (R() < 0.02) node[I(x, y)] = N_CAR; }
      }
      for (let by = y0 + 2; by + 6 <= y0 + size; by += 8) for (let bx = x0 + 2; bx + 6 <= x0 + size; bx += 8) blocks.push([bx, by]);
      for (let k = blocks.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [blocks[k], blocks[j]] = [blocks[j], blocks[k]]; }
      blocks.forEach(([bx, by], k) => {
        if (k === 0 && myIdx % 2 === 0) { building(bx, by, 6, 6, T_CONC, 2, 3, 'police'); labels.push({ x: bx + 3, y: by - 1, text: 'POLICE', kind: 'police' }); }
        else if (k === 1 && myIdx % 3 === 0) { building(bx, by, 6, 6, T_HOSP, 3, 3, 'hospital'); labels.push({ x: bx + 3, y: by - 1, text: 'HOSPITAL', kind: 'hospital' }); }
        else if (R() < 0.62) building(bx, by, 6, 6, T_FLOOR, 0, R() < 0.4 ? 2 : 1, 'house');
        else for (let q = 0; q < 2; q++) if (R() < 0.5) node[I(bx + 1 + Math.floor(R() * 4), by + 1 + Math.floor(R() * 4))] = R() < 0.5 ? N_TREE : N_ROCK;
      });
      vspawns.push({ x: (x0 + 8) * TILE + 40, y: (y0 + 4) * TILE, a: Math.PI / 2, type: 0 }, { x: (x0 + 4) * TILE, y: (y0 + 16) * TILE + 40, a: 0, type: R() < 0.3 ? 1 : 0 });
      vextra.push({ x: (x0 + 16) * TILE + 40, y: (y0 + 12) * TILE, a: Math.PI / 2, type: 3 });
      if (myIdx % 2 === 1) vextra.push({ x: (x0 + 24) * TILE + 40, y: (y0 + 20) * TILE, a: Math.PI / 2, type: myIdx % 4 === 1 ? 2 : 3 });
      labels.push({ x: o.x, y: y0 - 3, text: o.name.toUpperCase(), kind: 'town' });
    }
    for (const v of vextra) { v.extra = 1; vspawns.push(v); }
    // resource nodes in the wild
    for (let y = 2; y < MH - 2; y++) for (let x = 2; x < MW - 2; x++) {
      const i = I(x, y); if (town[i] || node[i]) continue;
      const v = t[i]; if (v !== T_GRASS && v !== T_FOREST && v !== T_SAND && v !== T_DESERT) continue;
      if (Math.hypot(x - C, y - C) < 7) continue;
      const rocky = nR(x / 10, y / 10) > 0.7, r = R();
      if (v === T_FOREST) { if (r < 0.22) node[i] = N_TREE; else if (r < 0.235) node[i] = N_ROCK; }
      else if (v === T_GRASS) { if (r < 0.025) node[i] = N_TREE; else if (r < (rocky ? 0.09 : 0.037)) node[i] = N_ROCK; else if (r < (rocky ? 0.093 : 0.039)) node[i] = N_CAR; }
      else if (v === T_DESERT) { if (r < 0.03) node[i] = N_ROCK; else if (r < 0.036) node[i] = N_CAR; else if (r < 0.042) node[i] = N_TREE; }
      else if (r < 0.012) node[i] = N_ROCK;
    }
    // map v3 landmarks: funfair, wind farm, lighthouses, radio towers, shipwrecks, graveyards, campsites
    const marks = [], lmCrates = [];
    if (mv >= 3) {
      const RL = rng((seed ^ 0x1A2D3) >>> 0);
      const LAND = v => v === T_GRASS || v === T_FOREST || v === T_DESERT || v === T_SAND;
      const used = (x, y, pad) => marks.some(m => x >= m.x - pad && x < m.x + m.w + pad && y >= m.y - pad && y < m.y + m.h + pad);
      const freeRect = (x0, y0, w, h, ok) => {
        for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
          if (!inb(x, y)) return false; const i = I(x, y), v = t[i];
          if (town[i] || v === T_ROAD || v === T_BWALL || v === T_FLOOR || v === T_CONC || v === T_HOSP || v === T_FARM || !ok(v) || used(x, y, 3)) return false;
        }
        return true;
      };
      const find = (w, h, ok, minPOI, test, tries) => {
        for (let k = 0; k < (tries || 900); k++) {
          const x = 6 + Math.floor(RL() * (MW - 12 - w)), y = 6 + Math.floor(RL() * (MH - 12 - h));
          if (Math.hypot(x + w / 2 - C, y + h / 2 - C) < 28) continue;
          if (pois.some(o => Math.hypot(o.x - x - w / 2, o.y - y - h / 2) < o.size / 2 + (minPOI || 6))) continue;
          if (test && !test(x, y)) continue;
          if (freeRect(x, y, w, h, ok)) return [x, y];
        }
        return null;
      };
      const clearR = (x0, y0, w, h, tt) => { for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) { if (!inb(x, y)) continue; const i = I(x, y); node[i] = 0; if (tt !== undefined && x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) t[i] = tt; } };
      const solidR = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) solid[I(x, y)] = 1; };
      const box = (tx, ty, tier, k, a) => { const i = I(tx, ty); if (t[i] === T_WATER) t[i] = T_SAND; node[i] = 0; lmCrates.push({ tx, ty, tier, k, a: a || 0 }); };
      const waterNear = (x, y, w, h, d) => { for (let yy = y - d; yy < y + h + d; yy++) for (let xx = x - d; xx < x + w + d; xx++) if (inb(xx, yy) && t[I(xx, yy)] === T_WATER) return true; return false; };
      const far = (k, x, y, d) => !marks.some(m => m.k === k && Math.hypot(m.x - x, m.y - y) < d);
      // FUNLAND: Ferris wheel, carousel and game stalls on a concrete plaza
      let s; for (let nf = 0; nf < (BIG ? 3 : 1); nf++) { s = find(14, 12, v => v === T_GRASS || v === T_DESERT || v === T_SAND, 10, (x, y) => far('fun', x, y, 150));
      if (s) {
        const [x, y] = s; clearR(x, y, 14, 12, T_CONC);
        solidR(x + 3, y + 3, 3, 1); solidR(x + 9, y + 3, 3, 3); for (const bx of [x + 2, x + 6, x + 10]) solidR(bx, y + 8, 2, 1);
        box(x + 2, y + 9, 8, 'shelf'); box(x + 6, y + 9, 2, 'ammo'); box(x + 10, y + 9, 8, 'shelf');
        marks.push({ k: 'fun', x, y, w: 14, h: 12 }); labels.push({ x: x + 7, y: y - 1, text: 'FUNLAND', kind: 'fun' });
      } }
      // wind farm
      for (let nw = 0; nw < (BIG ? 4 : 1); nw++) { s = find(26, 5, v => v === T_GRASS || v === T_DESERT, 6, (x, y) => far('wind', x, y, 120));
      if (s) { const [x, y] = s; clearR(x, y, 26, 5); for (let k = 0; k < 5; k++) solidR(x + 2 + k * 5, y + 2, 1, 1); marks.push({ k: 'wind', x, y, w: 26, h: 5 }); labels.push({ x: x + 13, y: y - 1, text: 'WIND FARM', kind: 'wind' }); } }
      // lighthouses — one on a sea island when there is one, the rest on the coast
      let nl = 0;
      const lightAt = (x, y) => {
        clearR(x, y, 2, 2); solidR(x, y, 2, 2); marks.push({ k: 'light', x, y, w: 2, h: 2 }); labels.push({ x: x + 1, y: y - 2, text: 'LIGHTHOUSE', kind: 'light' }); nl++;
        for (const [ox, oy] of [[-1, 0], [2, 0], [-1, 1], [2, 1], [0, 2], [1, 2], [0, -1], [1, -1]]) { const i = I(x + ox, y + oy); if (inb(x + ox, y + oy) && LAND(t[i]) && !solid[i]) { box(x + ox, y + oy, 2, 'locker'); break; } }
      };
      const sea = islands.filter(o => o.kind === 'sea');
      if (sea.length) { const o = sea[Math.floor(RL() * sea.length)], x = o.x + 1, y = o.y - 2; if ([[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => LAND(t[I(x + a, y + b)]))) lightAt(x, y); }
      for (let k = 0; k < (BIG ? 4000 : 900) && nl < (BIG ? 10 : 3); k++) { const q = find(2, 2, v => v === T_SAND || v === T_GRASS, 8, (x, y) => waterNear(x, y, 2, 2, 2) && far('light', x, y, 60), 1); if (q) lightAt(q[0], q[1]); }
      // radio towers (scan them for survivors)
      for (let n = 0; n < (BIG ? 7 : 2); n++) {
        s = find(5, 3, v => v === T_GRASS || v === T_DESERT || v === T_FOREST, 8, (x, y) => far('radio', x, y, 70)); if (!s) break;
        const [x, y] = s; clearR(x, y, 5, 3, t[I(x, y)] === T_DESERT ? T_DESERT : T_GRASS); solidR(x, y, 2, 2); solidR(x + 3, y, 2, 2); box(x + 3, y + 2, 2, 'locker');
        marks.push({ k: 'radio', x, y, w: 5, h: 3 }); labels.push({ x: x + 2, y: y - 1, text: 'RADIO TOWER', kind: 'radio' });
      }
      // shipwrecks run aground on a beach
      for (let n = 0, k = 0; k < (BIG ? 20000 : 3000) && n < (BIG ? 7 : 2); k++) {
        const vert = RL() < 0.5, w = vert ? 4 : 10, h = vert ? 10 : 4;
        const x = 6 + Math.floor(RL() * (MW - 12 - w)), y = 6 + Math.floor(RL() * (MH - 12 - h));
        let wat = 0, snd = 0, bad = false;
        for (let yy = y - 1; yy <= y + h && !bad; yy++) for (let xx = x - 1; xx <= x + w; xx++) { const i = I(xx, yy); if (town[i] || used(xx, yy, 4) || crateAt[i]) { bad = true; break; } const v = t[i]; if (v === T_WATER) wat++; else if (v === T_SAND || v === T_GRASS) snd++; else { bad = true; break; } }
        if (bad || wat < (w + 2) * (h + 2) * 0.3 || snd < (w + 2) * (h + 2) * 0.25) continue;
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { t[I(xx, yy)] = T_SAND; node[I(xx, yy)] = 0; }
        const flip = RL() < 0.5;
        if (vert) { solidR(x, y, 3, 10); box(x + 3, y + 2, 4, 'supply'); box(x + 3, y + 5, 1, 'ammo'); box(x + 3, y + 8, 4, 'supply'); }
        else { solidR(x, y, 10, 3); box(x + 2, y + 3, 4, 'supply'); box(x + 5, y + 3, 1, 'ammo'); box(x + 8, y + 3, 4, 'supply'); }
        marks.push({ k: 'wreck', x, y, w, h, vert, flip }); labels.push({ x: x + (w >> 1), y: y - 1, text: 'SHIPWRECK', kind: 'wreck' }); n++;
      }
      // graveyards
      for (let n = 0; n < (BIG ? 7 : 2); n++) {
        s = find(9, 7, v => v === T_GRASS || v === T_FOREST, 6, (x, y) => far('grave', x, y, 60)); if (!s) break;
        const [x, y] = s; clearR(x, y, 9, 7, T_GRASS);
        for (let j = 0; j < 3; j++) for (let i2 = 0; i2 < 3; i2++) solidR(x + 1 + i2 * 2, y + 1 + j * 2, 1, 1);
        solidR(x + 7, y + 1, 2, 2); box(x + 7, y + 5, 2, 'chest');
        marks.push({ k: 'grave', x, y, w: 9, h: 7 }); labels.push({ x: x + 4, y: y - 1, text: 'GRAVEYARD', kind: 'grave' });
      }
      // campsites in the woods
      for (let n = 0; n < (BIG ? 10 : 3); n++) {
        s = find(8, 6, v => v === T_FOREST || v === T_GRASS, 6, (x, y) => far('camp', x, y, 50)); if (!s) break;
        const [x, y] = s; clearR(x, y, 8, 6, T_GRASS);
        solidR(x + 1, y + 1, 2, 1); solidR(x + 5, y + 1, 2, 1); solidR(x + 1, y + 4, 2, 1); solidR(x + 4, y + 3, 1, 1); solidR(x + 5, y + 4, 2, 1);
        box(x + 7, y + 3, 6, 'cooler'); box(x + 3, y + 5, 4, 'supply');
        marks.push({ k: 'camp', x, y, w: 8, h: 6 }); labels.push({ x: x + 4, y: y - 1, text: 'CAMPSITE', kind: 'camp' });
      }
    }
    if (mv >= 4) {
      const RM = rng((seed ^ 0x3A11C) >>> 0);
      const LAND2 = v => v === T_GRASS || v === T_FOREST || v === T_DESERT || v === T_SAND;
      let nm = 0;
      for (let k = 0; k < 20000 && nm < (BIG ? 16 : 3); k++) {
        const x = 8 + Math.floor(RM() * (MW - 30)), y = 8 + Math.floor(RM() * (MH - 28));
        if (Math.hypot(x + 7 - C, y + 6 - C) < 40) continue;
        if (pois.some(o => Math.hypot(o.x - x - 7, o.y - y - 6) < o.size / 2 + 10)) continue;
        if (marks.some(m => Math.hypot(m.x - x, m.y - y) < (m.k === 'mil' ? 70 : 20))) continue;
        let ok = true;
        for (let yy = y - 1; yy <= y + 12 && ok; yy++) for (let xx = x - 1; xx <= x + 14; xx++) { const i = I(xx, yy); if (!inb(xx, yy) || town[i] || !LAND2(t[i]) || crateAt[i]) { ok = false; break; } }
        if (!ok) continue;
        for (let yy = y - 1; yy <= y + 12; yy++) for (let xx = x - 1; xx <= x + 14; xx++) { const i = I(xx, yy); node[i] = 0; if (xx >= x && xx < x + 14 && yy >= y && yy < y + 12 && t[i] === T_FOREST) t[i] = T_GRASS; }
        for (let yy = y + 1; yy <= y + 5; yy++) for (let xx = x + 8; xx <= x + 12; xx++) t[I(xx, yy)] = T_CONC; // helipad
        for (let xx = x; xx < x + 14; xx++) { if (xx !== x + 6 && xx !== x + 7) solid[I(xx, y + 11)] = 1; solid[I(xx, y)] = 1; } // sandbag walls, gate at the bottom
        for (let yy = y; yy < y + 12; yy++) { solid[I(x, yy)] = 1; solid[I(x + 13, yy)] = 1; }
        for (const [tx, ty] of [[x + 2, y + 2], [x + 2, y + 6]]) for (let yy = ty; yy < ty + 2; yy++) for (let xx = tx; xx < tx + 3; xx++) solid[I(xx, yy)] = 1; // tents
        solid[I(x + 12, y + 9)] = 1; // watchtower
        lmCrates.push({ tx: x + 6, ty: y + 2, tier: 1, k: 'ammo', a: 0 }, { tx: x + 6, ty: y + 3, tier: 1, k: 'ammo', a: 0 }, { tx: x + 6, ty: y + 7, tier: 2, k: 'locker', a: 0 }, { tx: x + 9, ty: y + 8, tier: 10, k: 'ammo', a: 0 }, { tx: x + 3, ty: y + 9, tier: 4, k: 'supply', a: 0 });
        const heli = nm % 2 === 0;
        vspawns.push({ x: (x + 10.5) * TILE, y: (y + 3.5) * TILE, a: -Math.PI / 2, type: heli ? 8 : 2, camp: 1 });
        marks.push({ k: 'mil', x, y, w: 14, h: 12, heli }); labels.push({ x: x + 7, y: y - 1, text: 'MILITARY CAMP', kind: 'military' }); nm++;
      }
    }
    const bunkers = [], bkCrates = []; let king = null;
    if (mv >= 2) {
      // the Zombie King's castle: walls around the biggest sea island
      const sea = islands.filter(o => o.kind === 'sea').sort((a, b) => b.r - a.r);
      if (sea.length) {
        const o = sea[0], R = o.r + 2, ga = Math.atan2(C - o.y, C - o.x);
        for (let oy = -R - 1; oy <= R + 1; oy++) for (let ox = -R - 1; ox <= R + 1; ox++) {
          const x = o.x + ox, y = o.y + oy; if (!inb(x, y)) continue; const i = I(x, y), d = Math.hypot(ox, oy);
          if (d < R - 0.5) { node[i] = 0; if (t[i] === T_WATER) t[i] = T_SAND; if (d < R - 1.5 && d > 1.2) t[i] = T_CONC; }
          else if (d < R + 0.6) { const gate = Math.abs(angDiff(Math.atan2(oy, ox), ga)) < 0.3; t[i] = gate ? T_FLOOR : T_BWALL; node[i] = 0; }
        }
        king = { x: o.x, y: o.y, r: R };
        labels.push({ x: o.x, y: o.y - R - 2, text: "ZOMBIE KING'S CASTLE", kind: 'military' });
      }
      // bunkers: concrete rooms out at sea, reached through a hatch on land (3 x 2 rooms, long side either way)
      const RK = rng((seed ^ 0xB0B0) >>> 0), LL = 26, SS = 12;
      const allW = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (!inb(x, y) || t[I(x, y)] !== T_WATER) return false; return true; };
      for (let k = 0; k < 9000 && bunkers.length < (BIG ? 4 : 2); k++) {
        const hor = RK() < 0.5, BW = hor ? LL : SS, BH = hor ? SS : LL;
        const x = 3 + Math.floor(RK() * (MW - BW - 6)), y = 3 + Math.floor(RK() * (MH - BH - 6));
        if (bunkers.some(b => x < b.x + b.w + 10 && b.x < x + BW + 10 && y < b.y + b.h + 10 && b.y < y + BH + 10)) continue;
        const wild = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { if (!inb(x, y)) return false; const i = I(x, y), v = t[i]; if (!(v === T_GRASS || v === T_FOREST || v === T_DESERT) || town[i] || solid[i] || crateAt[i]) return false; } return true; };
        if (!allW(x - 1, y - 1, BW + 2, BH + 2) && !(k > 5000 && Math.hypot(x - C, y - C) > 40 && wild(x - 2, y - 2, BW + 4, BH + 4))) continue;
        if (marks.some(m => Math.abs(m.x - x - BW / 2) < BW && Math.abs(m.y - y - BH / 2) < BH + 6)) continue;
        if (islands.some(o => Math.hypot(o.x - x - BW / 2, o.y - y - BH / 2) < o.r + 16)) continue;
        const P2 = (u, v) => hor ? [x + u, y + v] : [x + v, y + u]; // u along the long side, v across
        const set = (u, v, tt) => { const [xx, yy] = P2(u, v); t[I(xx, yy)] = tt; };
        const onLand = t[I(x, y)] !== T_WATER;
        for (let u = 0; u < LL; u++) for (let v = 0; v < SS; v++) { set(u, v, u === 0 || v === 0 || u === LL - 1 || v === SS - 1 ? T_BWALL : T_FLOOR); const [xx, yy] = P2(u, v); node[I(xx, yy)] = 0; }
        for (const wu of [9, 17]) for (let v = 0; v < SS; v++) if (v !== 2 && v !== 3 && v !== 8 && v !== 9) set(wu, v, T_BWALL);
        for (let u = 0; u < LL; u++) if (![4, 5, 12, 13, 21, 22].includes(u)) set(u, 6, T_BWALL);
        const rooms = [[4, 3], [13, 3], [21, 3], [4, 8], [13, 8], [21, 8]], tiers = [[], [2, 4], [10], [3, 1], [11], [11, 10]], mine = [];
        rooms.forEach(([ru, rv], ri) => tiers[ri].forEach((tr, q) => { const [tx, ty] = P2(ru - 2 + q * 4, rv); mine.push({ tx, ty, tier: tr, k: tr === 1 || tr === 10 ? 'ammo' : tr === 2 ? 'locker' : tr === 3 ? 'medcab' : 'crate', a: 0 }); }));
        let hx = -1, hy = -1;
        for (let q = 0; q < 4000 && hx < 0; q++) {
          const a = RK() * 6.283, d = 18 + RK() * (BIG ? 120 : 60), cx = Math.round(x + BW / 2 + Math.cos(a) * d), cy = Math.round(y + BH / 2 + Math.sin(a) * d);
          if (cx < 6 || cy < 6 || cx >= MW - 6 || cy >= MH - 6) continue;
          let ok = true; for (let oy = -2; oy <= 2 && ok; oy++) for (let ox = -2; ox <= 2; ox++) { const i = I(cx + ox, cy + oy), v = t[i]; if (!(v === T_GRASS || v === T_FOREST || v === T_DESERT || v === T_SAND) || town[i] || solid[i] || crateAt[i]) { ok = false; break; } }
          if (ok) { hx = cx; hy = cy; }
        }
        if (hx < 0) { for (let u = 0; u < LL; u++) for (let v = 0; v < SS; v++) set(u, v, onLand ? T_GRASS : T_WATER); continue; }
        for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) node[I(hx + ox, hy + oy)] = 0;
        const [lx, ly] = P2(2, 2), [bx2, by2] = P2(21, 8);
        bunkers.push({ x, y, w: BW, h: BH, lx, ly, bx: bx2, by: by2, hx, hy });
        for (const c of mine) bkCrates.push(c);
        marks.push({ k: 'hatch', x: hx, y: hy, b: bunkers.length - 1 });
        labels.push({ x: hx, y: hy - 2, text: 'BUNKER', kind: 'military' });
      }
    }
    // new interior loot spots go after the original ones so old saves keep their crate numbers
    for (const c of extra) crates.push(c);
    for (const o of islands) { t[I(o.x, o.y)] = T_SAND; crates.push({ tx: o.x, ty: o.y, tier: 12, k: 'chest', a: ((o.x * 7 + o.y * 13) % 628) / 100 }); } // sea chests (map v2 only)
    for (const c of lmCrates) crates.push(c); // landmark loot (map v3 only)
    for (const c of bkCrates) crates.push(c); // bunker loot (added last)
    for (const c of crates) { if (!c.k) c.k = c.tier === 1 ? 'ammo' : c.tier === 2 ? 'locker' : c.tier === 3 ? 'medcab' : c.tier === 4 ? 'supply' : 'crate'; if (c.a === undefined) c.a = 0; }
    crates.forEach((c, i) => { c.id = i; node[I(c.tx, c.ty)] = 0; solid[I(c.tx, c.ty)] = 1; crateAt[I(c.tx, c.ty)] = i + 1; furnAt[I(c.tx, c.ty)] = 0; });
    for (const v of vspawns) { const tx = Math.floor(v.x / TILE), ty = Math.floor(v.y / TILE); for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) if (inb(tx + ox, ty + oy)) node[I(tx + ox, ty + oy)] = 0; }
    let bd = 1e9; const spawn = { tx: C, ty: C };
    for (let y = C - 15; y < C + 15; y++) for (let x = C - 15; x < C + 15; x++) {
      if (t[I(x, y)] !== T_ROAD || node[I(x, y)]) continue;
      const d = Math.hypot(x - C, y - C); if (d < bd) { bd = d; spawn.tx = x; spawn.ty = y; }
    }
    // boats moored along the shore near towns (own random numbers, added last, so older saves stay the same)
    const RB = rng((seed ^ 0xB0A7) >>> 0), boatAt = [];
    const allWater = (x, y, rr) => { for (let oy = -rr; oy <= rr; oy++) for (let ox = -rr; ox <= rr; ox++) if (!inb(x + ox, y + oy) || t[I(x + ox, y + oy)] !== T_WATER) return false; return true; };
    const nearLand = (x, y, rr) => { for (let oy = -rr; oy <= rr; oy++) for (let ox = -rr; ox <= rr; ox++) if (inb(x + ox, y + oy) && t[I(x + ox, y + oy)] !== T_WATER) return [ox, oy]; return null; };
    pois.filter(o => o.kind === 'town' || o.kind === 'farm').forEach((o, oi) => {
      if (boatAt.length >= (BIG ? 20 : 6) || oi % 2) return;
      for (let ring = 6; ring <= 44; ring += 2) {
        let done = false;
        for (let k = 0; k < 24 && !done; k++) {
          const a = k / 24 * 6.283 + RB() * 0.2, x = Math.round(o.x + Math.cos(a) * ring), y = Math.round(o.y + Math.sin(a) * ring);
          if (!allWater(x, y, 1)) continue; const land = nearLand(x, y, 3); if (!land) continue;
          if (boatAt.some(b => Math.hypot(b[0] - x, b[1] - y) < 8)) continue;
          boatAt.push([x, y]); vspawns.push({ x: x * TILE + 20, y: y * TILE + 20, a: Math.atan2(-land[1], -land[0]), type: boatAt.length === 3 || boatAt.length === 6 ? 7 : 6, boat: 1 }); done = true;
          if (mv >= 3) { // a little wooden pier from the shore out towards the boat
            const dx = Math.abs(land[0]) >= Math.abs(land[1]) ? Math.sign(land[0]) : 0, dy = dx ? 0 : Math.sign(land[1]);
            for (let s2 = 2; s2 <= 6; s2++) { const px = x + dx * s2, py = y + dy * s2, i = I(px, py); if (!inb(px, py) || t[i] !== T_WATER) break; t[i] = T_FLOOR; }
          }
        }
        if (done) break;
      }
    });
    return { bunkers, king, seed, mv, t, node, towns: pois, crates, pumps, vspawns, labels, buildings, furn, solid, furnAt, crateAt, islands, marks, spawn: { x: spawn.tx * TILE + TILE / 2, y: spawn.ty * TILE + TILE / 2 } };
  }

  // ---------- shared world-state queries ----------
  // ws = { map, sType (Uint8Array per tile, building code), nodeAlive (Uint8Array) }
  function newWS(map) {
    const nodeAlive = new Uint8Array(MW * MH); for (let i = 0; i < MW * MH; i++) nodeAlive[i] = map.node[i] ? 1 : 0;
    return { map, sType: new Uint8Array(MW * MH), nodeAlive, doorOpen: new Uint8Array(MW * MH), fbroken: new Uint8Array(MW * MH) };
  }
  function blockedP(ws, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    const i = ty * MW + tx, t = ws.map.t[i];
    if (t === T_WATER || t === T_BWALL) return true;
    if (ws.nodeAlive[i] || (ws.map.solid[i] && !ws.fbroken[i])) return true;
    return SOLID_P[ws.sType[i]] === 1;
  }
  // players can swim: same as blockedP, but water is fine
  function blockedSw(ws, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    const i = ty * MW + tx, t = ws.map.t[i];
    if (t === T_BWALL) return true;
    if (ws.nodeAlive[i] || (ws.map.solid[i] && !ws.fbroken[i])) return true;
    return SOLID_P[ws.sType[i]] === 1;
  }
  function blockedZ(ws, tx, ty) {
    if (blockedP(ws, tx, ty)) return true;
    const i = ty * MW + tx;
    return DOORS[ws.sType[i]] === 1 && !ws.doorOpen[i];
  }
  // what you can't jump over: water, building walls, trees, and tall things people built
  const TALL = { 1: 1, 6: 1, 7: 1, 11: 1, 15: 1 };
  function blockedJ(ws, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    const i = ty * MW + tx, t = ws.map.t[i];
    if (t === T_WATER || t === T_BWALL) return true;
    if (ws.nodeAlive[i] && ws.map.node[i] === N_TREE) return true;
    return TALL[ws.sType[i]] === 1;
  }
  // zombie eyesight: building walls, trees, rocks and walls/closed doors people built block the view
  const SIGHT_BLOCK = { 1: 1, 2: 1, 6: 1, 11: 1, 12: 1 };
  function canSee(ws, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 20);
    for (let k = 1; k < n; k++) {
      const f = k / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      if (blocksBullet(ws, x, y)) return false;
      const i = Math.floor(y / TILE) * MW + Math.floor(x / TILE), st = ws.sType[i];
      if (SIGHT_BLOCK[st] && !(DOORS[st] && ws.doorOpen[i])) return false;
    }
    return true;
  }
  function blocksBullet(ws, x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    const i = ty * MW + tx;
    return ws.map.t[i] === T_BWALL || ws.nodeAlive[i] === 1;
  }
  function blocksLight(ws, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    return ws.map.t[ty * MW + tx] === T_BWALL;
  }
  function losClear(ws, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 16);
    for (let i = 1; i < n; i++) { const f = i / n; if (blocksBullet(ws, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)) return false; }
    return true;
  }
  function resolve(ws, p, r, pred) {
    for (let iter = 0; iter < 4; iter++) {
      const x0 = Math.floor((p.x - r) / TILE), x1 = Math.floor((p.x + r) / TILE), y0 = Math.floor((p.y - r) / TILE), y1 = Math.floor((p.y + r) / TILE);
      let moved = false;
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!pred(ws, tx, ty)) continue;
        const ax = tx * TILE, ay = ty * TILE;
        const cx = clamp(p.x, ax, ax + TILE), cy = clamp(p.y, ay, ay + TILE);
        const dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
        if (d2 < r * r - 0.01) {
          if (d2 > 1e-6) { const d = Math.sqrt(d2), push = r - d; p.x += dx / d * push; p.y += dy / d * push; }
          else { const l = p.x - ax, rr = ax + TILE - p.x, t = p.y - ay, b = ay + TILE - p.y, m = Math.min(l, rr, t, b); if (m === l) p.x = ax - r; else if (m === rr) p.x = ax + TILE + r; else if (m === t) p.y = ay - r; else p.y = ay + TILE + r; }
          moved = true;
        }
      }
      if (!moved) break;
    }
    p.x = clamp(p.x, r, WORLD - r); p.y = clamp(p.y, r, WORLD - r);
  }
  function moveCircle(ws, p, dx, dy, r, pred) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.5)));
    for (let i = 0; i < n; i++) { p.x += dx / n; p.y += dy / n; resolve(ws, p, r, pred); }
  }
  function overlaps(ws, x, y, r, pred) {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE), y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!pred(ws, tx, ty)) continue;
      const cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE);
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
    return false;
  }
  const playerSpeed = (sprint) => sprint ? 270 : 190;

  // ---------- the game ----------
  class Game {
    constructor(opts) {
      const save = opts.save || null;
      this.seed = (save ? save.seed : opts.seed) >>> 0;
      this.mv = save ? (save.mv || 1) : (opts.mv || 4);
      this.sz = sizeOf(this.mv); setSize(this.sz);
      this.map = makeWorldMap(this.seed, this.mv);
      this.kit = save ? (KITS[save.kit] ? save.kit : 'full') : 'fists'; // new worlds: fists and a can of beans
      this.evac = Object.assign({ fixed: 0, won: 0, next: 0 }, save && save.evac && typeof save.evac === 'object' ? { fixed: save.evac.fixed | 0, won: save.evac.won | 0, next: save.evac.next | 0 } : {}); this.evac.s = 0;
      this.dogs = []; this.fires = [];
      this.wx = { k: 0, until: this.time + 150 + Math.random() * 120, boltT: 5 };
      this.kingDead = save && save.kingDead ? 1 : 0; this.peaceUntil = save && save.peace ? this.time + save.peace : 0;
      this.bunkerDay = save && Array.isArray(save.bunkerDay) ? save.bunkerDay : [];
      this.job = null; this.jobs = []; this.jobDay = 0;
      this.haven = this.pickHaven();
      this.rescued = save && Array.isArray(save.rescued) ? save.rescued.filter(r => r && r.n && ROLES[r.role]) : [];
      this.ws = newWS(this.map);
      this.time = save ? (save.cyc === CYCLE ? save.time : save.time / OLD_CYCLE * CYCLE) : 20; // longer days: keep the same day number for older saves
      this.players = []; this.zombies = []; this.bullets = []; this.spits = []; this.events = []; this.vehicles = []; this.airdrops = []; this.grenades = []; this.rockets = [];
      this.rain = 0; this.rainT = 180; this.lastDropDay = 0; this.deerT = 0;
      this.structs = new Map(); this.structAt = new Int32Array(MW * MH);
      this.nodeHp = new Map(); this.removed = new Map(); this.furnHp = new Map(); this.fbroken = new Map();
      this.crateReady = new Float64Array(this.map.crates.length); this.crateOpen = new Uint8Array(this.map.crates.length);
      this.explored = new Uint8Array(MW * MH);
      this.profiles = save && save.players ? save.players : {};
      this.nextId = save && save.nextId ? save.nextId : 1;
      this.D = this.emptyDeltas();
      this.field = null; this.fieldT = 0; this.spawnT = 0; this.slowT = 0; this.hordeQueue = 0; this.hordeCenter = null; this.hordeT = 0;
      this.wasNight = this.isNight();
      if (save) this.loadSave(save);
      const mkVeh = (v, i) => this.vehicles.push({ id: this.nextId++, type: v.type, x: v.x, y: v.y, a: v.a, v: 0, hp: VT[v.type].hp, fuel: 30 + Math.floor(Math.random() * 50), driver: 0, gunner: 0, ta: v.a, heat: 0, over: false, color: CAR_COLORS[i % CAR_COLORS.length], runT: 0 });
      if (!save || !save.vehicles) this.map.vspawns.forEach(mkVeh);
      else if (!this.vehicles.some(v => v.type >= 2)) this.map.vspawns.forEach((v, i) => { if (v.extra) mkVeh(v, i); }); // older save: add the new gun trucks and bikes
      if (save && save.vehicles && !this.vehicles.some(v => VT[v.type] && VT[v.type].boat)) this.map.vspawns.forEach((v, i) => { if (v.boat) mkVeh(v, i); }); // older save: moor some boats
      this.heli = []; this.trader = null; this.bloodMoon = false; this.lastHeliDay = save && save.lastHeliDay || 0; this.lastTraderDay = save && save.lastTraderDay || 0; this.noiseT = 0; this.lastConvoyDay = save && save.lastConvoyDay || 0; this.lastJetDay = save && save.lastJetDay || 0; this.botCount = save && save.botCount || 0; this.lastSurvDay = save && save.lastSurvDay || 0; this.lastRadioDay = save && save.lastRadioDay || 0;
      this.D = this.emptyDeltas();
    }

    emptyDeltas() { return { sa: [], sr: [], sh: new Map(), nr: [], ng: [], co: [], cr: [], ex: [], fb: [], fr: [] }; }
    day() { return Math.floor(this.time / CYCLE) + 1; }
    tod() { return this.time % CYCLE; }
    isNight() { return this.tod() >= DAY_LEN; }
    ev(e) { this.events.push(e); }
    byId(id) { return this.players.find(p => p.id === id); }

    // ----- players -----
    addPlayer(id, name, bot) {
      let nm = String(name || 'Player').slice(0, 14);
      while (this.players.some(p => p.name.toLowerCase() === nm.toLowerCase())) nm = nm.slice(0, 12) + Math.floor(Math.random() * 9 + 1);
      const key = (bot ? 'bot:' : '') + nm.toLowerCase();
      const pr = this.profiles[key];
      const used = this.players.map(p => p.color);
      const color = P_COLORS.find(c => !used.includes(c)) || P_COLORS[id % P_COLORS.length];
      const p = {
        id, name: nm, key, color, x: this.map.spawn.x + (Math.random() - 0.5) * 60, y: this.map.spawn.y + (Math.random() - 0.5) * 60, a: 0, r: 15,
        lvl: 1, xp: 0, hp: 100, slots: new Array(NSLOTS).fill(null), sel: 0,
        hunger: 100, armor: 0, vehicle: 0, seat: 0, starveT: 0, down: false, downT: 0, revT: 0, perks: {}, perkPts: 0, perkOffer: null,
        fireCd: 0, reloadT: 0, healT: 0, dead: false, respawnT: 0, fs: 1, lastPosT: this.time, kills: 0,
        inp: { mx: 0, my: 0, a: 0, fire: false, sprint: false }, acts: [], expT: 0, br: 100, swim: false,
        st: pr && pr.st && typeof pr.st === 'object' ? Object.assign({}, pr.st) : {}, goal: pr ? (pr.g | 0) : 0,
      };
      p.inv = this.makeInv(p);
      if (bot) { p.bot = true; const lead = this.players.find(q => !q.bot && !q.dead); if (lead) { const sp = this.vehicleSpot(lead.x, lead.y, 16); if (sp) { p.x = sp.x; p.y = sp.y; } } }
      if (!pr && bot) { // bot starter kit
        p.slots[0] = { k: 'pistol', n: 1, m: 17 }; p.slots[1] = { k: 'axe', n: 1 }; p.slots[2] = { k: 'medkit', n: 1 }; p.slots[3] = { k: 'food', n: 2 };
        p.slots[HOTBAR] = { k: 'bullets', n: 60 };
      } else if (!pr && this.kit === 'full') {
        p.slots[0] = { k: 'axe', n: 1 }; p.slots[1] = { k: 'pistol', n: 1, m: 17 }; p.slots[2] = { k: 'hammer', n: 1 }; p.slots[3] = { k: 'medkit', n: 1 }; p.slots[4] = { k: 'food', n: 2 };
        p.slots[HOTBAR] = { k: 'bullets', n: 24 };
      } else if (!pr) { // you wake up with almost nothing
        if (this.kit === 'axe') { p.slots[0] = { k: 'axe', n: 1 }; p.slots[1] = { k: 'food', n: 1 }; } else p.slots[1] = { k: 'food', n: 1 };
      }
      if (pr) {
        Object.assign(p, { lvl: pr.lvl || 1, xp: pr.xp || 0, hp: pr.hp || maxHpOf(pr.lvl || 1), kills: pr.kills || 0, hunger: pr.hunger !== undefined ? pr.hunger : 100, armor: 0, cash: pr.cash | 0, unl: pr.unl && typeof pr.unl === 'object' ? pr.unl : {}, skin: pr.skin && typeof pr.skin === 'object' ? { h: SKINS[pr.skin.h] ? pr.skin.h : 'cap', o: SKINS[pr.skin.o] ? pr.skin.o : 'default' } : { h: 'cap', o: 'default' } });
        let psl = pr.slots;
        if (Array.isArray(psl) && psl.length === 24) { const ns = new Array(NSLOTS).fill(null); psl.forEach((it, i) => { ns[i < 6 ? i : i - 6 + HOTBAR] = it; }); psl = ns; } // older 6+18 layout
        if (Array.isArray(psl)) psl.slice(0, NSLOTS).forEach((it, i) => { if (it && it.k && (WEAPONS[it.k] || STACK[it.k]) && !(WEAPONS[it.k] && WEAPONS[it.k].noItem)) p.slots[i] = { k: it.k, n: Math.max(1, Math.min(stackOf(it.k), it.n | 0)), m: it.m, r: WEAPONS[it.k] ? clamp(it.r | 0, 0, 3) : 0, at: WEAPONS[it.k] ? (it.at | 0) & 7 : 0 }; });
        else { // older save: guns list + counters
          let i = 0; for (const g of pr.guns || []) if (WEAPONS[g] && i < HOTBAR) p.slots[i++] = { k: g, n: 1, m: (pr.mags || {})[g] || 0 };
          for (const k in pr.inv || {}) if (STACK[k] && pr.inv[k] > 0) this.invAdd(p, k, pr.inv[k], true);
        }
        p.sel = Math.min(HOTBAR - 1, pr.sel || 0);
        if (Array.isArray(pr.perks)) { for (const k of pr.perks) if (PERKS[k]) p.perks[k] = 1; p.perkPts = Math.max(0, pr.perkPts | 0); }
        else p.perkPts = Math.min(PERK_KEYS.length, p.lvl - 1); // older save: catch up on perks
        if (this.kit === 'full' && !p.slots.some(it => it && it.k === 'hammer')) this.invAdd(p, 'hammer', 1, true);
        if (typeof pr.x === 'number' && !(bot && p.x !== this.map.spawn.x)) { p.x = pr.x; p.y = pr.y; }
        if (p.hp <= 0) p.hp = this.maxHp(p);
        p.hp = Math.min(p.hp, this.maxHp(p));
      }
      if (p.cash === undefined) p.cash = 0; if (!p.unl) p.unl = {}; if (!p.skin) p.skin = { h: bot ? ['cap', 'beanie', 'helmet', 'hood'][p.id % 4] : 'cap', o: 'default' };
      resolve(this.ws, p, p.r, blockedSw);
      this.players.push(p);
      if (!bot) { this.dogs = this.dogs.filter(d => d.owner !== key); if (pr && pr.dog && pr.dog.n) this.dogs.push(this.newDog(p.x + 30, p.y + 10, key, String(pr.dog.n).slice(0, 12), pr.dog.hp)); }
      this.ev({ e: 'join', n: p.name, g: 1 });
      return p;
    }
    saveProfile(p) { const dg = this.dogs.find(d => d.owner === p.key); this.profiles[p.key] = { dog: dg ? { n: dg.name, hp: Math.round(Math.max(60, dg.hp)) } : null, lvl: p.lvl, xp: p.xp, hp: p.dead || p.down ? Math.round(this.maxHp(p) * 0.5) : Math.ceil(p.hp), x: Math.round(p.x), y: Math.round(p.y), slots: p.slots.map(it => it ? { k: it.k, n: it.n, m: it.m, r: it.r || 0, at: it.at || 0 } : null), sel: p.sel, kills: p.kills, hunger: Math.round(p.hunger), perks: Object.keys(p.perks), perkPts: p.perkPts, st: p.st, g: p.goal, cash: p.cash | 0, unl: p.unl, skin: p.skin }; }
    maxHp(p) { return maxHpOf(p.lvl) + (p.perks && p.perks.tough ? 30 : 0); }
    gunOf(it) { return it && WEAPONS[it.k] ? gunStats(it.k, it.r, it.at) : WEAPONS.fists; }
    pickPerk(p, k) {
      if (!p.perkPts || !p.perkOffer || !p.perkOffer.includes(k) || p.perks[k]) return;
      p.perks[k] = 1; p.perkPts--; p.perkOffer = null;
      if (k === 'tough') p.hp = Math.min(this.maxHp(p), p.hp + 30);
      this.ev({ e: 'perk', id: p.id, k, n: p.name, x: p.x, y: p.y });
      this.offerPerks(p);
    }
    offerPerks(p) {
      if (p.perkOffer || p.perkPts <= 0) return;
      const left = PERK_KEYS.filter(k => !p.perks[k]);
      if (!left.length) { p.perkPts = 0; return; }
      for (let i = left.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [left[i], left[j]] = [left[j], left[i]]; }
      p.perkOffer = left.slice(0, 3);
    }

    // ----- inventory -----
    // p.inv.wood etc. reads the total in all slots; "p.inv.wood += 3" adds (overflow drops on the ground), "-=" takes
    makeInv(p) {
      const g = this;
      return new Proxy({}, {
        get(_, k) { return typeof k === 'string' ? g.invCount(p, k) : undefined; },
        set(_, k, v) { const cur = g.invCount(p, k); if (v > cur) g.invAdd(p, k, v - cur); else if (v < cur) g.invTake(p, k, cur - v); return true; },
      });
    }
    invCount(p, k) { let n = 0; for (const it of p.slots) if (it && it.k === k) n += it.n; return n; }
    invAdd(p, k, n, quiet, m, r, at) {
      const max = stackOf(k);
      if (max > 1) for (const it of p.slots) { if (n <= 0) break; if (it && it.k === k && it.n < max) { const add = Math.min(n, max - it.n); it.n += add; n -= add; } }
      const order = [];
      for (let i = 0; i < NSLOTS; i++) order.push(i);
      if (!WEAPONS[k]) { order.splice(0, HOTBAR); for (let i = 0; i < HOTBAR; i++) order.push(i); } // resources go to the backpack first
      for (const i of order) { if (n <= 0) break; if (!p.slots[i]) { const add = Math.min(n, max); p.slots[i] = { k, n: add, m, r: r || 0, at: at || 0 }; n -= add; } }
      if (n > 0) { this.dropGround(k, n, p.x, p.y, m, r, at); if (!quiet) this.ev({ e: 'full', id: p.id }); }
      return n;
    }
    invTake(p, k, n) {
      for (let i = NSLOTS - 1; i >= 0 && n > 0; i--) { const it = p.slots[i]; if (it && it.k === k) { const t = Math.min(n, it.n); it.n -= t; n -= t; if (it.n <= 0) p.slots[i] = null; } }
      return n <= 0;
    }
    dropGround(k, n, x, y, m, r, at) {
      if (!this.ground) this.ground = [];
      this.ground.push({ id: this.nextId++, k, n, m, r: r || 0, at: at || 0, x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, until: this.time + 600 });
      if (this.ground.length > 300) this.ground.shift();
    }
    heldSlot(p) { const it = p.slots[p.sel]; return it || null; }
    held(p) { const it = p.slots[p.sel]; return it && WEAPONS[it.k] ? it.k : 'fists'; }
    moveSlot(p, a, b) {
      if (a === b || a < 0 || b < 0 || a >= NSLOTS || b >= NSLOTS) return;
      const A = p.slots[a], B = p.slots[b]; if (!A) return;
      if (B && ATT[A.k] && WEAPONS[B.k] && !WEAPONS[B.k].melee) { // drop an attachment onto a gun to fit it
        const bit = ATT[A.k]; if (B.at & bit) return;
        B.at = (B.at || 0) | bit; A.n--; if (A.n <= 0) p.slots[a] = null;
        this.ev({ e: 'attach', id: p.id, k: A.k, g: fullName(B.k, B.r), x: p.x, y: p.y }); return;
      }
      if (B && B.k === A.k && stackOf(A.k) > 1) { const add = Math.min(A.n, stackOf(A.k) - B.n); B.n += add; A.n -= add; if (A.n <= 0) p.slots[a] = null; }
      else { p.slots[a] = B; p.slots[b] = A; }
      p.reloadT = 0;
    }
    // ----- bot survivors -----
    setBots(n) {
      n = clamp(n | 0, 0, 4); this.botCount = n;
      const bots = this.players.filter(p => p.bot && !p.rescued);
      for (let i = bots.length; i < n; i++) { const nm = BOT_NAMES.find(b => !this.players.some(p => p.name === b)) || 'Bot'; this.addPlayer(100000 + (this.botSeq = (this.botSeq || 0) + 1), nm, true); }
      for (const b of bots.slice(n)) this.removePlayer(b.id);
      this.syncRescued();
    }
    // rescued survivors who travel with you (up to 4 — the rest stay at camp and send supplies every morning)
    syncRescued() {
      if (!this.players.some(q => !q.bot)) return;
      for (const rec of this.rescued) if (rec.on && !this.players.some(q => q.rescued && q.name === rec.n)) this.addRescued(rec);
    }
    addRescued(rec, x, y) {
      const fresh = !this.profiles['bot:' + String(rec.n).toLowerCase()];
      const p = this.addPlayer(200000 + (this.survSeq = (this.survSeq || 0) + 1), rec.n, true);
      p.rescued = true; p.role = rec.role; rec.n = p.name;
      if (fresh) {
        const R0 = ROLES[rec.role]; p.slots = new Array(NSLOTS).fill(null);
        R0.kit.forEach(([k, n], i) => { p.slots[i] = WEAPONS[k] ? { k, n: 1, m: gunStats(k, 1, 0).mag, r: 1, at: 0 } : { k, n: n || 1 }; });
        p.slots[HOTBAR] = { k: 'bullets', n: R0.ammo || 90 }; if (R0.bolts) p.slots[HOTBAR + 1] = { k: 'bolts', n: R0.bolts };
      }
      if (typeof x === 'number') { p.x = x; p.y = y; resolve(this.ws, p, p.r, blockedSw); }
      return p;
    }
    rescue(p, h) {
      const b = h.boxes[0]; if (b.open || !h.sv) return;
      b.open = 1; h.until = Math.min(h.until, this.time + 45);
      const rec = { n: h.sv.n, role: h.sv.role, on: this.players.filter(q => q.rescued).length < 4 ? 1 : 0 };
      this.rescued.push(rec);
      const R0 = ROLES[rec.role]; for (const k in R0.gift) this.invAdd(p, k, R0.gift[k]);
      this.addXp(p, 90);
      if (rec.on) this.addRescued(rec, b.x, b.y);
      this.ev({ e: 'rescue', g: 1, n: rec.n, role: R0.name, by: p.name, id: p.id, camp: rec.on ? 0 : 1, say: R0.say, gift: Object.keys(R0.gift).map(k => R0.gift[k] + ' ' + itemName(k)).join(', '), x: b.x, y: b.y, tot: this.rescued.length });
    }
    // goals: check progress once a second and hand out rewards
    goalProgress(p) {
      const G = GOALS[p.goal]; if (!G) return null;
      const [cur, need] = G.f(this, p); return [Math.max(0, Math.min(need, cur | 0)), need];
    }
    checkGoals(p) {
      if (p.bot || p.dead) return;
      while (GOALS[p.goal] && GOALS[p.goal].isl && !this.map.islands.length) p.goal++;
      const G = GOALS[p.goal]; if (!G) return;
      const [cur, need] = this.goalProgress(p); if (cur < need) return;
      const got = []; for (const k in G.r.give) { this.invAdd(p, k, G.r.give[k]); got.push(G.r.give[k] + ' ' + itemName(k)); }
      this.addXp(p, G.r.xp); got.push(G.r.xp + ' XP');
      this.ev({ e: 'goal', id: p.id, n: p.goal + 1, of: GOALS.length, t: G.t, rw: got.join(', '), last: p.goal + 1 >= GOALS.length ? 1 : 0 });
      p.goal++;
    }
    botTarget(b) {
      let best = null, bd = 580;
      for (const z of this.zombies) {
        if (z.hp <= 0 || z.type === 7) continue;
        const d = Math.hypot(z.x - b.x, z.y - b.y); if (d >= bd) continue;
        if (d > 80 && !canSee(this.ws, b.x, b.y, z.x, z.y)) continue;
        bd = d; best = z;
      }
      return best;
    }
    botWeapon(b, d) { // pick the best thing in the hotbar for this distance (pull good guns out of the backpack)
      let best = -1, bs = -1, bestBp = -1, bsBp = -1;
      b.slots.forEach((it, i) => {
        if (!it || !WEAPONS[it.k] || it.k === 'hammer') return;
        const G = this.gunOf(it); let sc;
        if (G.melee) sc = G.dmg * 0.6;
        else {
          if ((it.m || 0) <= 0 && b.inv[ammoOf(it.k)] <= 0) return;
          if (G.proj && d < 170) return; if (G.flame && d > 230) return;
          sc = G.dmg * G.pellets / G.rate * (G.proj ? 3 : 1) + 40;
        }
        if (i < HOTBAR) { if (sc > bs) { bs = sc; best = i; } } else if (sc > bsBp) { bsBp = sc; bestBp = i; }
      });
      if (bestBp >= 0 && bsBp > bs * 1.15) { const e = b.slots.findIndex((it, j) => j < HOTBAR && !it); b.acts.push('mv:' + bestBp + ':' + (e >= 0 ? e : HOTBAR - 1)); }
      return best;
    }
    botSpotNear(q) { const sp = this.vehicleSpot(q.x, q.y, 16); return sp; }
    updateBots(dt) {
      const bots = this.players.filter(p => p.bot); if (!bots.length) return;
      const humans = this.players.filter(p => !p.bot && !p.dead);
      bots.forEach((b, bi) => {
        const B = b.brain || (b.brain = { stuck: 0, side: 1, sideT: 0, task: -1, taskT: 0, talkT: 0, ammoT: 0, tgtT: 0, tgt: null, look: Math.random() * 6, stuckN: 0 });
        const inp = b.inp; inp.fire = false; inp.hold = false; inp.sprint = false; inp.mx = 0; inp.my = 0; inp.ga = null; inp.jmp = 0;
        if (b.dead) return;
        const say = (t) => { if (this.time > B.talkT) { B.talkT = this.time + 9; this.chat(b.id, t); } };
        B.ammoT += dt; if (B.ammoT > 1.5) { B.ammoT = 0; if (b.inv.bullets < 40) b.inv.bullets++; } // they scrounge a little
        if (b.perkPts > 0) { this.offerPerks(b); if (b.perkOffer) this.pickPerk(b, b.perkOffer[Math.floor(Math.random() * b.perkOffer.length)]); }
        let leader = null, ld = 1e9; for (const h of humans) { const d = Math.hypot(h.x - b.x, h.y - b.y); if (d < ld) { ld = d; leader = h; } }
        B.tgtT -= dt; if (B.tgtT <= 0) { B.tgtT = 0.2; B.tgt = this.botTarget(b); }
        const zt = B.tgt && B.tgt.hp > 0 ? B.tgt : null, zd = zt ? Math.hypot(zt.x - b.x, zt.y - b.y) : 999;
        // riding
        if (b.vehicle) {
          const veh = this.vehicles.find(v => v.id === b.vehicle);
          if (b.seat === 1 && zt) { inp.a = Math.atan2(zt.y - b.y, zt.x - b.x); inp.fire = true; }
          if (!leader || leader.vehicle !== b.vehicle || !veh) b.acts.push('use');
          return;
        }
        let gx = null, gy = null, face = null, crawl = false;
        if (b.down) {
          crawl = true;
          if (!B.saidDown) { B.saidDown = true; say(['I\'m down! Help!', 'Need a hand here!', 'They got me — revive me!'][Math.floor(Math.random() * 3)]); }
          const helper = this.players.some(q => q !== b && !q.dead && !q.down && Math.hypot(q.x - b.x, q.y - b.y) < 260);
          inp.hold = b.inv.medkit > 0 && (!helper || b.downT < 14);
          const hs = this.heldSlot(b); if (!(hs && ONE_HAND[hs.k])) { const i = b.slots.findIndex((it, j) => j < HOTBAR && it && ONE_HAND[it.k]); if (i >= 0 && i !== b.sel) b.acts.push('w:' + i); }
          if (zt) { face = zt; inp.fire = zd < 520; }
          if (leader) { gx = leader.x; gy = leader.y; }
        } else {
          B.saidDown = false;
          let downed = null, dd = 800; for (const q of this.players) if (q !== b && q.down) { const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < dd) { dd = d; downed = q; } }
          if (downed && !(zt && zd < 100)) {
            if (dd < 44) { inp.hold = true; face = downed; if (!B.saidRev) { B.saidRev = true; say(['Hang on, I got you!', 'Up you get!', 'Covering you — getting you up!'][Math.floor(Math.random() * 3)]); } }
            else { gx = downed.x; gy = downed.y; }
          } else B.saidRev = false;
          if (b.hp < this.maxHp(b) * 0.45 && b.inv.medkit > 0 && b.healT <= 0 && !(zt && zd < 220)) b.acts.push('heal');
          if (b.hunger < 35) b.acts.push('eat');
          if (leader && leader.vehicle && gx === null) { // hop on the gun if the leader drives an armed vehicle
            const lv = this.vehicles.find(v => v.id === leader.vehicle);
            if (lv && VT[lv.type].gun && !lv.gunner && lv.driver === leader.id) { const d = Math.hypot(lv.x - b.x, lv.y - b.y); if (d < 600) { if (d < 70) { this.enterVehicle(b, lv); if (b.vehicle) say('On the gun!'); return; } gx = lv.x; gy = lv.y; } }
          }
          const want = this.botWeapon(b, zd); if (want >= 0 && want !== b.sel) b.acts.push('w:' + want);
          if (zt && !inp.hold) {
            face = zt;
            const G = this.gunOf(this.heldSlot(b)), a = Math.atan2(zt.y - b.y, zt.x - b.x), aligned = Math.abs(angDiff(a, b.a)) < 0.3;
            if (G.melee) { inp.fire = zd < G.range + zt.r + 8; if (gx === null) { gx = zt.x; gy = zt.y; } }
            else {
              const range = G.flame ? 225 : Math.min(560, G.speed * G.life * 0.85);
              inp.fire = aligned && zd < range && !(G.proj && zd < 160);
              if (gx === null) { if (zd < 120) { gx = b.x - Math.cos(a) * 120; gy = b.y - Math.sin(a) * 120; } else if (zd > range * 0.85) { gx = zt.x; gy = zt.y; } }
            }
            if (!B.saidSee && zt.type >= 6 && zt.type !== 7 && zt.type !== 8) { B.saidSee = true; say(zt.type === 6 ? 'ABOMINATION! Focus fire!' : zt.type === 9 ? 'Screamer! Shut it up!' : zt.type === 10 ? 'Juggernaut — use explosives!' : 'Big one incoming!'); }
          } else if (!zt) B.saidSee = false;
          if (!zt && gx === null && !inp.hold) {
            if (B.task >= 0 && this.time < B.taskT && !this.crateOpen[B.task]) {
              const c = this.map.crates[B.task], cx = c.tx * TILE + 20, cy = c.ty * TILE + 20;
              if (Math.hypot(cx - b.x, cy - b.y) < 62) { this.crateOpen[B.task] = 1; this.crateReady[B.task] = this.time + 360; this.D.co.push(B.task); this.loot(b, c.tier, cx, cy); B.task = -1; }
              else { gx = cx; gy = cy; }
            } else if (leader && Math.random() < dt * 0.6) {
              B.task = -1; let bd = 340;
              this.map.crates.forEach((c, i) => { if (this.crateOpen[i]) return; const cx = c.tx * TILE + 20, cy = c.ty * TILE + 20, d = Math.hypot(cx - b.x, cy - b.y); if (d < bd && Math.hypot(cx - leader.x, cy - leader.y) < 520) { bd = d; B.task = i; } });
              if (B.task >= 0) B.taskT = this.time + 9;
            }
            if (gx === null && leader) { // keep formation behind the leader
              const slot = leader.a + Math.PI + (bi - (bots.length - 1) / 2) * 0.8, fx = leader.x + Math.cos(slot) * 80, fy = leader.y + Math.sin(slot) * 80;
              if (Math.hypot(fx - b.x, fy - b.y) > 55) { gx = fx; gy = fy; }
            }
          }
          if (leader && ld > (leader.vehicle ? 2200 : 1500)) { const sp = this.botSpotNear(leader); if (sp) { b.x = sp.x; b.y = sp.y; B.stuckN = 0; return; } }
        }
        if (gx !== null) {
          let dir = Math.atan2(gy - b.y, gx - b.x); const dist = Math.hypot(gx - b.x, gy - b.y);
          if (B.sideT > 0) { B.sideT -= dt; dir += B.side * 1.1; }
          const G = this.gunOf(this.heldSlot(b)), spd = crawl ? (b.perks.second ? 85 : 60) : playerSpeed(dist > 260 && !zt) * (G.heavy || 1) * (b.perks.runner ? 1.12 : 1) * 0.96;
          const ox = b.x, oy = b.y, step = Math.min(dist, spd * dt);
          moveCircle(this.ws, b, Math.cos(dir) * step, Math.sin(dir) * step, b.r, blockedP);
          const moved = Math.hypot(b.x - ox, b.y - oy);
          if (moved < step * 0.35 && step > 1) { B.stuck += dt; if (B.stuck > 0.45) { B.stuck = 0; B.side = Math.random() < 0.5 ? 1 : -1; B.sideT = 0.8; B.stuckN++; } } else { B.stuck = Math.max(0, B.stuck - dt); if (moved > step * 0.8) B.stuckN = Math.max(0, B.stuckN - dt); }
          if (B.stuckN > 7 && leader && ld > 250) { const sp = this.botSpotNear(leader); if (sp) { b.x = sp.x; b.y = sp.y; } B.stuckN = 0; }
          inp.mx = Math.cos(dir); inp.my = Math.sin(dir); inp.sprint = dist > 260 && !zt && !crawl;
          if (!face) inp.a = dir;
        } else if (!face) { B.look += dt * 0.4 * Math.sin(this.time * 0.3 + bi); inp.a = leader ? Math.atan2(b.y - leader.y, b.x - leader.x) + Math.sin(B.look) * 0.8 : B.look; }
        if (face) { const a = Math.atan2(face.y - b.y, face.x - b.x); inp.a = b.a + angDiff(a, b.a) * Math.min(1, dt * 12) + (Math.random() - 0.5) * 0.04; }
      });
    }
    removePlayer(id) {
      const p = this.byId(id); if (!p) return;
      this.exitVehicle(p);
      this.saveProfile(p); this.players = this.players.filter(q => q !== p);
      this.ev({ e: 'leave', n: p.name, g: 1 });
    }

    input(id, d) {
      const p = this.byId(id); if (!p || !d) return;
      const inp = p.inp;
      if (typeof d.a === 'number' && isFinite(d.a)) inp.a = d.a;
      if (typeof d.mx === 'number') inp.mx = clamp(d.mx, -1, 1);
      if (typeof d.my === 'number') inp.my = clamp(d.my, -1, 1);
      inp.fire = !!d.fire; inp.sprint = !!d.sprint; inp.hold = !!d.hold; inp.jmp = typeof d.jmp === 'number' && isFinite(d.jmp) ? clamp(d.jmp, 0, 1) : 0; inp.ga = typeof d.ga === 'number' && isFinite(d.ga) ? d.ga : null; inp.ad = typeof d.ad === 'number' && isFinite(d.ad) ? clamp(d.ad, 40, 600) : 300;
      if (d.car && typeof d.car.a === 'number' && isFinite(d.car.a) && typeof d.car.v === 'number' && isFinite(d.car.v)) { inp.ca = d.car.a; inp.cv = clamp(d.car.v, -200, 1150); inp.thr = !!d.car.thr; inp.alt = typeof d.car.alt === 'number' && isFinite(d.car.alt) ? clamp(d.car.alt, 0, 1) : 0; }
      inp.f2 = !!d.f2;
      if (Array.isArray(d.acts)) for (const a of d.acts.slice(0, 10)) if (typeof a === 'string' && a.length < 40) p.acts.push(a);
      if (typeof d.x === 'number' && typeof d.y === 'number') this.clientPos(p, d.x, d.y);
    }
    clientPos(p, x, y) {
      if (p.dead || !isFinite(x) || !isFinite(y) || (p.vehicle && p.seat === 1)) return;
      const dt = Math.max(0, this.time - p.lastPosT);
      const veh = p.vehicle ? this.vehicles.find(v => v.id === p.vehicle) : null;
      const allowed = (veh ? (VT[veh.type].jet ? 1300 : veh.up & 16 ? 1150 : 700) : 270 * 1.35) * (dt + 0.15) + 30;
      const d = Math.hypot(x - p.x, y - p.y);
      const pred = veh ? vehBlock(veh.type, p.inp.alt || 0) : p.inp.jmp > 0 ? blockedJ : blockedSw;
      if (d > allowed || overlaps(this.ws, x, y, (veh ? VT[veh.type].r : p.r) * 0.8, pred)) { p.fs++; p.lastPosT = this.time; if (veh) for (const q of this.players) if (q.vehicle === veh.id && q !== p) q.fs++; return; }
      p.x = x; p.y = y; p.lastPosT = this.time;
      if (veh && VT[veh.type].boat && p.seat === 0) p.st.sailed = (p.st.sailed || 0) + d; else if (!veh && p.swim) p.st.swam = (p.st.swam || 0) + d;
      if (veh) {
        veh.fuel = Math.max(0, veh.fuel - d * (VT[veh.type].nofuel ? 0 : VT[veh.type].heli ? 0.0022 : VT[veh.type].boat ? 0.0025 : VT[veh.type].bike ? 0.002 : VT[veh.type].jet ? 0.0011 : VT[veh.type].tank ? 0.003 : 0.0035));
        veh.x = x; veh.y = y;
        if (typeof p.inp.ca === 'number') { veh.a = p.inp.ca; veh.v = veh.fuel <= 0 && p.inp.thr ? Math.min(veh.v, p.inp.cv) : p.inp.cv; }
        if (VT[veh.type].jet || VT[veh.type].heli) veh.alt = p.inp.alt || 0;
      }
    }
    // ----- vehicles -----
    enterVehicle(p, veh) {
      if (veh.hp <= 0 || p.down) return;
      if (!veh.driver) { veh.driver = p.id; p.seat = 0; }
      else if (VT[veh.type].gun && !veh.gunner) { veh.gunner = p.id; p.seat = 1; }
      else return;
      p.vehicle = veh.id; p.x = veh.x; p.y = veh.y; p.fs++; p.lastPosT = this.time; p.reloadT = 0; p.healT = 0;
      this.ev({ e: 'carin', id: p.id, x: veh.x, y: veh.y, vid: veh.id, seat: p.seat, t: veh.type });
    }
    exitVehicle(p, force) {
      if (!p.vehicle) return;
      const veh = this.vehicles.find(v => v.id === p.vehicle);
      if (veh && !force && (VT[veh.type].jet || VT[veh.type].heli) && (veh.alt > 0.05 || Math.abs(veh.v) > 90)) { this.ev({ e: 'landfirst', id: p.id }); return; }
      p.vehicle = 0; const wasGunner = p.seat === 1; p.seat = 0;
      if (veh) {
        if (wasGunner) veh.gunner = 0; else { veh.driver = 0; veh.v = 0; }
        let ok = false;
        for (const [pred, dist] of [[blockedP, 42], [blockedP, 64], [blockedSw, 42]]) { // hop onto land if there is some, else into the water
          for (const side of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
            const x = veh.x + Math.cos(veh.a + side) * dist, y = veh.y + Math.sin(veh.a + side) * dist;
            if (!overlaps(this.ws, x, y, p.r, pred)) { p.x = x; p.y = y; ok = true; break; }
          }
          if (ok) break;
        }
        if (!ok) { p.x = veh.x; p.y = veh.y; resolve(this.ws, p, p.r, blockedSw); }
      }
      p.fs++; p.lastPosT = this.time;
      this.ev({ e: 'carout', id: p.id, x: p.x, y: p.y });
    }
    damageVehicle(veh, dmg) {
      if (veh.hp <= 0) return;
      const drv = veh.driver ? this.byId(veh.driver) : null;
      veh.hp -= dmg * (drv && drv.perks.road ? 0.5 : 1) * (veh.up & 2 ? 0.6 : 1);
      if (veh.hp <= 0) {
        veh.hp = 0;
        const drv = veh.driver ? this.byId(veh.driver) : null, gun = veh.gunner ? this.byId(veh.gunner) : null;
        if (drv) this.exitVehicle(drv, true); if (gun) this.exitVehicle(gun, true);
        this.explode(veh.x, veh.y);
        this.vehicles = this.vehicles.filter(v => v !== veh);
        this.ev({ e: 'carboom', x: veh.x, y: veh.y });
      }
    }
    updateVehicles(dt) {
      for (const veh of this.vehicles) {
        const T2 = VT[veh.type];
        if (veh.heat) { veh.heat = Math.max(0, veh.heat - 24 * dt); if (veh.over && veh.heat < 35) veh.over = false; }
        if (veh.gunner) { const g = this.byId(veh.gunner); if (!g || g.dead || g.vehicle !== veh.id) { veh.gunner = 0; if (g && g.vehicle === veh.id) { g.vehicle = 0; g.seat = 0; } } }
        if (T2.heli) { if (veh.bombs === undefined) veh.bombs = 8; if (veh.bombs < 8) { veh.bombT = (veh.bombT || 0) + dt; if (veh.bombT > (veh.alt > 0.5 ? 3 : 1.2)) { veh.bombT = 0; veh.bombs++; } } }
        if (T2.jet && veh.bombs < 6) { veh.bombT = (veh.bombT || 0) + dt; if (veh.bombT > (veh.alt > 0.5 ? 9 : 2.5)) { veh.bombT = 0; veh.bombs++; } }
        if (T2.tank && veh.cd > 0) veh.cd -= dt;
        for (const q of this.players) if (q.vehicle === veh.id) q.air = veh.alt > 0.5;
        if (!veh.driver) { veh.v *= Math.pow(0.05, dt); if ((T2.jet || T2.heli) && veh.alt > 0) { veh.alt = Math.max(0, veh.alt - dt); if (veh.alt <= 0 && overlaps(this.ws, veh.x, veh.y, T2.r * 0.8, blockedP)) this.damageVehicle(veh, 9999); } continue; }
        const drv = this.byId(veh.driver);
        if (!drv || drv.dead) { veh.driver = 0; if (drv) drv.vehicle = 0; continue; }
        if (T2.tank && Math.abs(veh.v) > 20) { // crush everything small in the way
          const fx = veh.x + Math.cos(veh.a) * 26 * Math.sign(veh.v), fy = veh.y + Math.sin(veh.a) * 26 * Math.sign(veh.v);
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const tx = Math.floor(fx / TILE) + ox, ty = Math.floor(fy / TILE) + oy; if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
            const i = ty * MW + tx, cx2 = tx * TILE + 20, cy2 = ty * TILE + 20;
            if (Math.hypot(cx2 - fx, cy2 - fy) > 44) continue;
            if (this.ws.nodeAlive[i]) this.crushNode(i);
            if (this.map.solid[i] && !this.ws.fbroken[i]) this.breakFurn(i, null);
          }
        }
        if ((veh.up & 8) && !T2.boat && !T2.jet && !T2.heli) { // roof gun picks its own targets
          veh.rgCd = (veh.rgCd || 0) - dt;
          if (veh.rgCd <= 0) {
            let tz = null, td = 470; for (const z of this.zombies) { if (z.hp <= 0 || z.type === 7) continue; const d = Math.hypot(z.x - veh.x, z.y - veh.y); if (d < td && losClear(this.ws, veh.x, veh.y, z.x, z.y)) { td = d; tz = z; } }
            if (tz) { veh.rgCd = 0.16; veh.rga = Math.atan2(tz.y - veh.y, tz.x - veh.x); const a = veh.rga + (Math.random() - 0.5) * 0.08; this.bullets.push({ x: veh.x + Math.cos(a) * 14, y: veh.y + Math.sin(a) * 14, vx: Math.cos(a) * 1300, vy: Math.sin(a) * 1300, life: 0.45, dmg: 18, by: drv.id, pierce: 1, hit: [], k: 0 }); this.ev({ e: 'rgun', x: veh.x, y: veh.y, a: Math.round(a * 100) / 100 }); this.noise(veh.x, veh.y, 500); }
            else veh.rgCd = 0.3;
          }
        }
        if (veh.alt > 0.5) continue; // jets in the sky don't run anyone over
        for (const pm of this.map.pumps) if (Math.hypot(pm.x - veh.x, pm.y - veh.y) < 80 && Math.abs(veh.v) < 40 && veh.fuel < 100) { veh.fuel = Math.min(100, veh.fuel + 18 * dt); if (Math.random() < dt) this.ev({ e: 'refuel', id: drv.id, x: veh.x, y: veh.y }); }
        const sp = Math.abs(veh.v);
        if (sp > 160) { veh.noiseT = (veh.noiseT || 0) - dt; if (veh.noiseT <= 0) { veh.noiseT = 0.6; this.noise(veh.x, veh.y, T2.bike ? 380 : 460); } }
        if (sp < (veh.up & 4 ? 45 : 110)) continue;
        const ram = T2.ram * (drv.perks.road ? 1.5 : 1) * (veh.up & 1 ? 2 : 1) * (veh.up & 4 ? 1.3 : 1);
        for (const z of this.zombies) {
          if (z.hp <= 0 || (z.runT && z.runT > this.time)) continue;
          if (Math.hypot(z.x - veh.x, z.y - veh.y) > T2.r + z.r) continue;
          z.runT = this.time + 0.4;
          const big = z.type === 2 || z.type === 6;
          const was = z.hp;
          this.hurtZombie(z, sp * (big ? 0.15 : 0.4) * ram, drv, z.x, z.y);
          const a = Math.atan2(z.y - veh.y, z.x - veh.x), fling = (big ? 26 : 26 + sp * 0.08) * (veh.up & 4 ? 1.6 : 1);
          z.x += Math.cos(a) * fling; z.y += Math.sin(a) * fling; resolve(this.ws, z, z.r, blockedZ);
          if (!(veh.up & 1)) this.damageVehicle(veh, (big ? 28 : z.type === 7 ? 2 : 4) / Math.max(1, T2.ram) * (veh.up & 4 ? 0.3 : 1));
          if (was > 0 && z.hp <= 0) { veh.combo = (veh.comboT > this.time ? veh.combo || 0 : 0) + 1; veh.comboT = this.time + 2.5; }
          this.ev({ e: 'runover', x: z.x, y: z.y, id: drv.id, c: veh.comboT > this.time ? veh.combo || 0 : 0 });
          if (veh.hp <= 0) break;
        }
      }
    }

    addXp(p, n) {
      p.xp += n;
      while (p.xp >= needXp(p.lvl)) {
        p.xp -= needXp(p.lvl); p.lvl++; if (!p.down) p.hp = Math.min(this.maxHp(p), p.hp + 30);
        if (Object.keys(p.perks).length + p.perkPts < PERK_KEYS.length) { p.perkPts++; this.offerPerks(p); }
        const unlocks = Object.keys(BUILD).filter(k => BUILD[k].lvl === p.lvl).map(k => BUILD[k].name).concat(Object.keys(CRAFT).filter(k => CRAFT[k].lvl === p.lvl).map(k => CRAFT[k].name));
        this.ev({ e: 'lvl', id: p.id, n: p.name, l: p.lvl, u: unlocks, x: p.x, y: p.y });
      }
    }

    hurtPlayer(p, dmg, direct) {
      if (p.dead) return;
      { const d0 = this.day(); if (d0 <= 2) dmg *= d0 === 1 ? 0.6 : 0.8; } // a gentler start
      if (p.down) { p.downT -= dmg * 0.12; this.ev({ e: 'hurt', id: p.id, x: p.x, y: p.y }); if (p.downT <= 0) this.killPlayer(p); return; }
      if (p.vehicle && !direct) { const veh = this.vehicles.find(v => v.id === p.vehicle); if (veh) { if (veh.alt > 0.5) return; this.damageVehicle(veh, dmg); this.ev({ e: 'carhit', x: veh.x, y: veh.y }); return; } }
      p.hp -= dmg; this.ev({ e: 'hurt', id: p.id, x: p.x, y: p.y });
      if (p.hp <= 0) { this.exitVehicle(p, true); p.hp = 0; this.downPlayer(p); }
    }
    // at 0 HP you go DOWN: crawl, shoot a pistol, and wait for a friend to pick you up (or use a medkit)
    downPlayer(p) {
      const helpers = this.players.some(q => q !== p && !q.dead && !q.down);
      if (!helpers && p.inv.medkit <= 0) { this.killPlayer(p); return; }
      p.down = true; p.downT = p.perks.second ? 60 : 30; p.revT = 0; p.reloadT = 0; p.healT = 0; p.revBy = 0;
      this.ev({ e: 'down', id: p.id, n: p.name, x: p.x, y: p.y, g: 1, solo: helpers ? 0 : 1 });
    }
    killPlayer(p) {
      this.exitVehicle(p, true); p.down = false; p.hp = 0; p.dead = true; p.respawnT = 6; p.reloadT = 0; p.healT = 0; p.hunger = Math.max(p.hunger, 60);
      this.ev({ e: 'died', id: p.id, n: p.name, x: p.x, y: p.y, g: 1 });
    }
    revivePlayer(p, by) {
      p.down = false; p.revT = 0;
      p.hp = Math.round(this.maxHp(p) * (by && by.perks.medic ? 0.6 : 0.35));
      if (!by) p.inv.medkit--; else this.addXp(by, 25);
      this.ev({ e: 'revived', id: p.id, n: p.name, by: by ? by.name : '', bid: by ? by.id : 0, x: p.x, y: p.y, g: 1 });
    }
    updateDowned(p, dt) {
      p.a = p.inp.a; p.fireCd = Math.max(0, p.fireCd - dt);
      p.downT -= dt;
      let rev = null;
      for (const q of this.players) if (q !== p && !q.dead && !q.down && !q.vehicle && q.inp.hold && Math.hypot(q.x - p.x, q.y - p.y) < 64) { rev = q; break; }
      const self = !rev && p.inp.hold && p.inv.medkit > 0;
      if (rev || self) { p.revT += dt * (rev ? (rev.perks.medic ? 2 : 1) / 3.5 : 1 / 5); p.revBy = rev ? rev.id : p.id; if (p.revT >= 1) { this.revivePlayer(p, rev); return; } }
      else { p.revT = Math.max(0, p.revT - dt * 0.6); p.revBy = 0; }
      if (p.downT <= 0) { this.killPlayer(p); return; }
      const hs = this.heldSlot(p), G = this.gunOf(hs);
      if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.reloadT = 0; if (hs && G.mag) this.fillMag(p, hs, G); } }
      for (const act of p.acts) { const k = act.split(':')[0]; if (k === 'w' || k === 'reload' || k === 'perk') this.doAct(p, act); }
      p.acts.length = 0;
      const hs2 = this.heldSlot(p);
      if (p.inp.fire && p.fireCd <= 0 && p.reloadT <= 0 && hs2 && ONE_HAND[hs2.k]) this.attack(p, hs2.k, this.gunOf(hs2));
      else if (hs2 && ONE_HAND[hs2.k] && (hs2.m || 0) === 0 && p.inv[ammoOf(hs2.k)] > 0 && p.reloadT <= 0) this.startReload(p);
    }

    updatePlayer(p, dt) {
      if (p.dead) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) {
          p.dead = false; p.hp = this.maxHp(p);
          const bed = [...this.structs.values()].find(s => s.type === 'bed' && s.owner === p.key);
          const at = bed ? { x: bed.tx * TILE + TILE / 2, y: bed.ty * TILE + TILE / 2 } : this.map.spawn;
          p.x = at.x; p.y = at.y; resolve(this.ws, p, p.r, blockedP); p.fs++; p.lastPosT = this.time;
          this.ev({ e: 'respawn', id: p.id, x: p.x, y: p.y });
        }
        p.acts.length = 0; return;
      }
      if (p.down) { this.updateDowned(p, dt); return; }
      p.a = p.inp.a;
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.hunger = Math.max(0, p.hunger - dt * 0.11 * (p.perks.stomach ? 0.6 : 1));
      p.swim = !p.vehicle && !(p.inp.jmp > 0) && this.map.t[clamp(Math.floor(p.y / TILE), 0, MH - 1) * MW + clamp(Math.floor(p.x / TILE), 0, MW - 1)] === T_WATER;
      if (p.swim) {
        p.br = Math.max(0, (p.br === undefined ? 100 : p.br) - dt * (p.perks.runner ? 3.6 : 5));
        if (p.br <= 0) { p.hp -= 9 * dt; p.drownT = (p.drownT || 0) - dt; if (p.drownT <= 0) { p.drownT = 3; this.ev({ e: 'drown', id: p.id, x: p.x, y: p.y }); } if (p.hp <= 0) { this.hurtPlayer(p, 1, true); if (p.dead || p.down) return; } }
      } else p.br = Math.min(100, (p.br === undefined ? 100 : p.br) + dt * 25);
      if (p.inp.sprint && (p.inp.mx || p.inp.my) && !p.vehicle) { p.stepN = (p.stepN || 0) - dt; if (p.stepN <= 0) { p.stepN = 0.5; this.noise(p.x, p.y, 210); } }
      if (p.hunger <= 0) { p.hp -= 0.8 * dt; p.starveT -= dt; if (p.starveT <= 0) { p.starveT = 20; this.ev({ e: 'starving', id: p.id }); } if (p.hp <= 0) this.hurtPlayer(p, 1, true); if (p.dead) return; }
      if (p.vehicle) {
        const veh = this.vehicles.find(v => v.id === p.vehicle);
        if (!veh) { p.vehicle = 0; p.seat = 0; } else { p.x = veh.x; p.y = veh.y; }
        for (const act of p.acts) { if (act === 'use') this.exitVehicle(p); else if (act === 'carfix' && veh) this.carFix(p, veh); else if (act.startsWith('perk:') || act.startsWith('w:')) this.doAct(p, act); }
        p.acts.length = 0;
        if (p.vehicle && veh) { this.vehicleCombat(p, veh, dt); return; }
      }
      const wk = this.held(p), W = WEAPONS[wk];
      if (p.reloadT > 0) {
        p.reloadT -= dt;
        const it = this.heldSlot(p), G = this.gunOf(it);
        if (p.reloadT <= 0 && it && G.mag) { p.reloadT = 0; this.fillMag(p, it, G); }
        if (p.reloadT <= 0) p.reloadT = 0;
      }
      if (p.healT > 0) { p.healT -= dt; if (p.healT <= 0) { p.healT = 0; if (p.inv.medkit > 0) { p.inv.medkit--; p.hp = Math.min(this.maxHp(p), p.hp + (p.perks.medic ? 120 : 60)); this.ev({ e: 'heal', id: p.id, x: p.x, y: p.y }); } } }
      for (const act of p.acts) this.doAct(p, act);
      p.acts.length = 0;
      const wk2 = this.held(p), W2 = WEAPONS[wk2], hs = this.heldSlot(p);
      if (!W2.melee && hs && (hs.m || 0) === 0 && p.inv[ammoOf(hs.k)] > 0 && p.reloadT <= 0 && p.healT <= 0) this.startReload(p);
      if (W2.spin) { p.spin = p.inp.fire && p.reloadT <= 0 ? Math.min(1, (p.spin || 0) + dt / 0.55) : Math.max(0, (p.spin || 0) - dt * 1.5); } else p.spin = 0;
      if (p.esc) { p.acts.length = 0; return; }
      if (p.inp.fire && (!p.swim || W2.swimOk) && p.fireCd <= 0 && p.reloadT <= 0 && p.healT <= 0 && (!W2.spin || p.spin >= 1)) {
        if (hs && !WEAPONS[hs.k]) { // using an item from the hotbar
          p.fireCd = 0.6;
          if (hs.k === 'medkit') this.doAct(p, 'heal');
          else if (FOOD[hs.k]) this.eat(p, hs.k);
          else if (hs.k === 'grenade') { this.throwGrenade(p); p.fireCd = 0.8; }
          else if (hs.k === 'molotov') { this.throwGrenade(p, 'molo'); p.fireCd = 0.8; }
          else if (hs.k === 'sticky') { this.throwGrenade(p, 'sticky'); p.fireCd = 0.8; }
        } else this.attack(p, wk2, this.gunOf(hs));
      }
      // campfire warmth
      for (const s of this.structs.values()) if (s.type === 'fire' && Math.hypot(s.tx * TILE + 20 - p.x, s.ty * TILE + 20 - p.y) < 140) { p.hp = Math.min(this.maxHp(p), p.hp + 3 * dt); break; }
      // exploration
      p.expT -= dt;
      if (p.expT <= 0) {
        p.expT = 0.5;
        const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE), R = 11;
        for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
          if (x < 0 || y < 0 || x >= MW || y >= MH || (x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
          const i = y * MW + x; if (!this.explored[i]) { this.explored[i] = 1; this.D.ex.push(i); }
        }
      }
    }

    fillMag(p, it, G) { const am = ammoOf(it.k), cur = it.m || 0, take = Math.min(G.mag - cur, p.inv[am]); it.m = cur + take; p.inv[am] -= take; }
    startReload(p) {
      const it = this.heldSlot(p), W = this.gunOf(it);
      if (!W || W.melee || !it || p.reloadT > 0 || (it.m || 0) >= W.mag || p.inv[ammoOf(it.k)] <= 0) return;
      p.reloadT = W.reload * (p.perks.hands ? 0.65 : 1); this.ev({ e: 'reload', id: p.id, x: p.x, y: p.y });
    }

    doAct(p, act) {
      const parts = act.split(':');
      switch (parts[0]) {
        case 'reload': this.startReload(p); break;
        case 'heal': if (p.inv.medkit > 0 && p.hp < this.maxHp(p) && p.healT <= 0) { p.healT = 1.2; p.reloadT = 0; } break;
        case 'perk': this.pickPerk(p, parts[1]); break;
        case 'trade': this.trade(p, parseInt(parts[1], 10)); break;
        case 'bench': this.benchCraft(p, parts[1]); break;
        case 'w': { const n = parseInt(parts[1], 10); if (n >= 0 && n < HOTBAR && n !== p.sel) { p.sel = n; p.reloadT = 0; p.fireCd = Math.max(p.fireCd, 0.15); } break; }
        case 'mv': this.moveSlot(p, parseInt(parts[1], 10), parseInt(parts[2], 10)); break;
        case 'qm': { const a = parseInt(parts[1], 10); if (a < 0 || a >= NSLOTS || !p.slots[a]) break; const lo = a < HOTBAR ? HOTBAR : 0, hi = a < HOTBAR ? NSLOTS : HOTBAR; for (let i = lo; i < hi; i++) if (!p.slots[i]) { this.moveSlot(p, a, i); break; } break; }
        case 'drop': { const a = parseInt(parts[1], 10); const it = a >= 0 && a < NSLOTS ? p.slots[a] : null; if (it) { p.slots[a] = null; this.dropGround(it.k, it.n, p.x + Math.cos(p.a) * 30, p.y + Math.sin(p.a) * 30, it.m, it.r, it.at); this.ev({ e: 'dropitem', id: p.id, x: p.x, y: p.y }); } break; }
        case 'use': this.use(p); break;
        case 'eat': this.eat(p); break;
        case 'grenade': this.throwGrenade(p); break;
        case 'build': this.build(p, parts[1], parseInt(parts[2], 10), parseInt(parts[3], 10)); break;
        case 'shelter': this.shelter(p, parseInt(parts[1], 10), parseInt(parts[2], 10)); break;
        case 'repair': this.repairAt(p, parseInt(parts[1], 10), parseInt(parts[2], 10)); break;
        case 'hbuy': this.havenBuy(p, parseInt(parts[1], 10)); break;
        case 'hsell': this.havenSell(p, parts[1]); break;
        case 'hskin': this.havenSkin(p, parts[1]); break;
        case 'job': this.takeJob(p, parseInt(parts[1], 10)); break;
        case 'jobq': if (this.job) { for (const z of this.zombies) z.job = 0; this.job = null; this.ev({ e: 'jobq', g: 1, n: p.name }); } break;
        case 'skin': { const k = parts[1], S2 = SKINS[k]; if (S2 && this.skinOk(p, k)) { if (S2.h) p.skin.h = k; else p.skin.o = k; } break; }
        case 'equip': { // put the build hammer in your hand
          let i = p.slots.findIndex(it => it && it.k === parts[1]);
          if (i < 0 && parts[1] === 'hammer' && this.kit !== 'full') { this.ev({ e: 'note', id: p.id, t: 'You need a Build Hammer — craft one in the C menu (5 wood)' }); break; }
          if (i < 0 && parts[1] === 'hammer') { this.invAdd(p, 'hammer', 1, true); i = p.slots.findIndex(it => it && it.k === 'hammer'); }
          if (i < 0) break;
          if (i < HOTBAR) p.sel = i; else { const e2 = p.slots.findIndex((it, j) => j < HOTBAR && !it); if (e2 >= 0) { this.moveSlot(p, i, e2); p.sel = e2; } else this.moveSlot(p, i, p.sel); }
          p.reloadT = 0; break;
        }
        case 'demolish': this.demolish(p, parseInt(parts[1], 10), parseInt(parts[2], 10)); break;
        case 'craft': this.craft(p, parts[1]); break;
      }
    }

    attack(p, wk, W) {
      const mult = dmgMult(p.lvl) * (W.melee ? (p.perks.lumber ? 1.6 : 1) : (p.perks.sharp ? 1.15 : 1));
      if (W.melee) {
        p.fireCd = W.rate;
        if (!W.saw) this.ev({ e: 'swing', id: p.id, x: p.x, y: p.y, a: p.a, w: wk });
        else if (!p.sawSnd || this.time > p.sawSnd) { p.sawSnd = this.time + 0.3; this.ev({ e: 'saw', id: p.id, x: p.x, y: p.y }); }
        if (W.saw) p.sawT = this.time + 0.2;
        let hit = false;
        for (const z of this.zombies) {
          const d = Math.hypot(z.x - p.x, z.y - p.y);
          if (d < W.range + z.r && Math.abs(angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.a)) < (W.arc || 1.0)) { this.hurtZombie(z, W.dmg * mult, p, z.x, z.y); hit = true; }
        }
        if (W.saw) this.noise(p.x, p.y, 650);
        if (!hit) {
          for (const dist of [p.r + 14, p.r + 34]) {
            const tx = Math.floor((p.x + Math.cos(p.a) * dist) / TILE), ty = Math.floor((p.y + Math.sin(p.a) * dist) / TILE);
            if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) break;
            const i = ty * MW + tx;
            if (this.ws.nodeAlive[i]) { this.hitNode(p, i, wk, W); break; }
            if (this.map.solid[i] && !this.ws.fbroken[i] && (this.map.furnAt[i] || this.map.crateAt[i])) { this.hitFurn(p, i, wk, W); break; }
          }
        }
        return;
      }
      const it = this.heldSlot(p), cur = it ? it.m || 0 : 0;
      if (cur <= 0) { p.fireCd = 0.3; if (p.inv[ammoOf(wk)] <= 0) this.ev({ e: 'empty', id: p.id, x: p.x, y: p.y }); return; }
      if (!(p.perks.saver && Math.random() < 0.25)) it.m = cur - 1;
      p.fireCd = W.rate;
      if (W.flame) { // cone of fire: hurts and sets zombies alight
        p.flameT = this.time + 0.15;
        for (const z of this.zombies) {
          if (z.hp <= 0) continue; const d = Math.hypot(z.x - p.x, z.y - p.y);
          if (d < 235 + z.r && Math.abs(angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.a)) < 0.34 && losClear(this.ws, p.x, p.y, z.x, z.y)) { this.hurtZombie(z, W.dmg * mult, p, z.x, z.y, true); z.burnT = this.time + 3; z.burnBy = p.id; }
        }
        if (!p.flameSnd || this.time > p.flameSnd) { p.flameSnd = this.time + 0.35; this.ev({ e: 'flame', id: p.id, x: p.x, y: p.y }); }
        this.noise(p.x, p.y, 380); return;
      }
      if (W.tesla) { // chain lightning: jumps from zombie to zombie
        let cur = null, cd = 440;
        for (const z of this.zombies) { if (z.hp <= 0 || z.type === 7) continue; const d = Math.hypot(z.x - p.x, z.y - p.y); if (d < cd + z.r && Math.abs(angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.a)) < 0.5 && losClear(this.ws, p.x, p.y, z.x, z.y)) { cd = d; cur = z; } }
        const pts = []; let dmg = W.dmg * mult; const hit = new Set();
        if (!cur) pts.push([Math.round(p.x + Math.cos(p.a) * 260), Math.round(p.y + Math.sin(p.a) * 260)]);
        for (let k = 0; k < 6 && cur; k++) {
          hit.add(cur); pts.push([Math.round(cur.x), Math.round(cur.y)]);
          this.hurtZombie(cur, dmg, p, cur.x, cur.y, true); cur.stunT = this.time + 0.45; dmg *= 0.85;
          let nx = null, nd = 200; for (const z of this.zombies) { if (z.hp <= 0 || hit.has(z) || z.type === 7) continue; const d = Math.hypot(z.x - cur.x, z.y - cur.y); if (d < nd && losClear(this.ws, cur.x, cur.y, z.x, z.y)) { nd = d; nx = z; } }
          cur = nx;
        }
        this.ev({ e: 'zap', id: p.id, x: Math.round(p.x + Math.cos(p.a) * 20), y: Math.round(p.y + Math.sin(p.a) * 20), pts });
        this.noise(p.x, p.y, 600); return;
      }
      if (W.freeze) { // freeze ray: chills, then freezes zombies solid (frozen ones shatter)
        p.frzT = this.time + 0.15;
        for (const z of this.zombies) {
          if (z.hp <= 0) continue; const d = Math.hypot(z.x - p.x, z.y - p.y);
          if (d < 225 + z.r && Math.abs(angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.a)) < 0.32 && losClear(this.ws, p.x, p.y, z.x, z.y)) { z.frost = Math.min(1.6, (z.frost || 0) + (ZT[z.type].boss ? 0.035 : 0.12)); z.burnT = 0; this.hurtZombie(z, W.dmg * mult, p, z.x, z.y, true); }
        }
        if (!p.frzSnd || this.time > p.frzSnd) { p.frzSnd = this.time + 0.35; this.ev({ e: 'frz', id: p.id, x: p.x, y: p.y }); }
        this.noise(p.x, p.y, 260); return;
      }
      if (W.proj) { // grenade launcher / RPG
        const a = p.a + (Math.random() - 0.5) * 2 * W.spread, bx = p.x + Math.cos(p.a) * 24, by = p.y + Math.sin(p.a) * 24;
        const rk = W.proj === 'rocket' ? { rad: 135, zd: 260, pd: 26, sd: 140 } : { rad: 110, zd: 160, pd: 18, sd: 60 };
        this.rockets.push(Object.assign({ x: bx, y: by, vx: Math.cos(a) * W.speed, vy: Math.sin(a) * W.speed, life: W.life, by: p.id, kind: W.proj }, rk));
        this.noise(p.x, p.y, 700); this.ev({ e: 'shot', id: p.id, w: wk, x: p.x, y: p.y, a: p.a }); return;
      }
      for (let i = 0; i < W.pellets; i++) {
        const a = p.a + (Math.random() - 0.5) * 2 * W.spread;
        const sp = W.speed * (W.pellets > 1 ? 0.85 + Math.random() * 0.3 : 1);
        if (W.dual) p.dualS = -(p.dualS || 1);
        const so = W.dual ? p.dualS * 7 : 0, bx = p.x + Math.cos(p.a) * 18 + Math.cos(p.a + 1.571) * so, by = p.y + Math.sin(p.a) * 18 + Math.sin(p.a + 1.571) * so;
        if (blocksBullet(this.ws, bx, by)) continue;
        this.bullets.push({ x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: W.life, dmg: W.dmg * mult, by: p.id, pierce: W.pierce || 1, hit: [], harp: W.harp ? p.id : 0, k: W.harp ? 7 : wk === 'crossbow' ? 6 : wk === 'rifle' || wk === 'sniper' ? 2 : (it.r || 0) >= 2 ? 4 + (it.r - 2) : 0 });
      }
      const sil = ((it.at || 0) & 2) || W.silent;
      if (W.silent) { this.ev({ e: 'shot', id: p.id, w: wk, x: p.x, y: p.y, a: p.a, sil: 1 }); return; }
      this.noise(p.x, p.y, sil ? 150 : wk === 'sniper' || wk === 'rifle' || wk === 'shotgun' ? 950 : 700);
      this.ev({ e: 'shot', id: p.id, w: wk, x: p.x, y: p.y, a: p.a, sil: sil ? 1 : 0 });
    }

    furnKind(i) { const ci = this.map.crateAt[i]; if (ci) return { crate: ci - 1, k: this.map.crates[ci - 1].k || 'crate' }; const fi = this.map.furnAt[i]; return fi ? { furn: fi - 1, k: this.map.furn[fi - 1].t } : null; }
    hitFurn(p, i, wk, W) {
      const K = this.furnKind(i); if (!K) return; const info = FURN_INFO[K.k] || { hp: 50, drop: {} };
      let hp = this.furnHp.has(i) ? this.furnHp.get(i) : info.hp;
      hp -= W.dmg * (wk === 'axe' ? 1.4 : wk === 'hammer' ? 1.6 : 1) * (p.perks.lumber ? 1.5 : 1);
      const x = (i % MW) * TILE + 20, y = Math.floor(i / MW) * TILE + 20;
      this.noise(x, y, 280);
      if (hp <= 0) { this.furnHp.delete(i); this.breakFurn(i, p); }
      else { this.furnHp.set(i, hp); this.ev({ e: 'fhit', id: p.id, i, x, y, k: K.k, f: Math.max(0, Math.round(100 * hp / info.hp)) }); }
    }
    // smash a piece of furniture (a loot container you hadn't searched spills its loot)
    breakFurn(i, p) {
      const K = this.furnKind(i); if (!K) return;
      const tiles = K.crate !== undefined ? [i] : (this.map.furn[K.furn].tiles || [i]);
      const x = (i % MW) * TILE + 20, y = Math.floor(i / MW) * TILE + 20, back = this.time + FURN_BACK;
      for (const t of tiles) { this.ws.fbroken[t] = 1; this.fbroken.set(t, back); this.furnHp.delete(t); this.D.fb.push(t); }
      if (K.crate !== undefined) {
        const c = this.map.crates[K.crate];
        if (!this.crateOpen[K.crate] && p) this.loot(p, c.tier, x, y);
        this.crateOpen[K.crate] = 1; this.crateReady[K.crate] = back; this.D.co.push(K.crate);
      }
      const info = FURN_INFO[K.k] || { drop: {} }, got = [];
      if (p) { for (const r in info.drop) { p.inv[r] += info.drop[r]; got.push('+' + info.drop[r] + ' ' + r); } this.addXp(p, 2); }
      this.ev({ e: 'fbreak', id: p ? p.id : 0, x, y, k: K.k, got });
    }
    hitNode(p, i, wk, W) {
      const type = this.map.node[i], N = NODE[type];
      let hp = this.nodeHp.has(i) ? this.nodeHp.get(i) : N.hp;
      const tool = type === N_TREE ? (wk === 'axe' ? 1.6 : W.saw ? 2.4 : 1.0) : (wk === 'axe' ? 1.0 : W.saw ? 0.8 : 0.7);
      hp -= W.dmg * tool * (p.perks.lumber ? 1.5 : 1);
      const per = W.saw ? (Math.random() < 0.3 ? N.per : 0) : N.per;
      if (per) { p.inv[N.res] += per; this.addXp(p, 1); }
      const x = (i % MW) * TILE + TILE / 2, y = Math.floor(i / MW) * TILE + TILE / 2;
      if (per || hp <= 0) this.ev({ e: 'gather', id: p.id, r: N.res, n: per, t: type, x, y, i, f: Math.max(0, Math.round(100 * hp / N.hp)) });
      if (type === N_CAR && Math.random() < 0.08) { p.inv.gunparts++; this.ev({ e: 'drop', id: p.id, r: 'gunparts', n: 1, x, y }); }
      this.noise(x, y, 300);
      if (hp <= 0) {
        this.nodeHp.delete(i); this.ws.nodeAlive[i] = 0; this.removed.set(i, this.time + N.regrow);
        p.inv[N.res] += N.bonus; this.addXp(p, 3);
        this.D.nr.push(i); this.ev({ e: 'nodebreak', t: type, x, y, id: p.id, r: N.res, n: N.bonus });
      } else this.nodeHp.set(i, hp);
    }

    // loud things (gunshots, engines) wake up zombies nearby
    noise(x, y, r) {
      if (this.wx.k === 1) r *= 0.7; else if (this.wx.k === 3) r *= 0.55;
      for (const z of this.zombies) {
        if (z.type === 7 || z.horde || Math.abs(z.x - x) > r || Math.abs(z.y - y) > r || Math.hypot(z.x - x, z.y - y) > r) continue;
        if (z.seenT !== undefined && this.time - z.seenT < 2.5) continue; // already chasing someone it can see
        z.aggro = true; z.lkx = x + (Math.random() - 0.5) * 80; z.lky = y + (Math.random() - 0.5) * 80;
      }
    }
    vehicleCombat(p, veh, dt) {
      const V = VT[veh.type];
      if (V.tank && veh.driver === p.id) { // main cannon: aim with the mouse, click to fire
        veh.ca = p.inp.ga !== null ? p.inp.ga : veh.a;
        if (p.inp.fire && !(veh.cd > 0)) {
          veh.cd = 1.7; const a = veh.ca, mx = veh.x + Math.cos(a) * 44, my = veh.y + Math.sin(a) * 44;
          this.rockets.push({ x: mx, y: my, vx: Math.cos(a) * 1250, vy: Math.sin(a) * 1250, life: 0.85, by: p.id, kind: 'shell', rad: 125, zd: 320 * dmgMult(p.lvl), pd: 30, sd: 160 });
          this.noise(veh.x, veh.y, 1400); this.ev({ e: 'cannon', id: p.id, x: mx, y: my, a });
        }
        return;
      }
      if (V.heli && veh.driver === p.id) {
        const aim = p.inp.ga !== null ? p.inp.ga : veh.a;
        if (p.inp.fire && p.fireCd <= 0 && !veh.over) { // chin minigun, aims with the mouse
          p.fireCd = 0.06; veh.heat = (veh.heat || 0) + 2.6; if (veh.heat >= 100) { veh.heat = 100; veh.over = true; this.ev({ e: 'overheat', id: p.id }); }
          const a = aim + (Math.random() - 0.5) * 0.05, bx = veh.x + Math.cos(veh.a) * 26, by = veh.y + Math.sin(veh.a) * 26;
          this.bullets.push({ x: bx, y: by, vx: Math.cos(a) * 1500, vy: Math.sin(a) * 1500, life: 0.6, dmg: 26 * dmgMult(p.lvl), by: p.id, pierce: 1, hit: [], k: 1 });
          this.noise(veh.x, veh.y, 900); this.ev({ e: 'shot', id: p.id, w: 'mg', x: veh.x, y: veh.y, a });
        }
        if (p.inp.f2 && veh.bombs > 0 && !(veh.bombCd > this.time)) { // rocket pods, left and right
          veh.bombs--; veh.bombCd = this.time + 0.32; const sd = veh.bombs % 2 ? -20 : 20;
          const rx = veh.x - Math.sin(veh.a) * sd, ry = veh.y + Math.cos(veh.a) * sd;
          this.rockets.push({ x: rx, y: ry, vx: Math.cos(aim) * 950, vy: Math.sin(aim) * 950, life: 1.1, by: p.id, kind: 'rocket', rad: 115, zd: 260 * dmgMult(p.lvl), pd: 25, sd: 150 });
          this.noise(veh.x, veh.y, 1100); this.ev({ e: 'shot', id: p.id, w: 'rpg', x: rx, y: ry, a: aim });
        }
        return;
      }
      if (V.jet && veh.driver === p.id) {
        if (p.inp.fire && p.fireCd <= 0 && !veh.over) { // twin nose cannons
          p.fireCd = 0.07; veh.heat = (veh.heat || 0) + 3.4; if (veh.heat >= 100) { veh.heat = 100; veh.over = true; this.ev({ e: 'overheat', id: p.id }); }
          const sp = 1600 + Math.max(0, veh.v);
          for (const sd of [-9, 9]) { const bx = veh.x + Math.cos(veh.a) * 30 - Math.sin(veh.a) * sd, by = veh.y + Math.sin(veh.a) * 30 + Math.cos(veh.a) * sd; this.bullets.push({ x: bx, y: by, vx: Math.cos(veh.a) * sp, vy: Math.sin(veh.a) * sp, life: 0.55, dmg: 34 * dmgMult(p.lvl), by: p.id, pierce: 2, hit: [], k: 1 }); }
          this.noise(veh.x, veh.y, 900); this.ev({ e: 'shot', id: p.id, w: 'mg', x: veh.x, y: veh.y, a: veh.a });
        }
        if (p.inp.f2 && veh.alt > 0.8 && veh.bombs > 0 && !(veh.bombCd > this.time)) { // drop a bomb
          veh.bombs--; veh.bombCd = this.time + 0.45;
          this.rockets.push({ x: veh.x, y: veh.y, vx: Math.cos(veh.a) * veh.v * 0.55, vy: Math.sin(veh.a) * veh.v * 0.55, life: 0.9, by: p.id, kind: 'bomb', rad: 175, zd: 420, pd: 40, sd: 260 });
          this.ev({ e: 'bombdrop', id: p.id, x: veh.x, y: veh.y });
        }
        return;
      }
      if (V.gun && (p.seat === 1 || (veh.driver === p.id && !veh.gunner))) { // mounted machine gun
        const aim = p.seat === 1 ? p.inp.a : (p.inp.ga !== null ? p.inp.ga : veh.a);
        veh.ta = aim;
        if (p.inp.fire && p.fireCd <= 0 && !veh.over) {
          p.fireCd = 0.085; veh.heat += 4.2; if (veh.heat >= 100) { veh.heat = 100; veh.over = true; this.ev({ e: 'overheat', id: p.id }); }
          const mx = veh.x - Math.cos(veh.a) * 12, my = veh.y - Math.sin(veh.a) * 12, a = aim + (Math.random() - 0.5) * 0.08;
          this.bullets.push({ x: mx + Math.cos(aim) * 26, y: my + Math.sin(aim) * 26, vx: Math.cos(a) * 1400, vy: Math.sin(a) * 1400, life: 0.7, dmg: 30 * dmgMult(p.lvl) * (p.perks.sharp ? 1.15 : 1), by: p.id, pierce: 2, hit: [], k: 1 });
          this.noise(veh.x, veh.y, 800);
          this.ev({ e: 'shot', id: p.id, w: 'mg', x: mx, y: my, a: aim });
        }
      } else if (V.bike && veh.driver === p.id) { // drive-by with a one-handed gun
        const hs = this.heldSlot(p);
        if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.reloadT = 0; const G = this.gunOf(hs); if (hs && G.mag) this.fillMag(p, hs, G); } }
        if (hs && ONE_HAND[hs.k]) {
          if ((hs.m || 0) === 0 && p.inv[ammoOf(hs.k)] > 0 && p.reloadT <= 0) this.startReload(p);
          if (p.inp.fire && p.fireCd <= 0 && p.reloadT <= 0) { p.a = p.inp.ga !== null ? p.inp.ga : veh.a; this.attack(p, hs.k, this.gunOf(hs)); }
        }
      }
    }
    use(p) {
      if (p.down) return;
      if (this.players.some(q => q !== p && q.down && Math.hypot(q.x - p.x, q.y - p.y) < 70)) return; // you're reviving
      for (const h of this.heli) for (let k = 0; k < h.boxes.length; k++) {
        const b = h.boxes[k]; if (b.open || Math.hypot(b.x - p.x, b.y - p.y) > 70) continue;
        if (h.kind === 'surv') { if (k === 0) this.rescue(p, h); else { b.open = 1; this.loot(p, 3, b.x, b.y); } return; }
        b.open = 1; this.loot(p, h.kind === 'convoy' ? 10 : h.kind === 'jet' ? 11 : 9, b.x, b.y); return;
      }
      for (const m of this.map.marks || []) {
        if (m.k !== 'light' && m.k !== 'radio') continue;
        const mx = (m.x + 1) * TILE, my = (m.y + 1) * TILE; if (Math.hypot(mx - p.x, my - p.y) > 82) continue;
        if (m.k === 'light') { this.reveal(m.x + 1, m.y + 1, 46); this.addXp(p, 10); this.ev({ e: 'lookout', id: p.id, x: mx, y: my }); return; }
        const d0 = this.day();
        if (this.era() >= 3 && !p.bot && this.fixRadio(p)) return;
        if ((this.lastRadioDay || 0) < d0) { this.lastRadioDay = d0; this.ev({ e: 'radio', id: p.id, ok: 1 }); this.makeSite('surv', p, d0); }
        else this.ev({ e: 'radio', id: p.id, ok: 0 });
        return;
      }
      if (!p.bot && this.haven && Math.hypot(this.haven.x - p.x, this.haven.y - p.y) < 110) { this.ev({ e: 'haven', id: p.id }); return; }
      if (!p.bot && !p.vehicle && this.bunkerUse(p)) return;
      for (const d of this.dogs) {
        if (Math.hypot(d.x - p.x, d.y - p.y) > 80 || p.bot) continue;
        if (d.owner === p.key && d.down) { d.down = false; d.hp = d.mhp * 0.6; this.ev({ e: 'dogup', id: p.id, n: d.name, x: d.x, y: d.y }); return; }
        if (d.owner) continue;
        if (this.dogs.some(q => q.owner === p.key)) { this.ev({ e: 'note', id: p.id, t: 'You already have a dog' }); return; }
        const fk = ['food', 'meat', 'cooked', 'bread'].find(k => p.inv[k] > 0);
        if (!fk) { this.ev({ e: 'note', id: p.id, t: 'The dog looks hungry — feed it a can of beans or some meat' }); return; }
        p.inv[fk]--; d.owner = p.key; d.oid = p.id; d.hp = d.mhp; p.st.dog = 1;
        this.ev({ e: 'dogtame', g: 1, n: p.name, dn: d.name, id: p.id, x: d.x, y: d.y }); return;
      }
      // nearest thing to interact with: car, airdrop, crate, campfire
      let bestV = null, bv = 60;
      for (const v of this.vehicles) { const d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bv + (VT[v.type].bike ? 0 : 10) + (VT[v.type].boat ? 34 : 0) && (!v.driver || (VT[v.type].gun && !v.gunner))) { bv = d; bestV = v; } }
      if (bestV) { this.enterVehicle(p, bestV); return; }
      for (const a of this.airdrops) if (this.time >= a.land && Math.hypot(a.x - p.x, a.y - p.y) < 70) { this.airdrops = this.airdrops.filter(q => q !== a); this.loot(p, 5, a.x, a.y); this.ev({ e: 'dropopen', g: 1, n: p.name }); return; }
      let best = -1, bd = 75;
      this.map.crates.forEach((c, i) => {
        if (this.crateOpen[i]) return;
        const d = Math.hypot(c.tx * TILE + 20 - p.x, c.ty * TILE + 20 - p.y); if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) {
        const c = this.map.crates[best];
        this.crateOpen[best] = 1; this.crateReady[best] = this.time + 360; this.D.co.push(best);
        this.loot(p, c.tier, c.tx * TILE + 20, c.ty * TILE + 20); return;
      }
      if (this.ground) {
        let gi = null, gd = 60; for (const it of this.ground) { const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < gd) { gd = d; gi = it; } }
        if (gi) {
          const total = gi.n, left = this.invAdd(p, gi.k, gi.n, true, gi.m, gi.r, gi.at);
          // invAdd drops leftovers as a new pile; keep the original pile instead
          if (left > 0) { this.ground.pop(); gi.n = left; this.ev({ e: 'full', id: p.id }); } else this.ground = this.ground.filter(q => q !== gi);
          if (total - left > 0) this.ev({ e: 'pickup', id: p.id, k: gi.k, r: gi.r || 0, n: total - left, x: gi.x, y: gi.y });
          return;
        }
      }
      if (p.inv.meat > 0) for (const s of this.structs.values()) if (s.type === 'fire' && Math.hypot(s.tx * TILE + 20 - p.x, s.ty * TILE + 20 - p.y) < 85) {
        const n = p.inv.meat; p.inv.meat = 0; p.inv.cooked += n; this.addXp(p, n);
        this.ev({ e: 'cook', id: p.id, n, x: s.tx * TILE + 20, y: s.ty * TILE + 20 }); return;
      }
    }
    eat(p, want) {
      let k = null, gain = 0;
      if (want && FOOD[want] && p.inv[want] > 0) { k = want; gain = FOOD[want]; }
      else for (const f of FOOD_ORDER) if (p.inv[f] > 0) { k = f; gain = FOOD[f]; break; }
      if (!k || p.hunger > 97) return;
      p.inv[k]--; p.hunger = Math.min(100, p.hunger + gain); if (k === 'cooked') p.hp = Math.min(this.maxHp(p), p.hp + 10); else if (k === 'apple') p.hp = Math.min(this.maxHp(p), p.hp + 4);
      this.ev({ e: 'eat', id: p.id, k, x: p.x, y: p.y });
    }
    throwGrenade(p, kind) {
      const key = kind === 'molo' ? 'molotov' : kind === 'sticky' ? 'sticky' : 'grenade';
      if (p.inv[key] <= 0) return;
      p.inv[key]--;
      const dist = clamp(p.inp.ad || 300, 60, 450), v0 = 2 * dist / 0.8;
      this.grenades.push({ x: p.x + Math.cos(p.a) * 16, y: p.y + Math.sin(p.a) * 16, vx: Math.cos(p.a) * v0, vy: Math.sin(p.a) * v0, dec: v0 / 0.8, fuse: kind === 'molo' ? 0.8 : kind === 'sticky' ? 3 : 1.4, by: p.id, kind: kind || 'nade' });
      this.ev({ e: 'throw', id: p.id, x: p.x, y: p.y });
    }
    updateGrenades(dt) {
      for (let i = this.grenades.length - 1; i >= 0; i--) {
        const g = this.grenades[i]; g.fuse -= dt;
        if (g.kind === 'sticky') {
          if (g.stuck) { if (g.stuck.hp > 0) { g.x = g.stuck.x; g.y = g.stuck.y; } g.vx = g.vy = 0; }
          else for (const z of this.zombies) if (z.hp > 0 && z.type !== 7 && Math.abs(z.x - g.x) < z.r + 10 && Math.hypot(z.x - g.x, z.y - g.y) < z.r + 9) { g.stuck = z; g.fuse = Math.min(g.fuse, 2.2); this.ev({ e: 'stick', x: g.x, y: g.y }); break; }
          if (g.fuse <= 0) { this.grenades.splice(i, 1); this.blast(g.x, g.y, 150, 330, 22, 40, this.byId(g.by)); }
          if (g.stuck) continue;
        }
        if (g.kind === 'molo' && g.fuse <= 0) { this.grenades.splice(i, 1); this.fires.push({ x: g.x, y: g.y, r: 95, until: this.time + 7, by: g.by }); this.ev({ e: 'molo', x: g.x, y: g.y }); this.noise(g.x, g.y, 500); continue; }
        const sp = Math.hypot(g.vx, g.vy);
        if (sp > 0) { const ns = Math.max(0, sp - g.dec * dt); g.vx *= ns / sp; g.vy *= ns / sp; }
        const nx = g.x + g.vx * dt; if (blocksBullet(this.ws, nx, g.y)) g.vx = -g.vx * 0.5; else g.x = nx;
        const ny = g.y + g.vy * dt; if (blocksBullet(this.ws, g.x, ny)) g.vy = -g.vy * 0.5; else g.y = ny;
        if (g.fuse <= 0 && g.kind !== 'sticky') { this.grenades.splice(i, 1); this.blast(g.x, g.y, 150, 170, 22, 35, this.byId(g.by)); }
      }
    }
    updateFires(dt) {
      if (!this.fires.length) return;
      for (const f of this.fires) {
        const by = this.byId(f.by);
        for (const z of this.zombies) {
          if (z.hp <= 0 || ZT[z.type].fly || Math.abs(z.x - f.x) > f.r + z.r || Math.hypot(z.x - f.x, z.y - f.y) > f.r + z.r) continue;
          z.burnT = Math.max(z.burnT || 0, this.time + 2.5); z.burnBy = f.by; z.hp -= 16 * dt; z.hitT = Math.max(z.hitT, 0.05);
          if (z.hp <= 0) { z.hp = 0.01; this.hurtZombie(z, 1, by, z.x, z.y, true); }
        }
        for (const q of this.players) if (!q.dead && !q.vehicle && !q.down && Math.hypot(q.x - f.x, q.y - f.y) < f.r * 0.75) { q.hp -= 5 * dt; if (q.hp <= 0) this.hurtPlayer(q, 1, true); }
      }
      this.fires = this.fires.filter(f => this.time < f.until);
    }
    // player-made explosion (grenade / landmine): big damage to zombies, little to people and buildings
    blast(x, y, rad, zdmg, pdmg, sdmg, src, big) {
      this.ev({ e: 'boom', x, y, b: big || 0 }); this.noise(x, y, 1300);
      for (const z of this.zombies) { if (z.hp <= 0) continue; const d = Math.hypot(z.x - x, z.y - y); if (d < rad + z.r) this.hurtZombie(z, zdmg * (1 - 0.6 * Math.min(1, d / rad)), src && src.inv ? src : null, z.x, z.y, true); }
      if (big === 2 && sdmg) { const ftx = Math.floor(x / TILE), fty = Math.floor(y / TILE); for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { const i = (fty + oy) * MW + ftx + ox; if (i >= 0 && i < MW * MH && this.ws.nodeAlive[i] && Math.hypot(ox, oy) < 1.8) this.crushNode(i); } }
      if (pdmg) for (const p of this.players) { if (p.dead || p.esc) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < rad * 0.8) this.hurtPlayer(p, pdmg * (1 - d / rad)); }
      for (const d of this.dogs) if (pdmg && d.owner && !d.ride && Math.hypot(d.x - x, d.y - y) < rad * 0.6) this.hurtDog(d, pdmg * 0.5);
      const ftx = Math.floor(x / TILE), fty = Math.floor(y / TILE), fr = Math.ceil(rad * 0.5 / TILE);
      for (let oy = -fr; oy <= fr; oy++) for (let ox = -fr; ox <= fr; ox++) { const tx = ftx + ox, ty = fty + oy; if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue; const i = ty * MW + tx; if (this.map.solid[i] && !this.ws.fbroken[i] && Math.hypot(tx * TILE + 20 - x, ty * TILE + 20 - y) < rad * 0.5) this.breakFurn(i, null); }
      if (sdmg) for (const s of [...this.structs.values()]) { if (s.type === 'mine') continue; const d = Math.hypot(s.tx * TILE + 20 - x, s.ty * TILE + 20 - y); if (d < rad * 0.7) this.damageStruct(s, sdmg); }
    }
    crushNode(i) { this.ws.nodeAlive[i] = 0; this.nodeHp.delete(i); this.removed.set(i, this.time + 600 + Math.random() * 600); this.D.nr.push(i); this.ev({ e: 'crush', x: (i % MW) * TILE + 20, y: Math.floor(i / MW) * TILE + 20, t: this.map.node[i] }); }
    carFix(p, veh) {
      const T2 = VT[veh.type];
      if (p.inv.fuel > 0 && veh.fuel < 90) { p.inv.fuel--; veh.fuel = Math.min(100, veh.fuel + 50); this.ev({ e: 'refuel', id: p.id, x: veh.x, y: veh.y }); return; }
      const vmx = T2.hp * (veh.up & 2 ? 1.6 : 1);
      if (p.inv.scrap >= 2 && veh.hp < vmx) { p.inv.scrap -= 2; veh.hp = Math.min(vmx, veh.hp + 70); this.ev({ e: 'repair', id: p.id, x: veh.x, y: veh.y }); return; }
      this.ev({ e: 'nofix', id: p.id });
    }
    // fit an attachment to your best gun that doesn't have one yet (or keep it in the backpack)
    missingPart(p, list) { // the part from this set you have the fewest of
      let best = list[0], bn = 1e9; for (const k of list) { const n = (p.inv[k] || 0) + Math.random() * 0.5; if (n < bn) { bn = n; best = k; } } return best;
    }
    autoAttach(p, a) {
      const bit = ATT[a]; let best = null, bs = -1;
      for (const it of p.slots) if (it && WEAPONS[it.k] && !WEAPONS[it.k].melee && !((it.at || 0) & bit)) { const sc = (it.r || 0) * 100 + WEAPONS[it.k].dmg / WEAPONS[it.k].rate; if (sc > bs) { bs = sc; best = it; } }
      if (best) { best.at = (best.at || 0) | bit; return ATT_NAMES[a] + ' fitted to ' + fullName(best.k, best.r); }
      this.invAdd(p, a, 1); return '+1 ' + ATT_NAMES[a];
    }
    giveGun(p, g, rar) {
      const own = p.slots.find(it => it && it.k === g);
      if (own && (own.r || 0) >= rar) return null;
      this.invAdd(p, g, 1, false, gunStats(g, rar, 0).mag || undefined, rar, 0);
      return (rar ? RARITY[rar].name.toUpperCase() + ' ' : 'NEW: ') + WEAPONS[g].name;
    }
    loot(p, tier, x, y) {
      const got = []; let best = -1, bestName = '';
      const scav = p.perks.scav ? 1.4 : 1;
      const give = (k, n) => { if (k === 'bullets') n = Math.round(n * scav); p.inv[k] = (p.inv[k] || 0) + n; got.push('+' + n + ' ' + itemName(k)); };
      const rollR = (w) => { let t = 0; for (const q of w) t += q; let v = Math.random() * t; for (let i = 0; i < 4; i++) { v -= w[i]; if (v <= 0) return i; } return 0; };
      const RW = { 0: [72, 23, 5, 0], 2: [45, 37, 15, 3], 1: [25, 42, 25, 8], 5: [0, 15, 45, 40], 9: [0, 22, 48, 30], 12: [0, 25, 45, 30] };
      const gun = (pool) => {
        const g = pool[Math.floor(Math.random() * pool.length)];
        let rar = rollR(RW[tier] || RW[0]); if (p.perks.scav && Math.random() < 0.3) rar = Math.min(3, rar + 1);
        const t2 = this.giveGun(p, g, rar);
        if (!t2) give('bullets', 20); else { got.push(t2); if (rar > best) { best = rar; bestName = fullName(g, rar); } }
      };
      const att = () => { const a = ['scope', 'silencer', 'extmag'][Math.floor(Math.random() * 3)]; got.push(this.autoAttach(p, a)); };
      const r = Math.random(), R2 = () => Math.random(), era = this.era();
      if (!p.bot && (tier === 0 || tier === 3 || tier === 4) && !p.slots.some(it => it && it.k === 'axe') && (R2() < 0.35 || (p.st.looted || 0) >= 3)) { this.invAdd(p, 'axe', 1, true); got.push('Found an AXE!'); }
      const part = (list) => { const k = this.missingPart(p, list); p.inv[k]++; got.push((list === TANK_PARTS ? 'TANK PART: ' : 'JET PART: ') + itemName(k)); if (best < 2) { best = 2; bestName = itemName(k); } };
      const extras = () => { // things that appear as the world evolves
        if (tier === 1 || tier === 5 || tier === 9 || tier === 10 || tier === 11) { const gp = { 1: 0.45, 5: 1, 9: 1, 10: 1, 11: 1 }[tier]; if (R2() < gp) give('gunparts', 1 + Math.floor(R2() * (tier === 1 ? 2 : 3))); }
        if (tier === 2 && R2() < 0.3) give('gunparts', 1);
        if (tier === 0 && R2() < 0.06) give('gunparts', 1);
        if (era >= 2) {
          if ((tier === 1 && R2() < 0.08) || (tier === 5 && R2() < 0.5) || (tier === 9 && R2() < 0.3)) part(TANK_PARTS);
          if ((tier === 1 || tier === 5 || tier === 10) && R2() < 0.25) give('shells', 3);
        }
        if (era >= 3) {
          if ((tier === 1 && R2() < 0.05) || (tier === 5 && R2() < 0.4) || (tier === 9 && R2() < 0.3)) part(JET_PARTS);
          if ((tier === 1 || tier === 5 || tier === 11) && R2() < 0.25) give('rockets', 1 + Math.floor(R2() * 2));
          if ((tier === 1 || tier === 11) && R2() < 0.2) give('gas', 60);
        }
        if (tier === 10) { part(TANK_PARTS); give('bullets', 30 + Math.floor(R2() * 30)); if (R2() < 0.4) give('grenade', 1); if (R2() < 0.3) give('sticky', 1); }
        if (tier === 11) { part(JET_PARTS); give('bullets', 30); if (R2() < 0.5) give('medkit', 1); }
        if (era >= 2 && (tier === 1 || tier === 2) && R2() < 0.12) give('bolts', 10);
      };
      const armor = (n) => { if (n >= 50) give('medkit', 1); else give('bullets', 10); };
      if (tier === 6) { // fridge / drinks cooler
        if (R2() < 0.75) give('soda', 1 + Math.floor(R2() * 2)); if (R2() < 0.55) give('apple', 1 + Math.floor(R2() * 2));
        if (R2() < 0.4) give('meat', 1 + Math.floor(R2() * 2)); if (R2() < 0.2) give('cooked', 1);
        if (!got.length) give('apple', 1);
      } else if (tier === 7) { // kitchen cupboard
        if (R2() < 0.6) give('food', 1 + Math.floor(R2() * 2)); if (R2() < 0.5) give('chips', 1); if (R2() < 0.45) give('bread', 1);
        if (R2() < 0.1) give('bullets', 10); if (R2() < 0.08) give('medkit', 1);
        if (!got.length) give('chips', 1);
      } else if (tier === 8) { // shop shelf
        give('chips', 1 + Math.floor(R2() * 3)); if (R2() < 0.5) give('soda', 1 + Math.floor(R2() * 2)); if (R2() < 0.4) give('food', 1);
        if (R2() < 0.3) give('bread', 1); if (R2() < 0.15) give('fuel', 1);
      } else if (tier === 9) { // crashed helicopter
        gun(['m4', 'ak', 'sniper', 'smg', 'm4', 'rifle', 'aa12', 'dual']); give('bullets', 50 + Math.floor(R2() * 30)); if (R2() < 0.65) att();
        if (R2() < 0.5) give('grenade', 1 + Math.floor(R2() * 2)); if (R2() < 0.5) give('medkit', 1); if (R2() < 0.4) give('fuel', 1);
      } else if (tier === 5) {
        gun(era >= 3 ? ['sniper', 'm4', 'tesla', 'freeze', 'aa12'] : ['sniper', 'm4', 'ak', 'sniper', 'aa12']); give('bullets', 80); if (era >= 3) give('cells', 30); give('grenade', 3); att(); give('medkit', 2); give('food', 2);
      } else if (tier === 1) {
        gun(['m4', 'ak', 'rifle', 'smg', 'm4', 'sniper', 'dual', 'aa12']); give('bullets', 40 + Math.floor(R2() * 30)); if (R2() < 0.3) give('molotov', 1);
        if (R2() < 0.5) give('grenade', 1 + Math.floor(R2() * 2)); if (R2() < 0.25) att(); else if (R2() < 0.3) armor(50); if (R2() < 0.5) give('medkit', 1); give('scrap', 4 + Math.floor(R2() * 5));
      } else if (tier === 2) {
        if (r < 0.45) gun(['revolver', 'shotgun', 'pistol', 'smg', 'revolver', 'dual', 'katana']);
        give('bullets', 25 + Math.floor(R2() * 20)); if (R2() < 0.15) att(); else if (R2() < 0.4) armor(40); if (R2() < 0.25) give('grenade', 1);
      } else if (tier === 3) {
        give('medkit', 1 + Math.floor(R2() * 3)); if (R2() < 0.4) give('food', 1); if (R2() < 0.3) armor(25);
      } else if (tier === 4) {
        give('food', 1 + Math.floor(R2() * 3)); if (R2() < 0.6) give('fuel', 1 + Math.floor(R2() * 2)); if (R2() < 0.5) give('scrap', 2 + Math.floor(R2() * 4)); if (R2() < 0.35) give('molotov', 1 + Math.floor(R2() * 2)); if (R2() < 0.07) gun(['chainsaw']);
      } else {
        if (R2() < 0.3) give('food', 1); if (R2() < 0.08) give('fuel', 1);
        if (r < 0.12) gun(['pistol', 'shotgun', 'shotgun', 'smg', 'rifle', 'machete', 'machete', 'ak', 'revolver', 'katana', 'chainsaw', 'harpoon']);
        if (R2() < 0.04) att();
        if (r < 0.5) give('bullets', 12 + Math.floor(Math.random() * 18));
        if (r > 0.35 && r < 0.6) give('medkit', 1);
        if (r > 0.45) give('scrap', 2 + Math.floor(Math.random() * 5));
        if (Math.random() < 0.3) give('wood', 4);
      }
      if (tier === 12) { // island sea chest
        gun(['m4', 'ak', 'shotgun', 'rifle', 'smg', 'sniper', 'revolver', 'harpoon', 'harpoon']); give('bullets', 40 + Math.floor(R2() * 40)); give('harpoons', 4); give('gunparts', 2 + Math.floor(R2() * 3));
        if (R2() < 0.6) att(); if (R2() < 0.6) give('medkit', 1 + Math.floor(R2() * 2)); if (R2() < 0.5) give('fuel', 1); if (R2() < 0.5) give('grenade', 1 + Math.floor(R2() * 2));
        if (era >= 2 && R2() < 0.35) part(TANK_PARTS); if (era >= 3 && R2() < 0.3) part(JET_PARTS);
      }
      if (tier === 10) gun(['m4', 'ak', 'smg', 'rifle', 'shotgun']);
      if (tier === 11) { gun(['sniper', 'm4', 'ak', 'tesla', 'freeze']); give('cells', 30); }
      extras();
      this.addXp(p, tier === 5 || tier >= 9 ? (tier === 12 ? 60 : 40) : tier >= 6 ? 3 : 5);
      if (p.st) { p.st.looted = (p.st.looted || 0) + 1; if (tier === 12) p.st.island = (p.st.island || 0) + 1; }
      this.ev({ e: 'loot', id: p.id, items: got, x, y, rar: best });
      if (best >= 2) this.ev({ e: 'rarefind', g: 1, n: p.name, w: bestName, r: best, id: p.id });
    }

    canAfford(p, cost) { for (const k in cost) if ((p.inv[k] || 0) < cost[k]) return false; return true; }
    pay(p, cost) { for (const k in cost) p.inv[k] -= cost[k]; }

    canPlace(p, type, tx, ty, noFar) {
      const B = BUILD[type]; if (!B) return 'Unknown';
      if (p.lvl < B.lvl) return 'Needs level ' + B.lvl;
      if (!this.canAfford(p, B.cost)) return 'Not enough resources';
      if (tx < 1 || ty < 1 || tx >= MW - 1 || ty >= MH - 1) return 'Out of bounds';
      const i = ty * MW + tx, t = this.map.t[i];
      if (t === T_WATER || t === T_BWALL) return 'Blocked';
      if (this.haven && Math.hypot(tx * TILE + 20 - this.haven.x, ty * TILE + 20 - this.haven.y) < this.haven.r + 40) return 'No building in Haven';
      if (this.ws.nodeAlive[i] || this.ws.sType[i]) return 'Blocked';
      if ((this.map.solid[i] && !this.ws.fbroken[i]) || this.map.crateAt[i]) return 'Blocked';
      const cx = tx * TILE + 20, cy = ty * TILE + 20;
      if (Math.hypot(cx - p.x, cy - p.y) > (noFar ? 320 : 260)) return 'Too far';
      if (B.code !== 5 && B.code !== 4 && B.code !== 2) {
        for (const q of this.players) if (!q.dead && Math.abs(q.x - cx) < 20 + q.r && Math.abs(q.y - cy) < 20 + q.r) return 'Someone is standing there';
      }
      for (const z of this.zombies) if (Math.abs(z.x - cx) < 20 + z.r && Math.abs(z.y - cy) < 20 + z.r) return 'A zombie is there';
      return '';
    }

    // one-click shelter: a 5x5 ring of wood walls with a door facing where you look
    shelter(p, cx, cy) {
      if (!isFinite(cx) || !isFinite(cy) || Math.hypot(cx * TILE + 20 - p.x, cy * TILE + 20 - p.y) > 260) return;
      const ring = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) ring.push([cx + dx, cy + dy]);
      const fa = p.a; let door = ring[0], best = -2;
      for (const [x, y] of ring) { const d = Math.cos(Math.atan2(y - cy, x - cx) - fa); if (Math.abs(x - cx) + Math.abs(y - cy) === 2 && d > best) { best = d; door = [x, y]; } }
      let n = 0;
      for (const [x, y] of ring) {
        const type = x === door[0] && y === door[1] ? 'door' : 'wall';
        const save = p.lastPosT; const ok = !this.canPlace(p, type, x, y, true);
        if (ok) { this.build(p, type, x, y, true); n++; }
      }
      this.ev({ e: 'shelter', id: p.id, n, x: cx * TILE + 20, y: cy * TILE + 20 });
    }
    repairAt(p, tx, ty) {
      if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return;
      const s = this.structs.get(this.structAt[ty * MW + tx]); if (!s || s.hp >= s.max) return;
      if (Math.hypot(tx * TILE + 20 - p.x, ty * TILE + 20 - p.y) > 260) return;
      const c = BUILD[s.type].cost, res = c.wood ? 'wood' : c.stone ? 'stone' : 'scrap';
      if (p.inv[res] < 2) { this.ev({ e: 'norepair', id: p.id, r: res }); return; }
      p.inv[res] -= 2; s.hp = Math.min(s.max, s.hp + s.max * 0.3); this.D.sh.set(s.id, Math.ceil(s.hp));
      this.ev({ e: 'repaired', id: p.id, x: tx * TILE + 20, y: ty * TILE + 20 });
    }
    build(p, type, tx, ty, noFar) {
      if (this.canPlace(p, type, tx, ty, noFar)) return;
      const B = BUILD[type];
      this.pay(p, B.cost);
      if (type === 'bed') for (const s of [...this.structs.values()]) if (s.type === 'bed' && s.owner === p.key) this.destroyStruct(s, true);
      const hp0 = Math.round(B.hp * (p.perks.builder ? 1.5 : 1));
      const s = { id: this.nextId++, type, tx, ty, hp: hp0, max: hp0, owner: p.key, cd: 0 };
      this.addStruct(s);
      this.addXp(p, 4); this.noise(tx * TILE + 20, ty * TILE + 20, 260);
      this.ev({ e: 'build', id: p.id, x: tx * TILE + 20, y: ty * TILE + 20, s: type });
      if (p.st) { p.st.built = (p.st.built || 0) + 1; if (type === 'bench') p.st.bench = 1; }
    }
    addStruct(s) {
      const i = s.ty * MW + s.tx;
      this.structs.set(s.id, s); this.structAt[i] = s.id; this.ws.sType[i] = BUILD[s.type].code;
      this.D.sa.push(this.packStruct(s));
    }
    packStruct(s) { return [s.id, BUILD[s.type].code, s.tx, s.ty, Math.ceil(s.hp), s.max, s.owner]; }
    openDoor(s, secs) {
      const i = s.ty * MW + s.tx; if (this.ws.doorOpen[i]) { s.openUntil = this.time + secs; return; }
      this.ws.doorOpen[i] = 1; s.openUntil = this.time + secs;
      this.ev({ e: 'barge', x: s.tx * TILE + 20, y: s.ty * TILE + 20, owner: s.owner });
    }
    destroyStruct(s, quiet) {
      const i = s.ty * MW + s.tx; this.ws.doorOpen[i] = 0;
      this.structs.delete(s.id); this.structAt[i] = 0; this.ws.sType[i] = 0; this.D.sr.push(s.id); this.D.sh.delete(s.id);
      if (!quiet) this.ev({ e: 'sbreak', x: s.tx * TILE + 20, y: s.ty * TILE + 20, s: s.type });
    }
    demolish(p, tx, ty) {
      if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return;
      const id = this.structAt[ty * MW + tx]; const s = this.structs.get(id); if (!s) return;
      if (Math.hypot(tx * TILE + 20 - p.x, ty * TILE + 20 - p.y) > 240) return;
      const B = BUILD[s.type], f = 0.5 * s.hp / s.max;
      for (const k in B.cost) p.inv[k] += Math.floor(B.cost[k] * f);
      this.destroyStruct(s, true); this.ev({ e: 'demolish', x: tx * TILE + 20, y: ty * TILE + 20 });
    }
    damageStruct(s, dmg) {
      s.hp -= dmg; this.D.sh.set(s.id, Math.max(0, Math.ceil(s.hp)));
      if (s.hp <= 0) this.destroyStruct(s);
    }

    craft(p, what) {
      const C = CRAFT[what]; if (!C || p.lvl < C.lvl || !this.canAfford(p, C.cost)) return;
      if (C.tool && p.slots.some(it => it && C.give[it.k])) { this.ev({ e: 'note', id: p.id, t: 'You already have a ' + C.name }); return; }
      this.pay(p, C.cost); for (const k in C.give) { if (WEAPONS[k]) this.invAdd(p, k, C.give[k], true); else p.inv[k] = (p.inv[k] || 0) + C.give[k]; }
      this.ev({ e: 'craft', id: p.id, what: C.name, x: p.x, y: p.y });
    }

    // ----- zombies -----
    spawnZombie(x, y, type, horde) {
      const T = ZT[type], scale = 1 + 0.15 * (this.day() - 1);
      const z = { id: this.nextId++, type, x, y, a: Math.random() * 6.28, hp: T.hp * scale, mhp: T.hp * scale, r: T.r, spd: T.spd * (0.9 + Math.random() * 0.2) * (this.day() === 1 ? 0.85 : 1), atkCd: 0, spitCd: 1 + Math.random() * 2, slamCd: 3, side: Math.random() < 0.5 ? 1 : -1, horde: !!horde, wander: Math.random() * 6.28, wanderT: 0, stuckT: 0, lx: x, ly: y, jitT: 0, jitA: 0 };
      this.zombies.push(z); return z;
    }
    era() { return eraOf(this.day()); }
    // zombie birds fly over everything and dive at you — even when you are flying
    flyZombie(z, target, td, dt) {
      const T = ZT[z.type]; let spd = z.spd * (z.frost ? 1 - 0.6 * z.frost : 1), dir;
      z.atkCd = Math.max(0, z.atkCd);
      if (target && td < 1300) {
        const toT = Math.atan2(target.y - z.y, target.x - z.x), reach = z.r + (target.vehicle ? 30 : target.r) + 12;
        z.diveT = (z.diveT || 0) - dt;
        if (td < reach && z.atkCd <= 0 && z.diveT <= 0) {
          z.atkCd = 0.9; z.diveT = 0.7; z.side = -z.side;
          const veh = target.vehicle ? this.vehicles.find(v => v.id === target.vehicle) : null;
          if (target.dog) this.hurtDog(target, T.dmg);
          else if (veh && veh.alt > 0.5) { this.damageVehicle(veh, T.dmg * 2.5); this.ev({ e: 'carhit', x: veh.x, y: veh.y }); }
          else this.hurtPlayer(target, T.dmg);
          this.ev({ e: 'zatk', x: z.x, y: z.y, a: z.a, b: 1 });
        }
        dir = z.diveT > 0 ? toT + Math.PI * 0.7 * z.side : toT + Math.sin(this.time * 3 + z.id) * 0.3;
        if (target.vehicle) spd *= target.air ? 2.4 : 1.5;
        if (!z.seenT || this.time - z.seenT > 4) { z.seenT = this.time; this.ev({ e: 'caw', x: z.x, y: z.y }); }
      } else { z.wanderT -= dt; if (z.wanderT <= 0) { z.wanderT = 2 + Math.random() * 3; z.wander = Math.random() * 6.28; } dir = z.wander; spd *= 0.5; }
      z.a += angDiff(dir, z.a) * Math.min(1, dt * 5);
      z.x = clamp(z.x + Math.cos(z.a) * spd * dt, 60, WORLD - 60); z.y = clamp(z.y + Math.sin(z.a) * spd * dt, 60, WORLD - 60);
    }
    colossusThrow(z, target) {
      let car = null, cd = 240;
      for (const v of this.vehicles) { if (v.driver || v.gunner || ![0, 1, 3].includes(v.type)) continue; const d = Math.hypot(v.x - z.x, v.y - z.y); if (d < cd) { cd = d; car = v; } }
      const tx = target.x + (Math.random() - 0.5) * 70, ty = target.y + (Math.random() - 0.5) * 70, T = clamp(Math.hypot(tx - z.x, ty - z.y) / 620, 0.8, 1.7);
      const r = { x: z.x, y: z.y, vx: (tx - z.x) / T, vy: (ty - z.y) / T, life: T, T, by: 0, kind: car ? 'car' : 'boulder', arc: 1, rad: 120, zd: 90, pd: 36, sd: 160 };
      if (car) { this.vehicles = this.vehicles.filter(v => v !== car); r.car = [car.type, car.color, car.hp, car.fuel]; r.cc = car.color; r.ct = car.type; }
      this.rockets.push(r); this.ev({ e: 'cthrow', x: z.x, y: z.y, car: car ? 1 : 0 });
    }
    pickZType() {
      const night = this.isNight() ? 1 : 0, day = this.day(), era = eraOf(day);
      const ok = (z) => day >= z.minDay && era >= (z.minEra || 1);
      let tot = 0; for (const z of ZT) if (ok(z)) tot += z.w[night];
      let r = Math.random() * tot;
      for (let i = 0; i < ZT.length; i++) { const z = ZT[i]; if (!ok(z)) continue; r -= z.w[night]; if (r <= 0) return i; }
      return 0;
    }
    explode(x, y) {
      this.ev({ e: 'boom', x, y }); this.noise(x, y, 1300);
      for (const p of this.players) { if (p.dead) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < 130) this.hurtPlayer(p, 38 * (1 - d / 170)); }
      for (const s of [...this.structs.values()]) { const d = Math.hypot(s.tx * TILE + 20 - x, s.ty * TILE + 20 - y); if (d < 140) this.damageStruct(s, 150 * (1 - d / 200)); }
      for (const z of this.zombies) { if (z.hp <= 0) continue; const d = Math.hypot(z.x - x, z.y - y); if (d < 120) this.hurtZombie(z, 70 * (1 - d / 160), null); }
    }
    updateSpits(dt) {
      for (let i = this.spits.length - 1; i >= 0; i--) {
        const b = this.spits[i]; b.life -= dt; let dead = b.life <= 0;
        b.x += b.vx * dt; b.y += b.vy * dt;
        const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE), ti = ty * MW + tx;
        if (!dead && blocksBullet(this.ws, b.x, b.y)) dead = true;
        if (!dead && ti >= 0 && ti < MW * MH && this.structAt[ti] && blockedZ(this.ws, tx, ty)) { const st = this.structs.get(this.structAt[ti]); if (st) this.damageStruct(st, 15); dead = true; }
        if (!dead) for (const p of this.players) if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < p.r + (b.k ? 12 : 7)) { this.hurtPlayer(p, b.dmg || 13); dead = true; break; }
        if (dead) { this.ev({ e: 'acid', x: b.x, y: b.y, k: b.k || 0 }); this.spits.splice(i, 1); }
      }
    }
    findSpawn(cx, cy, dmin, dmax) {
      for (let k = 0; k < 25; k++) {
        const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin);
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        if (blockedZ(this.ws, tx, ty) || this.ws.sType[ty * MW + tx]) continue;
        if (this.haven && Math.hypot(x - this.haven.x, y - this.haven.y) < this.haven.r + 160) continue;
        if (this.players.some(p => !p.dead && Math.hypot(p.x - x, p.y - y) < dmin * 0.9)) continue;
        return { x: tx * TILE + 20, y: ty * TILE + 20 };
      }
      return null;
    }
    hurtZombie(z, dmg, src, x, y, ex) {
      if (z.hp <= 0) return;
      const arm = ZT[z.type].armor; if (arm && !ex) dmg *= 1 - arm;
      if (z.litT > this.time) dmg *= 1.25;
      let shat = false;
      if (z.frost >= 1) { dmg *= 1.6; if (!ZT[z.type].boss && z.hp - dmg < z.mhp * 0.35) { dmg = z.hp + 1; shat = true; } }
      z.hp -= dmg; z.hitT = 0.15;
      if (shat) this.ev({ e: 'shatter', x: z.x, y: z.y, t: z.type });
      if (src && src.x !== undefined && !(z.seenT !== undefined && this.time - z.seenT < 2.5)) { z.aggro = true; z.lkx = src.x; z.lky = src.y; }
      this.ev({ e: 'zhit', x: x !== undefined ? x : z.x, y: y !== undefined ? y : z.y, by: src ? src.id : 0, d: Math.round(dmg) });
      if (z.hp <= 0) {
        this.ev({ e: 'zdie', x: z.x, y: z.y, t: z.type, by: src ? src.id : 0 });
        if (z.type === 5 && !z.exploded) { z.exploded = true; this.explode(z.x, z.y); }
        if (src && src.cash !== undefined) src.cash += Math.max(1, Math.round(ZT[z.type].xp / 10));
        if (z.type === 13) this.killKing(src);
        if (z.type === 6 || z.type === 11) this.ev({ e: 'bossdead', g: 1, n: src && src.name ? src.name : '', t: z.type });
        if (z.type === 11 && src && src.inv) { src.inv.gunparts += 8; this.ev({ e: 'drop', id: src.id, r: 'gunparts', n: 8, x: z.x, y: z.y }); }
        if (z.type === 7) { if (src && src.inv) { src.inv.meat += 3; this.addXp(src, ZT[7].xp); this.ev({ e: 'drop', id: src.id, r: 'meat', n: 3, x: z.x, y: z.y }); } return; }
        if (src && src.inv) {
          this.addXp(src, Math.round(ZT[z.type].xp * (this.bloodMoon ? 1.5 : 1))); src.kills++;
          if (z.type === 8 || z.type === 10) { const n = z.type === 10 ? 4 : Math.random() < 0.35 ? 1 : 0; if (n) { src.inv.gunparts += n; this.ev({ e: 'drop', id: src.id, r: 'gunparts', n, x: z.x, y: z.y }); } }
          if (z.type === 10 && Math.random() < 0.35) { const k = this.missingPart(src, Math.random() < 0.5 ? TANK_PARTS : JET_PARTS); src.inv[k]++; this.ev({ e: 'drop', id: src.id, r: k, n: 1, x: z.x, y: z.y }); }
          if (Math.random() < 0.25) { const n = 3 + Math.floor(Math.random() * 6); src.inv.bullets += n; this.ev({ e: 'drop', id: src.id, r: 'bullets', n, x: z.x, y: z.y }); }
          else if (Math.random() < 0.12) { src.inv.scrap += 1; this.ev({ e: 'drop', id: src.id, r: 'scrap', n: 1, x: z.x, y: z.y }); }
        }
      }
    }

    computeField() {
      const N = MW * MH, dist = (this._fd && this._fd.length === N ? this._fd : (this._fd = new Float64Array(N))).fill(Infinity);
      const heap = [];
      const push = (d, c) => { heap.push([d, c]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      for (const p of this.players) if (!p.dead) { const c = Math.floor(p.y / TILE) * MW + Math.floor(p.x / TILE); if (c >= 0 && c < N) { dist[c] = 0; push(0, c); } }
      const LIMIT = 70, ws = this.ws, t = this.map.t;
      while (heap.length) {
        const [d, c] = pop(); if (d > dist[c] || d > LIMIT) continue;
        const x = c % MW, y = (c / MW) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
          const n = ny * MW + nx, tt = t[n];
          if (tt === T_WATER || tt === T_BWALL || ws.nodeAlive[n] || (ws.map.solid[n] && !ws.fbroken[n])) continue;
          if (dx && dy) { const a = y * MW + nx, b = ny * MW + x; if (t[a] === T_WATER || t[a] === T_BWALL || ws.nodeAlive[a] || (ws.sType[a] && !WALKABLE_S[ws.sType[a]]) || t[b] === T_WATER || t[b] === T_BWALL || ws.nodeAlive[b] || (ws.sType[b] && !WALKABLE_S[ws.sType[b]])) continue; }
          const st = ws.sType[n];
          const extra = (st === 5 || st === 8) ? 6 : (st && !WALKABLE_S[st] && !(DOORS[st] && ws.doorOpen[n])) ? 22 : 0;
          const nd = d + (dx && dy ? 1.414 : 1) + extra;
          if (nd < dist[n]) { dist[n] = nd; push(nd, n); }
        }
      }
      this.field = dist;
    }

    updateZombies(dt) {
      const ws = this.ws, night = this.isNight();
      // spatial buckets for separation
      const bucket = new Map();
      for (const z of this.zombies) { const k = (Math.floor(z.x / 80) << 12) | Math.floor(z.y / 80); let b = bucket.get(k); if (!b) bucket.set(k, b = []); b.push(z); }
      for (const z of this.zombies) {
        if (z.hp <= 0) continue;
        z.atkCd = Math.max(0, z.atkCd - dt); if (z.hitT) z.hitT = Math.max(0, z.hitT - dt);
        let target = null, td = 1e9, tw = 1e9;
        const fly = ZT[z.type].fly, H = this.haven;
        if (H && Math.abs(z.x - H.x) < H.r + 60 && Math.abs(z.y - H.y) < H.r + 60) { const hd = Math.hypot(z.x - H.x, z.y - H.y); if (hd < H.r + 4) { if (hd < H.r - 90 && !ZT[z.type].boss) { z.hp = 0; continue; } z.x = H.x + (z.x - H.x) / (hd || 1) * (H.r + 4); z.y = H.y + (z.y - H.y) / (hd || 1) * (H.r + 4); } }
        for (const p of this.players) { if (p.dead || p.esc || (p.air && !fly)) continue; const d = Math.hypot(p.x - z.x, p.y - z.y), w = p.down ? d * 1.6 : d; if (w < tw) { tw = w; td = d; target = p; } }
        if (z.type !== 7) for (const dg of this.dogs) { if (!dg.owner || dg.down || dg.ride) continue; const d = Math.hypot(dg.x - z.x, dg.y - z.y); if (d * 1.25 < tw) { tw = d * 1.25; td = d; target = dg; } }
        if (z.burnT && z.burnT > this.time) { z.hp -= 12 * dt; z.hitT = Math.max(z.hitT, 0.05); if (z.hp <= 0) { z.hp = 0.01; this.hurtZombie(z, 1, this.byId(z.burnBy), z.x, z.y, true); if (z.hp <= 0) continue; } }
        if (z.frost > 0) { z.frost = Math.max(0, z.frost - 0.3 * dt); if (z.frost >= 1) continue; } // frozen solid
        if (z.stunT > this.time) continue;
        if (z.pullT > this.time) { const pd = Math.hypot(z.pux - z.x, z.puy - z.y); if (pd > 50) moveCircle(ws, z, (z.pux - z.x) / pd * 520 * dt, (z.puy - z.y) / pd * 520 * dt, z.r, fly ? blockedAir : blockedZ); continue; }
        if (fly) { this.flyZombie(z, target, td, dt); continue; }
        // eyes: a zombie sees you if nothing is in the way and you are in front of it (or very close)
        if (target && !z.horde && z.type !== 7) {
          z.seeT = (z.seeT || 0) - dt;
          if (z.seeT <= 0) {
            z.seeT = 0.18 + Math.random() * 0.12;
            const sightR = (night ? (this.bloodMoon ? 1000 : 780) : 520) * (this.wx.k === 2 ? 0.5 : this.wx.k === 4 ? 0.6 : this.wx.k ? 0.85 : 1), chasing = z.seenT !== undefined && this.time - z.seenT < 3;
            let sees = td < 70;
            if (!sees && td < sightR && (td < 170 || chasing || Math.abs(angDiff(Math.atan2(target.y - z.y, target.x - z.x), z.a)) < 1.3)) sees = canSee(ws, z.x, z.y, target.x, target.y);
            if (sees) {
              if (!chasing) this.ev({ e: 'spotted', x: z.x, y: z.y, id: target.id });
              z.aggro = true; z.seenT = this.time; z.lkx = target.x; z.lky = target.y;
              if (z.type === 9 && (!z.screamT || this.time > z.screamT)) { // screamer: calls every zombie around and drives them mad
                z.screamT = this.time + 14; this.ev({ e: 'scream', x: z.x, y: z.y });
                for (const o of this.zombies) if (o !== z && Math.abs(o.x - z.x) < 1100 && Math.abs(o.y - z.y) < 1100 && Math.hypot(o.x - z.x, o.y - z.y) < 1100) { o.aggro = true; o.lkx = target.x; o.lky = target.y; o.rageT = this.time + 6; }
              }
            }
          }
        }
        if (z.aggro && td > 1800 && !z.horde) z.aggro = false;
        const aware = z.horde || (z.seenT !== undefined && this.time - z.seenT < 2.5);
        const tr = target ? (target.vehicle ? 22 : target.r) : 0;
        const T = ZT[z.type];
        let spd = z.spd * (night ? (this.bloodMoon ? 1.28 : 1.12) : 1) * (z.rageT && z.rageT > this.time ? 1.3 : 1) * (z.frost ? 1 - 0.6 * z.frost : 1) * (z.litT > this.time ? 0.82 : 1);
        const ti = Math.floor(z.y / TILE) * MW + Math.floor(z.x / TILE);
        if (z.type === 7) { // deer: flee from people, otherwise graze
          let dir, sp2 = z.spd;
          if (target && td < 330) dir = Math.atan2(z.y - target.y, z.x - target.x) + Math.sin(this.time * 2 + z.id) * 0.4;
          else { z.wanderT -= dt; if (z.wanderT <= 0) { z.wanderT = 2 + Math.random() * 5; z.wander = Math.random() * 6.28; z.graze = Math.random() < 0.5; } dir = z.wander; sp2 = z.graze ? 0 : z.spd * 0.25; }
          z.a += angDiff(dir, z.a) * Math.min(1, dt * 6);
          if (sp2 > 0) { const ox = z.x, oy = z.y; moveCircle(ws, z, Math.cos(dir) * sp2 * dt, Math.sin(dir) * sp2 * dt, z.r, blockedZ); if (Math.hypot(z.x - ox, z.y - oy) < sp2 * dt * 0.3) z.wander = Math.random() * 6.28; }
          continue;
        }
        if (ws.sType[ti] === 10) { // landmine
          const s = this.structs.get(this.structAt[ti]); if (s) { this.destroyStruct(s, true); this.blast(s.tx * TILE + 20, s.ty * TILE + 20, 130, 200, 20, 0, this.players.find(q => q.key === s.owner) || null); }
          if (z.hp <= 0) continue;
        }
        if (ws.sType[ti] === 8) { // barbed wire
          spd *= 0.35; z.hp -= 10 * dt;
          const s = this.structs.get(this.structAt[ti]); if (s) this.damageStruct(s, 4 * dt);
          if (z.hp <= 0) { this.ev({ e: 'zdie', x: z.x, y: z.y, t: z.type, by: 0 }); continue; }
        }
        if (ws.sType[ti] === 5) { // spikes
          spd *= 0.5; z.hp -= 22 * dt;
          const s = this.structs.get(this.structAt[ti]); if (s) this.damageStruct(s, 5 * dt);
          if (z.hp <= 0) { this.ev({ e: 'zdie', x: z.x, y: z.y, t: z.type, by: 0 }); continue; }
        }
        // special monsters
        if (z.type === 5 && target && !target.down && td < z.r + tr + 26) { z.exploded = true; z.hp = 0; this.ev({ e: 'zdie', x: z.x, y: z.y, t: 5, by: 0 }); this.explode(z.x, z.y); continue; }
        if (z.type === 6 && target) {
          z.slamCd -= dt;
          if (td < 170 && z.slamCd <= 0) { z.slamCd = 4; this.ev({ e: 'slam', x: z.x, y: z.y }); for (const p of this.players) { if (p.dead) continue; const d = Math.hypot(p.x - z.x, p.y - z.y); if (d < 170) this.hurtPlayer(p, 26 * (1 - d / 220)); } }
        }
        if (z.type === 13 && target) { // the Zombie King: fire fans, summons, ground slam, rage at half health
          const rage = z.hp < z.mhp * 0.5;
          if (rage && !z.rage2) { z.rage2 = 1; z.spd *= 1.35; this.ev({ e: 'krage', g: 1 }); }
          z.slamCd -= dt; z.sumCd = (z.sumCd === undefined ? 6 : z.sumCd) - dt; z.fbCd = (z.fbCd === undefined ? 3 : z.fbCd) - dt;
          if (td < 190 && z.slamCd <= 0) { z.slamCd = 3.4; this.ev({ e: 'slam', x: z.x, y: z.y, big: 1 }); for (const q of this.players) { if (q.dead) continue; const d = Math.hypot(q.x - z.x, q.y - z.y); if (d < 200) this.hurtPlayer(q, 30 * (1 - d / 250)); } }
          if (z.fbCd <= 0 && td < 720) { z.fbCd = rage ? 2.4 : 3.8; const a0 = Math.atan2(target.y - z.y, target.x - z.x); for (let k = -3; k <= 3; k++) { const a = a0 + k * 0.17; this.spits.push({ x: z.x + Math.cos(a) * 36, y: z.y + Math.sin(a) * 36, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 1.9, dmg: 18, k: 8 }); } this.ev({ e: 'kfire', x: z.x, y: z.y }); }
          if (z.sumCd <= 0) { z.sumCd = rage ? 9 : 13; for (let q = 0; q < 5; q++) { const a = Math.random() * 6.283; const g = this.spawnZombie(z.x + Math.cos(a) * 90, z.y + Math.sin(a) * 90, rage ? 8 : 1, false); g.bk = 1; resolve(ws, g, g.r, blockedZ); } this.ev({ e: 'ksummon', x: z.x, y: z.y }); }
        }
        if (z.type === 11 && target) { // Colossus: ground pound up close, throws cars and boulders from afar
          z.slamCd -= dt; z.throwCd = (z.throwCd === undefined ? 2.5 : z.throwCd) - dt;
          if (td < 200 && z.slamCd <= 0) { z.slamCd = 3.6; this.ev({ e: 'slam', x: z.x, y: z.y, big: 1 }); for (const p of this.players) { if (p.dead) continue; const d = Math.hypot(p.x - z.x, p.y - z.y); if (d < 210) this.hurtPlayer(p, 34 * (1 - d / 260)); } for (const dg of this.dogs) if (dg.owner && Math.hypot(dg.x - z.x, dg.y - z.y) < 200) this.hurtDog(dg, 30); }
          else if (td > 240 && td < 980 && z.throwCd <= 0 && !target.air && (aware || z.horde)) { z.throwCd = 4.2 + Math.random() * 2; z.a = Math.atan2(target.y - z.y, target.x - z.x); this.colossusThrow(z, target); }
        }
        let spitDir = null;
        if (z.type === 4 && aware && target && td < 430 && td > z.r + tr + 14 && losClear(ws, z.x, z.y, target.x, target.y)) {
          z.spitCd -= dt;
          const toT = Math.atan2(target.y - z.y, target.x - z.x);
          z.a = toT;
          if (z.spitCd <= 0) {
            z.spitCd = 2.4 + Math.random();
            const lead = td / 380, ax = target.x + (target.x - (target.px || target.x)) * 0, a = Math.atan2(target.y - z.y, ax - z.x) + (Math.random() - 0.5) * 0.12;
            this.spits.push({ x: z.x + Math.cos(a) * 18, y: z.y + Math.sin(a) * 18, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, life: 1.4 + lead * 0 });
            this.ev({ e: 'spit', x: z.x, y: z.y });
          }
          spitDir = td < 210 ? toT + Math.PI : td > 320 ? toT : toT + z.side * Math.PI / 2;
        }
        // attack a player in reach
        if (target && td < z.r + tr + 14 && z.type !== 5) {
          z.a = Math.atan2(target.y - z.y, target.x - z.x);
          if (z.atkCd <= 0) {
            z.atkCd = 1.0;
            if (target.dog) { this.hurtDog(target, T.dmg); this.ev({ e: 'zatk', x: z.x, y: z.y, a: z.a }); }
            else if (target.inp.jmp > 0.12 && target.inp.jmp < 0.88 && !target.vehicle) this.ev({ e: 'dodge', id: target.id, x: target.x, y: target.y }); // swiped under your feet
            else { this.hurtPlayer(target, T.dmg); this.ev({ e: 'zatk', x: z.x, y: z.y, a: z.a }); }
          }
          continue;
        }
        // decide direction
        let dir = null;
        if (spitDir !== null) dir = spitDir;
        else if (aware && target && td < 340 && losClear(ws, z.x, z.y, target.x, target.y)) dir = Math.atan2(target.y - z.y, target.x - z.x);
        else if (aware && this.field && isFinite(this.field[ti]) && target && td < 2600) {
          const cx = ti % MW, cy = (ti / MW) | 0; let best = this.field[ti], bx = -1, by = -1;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
            const v = this.field[ny * MW + nx]; if (v < best) { best = v; bx = nx; by = ny; }
          }
          if (bx >= 0) dir = Math.atan2(by * TILE + 20 - z.y, bx * TILE + 20 - z.x);
        } else if (z.horde && this.hordeCenter) dir = Math.atan2(this.hordeCenter.y - z.y, this.hordeCenter.x - z.x);
        else if (aware && target && td < 900) dir = Math.atan2(target.y - z.y, target.x - z.x);
        else if (z.aggro && z.lkx !== undefined && Math.hypot(z.lkx - z.x, z.lky - z.y) > 40) { dir = Math.atan2(z.lky - z.y, z.lkx - z.x); spd *= 0.85; } // heard something: go and look
        else if (z.aggro && z.lkx !== undefined) { z.aggro = false; z.lkx = undefined; z.wanderT = 0; dir = z.a; spd *= 0.4; } // nothing here
        else if (z.guard && Math.hypot(z.guard.x - z.x, z.guard.y - z.y) > 220) { dir = Math.atan2(z.guard.y - z.y, z.guard.x - z.x); spd *= 0.5; }
        else { z.wanderT -= dt; if (z.wanderT <= 0) { z.wanderT = 2 + Math.random() * 4; z.wander = Math.random() * 6.28; } dir = z.wander; spd *= 0.4; }
        // a building in the way? smash it
        const ax = z.x + Math.cos(dir) * (z.r + 12), ay = z.y + Math.sin(dir) * (z.r + 12);
        const ai = Math.floor(ay / TILE) * MW + Math.floor(ax / TILE);
        const sid = ai >= 0 && ai < MW * MH ? this.structAt[ai] : 0;
        const st = sid ? ws.sType[ai] : 0;
        if (sid && !WALKABLE_S[st] && !(DOORS[st] && ws.doorOpen[ai])) {
          z.a = dir;
          if (z.type === 5) { z.exploded = true; z.hp = 0; this.ev({ e: 'zdie', x: z.x, y: z.y, t: 5, by: 0 }); this.explode(z.x, z.y); continue; }
          if (z.atkCd <= 0) {
            z.atkCd = 1.0; const s = this.structs.get(sid);
            if (s) {
              this.damageStruct(s, T.sdmg); this.ev({ e: 'zsmash', x: ax, y: ay });
              if (s.hp > 0 && DOORS[st]) { // shoulder-charge the door open
                const big = z.type === 2 || z.type === 6, ch = st === 12 ? (big ? 0.22 : 0.05) : (big ? 0.55 : 0.2);
                if (Math.random() < ch) this.openDoor(s, 5);
              }
            }
          }
          continue;
        }
        // stuck handling
        z.stuckT += dt;
        if (z.stuckT > 0.8) { if (Math.hypot(z.x - z.lx, z.y - z.ly) < 8) { z.jitT = 0.5; z.jitA = dir + (Math.random() < 0.5 ? 1.3 : -1.3); } z.stuckT = 0; z.lx = z.x; z.ly = z.y; }
        if (z.jitT > 0) { z.jitT -= dt; dir = z.jitA; }
        z.a += angDiff(dir, z.a) * Math.min(1, dt * 8);
        moveCircle(ws, z, Math.cos(dir) * spd * dt, Math.sin(dir) * spd * dt, z.r, blockedZ);
        // separation
        const bx = Math.floor(z.x / 80), by = Math.floor(z.y / 80);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const b = bucket.get(((bx + ox) << 12) | (by + oy)); if (!b) continue;
          for (const o of b) {
            if (o === z || o.hp <= 0) continue;
            const dx = z.x - o.x, dy = z.y - o.y, d = Math.hypot(dx, dy), m = z.r + o.r;
            if (d > 0.01 && d < m) { const push = (m - d) * 0.3; z.x += dx / d * push; z.y += dy / d * push; }
          }
        }
        resolve(ws, z, z.r, blockedZ);
      }
      // remove dead and far zombies
      this.zombies = this.zombies.filter(z => {
        if (z.hp <= 0) return false;
        if (z.horde || z.job || z.bk) return true;
        let near = false; for (const p of this.players) if (Math.hypot(p.x - z.x, p.y - z.y) < 1900) { near = true; break; }
        return near;
      });
    }

    spawnLogic(dt) {
      if (this.peaceUntil > this.time && !this.evac.s) { this.hordeQueue = 0; return; }
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 0.35;
        const day = this.day(), night = this.isNight();
        for (const p of this.players) {
          if (p.dead || this.zombies.length >= 220) continue;
          let near = 0, deer = 0; for (const z of this.zombies) if (Math.hypot(z.x - p.x, z.y - p.y) < 1300) { if (z.type === 7) deer++; else near++; }
          const want = Math.round(((night ? 10 : 4) + Math.min(10, (day - 1) * 1.5)) * (this.bloodMoon && night ? 1.4 : 1));
          if (near < want) { const s = this.findSpawn(p.x, p.y, 720, 1100); if (s) { const zt = this.pickZType(); this.spawnZombie(s.x, s.y, zt, false); if (zt === 12) for (let q = 0; q < 3; q++) this.spawnZombie(s.x + (Math.random() - 0.5) * 80, s.y + (Math.random() - 0.5) * 80, 12, false); } }
          if (p.air && this.era() >= 2 && Math.random() < 0.025) { // birds love planes
            let nb = 0; for (const z of this.zombies) if (z.type === 12 && Math.abs(z.x - p.x) < 1400 && Math.abs(z.y - p.y) < 1400) nb++;
            if (nb < 12) { const a = p.a + (Math.random() - 0.5) * 1.2, d = 750 + Math.random() * 250; for (let q = 0; q < 5; q++) this.spawnZombie(clamp(p.x + Math.cos(a) * d + (Math.random() - 0.5) * 120, 80, WORLD - 80), clamp(p.y + Math.sin(a) * d + (Math.random() - 0.5) * 120, 80, WORLD - 80), 12, false); this.ev({ e: 'flock', id: p.id }); }
          }
          if (deer < (night ? 1 : 3) && Math.random() < 0.15) {
            const s = this.findSpawn(p.x, p.y, 750, 1150);
            if (s) { const tt = this.map.t[Math.floor(s.y / TILE) * MW + Math.floor(s.x / TILE)]; if (tt === T_GRASS || tt === T_FOREST || tt === T_FARM) this.spawnZombie(s.x, s.y, 7, false); }
          }
        }
      }
      // weather
      this.rainT -= dt;
      if (this.rainT <= 0) { if (this.rain) { this.rain = 0; this.rainT = 240 + Math.random() * 300; } else if (Math.random() < 0.4) { this.rain = 1; this.rainT = 90 + Math.random() * 120; this.ev({ e: 'rain', g: 1 }); } else this.rainT = 120 + Math.random() * 200; }
      // daily airdrop
      const tod = this.tod(), dday = this.day();
      if (tod > 70 && tod < DAY_LEN && this.lastDropDay < dday && this.players.some(p => !p.dead)) {
        this.lastDropDay = dday;
        const alive = this.players.filter(p => !p.dead), pl = alive[Math.floor(Math.random() * alive.length)];
        for (let k = 0; k < 60; k++) {
          const a = Math.random() * 6.283, d = 1400 + Math.random() * 1800, x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
          const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
          if (tx < 3 || ty < 3 || tx >= MW - 3 || ty >= MH - 3 || blockedZ(this.ws, tx, ty) || this.map.t[ty * MW + tx] === T_WATER) continue;
          const ad = { id: this.nextId++, x: tx * TILE + 20, y: ty * TILE + 20, land: this.time + 10, landed: false, until: this.time + CYCLE };
          this.airdrops.push(ad); this.ev({ e: 'airdrop', g: 1, x: ad.x, y: ad.y }); break;
        }
      }
      for (const ad of this.airdrops) if (!ad.landed && this.time >= ad.land) {
        ad.landed = true; this.ev({ e: 'dropland', g: 1, x: ad.x, y: ad.y });
        for (let k = 0; k < 6; k++) { const s = this.findSpawn(ad.x, ad.y, 250, 500); if (s) this.spawnZombie(s.x, s.y, this.pickZType(), false); }
      }
      this.airdrops = this.airdrops.filter(a => this.time < a.until);
      // night horde
      const night = this.isNight();
      if (night && !this.wasNight) {
        const day = this.day();
        let cx = 0, cy = 0, n = 0;
        for (const s of this.structs.values()) if (this.players.some(p => p.key === s.owner)) { cx += s.tx * TILE + 20; cy += s.ty * TILE + 20; n++; }
        if (!n) for (const p of this.players) { cx += p.x; cy += p.y; n++; }
        this.bossNight = day % 3 === 0;
        this.bloodMoon = day >= 2 && !this.bossNight && (day % 5 === 4 || Math.random() < 0.22);
        if (n) { this.hordeCenter = { x: cx / n, y: cy / n }; this.hordeQueue = Math.round((day <= 1 ? 4 : 3 + day * 4) * (this.bloodMoon ? 2 : 1)); this.hordeT = 0; }
        if (this.trader) { this.ev({ e: 'traderleft', g: 1 }); this.trader = null; }
        this.ev({ e: 'night', d: day, g: 1, hz: this.hordeQueue, boss: this.bossNight ? 1 : 0, bm: this.bloodMoon ? 1 : 0 });
      }
      if (!night && this.wasNight) {
        this.ev({ e: 'dawn', d: this.day(), g: 1, bm: this.bloodMoon ? 1 : 0 }); this.hordeQueue = 0; this.bloodMoon = false;
        const era = eraOf(this.day()); if (era > eraOf(this.day() - 1)) this.ev({ e: 'era', era, g: 1 });
        for (const z of this.zombies) z.horde = false;
        const camp = Math.min(8, this.rescued.filter(r => !r.on).length);
        if (camp) { for (const q of this.players) if (!q.bot && !q.dead) { this.invAdd(q, 'wood', 3 * camp); this.invAdd(q, 'stone', 2 * camp); this.invAdd(q, 'bullets', 5 * camp); this.invAdd(q, 'food', Math.ceil(camp / 2)); } this.ev({ e: 'campgift', g: 1, c: camp }); }
      }
      this.randomEvents(dt);
      this.wasNight = night;
      if (this.hordeQueue > 0 && this.hordeCenter) {
        this.hordeT -= dt;
        if (this.hordeT <= 0) {
          this.hordeT = 0.4;
          const s = this.findSpawn(this.hordeCenter.x, this.hordeCenter.y, 850, 1150);
          if (s) {
            if (this.bossNight) { this.bossNight = false; const bt = this.day() % 6 === 0 ? 11 : 6; this.spawnZombie(s.x, s.y, bt, true); this.ev({ e: 'boss', g: 1, t: bt }); }
            else { const r = Math.random(); this.spawnZombie(s.x, s.y, r < 0.12 + this.day() * 0.01 ? 2 : r < 0.3 ? 1 : this.pickZType(), true); }
            this.hordeQueue--;
          }
        }
      }
    }

    // ----- random events: crashed helicopter, wandering trader (blood moon is decided at nightfall) -----
    randomEvents(dt) {
      const tod = this.tod(), dday = this.day(), alive = this.players.filter(p => !p.dead);
      if (!alive.length) return;
      const pl = alive[Math.floor(Math.random() * alive.length)];
      if (dday >= 1 && tod > 100 && tod < DAY_LEN - 50 && this.lastHeliDay < dday) {
        this.lastHeliDay = dday;
        if (dday === 1 || Math.random() < 0.7) this.makeSite('heli', pl, dday);
      }
      if (this.era() >= 2 && tod > 45 && tod < DAY_LEN - 60 && (this.lastConvoyDay || 0) < dday) { this.lastConvoyDay = dday; this.makeSite('convoy', pl, dday); }
      if (this.era() >= 3 && tod > 150 && tod < DAY_LEN - 30 && (this.lastJetDay || 0) < dday) { this.lastJetDay = dday; this.makeSite('jet', pl, dday); }
      if (tod > 60 && tod < DAY_LEN - 40 && (this.lastSurvDay || 0) < dday) { this.lastSurvDay = dday; this.makeSite('surv', pl, dday); }
      this.heli = this.heli.filter(h => this.time < h.until);
      // wandering trader: comes to a town in the morning, leaves at nightfall
      if (dday >= 2 && tod > 25 && tod < 90 && this.lastTraderDay < dday) {
        this.lastTraderDay = dday;
        const towns = this.map.towns.filter(o => o.kind === 'town');
        if (towns.length && Math.random() < 0.75) {
          towns.sort((a, b) => Math.hypot(a.x * TILE - pl.x, a.y * TILE - pl.y) - Math.hypot(b.x * TILE - pl.x, b.y * TILE - pl.y));
          const o = towns[Math.min(towns.length - 1, Math.floor(Math.random() * 2))];
          let spot = null;
          for (let r = 0; r < 10 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r; dx++) {
            const tx = o.x + dx, ty = o.y + dy, i = ty * MW + tx;
            if (tx < 1 || ty < 1 || tx >= MW - 1 || ty >= MH - 1) continue;
            if (this.map.t[i] === T_ROAD && !this.ws.nodeAlive[i] && !this.ws.sType[i] && !this.map.solid[i]) { spot = { x: tx * TILE + 20, y: ty * TILE + 20 }; break; }
          }
          if (spot) { this.trader = { x: spot.x, y: spot.y, a: Math.random() * 6.283, offers: this.makeOffers(), town: o.name || 'town' }; this.ev({ e: 'trader', g: 1, x: spot.x, y: spot.y, town: this.trader.town }); }
        }
      }
    }
    // ----- workbench: guns, ammo, attachments and war machines -----
    nearBench(p) { for (const s of this.structs.values()) if (s.type === 'bench' && Math.hypot(s.tx * TILE + 20 - p.x, s.ty * TILE + 20 - p.y) < 120) return s; return null; }
    benchCraft(p, key) {
      const R = BENCH[key]; if (!R || p.dead || p.down) return;
      const bench = this.nearBench(p); if (!bench) return;
      if (this.era() < R.era) { this.ev({ e: 'nobench', id: p.id, why: 'Unlocks in Era ' + R.era + ' (' + ERAS[R.era].name + ')' }); return; }
      if (!this.canAfford(p, R.cost)) { this.ev({ e: 'nobench', id: p.id, why: 'Not enough materials' }); return; }
      const bx = bench.tx * TILE + 20, by = bench.ty * TILE + 20;
      if (R.veh) {
        const spot = VT[R.veh].boat ? this.waterSpot(bx, by, VT[R.veh].r + 4) : this.vehicleSpot(bx, by, VT[R.veh].r + 6);
        if (!spot) { this.ev({ e: 'nobench', id: p.id, why: VT[R.veh].boat ? 'No water close enough — build your workbench near a lake, river or the sea' : 'No room to roll it out — clear space around the workbench' }); return; }
        if (R.veh === 4) p.st.tank = 1; if (R.veh === 5) p.st.jet = 1; if (R.veh === 7) p.st.sboat = 1;
        this.pay(p, R.cost);
        const v = this.newVehicle(R.veh, spot.x, spot.y, spot.a); v.fuel = 100;
        this.addXp(p, 150);
        this.ev({ e: 'built', g: 1, n: p.name, w: R.name, x: spot.x, y: spot.y, veh: R.veh });
        return;
      }
      if (R.cat === 'car') {
        const U = CAR_UPS[R.up]; let veh = null, bd = 340;
        for (const v of this.vehicles) { const T3 = VT[v.type]; if (T3.boat || T3.jet || T3.heli) continue; const d = Math.hypot(v.x - bx, v.y - by); if (d < bd) { bd = d; veh = v; } }
        if (!veh) { this.ev({ e: 'nobench', id: p.id, why: 'Park a car, truck, bike or tank next to the workbench first' }); return; }
        if (veh.up & U.bit) { this.ev({ e: 'nobench', id: p.id, why: 'That ' + VT[veh.type].name + ' already has ' + U.name }); return; }
        this.pay(p, R.cost); veh.up = (veh.up || 0) | U.bit; if (U.bit === 2) veh.hp += VT[veh.type].hp * 0.6;
        this.ev({ e: 'carup', id: p.id, x: veh.x, y: veh.y, n: U.name, v: VT[veh.type].name }); this.addXp(p, 30); return;
      }
      if (R.cat === 'evac') {
        if (this.evac.s) { this.ev({ e: 'nobench', id: p.id, why: 'The evac helicopter is already on its way!' }); return; }
        if (this.day() < (this.evac.next || 0)) { this.ev({ e: 'nobench', id: p.id, why: 'Nobody answers the radio — try again tomorrow' }); return; }
        this.pay(p, R.cost); this.evac.fixed = 1; this.addXp(p, 100); this.callEvac(p, bx, by); return;
      }
      this.pay(p, R.cost);
      if (R.cat === 'gun') { p.st.gc = (p.st.gc || 0) + 1; const rar = p.perks.builder ? 2 : 1; this.invAdd(p, key, 1, false, gunStats(key, rar, 0).mag, rar, 0); this.ev({ e: 'crafted', id: p.id, w: fullName(key, rar), r: rar, x: p.x, y: p.y }); this.addXp(p, 20); }
      else { for (const k in R.give) this.invAdd(p, k, R.give[k]); const k0 = Object.keys(R.give)[0]; this.ev({ e: 'crafted', id: p.id, w: R.give[k0] + ' ' + itemName(k0), r: 0, x: p.x, y: p.y }); }
    }
    reveal(cx, cy, R) {
      for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
        if (x < 0 || y < 0 || x >= MW || y >= MH || (x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        const i = y * MW + x; if (!this.explored[i]) { this.explored[i] = 1; this.D.ex.push(i); }
      }
    }
    vehicleSpot(x, y, r) {
      for (let ring = 70; ring <= 260; ring += 30) for (let k = 0; k < 16; k++) {
        const a = k / 16 * 6.283, vx = x + Math.cos(a) * ring, vy = y + Math.sin(a) * ring;
        if (!overlaps(this.ws, vx, vy, r, blockedP) && !this.vehicles.some(v => Math.hypot(v.x - vx, v.y - vy) < r + VT[v.type].r)) return { x: vx, y: vy, a };
      }
      return null;
    }
    waterSpot(x, y, r) { // the nearest open water to launch a boat
      for (let ring = 60; ring <= 1100; ring += 36) for (let k = 0; k < 28; k++) {
        const a = k / 28 * 6.283, vx = x + Math.cos(a) * ring, vy = y + Math.sin(a) * ring;
        if (!overlaps(this.ws, vx, vy, r, blockedBoat) && !this.vehicles.some(v => Math.hypot(v.x - vx, v.y - vy) < r + VT[v.type].r)) return { x: vx, y: vy, a };
      }
      return null;
    }
    newVehicle(type, x, y, a, color) {
      const v = { id: this.nextId++, type, x, y, a, v: 0, hp: VT[type].hp, fuel: 60, driver: 0, gunner: 0, ta: a, ca: a, heat: 0, over: false, alt: 0, bombs: 6, cd: 0, color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], runT: 0 };
      this.vehicles.push(v); return v;
    }
    makeSite(kind, pl, dday) {
      const road = kind === 'convoy';
      if (kind === 'surv') { // a stranded survivor — often out on an island
        const used = new Set(this.rescued.map(r => r.n).concat(this.players.map(q => q.name)).concat(this.heli.filter(h => h.sv).map(h => h.sv.n)));
        const sv = { n: SURV_NAMES.find(nm => !used.has(nm)) || SURV_NAMES[Math.floor(Math.random() * SURV_NAMES.length)] + (this.rescued.length + 2), role: ROLE_KEYS[Math.floor(Math.random() * ROLE_KEYS.length)] };
        const isl = this.map.islands.filter(o => !this.heli.some(h => h.kind === 'surv' && Math.hypot(h.x - (o.x * TILE + 20), h.y - (o.y * TILE + 20)) < 400));
        if (isl.length && Math.random() < 0.6) {
          const o = isl[Math.floor(Math.random() * isl.length)];
          for (const [ox, oy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
            const tx = o.x + ox, ty = o.y + oy, i = ty * MW + tx; if (this.map.t[i] === T_WATER || this.map.solid[i] || this.ws.sType[i]) continue;
            if (this.ws.nodeAlive[i]) { this.ws.nodeAlive[i] = 0; this.removed.set(i, this.time + CYCLE * 2); this.D.nr.push(i); }
            const hx = tx * TILE + 20, hy = ty * TILE + 20;
            this.heli.push({ id: this.nextId++, kind, x: hx, y: hy, a: 0, sv, isl: 1, boxes: [{ x: hx, y: hy, open: 0 }, { x: hx + 34, y: hy - 30, open: 0 }], until: this.time + CYCLE * 2 });
            for (let q = 0; q < Math.min(6, 1 + dday); q++) { const sp = this.findSpawn(hx, hy, 90, 240); if (sp) this.spawnZombie(sp.x, sp.y, this.pickZType(), false).guard = { x: hx, y: hy }; }
            this.ev({ e: 'surv', g: 1, x: hx, y: hy, n: sv.n, role: ROLES[sv.role].name, isl: 1 });
            return;
          }
        }
      }
      for (let k = 0; k < 160; k++) {
        const a = Math.random() * 6.283, d = 1200 + Math.random() * 1500, x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        if (tx < 6 || ty < 6 || tx >= MW - 6 || ty >= MH - 6) continue;
        if (road && this.map.t[ty * MW + tx] !== T_ROAD && k < 140) continue;
        let bad = false; for (let oy = -2; oy <= 2 && !bad; oy++) for (let ox = -2; ox <= 2; ox++) { const i = (ty + oy) * MW + tx + ox, t = this.map.t[i]; if (t === T_WATER || t === T_BWALL || this.map.solid[i] || this.ws.sType[i]) { bad = true; break; } }
        if (bad) continue;
        const hx = tx * TILE + 20, hy = ty * TILE + 20, ha = Math.random() * 6.283;
        for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { const i = (ty + oy) * MW + tx + ox; if (this.ws.nodeAlive[i]) { this.ws.nodeAlive[i] = 0; this.removed.set(i, this.time + CYCLE * 2); this.D.nr.push(i); } }
        const spots = kind === 'heli' ? [[-62, 46], [64, 50], [6, -70]] : kind === 'convoy' ? [[-20, 58], [40, -58]] : kind === 'surv' ? [[0, 0], [46, -34]] : [[-70, 40], [70, 40]];
        const boxes = spots.map(([bx, by]) => ({ x: hx + bx * Math.cos(ha) - by * Math.sin(ha), y: hy + bx * Math.sin(ha) + by * Math.cos(ha), open: 0 }));
        const sv0 = kind === 'surv' ? { n: SURV_NAMES.find(nm => !this.rescued.some(r => r.n === nm) && !this.players.some(q => q.name === nm) && !this.heli.some(h2 => h2.sv && h2.sv.n === nm)) || 'Survivor', role: ROLE_KEYS[Math.floor(Math.random() * ROLE_KEYS.length)] } : null;
        this.heli.push({ id: this.nextId++, kind, x: hx, y: hy, a: ha, boxes, until: this.time + CYCLE * (sv0 ? 2 : 1), sv: sv0 });
        const n = sv0 ? Math.min(12, 3 + dday) : Math.min(20, (kind === 'heli' ? 7 : 9) + dday), era = this.era();
        for (let q = 0; q < n; q++) {
          const sp = this.findSpawn(hx, hy, 140, 380); if (!sp) continue;
          const type = kind === 'surv' ? this.pickZType() : kind === 'heli' ? (q === 0 && dday >= 2 ? 2 : this.pickZType()) : q === 0 && era >= 4 ? 10 : q === 1 && era >= 3 ? 9 : q < 6 ? 8 : this.pickZType();
          const z = this.spawnZombie(sp.x, sp.y, type, false); z.guard = { x: hx, y: hy };
        }
        this.ev(sv0 ? { e: 'surv', g: 1, x: hx, y: hy, n: sv0.n, role: ROLES[sv0.role].name, isl: 0 } : { e: kind === 'heli' ? 'heli' : kind, g: 1, x: hx, y: hy });
        return;
      }
    }
    makeOffers() {
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const guns = ['pistol', 'revolver', 'shotgun', 'smg', 'ak', 'm4', 'rifle', 'sniper'];
      const offers = [
        { c: { scrap: 6 }, k: 'bullets', n: 40 },
        { c: { scrap: 4, wood: 8 }, k: 'medkit', n: 1 },
        { c: { scrap: 14 }, k: pick(guns), n: 1, r: 1 },
        { c: { scrap: 30, stone: 10 }, k: pick(guns.slice(3)), n: 1, r: 2 },
        { c: { scrap: 12 }, k: pick(['scope', 'silencer', 'extmag']), n: 1 },
      ];
      const extra = [
        { c: { scrap: 60, stone: 30 }, k: pick(['ak', 'm4', 'sniper']), n: 1, r: 3 },
        { c: { scrap: 9 }, k: 'grenade', n: 2 },
        { c: { wood: 16 }, k: 'fuel', n: 2 },
        { c: { scrap: 5 }, k: 'food', n: 3 },
      ];
      offers.push(pick(extra.slice(0, 2)), pick(extra.slice(2)));
      return offers;
    }
    trade(p, i) {
      const T2 = this.trader; if (!T2 || p.dead || p.down) return;
      const o = T2.offers[i]; if (!o || o.sold || Math.hypot(T2.x - p.x, T2.y - p.y) > 150) return;
      if (!this.canAfford(p, o.c)) { this.ev({ e: 'nobuy', id: p.id }); return; }
      this.pay(p, o.c);
      if (WEAPONS[o.k]) { this.invAdd(p, o.k, 1, false, gunStats(o.k, o.r, 0).mag, o.r || 0, 0); o.sold = 1; }
      else p.inv[o.k] = (p.inv[o.k] || 0) + o.n;
      this.ev({ e: 'bought', id: p.id, w: fullName(o.k, o.r || 0) + (o.n > 1 ? ' x' + o.n : ''), r: o.r || 0, x: p.x, y: p.y });
    }

    updateRockets(dt) {
      for (let i = this.rockets.length - 1; i >= 0; i--) {
        const r = this.rockets[i]; r.life -= dt; let boom = r.life <= 0;
        if (r.kind === 'bomb') { r.x += r.vx * dt; r.y += r.vy * dt; r.vx *= Math.pow(0.4, dt); r.vy *= Math.pow(0.4, dt); }
        else if (r.arc) { r.x += r.vx * dt; r.y += r.vy * dt; } // lobbed over walls
        else {
          const n = Math.max(1, Math.ceil(Math.hypot(r.vx, r.vy) * dt / 16));
          for (let k = 0; k < n && !boom; k++) {
            r.x += r.vx * dt / n; r.y += r.vy * dt / n;
            const tx = Math.floor(r.x / TILE), ty = Math.floor(r.y / TILE), st = tx >= 0 && ty >= 0 && tx < MW && ty < MH ? this.ws.sType[ty * MW + tx] : 0;
            if (blocksBullet(this.ws, r.x, r.y) || (SOLID_P[st] && st !== 3) || DOORS[st]) { boom = true; break; }
            for (const z of this.zombies) if (z.hp > 0 && Math.abs(z.x - r.x) < z.r + 6 && Math.abs(z.y - r.y) < z.r + 6 && Math.hypot(z.x - r.x, z.y - r.y) < z.r + 5) { boom = true; break; }
          }
        }
        if (boom) {
          this.rockets.splice(i, 1); this.blast(r.x, r.y, r.rad, r.zd, r.pd, r.sd, this.byId(r.by), r.kind === 'bomb' || r.kind === 'shell' || r.kind === 'car' || r.kind === 'boulder' ? 2 : 1);
          if (r.car) { const sp = this.vehicleSpot(r.x, r.y, VT[r.car[0]].r + 4); if (sp) { const v = this.newVehicle(r.car[0], sp.x, sp.y, Math.random() * 6.28, r.car[1]); v.hp = Math.max(20, r.car[2] * 0.3); v.fuel = r.car[3]; } }
        }
      }
    }
    updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.life -= dt; let dead = b.life <= 0;
        const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 18));
        for (let k = 0; k < n && !dead; k++) {
          b.x += b.vx * dt / n; b.y += b.vy * dt / n;
          if (blocksBullet(this.ws, b.x, b.y)) { dead = true; this.ev({ e: 'spark', x: b.x, y: b.y }); break; }
          for (const z of this.zombies) {
            if (z.hp <= 0 || b.hit.includes(z.id)) continue;
            if (Math.abs(z.x - b.x) > z.r + 4 || Math.abs(z.y - b.y) > z.r + 4) continue;
            if (Math.hypot(z.x - b.x, z.y - b.y) < z.r + 3) {
              b.hit.push(z.id); this.hurtZombie(z, b.dmg, b.by ? this.byId(b.by) : null, b.x, b.y);
              if (b.harp && z.hp > 0 && !ZT[z.type].boss) { const sh = this.byId(b.harp); if (sh) { z.pullT = this.time + 0.5; z.pux = sh.x; z.puy = sh.y; this.ev({ e: 'harp', x: z.x, y: z.y, id: sh.id }); } }
              if (b.hit.length >= b.pierce) { dead = true; break; }
            }
          }
        }
        if (dead) this.bullets.splice(i, 1);
      }
    }

    updateStructs(dt) {
      for (const s of this.structs.values()) {
        if (s.type === 'mortar') { this.mortarTick(s, dt); continue; }
        if (s.type === 'slight') { this.lightTick(s, dt); continue; }
        if (s.type === 'ftrap') { this.trapTick(s, dt); continue; }
        if (s.type !== 'turret') continue;
        s.cd -= dt; if (s.cd > 0) continue;
        const x = s.tx * TILE + 20, y = s.ty * TILE + 20;
        let best = null, bd = 380;
        for (const z of this.zombies) { if (z.hp <= 0 || z.type === 7) continue; const d = Math.hypot(z.x - x, z.y - y); if (d < bd && losClear(this.ws, x, y, z.x, z.y)) { bd = d; best = z; } }
        if (!best) { s.cd = 0.3; continue; }
        s.cd = 0.45; const a = Math.atan2(best.y - y, best.x - x); s.a = a;
        const owner = this.players.find(p => p.key === s.owner);
        this.bullets.push({ x: x + Math.cos(a) * 22, y: y + Math.sin(a) * 22, vx: Math.cos(a) * 1100, vy: Math.sin(a) * 1100, life: 0.45, dmg: 16, by: owner ? owner.id : 0, pierce: 1, hit: [], k: 1 });
        this.ev({ e: 'tshot', x, y, a, sid: s.id });
      }
    }

    mortarTick(s, dt) {
      s.cd = (s.cd || 0) - dt; if (s.cd > 0) return;
      const x = s.tx * TILE + 20, y = s.ty * TILE + 20;
      let best = null, bs = 0, n = 0;
      for (const z of this.zombies) {
        if (z.hp <= 0 || z.type === 7 || ZT[z.type].fly) continue;
        const d = Math.hypot(z.x - x, z.y - y); if (d < 240 || d > 950) continue;
        if (++n > 60) break;
        let c = ZT[z.type].boss ? 5 : 1; for (const o of this.zombies) if (o !== z && Math.abs(o.x - z.x) < 110 && Math.abs(o.y - z.y) < 110) c++;
        if (c > bs) { bs = c; best = z; }
      }
      if (!best) { s.cd = 0.8; return; }
      s.cd = 3.2; s.a = Math.atan2(best.y - y, best.x - x);
      const tx = best.x + (Math.random() - 0.5) * 40, ty = best.y + (Math.random() - 0.5) * 40, T = 1.1 + Math.hypot(tx - x, ty - y) / 1400;
      const owner = this.players.find(p => p.key === s.owner);
      this.rockets.push({ x, y, vx: (tx - x) / T, vy: (ty - y) / T, life: T, T, by: owner ? owner.id : 0, kind: 'mshell', arc: 1, rad: 115, zd: 170, pd: 0, sd: 0 });
      this.ev({ e: 'mortar', x, y, a: Math.round(s.a * 100) / 100, sid: s.id }); this.noise(x, y, 900);
    }
    lightTick(s, dt) {
      const x = s.tx * TILE + 20, y = s.ty * TILE + 20;
      if (s.a === undefined) s.a = (s.id % 6);
      if (!this.isNight()) { s.a += dt * 0.25; s.lock = null; return; }
      s.cd = (s.cd || 0) - dt;
      if (s.cd <= 0) {
        s.cd = 0.25; s.lock = null; let bd = 580;
        for (const z of this.zombies) { if (z.hp <= 0 || z.type === 7) continue; const d = Math.hypot(z.x - x, z.y - y); if (d < bd && losClear(this.ws, x, y, z.x, z.y)) { bd = d; s.lock = z; } }
        for (const z of this.zombies) { if (z.hp <= 0) continue; const d = Math.hypot(z.x - x, z.y - y); if (d < 620 && Math.abs(angDiff(Math.atan2(z.y - y, z.x - x), s.a)) < 0.24) z.litT = this.time + 0.4; }
      }
      if (s.lock && s.lock.hp > 0) s.a += angDiff(Math.atan2(s.lock.y - y, s.lock.x - x), s.a) * Math.min(1, dt * 4);
      else s.a += dt * 0.7;
      if (s.a > Math.PI) s.a -= 2 * Math.PI; else if (s.a < -Math.PI) s.a += 2 * Math.PI;
    }
    trapTick(s, dt) {
      const x = s.tx * TILE + 20, y = s.ty * TILE + 20;
      if (s.fireT > this.time) {
        const owner = this.players.find(p => p.key === s.owner) || null;
        for (const z of this.zombies) {
          if (z.hp <= 0 || ZT[z.type].fly || Math.abs(z.x - x) > 80 || Math.hypot(z.x - x, z.y - y) > 72 + z.r * 0.5) continue;
          z.burnT = Math.max(z.burnT || 0, this.time + 3); z.burnBy = owner ? owner.id : 0; z.hp -= 32 * dt; z.hitT = Math.max(z.hitT, 0.05);
          if (z.hp <= 0) { z.hp = 0.01; this.hurtZombie(z, 1, owner, z.x, z.y, true); }
        }
        return;
      }
      s.cd = (s.cd || 0) - dt; if (s.cd > 0) return;
      s.cd = 0.2;
      for (const z of this.zombies) if (z.hp > 0 && z.type !== 7 && !ZT[z.type].fly && Math.abs(z.x - x) < 48 && Math.abs(z.y - y) < 48) { s.fireT = this.time + 1.6; s.cd = 4.5; this.ev({ e: 'ftrap', x, y }); this.noise(x, y, 400); break; }
    }

    // ----- dog companion: tame a stray with food; it fights, sniffs out loot and follows you -----
    newDog(x, y, owner, name, hp) {
      return { id: this.nextId++, x, y, a: Math.random() * 6.28, hp: Math.min(150, hp || 150), mhp: 150, owner, name: name || DOG_NAMES[Math.floor(Math.random() * DOG_NAMES.length)], st: 0, atkCd: 0, downT: 0, sniffT: 5 + Math.random() * 5, r: 12, dog: true, wanderT: 0, wander: 0, sn: -1, snT: 0, oid: 0, barkT: 3 };
    }
    hurtDog(d, dmg) {
      if (d.down || !d.owner) return;
      d.hp -= dmg; this.ev({ e: 'doghurt', x: d.x, y: d.y });
      if (d.hp <= 0) { d.hp = 0; d.down = true; d.downT = 25; d.st = 3; this.ev({ e: 'dogdown', id: d.oid, n: d.name, x: d.x, y: d.y }); }
    }
    dogMove(d, tx, ty, spd, dt, stop) {
      const dd = Math.hypot(tx - d.x, ty - d.y); if (dd <= (stop || 0)) return dd;
      const a = Math.atan2(ty - d.y, tx - d.x); d.a += angDiff(a, d.a) * Math.min(1, dt * 10);
      const st = Math.min(spd * dt, dd - (stop || 0));
      const ox = d.x, oy = d.y; moveCircle(this.ws, d, Math.cos(a) * st, Math.sin(a) * st, d.r, blockedSw);
      if (Math.hypot(d.x - ox, d.y - oy) < st * 0.3) { d.stuckT = (d.stuckT || 0) + dt; if (d.stuckT > 0.5) { const b = a + (Math.random() < 0.5 ? 1.4 : -1.4); moveCircle(this.ws, d, Math.cos(b) * spd * dt, Math.sin(b) * spd * dt, d.r, blockedSw); } } else d.stuckT = 0;
      return dd;
    }
    updateDogs(dt) {
      this.dogT = (this.dogT || 8) - dt;
      if (this.dogT <= 0) { // strays turn up near people who don't have a dog yet
        this.dogT = 25;
        const strays = this.dogs.filter(d => !d.owner).length;
        for (const p of this.players) {
          if (strays >= 4 || p.bot || p.dead || p.vehicle || p.swim) continue;
          if (this.dogs.some(d => d.owner === p.key || (!d.owner && Math.hypot(d.x - p.x, d.y - p.y) < 2400))) continue;
          if (Math.random() < 0.45) continue;
          const s = this.findSpawn(p.x, p.y, 380, 700); if (!s) continue;
          this.dogs.push(this.newDog(s.x, s.y, null)); this.ev({ e: 'stray', id: p.id }); break;
        }
      }
      for (const d of this.dogs) {
        if (!d.owner) { // a stray: comes over and waits to be fed
          let near = null, nd = 1e9; for (const p of this.players) { if (p.dead || p.bot) continue; const q = Math.hypot(p.x - d.x, p.y - d.y); if (q < nd) { nd = q; near = p; } }
          if (!near || nd > 3200) { d.gone = true; continue; }
          if (nd < 420) {
            if (this.dogMove(d, near.x, near.y, 130, dt, 64) <= 66) { d.st = 4; d.a += angDiff(Math.atan2(near.y - d.y, near.x - d.x), d.a) * Math.min(1, dt * 6); } else d.st = 1;
            d.barkT -= dt; if (d.barkT <= 0) { d.barkT = 7 + Math.random() * 5; this.ev({ e: 'woof', x: d.x, y: d.y }); }
          } else { d.wanderT -= dt; if (d.wanderT <= 0) { d.wanderT = 2 + Math.random() * 3; d.wander = Math.random() * 6.28; } this.dogMove(d, d.x + Math.cos(d.wander) * 50, d.y + Math.sin(d.wander) * 50, 70, dt); d.st = 1; }
          continue;
        }
        const own = this.players.find(p => p.key === d.owner);
        if (!own) { d.gone = true; continue; }
        d.oid = own.id;
        if (d.down) { d.downT -= dt; d.st = 3; if (d.downT <= 0) { d.down = false; d.hp = d.mhp * 0.5; this.ev({ e: 'dogup', id: own.id, n: d.name, x: d.x, y: d.y }); } continue; }
        d.hp = Math.min(d.mhp, d.hp + 2 * dt); d.atkCd -= dt;
        const od = Math.hypot(own.x - d.x, own.y - d.y);
        if (own.vehicle || own.esc) { d.ride = true; d.x = own.x; d.y = own.y; d.st = 0; continue; }
        if (d.ride || od > 1100) { d.ride = false; const bx = own.x - Math.cos(own.a) * 36, by = own.y - Math.sin(own.a) * 36; if (!overlaps(this.ws, bx, by, d.r, blockedSw)) { d.x = bx; d.y = by; } else { d.x = own.x; d.y = own.y; } }
        if (own.dead) { d.st = 4; continue; }
        // fight zombies close to you
        let foe = null, fd = 300;
        for (const z of this.zombies) {
          if (z.hp <= 0 || (ZT[z.type].fly && Math.hypot(z.x - d.x, z.y - d.y) > 60)) continue;
          if (Math.abs(z.x - own.x) > 480 || Math.abs(z.y - own.y) > 480) continue;
          const q = Math.hypot(z.x - d.x, z.y - d.y); if (q < fd && Math.hypot(z.x - own.x, z.y - own.y) < 470) { fd = q; foe = z; }
        }
        if (foe) {
          d.st = 1; this.dogMove(d, foe.x, foe.y, 255, dt, foe.r + 8);
          if (fd < foe.r + 20 && d.atkCd <= 0) { d.atkCd = 0.6; d.st = 2; this.hurtZombie(foe, 24 * (1 + 0.04 * (own.lvl - 1)), own, foe.x, foe.y); this.ev({ e: 'bite', x: d.x, y: d.y }); }
          continue;
        }
        // sniff out loot nearby
        d.sniffT -= dt;
        if (d.sniffT <= 0) {
          d.sniffT = 15; let best = -1, bd = 820;
          for (let i = 0; i < this.map.crates.length; i++) { if (this.crateOpen[i]) continue; const c = this.map.crates[i], cx = c.tx * TILE + 20, cy = c.ty * TILE + 20; if (Math.abs(cx - own.x) > bd || Math.abs(cy - own.y) > bd) continue; const q = Math.hypot(cx - own.x, cy - own.y); if (q < bd && q > 90) { bd = q; best = i; } }
          if (best >= 0) { d.sn = best; d.snT = 14; const c = this.map.crates[best]; this.ev({ e: 'sniff', id: own.id, n: d.name, x: c.tx * TILE + 20, y: c.ty * TILE + 20 }); }
        }
        if (d.sn >= 0) {
          d.snT -= dt;
          if (d.snT <= 0 || this.crateOpen[d.sn] || od > 700) d.sn = -1;
          else { const c = this.map.crates[d.sn]; const q = this.dogMove(d, c.tx * TILE + 20, c.ty * TILE + 20, 230, dt, 34); d.st = q < 40 ? 4 : 1; if (q < 40) { d.barkT -= dt; if (d.barkT <= 0) { d.barkT = 2.5; this.ev({ e: 'woof', x: d.x, y: d.y }); } } continue; }
        }
        // follow you
        const fx = own.x - Math.cos(own.a) * 44 + Math.cos(own.a + 1.6) * 22, fy = own.y - Math.sin(own.a) * 44 + Math.sin(own.a + 1.6) * 22;
        if (Math.hypot(fx - d.x, fy - d.y) > 34) { this.dogMove(d, fx, fy, od > 220 ? 320 : 215, dt, 10); d.st = 1; }
        else { d.st = 0; d.a += angDiff(own.a, d.a) * Math.min(1, dt * 3); }
      }
      if (this.dogs.some(d => d.gone)) this.dogs = this.dogs.filter(d => !d.gone);
    }

    // ----- Haven: a safe town with a shop and a job board -----
    pickHaven() {
      const towns = (this.map.towns || []).filter(o => o.kind === 'town'); if (!towns.length) return null;
      const sx = this.map.spawn.x / TILE, sy = this.map.spawn.y / TILE;
      const sorted = towns.map(o => [Math.hypot(o.x - sx, o.y - sy), o]).sort((a, b) => a[0] - b[0]);
      const o = (sorted.find(e => e[0] > 40) || sorted[sorted.length - 1])[1];
      let best = null, bd = 1e9;
      for (let oy = -14; oy <= 14; oy++) for (let ox = -14; ox <= 14; ox++) {
        const tx = Math.round(o.x) + ox, ty = Math.round(o.y) + oy; if (tx < 2 || ty < 2 || tx >= MW - 2 || ty >= MH - 2) continue;
        const i = ty * MW + tx; if (this.map.t[i] !== T_ROAD || this.map.solid[i] || this.map.node[i]) continue;
        const d = Math.hypot(ox, oy); if (d < bd) { bd = d; best = { x: tx * TILE + 20, y: ty * TILE + 20 }; }
      }
      if (!best) return null;
      return { x: best.x, y: best.y, r: clamp((o.size || 20) * TILE * 0.55, 440, 900), name: 'HAVEN' };
    }
    nearHaven(p) { return this.haven && Math.hypot(this.haven.x - p.x, this.haven.y - p.y) < 260; }
    havenBuy(p, i) {
      const it = SHOP[i]; if (!it || !this.nearHaven(p)) return;
      const [k, n, cost] = it; if ((p.cash | 0) < cost) { this.ev({ e: 'note', id: p.id, t: 'Not enough cash' }); return; }
      if (WEAPONS[k]) { if (!this.giveGun(p, k, 0)) { this.ev({ e: 'note', id: p.id, t: 'You already have a ' + WEAPONS[k].name }); return; } }
      else p.inv[k] = (p.inv[k] || 0) + n;
      p.cash -= cost; this.ev({ e: 'buy', id: p.id, k, n });
    }
    havenSell(p, k) {
      if (!SELL[k] || !this.nearHaven(p)) return;
      const n = Math.min(k === 'bullets' ? 30 : 10, p.inv[k] || 0); if (n <= 0) return;
      p.inv[k] -= n; p.cash += n * SELL[k]; this.ev({ e: 'sold', id: p.id, k, n, c: n * SELL[k] });
    }
    havenSkin(p, k) {
      const S2 = SKINS[k]; if (!S2 || !S2.cash || p.unl[k] || !this.nearHaven(p)) return;
      if ((p.cash | 0) < S2.cash) { this.ev({ e: 'note', id: p.id, t: 'Not enough cash' }); return; }
      p.cash -= S2.cash; p.unl[k] = 1; if (S2.h) p.skin.h = k; else p.skin.o = k; this.ev({ e: 'buy', id: p.id, k, n: 1 });
    }
    skinOk(p, k) {
      const S2 = SKINS[k]; if (!S2) return false;
      if (S2.goal) return p.goal >= S2.goal; if (S2.cash) return !!p.unl[k]; if (S2.esc) return !!(p.st.escaped); if (S2.king) return !!p.unl.crown; if (S2.resc) return this.rescued.length >= S2.resc;
      return true;
    }
    // ----- jobs from the Haven board: the whole team works on one job at a time -----
    makeJobs() {
      const H = this.haven; if (!H) return [];
      const day = this.day(), out = [], kinds = JOB_KINDS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      const spotAt = (dmin, dmax) => { for (let k = 0; k < 80; k++) { const a = Math.random() * 6.283, d = dmin + Math.random() * (dmax - dmin), x = H.x + Math.cos(a) * d, y = H.y + Math.sin(a) * d; const s = this.vehicleSpot(x, y, 30); if (s && this.map.t[Math.floor(s.y / TILE) * MW + Math.floor(s.x / TILE)] !== T_WATER) return s; } return null; };
      for (const k of kinds) {
        let s = null;
        if (k === 'defend') { const pm = this.map.pumps.filter(q => { const d = Math.hypot(q.x - H.x, q.y - H.y); return d > 900 && d < 7000; }); if (pm.length) { const q = pm[Math.floor(Math.random() * pm.length)]; s = { x: q.x + 60, y: q.y + 60 }; } }
        if (!s) s = spotAt(k === 'deliver' ? 2000 : 1200, k === 'deliver' ? 6500 : 5000);
        if (!s) continue;
        const cash = (k === 'hunt' ? 220 : k === 'defend' ? 200 : k === 'deliver' ? 170 : 150) + day * 15;
        const text = k === 'clear' ? 'Clear out a zombie nest' : k === 'defend' ? 'Defend the gas station for 90 s' : k === 'deliver' ? 'Deliver a supply crate to survivors' : 'Hunt down BIG MIKE, an elite zombie';
        out.push({ k, x: Math.round(s.x), y: Math.round(s.y), cash, xp: 150 + day * 10, text, n: Math.min(40, 10 + day * 2), t: 0 });
      }
      return out;
    }
    takeJob(p, i) {
      if (!this.nearHaven(p)) return;
      if (this.job) { this.ev({ e: 'note', id: p.id, t: 'Finish (or cancel) the current job first' }); return; }
      const J = this.jobs[i]; if (!J) return;
      this.jobs.splice(i, 1); this.job = J; J.by = p.name;
      if (J.k === 'deliver') { p.pkg = 1; J.carrier = p.key; }
      this.ev({ e: 'jobon', g: 1, n: p.name, t: J.text, x: J.x, y: J.y });
    }
    jobTick(dt) {
      if (this.haven && this.jobDay !== this.day()) { this.jobDay = this.day(); this.jobs = this.makeJobs(); }
      const J = this.job; if (!J) return;
      const humans = this.players.filter(q => !q.bot && !q.dead);
      const near = (r) => humans.some(q => Math.hypot(q.x - J.x, q.y - J.y) < r);
      const spotNear = (rad) => { for (let k = 0; k < 30; k++) { const a = Math.random() * 6.283, d = Math.random() * rad, x = J.x + Math.cos(a) * d, y = J.y + Math.sin(a) * d, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx > 1 && ty > 1 && tx < MW - 1 && ty < MH - 1 && !blockedZ(this.ws, tx, ty)) return { x: tx * TILE + 20, y: ty * TILE + 20 }; } return { x: J.x, y: J.y }; };
      let done = false;
      if (J.k === 'clear' || J.k === 'hunt') {
        if (!J.spawned && near(1000)) {
          J.spawned = 1;
          if (J.k === 'hunt') {
            const s = spotNear(60), z = this.spawnZombie(s.x, s.y, this.era() >= 3 ? 10 : 2, false); z.hp *= 5; z.mhp *= 5; z.elite = 1; z.job = 1; z.r += 4;
            for (let q = 0; q < 5; q++) { const s2 = spotNear(200); this.spawnZombie(s2.x, s2.y, 1, false).job = 1; }
          } else for (let q = 0; q < J.n; q++) { const s = spotNear(320); this.spawnZombie(s.x, s.y, q % 7 === 0 ? 2 : q % 4 === 0 ? 1 : 0, false).job = 1; }
        }
        if (J.spawned) { J.left = this.zombies.filter(z => z.job && z.hp > 0 && (J.k !== 'hunt' || z.elite)).length; if (J.left === 0) done = true; }
      } else if (J.k === 'defend') {
        if (near(230)) {
          J.t += dt; J.wT = (J.wT || 0) - dt;
          if (J.wT <= 0) { J.wT = 5; for (let q = 0; q < 3 + this.era(); q++) { const s = this.findSpawn(J.x, J.y, 520, 800); if (s) { const z = this.spawnZombie(s.x, s.y, this.pickZType(), true); z.job = 1; } } if (!this.isNight()) this.hordeCenter = { x: J.x, y: J.y }; }
          if (J.t >= 90) done = true;
        }
      } else if (J.k === 'deliver') {
        if (this.players.some(q => q.pkg && !q.dead && Math.hypot(q.x - J.x, q.y - J.y) < 150)) { for (const q of this.players) q.pkg = 0; done = true; }
      }
      if (done) {
        for (const q of this.players) if (!q.bot) { q.cash += J.cash; this.addXp(q, J.xp); q.st.jobs = (q.st.jobs || 0) + 1; if (J.k === 'hunt') { q.inv.gunparts += 4; } }
        for (const z of this.zombies) z.job = 0;
        this.job = null; this.ev({ e: 'jobdone', g: 1, t: J.text, c: J.cash });
      }
    }
    // ----- weather -----
    weatherTick(dt) {
      const W = this.wx;
      if (this.time > W.until) {
        const r = Math.random(), era = this.era(); let k = 0;
        if (W.k === 0) k = r < 0.38 ? 1 : r < 0.6 ? 2 : r < 0.8 && era >= 2 ? 3 : r < 0.9 && this.mv >= 2 ? 4 : 0;
        W.k = k; W.until = this.time + (k ? 100 + Math.random() * 120 : 160 + Math.random() * 220);
        this.ev({ e: 'wx', g: 1, k });
      }
      if (W.k === 3) {
        W.boltT -= dt;
        if (W.boltT <= 0) {
          W.boltT = 5 + Math.random() * 7;
          const hs = this.players.filter(q => !q.bot && !q.dead); if (!hs.length) return;
          const q = hs[Math.floor(Math.random() * hs.length)], a = Math.random() * 6.283, d = 160 + Math.random() * 650;
          const x = clamp(q.x + Math.cos(a) * d, 60, WORLD - 60), y = clamp(q.y + Math.sin(a) * d, 60, WORLD - 60), tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), i = ty * MW + tx;
          if (this.map.t[i] === T_FLOOR && this.map.bunkers && this.map.bunkers.some(b => tx >= b.x && ty >= b.y && tx < b.x + b.w && ty < b.y + b.h)) return; // not underground
          let tree = false; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const j = (ty + oy) * MW + tx + ox; if (j >= 0 && j < MW * MH && this.ws.nodeAlive[j] && this.map.node[j] === N_TREE) { this.crushNode(j); tree = true; } }
          if (tree || this.map.t[i] === T_GRASS || this.map.t[i] === T_FOREST) this.fires.push({ x, y, r: 70, until: this.time + 6, by: 0 });
          for (const z of this.zombies) if (z.hp > 0 && Math.hypot(z.x - x, z.y - y) < 95) this.hurtZombie(z, 280, null, x, y, true);
          for (const o of this.players) if (!o.dead && Math.hypot(o.x - x, o.y - y) < 70) this.hurtPlayer(o, 25);
          for (const v of this.vehicles) if (Math.hypot(v.x - x, v.y - y) < 60) this.damageVehicle(v, 80);
          this.ev({ e: 'bolt', x: Math.round(x), y: Math.round(y) });
        }
      }
    }
    // ----- bunkers: hatch on land -> rooms under the sea -----
    inBunker(x, y) { const B = this.map.bunkers || []; const tx = x / TILE, ty = y / TILE; return B.findIndex(b => tx >= b.x && ty >= b.y && tx < b.x + b.w && ty < b.y + b.h); }
    bunkerUse(p) {
      const B = this.map.bunkers || [];
      for (let bi = 0; bi < B.length; bi++) {
        const b = B[bi], hx = b.hx * TILE + 20, hy = b.hy * TILE + 20, lx = b.lx * TILE + 20, ly = b.ly * TILE + 20;
        let to = null;
        if (Math.hypot(p.x - hx, p.y - hy) < 75) { to = { x: lx + 40, y: ly + 40 }; this.enterBunker(bi, p); }
        else if (Math.hypot(p.x - lx, p.y - ly) < 75) to = { x: hx + 50, y: hy + 30 };
        if (!to) continue;
        const from = { x: p.x, y: p.y };
        p.x = to.x; p.y = to.y; p.fs++; p.lastPosT = this.time;
        for (const q of this.players) if (q.bot && !q.dead && !q.vehicle && Math.hypot(q.x - from.x, q.y - from.y) < 350) { q.x = to.x + (Math.random() - 0.5) * 40; q.y = to.y + (Math.random() - 0.5) * 40; q.fs++; }
        for (const d of this.dogs) if (d.owner === p.key) { d.x = to.x + 20; d.y = to.y; }
        this.ev({ e: 'bunker', id: p.id, in: to.x === lx + 40 ? 1 : 0, x: p.x, y: p.y });
        return true;
      }
      return false;
    }
    enterBunker(bi, p) {
      const b = this.map.bunkers[bi], day = this.day();
      if (this.bunkerDay[bi] === day) return;
      this.bunkerDay[bi] = day;
      const n = 10 + this.era() * 3, lx = b.lx * TILE + 20, ly = b.ly * TILE + 20;
      for (let q = 0, tries = 0; q < n && tries < 400; tries++) {
        const tx = b.x + 1 + Math.floor(Math.random() * (b.w - 2)), ty = b.y + 1 + Math.floor(Math.random() * (b.h - 2)), x = tx * TILE + 20, y = ty * TILE + 20;
        if (Math.hypot(x - lx, y - ly) < 380 || blockedZ(this.ws, tx, ty)) continue;
        const z = this.spawnZombie(x, y, q % 6 === 0 ? 2 : q % 5 === 0 ? 4 : q % 3 === 0 ? 1 : 0, false); z.bk = 1; q++;
      }
      const z = this.spawnZombie(b.bx * TILE + 20, b.by * TILE + 20, this.era() >= 2 ? 10 : 2, false); z.bk = 1;
    }
    // ----- the Zombie King -----
    kingTick() {
      const K = this.map.king; if (!K || this.kingDead) return;
      if (this.time < (this.kingT || 0)) return; this.kingT = this.time + 1;
      if (this.zombies.some(z => z.type === 13)) return;
      const kx = K.x * TILE + 20, ky = K.y * TILE + 20;
      if (!this.players.some(q => !q.bot && !q.dead && Math.hypot(q.x - kx, q.y - ky) < 1100)) return;
      const z = this.spawnZombie(kx, ky, 13, false); z.hp = z.mhp = ZT[13].hp * (1 + 0.08 * (this.day() - 1)); z.bk = 1;
      for (let q = 0; q < 6; q++) { const a = q / 6 * 6.283; const g = this.spawnZombie(kx + Math.cos(a) * 110, ky + Math.sin(a) * 110, 8, false); g.bk = 1; }
      this.ev({ e: 'king', g: 1 });
    }
    killKing(src) {
      this.kingDead = 1; this.peaceUntil = this.time + CYCLE * 2;
      for (const z of this.zombies) if (z.type !== 13) z.hp = 0;
      this.hordeQueue = 0;
      for (const q of this.players) if (!q.bot) { q.cash += 1000; q.unl.crown = 1; this.addXp(q, 2000); q.inv.gunparts += 15; }
      this.ev({ e: 'kingdead', g: 1, n: src && src.name ? src.name : '' });
    }

    // ----- the ending: fix the radio, call the evac helicopter, hold the landing zone, escape -----
    callEvac(p, x, y) {
      const E = this.evac;
      if (E.s) { this.ev({ e: 'note', id: p.id, t: 'The evac helicopter is already on its way!' }); return false; }
      if (this.day() < (E.next || 0)) { this.ev({ e: 'note', id: p.id, t: 'Nobody answers the radio — try again tomorrow' }); return false; }
      let lz = null, bd = 4500;
      for (const m of this.map.marks || []) { if (m.k !== 'mil') continue; const cx = (m.x + 7) * TILE, cy = (m.y + 6) * TILE, d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; lz = { x: cx, y: cy }; } }
      for (let k = 0; !lz && k < 60; k++) {
        const a = Math.random() * 6.283, d = 450 + Math.random() * 500, X = x + Math.cos(a) * d, Y = y + Math.sin(a) * d, tx = Math.floor(X / TILE), ty = Math.floor(Y / TILE);
        if (tx < 4 || ty < 4 || tx >= MW - 4 || ty >= MH - 4 || this.map.t[ty * MW + tx] === T_WATER) continue;
        if (!overlaps(this.ws, X, Y, 70, blockedP)) lz = { x: X, y: Y };
      }
      if (!lz) lz = { x, y };
      Object.assign(E, { s: 1, x: Math.round(lz.x), y: Math.round(lz.y), t: this.time + 180, by: p.name, boss: 0, birds: 0 });
      this.ev({ e: 'evac', g: 1, s: 1, x: E.x, y: E.y, n: p.name });
      this.hordeCenter = { x: E.x, y: E.y }; this.hordeQueue += 30 + this.day() * 3; this.hordeT = 0;
      return true;
    }
    evacTick(dt) {
      const E = this.evac; if (!E.s) return;
      const left = E.t - this.time;
      if (E.s === 1) {
        this.hordeCenter = { x: E.x, y: E.y }; if (this.hordeQueue < 10) this.hordeQueue += 8;
        if (!E.birds && left < 130) { E.birds = 1; for (let q = 0; q < 8; q++) { const s = this.findSpawn(E.x, E.y, 800, 1100); if (s) this.spawnZombie(s.x, s.y, 12, true); } }
        if (!E.boss && left < 95) {
          E.boss = 1;
          for (const bt of [11, 6]) { const s = this.findSpawn(E.x, E.y, 900, 1200); if (s) this.spawnZombie(s.x, s.y, bt, true); }
          this.ev({ e: 'boss', g: 1, t: 11, evac: 1 });
        }
        if (left <= 0) { E.s = 2; E.t = this.time + 35; this.ev({ e: 'evac', g: 1, s: 2, x: E.x, y: E.y }); }
        return;
      }
      // the helicopter is down: stand in the landing zone to get on board
      const humans = this.players.filter(p => !p.bot);
      for (const p of humans) if (!p.esc && !p.dead && !p.down && !p.vehicle && Math.hypot(p.x - E.x, p.y - E.y) < 160) { p.esc = 1; p.x = E.x; p.y = E.y; this.ev({ e: 'board', g: 1, n: p.name, id: p.id }); }
      for (const p of humans) if (p.esc) { p.x = E.x; p.y = E.y; p.hp = Math.max(p.hp, 1); }
      const boarded = humans.filter(p => p.esc);
      if (left <= 0 || (boarded.length && humans.every(p => p.esc || p.dead))) {
        E.s = 0; this.hordeQueue = 0;
        if (boarded.length) {
          E.won = (E.won || 0) + 1;
          for (const p of boarded) { p.esc = 0; p.st.escaped = (p.st.escaped || 0) + 1; this.addXp(p, 1000); }
          this.ev({ e: 'victory', g: 1, names: boarded.map(p => p.name), ids: boarded.map(p => p.id), day: this.day(), resc: this.rescued.length, kills: boarded.reduce((a, p) => a + p.kills, 0), x: E.x, y: E.y });
          for (const z of this.zombies) if (Math.hypot(z.x - E.x, z.y - E.y) < 1100 && !ZT[z.type].boss) z.hp = 0;
          this.zombies = this.zombies.filter(z => z.hp > 0);
        } else { E.next = this.day() + 1; this.ev({ e: 'evac', g: 1, s: 0, fail: 1 }); }
      }
    }
    fixRadio(p) {
      const E = this.evac;
      if (this.era() < 3) { this.ev({ e: 'note', id: p.id, t: 'The radio is broken. From Era 3 you can fix it here to call an EVAC helicopter.' }); return false; }
      if (E.s) { this.ev({ e: 'note', id: p.id, t: 'The evac helicopter is already on its way!' }); return true; }
      if (!E.fixed) {
        if (!this.canAfford(p, EVAC_COST)) { this.ev({ e: 'note', id: p.id, t: 'Fix the radio to call the EVAC: 20 scrap, 6 gun parts, 2 fuel cans' }); return false; }
        if (this.day() < (E.next || 0)) return this.callEvac(p, p.x, p.y);
        this.pay(p, EVAC_COST); E.fixed = 1; this.addXp(p, 100);
      }
      return this.callEvac(p, p.x, p.y);
    }

    worldUpkeep() {
      if (this.map.marks) {
        const day = this.day(); this.campDay = this.campDay || {};
        for (let mi = 0; mi < this.map.marks.length; mi++) {
          const m = this.map.marks[mi]; if (m.k !== 'mil' || this.campDay[mi] === day) continue;
          const cx = (m.x + 7) * TILE, cy = (m.y + 6) * TILE;
          if (!this.players.some(p => !p.bot && !p.dead && Math.hypot(p.x - cx, p.y - cy) < 1300)) continue;
          this.campDay[mi] = day; const era = this.era();
          for (let q = 0; q < 7 + Math.min(6, day); q++) { const sp = this.findSpawn(cx, cy, 60, 360); if (!sp) continue; const z = this.spawnZombie(sp.x, sp.y, q === 0 && era >= 3 ? 10 : q < 2 && era >= 2 ? 9 : 8, false); z.guard = { x: cx, y: cy }; }
        }
      }
      for (const [i, at] of this.fbroken) {
        if (this.time < at || this.ws.sType[i]) continue;
        const x = (i % MW) * TILE + 20, y = Math.floor(i / MW) * TILE + 20;
        if (this.players.some(p => Math.hypot(p.x - x, p.y - y) < 60) || this.zombies.some(z => Math.hypot(z.x - x, z.y - y) < 50)) continue;
        this.fbroken.delete(i); this.ws.fbroken[i] = 0; this.D.fr.push(i);
      }
      for (const s of this.structs.values()) if (s.openUntil && this.time > s.openUntil) { // doors swing shut when nobody is in the way
        const x = s.tx * TILE + 20, y = s.ty * TILE + 20;
        if (this.zombies.some(z => Math.abs(z.x - x) < 20 + z.r && Math.abs(z.y - y) < 20 + z.r)) continue;
        s.openUntil = 0; this.ws.doorOpen[s.ty * MW + s.tx] = 0; this.ev({ e: 'doorshut', x, y });
      }
      if (this.ground) this.ground = this.ground.filter(g => this.time < g.until);
      for (let i = 0; i < this.crateOpen.length; i++) if (this.crateOpen[i] && this.time >= this.crateReady[i]) { this.crateOpen[i] = 0; this.D.cr.push(i); }
      for (const [i, at] of this.removed) {
        if (this.time < at || this.ws.sType[i]) continue;
        const x = (i % MW) * TILE + 20, y = Math.floor(i / MW) * TILE + 20;
        if (this.players.some(p => Math.hypot(p.x - x, p.y - y) < 60) || this.zombies.some(z => Math.hypot(z.x - x, z.y - y) < 50)) continue;
        this.removed.delete(i); this.ws.nodeAlive[i] = 1; this.D.ng.push(i);
      }
    }

    tick(dt) {
      dt = Math.min(dt, 0.1);
      this.time += dt;
      this.updateBots(dt);
      for (const p of this.players) this.updatePlayer(p, dt);
      this.fieldT -= dt; if (this.fieldT <= 0) { this.fieldT = 0.6; this.computeField(); }
      this.spawnLogic(dt);
      this.updateZombies(dt);
      this.updateStructs(dt);
      this.updateVehicles(dt);
      this.updateBullets(dt);
      this.updateSpits(dt);
      this.updateGrenades(dt); this.updateRockets(dt); this.updateFires(dt);
      this.updateDogs(dt); this.evacTick(dt); this.weatherTick(dt); this.jobTick(dt); this.kingTick();
      this.slowT -= dt; if (this.slowT <= 0) { this.slowT = 1; this.worldUpkeep(); for (const q of this.players) this.checkGoals(q); }
    }

    // ----- networking -----
    initState() {
      return { seed: this.seed, mv: this.mv, structs: [...this.structs.values()].map(s => this.packStruct(s)), removed: [...this.removed.keys()],
        crateOpen: [...this.crateOpen].map((v, i) => v ? i : -1).filter(i => i >= 0), explored: bitsToStr(this.explored), fbroken: [...this.fbroken.keys()] };
    }
    pullDeltas() {
      const D = this.D, out = {};
      if (D.sa.length) out.sa = D.sa; if (D.sr.length) out.sr = D.sr; if (D.sh.size) out.sh = [...D.sh.entries()];
      if (D.nr.length) out.nr = D.nr; if (D.ng.length) out.ng = D.ng; if (D.co.length) out.co = D.co; if (D.cr.length) out.cr = D.cr;
      if (D.ex.length) out.ex = D.ex; if (D.fb.length) out.fb = D.fb; if (D.fr.length) out.fr = D.fr;
      this.D = this.emptyDeltas();
      return out;
    }
    snapshotFor(id) {
      const me = this.byId(id); if (!me) return null;
      const R = 1250, cx = me.x, cy = me.y;
      const wk = this.held(me), hs = this.heldSlot(me);
      const totals = {}; for (const it of me.slots) if (it && !WEAPONS[it.k]) totals[it.k] = (totals[it.k] || 0) + it.n;
      for (const k in STACK) if (!totals[k]) totals[k] = 0;
      if (me.perkPts > 0 && !me.perkOffer) this.offerPerks(me);
      return {
        t: Math.round(this.time * 100) / 100, day: this.day(), tod: Math.round(this.tod() * 10) / 10,
        p: this.players.map(p => ({ id: p.id, n: p.name, c: p.color, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, a: Math.round(p.a * 100) / 100,
          hp: Math.ceil(p.hp), mh: this.maxHp(p), lv: p.lvl, w: this.held(p), wr: (this.heldSlot(p) || {}).r || 0, dd: p.dead ? 1 : 0, rl: p.reloadT > 0 ? 1 : 0, hl: p.healT > 0 ? 1 : 0, vh: p.vehicle, st: p.seat, k: p.kills,
          jp: p.inp.jmp ? Math.round(p.inp.jmp * 100) / 100 : 0, dn: p.down ? 1 : 0, fl: p.flameT > this.time ? 1 : p.frzT > this.time ? 2 : p.sawT > this.time ? 3 : 0, es: p.esc ? 1 : 0, sk: p.skin ? p.skin.h + '|' + p.skin.o : 'cap|default', pk: p.pkg ? 1 : 0, sp: p.spin > 0 ? Math.round(p.spin * 10) / 10 : 0, ai: p.bot ? (p.rescued ? 2 : 1) : 0, ro: p.rescued && ROLES[p.role] ? ROLES[p.role].name : 0, sw: p.swim ? 1 : 0, bt: p.down ? Math.ceil(p.downT) : 0, rv: p.down ? Math.round(p.revT * 100) : 0 })),
        v: this.vehicles.filter(v => Math.abs(v.x - cx) < R + 200 && Math.abs(v.y - cy) < R + 200).map(v => [v.id, v.type, Math.round(v.x), Math.round(v.y), Math.round(v.a * 100) / 100, Math.round(100 * v.hp / (VT[v.type].hp * (v.up & 2 ? 1.6 : 1))), Math.round(v.fuel), v.driver, v.color, Math.round(v.v), v.gunner || 0, Math.round((v.ta || 0) * 100) / 100, Math.round(v.heat || 0), v.over ? 1 : 0, Math.round((v.ca || v.a) * 100) / 100, Math.round((v.alt || 0) * 100) / 100, v.bombs || 0, v.cd > 0 ? Math.round(v.cd * 10) / 10 : 0, v.up || 0, Math.round((v.rga || 0) * 100) / 100]),
        hc: this.heli.map(h => [h.id, h.x, h.y, Math.round(h.a * 100) / 100, h.boxes.map(b => [Math.round(b.x), Math.round(b.y), b.open]), h.kind || 'heli', h.sv ? [h.sv.n, ROLES[h.sv.role].name, h.isl ? 1 : 0] : 0]),
        rk: this.rockets.filter(r => Math.abs(r.x - cx) < R + 300 && Math.abs(r.y - cy) < R + 300).map(r => [Math.round(r.x), Math.round(r.y), Math.round(Math.atan2(r.vy, r.vx) * 100) / 100, r.kind, Math.round(r.life * 100) / 100, r.T ? Math.round(r.T * 100) / 100 : 0, r.cc || 0, r.ct || 0]),
        dg: this.dogs.filter(d => !d.ride && Math.abs(d.x - cx) < R && Math.abs(d.y - cy) < R).map(d => [d.id, Math.round(d.x), Math.round(d.y), Math.round(d.a * 100) / 100, Math.round(100 * d.hp / d.mhp), d.owner ? d.oid : 0, d.st, d.name]),
        fz: this.fires.filter(f => Math.abs(f.x - cx) < R && Math.abs(f.y - cy) < R).map(f => [Math.round(f.x), Math.round(f.y), f.r, Math.round((f.until - this.time) * 10) / 10]),
        ft: [...this.structs.values()].filter(s => s.type === 'ftrap' && s.fireT > this.time && Math.abs(s.tx * TILE - cx) < R && Math.abs(s.ty * TILE - cy) < R).map(s => s.id),
        wx: this.wx.k, peace: this.peaceUntil > this.time ? Math.ceil(this.peaceUntil - this.time) : 0, kd: this.kingDead,
        hv: this.haven ? [this.haven.x, this.haven.y, this.haven.r] : 0,
        job: this.job ? [this.job.k, this.job.x, this.job.y, this.job.text, this.job.k === 'defend' ? Math.floor(this.job.t) : this.job.left === undefined ? -1 : this.job.left, this.job.cash] : 0,
        jobs: this.jobs.map(j => [j.k, j.text, j.cash, j.x, j.y]),
        evac: this.evac.s ? [this.evac.s, this.evac.x, this.evac.y, Math.max(0, Math.ceil(this.evac.t - this.time)), this.players.filter(q => q.esc).length] : 0, kit: this.kit,
        era: this.era(),
        tr: this.trader ? [this.trader.x, this.trader.y, this.trader.a, Math.hypot(this.trader.x - cx, this.trader.y - cy) < 500 ? this.trader.offers : null, this.trader.town] : null,
        bm: this.bloodMoon ? 1 : 0,
        od: [...this.structs.values()].filter(q => q.openUntil && Math.abs(q.tx * TILE - cx) < R && Math.abs(q.ty * TILE - cy) < R).map(q => q.id),
        ad: this.airdrops.map(a => [a.id, a.x, a.y, Math.max(0, Math.round((a.land - this.time) * 10) / 10)]),
        gr: this.grenades.filter(g => Math.abs(g.x - cx) < R && Math.abs(g.y - cy) < R).map(g => [Math.round(g.x), Math.round(g.y), g.kind === 'molo' ? 1 : g.kind === 'sticky' ? (g.stuck ? 3 : 2) : 0]),
        rain: this.rain,
        z: this.zombies.filter(z => Math.abs(z.x - cx) < R && Math.abs(z.y - cy) < R).map(z => [z.id, z.type, Math.round(z.x), Math.round(z.y), Math.round(z.a * 100) / 100, Math.round(100 * z.hp / z.mhp), z.hitT > 0 ? 1 : 0, z.burnT > this.time ? 1 : 0, z.rageT > this.time ? 1 : 0, z.frost >= 1 ? 2 : z.frost > 0.15 ? 1 : 0, z.stunT > this.time ? 1 : 0, z.elite ? 1 : 0]),
        b: this.bullets.filter(b => Math.abs(b.x - cx) < R && Math.abs(b.y - cy) < R).map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.k]).concat(this.spits.filter(b => Math.abs(b.x - cx) < R && Math.abs(b.y - cy) < R).map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.k || 3])),
        ta: [...this.structs.values()].filter(s => (s.type === 'turret' || s.type === 'mortar' || s.type === 'slight') && s.a !== undefined && Math.abs(s.tx * TILE - cx) < R && Math.abs(s.ty * TILE - cy) < R).map(s => [s.id, Math.round(s.a * 100) / 100]),
        gi: (this.ground || []).filter(g => Math.abs(g.x - cx) < R && Math.abs(g.y - cy) < R).map(g => [g.id, g.k, g.n, Math.round(g.x), Math.round(g.y), g.r || 0]),
        me: { cash: me.cash | 0, skins: Object.keys(SKINS).filter(k => this.skinOk(me, k)), unl: Object.keys(me.unl || {}), fs: me.fs, inv: totals, slots: me.slots.map(it => it ? [it.k, it.n, it.m || 0, it.r || 0, it.at || 0] : 0), seat: me.seat, perks: Object.keys(me.perks), pp: me.perkPts, po: me.perkOffer, br: Math.round(me.br === undefined ? 100 : me.br), resc: this.rescued.length, camp: this.rescued.filter(r => !r.on).length, gl: (() => { const G = GOALS[me.goal]; if (!G) return [me.goal, GOALS.length]; const pr = this.goalProgress(me); return [me.goal, GOALS.length, G.t, pr[0], pr[1]]; })(), down: me.down ? 1 : 0, hunger: Math.round(me.hunger), armor: Math.round(me.armor), veh: me.vehicle, sel: me.sel, mag: hs && WEAPONS[hs.k] ? hs.m || 0 : 0, xp: Math.floor(me.xp), need: needXp(me.lvl), lv: me.lvl, rl: me.reloadT > 0 ? 1 : 0, hl: me.healT > 0 ? 1 : 0, rsp: Math.ceil(me.respawnT), kills: me.kills,
          bed: (() => { const b = [...this.structs.values()].find(s => s.type === 'bed' && s.owner === me.key); return b ? [b.tx, b.ty] : null; })() },
        ev: this.events.filter(e => e.g || e.id === id || (e.x !== undefined && Math.abs(e.x - cx) < R && Math.abs(e.y - cy) < R)),
      };
    }
    flushEvents() { this.events = []; }
    chat(id, text) {
      const p = this.byId(id); if (!p) return;
      const t = String(text || '').replace(/[<>]/g, '').trim().slice(0, 120); if (!t) return;
      this.ev({ e: 'chat', g: 1, n: p.name, c: p.color, text: t });
    }

    // ----- saving -----
    toSave() {
      for (const p of this.players) this.saveProfile(p);
      const crates = []; for (let i = 0; i < this.crateOpen.length; i++) if (this.crateOpen[i]) crates.push([i, Math.round(this.crateReady[i])]);
      return {
        v: 2, cyc: CYCLE, mv: this.mv, kit: this.kit, kingDead: this.kingDead, peace: Math.max(0, Math.round(this.peaceUntil - this.time)), bunkerDay: this.bunkerDay, evac: { fixed: this.evac.fixed, won: this.evac.won, next: this.evac.next }, rescued: this.rescued, lastSurvDay: this.lastSurvDay, lastRadioDay: this.lastRadioDay, seed: this.seed, time: Math.round(this.time), nextId: this.nextId, lastDropDay: this.lastDropDay,
        vehicles: this.vehicles.map(v => [v.id, v.type, Math.round(v.x), Math.round(v.y), Math.round(v.a * 100) / 100, Math.round(v.hp), Math.round(v.fuel), v.color, v.up || 0]),
        structs: [...this.structs.values()].map(s => [s.id, s.type, s.tx, s.ty, Math.ceil(s.hp), s.owner, s.max]), lastHeliDay: this.lastHeliDay, lastTraderDay: this.lastTraderDay, lastConvoyDay: this.lastConvoyDay || 0, lastJetDay: this.lastJetDay || 0, botCount: this.botCount || 0,
        removed: [...this.removed.entries()].map(([i, at]) => [i, Math.round(at)]), fb: [...this.fbroken.entries()].map(([i, at]) => [i, Math.round(at)]),
        crates, explored: bitsToStr(this.explored), players: this.profiles,
      };
    }
    loadSave(s) {
      for (const [id, type, tx, ty, hp, owner, mx] of s.structs || []) {
        if (!BUILD[type] || tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
        const i = ty * MW + tx; if (this.ws.sType[i]) continue;
        const max = mx > 0 ? Math.min(mx, BUILD[type].hp * 1.5) : BUILD[type].hp;
        const st = { id, type, tx, ty, hp: Math.min(hp, max), max, owner, cd: 0 };
        this.structs.set(id, st); this.structAt[i] = id; this.ws.sType[i] = BUILD[type].code;
        this.nextId = Math.max(this.nextId, id + 1);
      }
      for (const [i, at] of s.removed || []) { if (i >= 0 && i < MW * MH && this.map.node[i]) { this.removed.set(i, at); this.ws.nodeAlive[i] = 0; } }
      for (const [i, at] of s.fb || []) { if (i >= 0 && i < MW * MH && this.map.solid[i]) { this.fbroken.set(i, at); this.ws.fbroken[i] = 1; } }
      for (const [i, at] of s.crates || []) { if (i >= 0 && i < this.crateOpen.length) { this.crateOpen[i] = 1; this.crateReady[i] = at; } }
      if (s.explored) this.explored = strToBits(s.explored, MW * MH);
      if (s.lastDropDay) this.lastDropDay = s.lastDropDay;
      if (s.vehicles) for (const [id, type, x, y, a, hp, fuel, color, up] of s.vehicles) { if (VT[type]) { this.vehicles.push({ id, type, x, y, a, v: 0, hp, fuel, driver: 0, gunner: 0, ta: a, ca: a, heat: 0, over: false, alt: 0, bombs: 6, cd: 0, color, runT: 0, up: up | 0 }); this.nextId = Math.max(this.nextId, id + 1); } }
    }
  }

  const SAVE_VERSION = 2;
  for (const n of ['tick', 'input', 'snapshotFor', 'toSave', 'initState', 'addPlayer', 'removePlayer', 'setBots', 'chat', 'pullDeltas', 'syncRescued', 'makeSite', 'build', 'use', 'benchCraft', 'reveal']) {
    const f = Game.prototype[n]; if (f) Game.prototype[n] = function () { setSize(this.sz); return f.apply(this, arguments); };
  }
  const API = { TILE, sizeOf, setSize, DAY_LEN, NIGHT_LEN, CYCLE, T_GRASS, T_WATER, T_SAND, T_ROAD, T_FLOOR, T_BWALL, T_FOREST, T_CONC, T_DESERT, T_FARM, T_HOSP, VT, SAVE_VERSION, SOLID_P, DOORS, WALKABLE_S, HOTBAR, BACKPACK, NSLOTS, STACK, FOOD, ITEM_NAMES, itemName, stackOf,
    N_TREE, N_ROCK, N_CAR, NODE, BUILD, BUILD_BY_CODE, CRAFT, BENCH, ERAS, eraOf, ammoOf, TANK_PARTS, JET_PARTS, blockedTank, blockedAir, vehBlock, WEAPONS, WEAPON_ORDER, ZT, needXp, maxHpOf, dmgMult, RARITY, ATT, ATT_NAMES, ONE_HAND, FURN_INFO, PERKS, PERK_KEYS, gunStats, fullName,
    makeWorldMap, newWS, blockedP, blockedSw, blockedBoat, GOALS, ROLES, KITS, EVAC_COST, DOG_NAMES, CAR_UPS, SHOP, SELL, SKINS, WEATHER, blockedZ, blockedJ, canSee, blocksBullet, blocksLight, losClear, resolve, moveCircle, overlaps, playerSpeed,
    bitsToStr, strToBits, clamp, angDiff, Game };
  Object.defineProperties(API, { MW: { get: () => MW, enumerable: true }, MH: { get: () => MH, enumerable: true }, WORLD: { get: () => WORLD, enumerable: true } });
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.DL = API;
})(typeof self !== 'undefined' ? self : this);
