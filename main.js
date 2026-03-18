(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("menu-overlay");
  const startBtn = document.getElementById("start-btn");
  const versusBtn = document.getElementById("versus-btn");
  const versus3Btn = document.getElementById("versus-3-btn");
  const versus4Btn = document.getElementById("versus-4-btn");
  const coopBtn = document.getElementById("coop-btn");
  const coop3Btn = document.getElementById("coop-3-btn");
  const coop4Btn = document.getElementById("coop-4-btn");
  const hostLanBtn = document.getElementById("host-lan-btn");
  const joinLanBtn = document.getElementById("join-lan-btn");
  const hostLanCoopBtn = document.getElementById("host-lan-coop-btn");
  const joinLanCoopBtn = document.getElementById("join-lan-coop-btn");
  const mapPresetButtons = Array.from(document.querySelectorAll("[data-map-preset]"));
  const lanCodeInput = document.getElementById("lan-code-input");
  const lanLinkInput = document.getElementById("lan-link-input");
  const lanHint = document.getElementById("lan-hint");
  const lanStatus = document.getElementById("lan-status");
  const controllerStatus = document.getElementById("controller-status");
  const liveControls = document.getElementById("live-controls");
  const difficultyBtn = document.getElementById("difficulty-btn");
  const ceasefireBtn = document.getElementById("ceasefire-btn");
  const speedSlowBtn = document.getElementById("speed-slow-btn");
  const speedNormalBtn = document.getElementById("speed-normal-btn");
  const speedFastBtn = document.getElementById("speed-fast-btn");
  const speedUltraBtn = document.getElementById("speed-ultra-btn");
  const assistStatus = document.getElementById("assist-status");
  const slashOverlay = document.getElementById("slash-overlay");
  const slashCommandInput = document.getElementById("slash-command-input");
  const adminOverlay = document.getElementById("admin-overlay");
  const adminStatus = document.getElementById("admin-status");
  const adminCommandInput = document.getElementById("admin-command-input");
  const adminOwnerSelect = document.getElementById("admin-owner-select");
  const adminArmBtn = document.getElementById("admin-arm-btn");
  const adminClearPointsBtn = document.getElementById("admin-clear-points-btn");
  const adminClearLogBtn = document.getElementById("admin-clear-log-btn");
  const adminCopyLogBtn = document.getElementById("admin-copy-log-btn");
  const adminCloseBtn = document.getElementById("admin-close-btn");
  const adminLog = document.getElementById("admin-log");
  const DEFAULT_LAN_SERVER_PORT = 4173;

  const WORLD_SIZE = 4600;
  const TILE_SIZE = 92;
  const HALF_WORLD = WORLD_SIZE / 2;
  const GRID_COUNT = Math.ceil(WORLD_SIZE / TILE_SIZE);
  const CAMERA_LIMIT = WORLD_SIZE * 0.38;
  const TAU = Math.PI * 2;
  const MAP_PRESET_ORDER = ["green", "canyon", "desert", "ocean"];

  function isLanBlockedOnCurrentOrigin() {
    return location.protocol === "https:";
  }

  function getLanIdleStatusText(sharedRoom = null) {
    if (isLanBlockedOnCurrentOrigin()) {
      return "GitHub Pages / HTTPS build ready for campaign and local split-screen. LAN requires opening the game from http://HOST:4173 because the built-in LAN server is HTTP-only.";
    }
    if (sharedRoom) {
      return `Shared LAN link detected for room ${sharedRoom.roomCode}. Press Start to join and launch ${sharedRoom.matchType === "lan-coop" ? "co-op" : "versus"} for everyone in the room.`;
    }
    if (location.protocol === "file:") {
      return "LAN requires the built-in server. Run node server.js and open http://127.0.0.1:4173.";
    }
    return `LAN ready on ${location.origin}. Host a room, then share this page URL and the room code.`;
  }

  function getLanHintMarkup() {
    if (isLanBlockedOnCurrentOrigin()) {
      return "GitHub Pages runs over <code>https://</code>, so browsers block this build from talking to the built-in <code>http://HOST:4173</code> LAN server. Use GitHub Pages for campaign and local split-screen, and open the game from the host PC's LAN URL for room hosting/joining.";
    }
    return "Run <code>node server.js</code> on the host machine, open this page from that machine's LAN IP such as <code>http://192.168.1.10:4173</code>, then share the generated link or room code. GitHub Pages can host the single-player and local split-screen build, but LAN still requires the built-in HTTP server.";
  }

  function syncLanOriginUi() {
    const lanBlocked = isLanBlockedOnCurrentOrigin();
    const disabledTitle = lanBlocked
      ? "LAN is unavailable from HTTPS-hosted builds like GitHub Pages. Open the game from http://HOST:4173 to use LAN rooms."
      : "";
    for (const button of [hostLanBtn, joinLanBtn, hostLanCoopBtn, joinLanCoopBtn]) {
      if (!button) continue;
      button.disabled = lanBlocked;
      button.title = disabledTitle;
    }
    if (lanCodeInput) {
      lanCodeInput.disabled = lanBlocked;
      lanCodeInput.title = disabledTitle;
      if (lanBlocked && !lanCodeInput.value) lanCodeInput.placeholder = "LAN disabled on HTTPS build";
      else lanCodeInput.placeholder = "ABCDE";
    }
    if (lanHint) lanHint.innerHTML = getLanHintMarkup();
  }

  function ensureLanAvailableFromCurrentOrigin() {
    if (!isLanBlockedOnCurrentOrigin()) return true;
    setLanLink("");
    setLanStatus(getLanIdleStatusText());
    syncLanOriginUi();
    return false;
  }

  const ownerColors = {
    player: "#68d7ff",
    player1: "#68d7ff",
    player2: "#ff7f72",
    player3: "#8de7b8",
    player4: "#f5dd82",
    enemy1: "#ff6d6d",
    enemy2: "#ffb057",
    neutral: "#cfd6dc",
    ally: "#7df2ab",
  };

  const starterEmpireLayout = {
    buildings: [
      { itemId: "royal_keep", x: 0, y: 0 },
      { itemId: "army_house", x: 170, y: 0 },
      { itemId: "archer_house", x: -20, y: 180 },
      { itemId: "watch_tower", x: 300, y: 160 },
      { itemId: "market", x: -160, y: -140 },
      { itemId: "farm", x: -280, y: 10 },
      { itemId: "lumber_camp", x: -170, y: 170 },
      { itemId: "quarry", x: 50, y: -180 },
    ],
    units: [
      { role: "warrior", x: 160, y: 110 },
      { role: "warrior", x: 100, y: 160 },
      { role: "archer", x: -60, y: 260 },
      { role: "knight", x: -120, y: 20 },
    ],
  };

  const localVersusConfigs = {
    2: [
      { owner: "player1", label: "Player 1", viewportIndex: 0, controllerLabel: "Controller 1", camera: { x: -1500, y: 1500, zoom: 0.8, rotation: -0.3 }, startBase: { x: -1540, y: 1500 }, startFacing: 0 },
      { owner: "player2", label: "Player 2", viewportIndex: 1, controllerLabel: "Controller 2", camera: { x: 1500, y: -1500, zoom: 0.8, rotation: 2.84 }, startBase: { x: 1540, y: -1500 }, startFacing: Math.PI },
    ],
    3: [
      { owner: "player1", label: "Player 1", viewportIndex: 0, controllerLabel: "Controller 1", camera: { x: -1500, y: 1500, zoom: 0.8, rotation: -0.3 }, startBase: { x: -1540, y: 1500 }, startFacing: 0 },
      { owner: "player2", label: "Player 2", viewportIndex: 1, controllerLabel: "Controller 2", camera: { x: 1500, y: 1500, zoom: 0.8, rotation: -2.84 }, startBase: { x: 1540, y: 1500 }, startFacing: Math.PI },
      { owner: "player3", label: "Player 3", viewportIndex: 2, controllerLabel: "Controller 3", camera: { x: 0, y: -1600, zoom: 0.8, rotation: 1.55 }, startBase: { x: 0, y: -1620 }, startFacing: Math.PI / 2 },
    ],
    4: [
      { owner: "player1", label: "Player 1", viewportIndex: 0, controllerLabel: "Controller 1", camera: { x: -1500, y: 1500, zoom: 0.8, rotation: -0.3 }, startBase: { x: -1540, y: 1500 }, startFacing: 0 },
      { owner: "player2", label: "Player 2", viewportIndex: 1, controllerLabel: "Controller 2", camera: { x: 1500, y: 1500, zoom: 0.8, rotation: -2.84 }, startBase: { x: 1540, y: 1500 }, startFacing: Math.PI },
      { owner: "player3", label: "Player 3", viewportIndex: 2, controllerLabel: "Controller 3", camera: { x: -1500, y: -1500, zoom: 0.8, rotation: 0.34 }, startBase: { x: -1540, y: -1500 }, startFacing: 0 },
      { owner: "player4", label: "Player 4", viewportIndex: 3, controllerLabel: "Controller 4", camera: { x: 1500, y: -1500, zoom: 0.8, rotation: 2.84 }, startBase: { x: 1540, y: -1500 }, startFacing: Math.PI },
    ],
  };

  const localCoopConfigs = {
    2: [
      { owner: "player1", label: "Player 1", viewportIndex: 0, controllerLabel: "Controller 1", camera: { x: -1500, y: 1500, zoom: 0.82, rotation: -0.28 }, startBase: { x: -1540, y: 1500 }, startFacing: 0 },
      { owner: "player2", label: "Player 2", viewportIndex: 1, controllerLabel: "Controller 2", camera: { x: -1120, y: 1620, zoom: 0.82, rotation: -0.18 }, startBase: { x: -1180, y: 1500 }, startFacing: 0 },
    ],
    3: [
      { owner: "player1", label: "Player 1", viewportIndex: 0, controllerLabel: "Controller 1", camera: { x: -1500, y: 1500, zoom: 0.82, rotation: -0.28 }, startBase: { x: -1540, y: 1500 }, startFacing: 0 },
      { owner: "player2", label: "Player 2", viewportIndex: 1, controllerLabel: "Controller 2", camera: { x: -1120, y: 1500, zoom: 0.82, rotation: -0.16 }, startBase: { x: -1120, y: 1500 }, startFacing: 0 },
      { owner: "player3", label: "Player 3", viewportIndex: 2, controllerLabel: "Controller 3", camera: { x: -1330, y: 1080, zoom: 0.82, rotation: 0.02 }, startBase: { x: -1330, y: 1080 }, startFacing: 0 },
    ],
    4: [
      { owner: "player1", label: "Player 1", viewportIndex: 0, controllerLabel: "Controller 1", camera: { x: -1540, y: 1540, zoom: 0.82, rotation: -0.28 }, startBase: { x: -1540, y: 1540 }, startFacing: 0 },
      { owner: "player2", label: "Player 2", viewportIndex: 1, controllerLabel: "Controller 2", camera: { x: -1120, y: 1540, zoom: 0.82, rotation: -0.16 }, startBase: { x: -1120, y: 1540 }, startFacing: 0 },
      { owner: "player3", label: "Player 3", viewportIndex: 2, controllerLabel: "Controller 3", camera: { x: -1540, y: 1080, zoom: 0.82, rotation: 0.02 }, startBase: { x: -1540, y: 1080 }, startFacing: 0 },
      { owner: "player4", label: "Player 4", viewportIndex: 3, controllerLabel: "Controller 4", camera: { x: -1120, y: 1080, zoom: 0.82, rotation: 0.12 }, startBase: { x: -1120, y: 1080 }, startFacing: 0 },
    ],
  };

  const assetCatalog = [
    { id: "royal_keep", name: "Royal Keep", cost: 320, tier: 1, footprint: 2.2, style: "keep", spawnRole: "knight", spawnRate: 22, hp: 1800, armor: "stone", desc: "Central command. Trains knights and anchors the empire." },
    { id: "village_house", name: "Village House", cost: 90, tier: 1, footprint: 1.4, style: "house", spawnRole: "villager", spawnRate: 20, hp: 320, armor: "wood", tax: 14, desc: "Raises peasants and taxes local citizens." },
    { id: "army_house", name: "Army House", cost: 120, tier: 1, footprint: 1.6, style: "barracks", spawnRole: "warrior", spawnRate: 18, hp: 560, armor: "wood", desc: "Produces sword infantry." },
    { id: "archer_house", name: "Archer House", cost: 135, tier: 1, footprint: 1.6, style: "archery", spawnRole: "archer", spawnRate: 19, hp: 500, armor: "wood", desc: "Produces ranged archers." },
    { id: "stable", name: "Knight Stable", cost: 180, tier: 2, footprint: 1.8, style: "stable", spawnRole: "knight", spawnRate: 24, hp: 640, armor: "wood", desc: "Builds mounted knights." },
    { id: "watch_tower", name: "Watch Tower", cost: 150, tier: 1, footprint: 1.3, style: "tower", attack: "arrow", attackRate: 1.6, range: 280, hp: 720, armor: "stone", desc: "Auto-fires on enemies in range." },
    { id: "stone_tower", name: "Stone Tower", cost: 220, tier: 2, footprint: 1.5, style: "tower", attack: "bolt", attackRate: 1.1, range: 320, hp: 980, armor: "stone", desc: "Heavy tower with armor-piercing fire." },
    { id: "wall", name: "Wall Segment", cost: 70, tier: 1, footprint: 1.1, style: "wall", hp: 680, armor: "stone", desc: "Blocks movement and protects your frontier." },
    { id: "gatehouse", name: "Gatehouse", cost: 180, tier: 2, footprint: 1.6, style: "gate", hp: 980, armor: "stone", desc: "Fortified passage for walled lines." },
    { id: "outpost", name: "Scout Outpost", cost: 110, tier: 1, footprint: 1.3, style: "outpost", spawnRole: "scout", spawnRate: 25, hp: 420, armor: "wood", desc: "Produces scouts with long vision." },
    { id: "market", name: "Market Hall", cost: 180, tier: 2, footprint: 1.7, style: "market", hp: 520, armor: "wood", taxBoost: 1.35, desc: "Boosts nearby taxes and coin flow." },
    { id: "farm", name: "Farmstead", cost: 120, tier: 1, footprint: 1.7, style: "farm", hp: 420, armor: "wood", tax: 10, desc: "Feeds the empire and grows taxes." },
    { id: "lumber_camp", name: "Lumber Camp", cost: 125, tier: 1, footprint: 1.7, style: "lumber", hp: 430, armor: "wood", gather: "wood", desc: "Harvests nearby forests for coin and wood." },
    { id: "quarry", name: "Stone Quarry", cost: 145, tier: 1, footprint: 1.7, style: "quarry", hp: 480, armor: "stone", gather: "stone", desc: "Extracts stone from the hills." },
    { id: "blacksmith", name: "Blacksmith", cost: 200, tier: 2, footprint: 1.8, style: "forge", hp: 600, armor: "stone", aura: "attack", desc: "Improves allied damage nearby." },
    { id: "academy", name: "War Academy", cost: 260, tier: 2, footprint: 1.9, style: "academy", hp: 620, armor: "stone", spawnRole: "captain", spawnRate: 28, desc: "Produces officers with stronger leadership." },
    { id: "hospital", name: "Field Hospital", cost: 190, tier: 2, footprint: 1.7, style: "hospital", hp: 520, armor: "wood", aura: "heal", desc: "Heals nearby allies over time." },
    { id: "chapel", name: "Chapel", cost: 165, tier: 1, footprint: 1.5, style: "chapel", hp: 470, armor: "stone", morale: 1.1, desc: "Improves morale and defense." },
    { id: "granary", name: "Granary", cost: 140, tier: 1, footprint: 1.6, style: "granary", hp: 430, armor: "wood", tax: 11, desc: "Stores food and raises village output." },
    { id: "siege_workshop", name: "Siege Workshop", cost: 270, tier: 2, footprint: 1.9, style: "workshop", hp: 650, armor: "stone", spawnRole: "engineer", spawnRate: 26, desc: "Engineers can build and repair siege lines." },
    { id: "cannon_nest", name: "Cannon Nest", cost: 280, tier: 2, footprint: 1.5, style: "cannon", attack: "shell", attackRate: 0.7, range: 360, hp: 780, armor: "steel", desc: "Static artillery with explosive shells." },
    { id: "mortar_pit", name: "Mortar Pit", cost: 310, tier: 3, footprint: 1.7, style: "mortar", attack: "mortar", attackRate: 0.55, range: 430, hp: 760, armor: "steel", desc: "Indirect fire support." },
    { id: "bridge", name: "Bridge Span", cost: 130, tier: 1, footprint: 1.5, style: "bridge", hp: 560, armor: "wood", desc: "Crosses narrow rivers and marshes." },
    { id: "dock", name: "Frontier Dock", cost: 210, tier: 2, footprint: 1.8, style: "dock", hp: 560, armor: "wood", spawnRole: "marine", spawnRate: 24, desc: "Deploys marines and hover support near water." },
    { id: "power_plant", name: "Power Plant", cost: 300, tier: 3, footprint: 2.0, style: "plant", hp: 620, armor: "steel", desc: "Supports advanced machinery." },
    { id: "refinery", name: "Fuel Refinery", cost: 320, tier: 3, footprint: 2.0, style: "refinery", hp: 690, armor: "steel", desc: "Boosts vehicle production speed." },
    { id: "radar_hub", name: "Radar Hub", cost: 260, tier: 2, footprint: 1.7, style: "radar", hp: 510, armor: "steel", desc: "Extends visibility and marks enemies." },
    { id: "bunker", name: "Steel Bunker", cost: 260, tier: 2, footprint: 1.6, style: "bunker", attack: "machine", attackRate: 2.4, range: 250, hp: 1100, armor: "steel", desc: "Heavy cover with automatic fire." },
    { id: "command_hall", name: "Command Hall", cost: 340, tier: 3, footprint: 2.0, style: "command", hp: 800, armor: "stone", taxBoost: 1.2, desc: "Improves strategic control and quest income." },
    { id: "capital_wall", name: "Capital Wall", cost: 95, tier: 2, footprint: 1.2, style: "capital-wall", hp: 950, armor: "steel", desc: "Modern reinforced wall segment." },
  ];

  const weaponCatalog = [
    { id: "militia", name: "Militia Squad", cost: 80, role: "militia", type: "unit", era: "Old", hp: 90, armor: "flesh", damage: 10, range: 34, speed: 66, cooldown: 0.8, desc: "Cheap melee troops." },
    { id: "warriors", name: "Warrior Squad", cost: 115, role: "warrior", type: "unit", era: "Old", hp: 120, armor: "flesh", damage: 15, range: 36, speed: 72, cooldown: 0.7, desc: "Reliable sword infantry." },
    { id: "archers", name: "Archer Volley", cost: 120, role: "archer", type: "unit", era: "Old", hp: 82, armor: "flesh", damage: 12, range: 210, speed: 68, cooldown: 1.15, projectile: "arrow", desc: "Long-range volleys." },
    { id: "knights", name: "Knight Charge", cost: 165, role: "knight", type: "unit", era: "Old", hp: 175, armor: "plate", damage: 22, range: 42, speed: 86, cooldown: 0.95, desc: "Heavy cavalry." },
    { id: "scouts", name: "Scout Riders", cost: 110, role: "scout", type: "unit", era: "Old", hp: 84, armor: "flesh", damage: 9, range: 36, speed: 104, cooldown: 0.7, desc: "Fast vision units." },
    { id: "catapult", name: "Catapult", cost: 180, role: "catapult", type: "vehicle", era: "Old", hp: 210, armor: "wood", damage: 46, range: 260, speed: 48, cooldown: 3.2, projectile: "boulder", splash: 66, desc: "Ancient siege engine." },
    { id: "ballista", name: "Ballista", cost: 190, role: "ballista", type: "vehicle", era: "Old", hp: 195, armor: "wood", damage: 40, range: 290, speed: 42, cooldown: 2.2, projectile: "bolt", desc: "Armor-piercing anti-structure platform." },
    { id: "battering_ram", name: "Battering Ram", cost: 170, role: "ram", type: "vehicle", era: "Old", hp: 310, armor: "wood", damage: 34, range: 32, speed: 34, cooldown: 1.3, desc: "Crushes walls at close range." },
    { id: "cannon", name: "Field Cannon", cost: 220, role: "cannon", type: "vehicle", era: "Industrial", hp: 240, armor: "steel", damage: 58, range: 320, speed: 54, cooldown: 2.8, projectile: "shell", splash: 58, desc: "Direct-fire explosive support." },
    { id: "musket_line", name: "Musket Line", cost: 160, role: "musketeer", type: "unit", era: "Industrial", hp: 104, armor: "flesh", damage: 18, range: 190, speed: 62, cooldown: 1.4, projectile: "bullet", desc: "Massed early gunpowder infantry." },
    { id: "mortar_team", name: "Mortar Team", cost: 240, role: "mortarTeam", type: "unit", era: "Industrial", hp: 132, armor: "flesh", damage: 52, range: 350, speed: 50, cooldown: 3.0, projectile: "mortar", splash: 82, desc: "Indirect infantry support." },
    { id: "machine_gun", name: "Machine Gun Nest", cost: 210, role: "machineNest", type: "deployable", era: "Modern", hp: 220, armor: "steel", damage: 8, range: 220, speed: 0, cooldown: 0.11, projectile: "bullet", desc: "Static suppressive fire." },
    { id: "armored_car", name: "Armored Car", cost: 245, role: "armoredCar", type: "vehicle", era: "Modern", hp: 220, armor: "steel", damage: 12, range: 220, speed: 118, cooldown: 0.22, projectile: "bullet", desc: "Fast skirmish vehicle." },
    { id: "ww1_tank", name: "Trench Tank", cost: 280, role: "ww1Tank", type: "vehicle", era: "Modern", hp: 360, armor: "steel", damage: 24, range: 170, speed: 44, cooldown: 0.48, projectile: "bullet", desc: "Slow heavy armor." },
    { id: "halftrack", name: "Halftrack", cost: 255, role: "halftrack", type: "vehicle", era: "Modern", hp: 290, armor: "steel", damage: 16, range: 200, speed: 92, cooldown: 0.28, projectile: "bullet", desc: "Flexible mechanized transport." },
    { id: "light_tank", name: "Light Tank", cost: 320, role: "lightTank", type: "vehicle", era: "Modern", hp: 420, armor: "steel", damage: 40, range: 270, speed: 74, cooldown: 1.2, projectile: "shell", splash: 40, desc: "Fast armored fire support." },
    { id: "medium_tank", name: "Medium Tank", cost: 390, role: "mediumTank", type: "vehicle", era: "Modern", hp: 560, armor: "steel", damage: 52, range: 280, speed: 62, cooldown: 1.32, projectile: "shell", splash: 50, desc: "Balanced armored spearhead." },
    { id: "heavy_tank", name: "Heavy Tank", cost: 520, role: "heavyTank", type: "vehicle", era: "Modern", hp: 820, armor: "steel", damage: 78, range: 300, speed: 48, cooldown: 1.55, projectile: "shell", splash: 64, desc: "Breakthrough armor." },
    { id: "rocket_truck", name: "Rocket Truck", cost: 420, role: "rocketTruck", type: "vehicle", era: "Modern", hp: 320, armor: "steel", damage: 88, range: 420, speed: 66, cooldown: 4.2, projectile: "rocket", splash: 104, desc: "Long-range rocket artillery." },
    { id: "missile_carrier", name: "Missile Carrier", cost: 560, role: "missileCarrier", type: "vehicle", era: "Modern", hp: 350, armor: "steel", damage: 120, range: 520, speed: 60, cooldown: 5.2, projectile: "missile", splash: 118, desc: "Strategic precision launcher." },
    { id: "hovercraft", name: "Hovercraft", cost: 430, role: "hovercraft", type: "vehicle", era: "Modern", hp: 360, armor: "steel", damage: 34, range: 180, speed: 102, cooldown: 0.7, projectile: "bullet", desc: "Skims over land and water." },
    { id: "apc", name: "APC", cost: 335, role: "apc", type: "vehicle", era: "Modern", hp: 420, armor: "steel", damage: 18, range: 185, speed: 82, cooldown: 0.28, projectile: "bullet", desc: "Fast infantry carrier." },
    { id: "drone_swarm", name: "Drone Swarm", cost: 470, role: "drone", type: "unit", era: "Future", hp: 180, armor: "steel", damage: 18, range: 230, speed: 140, cooldown: 0.35, projectile: "pulse", desc: "Fast autonomous strike drones." },
    { id: "attack_copter", name: "Attack Copter", cost: 560, role: "copter", type: "unit", era: "Modern", hp: 300, armor: "steel", damage: 24, range: 240, speed: 132, cooldown: 0.2, projectile: "rocket", splash: 24, desc: "Air support gunship." },
    { id: "bomb_strike", name: "Bomb Strike", cost: 320, role: "bomb", type: "ability", era: "Modern", damage: 160, range: 0, blast: 120, desc: "Manual high-yield bombing run." },
    { id: "cluster_bomb", name: "Cluster Bomb", cost: 460, role: "cluster", type: "ability", era: "Modern", damage: 70, range: 0, blast: 160, shards: 6, desc: "Wide bombardment with repeated impacts." },
    { id: "bunker_buster", name: "Bunker Buster", cost: 560, role: "buster", type: "ability", era: "Modern", damage: 280, range: 0, blast: 110, armorPierce: 2.2, desc: "Massive anti-structure payload." },
    { id: "emp_burst", name: "EMP Burst", cost: 520, role: "emp", type: "ability", era: "Future", damage: 35, range: 0, blast: 180, slow: 0.3, desc: "Disables enemy engines and towers." },
    { id: "nuke", name: "Tactical Nuke", cost: 1400, role: "nuke", type: "ability", era: "Future", damage: 850, range: 0, blast: 260, fallout: 18, desc: "Devastating manual deployment." },
    { id: "repair_drone", name: "Repair Drone", cost: 260, role: "repair", type: "unit", era: "Future", hp: 120, armor: "steel", damage: 0, range: 0, speed: 126, cooldown: 0, desc: "Repairs allied armor and structures." },
  ];

  assetCatalog.push(
    { id: "guard_barracks", name: "Guard Barracks", cost: 140, tier: 1, footprint: 1.7, style: "barracks", spawnRole: "pikeman", spawnRate: 17, hp: 620, armor: "wood", desc: "Drills disciplined pike lines for the front." },
    { id: "ranger_lodge", name: "Ranger Lodge", cost: 160, tier: 1, footprint: 1.6, style: "archery", spawnRole: "crossbowman", spawnRate: 18, hp: 520, armor: "wood", desc: "Trains crossbow squads with longer reach." },
    { id: "lancer_stable", name: "Lancer Stable", cost: 240, tier: 2, footprint: 1.9, style: "stable", spawnRole: "paladin", spawnRate: 26, hp: 760, armor: "wood", desc: "Breeds elite cavalry for heavy charges." },
    { id: "repair_bay", name: "Repair Bay", cost: 230, tier: 2, footprint: 1.8, style: "hospital", spawnRole: "medic", spawnRate: 24, hp: 620, armor: "steel", desc: "Deploys battlefield medics and field crews." },
    { id: "signal_beacon", name: "Signal Beacon", cost: 135, tier: 1, footprint: 1.4, style: "radar", hp: 460, armor: "steel", desc: "Projects a bright relay that extends sight." },
    { id: "tesla_spire", name: "Tesla Spire", cost: 290, tier: 2, footprint: 1.5, style: "tower", attack: "pulse", attackRate: 1.7, range: 300, hp: 820, armor: "steel", desc: "Arcs pulse fire into clustered enemies." },
    { id: "flame_tower", name: "Flame Tower", cost: 250, tier: 2, footprint: 1.5, style: "tower", attack: "machine", attackRate: 3.9, range: 175, hp: 720, armor: "steel", desc: "Short-range inferno post that shreds rushes." },
    { id: "missile_silo", name: "Missile Silo", cost: 440, tier: 3, footprint: 1.9, style: "cannon", attack: "missile", attackRate: 0.32, range: 520, hp: 860, armor: "steel", desc: "Long-range bunker hunter with guided strikes." },
    { id: "supply_depot", name: "Supply Depot", cost: 175, tier: 2, footprint: 1.7, style: "market", hp: 560, armor: "wood", tax: 8, taxBoost: 1.1, desc: "Keeps the army fed and treasury flowing." },
    { id: "imperial_mint", name: "Imperial Mint", cost: 320, tier: 3, footprint: 1.9, style: "command", hp: 780, armor: "stone", taxBoost: 1.55, desc: "Turns a strong economy into serious coin." },
    { id: "war_foundry", name: "War Foundry", cost: 360, tier: 3, footprint: 2.0, style: "refinery", spawnRole: "flameTank", spawnRate: 38, hp: 760, armor: "steel", desc: "Mass-produces close-assault armor columns." },
    { id: "observatory", name: "Observatory", cost: 255, tier: 2, footprint: 1.7, style: "radar", hp: 560, armor: "stone", desc: "Tracks distant movement from a high dome." },
    { id: "storm_generator", name: "Storm Generator", cost: 370, tier: 3, footprint: 2.0, style: "plant", hp: 720, armor: "steel", desc: "Feeds the grid and sharpens advanced production." },
    { id: "citadel", name: "Citadel", cost: 430, tier: 3, footprint: 2.3, style: "keep", spawnRole: "captain", spawnRate: 25, hp: 1500, armor: "stone", desc: "A brutal fortress that anchors the warfront." },
    { id: "shield_bastion", name: "Shield Bastion", cost: 335, tier: 2, footprint: 1.7, style: "bunker", attack: "machine", attackRate: 3.1, range: 240, hp: 1450, armor: "steel", desc: "Reinforced machine bunker for choke points." },
    { id: "siege_foundry", name: "Siege Foundry", cost: 410, tier: 3, footprint: 2.0, style: "workshop", spawnRole: "siegeMech", spawnRate: 44, hp: 780, armor: "steel", desc: "Assembles lumbering siege walkers." },
    { id: "drone_lab", name: "Drone Lab", cost: 390, tier: 3, footprint: 1.9, style: "radar", spawnRole: "stealthDrone", spawnRate: 30, hp: 620, armor: "steel", desc: "Launches stealth drones over the fog line." },
    { id: "airstrip", name: "Airstrip", cost: 400, tier: 3, footprint: 2.2, style: "workshop", spawnRole: "gunship", spawnRate: 34, hp: 700, armor: "steel", desc: "Scrambles gunships for rapid response." },
    { id: "hover_port", name: "Hover Port", cost: 345, tier: 3, footprint: 2.0, style: "dock", spawnRole: "assaultSkiff", spawnRate: 29, hp: 690, armor: "steel", desc: "Deploys assault skiffs along wet ground." },
    { id: "rail_fort", name: "Rail Fort", cost: 390, tier: 3, footprint: 1.8, style: "cannon", attack: "shell", attackRate: 0.5, range: 470, hp: 1120, armor: "steel", desc: "Heavy static gun with extended range." }
  );

  weaponCatalog.push(
    { id: "pikemen", name: "Pike Wall", cost: 125, role: "pikeman", type: "unit", era: "Old", hp: 128, armor: "flesh", damage: 20, range: 40, speed: 68, cooldown: 0.72, desc: "Polearm infantry that hold armor at bay." },
    { id: "crossbow_volley", name: "Crossbow Volley", cost: 150, role: "crossbowman", type: "unit", era: "Old", hp: 96, armor: "flesh", damage: 17, range: 240, speed: 62, cooldown: 1.25, projectile: "bolt", desc: "Punchy ranged squads with heavy bolts." },
    { id: "paladin_charge", name: "Paladin Charge", cost: 230, role: "paladin", type: "unit", era: "Old", hp: 220, armor: "plate", damage: 28, range: 46, speed: 84, cooldown: 0.9, desc: "Elite cavalry that breaks weak lines." },
    { id: "war_wagon", name: "War Wagon", cost: 210, role: "warWagon", type: "vehicle", era: "Old", hp: 260, armor: "wood", damage: 18, range: 170, speed: 60, cooldown: 0.42, projectile: "bolt", desc: "Mobile wagon bristling with old steel." },
    { id: "fire_cart", name: "Fire Cart", cost: 235, role: "fireCart", type: "vehicle", era: "Old", hp: 230, armor: "wood", damage: 56, range: 160, speed: 52, cooldown: 2.1, projectile: "shell", splash: 46, desc: "Volatile cart that bursts on impact." },
    { id: "sappers", name: "Sapper Team", cost: 165, role: "sapper", type: "unit", era: "Industrial", hp: 110, armor: "flesh", damage: 24, range: 36, speed: 76, cooldown: 0.68, desc: "Fast breachers for walls and bunkers." },
    { id: "sniper_team", name: "Sniper Team", cost: 280, role: "sniper", type: "unit", era: "Modern", hp: 92, armor: "flesh", damage: 46, range: 380, speed: 52, cooldown: 1.8, projectile: "bullet", desc: "Long-range precision fire from concealment." },
    { id: "medic_team", name: "Medic Team", cost: 185, role: "medic", type: "unit", era: "Modern", hp: 96, armor: "flesh", damage: 6, range: 120, speed: 70, cooldown: 0.8, desc: "Heals nearby squads while keeping up." },
    { id: "flame_tank", name: "Flame Tank", cost: 360, role: "flameTank", type: "vehicle", era: "Modern", hp: 470, armor: "steel", damage: 18, range: 120, speed: 64, cooldown: 0.14, projectile: "bullet", desc: "Short-range armor built for brutal pushes." },
    { id: "aa_halftrack", name: "AA Halftrack", cost: 320, role: "aaHalftrack", type: "vehicle", era: "Modern", hp: 330, armor: "steel", damage: 14, range: 230, speed: 86, cooldown: 0.18, projectile: "bullet", desc: "Rapid suppressive fire from a light hull." },
    { id: "railgun_tank", name: "Railgun Tank", cost: 610, role: "railgunTank", type: "vehicle", era: "Future", hp: 640, armor: "steel", damage: 96, range: 420, speed: 58, cooldown: 2.2, projectile: "pulse", desc: "Long-range magnetic kill vehicle." },
    { id: "siege_mech", name: "Siege Mech", cost: 690, role: "siegeMech", type: "vehicle", era: "Future", hp: 880, armor: "steel", damage: 78, range: 240, speed: 44, cooldown: 0.9, projectile: "shell", splash: 60, desc: "Walker chassis that smashes through lines." },
    { id: "gunship", name: "Gunship", cost: 590, role: "gunship", type: "unit", era: "Modern", hp: 340, armor: "steel", damage: 28, range: 250, speed: 140, cooldown: 0.24, projectile: "rocket", splash: 18, desc: "Fast aerial fire support." },
    { id: "stealth_drone", name: "Stealth Drone", cost: 500, role: "stealthDrone", type: "unit", era: "Future", hp: 210, armor: "steel", damage: 20, range: 260, speed: 156, cooldown: 0.26, projectile: "pulse", desc: "Quiet hunter-killer drone swarm node." },
    { id: "assault_skiff", name: "Assault Skiff", cost: 430, role: "assaultSkiff", type: "vehicle", era: "Modern", hp: 380, armor: "steel", damage: 26, range: 175, speed: 118, cooldown: 0.34, projectile: "bullet", desc: "Hover skiff that skims marsh and shore." },
    { id: "shield_carrier", name: "Shield Carrier", cost: 540, role: "shieldCarrier", type: "vehicle", era: "Future", hp: 900, armor: "steel", damage: 14, range: 170, speed: 48, cooldown: 0.32, projectile: "pulse", desc: "Dense support armor that soaks pressure." },
    { id: "carpet_bomb", name: "Carpet Bomb", cost: 520, role: "carpet", type: "ability", era: "Modern", damage: 85, range: 0, blast: 110, desc: "Rakes a whole lane with repeated blasts." },
    { id: "orbital_laser", name: "Orbital Laser", cost: 760, role: "orbital", type: "ability", era: "Future", damage: 140, range: 0, blast: 150, desc: "A precise beam that scorches a target zone." },
    { id: "nano_swarm", name: "Nano Swarm", cost: 480, role: "nano", type: "ability", era: "Future", damage: 40, range: 0, blast: 140, desc: "Repairs allies and strips nearby hostiles." },
    { id: "gravity_bomb", name: "Gravity Bomb", cost: 620, role: "gravity", type: "ability", era: "Future", damage: 95, range: 0, blast: 180, slow: 0.45, desc: "Crushes and slows everything in its sink." }
  );

  const allItems = [...assetCatalog, ...weaponCatalog];
  const itemIndex = new Map(allItems.map((item) => [item.id, item]));
  const quickSlotTemplate = {
    assets: ["army_house", "archer_house", "watch_tower", "wall"],
    weapons: ["warriors", "catapult", "light_tank", "bomb_strike"],
  };

  const roleTemplates = {
    villager: { hp: 72, speed: 52, damage: 4, range: 26, cooldown: 1.2, armor: "flesh", radius: 11, type: "worker" },
    warrior: { hp: 120, speed: 74, damage: 16, range: 38, cooldown: 0.72, armor: "flesh", radius: 12, type: "infantry" },
    archer: { hp: 82, speed: 68, damage: 12, range: 210, cooldown: 1.1, armor: "flesh", radius: 11, projectile: "arrow", type: "ranged" },
    knight: { hp: 175, speed: 88, damage: 22, range: 44, cooldown: 0.92, armor: "plate", radius: 14, type: "cavalry" },
    scout: { hp: 86, speed: 108, damage: 9, range: 34, cooldown: 0.7, armor: "flesh", radius: 10, type: "scout" },
    captain: { hp: 210, speed: 76, damage: 24, range: 40, cooldown: 0.82, armor: "plate", radius: 14, type: "officer" },
    engineer: { hp: 98, speed: 64, damage: 7, range: 30, cooldown: 0.9, armor: "flesh", radius: 11, type: "worker" },
    marine: { hp: 112, speed: 74, damage: 18, range: 170, cooldown: 0.4, armor: "flesh", radius: 12, projectile: "bullet", type: "infantry" },
  };

  const airborneRoles = new Set(["copter", "drone", "gunship", "stealthDrone"]);
  const hoverRoles = new Set(["hovercraft", "assaultSkiff"]);
  const healerRoles = new Set(["repair", "medic"]);

  const terrainPalette = {
    meadow: ["#617f49", "#769a57", "#4b683b"],
    forest: ["#36563a", "#24402c", "#4f7050"],
    hill: ["#8b7b62", "#6e614d", "#b09c7d"],
    river: ["#275f87", "#1e4f72", "#4d97c9"],
    ocean: ["#16384f", "#1e4f72", "#3d81a8"],
    marsh: ["#60735b", "#465444", "#7a8e6e"],
    desert: ["#b6965f", "#d0b37b", "#8f7347"],
    canyon: ["#824d34", "#a76442", "#603625"],
    deadlands: ["#544349", "#6a545d", "#3b3036"],
    road: ["#9f8769", "#7f6d54", "#b9a180"],
  };

  const terrainEffects = {
    meadow: { label: "Meadow", move: 1, vehicleMove: 1, structure: 1, blocked: false },
    forest: { label: "Forest", move: 0.88, vehicleMove: 0.74, structure: 0.94, blocked: false },
    hill: { label: "Hill", move: 0.93, vehicleMove: 0.86, structure: 1.04, blocked: false, towerRange: 1.08 },
    river: { label: "River", move: 0.52, vehicleMove: 0.46, structure: 0.4, blocked: true, allow: new Set(["bridge", "dock"]) },
    ocean: { label: "Ocean", move: 0.3, vehicleMove: 0.24, structure: 0.22, blocked: true, allow: new Set(["bridge", "dock", "hover_port"]) },
    marsh: { label: "Marsh", move: 0.7, vehicleMove: 0.54, structure: 0.82, blocked: false },
    desert: { label: "Desert", move: 0.82, vehicleMove: 0.72, structure: 0.9, attrition: { flesh: 1.3 }, blocked: false },
    canyon: { label: "Canyon", move: 0.68, vehicleMove: 0.5, structure: 0.72, blocked: true, towerRange: 1.12, allow: new Set(["bridge", "tower", "radar", "outpost", "wall", "capital-wall", "gate"]) },
    deadlands: { label: "Deadlands", move: 0.76, vehicleMove: 0.68, structure: 0.76, attrition: { flesh: 2.1, wood: 0.9 }, blocked: false },
    road: { label: "Road", move: 1.12, vehicleMove: 1.08, structure: 1.02, blocked: false },
  };
  const wetBiomes = new Set(["river", "marsh", "ocean"]);
  const mapPresetCatalog = {
    green: { id: "green", label: "Green Map", shortLabel: "Green", desc: "Balanced lush terrain with rivers, forests, roads, and open build space." },
    canyon: { id: "canyon", label: "Canyon", shortLabel: "Canyon", desc: "Ravines, cliffs, canyon choke routes, and harsher central pressure." },
    desert: { id: "desert", label: "Desert", shortLabel: "Desert", desc: "Expansive desert pressure, oasis rivers, and more attrition-heavy routes." },
    ocean: { id: "ocean", label: "Ocean", shortLabel: "Ocean", desc: "Coastal mainland with ocean edges, marsh coves, and shipping lanes." },
  };
  const homelandAnchorZones = [
    { x: -1180, y: 980, radius: 330 },
    { x: -1180, y: 1500, radius: 340 },
    { x: 1320, y: -1160, radius: 320 },
    { x: 1440, y: 1180, radius: 320 },
    { x: -1540, y: 1500, radius: 340 },
    { x: 1540, y: 1500, radius: 340 },
    { x: 1540, y: -1500, radius: 340 },
    { x: -1540, y: -1500, radius: 340 },
    { x: 0, y: -1620, radius: 320 },
    { x: -1330, y: 1080, radius: 300 },
    { x: -1540, y: 1080, radius: 300 },
    { x: -1120, y: 1080, radius: 300 },
    { x: -940, y: -180, radius: 210 },
    { x: 760, y: 880, radius: 210 },
    { x: 1120, y: -1060, radius: 210 },
  ];
  const neutralVillageCenters = [
    { x: -940, y: -180, houses: 5, radius: 220 },
    { x: 760, y: 880, houses: 4, radius: 220 },
    { x: 1120, y: -1060, houses: 5, radius: 220 },
  ];

  const rareDropCatalog = [
    { id: "axe", name: "Battle Axe", bonus: 4, rangeBonus: 0, projectile: null, tint: "#c9d1d8" },
    { id: "sword", name: "Knight Sword", bonus: 6, rangeBonus: 0, projectile: null, tint: "#efe3bc" },
    { id: "gun", name: "Old Gun", bonus: 7, rangeBonus: 60, projectile: "bullet", tint: "#9ad0f0" },
    { id: "rifle", name: "Rare Rifle", bonus: 10, rangeBonus: 90, projectile: "bullet", tint: "#7ef2d0" },
  ];
  const rareDropIndex = new Map(rareDropCatalog.map((drop) => [drop.id, drop]));
  const neutralEconomyBuildingIds = new Set(["village_house", "market", "granary", "farm", "dock"]);
  const ownedEconomyBuildingIds = new Set(["market", "granary", "farm", "command_hall", "dock", "refinery", "power_plant", "lumber_camp", "quarry", "village_house", "supply_depot", "imperial_mint", "storm_generator", "war_foundry"]);

  const state = {
    mode: "menu",
    matchType: "single",
    mapPreset: "green",
    activeOwner: "player",
    activeViewport: null,
    players: {},
    winnerOwner: null,
    loserOwner: null,
    time: 0,
    coins: 900,
    wood: 260,
    stone: 220,
    score: 0,
    camera: { x: 0, y: 0, zoom: 0.82, rotation: -0.28 },
    input: {
      mouseScreenX: 0,
      mouseScreenY: 0,
      mouseWorldX: 0,
      mouseWorldY: 0,
      leftDown: false,
      rightDown: false,
      middleDown: false,
      draggingSelection: false,
      panAnchorX: 0,
      panAnchorY: 0,
      dragStartScreenX: 0,
      dragStartScreenY: 0,
    },
    world: {
      preset: "green",
      tiles: [],
      trees: [],
      rocks: [],
      civilians: [],
      animals: [],
      buildings: [],
      units: [],
      projectiles: [],
      effects: [],
      drops: [],
      notifications: [],
      quests: [],
    },
    ui: {
      openPanel: null,
      activePlacementId: null,
      hoveredSlot: null,
      draggingItemId: null,
      dragSource: null,
      panelScroll: { assets: 0, weapons: 0 },
      selectionBox: null,
      hoveredEnemyIds: [],
      recentMessage: "Build, tax, and conquer the rival nations.",
    },
    ids: 0,
    selectedIds: new Set(),
    waves: {
      index: 0,
      timer: 24,
      cooldown: 24,
      flash: 0,
    },
    difficulty: {
      mode: "normal",
      ceasefireTimer: 0,
      ceasefireDuration: 180,
      hardPressureApplied: false,
    },
    speed: {
      multiplier: 1,
    },
    keys: {
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false,
    },
    lan: {
      role: "offline",
      roomCode: "",
      roomMatchType: null,
      clientId: null,
      localOwner: null,
      pollTimer: 0,
      syncTimer: 0,
      lastSnapshotRevision: 0,
      lastCommandIndex: 0,
      awaitingPoll: false,
      awaitingPush: false,
      apiBase: "",
      guestJoined: false,
      joinUrl: "",
      started: false,
      startedAt: 0,
      linkRoomCode: "",
      linkMatchType: null,
      linkApiBase: "",
      statusText: getLanIdleStatusText(),
    },
    admin: {
      slashOpen: false,
      panelOpen: false,
      commandText: "rock",
      activeTool: null,
      owner: "neutral",
      statusText: "Type a command like rock, arm it, then click the map to place points.",
      log: [],
      points: [],
    },
  };

  const artImages = {
    map: loadImage("art/top-knights-map.png"),
    assets: loadImage("art/top-knights-assets.png"),
    weapons: loadImage("art/top-knights-weapons.png"),
    banner: loadImage("art/top-knights-banner.png"),
  };

  const EXTERNAL_PNG_SCALE = 1.2;
  const externalSpriteSources = {
    assets: {
      royal_keep: { variants: ["assets/buildings/royal_keep.png", "assets/buildings/royal keep.png"] },
      village_house: { variants: ["assets/buildings/village_house.png", "assets/buildings/village house.png"] },
      army_house: { src: "assets/buildings/army_house.png" },
      archer_house: { src: "assets/buildings/archer_house.png" },
      stable: { src: "assets/buildings/knight stable.png" },
      blacksmith: { src: "assets/buildings/blacksmith.png" },
      stone_tower: { src: "assets/buildings/stone tower.png" },
      wall: { src: "assets/buildings/wall segment.png" },
      outpost: { src: "assets/buildings/scout outpost.png" },
      market: { src: "assets/buildings/market.png" },
      granary: { src: "assets/buildings/granary.png" },
      lumber_camp: { src: "assets/buildings/lumber camp.png" },
      quarry: { src: "assets/buildings/stone quarry.png" },
      academy: { src: "assets/buildings/war academy.png" },
      hospital: { src: "assets/buildings/field hospital.png" },
      chapel: { src: "assets/buildings/chapel.png" },
      siege_workshop: { src: "assets/buildings/siege workshop.png" },
      cannon_nest: { src: "assets/buildings/cannon nest.png" },
      mortar_pit: { src: "assets/buildings/mortar pit.png" },
      bridge: { src: "assets/buildings/bridge span.png" },
      dock: { src: "assets/buildings/frontier dock.png" },
      power_plant: { src: "assets/buildings/power plant.png" },
      refinery: { src: "assets/buildings/fuel refinery.png" },
      radar_hub: { src: "assets/buildings/radar hub.png" },
      bunker: { src: "assets/buildings/steel bunker.png" },
      command_hall: { src: "assets/buildings/command hall.png" },
      capital_wall: { src: "assets/buildings/capital wall.png" },
      guard_barracks: { src: "assets/buildings/guard barracks.png" },
      ranger_lodge: { src: "assets/buildings/ranger lodge.png" },
      lancer_stable: { src: "assets/buildings/lancer stable.png" },
      repair_bay: { src: "assets/buildings/repair bay.png" },
      signal_beacon: { src: "assets/buildings/signal beacon.png" },
      tesla_spire: { src: "assets/buildings/tesla spire.png" },
      flame_tower: { src: "assets/buildings/flame tower.png" },
      missile_silo: { src: "assets/buildings/missile silo.png" },
      supply_depot: { src: "assets/buildings/supply depot.png" },
      imperial_mint: { src: "assets/buildings/imperial mint.png" },
      war_foundry: { src: "assets/buildings/war foundry.png" },
      observatory: { src: "assets/buildings/observatory.png" },
      storm_generator: { src: "assets/buildings/storm generator.png" },
      citadel: { src: "assets/buildings/citadel.png" },
      shield_bastion: { src: "assets/buildings/shield bastion.png" },
      siege_foundry: { src: "assets/buildings/siege foundry.png" },
      drone_lab: { src: "assets/buildings/drone lab.png" },
      hover_port: { src: "assets/buildings/hover port.png" },
      rail_fort: { src: "assets/buildings/rail fort.png" },
      watch_tower: { src: "assets/buildings/watch_tower.png" },
      farm: { src: "assets/buildings/farmstead.png" },
    },
    units: {
      militia: { src: "assets/Weapons/militia.png" },
      warrior: { src: "assets/Weapons/warriors.png" },
      pikeman: { src: "assets/Weapons/pikemen.png" },
      archer: { src: "assets/Weapons/archers.png" },
      ballista: { src: "assets/Weapons/ballista.png" },
      ram: { src: "assets/Weapons/battering_ram.png" },
      catapult: { src: "assets/Weapons/catapult.png" },
      warWagon: { src: "assets/Weapons/war_wagon.png" },
      sapper: { src: "assets/Weapons/sappers.png" },
      sniper: { src: "assets/Weapons/sniper_team.png" },
      medic: { src: "assets/Weapons/medic_team.png" },
      lightTank: { src: "assets/Weapons/light_tank.png" },
      mediumTank: { src: "assets/Weapons/medium_tank.png" },
      hovercraft: { src: "assets/Weapons/hovercraft.png" },
      drone: { src: "assets/Weapons/drone_swarm.png" },
      stealthDrone: { src: "assets/Weapons/stealth_drone.png" },
      copter: { src: "assets/Weapons/attack_copter.png" },
    },
    resources: {
      tree_1: { src: "assets/environment/Resources/Tree1.png" },
      tree_2: { src: "assets/environment/Resources/Tree2.png" },
      rock_1: { src: "assets/environment/Resources/Rock.png" },
      rock_2: { src: "assets/environment/Resources/Rock2.png" },
      desert_rock: { src: "assets/environment/Resources/desert_rock.png" },
      bush: { src: "assets/environment/Resources/bush.png" },
      dried_bush: { src: "assets/environment/Resources/Dried_bush.png" },
    },
  };
  const uiImages = {
    coin: loadImage("assets/Coin.png"),
    hudBar: loadImage("assets/HUD bar.png"),
  };

  const spriteLibrary = {
    assets: loadSpriteMap(window.TOP_KNIGHTS_SPRITES && window.TOP_KNIGHTS_SPRITES.assets),
    units: loadSpriteMap(window.TOP_KNIGHTS_SPRITES && window.TOP_KNIGHTS_SPRITES.units),
  };
  const externalSpriteLibrary = {
    assets: loadExternalSpriteMap(externalSpriteSources.assets),
    units: loadExternalSpriteMap(externalSpriteSources.units),
    resources: loadExternalSpriteMap(externalSpriteSources.resources),
  };

  const mapCanvas = document.createElement("canvas");
  const mapCtx = mapCanvas.getContext("2d");
  mapCanvas.width = WORLD_SIZE;
  mapCanvas.height = WORLD_SIZE;
  const FOG_GRID_COUNT = 144;
  const FOG_CELL_SIZE = WORLD_SIZE / FOG_GRID_COUNT;
  const FOG_TEXTURE_SIZE = 512;

  function createFogState() {
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = FOG_TEXTURE_SIZE;
    maskCanvas.height = FOG_TEXTURE_SIZE;
    const maskCtx = maskCanvas.getContext("2d");
    maskCtx.fillStyle = "rgba(5, 8, 13, 0.92)";
    maskCtx.fillRect(0, 0, FOG_TEXTURE_SIZE, FOG_TEXTURE_SIZE);
    return {
      explored: new Uint8Array(FOG_GRID_COUNT * FOG_GRID_COUNT),
      exploredCount: 0,
      maskCanvas,
      maskCtx,
    };
  }

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  function loadSpriteMap(entries) {
    const map = new Map();
    if (!entries) return map;
    for (const [key, src] of Object.entries(entries)) {
      const img = new Image();
      img.src = src;
      map.set(key, img);
    }
    return map;
  }

  function loadExternalSpriteMap(entries) {
    const map = new Map();
    if (!entries) return map;
    for (const [key, spec] of Object.entries(entries)) {
      const variants = Array.isArray(spec.variants) && spec.variants.length ? spec.variants : [spec.src];
      map.set(key, {
        images: variants.filter(Boolean).map((src) => loadImage(src)),
        scale: spec.scale || EXTERNAL_PNG_SCALE,
      });
    }
    return map;
  }

  function isImageReady(image) {
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }

  function getSpriteEntry(group, key, variantSeed = 0) {
    const externalEntry = externalSpriteLibrary[group] && externalSpriteLibrary[group].get(key);
    if (externalEntry) {
      const readyImages = (externalEntry.images || []).filter((image) => isImageReady(image));
      if (readyImages.length) {
        const index = Math.abs(Math.floor(variantSeed || 0)) % readyImages.length;
        return { image: readyImages[index], scale: externalEntry.scale || 1 };
      }
    }
    const sprite = spriteLibrary[group] && spriteLibrary[group].get(key);
    if (isImageReady(sprite)) return { image: sprite, scale: 1 };
    return null;
  }

  const musicSources = {
    calm: "sfx/Calm.mp3",
    battle: "sfx/battle.mp3",
  };

  function createLoopingMusicElement(src) {
    const element = new Audio(src);
    element.loop = true;
    element.preload = "auto";
    element.volume = 0;
    return element;
  }

  function createMusicBus(owner, offset = 0) {
    return {
      owner,
      offset,
      calmEl: createLoopingMusicElement(musicSources.calm),
      battleEl: createLoopingMusicElement(musicSources.battle),
      started: false,
      offsetApplied: false,
      level: 0,
      battleMix: 0,
      sustain: 0,
    };
  }

  const audioState = {
    unlocked: false,
    context: null,
    sfxGain: null,
    noiseBuffer: null,
    musicBuses: new Map([
      ["player", createMusicBus("player", 0)],
      ["player1", createMusicBus("player1", 0)],
      ["player2", createMusicBus("player2", 20 * 60)],
      ["player3", createMusicBus("player3", 10 * 60)],
      ["player4", createMusicBus("player4", 30 * 60)],
    ]),
    sfxCooldowns: new Map(),
    lastResultCue: null,
  };

  function safeMusicOffset(element, offset) {
    if (!offset) return 0;
    const duration = Number.isFinite(element.duration) && element.duration > 1 ? element.duration : 0;
    if (!duration) return offset;
    return Math.min(offset % duration, Math.max(0, duration - 0.35));
  }

  function applyMusicBusOffset(bus) {
    if (!bus || bus.offsetApplied) return true;
    if (!bus.offset) {
      bus.offsetApplied = true;
      return true;
    }
    if (bus.calmEl.readyState < 1 || bus.battleEl.readyState < 1) return false;
    bus.calmEl.currentTime = safeMusicOffset(bus.calmEl, bus.offset);
    bus.battleEl.currentTime = safeMusicOffset(bus.battleEl, bus.offset);
    bus.offsetApplied = true;
    return true;
  }

  function startMusicBusPlayback(bus) {
    if (!bus || bus.started) return;
    if (!applyMusicBusOffset(bus)) return;
    bus.calmEl.play().catch(() => {});
    bus.battleEl.play().catch(() => {});
    bus.started = true;
  }

  for (const bus of audioState.musicBuses.values()) {
    const tryStart = () => {
      if (!audioState.unlocked) return;
      startMusicBusPlayback(bus);
    };
    bus.calmEl.addEventListener("loadedmetadata", tryStart);
    bus.battleEl.addEventListener("loadedmetadata", tryStart);
  }

  function createNoiseBuffer(context) {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      previous = (previous + 0.035 * white) / 1.035;
      data[i] = previous * 2.2;
    }
    return buffer;
  }

  function ensureAudioUnlocked() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!audioState.context) {
      audioState.context = new AudioContextCtor();
      audioState.sfxGain = audioState.context.createGain();
      audioState.sfxGain.gain.value = 0.68;
      audioState.sfxGain.connect(audioState.context.destination);
      audioState.noiseBuffer = createNoiseBuffer(audioState.context);
    }
    audioState.unlocked = true;
    if (audioState.context.state === "suspended") audioState.context.resume().catch(() => {});
    for (const bus of audioState.musicBuses.values()) startMusicBusPlayback(bus);
  }

  function getAudioNow() {
    return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  }

  function shouldThrottleSfx(type, x = null, y = null, interval = 0.08) {
    const key = x == null || y == null
      ? type
      : `${type}:${Math.round(x / 120)}:${Math.round(y / 120)}`;
    const now = getAudioNow();
    const readyAt = audioState.sfxCooldowns.get(key) || 0;
    if (readyAt > now) return true;
    audioState.sfxCooldowns.set(key, now + interval);
    return false;
  }

  function createSfxInput(pan = 0) {
    const context = audioState.context;
    if (!context || !audioState.sfxGain) return null;
    const gain = context.createGain();
    if (typeof context.createStereoPanner === "function") {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(audioState.sfxGain);
    } else {
      gain.connect(audioState.sfxGain);
    }
    return gain;
  }

  function scheduleGainEnvelope(gainNode, now, peak, attack, hold, release) {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, peak), now + Math.max(0.001, attack));
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.55), now + Math.max(0.001, attack + hold));
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.001, attack + hold + release));
  }

  function playToneLayer(config = {}) {
    if (!audioState.unlocked || !audioState.context) return;
    const context = audioState.context;
    const output = createSfxInput(config.pan || 0);
    if (!output) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = config.type || "triangle";
    oscillator.frequency.setValueAtTime(Math.max(20, config.start || 440), context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, config.end || config.start || 440), context.currentTime + Math.max(0.01, config.duration || 0.16));
    oscillator.detune.value = config.detune || 0;
    oscillator.connect(gain);
    gain.connect(output);
    scheduleGainEnvelope(gain, context.currentTime, Math.max(0.0001, config.volume || 0.05), config.attack || 0.004, config.hold || (config.duration || 0.16) * 0.38, config.release || (config.duration || 0.16) * 0.62);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + Math.max(0.04, (config.duration || 0.16) + (config.release || (config.duration || 0.16) * 0.62) + 0.04));
  }

  function playNoiseLayer(config = {}) {
    if (!audioState.unlocked || !audioState.context || !audioState.noiseBuffer) return;
    const context = audioState.context;
    const output = createSfxInput(config.pan || 0);
    if (!output) return;
    const source = context.createBufferSource();
    source.buffer = audioState.noiseBuffer;
    source.playbackRate.value = config.playbackRate || 1;
    const high = context.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = config.highpass || 80;
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = config.lowpass || 2400;
    low.Q.value = config.q || 0.7;
    const gain = context.createGain();
    source.connect(high);
    high.connect(low);
    low.connect(gain);
    gain.connect(output);
    scheduleGainEnvelope(gain, context.currentTime, Math.max(0.0001, config.volume || 0.05), config.attack || 0.003, config.hold || (config.duration || 0.14) * 0.3, config.release || (config.duration || 0.14) * 0.7);
    source.start(context.currentTime);
    source.stop(context.currentTime + Math.max(0.05, (config.duration || 0.14) + (config.release || (config.duration || 0.14) * 0.7) + 0.04));
  }

  function playChord(frequencies, volume = 0.06, duration = 0.38, pan = 0, type = "triangle") {
    for (let i = 0; i < frequencies.length; i += 1) {
      playToneLayer({
        type,
        start: frequencies[i],
        end: frequencies[i] * 0.86,
        duration,
        volume: volume / Math.max(1, frequencies.length) * 1.4,
        pan,
        attack: 0.01,
        hold: duration * 0.4,
        release: duration * 0.8,
        detune: i * 3,
      });
    }
  }

  function getViewportScreenPoint(player, x, y) {
    const viewport = getViewportForPlayer(player);
    const camera = player && player.camera ? player.camera : state.camera;
    const dx = x - camera.x;
    const dy = y - camera.y;
    const cos = Math.cos(camera.rotation);
    const sin = Math.sin(camera.rotation);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return {
      viewport,
      x: viewport.x + viewport.w / 2 + rx * camera.zoom,
      y: viewport.y + viewport.h / 2 + ry * camera.zoom,
    };
  }

  function isPointVisibleForPlayer(player, x, y, padding = 0) {
    if (!player) return false;
    const point = getViewportScreenPoint(player, x, y);
    return point.x >= point.viewport.x - padding &&
      point.x <= point.viewport.x + point.viewport.w + padding &&
      point.y >= point.viewport.y - padding &&
      point.y <= point.viewport.y + point.viewport.h + padding;
  }

  function getAudioPerspective(x = null, y = null) {
    if (x == null || y == null) return { volume: 1, pan: 0 };
    const players = getControllablePlayers();
    if (!players.length) return { volume: 0.42, pan: 0 };
    let best = { volume: 0, pan: 0 };
    for (const player of players) {
      if (!player || !player.camera) continue;
      const point = getViewportScreenPoint(player, x, y);
      const dist = Math.hypot(x - player.camera.x, y - player.camera.y);
      const distanceGain = Math.max(0, 1 - dist / 1800);
      const visible = point.x >= point.viewport.x && point.x <= point.viewport.x + point.viewport.w && point.y >= point.viewport.y && point.y <= point.viewport.y + point.viewport.h;
      const volume = visible ? 0.24 + distanceGain * 0.88 : distanceGain * 0.26;
      if (volume <= best.volume) continue;
      const pan = Math.max(-1, Math.min(1, (point.x - (point.viewport.x + point.viewport.w / 2)) / Math.max(140, point.viewport.w * 0.54)));
      best = { volume, pan };
    }
    return best;
  }

  function playSoundEffect(name, options = {}) {
    if (!audioState.unlocked || !audioState.context) return;
    const volume = Math.max(0, options.volume || 0.05);
    const pan = options.pan || 0;
    switch (name) {
      case "uiClick":
        playToneLayer({ type: "triangle", start: 840, end: 560, duration: 0.08, volume: volume * 0.05, pan });
        break;
      case "panelOpen":
        playToneLayer({ type: "triangle", start: 320, end: 620, duration: 0.16, volume: volume * 0.07, pan });
        playToneLayer({ type: "sine", start: 720, end: 930, duration: 0.12, volume: volume * 0.04, pan, attack: 0.01 });
        break;
      case "panelClose":
        playToneLayer({ type: "triangle", start: 820, end: 340, duration: 0.12, volume: volume * 0.06, pan });
        break;
      case "select":
        playToneLayer({ type: "square", start: 640, end: 430, duration: 0.07, volume: volume * 0.055, pan });
        break;
      case "clear":
        playToneLayer({ type: "sine", start: 520, end: 240, duration: 0.12, volume: volume * 0.05, pan });
        break;
      case "error":
        playToneLayer({ type: "sawtooth", start: 240, end: 120, duration: 0.15, volume: volume * 0.06, pan });
        playNoiseLayer({ duration: 0.1, volume: volume * 0.035, highpass: 600, lowpass: 1800, pan });
        break;
      case "orderMove":
        playNoiseLayer({ duration: 0.06, volume: volume * 0.03, highpass: 500, lowpass: 1800, pan });
        playToneLayer({ type: "triangle", start: 240, end: 170, duration: 0.11, volume: volume * 0.06, pan });
        break;
      case "orderAttack":
        playToneLayer({ type: "sawtooth", start: 240, end: 150, duration: 0.12, volume: volume * 0.07, pan });
        playToneLayer({ type: "square", start: 780, end: 520, duration: 0.08, volume: volume * 0.04, pan });
        break;
      case "orderHarvest":
        playNoiseLayer({ duration: 0.08, volume: volume * 0.04, highpass: 720, lowpass: 2200, pan });
        playToneLayer({ type: "triangle", start: 180, end: 96, duration: 0.14, volume: volume * 0.05, pan });
        break;
      case "orderTax":
        playToneLayer({ type: "triangle", start: 1080, end: 860, duration: 0.12, volume: volume * 0.05, pan });
        playToneLayer({ type: "triangle", start: 1440, end: 1220, duration: 0.08, volume: volume * 0.03, pan, attack: 0.01 });
        break;
      case "deployStructure":
        playNoiseLayer({ duration: 0.18, volume: volume * 0.06, highpass: 90, lowpass: 780, pan });
        playToneLayer({ type: "triangle", start: 150, end: 82, duration: 0.2, volume: volume * 0.065, pan });
        break;
      case "deployUnit":
        playNoiseLayer({ duration: 0.1, volume: volume * 0.035, highpass: 240, lowpass: 1400, pan });
        playToneLayer({ type: "triangle", start: 240, end: 150, duration: 0.12, volume: volume * 0.055, pan });
        break;
      case "deployAbility":
        playToneLayer({ type: "sine", start: 260, end: 1080, duration: 0.24, volume: volume * 0.07, pan, attack: 0.01 });
        playNoiseLayer({ duration: 0.18, volume: volume * 0.04, highpass: 380, lowpass: 2600, pan, playbackRate: 1.2 });
        break;
      case "bulletFire":
        playNoiseLayer({ duration: 0.045, volume: volume * 0.05, highpass: 1400, lowpass: 4600, pan });
        playToneLayer({ type: "square", start: 920, end: 320, duration: 0.045, volume: volume * 0.028, pan });
        break;
      case "arrowFire":
        playNoiseLayer({ duration: 0.08, volume: volume * 0.045, highpass: 900, lowpass: 2600, pan, playbackRate: 1.2 });
        break;
      case "boltFire":
        playNoiseLayer({ duration: 0.08, volume: volume * 0.04, highpass: 700, lowpass: 2000, pan });
        playToneLayer({ type: "triangle", start: 280, end: 150, duration: 0.08, volume: volume * 0.035, pan });
        break;
      case "shellFire":
        playNoiseLayer({ duration: 0.14, volume: volume * 0.055, highpass: 80, lowpass: 700, pan });
        playToneLayer({ type: "sine", start: 132, end: 42, duration: 0.24, volume: volume * 0.085, pan });
        break;
      case "rocketFire":
        playNoiseLayer({ duration: 0.2, volume: volume * 0.055, highpass: 180, lowpass: 1600, pan, playbackRate: 0.9 });
        playToneLayer({ type: "sawtooth", start: 190, end: 70, duration: 0.22, volume: volume * 0.06, pan });
        break;
      case "pulseFire":
        playToneLayer({ type: "sine", start: 460, end: 1180, duration: 0.14, volume: volume * 0.06, pan });
        playToneLayer({ type: "triangle", start: 980, end: 320, duration: 0.16, volume: volume * 0.03, pan });
        break;
      case "meleeHit":
        playNoiseLayer({ duration: 0.08, volume: volume * 0.04, highpass: 760, lowpass: 2400, pan });
        playToneLayer({ type: "triangle", start: 180, end: 110, duration: 0.1, volume: volume * 0.045, pan });
        break;
      case "bulletImpact":
        playNoiseLayer({ duration: 0.05, volume: volume * 0.04, highpass: 1800, lowpass: 5000, pan });
        break;
      case "impactBlast":
        playNoiseLayer({ duration: 0.3, volume: volume * 0.08, highpass: 70, lowpass: 920, pan, playbackRate: 0.92 });
        playToneLayer({ type: "sine", start: 120, end: 28, duration: 0.32, volume: volume * 0.12, pan });
        break;
      case "impactPulse":
        playToneLayer({ type: "sine", start: 980, end: 180, duration: 0.18, volume: volume * 0.08, pan });
        playNoiseLayer({ duration: 0.12, volume: volume * 0.03, highpass: 1200, lowpass: 3800, pan });
        break;
      case "repair":
        playToneLayer({ type: "sine", start: 640, end: 920, duration: 0.18, volume: volume * 0.045, pan, attack: 0.01 });
        playToneLayer({ type: "sine", start: 880, end: 1220, duration: 0.16, volume: volume * 0.028, pan, attack: 0.02 });
        break;
      case "harvestWood":
        playNoiseLayer({ duration: 0.1, volume: volume * 0.05, highpass: 250, lowpass: 1400, pan });
        playToneLayer({ type: "triangle", start: 180, end: 86, duration: 0.13, volume: volume * 0.055, pan });
        break;
      case "harvestStone":
        playNoiseLayer({ duration: 0.08, volume: volume * 0.05, highpass: 1000, lowpass: 2600, pan });
        playToneLayer({ type: "triangle", start: 440, end: 170, duration: 0.12, volume: volume * 0.05, pan });
        break;
      case "taxCollect":
        playToneLayer({ type: "triangle", start: 1100, end: 900, duration: 0.14, volume: volume * 0.05, pan });
        playToneLayer({ type: "triangle", start: 1490, end: 1280, duration: 0.11, volume: volume * 0.04, pan, attack: 0.01 });
        break;
      case "pickup":
        playToneLayer({ type: "triangle", start: 920, end: 1320, duration: 0.16, volume: volume * 0.05, pan, attack: 0.01 });
        playToneLayer({ type: "sine", start: 1320, end: 1760, duration: 0.12, volume: volume * 0.03, pan, attack: 0.02 });
        break;
      case "quest":
        playChord([523, 659, 784], volume * 0.9, 0.34, pan, "triangle");
        break;
      case "warning":
        playToneLayer({ type: "sawtooth", start: 220, end: 170, duration: 0.2, volume: volume * 0.06, pan });
        playToneLayer({ type: "triangle", start: 520, end: 430, duration: 0.16, volume: volume * 0.04, pan });
        break;
      case "victory":
        playChord([392, 523, 659], volume, 0.5, pan, "triangle");
        playToneLayer({ type: "sine", start: 784, end: 1046, duration: 0.44, volume: volume * 0.05, pan, attack: 0.02 });
        break;
      case "defeat":
        playChord([392, 311, 247], volume * 0.9, 0.46, pan, "sine");
        playToneLayer({ type: "sine", start: 220, end: 110, duration: 0.46, volume: volume * 0.06, pan, attack: 0.01 });
        break;
      default:
        playToneLayer({ type: "triangle", start: 600, end: 420, duration: 0.08, volume: volume * 0.04, pan });
        break;
    }
  }

  function playUiSound(name, options = {}) {
    if (!audioState.unlocked) return;
    if (options.cooldown && shouldThrottleSfx(name, null, null, options.cooldown)) return;
    playSoundEffect(name, { volume: options.volume || 1, pan: 0 });
  }

  function playWorldSound(name, x, y, options = {}) {
    if (!audioState.unlocked) return;
    if (options.cooldown && shouldThrottleSfx(name, x, y, options.cooldown)) return;
    const perspective = getAudioPerspective(x, y);
    const volume = (options.volume || 1) * perspective.volume;
    if (volume <= 0.012) return;
    playSoundEffect(name, { volume, pan: perspective.pan });
  }

  function getProjectileLaunchSfx(projectileType) {
    if (projectileType === "arrow") return { name: "arrowFire", cooldown: 0.08, volume: 0.8 };
    if (projectileType === "bolt") return { name: "boltFire", cooldown: 0.09, volume: 0.82 };
    if (projectileType === "shell" || projectileType === "mortar" || projectileType === "boulder") return { name: "shellFire", cooldown: 0.18, volume: 1 };
    if (projectileType === "rocket" || projectileType === "missile") return { name: "rocketFire", cooldown: 0.12, volume: projectileType === "missile" ? 1.08 : 0.96 };
    if (projectileType === "pulse") return { name: "pulseFire", cooldown: 0.1, volume: 0.88 };
    return { name: "bulletFire", cooldown: 0.05, volume: 0.72 };
  }

  function getProjectileImpactSfx(projectileType, splash = 0) {
    if (projectileType === "pulse") return { name: "impactPulse", cooldown: 0.08, volume: splash ? 0.95 : 0.7 };
    if (projectileType === "rocket" || projectileType === "missile" || projectileType === "shell" || projectileType === "mortar" || projectileType === "boulder") {
      return { name: "impactBlast", cooldown: 0.12, volume: splash ? 1.05 : 0.86 };
    }
    return { name: splash ? "impactBlast" : "bulletImpact", cooldown: splash ? 0.1 : 0.05, volume: splash ? 0.8 : 0.55 };
  }

  function getCombatMusicPresence(player) {
    if (!player || state.mode !== "playing") return 0;
    let intensity = 0;
    for (const projectile of state.world.projectiles) {
      if (!isPointVisibleForPlayer(player, projectile.x, projectile.y, 110)) continue;
      intensity = Math.max(intensity, projectile.projectileType === "bullet" ? 0.6 : projectile.projectileType === "arrow" ? 0.5 : projectile.projectileType === "pulse" ? 0.78 : 0.94);
      if (intensity >= 0.92) return intensity;
    }
    for (const entity of [...state.world.units, ...state.world.buildings]) {
      if (!entity.owner || entity.owner === "neutral" || (entity.lastCombatTimer || 0) <= 0) continue;
      if (!isPointVisibleForPlayer(player, entity.x, entity.y, 130)) continue;
      intensity = Math.max(intensity, 0.44 + Math.min(0.44, (entity.lastCombatTimer || 0) * 0.34));
    }
    return Math.max(0, Math.min(1, intensity));
  }

  function moveToward(value, target, amount) {
    if (value < target) return Math.min(target, value + amount);
    return Math.max(target, value - amount);
  }

  function updateAudio(dt) {
    if (!audioState.unlocked) return;
    if (audioState.context && audioState.context.state === "suspended") audioState.context.resume().catch(() => {});
    for (const bus of audioState.musicBuses.values()) startMusicBusPlayback(bus);
    const localPlayers = state.mode === "playing" ? getControllablePlayers() : [];
    const activeOwners = new Set(localPlayers.map((player) => player.owner));
    const baseLevel = localPlayers.length <= 1 ? 0.58 : clamp(0.66 / Math.max(2, localPlayers.length), 0.16, 0.32);
    for (const [owner, bus] of audioState.musicBuses.entries()) {
      const player = localPlayers.find((entry) => entry.owner === owner);
      const rawPresence = player ? getCombatMusicPresence(player) : 0;
      if (rawPresence > 0.18) bus.sustain = 1.05;
      else bus.sustain = Math.max(0, bus.sustain - dt);
      const targetMix = player ? Math.max(rawPresence, bus.sustain > 0 ? Math.min(0.72, bus.sustain * 0.55) : 0) : 0;
      const targetLevel = activeOwners.has(owner) ? baseLevel : 0;
      bus.battleMix = moveToward(bus.battleMix, targetMix, dt * (targetMix > bus.battleMix ? 1.05 : 0.72));
      bus.level = moveToward(bus.level, targetLevel, dt * 0.9);
      bus.calmEl.volume = Math.max(0, Math.min(1, bus.level * (1 - bus.battleMix)));
      bus.battleEl.volume = Math.max(0, Math.min(1, bus.level * bus.battleMix));
    }
  }

  function cloneQuickSlots() {
    return {
      assets: [...quickSlotTemplate.assets],
      weapons: [...quickSlotTemplate.weapons],
    };
  }

  function setLanStatus(text) {
    state.lan.statusText = text;
    if (lanStatus) lanStatus.textContent = text;
  }

  function setLanLink(url) {
    state.lan.joinUrl = url || "";
    if (lanLinkInput) lanLinkInput.value = state.lan.joinUrl;
  }

  function sanitizeMapPreset(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return mapPresetCatalog[normalized] ? normalized : "green";
  }

  function getMapPresetDef(value = state.mapPreset) {
    return mapPresetCatalog[sanitizeMapPreset(value)] || mapPresetCatalog.green;
  }

  function syncMapPresetUi() {
    const activePreset = sanitizeMapPreset(state.mapPreset);
    for (const button of mapPresetButtons) {
      const preset = sanitizeMapPreset(button.dataset.mapPreset);
      const active = preset === activePreset;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.title = getMapPresetDef(preset).desc;
    }
  }

  function setMapPreset(value, options = {}) {
    const preset = sanitizeMapPreset(value);
    state.mapPreset = preset;
    state.world.preset = preset;
    syncMapPresetUi();
    if (options.notify) notify(`${getMapPresetDef(preset).label} selected for the next battle.`, "#8fd8ff");
  }

  function isTextInputTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target.isContentEditable);
  }

  function setAdminStatus(text) {
    state.admin.statusText = text;
    if (adminStatus) adminStatus.innerHTML = text;
  }

  function getAdminLogSnapshotText() {
    const lines = [
      `Map Preset: ${getMapPresetDef(state.world.preset || state.mapPreset).label}`,
      `Armed Tool: ${state.admin.activeTool ? state.admin.activeTool.label : "None"}`,
      `Owner: ${state.admin.owner}`,
      `Point Count: ${state.admin.points.length}`,
      "",
      "Points:",
    ];
    if (state.admin.points.length) {
      state.admin.points.forEach((point, index) => {
        const owner = point.owner ? ` owner=${point.owner}` : "";
        const detail = point.detail ? ` ${point.detail}` : "";
        lines.push(`${index + 1}. ${point.label} @ (${Math.round(point.x)}, ${Math.round(point.y)})${owner}${detail}`);
      });
    } else {
      lines.push(`Admin panel ready on ${getMapPresetDef().label}. Type a command, arm it, then click the map.`);
    }
    lines.push("", "Detailed Log:");
    if (state.admin.log.length) lines.push(...state.admin.log);
    else lines.push("(no log entries yet)");
    return lines.join("\n");
  }

  function refreshAdminLogUi() {
    if (adminLog) {
      adminLog.value = getAdminLogSnapshotText();
      adminLog.scrollTop = adminLog.scrollHeight;
    }
  }

  function syncAdminUi() {
    if (slashOverlay) slashOverlay.classList.toggle("hidden", !state.admin.slashOpen);
    if (adminOverlay) adminOverlay.classList.toggle("hidden", !state.admin.panelOpen);
    if (adminCommandInput && adminCommandInput.value !== state.admin.commandText) adminCommandInput.value = state.admin.commandText;
    if (adminOwnerSelect) adminOwnerSelect.value = state.admin.owner;
    setAdminStatus(state.admin.statusText);
    refreshAdminLogUi();
  }

  function addAdminLog(message, details = {}) {
    const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const parts = [`[${stamp}]`, message];
    if (details.command) parts.push(`tool=${details.command}`);
    if (Number.isFinite(details.x) && Number.isFinite(details.y)) parts.push(`point=(${Math.round(details.x)}, ${Math.round(details.y)})`);
    if (details.owner) parts.push(`owner=${details.owner}`);
    if (details.extra) parts.push(details.extra);
    state.admin.log.push(parts.join(" | "));
    if (state.admin.log.length > 220) state.admin.log.splice(0, state.admin.log.length - 220);
    refreshAdminLogUi();
  }

  function openSlashCommand(initialValue = "/admin") {
    if (state.mode !== "playing") return;
    state.admin.slashOpen = true;
    syncAdminUi();
    if (slashCommandInput) {
      slashCommandInput.value = initialValue;
      window.setTimeout(() => {
        slashCommandInput.focus();
        slashCommandInput.setSelectionRange(slashCommandInput.value.length, slashCommandInput.value.length);
      }, 0);
    }
  }

  function closeSlashCommand() {
    state.admin.slashOpen = false;
    syncAdminUi();
  }

  function openAdminPanel(options = {}) {
    if (state.mode !== "playing") return;
    state.admin.panelOpen = true;
    state.admin.slashOpen = false;
    if (!state.admin.activeTool) setAdminStatus("Admin panel active. Type a command like <code>rock</code>, press Arm Tool, then click the map.");
    syncAdminUi();
    if (options.focus !== false && adminCommandInput) {
      window.setTimeout(() => {
        adminCommandInput.focus();
        adminCommandInput.select();
      }, 0);
    }
  }

  function closeAdminPanel() {
    state.admin.panelOpen = false;
    state.admin.slashOpen = false;
    syncAdminUi();
  }

  function clearAdminPoints() {
    state.admin.points = [];
    setAdminStatus("Admin points cleared.");
    addAdminLog("Cleared admin point markers.");
    syncAdminUi();
  }

  function clearAdminLog() {
    state.admin.log = [];
    setAdminStatus("Admin log cleared.");
    refreshAdminLogUi();
  }

  async function copyAdminLog() {
    const text = getAdminLogSnapshotText();
    try {
      await navigator.clipboard.writeText(text);
      setAdminStatus("Admin log copied to the clipboard.");
      addAdminLog("Copied admin log to clipboard.");
    } catch (error) {
      setAdminStatus("Copy failed. Select the log box and copy it manually.");
      addAdminLog("Clipboard copy failed.", { extra: error && error.message ? error.message : "manual copy required" });
    }
    syncAdminUi();
  }

  function executeSlashCommand(raw) {
    const normalized = String(raw || "").trim().replace(/^\/+/, "").toLowerCase();
    if (!normalized) {
      closeSlashCommand();
      return;
    }
    if (normalized === "admin") {
      openAdminPanel();
      addAdminLog("Opened admin panel from slash command.");
      return;
    }
    if (normalized === "admin close") {
      closeAdminPanel();
      addAdminLog("Closed admin panel from slash command.");
      return;
    }
    if (normalized.startsWith("admin ")) {
      openAdminPanel({ focus: false });
      armAdminToolFromCommand(normalized.slice(6), { log: true });
      closeSlashCommand();
      return;
    }
    setAdminStatus(`Unknown slash command <code>/${normalized}</code>. Use <code>/admin</code>.`);
    addAdminLog("Unknown slash command.", { extra: `/${normalized}` });
    closeSlashCommand();
  }

  function getAdminOwner() {
    return String(state.admin.owner || "neutral");
  }

  function normalizeAdminCommand(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\/]+/g, " ")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getAdminToolLabel(tool) {
    if (!tool) return "admin tool";
    return tool.label || tool.command || tool.kind || "admin tool";
  }

  function resolveAdminTool(raw) {
    const command = normalizeAdminCommand(raw);
    if (!command) return null;

    if (["erase", "delete", "remove", "clear"].includes(command)) {
      return {
        kind: "erase",
        command,
        label: "Erase",
        color: "#ff9b89",
        usesOwner: false,
      };
    }

    if (["rock", "rocks", "stone", "stone rock", "boulder"].includes(command)) {
      return {
        kind: "resource",
        resourceKind: "rock",
        spriteKey: "rock_1",
        accentKey: null,
        command,
        label: "Rock",
        color: "#d7e4ef",
        usesOwner: false,
      };
    }

    if (["desert rock", "canyon rock", "desert_rock"].includes(command)) {
      return {
        kind: "resource",
        resourceKind: "rock",
        spriteKey: "desert_rock",
        accentKey: "dried_bush",
        command,
        label: "Desert Rock",
        color: "#f1c7a3",
        usesOwner: false,
      };
    }

    if (["tree", "trees", "tree 1", "tree1", "forest tree"].includes(command)) {
      return {
        kind: "resource",
        resourceKind: "tree",
        spriteKey: "tree_1",
        accentKey: "bush",
        command,
        label: "Tree",
        color: "#9fe0a4",
        usesOwner: false,
      };
    }

    if (["tree 2", "tree2"].includes(command)) {
      return {
        kind: "resource",
        resourceKind: "tree",
        spriteKey: "tree_2",
        accentKey: "bush",
        command,
        label: "Tree 2",
        color: "#9fe0a4",
        usesOwner: false,
      };
    }

    if (["civilian", "villager", "npc", "citizen"].includes(command)) {
      return {
        kind: "civilian",
        command,
        label: "Civilian",
        color: "#ffe29a",
        usesOwner: true,
      };
    }

    if (["deer", "boar"].includes(command)) {
      return {
        kind: "animal",
        species: command,
        command,
        label: command === "boar" ? "Boar" : "Deer",
        color: command === "boar" ? "#d7a47e" : "#f0d3a1",
        usesOwner: false,
      };
    }

    const biomeAliases = {
      meadow: ["meadow", "grass", "green", "green map"],
      forest: ["forest", "woods", "woodland"],
      hill: ["hill", "hills", "ridge"],
      river: ["river", "water", "stream"],
      ocean: ["ocean", "sea", "coast", "coastal water"],
      marsh: ["marsh", "swamp", "bog"],
      desert: ["desert", "sand", "dunes"],
      canyon: ["canyon", "ravine", "gorge"],
      deadlands: ["deadlands", "dead lands", "blight", "wasteland"],
      road: ["road", "path", "trail"],
    };
    for (const [biome, aliases] of Object.entries(biomeAliases)) {
      if (aliases.includes(command)) {
        return {
          kind: "biome",
          biome,
          command,
          label: terrainEffects[biome].label,
          color: terrainPalette[biome][1],
          usesOwner: false,
        };
      }
    }

    const assetMatch = assetCatalog.find((item) => {
      const probes = [item.id, item.name];
      return probes.some((probe) => normalizeAdminCommand(probe) === command);
    });
    if (assetMatch) {
      return {
        kind: "asset",
        item: assetMatch,
        command,
        label: assetMatch.name,
        color: "#8fd8ff",
        usesOwner: true,
      };
    }

    const weaponMatch = weaponCatalog.find((item) => {
      const probes = [item.id, item.name, item.role];
      return probes.some((probe) => normalizeAdminCommand(probe) === command);
    });
    if (weaponMatch) {
      return {
        kind: "weapon",
        item: weaponMatch,
        command,
        label: weaponMatch.name,
        color: weaponMatch.type === "ability" ? "#ffb484" : "#9fe0a4",
        usesOwner: true,
      };
    }

    return null;
  }

  function armAdminToolFromCommand(raw = state.admin.commandText, options = {}) {
    const nextCommand = String(raw || "").trim();
    state.admin.commandText = nextCommand;
    const tool = resolveAdminTool(nextCommand);
    if (!tool) {
      state.admin.activeTool = null;
      setAdminStatus(`Unknown admin command <code>${nextCommand || "(empty)"}</code>. Try <code>rock</code>, <code>tree</code>, <code>desert</code>, <code>royal keep</code>, <code>militia squad</code>, or <code>erase</code>.`);
      if (options.log !== false) addAdminLog("Unknown admin tool.", { command: nextCommand || "(empty)" });
      syncAdminUi();
      return null;
    }
    state.admin.activeTool = tool;
    const owner = tool.usesOwner ? getAdminOwner() : "";
    const action = tool.kind === "biome"
      ? "paint tiles"
      : tool.kind === "erase"
        ? "erase the nearest object or reset a tile"
        : "place it";
    setAdminStatus(`Armed <code>${tool.label}</code>. Click the map to ${action}${owner ? ` for <code>${owner}</code>` : ""}.`);
    if (options.log !== false) addAdminLog("Armed admin tool.", { command: tool.command, owner: owner || null, extra: tool.label });
    syncAdminUi();
    return tool;
  }

  function addAdminPoint(point) {
    state.admin.points.push({
      id: createId("admin-point"),
      x: point.x,
      y: point.y,
      label: point.label,
      owner: point.owner || "",
      tint: point.tint || "#8fd8ff",
      detail: point.detail || "",
    });
    if (state.admin.points.length > 160) state.admin.points.splice(0, state.admin.points.length - 160);
    refreshAdminLogUi();
  }

  function getLanShareOrigin() {
    const source = state.lan.apiBase || state.lan.linkApiBase || state.lan.joinUrl || (location.protocol !== "file:" ? location.origin : "");
    if (!source) return "the host machine";
    try {
      return new URL(source, location.href).origin;
    } catch (error) {
      return source;
    }
  }

  function normalizeLanMatchType(value) {
    return value === "lan-coop" ? "lan-coop" : "lan";
  }

  function normalizeLanApiBase(value) {
    if (!value) return "";
    try {
      const parsed = new URL(String(value).trim(), location.href);
      return /^https?:$/i.test(parsed.protocol) ? parsed.origin : "";
    } catch (error) {
      return "";
    }
  }

  function getSharedRoomConfigFromUrl() {
    const params = new URLSearchParams(location.search);
    const roomCode = sanitizeRoomCode(params.get("room"));
    if (!roomCode) return null;
    return {
      roomCode,
      matchType: normalizeLanMatchType(params.get("match")),
      apiBase: normalizeLanApiBase(params.get("server")),
    };
  }

  function isLanLobbyActive() {
    return state.mode === "menu" && Boolean(state.lan.clientId) && Boolean(state.lan.roomCode) && Boolean(state.lan.roomMatchType);
  }

  function syncMenuButtons() {
    if (!startBtn) return;
    if (isLanLobbyActive()) {
      startBtn.textContent = state.lan.started
        ? "LAN Room Starting..."
        : state.lan.role === "host"
          ? "Start Hosted LAN Room"
          : "Start Joined LAN Room";
      startBtn.disabled = Boolean(state.lan.started);
      return;
    }
    if (state.mode === "menu" && !state.lan.clientId && state.lan.linkRoomCode && !isLanBlockedOnCurrentOrigin()) {
      startBtn.textContent = `Start Shared ${state.lan.linkMatchType === "lan-coop" ? "LAN Co-op" : "LAN Versus"}`;
      startBtn.disabled = false;
      return;
    }
    startBtn.textContent = "Launch Campaign";
    startBtn.disabled = false;
  }

  function resetLanSessionState() {
    state.lan.role = "offline";
    state.lan.roomCode = "";
    state.lan.roomMatchType = null;
    state.lan.clientId = null;
    state.lan.localOwner = null;
    state.lan.pollTimer = 0;
    state.lan.syncTimer = 0;
    state.lan.lastSnapshotRevision = 0;
    state.lan.lastCommandIndex = 0;
    state.lan.awaitingPoll = false;
    state.lan.awaitingPush = false;
    state.lan.apiBase = "";
    state.lan.guestJoined = false;
    state.lan.started = false;
    state.lan.startedAt = 0;
    if (lanCodeInput) lanCodeInput.value = "";
    setLanLink("");
    const sharedRoom = getSharedRoomConfigFromUrl();
    state.lan.linkRoomCode = sharedRoom ? sharedRoom.roomCode : "";
    state.lan.linkMatchType = sharedRoom ? sharedRoom.matchType : null;
    state.lan.linkApiBase = sharedRoom ? sharedRoom.apiBase : "";
    if (state.lan.linkApiBase) state.lan.apiBase = state.lan.linkApiBase;
    if (sharedRoom && lanCodeInput) lanCodeInput.value = sharedRoom.roomCode;
    setLanStatus(getLanIdleStatusText(sharedRoom && !isLanBlockedOnCurrentOrigin() ? sharedRoom : null));
    syncLanOriginUi();
    syncMenuButtons();
  }

  function getMatchLabel(matchType = state.matchType) {
    if (matchType === "coop" || matchType === "lan-coop") return "Co-op";
    if (matchType === "versus" || matchType === "lan") return "Versus";
    return "Campaign";
  }

  function isPvEMatch(matchType = state.matchType) {
    return matchType === "single" || matchType === "coop" || matchType === "lan-coop";
  }

  function isCeasefireActive() {
    return isPvEMatch() && state.difficulty.ceasefireTimer > 0;
  }

  function hasLocalAssistAuthority() {
    return isPvEMatch() && (!isLanMatch() || isLanHost());
  }

  function syncLiveControls() {
    if (liveControls) liveControls.classList.toggle("hidden", state.mode !== "playing");
    const difficultyLabel = state.difficulty.mode === "easy" ? "Easy" : state.difficulty.mode === "hard" ? "Hard" : "Normal";
    if (difficultyBtn) difficultyBtn.textContent = `Difficulty: ${difficultyLabel}`;
    if (ceasefireBtn) ceasefireBtn.textContent = isCeasefireActive() ? `Ceasefire ${Math.ceil(state.difficulty.ceasefireTimer)}s` : "Ceasefire (Esc)";
    const assistControlsDisabled = !hasLocalAssistAuthority();
    const speedDisabled = isLanMatch();
    if (difficultyBtn) difficultyBtn.disabled = assistControlsDisabled;
    if (ceasefireBtn) ceasefireBtn.disabled = assistControlsDisabled;
    if (speedSlowBtn) speedSlowBtn.disabled = speedDisabled || state.speed.multiplier === 0.5;
    if (speedNormalBtn) speedNormalBtn.disabled = speedDisabled || state.speed.multiplier === 1;
    if (speedFastBtn) speedFastBtn.disabled = speedDisabled || state.speed.multiplier === 2;
    if (speedUltraBtn) speedUltraBtn.disabled = speedDisabled || state.speed.multiplier === 5;
    if (assistStatus) {
      if (isLanMatch() && isPvEMatch()) {
        assistStatus.textContent = isLanHost()
          ? `LAN co-op active. Host controls difficulty and ceasefire. Speed stays locked at 1x during network sync.`
          : `LAN co-op active. Host controls difficulty and ceasefire. Speed stays locked at 1x during network sync.`;
      } else if (isLanMatch()) {
        assistStatus.textContent = `LAN versus active. Local speed changes are disabled while network sync is running.`;
      } else if (!isPvEMatch()) {
        assistStatus.textContent = `Speed ${state.speed.multiplier}x. Difficulty assists are available in campaign and co-op PvE modes.`;
      } else if (isCeasefireActive()) {
        assistStatus.textContent = `${difficultyLabel} mode • ceasefire active for ${Math.ceil(state.difficulty.ceasefireTimer)}s • speed ${state.speed.multiplier}x.`;
      } else if (state.difficulty.mode === "easy") {
        assistStatus.textContent = `${getMatchLabel()} Easy mode active. Enemy factions stay defensive and waves come in softer at ${state.speed.multiplier}x speed.`;
      } else if (state.difficulty.mode === "hard") {
        assistStatus.textContent = `${getMatchLabel()} Hard mode active. Extra war camps are active and enemy pressure ramps harder at ${state.speed.multiplier}x speed.`;
      } else {
        assistStatus.textContent = `${getMatchLabel()} normal pressure at ${state.speed.multiplier}x speed.`;
      }
    }
  }

  function setGameSpeed(multiplier) {
    if (isLanMatch()) {
      notify("Game speed changes are disabled during LAN matches.", "#ffb484");
      return;
    }
    state.speed.multiplier = multiplier;
    syncLiveControls();
    notify(`Game speed set to ${multiplier}x`, "#8fd4ff");
  }

  function toggleDifficultyMode() {
    if (!hasLocalAssistAuthority()) {
      notify("Difficulty changes are only available for PvE host controls.", "#ffb484");
      return;
    }
    state.difficulty.mode = state.difficulty.mode === "normal" ? "easy" : state.difficulty.mode === "easy" ? "hard" : "normal";
    if (state.difficulty.mode === "hard") applyHardDifficultyPressure();
    syncLiveControls();
    const difficultyLabel = state.difficulty.mode === "easy" ? "Easy" : state.difficulty.mode === "hard" ? "Hard" : "Normal";
    notify(`Difficulty set to ${difficultyLabel}.`, "#9fe0a4");
  }

  function activateCeasefire() {
    if (state.mode !== "playing") return;
    if (!hasLocalAssistAuthority()) {
      notify("Ceasefire is only available for PvE host controls.", "#ffb484");
      return;
    }
    state.difficulty.ceasefireTimer = state.difficulty.ceasefireDuration;
    for (const unit of state.world.units) {
      if (isHumanOwner(unit.owner) || unit.owner === "neutral") continue;
      unit.targetId = null;
      unit.moveTarget = null;
      unit.focusMove = false;
      unit.order = "idle";
    }
    syncLiveControls();
    notify(`Ceasefire activated for ${Math.round(state.difficulty.ceasefireDuration / 60)} minutes.`, "#9fe0a4");
  }

  function sanitizeRoomCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  }

  function getLanApiOrigins() {
    const origins = [];
    const currentHost = String(location.hostname || "").trim();
    const rememberedApiBase = normalizeLanApiBase(state.lan && state.lan.apiBase);
    const sharedApiBase = normalizeLanApiBase(state.lan && state.lan.linkApiBase);
    const joinApiBase = normalizeLanApiBase(state.lan && state.lan.joinUrl);
    if (rememberedApiBase) origins.push(rememberedApiBase);
    if (sharedApiBase) origins.push(sharedApiBase);
    if (joinApiBase) origins.push(joinApiBase);
    if (location.origin && /^https?:/i.test(location.origin) && String(location.port || "") === String(DEFAULT_LAN_SERVER_PORT)) {
      origins.push(location.origin);
    }
    if (currentHost && currentHost !== "127.0.0.1" && currentHost !== "localhost") origins.push(`http://${currentHost}:${DEFAULT_LAN_SERVER_PORT}`);
    origins.push(`http://127.0.0.1:${DEFAULT_LAN_SERVER_PORT}`);
    origins.push(`http://localhost:${DEFAULT_LAN_SERVER_PORT}`);
    return [...new Set(origins)];
  }

  function getLanApiTimeout(url) {
    if (/\/api\/lan\/poll$/.test(url)) return 6000;
    if (/\/api\/lan\/input$/.test(url)) return 7000;
    return 20000;
  }

  function coerceRequestError(error, fallback = "Request failed.") {
    if (!error) return new Error(fallback);
    const errorMessage = String(error.message || error || "");
    if (error.name === "AbortError" || /aborted without reason/i.test(errorMessage) || /user aborted a request/i.test(errorMessage)) {
      return new Error("Timed out reaching the LAN server.");
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  async function postJson(url, payload) {
    const isAbsoluteUrl = /^https?:\/\//i.test(url);
    const isLanApi = !isAbsoluteUrl && /^\/api\/lan\//.test(url);
    const attempts = [];
    if (isAbsoluteUrl) {
      attempts.push(url);
    } else {
      const currentPortMatchesLanServer = String(location.port || "") === String(DEFAULT_LAN_SERVER_PORT);
      if (!isLanApi && location.protocol !== "file:") attempts.push(url);
      if (isLanApi) {
        if (state.lan && state.lan.apiBase) attempts.push(`${state.lan.apiBase}${url}`);
        if (location.protocol !== "file:" && currentPortMatchesLanServer) attempts.push(url);
        for (const origin of getLanApiOrigins()) attempts.push(`${origin}${url}`);
      } else if (location.protocol !== "file:") {
        attempts.push(url);
      }
    }
    let lastError = null;
    for (const attempt of [...new Set(attempts)]) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => controller.abort(), isLanApi ? getLanApiTimeout(url) : 5000) : 0;
      try {
        const response = await fetch(attempt, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload || {}),
          signal: controller ? controller.signal : undefined,
        });
        if (timeoutId) window.clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed (${response.status})`);
        if (isLanApi) {
          state.lan.apiBase = isAbsoluteUrl || /^https?:\/\//i.test(attempt)
            ? new URL(attempt).origin
            : location.protocol !== "file:"
              ? location.origin
              : state.lan.apiBase || "";
        }
        return data;
      } catch (error) {
        if (timeoutId) window.clearTimeout(timeoutId);
        lastError = coerceRequestError(error, "Request failed.");
        if (!isLanApi) break;
      }
    }
    throw lastError || new Error("Request failed.");
  }

  function serializeLanSnapshot() {
    return {
      mode: state.mode,
      matchType: state.matchType,
      mapPreset: state.world.preset || state.mapPreset,
      winnerOwner: state.winnerOwner,
      loserOwner: state.loserOwner,
      time: state.time,
      ids: state.ids,
      waves: { ...state.waves },
      difficulty: { ...state.difficulty },
      players: Object.fromEntries(
        Object.entries(state.players).map(([owner, player]) => [
          owner,
          {
            owner: player.owner,
            label: player.label,
            resources: { ...player.resources },
            quickSlots: {
              assets: [...player.quickSlots.assets],
              weapons: [...player.quickSlots.weapons],
            },
            recentMessage: player.ui.recentMessage,
          },
        ]),
      ),
      world: {
        preset: state.world.preset || state.mapPreset,
        tiles: state.world.tiles.map((tile) => ({ ...tile })),
        trees: state.world.trees.map((tree) => ({ ...tree })),
        rocks: state.world.rocks.map((rock) => ({ ...rock })),
        civilians: state.world.civilians.map((civilian) => ({ ...civilian })),
        animals: state.world.animals.map((animal) => ({ ...animal })),
        buildings: state.world.buildings.map(({ def, ...building }) => ({ ...building })),
        units: state.world.units.map((unit) => ({ ...unit })),
        projectiles: state.world.projectiles.map((projectile) => ({ ...projectile })),
        effects: state.world.effects.map((effect) => ({ ...effect })),
        drops: state.world.drops.map(({ def, ...drop }) => ({ ...drop, defId: def.id })),
        notifications: state.world.notifications.slice(-8).map((note) => ({ ...note })),
        quests: state.world.quests.map((quest) => ({ ...quest })),
      },
    };
  }

  function restoreLanWorld(snapshot) {
    const world = snapshot.world || {};
    state.world.preset = sanitizeMapPreset(world.preset || snapshot.mapPreset || state.world.preset);
    state.world.tiles = (world.tiles || []).map((tile) => ({ ...tile }));
    state.world.trees = (world.trees || []).map((tree) => ({ ...tree }));
    state.world.rocks = (world.rocks || []).map((rock) => ({ ...rock }));
    state.world.civilians = (world.civilians || []).map((civilian) => ({ ...civilian }));
    state.world.animals = (world.animals || []).map((animal) => ({ ...animal }));
    state.world.buildings = (world.buildings || []).map((building) => ({
      ...building,
      def: itemIndex.get(building.itemId),
    }));
    state.world.units = (world.units || []).map((unit) => ({ ...unit }));
    state.world.projectiles = (world.projectiles || []).map((projectile) => ({ ...projectile }));
    state.world.effects = (world.effects || []).map((effect) => ({ ...effect }));
    state.world.drops = (world.drops || []).map((drop) => ({
      ...drop,
      def: rareDropIndex.get(drop.defId) || rareDropCatalog[0],
    }));
    state.world.notifications = (world.notifications || []).map((note) => ({ ...note }));
    state.world.quests = (world.quests || []).map((quest) => ({ ...quest }));
    if (state.world.tiles.length) renderTerrainCache();
  }

  function showMatchResultOverlay() {
    exitFirstPerson(getFirstPersonActivePlayer(), { silent: true });
    overlay.classList.remove("hidden");
    const title = overlay.querySelector("h1");
    const intro = overlay.querySelector(".intro");
    if (isCoopMatch()) {
      const allyCount = getHumanPlayers().length;
      title.textContent = state.mode === "victory" ? `${allyCount}P Co-op Victory` : `${allyCount}P Co-op Defeat`;
      intro.textContent = state.mode === "victory"
        ? "Your allied coalition crushed both enemy strongholds. Launch another co-op war from the command menu."
        : "All allied empires were destroyed before the enemy nations fell. Launch another co-op war from the command menu.";
    } else if (isCompetitiveMatch()) {
      if (getHumanPlayers().length > 2) {
        title.textContent = state.winnerOwner ? `${getPlayerState(state.winnerOwner).label} Wins` : "Mutual Defeat";
        intro.textContent = state.winnerOwner
          ? `${getPlayerState(state.winnerOwner).label} outlasted every rival empire in the local split-screen war. Start another battle from the command menu.`
          : "Every empire was wiped out in the same battle. Start another war from the command menu.";
      } else {
        const localOwner = getPrimaryPlayer() && getPrimaryPlayer().owner;
        const localWon = Boolean(state.winnerOwner && localOwner === state.winnerOwner);
        title.textContent = !state.winnerOwner ? "Mutual Defeat" : localWon ? "Victory" : "Defeat";
        intro.textContent = state.winnerOwner
          ? `${getPlayerState(state.winnerOwner).label} destroyed ${getPlayerState(state.loserOwner).label}. Start another war from the command menu.`
          : "Both empires were destroyed. Start another war from the command menu.";
      }
    } else if (state.mode === "victory") {
      title.textContent = "Victory";
      intro.textContent = "The rival nations have fallen. Your empire rules the map.";
    } else if (state.mode === "defeat") {
      title.textContent = "Defeat";
      intro.textContent = "Your entire army and empire were destroyed. Rally a new campaign and try again.";
    }
    versusBtn.textContent = "2P Split-Screen Versus";
    if (versus3Btn) versus3Btn.textContent = "3P Split-Screen Versus";
    if (versus4Btn) versus4Btn.textContent = "4P Split-Screen Versus";
    if (coopBtn) coopBtn.textContent = "2P Split-Screen Co-op";
    if (coop3Btn) coop3Btn.textContent = "3P Split-Screen Co-op";
    if (coop4Btn) coop4Btn.textContent = "4P Split-Screen Co-op";
    if (hostLanBtn) hostLanBtn.textContent = "Host LAN Versus";
    if (joinLanBtn) joinLanBtn.textContent = "Join LAN Versus";
    if (hostLanCoopBtn) hostLanCoopBtn.textContent = "Host LAN Co-op";
    if (joinLanCoopBtn) joinLanCoopBtn.textContent = "Join LAN Co-op";
    syncLanOriginUi();
    if (audioState.lastResultCue !== state.mode) {
      audioState.lastResultCue = state.mode;
      playUiSound(state.mode === "victory" ? "victory" : "defeat", { volume: 0.92, cooldown: 0.2 });
    }
    syncMenuButtons();
    syncLiveControls();
  }

  function applyLanSnapshot(snapshot) {
    if (!snapshot) return;
    state.matchType = snapshot.matchType || state.matchType;
    if (snapshot.mapPreset) setMapPreset(snapshot.mapPreset);
    state.lan.roomMatchType = state.matchType;
    state.mode = snapshot.mode || state.mode;
    state.winnerOwner = snapshot.winnerOwner || null;
    state.loserOwner = snapshot.loserOwner || null;
    state.time = snapshot.time || 0;
    state.ids = snapshot.ids || state.ids;
    state.waves = { ...state.waves, ...(snapshot.waves || {}) };
    state.difficulty = { ...state.difficulty, ...(snapshot.difficulty || {}) };
    for (const [owner, data] of Object.entries(snapshot.players || {})) {
      const player = state.players[owner];
      if (!player || !data) continue;
      player.resources.coins = data.resources && Number.isFinite(data.resources.coins) ? data.resources.coins : player.resources.coins;
      player.resources.wood = data.resources && Number.isFinite(data.resources.wood) ? data.resources.wood : player.resources.wood;
      player.resources.stone = data.resources && Number.isFinite(data.resources.stone) ? data.resources.stone : player.resources.stone;
      if (data.quickSlots) {
        player.quickSlots.assets = [...(data.quickSlots.assets || player.quickSlots.assets)];
        player.quickSlots.weapons = [...(data.quickSlots.weapons || player.quickSlots.weapons)];
      }
      if (data.recentMessage && owner !== state.lan.localOwner) player.ui.recentMessage = data.recentMessage;
    }
    restoreLanWorld(snapshot);
    const localPlayer = getPrimaryPlayer();
    if (localPlayer) {
      const liveSelectionIds = new Set(state.world.units.filter((unit) => unit.owner === localPlayer.owner).map((unit) => unit.id));
      localPlayer.selectedIds = new Set([...localPlayer.selectedIds].filter((id) => liveSelectionIds.has(id)));
      setActivePlayerContext(localPlayer, getViewportForPlayer(localPlayer));
      if (localPlayer.input.cursorX || localPlayer.input.cursorY) updatePlayerPointer(localPlayer, localPlayer.input.cursorX, localPlayer.input.cursorY);
    }
    updateFogOfWar();
    if (state.mode === "playing") overlay.classList.add("hidden");
    else showMatchResultOverlay();
    syncMenuButtons();
    syncLiveControls();
  }

  function applyWorldCommand(owner, selectedIds, worldPos, hoveredEnemyIds = []) {
    const ids = Array.isArray(selectedIds) ? new Set(selectedIds) : selectedIds;
    const selectedUnits = state.world.units.filter((unit) => unit.owner === owner && ids.has(unit.id));
    if (!selectedUnits.length) return false;
    const targetEntity = findNearest([...state.world.units, ...state.world.buildings, ...state.world.animals, ...state.world.trees, ...state.world.rocks, ...state.world.civilians], worldPos.x, worldPos.y, (entity) => {
      if (isResourceNode(entity)) return Math.hypot(entity.x - worldPos.x, entity.y - worldPos.y) < entity.radius + 16;
      if (isNeutralEconomyTarget(entity)) return Math.hypot(entity.x - worldPos.x, entity.y - worldPos.y) < (entity.radius || 12) + 18;
      if (entity.kind === "animal") return Math.hypot(entity.x - worldPos.x, entity.y - worldPos.y) < entity.radius + 20;
      return entity.owner !== "neutral" && !areOwnersAllied(entity.owner, owner) && Math.hypot(entity.x - worldPos.x, entity.y - worldPos.y) < (entity.radius || 20) + 20;
    });
    if (targetEntity && isResourceNode(targetEntity)) {
      issueInteractionOrder(selectedUnits, targetEntity, "resource");
      notify(`Harvest order issued on ${targetEntity.kind}.`, "#9de291");
      playWorldSound("orderHarvest", targetEntity.x, targetEntity.y, { cooldown: 0.08, volume: 0.62 });
    } else if (targetEntity && isNeutralEconomyTarget(targetEntity)) {
      issueInteractionOrder(selectedUnits, targetEntity, "tax");
      notify(targetEntity.kind === "civilian" ? "Collecting villager dues." : "Tax collection ordered at the village.", "#ffd889");
      playWorldSound("orderTax", targetEntity.x, targetEntity.y, { cooldown: 0.08, volume: 0.68 });
    } else if (targetEntity && targetEntity.kind !== "animal" && isEnemyTarget(targetEntity, owner)) {
      const hoveredIds = hoveredEnemyIds.length ? hoveredEnemyIds : [targetEntity.id];
      issueAttackOrder(selectedUnits, hoveredIds);
      playWorldSound("orderAttack", targetEntity.x, targetEntity.y, { cooldown: 0.07, volume: 0.74 });
    } else if (targetEntity && targetEntity.kind === "animal") {
      issueAttackOrder(selectedUnits, [targetEntity.id]);
      playWorldSound("orderAttack", targetEntity.x, targetEntity.y, { cooldown: 0.07, volume: 0.7 });
    } else {
      issueMoveOrder(selectedUnits, worldPos);
      playWorldSound("orderMove", worldPos.x, worldPos.y, { cooldown: 0.06, volume: 0.66 });
    }
    return true;
  }

  function applyLanCommand(command) {
    if (!command || !command.type || command.owner !== "player2") return;
    const remotePlayer = state.players[command.owner];
    if (!remotePlayer) return;
    if (command.type === "setQuickSlot") {
      remotePlayer.quickSlots[command.slot.side][command.slot.index] = command.itemId;
      return;
    }
    if (command.type === "deployPlacement") {
      const item = itemIndex.get(command.itemId);
      if (item) deployPlacement(item, command.worldPos.x, command.worldPos.y, command.owner);
      return;
    }
    if (command.type === "worldCommand") {
      remotePlayer.selectedIds = new Set(command.selectedIds || []);
      applyWorldCommand(command.owner, remotePlayer.selectedIds, command.worldPos, command.hoveredEnemyIds || []);
    }
  }

  function queueLanCommand(command) {
    if (!isLanClient() || !state.lan.clientId) return;
    postJson("/api/lan/input", {
      clientId: state.lan.clientId,
      command,
    }).catch((error) => {
      setLanStatus(`LAN command failed: ${error.message}`);
    });
  }

  function hasLanSession() {
    return state.lan.role !== "offline" && Boolean(state.lan.clientId) && Boolean(state.lan.roomMatchType);
  }

  function beginLanRoomMatch(matchType = state.lan.roomMatchType || "lan", startedAt = Date.now()) {
    state.lan.roomMatchType = normalizeLanMatchType(matchType);
    state.lan.started = true;
    state.lan.startedAt = startedAt || Date.now();
    syncMenuButtons();
    if (state.mode === "playing" && state.matchType === state.lan.roomMatchType) return;
    startMatch(state.lan.roomMatchType);
  }

  async function requestLanRoomStart() {
    if (!ensureLanAvailableFromCurrentOrigin()) return;
    if (!hasLanSession()) {
      setLanStatus("Host or join a LAN room first.");
      return;
    }
    const shareOrigin = getLanShareOrigin();
    try {
      const response = await postJson("/api/lan/start", {
        clientId: state.lan.clientId,
      });
      state.lan.roomMatchType = normalizeLanMatchType(response.matchType || state.lan.roomMatchType);
      state.lan.started = Boolean(response.started);
      state.lan.startedAt = response.startedAt || state.lan.startedAt || Date.now();
      state.lan.guestJoined = Boolean(response.guestJoined);
      setLanStatus(
        state.lan.role === "host"
          ? `LAN room ${state.lan.roomCode} is starting for everyone on ${shareOrigin}.`
          : `Joined room ${state.lan.roomCode} on ${shareOrigin}. Starting the shared LAN battle for everyone in the room.`,
      );
      beginLanRoomMatch(state.lan.roomMatchType, state.lan.startedAt);
    } catch (error) {
      setLanStatus(`Unable to start LAN room: ${error.message}`);
    }
  }

  async function pushLanSnapshot() {
    if (!isLanHost() || state.lan.awaitingPush || !state.lan.clientId || state.mode !== "playing") return;
    state.lan.awaitingPush = true;
    const shareOrigin = getLanShareOrigin();
    try {
      const response = await postJson("/api/lan/state", {
        clientId: state.lan.clientId,
        snapshot: serializeLanSnapshot(),
      });
      state.lan.lastSnapshotRevision = response.snapshotRevision || state.lan.lastSnapshotRevision;
      state.lan.guestJoined = Boolean(response.guestJoined);
      setLanStatus(
        response.guestJoined
          ? `Hosting room ${state.lan.roomCode} on ${shareOrigin}. The shared LAN battle is live.`
          : `Hosting room ${state.lan.roomCode} on ${shareOrigin}. Waiting for player 2 to join the shared room.`,
      );
    } catch (error) {
      setLanStatus(`LAN sync failed: ${error.message}`);
    } finally {
      state.lan.awaitingPush = false;
    }
  }

  async function pollLanServer() {
    if (state.lan.awaitingPoll || !hasLanSession()) return;
    state.lan.awaitingPoll = true;
    const shareOrigin = getLanShareOrigin();
    const lanRole = state.lan.role;
    try {
      const response = await postJson("/api/lan/poll", {
        clientId: state.lan.clientId,
        snapshotRevision: state.lan.lastSnapshotRevision,
        commandIndex: state.lan.lastCommandIndex,
      });
      state.lan.roomMatchType = normalizeLanMatchType(response.matchType || state.lan.roomMatchType);
      state.lan.guestJoined = Boolean(response.guestJoined);
      state.lan.started = Boolean(response.started);
      state.lan.startedAt = response.startedAt || state.lan.startedAt || 0;
      if (response.started && state.mode !== "playing") beginLanRoomMatch(state.lan.roomMatchType, state.lan.startedAt);
      if (lanRole === "host") {
        const commands = response.commands || [];
        for (const entry of commands) applyLanCommand(entry.command);
        if (commands.length) state.lan.lastCommandIndex = commands[commands.length - 1].index;
        if (!response.guestJoined) setLanStatus(`Hosting room ${state.lan.roomCode} on ${shareOrigin}. Share the generated room link and wait for player 2 to join.`);
        else if (!response.started) setLanStatus(`Player 2 joined room ${state.lan.roomCode}. Either player can press Start to launch the shared LAN battle.`);
        else setLanStatus(`Hosting room ${state.lan.roomCode} on ${shareOrigin}. The shared LAN battle is live.`);
      } else {
        if (response.snapshot) {
          state.lan.lastSnapshotRevision = response.snapshotRevision || state.lan.lastSnapshotRevision;
          applyLanSnapshot(response.snapshot);
        }
        setLanStatus(
          !response.started
            ? `Joined room ${state.lan.roomCode}. Press Start to launch the shared LAN battle for everyone in the room.`
            : response.hostReady
              ? `Joined room ${state.lan.roomCode} on ${shareOrigin}. Connected as Player 2 in the live battle.`
              : `Room ${state.lan.roomCode} started. Waiting for the host battlefield snapshot.`,
        );
      }
      syncMenuButtons();
    } catch (error) {
      setLanStatus(`LAN poll failed: ${error.message}`);
    } finally {
      state.lan.awaitingPoll = false;
    }
  }

  async function startLanHostMatch(matchType = "lan") {
    if (!ensureLanAvailableFromCurrentOrigin()) return;
    setLanLink("");
    setLanStatus(`Creating ${getMatchLabel(normalizeLanMatchType(matchType))} LAN room...`);
    try {
      const response = await postJson("/api/lan/host", { matchType });
      state.lan.role = "host";
      state.lan.roomCode = response.roomCode;
      state.lan.roomMatchType = normalizeLanMatchType(response.matchType || matchType);
      state.lan.clientId = response.clientId;
      state.lan.localOwner = "player1";
      state.lan.pollTimer = 0;
      state.lan.syncTimer = 0;
      state.lan.lastSnapshotRevision = 0;
      state.lan.lastCommandIndex = 0;
      state.lan.guestJoined = false;
      state.lan.started = false;
      state.lan.startedAt = 0;
      state.lan.linkRoomCode = response.roomCode;
      state.lan.linkMatchType = state.lan.roomMatchType;
      state.lan.linkApiBase = normalizeLanApiBase(response.apiBase || state.lan.apiBase);
      if (state.lan.linkApiBase && !state.lan.apiBase) state.lan.apiBase = state.lan.linkApiBase;
      state.mode = "menu";
      setLanLink(response.joinUrl || "");
      if (lanCodeInput) lanCodeInput.value = response.roomCode;
      overlay.classList.remove("hidden");
      setLanStatus(`Hosting ${getMatchLabel(state.lan.roomMatchType)} room ${response.roomCode}. Share the generated link below. When either joined player presses Start, the room launches for everyone.`);
      syncMenuButtons();
    } catch (error) {
      setLanStatus(`Unable to host LAN room: ${error.message}. Make sure the built-in server is running on http://127.0.0.1:${DEFAULT_LAN_SERVER_PORT} or your host PC LAN IP.`);
    }
  }

  async function joinLanMatch(matchType = "lan", options = {}) {
    if (!ensureLanAvailableFromCurrentOrigin()) return;
    const roomCode = sanitizeRoomCode(options.roomCode || (lanCodeInput && lanCodeInput.value));
    if (!roomCode) {
      setLanStatus("Enter the host room code first.");
      return;
    }
    const preferredApiBase = normalizeLanApiBase(options.apiBase || state.lan.linkApiBase || state.lan.apiBase);
    if (preferredApiBase) state.lan.apiBase = preferredApiBase;
    if (lanCodeInput) lanCodeInput.value = roomCode;
    setLanStatus(`Joining ${getMatchLabel(normalizeLanMatchType(matchType))} room ${roomCode}...`);
    try {
      const response = await postJson("/api/lan/join", { roomCode });
      state.lan.role = "client";
      state.lan.roomCode = response.roomCode;
      state.lan.roomMatchType = normalizeLanMatchType(response.matchType || matchType);
      state.lan.clientId = response.clientId;
      state.lan.localOwner = "player2";
      state.lan.pollTimer = 0;
      state.lan.syncTimer = 0;
      state.lan.lastSnapshotRevision = 0;
      state.lan.lastCommandIndex = 0;
      state.lan.guestJoined = true;
      state.lan.started = Boolean(response.started);
      state.lan.startedAt = response.startedAt || 0;
      state.lan.linkRoomCode = response.roomCode;
      state.lan.linkMatchType = state.lan.roomMatchType;
      state.lan.linkApiBase = normalizeLanApiBase(response.apiBase || preferredApiBase || state.lan.linkApiBase);
      if (state.lan.linkApiBase) state.lan.apiBase = state.lan.linkApiBase;
      state.mode = "menu";
      overlay.classList.remove("hidden");
      setLanLink(response.joinUrl || "");
      setLanStatus(
        response.started
          ? `Joined ${getMatchLabel(state.lan.roomMatchType)} room ${response.roomCode}. The LAN battle is already starting.`
          : `Joined ${getMatchLabel(state.lan.roomMatchType)} room ${response.roomCode}. Press Start to launch the room for everyone.`,
      );
      syncMenuButtons();
      if (response.started) beginLanRoomMatch(state.lan.roomMatchType, state.lan.startedAt);
      else if (options.startAfterJoin) await requestLanRoomStart();
    } catch (error) {
      setLanStatus(`Unable to join LAN room: ${error.message}. Make sure the built-in server is running on the host URL or on http://127.0.0.1:${DEFAULT_LAN_SERVER_PORT}.`);
    }
  }

  async function handlePrimaryStart() {
    if (isLanLobbyActive()) {
      await requestLanRoomStart();
      return;
    }
    if (state.mode === "menu" && !state.lan.clientId && state.lan.linkRoomCode && !isLanBlockedOnCurrentOrigin()) {
      await joinLanMatch(state.lan.linkMatchType || "lan", {
        roomCode: state.lan.linkRoomCode,
        apiBase: state.lan.linkApiBase,
        startAfterJoin: true,
      });
      return;
    }
    startMatch("single");
  }

  function createPlayerState(owner, label, viewportIndex, camera, controllerLabel, options = {}) {
    return {
      owner,
      label,
      viewportIndex,
      controllerLabel,
      startBase: options.startBase ? { ...options.startBase } : null,
      startFacing: options.startFacing || 0,
      controllerIndex: null,
      resources: {
        coins: 900,
        wood: 260,
        stone: 220,
      },
      camera: { ...camera },
      input: {
        mouseScreenX: 0,
        mouseScreenY: 0,
        mouseWorldX: 0,
        mouseWorldY: 0,
        leftDown: false,
        rightDown: false,
        middleDown: false,
        draggingSelection: false,
        panAnchorX: 0,
        panAnchorY: 0,
        dragStartScreenX: 0,
        dragStartScreenY: 0,
        cursorX: 0,
        cursorY: 0,
        actionSource: null,
      },
      ui: {
        openPanel: null,
        activePlacementId: null,
        hoveredSlot: null,
        draggingItemId: null,
        dragSource: null,
        panelScroll: { assets: 0, weapons: 0 },
        selectionBox: null,
        hoveredEnemyIds: [],
        recentMessage: "Build, tax, and conquer the rival nations.",
      },
      selectedIds: new Set(),
      quickSlots: cloneQuickSlots(),
      gamepadButtons: {},
      gamepadStickLatch: false,
      fog: createFogState(),
      firstPerson: {
        active: false,
        unitId: null,
        yaw: 0,
        pitch: -0.08,
        aiming: false,
        fireHeld: false,
        kick: 0,
        muzzle: 0,
        targetId: null,
        hitTimer: 0,
        hitDamage: 0,
        hitLabel: "",
        hitColor: "#ffe29a",
        savedCamera: null,
      },
    };
  }

  function isLanMatch() {
    return state.matchType === "lan" || state.matchType === "lan-coop";
  }

  function isLanHost() {
    return isLanMatch() && state.lan.role === "host";
  }

  function isLanClient() {
    return isLanMatch() && state.lan.role === "client";
  }

  function isCompetitiveMatch() {
    return state.matchType === "versus" || state.matchType === "lan";
  }

  function isCoopMatch() {
    return state.matchType === "coop" || state.matchType === "lan-coop";
  }

  function isSplitScreenMatch() {
    return state.matchType === "versus" || state.matchType === "coop";
  }

  function isTwoPlayerMatch() {
    return isCompetitiveMatch() || isCoopMatch();
  }

  function getControllablePlayers() {
    if (isLanMatch()) {
      const ownerId = state.lan.localOwner || (state.lan.role === "client" ? "player2" : "player1");
      const localPlayer = state.players[ownerId];
      return localPlayer ? [localPlayer] : [];
    }
    return getHumanPlayers();
  }

  function getPrimaryPlayer() {
    if (isLanMatch()) return state.players[state.lan.localOwner || (state.lan.role === "client" ? "player2" : "player1")] || state.players.player1 || state.players.player2;
    return isSplitScreenMatch() ? state.players.player1 : state.players.player;
  }

  function getActivePlayerState() {
    return state.players[state.activeOwner] || getPrimaryPlayer();
  }

  function getPlayerState(owner) {
    return state.players[owner] || null;
  }

  function getHumanPlayers() {
    return Object.values(state.players);
  }

  function getFirstPersonState(player = getActivePlayerState()) {
    return player && player.firstPerson ? player.firstPerson : null;
  }

  function getFirstPersonActivePlayer() {
    return getControllablePlayers().find((player) => player.firstPerson && player.firstPerson.active) ||
      getHumanPlayers().find((player) => player.firstPerson && player.firstPerson.active) ||
      null;
  }

  function isFirstPersonActive(player = getActivePlayerState()) {
    const mode = getFirstPersonState(player);
    return Boolean(mode && mode.active);
  }

  function canEnterFirstPerson(entity, player = getActivePlayerState()) {
    return Boolean(
      player &&
      entity &&
      entity.kind === "unit" &&
      entity.owner === player.owner &&
      state.mode === "playing" &&
      !isLanClient(),
    );
  }

  function requestGameplayPointerLock() {
    if (!canvas.requestPointerLock || document.pointerLockElement === canvas) return;
    try {
      canvas.requestPointerLock();
    } catch (_error) {
      // Pointer lock is optional. Mouse look still works with raw deltas when available.
    }
  }

  function getFirstPersonEyeHeight(unit) {
    if (!unit) return 18;
    if (unit.airborne) return 28 + unit.z * 0.35;
    if (unit.type === "vehicle") return unit.radius * 1.45;
    if (unit.role === "knight" || unit.role === "paladin") return unit.radius * 1.8;
    return unit.radius * 1.55;
  }

  function unitSupportsAim(unit) {
    return Boolean(unit && (unit.projectile || getAttackRange(unit) >= 120));
  }

  function getFirstPersonUnit(player = getActivePlayerState(), suppressCleanup = false) {
    const fp = getFirstPersonState(player);
    if (!fp || !fp.active || !fp.unitId) return null;
    const unit = getEntityById(fp.unitId);
    if (unit && unit.kind === "unit" && unit.owner === player.owner) return unit;
    if (!suppressCleanup) exitFirstPerson(player, { silent: true });
    return null;
  }

  function syncFirstPersonCamera(player, unit) {
    if (!player || !unit) return;
    const fp = getFirstPersonState(player);
    if (!fp || !fp.active) return;
    const forwardX = Math.cos(fp.yaw);
    const forwardY = Math.sin(fp.yaw);
    player.camera.x = clamp(unit.x + forwardX * 18, -CAMERA_LIMIT, CAMERA_LIMIT);
    player.camera.y = clamp(unit.y + forwardY * 18, -CAMERA_LIMIT, CAMERA_LIMIT);
    player.camera.rotation = fp.yaw;
    player.camera.zoom = fp.aiming ? 1.32 : 1.08;
  }

  function updateFirstPersonLook(player, movementX = 0, movementY = 0) {
    const fp = getFirstPersonState(player);
    if (!fp || !fp.active) return;
    const sensitivity = fp.aiming ? 0.0014 : 0.0019;
    fp.yaw += movementX * sensitivity;
    fp.pitch = clamp(fp.pitch - movementY * sensitivity * 0.92, -0.64, 0.36);
    const unit = getFirstPersonUnit(player, true);
    if (unit) syncFirstPersonCamera(player, unit);
  }

  function registerFirstPersonHit(owner, target, damage, projectileType = "bullet") {
    const player = getPlayerState(owner);
    if (!player || !player.firstPerson || !player.firstPerson.active) return;
    const fp = player.firstPerson;
    fp.hitTimer = 0.24;
    fp.hitDamage = Math.max(1, Math.round(damage || 0));
    fp.hitLabel = target ? getSelectionEntityName(target) : "Target";
    fp.hitColor = projectileType === "pulse" ? "#9fe8ff" : projectileType === "rocket" || projectileType === "missile" || projectileType === "shell" ? "#ffcf9a" : "#ffe29a";
  }

  function enterFirstPerson(player, unit) {
    if (!canEnterFirstPerson(unit, player)) return false;
    for (const other of getHumanPlayers()) {
      if (other.owner !== player.owner && isFirstPersonActive(other)) {
        exitFirstPerson(other, { silent: true });
      }
    }
    const fp = getFirstPersonState(player);
    if (!fp.savedCamera) fp.savedCamera = { ...player.camera };
    fp.active = true;
    fp.unitId = unit.id;
    fp.yaw = unit.angle || 0;
    fp.pitch = unit.type === "vehicle" ? -0.03 : unit.airborne ? -0.06 : -0.08;
    fp.aiming = false;
    fp.fireHeld = false;
    fp.kick = 0;
    fp.muzzle = 0;
    fp.targetId = null;
    fp.hitTimer = 0;
    fp.hitDamage = 0;
    fp.hitLabel = "";
    fp.hitColor = "#ffe29a";
    player.input.leftDown = false;
    player.input.rightDown = false;
    player.input.middleDown = false;
    player.input.actionSource = null;
    player.ui.selectionBox = null;
    player.ui.hoveredEnemyIds = [];
    setPlayerOpenPanel(player, null);
    syncFirstPersonCamera(player, unit);
    playUiSound("select", { volume: 0.62, cooldown: 0.05 });
    notify(`Entered first-person view: ${getSelectionEntityName(unit)}.`, "#9fe8ff");
    requestGameplayPointerLock();
    return true;
  }

  function exitFirstPerson(player = getFirstPersonActivePlayer(), options = {}) {
    if (!player) return false;
    const fp = getFirstPersonState(player);
    if (!fp || !fp.active) return false;
    if (options.restoreCamera !== false && fp.savedCamera) {
      player.camera.x = fp.savedCamera.x;
      player.camera.y = fp.savedCamera.y;
      player.camera.zoom = fp.savedCamera.zoom;
      player.camera.rotation = fp.savedCamera.rotation;
    }
    fp.active = false;
    fp.unitId = null;
    fp.aiming = false;
    fp.fireHeld = false;
    fp.kick = 0;
    fp.muzzle = 0;
    fp.targetId = null;
    fp.hitTimer = 0;
    fp.hitDamage = 0;
    fp.hitLabel = "";
    fp.hitColor = "#ffe29a";
    fp.savedCamera = null;
    state.keys.forward = false;
    state.keys.back = false;
    state.keys.left = false;
    state.keys.right = false;
    state.keys.sprint = false;
    player.input.leftDown = false;
    player.input.rightDown = false;
    player.input.middleDown = false;
    player.input.actionSource = null;
    if (document.pointerLockElement === canvas) {
      try {
        document.exitPointerLock();
      } catch (_error) {
        // Ignore pointer lock exit issues.
      }
    }
    if (!options.silent) {
      playUiSound("panelClose", { volume: 0.54, cooldown: 0.05 });
      notify("Returned to command view.", "#ffe29a");
    }
    return true;
  }

  function getHumanOwners() {
    return getHumanPlayers().map((player) => player.owner);
  }

  function isHumanOwner(owner) {
    return Boolean(getPlayerState(owner));
  }

  function getOwnerTeam(owner) {
    if (!owner) return null;
    if (owner === "neutral") return "neutral";
    if (owner === "enemy1" || owner === "enemy2") return isPvEMatch() ? "enemy" : owner;
    if (owner === "player" || /^player\d+$/.test(owner)) return isCoopMatch() ? "allies" : owner;
    return owner;
  }

  function areOwnersAllied(ownerA, ownerB) {
    if (!ownerA || !ownerB) return false;
    return getOwnerTeam(ownerA) === getOwnerTeam(ownerB);
  }

  function getOpponentOwner(owner) {
    if (!isCompetitiveMatch()) return null;
    const aliveOpponents = getHumanOwners().filter((candidate) => candidate !== owner && ownerHasForces(candidate));
    if (aliveOpponents.length) return aliveOpponents[0];
    return getHumanOwners().find((candidate) => candidate !== owner) || null;
  }

  function getOwnerResources(owner) {
    const player = getPlayerState(owner);
    return player ? player.resources : null;
  }

  function getQuickSlots(player = getActivePlayerState()) {
    return player ? player.quickSlots : cloneQuickSlots();
  }

  function getPanelScroll(type, player = getActivePlayerState()) {
    if (!player || !player.ui || !player.ui.panelScroll) return 0;
    return player.ui.panelScroll[type] || 0;
  }

  function setPanelScroll(type, value, player = getActivePlayerState()) {
    if (!player || !player.ui) return;
    if (!player.ui.panelScroll) player.ui.panelScroll = { assets: 0, weapons: 0 };
    player.ui.panelScroll[type] = Math.max(0, value || 0);
  }

  function getViewportForPlayer(player = getActivePlayerState()) {
    if (!player || !isSplitScreenMatch()) return { x: 0, y: 0, w: canvas.width, h: canvas.height };
    const count = getHumanPlayers().length;
    if (count <= 2) {
      const halfWidth = canvas.width / 2;
      return {
        x: player.viewportIndex === 0 ? 0 : halfWidth,
        y: 0,
        w: halfWidth,
        h: canvas.height,
      };
    }
    if (count === 3) {
      const halfWidth = canvas.width / 2;
      const halfHeight = canvas.height / 2;
      if (player.viewportIndex === 0) return { x: 0, y: 0, w: halfWidth, h: halfHeight };
      if (player.viewportIndex === 1) return { x: halfWidth, y: 0, w: halfWidth, h: halfHeight };
      return { x: 0, y: halfHeight, w: canvas.width, h: halfHeight };
    }
    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;
    return {
      x: player.viewportIndex % 2 === 0 ? 0 : halfWidth,
      y: player.viewportIndex < 2 ? 0 : halfHeight,
      w: halfWidth,
      h: halfHeight,
    };
  }

  function setActivePlayerContext(player, viewport = getViewportForPlayer(player)) {
    const target = player || getPrimaryPlayer();
    if (!target) return;
    state.activeOwner = target.owner;
    state.activeViewport = viewport;
    state.camera = target.camera;
    state.input = target.input;
    state.ui = target.ui;
    state.selectedIds = target.selectedIds;
    state.coins = target.resources.coins;
    state.wood = target.resources.wood;
    state.stone = target.resources.stone;
  }

  function getLocalPlayerConfigs(matchType, playerCount = 2) {
    const count = clamp(Math.round(playerCount || 2), 2, 4);
    return matchType === "coop" ? localCoopConfigs[count] || localCoopConfigs[2] : localVersusConfigs[count] || localVersusConfigs[2];
  }

  function initializePlayers(matchType, playerCount = 2) {
    state.matchType = matchType;
    state.players = {};
    if (matchType === "versus" || matchType === "lan") {
      const configs = matchType === "lan" ? localVersusConfigs[2] : getLocalPlayerConfigs("versus", playerCount);
      configs.forEach((config) => {
        state.players[config.owner] = createPlayerState(
          config.owner,
          config.label,
          config.viewportIndex,
          config.camera,
          config.controllerLabel,
          { startBase: config.startBase, startFacing: config.startFacing },
        );
      });
      if (matchType === "lan" && !state.lan.localOwner) state.lan.localOwner = "player1";
    } else if (matchType === "coop" || matchType === "lan-coop") {
      const configs = matchType === "lan-coop" ? localCoopConfigs[2] : getLocalPlayerConfigs("coop", playerCount);
      configs.forEach((config) => {
        state.players[config.owner] = createPlayerState(
          config.owner,
          config.label,
          config.viewportIndex,
          config.camera,
          config.controllerLabel,
          { startBase: config.startBase, startFacing: config.startFacing },
        );
      });
      if (matchType === "lan-coop" && !state.lan.localOwner) state.lan.localOwner = "player1";
    } else {
      state.players.player = createPlayerState("player", "Commander", 0, { x: -1150, y: 980, zoom: 0.82, rotation: -0.28 }, "Controller 1");
      state.lan.localOwner = null;
    }
    setActivePlayerContext(getPrimaryPlayer());
  }

  function createId(prefix) {
    state.ids += 1;
    return `${prefix}-${state.ids}`;
  }

  function rand(seed) {
    const x = Math.sin(seed * 9283.147 + 21.17) * 43758.5453;
    return x - Math.floor(x);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function withAlpha(color, alpha) {
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
    return color;
  }

  function worldToFogTexture(x, y) {
    return {
      x: ((x + HALF_WORLD) / WORLD_SIZE) * FOG_TEXTURE_SIZE,
      y: ((y + HALF_WORLD) / WORLD_SIZE) * FOG_TEXTURE_SIZE,
    };
  }

  function getFogCellCoordinates(x, y) {
    return {
      gx: clamp(Math.floor((x + HALF_WORLD) / FOG_CELL_SIZE), 0, FOG_GRID_COUNT - 1),
      gy: clamp(Math.floor((y + HALF_WORLD) / FOG_CELL_SIZE), 0, FOG_GRID_COUNT - 1),
    };
  }

  function isPointExploredForPlayer(player, x, y) {
    if (!player || !player.fog) return true;
    const { gx, gy } = getFogCellCoordinates(x, y);
    return player.fog.explored[gy * FOG_GRID_COUNT + gx] === 1;
  }

  function getPlayerFogCoverage(player) {
    if (!player || !player.fog) return 100;
    return (player.fog.exploredCount / (FOG_GRID_COUNT * FOG_GRID_COUNT)) * 100;
  }

  function resetFogOfWar(player) {
    if (!player || !player.fog) return;
    const fog = player.fog;
    fog.explored.fill(0);
    fog.exploredCount = 0;
    fog.maskCtx.clearRect(0, 0, FOG_TEXTURE_SIZE, FOG_TEXTURE_SIZE);
    fog.maskCtx.fillStyle = "rgba(5, 8, 13, 0.92)";
    fog.maskCtx.fillRect(0, 0, FOG_TEXTURE_SIZE, FOG_TEXTURE_SIZE);
  }

  function getVisionRadius(entity) {
    if (!entity) return 0;
    if (entity.kind === "building") {
      if (entity.itemId === "observatory") return 580;
      if (entity.itemId === "signal_beacon") return 520;
      if (entity.itemId === "radar_hub") return 620;
      if (entity.itemId === "missile_silo") return 440;
      if (entity.itemId === "outpost") return 460;
      if (entity.itemId === "royal_keep") return 420;
      if (entity.itemId === "citadel") return 470;
      if (entity.def && (entity.def.style === "tower" || entity.def.style === "radar")) return 360;
      if (entity.itemId === "market" || entity.itemId === "command_hall") return 320;
      return 250;
    }
    if (entity.kind === "unit") {
      if (entity.airborne) return 420;
      if (entity.role === "scout") return 360;
      if (entity.role === "captain") return 290;
      if (entity.role === "archer" || entity.role === "marine") return 250;
      if (entity.role === "engineer" || entity.role === "villager") return 210;
      if (entity.type === "vehicle") return 270;
      return 220;
    }
    return 0;
  }

  function revealFogCircle(player, x, y, radius) {
    if (!player || !player.fog || radius <= 0) return;
    const fog = player.fog;
    const effectiveRadius = radius * 1.14;
    let discoveredNewCell = false;
    const minGX = clamp(Math.floor((x - effectiveRadius + HALF_WORLD) / FOG_CELL_SIZE), 0, FOG_GRID_COUNT - 1);
    const maxGX = clamp(Math.floor((x + effectiveRadius + HALF_WORLD) / FOG_CELL_SIZE), 0, FOG_GRID_COUNT - 1);
    const minGY = clamp(Math.floor((y - effectiveRadius + HALF_WORLD) / FOG_CELL_SIZE), 0, FOG_GRID_COUNT - 1);
    const maxGY = clamp(Math.floor((y + effectiveRadius + HALF_WORLD) / FOG_CELL_SIZE), 0, FOG_GRID_COUNT - 1);
    for (let gy = minGY; gy <= maxGY; gy += 1) {
      for (let gx = minGX; gx <= maxGX; gx += 1) {
        const cx = gx * FOG_CELL_SIZE - HALF_WORLD + FOG_CELL_SIZE * 0.5;
        const cy = gy * FOG_CELL_SIZE - HALF_WORLD + FOG_CELL_SIZE * 0.5;
        if (Math.hypot(cx - x, cy - y) > effectiveRadius + FOG_CELL_SIZE * 0.85) continue;
        const index = gy * FOG_GRID_COUNT + gx;
        if (fog.explored[index]) continue;
        fog.explored[index] = 1;
        fog.exploredCount += 1;
        discoveredNewCell = true;
      }
    }
    if (!discoveredNewCell) return;
    const point = worldToFogTexture(x, y);
    const fogRadius = (effectiveRadius / WORLD_SIZE) * FOG_TEXTURE_SIZE;
    fog.maskCtx.save();
    fog.maskCtx.globalCompositeOperation = "destination-out";
    const grad = fog.maskCtx.createRadialGradient(point.x, point.y, fogRadius * 0.16, point.x, point.y, fogRadius);
    grad.addColorStop(0, "rgba(255,255,255,0.98)");
    grad.addColorStop(0.42, "rgba(255,255,255,0.94)");
    grad.addColorStop(0.78, "rgba(255,255,255,0.56)");
    grad.addColorStop(1, "rgba(255,255,255,0.02)");
    fog.maskCtx.fillStyle = grad;
    fog.maskCtx.beginPath();
    fog.maskCtx.arc(point.x, point.y, fogRadius, 0, TAU);
    fog.maskCtx.fill();
    fog.maskCtx.restore();
  }

  function updateFogOfWar() {
    for (const player of getHumanPlayers()) {
      for (const building of state.world.buildings) {
        if (!building.owner || building.owner === "neutral" || !areOwnersAllied(building.owner, player.owner)) continue;
        revealFogCircle(player, building.x, building.y, getVisionRadius(building));
      }
      for (const unit of state.world.units) {
        if (!unit.owner || !areOwnersAllied(unit.owner, player.owner)) continue;
        revealFogCircle(player, unit.x, unit.y, getVisionRadius(unit));
      }
    }
  }

  function getAssetSpriteSize(building, size) {
    if (building.def.style === "wall" || building.def.style === "capital-wall") return { w: size * 1.72, h: size * 0.9 };
    if (building.def.style === "bridge" || building.def.style === "dock") return { w: size * 1.84, h: size * 0.88 };
    if (building.def.style === "tower" || building.def.style === "radar") return { w: size * 1.06, h: size * 1.48 };
    if (building.def.style === "keep" || building.def.style === "academy" || building.def.style === "command") return { w: size * 1.42, h: size * 1.42 };
    return { w: size * 1.36, h: size * 1.36 };
  }

  function getUnitSpriteKey(unit) {
    if (unit.kind === "animal") return unit.species;
    if (unit.kind === "civilian") return "civilian";
    return unit.role || null;
  }

  function getItemSpriteRef(item) {
    if (!item) return null;
    if (assetCatalog.includes(item)) return { group: "assets", key: item.id };
    return { group: "units", key: item.role };
  }

  function drawSpriteFromGroup(group, key, x, y, width, height, rotation = 0, alpha = 1, variantSeed = 0) {
    const entry = getSpriteEntry(group, key, variantSeed);
    if (!entry || !isImageReady(entry.image)) return false;
    const scale = entry.scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(entry.image, -(width * scale) / 2, -(height * scale) / 2, width * scale, height * scale);
    ctx.restore();
    return true;
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function getAttackDamage(unit) {
    return unit.damage + (unit.damageBonus || 0);
  }

  function getAttackRange(unit) {
    return unit.range + (unit.rangeBonus || 0);
  }

  function getFirstPersonRay(unit, player = getPlayerState(unit && unit.owner), maxDistance = null) {
    const fp = getFirstPersonState(player);
    if (!unit || !fp) return null;
    const forwardX = Math.cos(fp.yaw);
    const forwardY = Math.sin(fp.yaw);
    const eyeHeight = getFirstPersonEyeHeight(unit);
    const baseDistance = maxDistance == null
      ? Math.max(160, Math.min(920, getAttackRange(unit) + (unit.projectile ? 180 : 80)))
      : maxDistance;
    let distance = baseDistance;
    if (fp.pitch < -0.06) {
      const downwardDistance = eyeHeight / Math.max(0.12, -Math.tan(fp.pitch)) * 4.2;
      distance = Math.min(distance, downwardDistance);
    }
    distance = clamp(distance, 48, 940);
    return {
      eyeHeight,
      forwardX,
      forwardY,
      distance,
      point: {
        x: unit.x + forwardX * distance,
        y: unit.y + forwardY * distance,
      },
    };
  }

  function getFirstPersonAimData(unit, player = getPlayerState(unit && unit.owner)) {
    const ray = getFirstPersonRay(unit, player);
    if (!ray) return null;
    const fp = getFirstPersonState(player);
    const candidates = [...state.world.units, ...state.world.buildings, ...state.world.animals];
    let best = null;
    for (const entity of candidates) {
      if (entity.id === unit.id) continue;
      if (entity.kind !== "animal") {
        if (!entity.owner || areOwnersAllied(entity.owner, unit.owner)) continue;
      }
      const dx = entity.x - unit.x;
      const dy = entity.y - unit.y;
      const along = dx * ray.forwardX + dy * ray.forwardY;
      if (along <= 0 || along > ray.distance) continue;
      const lateral = Math.abs(dx * -ray.forwardY + dy * ray.forwardX);
      const tolerance = (entity.radius || 12) + lerp(fp.aiming ? 5 : 10, fp.aiming ? 16 : 28, clamp(along / ray.distance, 0, 1));
      if (lateral > tolerance) continue;
      const score = along + lateral * 2.4;
      if (!best || score < best.score) {
        best = {
          entity,
          score,
          distance: along,
        };
      }
    }
    return {
      target: best ? best.entity : null,
      point: best
        ? { x: best.entity.x, y: best.entity.y }
        : ray.point,
      distance: best ? best.distance : ray.distance,
      forwardX: ray.forwardX,
      forwardY: ray.forwardY,
      eyeHeight: ray.eyeHeight,
    };
  }

  function getFirstPersonProjectileSpeed(projectileType) {
    if (projectileType === "arrow") return 420;
    if (projectileType === "bolt") return 460;
    if (projectileType === "shell") return 360;
    if (projectileType === "mortar" || projectileType === "boulder") return 270;
    if (projectileType === "rocket") return 290;
    if (projectileType === "missile") return 310;
    if (projectileType === "pulse") return 500;
    return 540;
  }

  function fireFirstPersonWeapon(unit, player = getPlayerState(unit && unit.owner)) {
    if (!unit || !player) return false;
    const fp = getFirstPersonState(player);
    if (!fp || !fp.active) return false;
    const aim = getFirstPersonAimData(unit, player);
    if (!aim) return false;
    const damage = getAttackDamage(unit);
    unit.angle = fp.yaw;
    unit.lastCombatTimer = Math.max(unit.lastCombatTimer || 0, 2.4);
    fp.kick = 1;
    fp.targetId = aim.target ? aim.target.id : null;

    if (unit.projectile || getAttackRange(unit) >= 120) {
      const projectileType = unit.projectile || "bullet";
      const isBowShot = projectileType === "arrow" || projectileType === "bolt";
      unit.attackCooldown = unit.cooldown || 0.8;
      fp.muzzle = isBowShot ? 0.04 : 0.08;
      spawnProjectile(unit, aim.target || aim.point, projectileType, damage, unit.splash || 0, getFirstPersonProjectileSpeed(projectileType));
      spawnEffect("muzzle", unit.x + aim.forwardX * unit.radius, unit.y + aim.forwardY * unit.radius, unit.radius * 0.95, isBowShot ? "#efe3bc" : "#ffd6a7", isBowShot ? 0.1 : 0.18);
      return true;
    }

    fp.muzzle = 0.04;
    if (aim.target && aim.distance <= getAttackRange(unit) + (aim.target.radius || 12) + 10) {
      unit.attackCooldown = unit.cooldown || 0.8;
      const dealt = applyDamage(aim.target, damage, "melee", unit.owner);
      applyImpactKick(aim.target, aim.forwardX, aim.forwardY, 78);
      registerFirstPersonHit(unit.owner, aim.target, dealt, "melee");
      spawnEffect("slash", aim.target.x, aim.target.y, aim.target.radius || unit.radius, ownerColors[unit.owner] || "#ffffff", 0.2);
      playWorldSound("meleeHit", aim.target.x, aim.target.y, { cooldown: 0.06, volume: 0.72 });
      return true;
    }

    unit.attackCooldown = Math.min(unit.cooldown || 0.8, 0.16);
    return false;
  }

  function updateFirstPersonUnit(unit, dt, terrainMove) {
    const player = getPlayerState(unit.owner);
    const fp = getFirstPersonState(player);
    if (!player || !fp || !fp.active || fp.unitId !== unit.id) return false;

    fp.kick = Math.max(0, fp.kick - dt * 7.5);
    fp.muzzle = Math.max(0, fp.muzzle - dt);
    fp.hitTimer = Math.max(0, fp.hitTimer - dt);
    unit.selected = player.selectedIds.has(unit.id);
    unit.targetId = null;
    unit.moveTarget = null;
    unit.focusMove = false;
    clearInteractionOrder(unit);

    const forward = (state.keys.forward ? 1 : 0) - (state.keys.back ? 1 : 0);
    const strafe = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
    if (forward || strafe) {
      const yaw = fp.yaw;
      const wishX = Math.cos(yaw) * forward + Math.cos(yaw + Math.PI / 2) * strafe;
      const wishY = Math.sin(yaw) * forward + Math.sin(yaw + Math.PI / 2) * strafe;
      const n = normalize(wishX, wishY);
      const sprintMultiplier = state.keys.sprint && !fp.aiming ? (unit.type === "vehicle" ? 1.18 : 1.42) : 1;
      const aimingMultiplier = fp.aiming ? 0.58 : 1;
      const desiredSpeed = unit.speed * terrainMove * (unit.empTimer > 0 ? 0.55 : 1) * sprintMultiplier * aimingMultiplier;
      unit.vx += n.x * desiredSpeed * dt * 4.8;
      unit.vy += n.y * desiredSpeed * dt * 4.8;
      unit.order = state.keys.sprint && !fp.aiming ? "sprint" : "move";
    } else {
      unit.order = fp.fireHeld ? "attack" : "idle";
    }

    unit.angle = fp.yaw;
    if (fp.fireHeld && unit.attackCooldown <= 0) {
      if (fireFirstPersonWeapon(unit, player)) unit.order = "attack";
    } else if (!fp.fireHeld) {
      fp.targetId = null;
    }

    for (const other of state.world.units) {
      if (other.id === unit.id) continue;
      const dx = unit.x - other.x;
      const dy = unit.y - other.y;
      const d = Math.hypot(dx, dy);
      const minDist = unit.radius + other.radius + 4;
      if (d > 0 && d < minDist) {
        const push = (minDist - d) / minDist;
        unit.vx += (dx / d) * push * 38 * dt;
        unit.vy += (dy / d) * push * 38 * dt;
      }
    }

    for (const building of state.world.buildings) {
      const dx = unit.x - building.x;
      const dy = unit.y - building.y;
      const d = Math.hypot(dx, dy);
      const minDist = unit.radius + building.radius + (building.def.style === "wall" || building.def.style === "capital-wall" || building.def.style === "gate" ? 10 : 2);
      if (d > 0 && d < minDist && !(unit.hover || unit.airborne)) {
        unit.vx += (dx / d) * (minDist - d) * 2.8;
        unit.vy += (dy / d) * (minDist - d) * 2.8;
      }
    }

    const sprintCap = state.keys.sprint && !fp.aiming ? (unit.type === "vehicle" ? 1.18 : 1.32) : 1;
    const maxSpeed = unit.speed * terrainMove * (unit.airborne ? 1.1 : 1) * sprintCap;
    const velocity = Math.hypot(unit.vx, unit.vy);
    if (velocity > maxSpeed) {
      unit.vx = (unit.vx / velocity) * maxSpeed;
      unit.vy = (unit.vy / velocity) * maxSpeed;
    }
    unit.x = clamp(unit.x + unit.vx * dt, -HALF_WORLD + 60, HALF_WORLD - 60);
    unit.y = clamp(unit.y + unit.vy * dt, -HALF_WORLD + 60, HALF_WORLD - 60);
    for (const tree of state.world.trees) pushUnitFromCircle(unit, tree, 8);
    for (const rock of state.world.rocks) pushUnitFromCircle(unit, rock, 7);
    for (const building of state.world.buildings) {
      const padding = building.def.style === "wall" || building.def.style === "capital-wall" || building.def.style === "gate" ? 12 : 4;
      pushUnitFromCircle(unit, building, padding);
    }
    unit.vx *= fp.aiming ? 0.82 : 0.88;
    unit.vy *= fp.aiming ? 0.82 : 0.88;
    syncFirstPersonCamera(player, unit);
    player.ui.hoveredEnemyIds = fp.targetId ? [fp.targetId] : [];
    player.ui.selectionBox = null;
    return true;
  }

  function isEasyModeActive() {
    return isPvEMatch() && state.difficulty.mode === "easy";
  }

  function isHardModeActive() {
    return isPvEMatch() && state.difficulty.mode === "hard";
  }

  function getDifficultyCampAnchors() {
    if (state.matchType === "single") {
      return [
        { owner: "enemy1", x: 320, y: -520, camp: ["outpost", "army_house", "watch_tower"], units: ["warrior", "archer", "warrior"] },
        { owner: "enemy2", x: 520, y: 660, camp: ["outpost", "archer_house", "stone_tower"], units: ["archer", "knight", "warrior"] },
      ];
    }
    return [
      { owner: "enemy1", x: 240, y: -860, camp: ["outpost", "army_house", "watch_tower"], units: ["warrior", "archer", "knight", "captain"] },
      { owner: "enemy2", x: 420, y: 860, camp: ["outpost", "archer_house", "stone_tower"], units: ["archer", "warrior", "knight", "engineer"] },
      { owner: "enemy2", x: 760, y: 140, camp: ["outpost", "stable"], units: ["knight", "warrior", "archer"] },
    ];
  }

  function applyHardDifficultyPressure() {
    if (!isPvEMatch() || state.difficulty.hardPressureApplied) return;
    state.difficulty.hardPressureApplied = true;
    for (const anchor of getDifficultyCampAnchors()) {
      const campExists = state.world.buildings.some((building) => building.owner === anchor.owner && Math.hypot(building.x - anchor.x, building.y - anchor.y) < 220);
      if (campExists) continue;
      anchor.camp.forEach((itemId, index) => {
        const angle = (index / anchor.camp.length) * TAU;
        const building = spawnBuilding(anchor.owner, itemId, anchor.x + Math.cos(angle) * 86, anchor.y + Math.sin(angle) * 78, angle);
        if (building) building.hardCamp = true;
      });
      anchor.units.forEach((role, index) => {
        const angle = (index / anchor.units.length) * TAU + 0.3;
        const item = weaponCatalog.find((entry) => entry.role === role);
        const unit = item
          ? spawnWeaponUnit(anchor.owner, item, anchor.x + Math.cos(angle) * 132, anchor.y + Math.sin(angle) * 124)
          : spawnUnit(anchor.owner, role, anchor.x + Math.cos(angle) * 132, anchor.y + Math.sin(angle) * 124);
        if (unit) {
          const enemyBase = getNearestHostileBase(anchor.owner, unit.x, unit.y);
          if (enemyBase) {
            unit.moveTarget = { x: enemyBase.x + randomRange(unit.x + index, -120, 120), y: enemyBase.y + randomRange(unit.y + index, -120, 120) };
            unit.order = "move";
            unit.focusMove = true;
          }
        }
      });
    }
    if (state.matchType === "single") {
      state.waves.cooldown = Math.max(11, state.waves.cooldown * 0.78);
      state.waves.timer = Math.min(state.waves.timer, state.waves.cooldown);
    }
    notify("Hard mode established extra enemy camps.", "#ff8e85");
  }

  function getEnemyAiHome(owner) {
    return findNearest(state.world.buildings, 0, 0, (building) => building.owner === owner && building.itemId === "royal_keep") ||
      findNearest(state.world.buildings, 0, 0, (building) => building.owner === owner) ||
      null;
  }

  function getNearestHostileBase(owner, x, y) {
    return findNearest(state.world.buildings, x, y, (building) => isHumanOwner(building.owner) && !areOwnersAllied(owner, building.owner));
  }

  function shouldEnemyStandDown(entity) {
    return isPvEMatch() && !isHumanOwner(entity.owner) && entity.owner !== "neutral" && isCeasefireActive();
  }

  function isEnemyTarget(entity, viewerOwner = getActivePlayerState() && getActivePlayerState().owner) {
    return entity && entity.owner && viewerOwner && entity.owner !== "neutral" && !areOwnersAllied(entity.owner, viewerOwner);
  }

  function getHoveredEnemyTargets(worldX, worldY, maxCount = 4) {
    if (!state.selectedIds.size || getActivePlacement()) return [];
    const hoverRadius = 140 / state.camera.zoom + 36;
    return [...state.world.units, ...state.world.buildings]
      .filter((entity) => isEnemyTarget(entity) && Math.hypot(entity.x - worldX, entity.y - worldY) <= hoverRadius + entity.radius)
      .sort((a, b) => Math.hypot(a.x - worldX, a.y - worldY) - Math.hypot(b.x - worldX, b.y - worldY))
      .slice(0, maxCount)
      .map((entity) => entity.id);
  }

  function normalize(dx, dy) {
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, d };
  }

  function angleLerp(a, b, t) {
    let diff = ((b - a + Math.PI) % TAU) - Math.PI;
    if (diff < -Math.PI) diff += TAU;
    return a + diff * t;
  }

  function randomRange(seed, min, max) {
    return lerp(min, max, rand(seed));
  }

  function worldToTileCoord(x, y) {
    const gx = clamp(Math.floor((x + HALF_WORLD) / TILE_SIZE), 0, GRID_COUNT - 1);
    const gy = clamp(Math.floor((y + HALF_WORLD) / TILE_SIZE), 0, GRID_COUNT - 1);
    return { gx, gy };
  }

  function getTileAtWorld(x, y) {
    const { gx, gy } = worldToTileCoord(x, y);
    return state.world.tiles[gy * GRID_COUNT + gx] || null;
  }

  function getTileByGrid(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GRID_COUNT || gy >= GRID_COUNT) return null;
    return state.world.tiles[gy * GRID_COUNT + gx] || null;
  }

  function getTerrainAtWorld(x, y) {
    const tile = getTileAtWorld(x, y);
    return terrainEffects[(tile && tile.biome) || "meadow"] || terrainEffects.meadow;
  }

  function paintTileEdgeGradient(targetCtx, x, y, size, side, startColor, endColor = "rgba(0,0,0,0)", thickness = size * 0.18) {
    let grad = null;
    if (side === "north") grad = targetCtx.createLinearGradient(x, y, x, y + thickness);
    else if (side === "south") grad = targetCtx.createLinearGradient(x, y + size, x, y + size - thickness);
    else if (side === "west") grad = targetCtx.createLinearGradient(x, y, x + thickness, y);
    else if (side === "east") grad = targetCtx.createLinearGradient(x + size, y, x + size - thickness, y);
    if (!grad) return;
    grad.addColorStop(0, startColor);
    grad.addColorStop(1, endColor);
    targetCtx.fillStyle = grad;
    if (side === "north") targetCtx.fillRect(x, y, size, thickness);
    else if (side === "south") targetCtx.fillRect(x, y + size - thickness, size, thickness);
    else if (side === "west") targetCtx.fillRect(x, y, thickness, size);
    else if (side === "east") targetCtx.fillRect(x + size - thickness, y, thickness, size);
  }

  function getEnvironmentMood(biome = ((getTileAtWorld(state.camera.x, state.camera.y) || {}).biome || "meadow")) {
    switch (biome) {
      case "ocean":
        return {
          skyTop: "#05111b",
          skyMid: "#0b2d45",
          skyBottom: "#081118",
          sunCore: "rgba(229,244,255,0.48)",
          sunGlow: "rgba(129,204,255,0.24)",
          skyGlow: "rgba(114,207,255,0.2)",
          ember: "rgba(164,220,255,0.08)",
          horizon: "rgba(205,237,255,0.1)",
          groundWash: "rgba(134,211,255,0.16)",
          groundShade: "rgba(7,22,34,0.14)",
          water: "rgba(233,247,255,0.32)",
          heat: "rgba(134,211,255,0.08)",
        };
      case "desert":
        return {
          skyTop: "#09131b",
          skyMid: "#624220",
          skyBottom: "#171515",
          sunCore: "rgba(255,243,214,0.58)",
          sunGlow: "rgba(255,188,112,0.28)",
          skyGlow: "rgba(255,204,138,0.18)",
          ember: "rgba(255,180,108,0.12)",
          horizon: "rgba(255,226,166,0.08)",
          groundWash: "rgba(255,215,150,0.18)",
          groundShade: "rgba(74,39,16,0.14)",
          water: "rgba(255,245,220,0.2)",
          heat: "rgba(255,211,142,0.16)",
        };
      case "canyon":
        return {
          skyTop: "#08131d",
          skyMid: "#4b281d",
          skyBottom: "#140f12",
          sunCore: "rgba(255,232,206,0.52)",
          sunGlow: "rgba(255,156,105,0.24)",
          skyGlow: "rgba(222,124,86,0.18)",
          ember: "rgba(255,151,112,0.12)",
          horizon: "rgba(255,204,178,0.07)",
          groundWash: "rgba(229,150,108,0.14)",
          groundShade: "rgba(58,24,16,0.16)",
          water: "rgba(255,215,192,0.14)",
          heat: "rgba(255,175,134,0.14)",
        };
      case "deadlands":
        return {
          skyTop: "#081018",
          skyMid: "#2c1f2d",
          skyBottom: "#100d12",
          sunCore: "rgba(240,220,255,0.42)",
          sunGlow: "rgba(170,120,181,0.18)",
          skyGlow: "rgba(144,96,150,0.16)",
          ember: "rgba(171,118,160,0.08)",
          horizon: "rgba(223,188,228,0.06)",
          groundWash: "rgba(176,122,166,0.1)",
          groundShade: "rgba(28,14,24,0.18)",
          water: "rgba(220,194,240,0.12)",
          heat: "rgba(190,142,172,0.12)",
        };
      case "river":
      case "marsh":
        return {
          skyTop: "#06151c",
          skyMid: "#10313d",
          skyBottom: "#0b1116",
          sunCore: "rgba(220,247,255,0.44)",
          sunGlow: "rgba(112,196,255,0.22)",
          skyGlow: biome === "river" ? "rgba(114,207,255,0.2)" : "rgba(126,182,142,0.18)",
          ember: biome === "river" ? "rgba(115,179,235,0.08)" : "rgba(138,171,120,0.08)",
          horizon: "rgba(196,239,255,0.07)",
          groundWash: biome === "river" ? "rgba(132,211,255,0.14)" : "rgba(157,193,136,0.12)",
          groundShade: biome === "river" ? "rgba(9,28,42,0.14)" : "rgba(18,30,20,0.14)",
          water: biome === "river" ? "rgba(226,249,255,0.28)" : "rgba(213,240,207,0.18)",
          heat: "rgba(175,214,202,0.08)",
        };
      case "forest":
        return {
          skyTop: "#07141a",
          skyMid: "#173223",
          skyBottom: "#0b1013",
          sunCore: "rgba(228,246,223,0.42)",
          sunGlow: "rgba(140,203,132,0.16)",
          skyGlow: "rgba(96,156,104,0.16)",
          ember: "rgba(132,176,102,0.08)",
          horizon: "rgba(204,233,185,0.05)",
          groundWash: "rgba(150,202,132,0.1)",
          groundShade: "rgba(12,26,16,0.16)",
          water: "rgba(220,244,214,0.14)",
          heat: "rgba(173,208,140,0.08)",
        };
      default:
        return {
          skyTop: "#07141c",
          skyMid: "#102733",
          skyBottom: "#091118",
          sunCore: "rgba(228,243,255,0.42)",
          sunGlow: "rgba(112,196,255,0.2)",
          skyGlow: "rgba(112,196,255,0.2)",
          ember: "rgba(255,185,120,0.08)",
          horizon: "rgba(214,237,255,0.06)",
          groundWash: "rgba(255,238,194,0.14)",
          groundShade: "rgba(8,18,24,0.12)",
          water: "rgba(225,246,255,0.22)",
          heat: "rgba(255,216,152,0.08)",
        };
    }
  }

  function getTerrainMoveMultiplier(unit) {
    const terrain = getTerrainAtWorld(unit.x, unit.y);
    if (unit.airborne || unit.hover) return 1;
    if (unit.type === "vehicle") return terrain.vehicleMove || terrain.move || 1;
    return terrain.move || 1;
  }

  function getTerrainStructureMultiplier(building) {
    const terrain = getTerrainAtWorld(building.x, building.y);
    return terrain.structure || 1;
  }

  function getTerrainAttackRangeBonus(entity) {
    const terrain = getTerrainAtWorld(entity.x, entity.y);
    if (entity.kind === "building" && (entity.def.style === "tower" || entity.def.style === "radar")) {
      return terrain.towerRange || 1;
    }
    if (entity.kind === "unit" && entity.projectile && terrain.label === "Hill") return 1.05;
    return 1;
  }

  function getTerrainAttrition(entity, dt) {
    const terrain = getTerrainAtWorld(entity.x, entity.y);
    const rules = terrain.attrition;
    if (!rules) return 0;
    if (entity.airborne || entity.hover) return 0;
    if (entity.armor === "flesh") return (rules.flesh || 0) * dt;
    if (entity.armor === "wood") return (rules.wood || 0) * dt;
    if (entity.armor === "stone") return (rules.stone || 0) * dt;
    if (entity.armor === "steel" || entity.armor === "plate") return (rules.steel || 0) * dt;
    return 0;
  }

  function sampleTerrainUnderFootprint(x, y, radius) {
    const offsets = [
      [0, 0],
      [-radius * 0.45, 0],
      [radius * 0.45, 0],
      [0, -radius * 0.45],
      [0, radius * 0.45],
      [-radius * 0.3, -radius * 0.3],
      [radius * 0.3, -radius * 0.3],
      [-radius * 0.3, radius * 0.3],
      [radius * 0.3, radius * 0.3],
    ];
    return offsets.map(([ox, oy]) => getTerrainAtWorld(x + ox, y + oy));
  }

  function isStructureAllowedOnTerrain(item, terrain) {
    if (!terrain.blocked) return true;
    if (terrain.allow && terrain.allow.has(item.style)) return true;
    return false;
  }

  function getArmorModifier(armor, projectileType) {
    const lookup = {
      flesh: { arrow: 1, bullet: 1, shell: 1.25, rocket: 1.35, pulse: 1.1, melee: 1, boulder: 1.2 },
      wood: { arrow: 0.85, bullet: 1.05, shell: 1.3, rocket: 1.4, pulse: 0.9, melee: 1.1, boulder: 1.25 },
      stone: { arrow: 0.3, bullet: 0.5, shell: 1.15, rocket: 1.22, pulse: 0.65, melee: 0.45, boulder: 1.2 },
      steel: { arrow: 0.16, bullet: 0.42, shell: 1, rocket: 1.18, pulse: 1.08, melee: 0.3, boulder: 0.84 },
      plate: { arrow: 0.4, bullet: 0.58, shell: 1.06, rocket: 1.12, pulse: 0.86, melee: 0.78, boulder: 0.98 },
    };
    const table = lookup[armor] || lookup.flesh;
    return table[projectileType] ?? 1;
  }

  function notify(text, tint = "#d6ae63") {
    state.world.notifications.push({ id: createId("note"), text, tint, ttl: 4.5, owner: null });
    for (const player of getHumanPlayers()) player.ui.recentMessage = text;
  }

  function addQuest(def) {
    state.world.quests.push({
      id: createId("quest"),
      title: def.title,
      desc: def.desc,
      target: def.target,
      reward: def.reward,
      kind: def.kind,
      progress: 0,
      done: false,
    });
  }

  function incrementQuest(kind, amount = 1) {
    if (state.matchType !== "single") return;
    for (const quest of state.world.quests) {
      if (quest.done || quest.kind !== kind) continue;
      quest.progress = Math.min(quest.target, quest.progress + amount);
      if (quest.progress >= quest.target) {
        quest.done = true;
        const primary = getPrimaryPlayer();
        if (primary) primary.resources.coins += quest.reward;
        notify(`Quest complete: ${quest.title} (+${quest.reward} coins)`, "#7df2ab");
        playUiSound("quest", { volume: 0.9, cooldown: 0.18 });
      }
    }
  }

  function spawnBuilding(owner, itemId, x, y, angle = 0, options = {}) {
    const def = itemIndex.get(itemId);
    if (!def) return null;
    const size = TILE_SIZE * def.footprint;
    const neutralReserve = owner === "neutral" && neutralEconomyBuildingIds.has(itemId);
    const maxTaxReserve = neutralReserve
      ? itemId === "market"
        ? 54
        : itemId === "village_house"
          ? 42
          : itemId === "granary"
            ? 40
            : 34
      : 0;
    const building = {
      id: createId("building"),
      kind: "building",
      owner,
      x,
      y,
      size,
      itemId,
      def,
      angle,
      manualPlacement: Boolean(options.manualPlacement),
      placementIndex: state.ids,
      spriteVariantSeed: Number.isFinite(options.spriteVariantSeed) ? options.spriteVariantSeed : state.ids,
      hp: def.hp,
      maxHp: def.hp,
      armor: def.armor || "wood",
      radius: size * 0.45,
      lastCombatTimer: 0,
      attackCooldown: randomRange(x + y, 0.1, 0.8),
      spawnCooldown: def.spawnRate ? randomRange(x * 0.1 + y * 0.3, 3, def.spawnRate) : 0,
      gatherCooldown: def.gather ? 6 : 0,
      taxReserve: neutralReserve ? randomRange(x + y, maxTaxReserve * 0.45, maxTaxReserve * 0.8) : 0,
      maxTaxReserve,
      taxBatch: neutralReserve ? (itemId === "market" ? 15 : itemId === "village_house" ? 11 : 9) : 0,
      lastTaxedTimer: 0,
    };
    state.world.buildings.push(building);
    return building;
  }

  function spawnUnit(owner, role, x, y, extras = {}) {
    const def = roleTemplates[role] || weaponCatalog.find((item) => item.role === role);
    const base = def || roleTemplates.warrior;
    const unit = {
      id: createId("unit"),
      kind: "unit",
      owner,
      role,
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      angle: randomRange(x + y, -Math.PI, Math.PI),
      radius: base.radius || 12,
      hp: base.hp,
      maxHp: base.hp,
      armor: base.armor || "flesh",
      damage: base.damage,
      range: base.range,
      speed: base.speed,
      cooldown: base.cooldown,
      attackCooldown: randomRange(x * y + 3, 0, base.cooldown || 1),
      projectile: base.projectile || null,
      splash: base.splash || 0,
      targetId: null,
      moveTarget: null,
      interactTargetId: null,
      interactKind: null,
      interactCooldown: 0,
      order: "idle",
      selected: false,
      type: base.type || "infantry",
      healAmount: healerRoles.has(role) ? (role === "repair" ? 12 : 7) : 0,
      aiTimer: randomRange(x - y, 0.2, 1.5),
      airborne: airborneRoles.has(role),
      hover: hoverRoles.has(role),
      value: extras.value || 0,
      lastHitTimer: 0,
      lastCombatTimer: 0,
      empTimer: 0,
      damageBonus: 0,
      rangeBonus: 0,
      pickupWeapon: null,
      focusMove: false,
      orderStamp: 0,
    };
    if (role === "repair") {
      unit.damage = 0;
      unit.range = 110;
      unit.healAmount = 12;
    }
    if (role === "medic") {
      unit.range = Math.max(unit.range, 130);
      unit.healAmount = 7;
    }
    if (role === "copter" || role === "gunship") unit.z = 26;
    if (role === "drone" || role === "stealthDrone") unit.z = role === "drone" ? 14 : 18;
    state.world.units.push(unit);
    return unit;
  }

  function spawnProjectile(source, target, projectileType, damage, splash, speedOverride) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const n = normalize(dx, dy);
    const launchSfx = getProjectileLaunchSfx(projectileType);
    playWorldSound(launchSfx.name, source.x, source.y, { cooldown: launchSfx.cooldown, volume: launchSfx.volume });
    state.world.projectiles.push({
      id: createId("projectile"),
      x: source.x,
      y: source.y,
      z: source.z || 0,
      vx: n.x * (speedOverride || 360),
      vy: n.y * (speedOverride || 360),
      vz: projectileType === "mortar" || projectileType === "boulder" || projectileType === "rocket" ? 90 : 0,
      targetX: target.x,
      targetY: target.y,
      damage,
      splash,
      projectileType,
      owner: source.owner,
      ttl: projectileType === "missile" ? 2.2 : 1.6,
    });
  }

  function spawnEffect(type, x, y, radius, tint, ttl = 0.6) {
    const shardCount = type === "nuke" ? 18 : type === "blast" ? 10 : type === "impact" ? 6 : type === "muzzle" ? 3 : 0;
    const shards = [];
    for (let i = 0; i < shardCount; i += 1) {
      const angle = (i / Math.max(1, shardCount)) * TAU + randomRange(x + y + i, -0.28, 0.28);
      const speed = type === "nuke" ? randomRange(x * 0.2 + i, 140, 260) : type === "blast" ? randomRange(y * 0.3 + i, 90, 180) : randomRange(x - y + i, 45, 110);
      shards.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: type === "nuke" ? randomRange(i * 9 + x, 9, 16) : randomRange(i * 7 + y, 3, 8),
      });
    }
    state.world.effects.push({
      id: createId("effect"),
      type,
      x,
      y,
      radius,
      ttl,
      maxTtl: ttl,
      tint,
      spin: type === "nuke" ? 0.8 : type === "blast" ? 0.42 : 0,
      rings: type === "nuke" ? 3 : type === "blast" ? 2 : type === "impact" ? 1 : 0,
      shards,
    });
  }

  function spawnDamageText(x, y, damage, tint = "#ffe29a") {
    state.world.effects.push({
      id: createId("effect"),
      type: "damageText",
      x,
      y,
      radius: 18,
      ttl: 0.72,
      maxTtl: 0.72,
      tint,
      text: String(Math.max(1, Math.round(damage || 0))),
      rise: randomRange(x + y + state.time, 18, 34),
      driftX: randomRange(x * 0.3 + y + state.time, -10, 10),
      driftY: randomRange(y * 0.2 + x + state.time, -4, 4),
      shards: [],
    });
  }

  function spawnDrop(x, y, def) {
    state.world.drops.push({
      id: createId("drop"),
      kind: "drop",
      x,
      y,
      radius: 13,
      bob: randomRange(x + y, 0, Math.PI),
      ttl: 42,
      def,
    });
    spawnEffect("dropPulse", x, y, 26, def.tint, 1.1);
  }

  function maybeSpawnRareDrop(entity, owner) {
    if (!isHumanOwner(owner)) return;
    if (entity.kind !== "unit" && entity.kind !== "animal") return;
    const chance = entity.kind === "unit" ? 0.2 : 0.07;
    if (rand(entity.x * 0.013 + entity.y * 0.017 + state.time * 4.1 + state.ids) < 1 - chance) return;
    const dropDef = rareDropCatalog[Math.floor(rand(entity.x * 0.07 + entity.y * 0.09 + state.time * 2.3) * rareDropCatalog.length)];
    spawnDrop(entity.x, entity.y, dropDef);
    notify(`Rare drop: ${dropDef.name}`, dropDef.tint);
    playWorldSound("pickup", entity.x, entity.y, { cooldown: 0.14, volume: 0.65 });
  }

  function isResourceNode(entity) {
    return entity && (entity.kind === "tree" || entity.kind === "rock");
  }

  function isNeutralEconomyTarget(entity) {
    return !!entity && (
      (entity.kind === "building" && entity.owner === "neutral" && neutralEconomyBuildingIds.has(entity.itemId))
      || entity.kind === "civilian"
    );
  }

  function getInteractionTargetById(id, kind = null) {
    if (!id) return null;
    if (!kind || kind === "resource") {
      const resource = [...state.world.trees, ...state.world.rocks].find((entry) => entry.id === id);
      if (resource) return resource;
    }
    if (!kind || kind === "tax") {
      return [...state.world.buildings, ...state.world.civilians].find((entry) => entry.id === id) || null;
    }
    return null;
  }

  function clearInteractionOrder(unit) {
    unit.interactTargetId = null;
    unit.interactKind = null;
    unit.interactCooldown = 0;
  }

  function getResourceWorkRate(unit) {
    if (unit.role === "engineer" || unit.role === "villager") return 24;
    if (unit.role === "repair") return 18;
    if (unit.type === "vehicle" || unit.airborne) return 14;
    if (unit.role === "knight") return 20;
    return 18;
  }

  function removeResourceNode(resource) {
    const table = resource.kind === "tree" ? state.world.trees : state.world.rocks;
    const idx = table.findIndex((entry) => entry.id === resource.id);
    if (idx >= 0) table.splice(idx, 1);
  }

  function harvestResourceNode(owner, resource, workAmount, options = {}) {
    if (!resource || !isResourceNode(resource) || workAmount <= 0) return { chunksBroken: 0, depleted: false };
    const effectTint = resource.kind === "tree" ? "#8c6b43" : "#c7d2db";
    const effectScale = options.effectScale || 1;
    resource.lastWorkedTimer = 0.34;
    resource.chunkHp = (resource.chunkHp || resource.chunkMaxHp || 24) - workAmount;
    resource.hp = Math.max(0, (resource.hp || resource.maxHp || workAmount) - workAmount);
    spawnEffect("debris", resource.x + randomRange(resource.x + state.time, -10, 10), resource.y + randomRange(resource.y - state.time, -10, 10), Math.max(10, resource.radius * 0.34 * effectScale), effectTint, 0.22);
    playWorldSound(resource.kind === "tree" ? "harvestWood" : "harvestStone", resource.x, resource.y, { cooldown: 0.12, volume: 0.7 });
    let chunksBroken = 0;
    while (resource.chunkHp <= 0 && resource.chunksRemaining > 0) {
      chunksBroken += 1;
      resource.chunksRemaining -= 1;
      addCoins(owner, resource.rewardCoins || 0);
      if (resource.kind === "tree") addWood(owner, resource.rewardResource || 0);
      else addStone(owner, resource.rewardResource || 0);
      incrementQuest("harvest", 1);
      spawnEffect("blast", resource.x, resource.y, resource.radius * 0.34, resource.kind === "tree" ? "#d9b36e" : "#e6eef5", 0.18);
      if (options.showMessage !== false) {
        const rewardLabel = resource.kind === "tree" ? `${resource.rewardResource || 0} wood` : `${resource.rewardResource || 0} stone`;
        notify(`${resource.kind === "tree" ? "Timber" : "Stone"} secured +${resource.rewardCoins || 0} coins • ${rewardLabel}`, "#7df2ab");
      }
      if (resource.chunksRemaining <= 0) {
        removeResourceNode(resource);
        return { chunksBroken, depleted: true };
      }
      resource.chunkHp += resource.chunkMaxHp || 24;
      const totalRatio = ((resource.chunksRemaining - 1) + clamp((resource.chunkHp || 0) / (resource.chunkMaxHp || 1), 0, 1)) / Math.max(1, resource.maxChunks || resource.chunksRemaining);
      resource.radius = Math.max((resource.baseRadius || resource.radius) * 0.56, (resource.baseRadius || resource.radius) * (0.56 + totalRatio * 0.44));
    }
    return { chunksBroken, depleted: false };
  }

  function getNearbyCivilianCount(x, y, radius) {
    let count = 0;
    for (const civilian of state.world.civilians) {
      if (Math.hypot(civilian.x - x, civilian.y - y) <= radius) count += 1;
    }
    return count;
  }

  function getTaxReserve(target) {
    if (!target) return 0;
    return target.kind === "civilian" ? (target.coinPouch || 0) : (target.taxReserve || 0);
  }

  function applyTaxCollection(owner, target, options = {}) {
    if (!target || !isNeutralEconomyTarget(target)) return 0;
    const reserve = getTaxReserve(target);
    if (reserve < 1) return 0;
    const payoutBase = target.kind === "civilian"
      ? (target.taxBatch || 6)
      : Math.min((target.taxBatch || 9) + getNearbyCivilianCount(target.x, target.y, 180), Math.max(target.taxBatch || 9, 18));
    const payout = Math.min(Math.floor(reserve), payoutBase);
    if (payout <= 0) return 0;
    if (target.kind === "civilian") {
      target.coinPouch = Math.max(0, reserve - payout);
      target.lastTaxedTimer = 0.5;
      const home = getEntityById(target.homeBuildingId);
      if (home && home.kind === "building") home.lastTaxedTimer = Math.max(home.lastTaxedTimer || 0, 0.4);
    } else {
      target.taxReserve = Math.max(0, reserve - payout);
      target.lastTaxedTimer = 0.5;
    }
    addCoins(owner, payout);
    spawnEffect("dropPulse", target.x, target.y - (target.kind === "building" ? target.radius * 0.45 : 8), 20, "#ffd889", 0.44);
    playWorldSound("taxCollect", target.x, target.y, { cooldown: 0.18, volume: 0.78 });
    if (options.showMessage !== false) {
      notify(`${target.kind === "civilian" ? "Villager dues" : "Village taxes"} +${payout} coins`, "#ffd889");
    }
    return payout;
  }

  function issueInteractionOrder(selectedUnits, targetEntity, interactionKind) {
    if (!targetEntity) return false;
    for (let i = 0; i < selectedUnits.length; i += 1) {
      const unit = selectedUnits[i];
      const offsetAngle = (i / Math.max(1, selectedUnits.length)) * TAU;
      const standoff = (targetEntity.radius || 16) + unit.radius + 12 + Math.sqrt(i) * 12;
      unit.moveTarget = {
        x: targetEntity.x + Math.cos(offsetAngle) * standoff,
        y: targetEntity.y + Math.sin(offsetAngle) * standoff,
      };
      unit.targetId = null;
      unit.focusMove = true;
      unit.interactTargetId = targetEntity.id;
      unit.interactKind = interactionKind;
      unit.interactCooldown = randomRange(unit.x + unit.y + i, 0.08, 0.26);
      unit.order = interactionKind === "resource" ? "harvest" : "collect";
      unit.orderStamp = state.time;
    }
    return true;
  }

  function issueMoveOrder(selectedUnits, worldPos) {
    for (let i = 0; i < selectedUnits.length; i += 1) {
      const unit = selectedUnits[i];
      const offsetAngle = (i / Math.max(1, selectedUnits.length)) * TAU;
      const offsetRadius = Math.sqrt(i) * 16;
      unit.moveTarget = {
        x: worldPos.x + Math.cos(offsetAngle) * offsetRadius,
        y: worldPos.y + Math.sin(offsetAngle) * offsetRadius,
      };
      unit.targetId = null;
      clearInteractionOrder(unit);
      unit.focusMove = true;
      unit.order = "move";
      unit.orderStamp = state.time;
    }
  }

  function issueAttackOrder(selectedUnits, targets) {
    const liveTargets = targets.map((id) => getEntityById(id)).filter(Boolean);
    if (!liveTargets.length) return false;
    for (let i = 0; i < selectedUnits.length; i += 1) {
      const unit = selectedUnits[i];
      const target = liveTargets[i % liveTargets.length];
      unit.targetId = target.id;
      unit.moveTarget = { x: target.x, y: target.y };
      clearInteractionOrder(unit);
      unit.focusMove = false;
      unit.order = "attack";
      unit.orderStamp = state.time;
    }
    return true;
  }

  function spawnEnemyWave() {
    if (state.matchType !== "single") return;
    const playerKeep = state.world.buildings.find((building) => building.owner === "player" && building.itemId === "royal_keep");
    if (!playerKeep) return;
    const enemyKeeps = state.world.buildings.filter((building) => building.itemId === "royal_keep" && isEnemyTarget(building));
    if (!enemyKeeps.length) return;
    state.waves.index += 1;
    state.waves.flash = 1.4;
    const waveTier = Math.min(5, 1 + Math.floor((state.waves.index - 1) / 2));
    for (const keep of enemyKeeps) {
      let composition =
        waveTier === 1 ? ["warrior", "archer"] :
        waveTier === 2 ? ["warrior", "archer", "knight"] :
        waveTier === 3 ? ["archer", "knight", "catapult"] :
        waveTier === 4 ? ["knight", "lightTank", "archer"] :
        ["mediumTank", "hovercraft", "archer", "warrior"];
      if (isEasyModeActive()) composition = composition.slice(0, Math.max(1, composition.length - 1));
      if (isHardModeActive()) {
        composition = [...composition, waveTier >= 3 ? "captain" : "warrior"];
        if (waveTier >= 4) composition.push("lightTank");
      }
      composition.forEach((role, index) => {
        const angle = (index / composition.length) * TAU + keep.angle;
        const spawnX = keep.x + Math.cos(angle) * (keep.radius + 42);
        const spawnY = keep.y + Math.sin(angle) * (keep.radius + 42);
        const item = weaponCatalog.find((entry) => entry.role === role);
        const unit = item ? spawnWeaponUnit(keep.owner, item, spawnX, spawnY) : spawnUnit(keep.owner, role, spawnX, spawnY);
        if (isEasyModeActive()) {
          unit.moveTarget = {
            x: keep.x + randomRange(spawnX + index, -120, 120),
            y: keep.y + randomRange(spawnY + index, -120, 120),
          };
          unit.order = "idle";
          unit.focusMove = false;
        } else {
          unit.moveTarget = {
            x: playerKeep.x + randomRange(spawnX + state.waves.index + index, -120, 120),
            y: playerKeep.y + randomRange(spawnY + state.waves.index + index, -120, 120),
          };
          unit.order = "move";
          unit.focusMove = true;
        }
      });
    }
    const baseCooldown = clamp(28 - state.waves.index * 1.25, 15, 28);
    state.waves.cooldown = isEasyModeActive() ? baseCooldown * 1.45 : isHardModeActive() ? baseCooldown * 0.78 : baseCooldown;
    state.waves.timer = state.waves.cooldown;
    notify(`Enemy wave ${state.waves.index} is marching on your empire.`, "#ffb484");
    playUiSound("warning", { volume: 0.88, cooldown: 0.16 });
  }

  function updateDrops(dt) {
    for (let i = state.world.drops.length - 1; i >= 0; i -= 1) {
      const drop = state.world.drops[i];
      drop.ttl -= dt;
      drop.bob += dt * 2.6;
      if (drop.ttl <= 0) {
        state.world.drops.splice(i, 1);
        continue;
      }
      const picker = findNearest(
        state.world.units,
        drop.x,
        drop.y,
        (unit) => isHumanOwner(unit.owner) && Math.hypot(unit.x - drop.x, unit.y - drop.y) <= unit.radius + drop.radius + 6,
      );
      if (!picker) continue;
      picker.damageBonus += drop.def.bonus;
      picker.rangeBonus = Math.max(picker.rangeBonus || 0, drop.def.rangeBonus || 0);
      if (drop.def.projectile && !picker.projectile) picker.projectile = drop.def.projectile;
      picker.pickupWeapon = drop.def.name;
      spawnEffect("pickup", drop.x, drop.y, 34, drop.def.tint, 0.8);
      notify(`${picker.role} equipped ${drop.def.name} (+${drop.def.bonus} damage)`, drop.def.tint);
      playWorldSound("pickup", drop.x, drop.y, { cooldown: 0.12, volume: 0.86 });
      state.world.drops.splice(i, 1);
    }
  }

  function updateEnemyWaves(dt) {
    if (state.matchType !== "single") return;
    state.waves.flash = Math.max(0, state.waves.flash - dt);
    if (isCeasefireActive()) return;
    state.waves.timer -= isEasyModeActive() ? dt * 0.6 : isHardModeActive() ? dt * 1.35 : dt;
    if (state.waves.timer <= 0) spawnEnemyWave();
  }

  function rotateLayoutPoint(x, y, angle = 0) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos,
    };
  }

  function spawnStarterEmpire(owner, startBase, facing = 0) {
    if (!startBase) return;
    for (const buildingDef of starterEmpireLayout.buildings) {
      const offset = rotateLayoutPoint(buildingDef.x, buildingDef.y, facing);
      spawnBuilding(owner, buildingDef.itemId, startBase.x + offset.x, startBase.y + offset.y, facing);
    }
    for (const unitDef of starterEmpireLayout.units) {
      const offset = rotateLayoutPoint(unitDef.x, unitDef.y, facing);
      const unit = spawnUnit(owner, unitDef.role, startBase.x + offset.x, startBase.y + offset.y);
      unit.angle = facing;
    }
  }

  function getCivilianCentersForPreset(preset = state.world.preset) {
    if (preset === "ocean") {
      return [
        { x: -880, y: -120, houses: 5, radius: 230 },
        { x: 700, y: 760, houses: 4, radius: 220 },
        { x: 1040, y: -920, houses: 5, radius: 230 },
      ];
    }
    return neutralVillageCenters.map((center) => ({ ...center }));
  }

  function getMapBiomeForPreset(preset, sample) {
    const { nx, ny, noise, heat, fracture, blight } = sample;
    const centerX = nx - 0.5;
    const centerY = ny - 0.5;
    const radial = Math.hypot(centerX, centerY);
    const roadBand = Math.abs(centerY + Math.sin(nx * 6.4) * 0.05) < 0.022 && nx > 0.16 && nx < 0.84;
    const riverBand = Math.abs(centerX + Math.sin(ny * 8.4) * 0.08) < 0.055;

    if (preset === "canyon") {
      const canyonSpine = Math.abs(centerY + Math.sin(nx * 8.8) * 0.11) < 0.1 + fracture * 0.04;
      const canyonFork = Math.abs(centerX + Math.sin(ny * 7.2) * 0.06) < 0.05 && radial < 0.42;
      if (canyonSpine || canyonFork || (fracture > 0.74 && radial < 0.5)) return "canyon";
      if (riverBand && ny > 0.14 && ny < 0.86) return "river";
      if (heat > 0.56 || radial > 0.45) return "desert";
      if (noise > 0.34) return "hill";
      if (blight > 0.42 && (nx < 0.2 || nx > 0.8)) return "deadlands";
      if (noise > -0.08) return "meadow";
      return "forest";
    }

    if (preset === "desert") {
      const oasisBand = Math.abs(centerX + Math.sin(ny * 9.2) * 0.09) < 0.06;
      const canyonCuts = Math.abs(centerX + Math.sin(ny * 10.4) * 0.13) < 0.11 && fracture > 0.44 && ny > 0.1 && ny < 0.9;
      if (oasisBand) return "river";
      if (Math.abs(centerX + Math.sin(ny * 9.2) * 0.09) < 0.11 && noise < -0.06) return "marsh";
      if (canyonCuts) return "canyon";
      if (blight > 0.42 && (nx < 0.18 || nx > 0.82)) return "deadlands";
      if (noise > 0.6) return "hill";
      if (roadBand) return "road";
      if (Math.abs(centerX + Math.sin(ny * 9.2) * 0.09) < 0.13 && noise > 0.14) return "forest";
      return "desert";
    }

    if (preset === "ocean") {
      const coastNoise = Math.sin(nx * 9.4) * 0.04 + Math.cos(ny * 7.6) * 0.04 + noise * 0.06;
      const outerSea = radial > 0.44 + coastNoise;
      const westBay = nx < 0.24 && Math.abs(ny - 0.58) < 0.19 + Math.sin(ny * 10.2) * 0.03;
      const eastBay = nx > 0.72 && Math.abs(ny - 0.38) < 0.18 + Math.cos(ny * 8.6) * 0.03;
      const centerChannel = Math.abs(centerX + Math.sin(ny * 7.8) * 0.09) < 0.048 && ny > 0.16 && ny < 0.84;
      if (outerSea || westBay || eastBay) return "ocean";
      if (centerChannel) return "river";
      if (radial > 0.36 || westBay || eastBay) return "marsh";
      if (noise > 0.5) return "hill";
      if (noise > 0.12) return "forest";
      if (blight > 0.46 && ny > 0.72) return "deadlands";
      if (roadBand) return "road";
      return "meadow";
    }

    const centerCanyonBand = nx > 0.28 && nx < 0.76 &&
      Math.abs(ny - 0.52) < 0.14 + 0.04 * Math.sin(nx * 11.5) &&
      Math.abs(nx - 0.52) > 0.06;
    if (Math.abs(nx - 0.52) < 0.07 + 0.03 * Math.sin(ny * 10)) return "river";
    if ((ny < 0.18 && heat > 0.38) || (nx > 0.72 && ny < 0.4 && heat > 0.26)) return "desert";
    if (centerCanyonBand || (fracture > 0.74 && nx > 0.16 && nx < 0.86 && ny > 0.1 && ny < 0.9)) return "canyon";
    if ((nx < 0.22 && ny > 0.68 && blight > 0.06) || (nx > 0.78 && ny > 0.74 && blight > -0.02)) return "deadlands";
    if (noise > 0.6) return "hill";
    if (noise > 0.18) return "forest";
    if (noise < -0.48) return "marsh";
    if (Math.abs(ny - 0.52) < 0.03 && nx > 0.14 && nx < 0.84) return "road";
    return "meadow";
  }

  function applySafeZoneBiomeOverride(baseBiome, x, y, noise, safeZones) {
    let biome = baseBiome;
    for (const anchor of safeZones) {
      if (Math.hypot(x - anchor.x, y - anchor.y) < anchor.radius) {
        biome = Math.abs(y - anchor.y) < 54 ? "road" : noise > 0.42 ? "hill" : "meadow";
        break;
      }
    }
    return biome;
  }

  function createWorld() {
    const preset = sanitizeMapPreset(state.mapPreset || state.world.preset);
    const civilianCenters = getCivilianCentersForPreset(preset);
    const safeZones = [
      ...homelandAnchorZones,
      ...civilianCenters.map((center) => ({ x: center.x, y: center.y, radius: center.radius || 220 })),
    ];
    state.world.preset = preset;
    state.world.tiles.length = 0;
    state.world.trees.length = 0;
    state.world.rocks.length = 0;
    state.world.civilians.length = 0;
    state.world.animals.length = 0;
    state.world.buildings.length = 0;
    state.world.units.length = 0;
    state.world.projectiles.length = 0;
    state.world.effects.length = 0;
    state.world.drops.length = 0;
    state.world.notifications.length = 0;
    state.world.quests.length = 0;
    state.waves.index = 0;
    state.waves.cooldown = 24;
    state.waves.timer = 24;
    state.waves.flash = 0;

    for (let gy = 0; gy < GRID_COUNT; gy += 1) {
      for (let gx = 0; gx < GRID_COUNT; gx += 1) {
        const x = gx * TILE_SIZE - HALF_WORLD + TILE_SIZE / 2;
        const y = gy * TILE_SIZE - HALF_WORLD + TILE_SIZE / 2;
        const nx = gx / GRID_COUNT;
        const ny = gy / GRID_COUNT;
        const ridge = Math.sin(nx * 8.2) * Math.cos(ny * 6.7);
        const swirl = Math.sin((nx + ny) * 11.5) * 0.24;
        const noise = ridge + swirl + (rand(gx * 993 + gy * 117) - 0.5) * 0.5;
        const heat = Math.sin(nx * 5.1 - ny * 3.4) * 0.45 + rand(gx * 83 + gy * 41) * 0.45;
        const fracture = Math.abs(Math.sin(nx * 14.5 + ny * 7.3) + Math.cos(nx * 4.7 - ny * 9.5)) * 0.5;
        const blight = Math.sin((nx - ny) * 9.3) * 0.4 + rand(gx * 211 + gy * 59) * 0.3;
        let biome = getMapBiomeForPreset(preset, { x, y, nx, ny, noise, heat, fracture, blight });
        biome = applySafeZoneBiomeOverride(biome, x, y, noise, safeZones);

        state.world.tiles.push({ x, y, biome, gx, gy, noise, heat, fracture, blight });

        if (biome === "forest" && rand(gx * 200 + gy * 77) > 0.4) {
          const trees = 2 + Math.floor(rand(gx * 82 + gy * 53) * 4);
          for (let i = 0; i < trees; i += 1) {
            const radius = 22 + randomRange(gx * 13 + gy * 17 + i, 0, 8);
            state.world.trees.push({
              id: createId("tree"),
              x: x + randomRange(gx * 1000 + gy * 20 + i, -TILE_SIZE * 0.34, TILE_SIZE * 0.34),
              y: y + randomRange(gx * 1003 + gy * 19 + i, -TILE_SIZE * 0.34, TILE_SIZE * 0.34),
              radius,
              baseRadius: radius,
              spriteKey: rand(gx * 102 + gy * 181 + i * 7) > 0.5 ? "tree_1" : "tree_2",
              accentKey: rand(gx * 97 + gy * 211 + i * 13) > 0.58 ? "bush" : null,
              accentOffsetX: randomRange(gx * 111 + gy * 38 + i, -radius * 0.36, radius * 0.36),
              accentOffsetY: randomRange(gx * 113 + gy * 35 + i, radius * 0.06, radius * 0.42),
              hp: 84,
              maxHp: 84,
              chunkHp: 28,
              chunkMaxHp: 28,
              chunksRemaining: 3,
              maxChunks: 3,
              rewardCoins: 8,
              rewardResource: 10,
              lastWorkedTimer: 0,
              kind: "tree",
            });
          }
        }
        if (biome === "hill" && rand(gx * 50 + gy * 61) > 0.56) {
          const radius = 22 + randomRange(gx * 42 + gy * 9, 0, 10);
          state.world.rocks.push({
            id: createId("rock"),
            x: x + randomRange(gx * 43 + gy * 48, -TILE_SIZE * 0.25, TILE_SIZE * 0.25),
            y: y + randomRange(gx * 44 + gy * 46, -TILE_SIZE * 0.25, TILE_SIZE * 0.25),
            radius,
            baseRadius: radius,
            spriteKey: rand(gx * 46 + gy * 63) > 0.48 ? "rock_1" : "rock_2",
            hp: 120,
            maxHp: 120,
            chunkHp: 30,
            chunkMaxHp: 30,
            chunksRemaining: 4,
            maxChunks: 4,
            rewardCoins: 10,
            rewardResource: 10,
            lastWorkedTimer: 0,
            kind: "rock",
          });
        }
        if (biome === "canyon" && rand(gx * 71 + gy * 137) > 0.74) {
          const radius = 16 + randomRange(gx * 59 + gy * 63, 0, 9);
          state.world.rocks.push({
            id: createId("rock"),
            x: x + randomRange(gx * 88 + gy * 91, -TILE_SIZE * 0.2, TILE_SIZE * 0.2),
            y: y + randomRange(gx * 94 + gy * 79, -TILE_SIZE * 0.2, TILE_SIZE * 0.2),
            radius,
            baseRadius: radius,
            spriteKey: rand(gx * 101 + gy * 117) > 0.46 ? "desert_rock" : "rock_2",
            accentKey: rand(gx * 119 + gy * 103) > 0.54 ? "dried_bush" : null,
            accentOffsetX: randomRange(gx * 127 + gy * 95, -radius * 0.44, radius * 0.44),
            accentOffsetY: randomRange(gx * 129 + gy * 91, radius * 0.12, radius * 0.58),
            hp: 96,
            maxHp: 96,
            chunkHp: 24,
            chunkMaxHp: 24,
            chunksRemaining: 4,
            maxChunks: 4,
            rewardCoins: 9,
            rewardResource: 8,
            lastWorkedTimer: 0,
            kind: "rock",
          });
        }
      }
    }

    for (const center of civilianCenters) {
      const market = spawnBuilding("neutral", "market", center.x + randomRange(center.x * 0.41, -110, 110), center.y + randomRange(center.y * 0.53, -86, 86), randomRange(center.x * 0.32, -0.3, 0.3));
      const granary = spawnBuilding("neutral", "granary", center.x + randomRange(center.y * 0.27, -140, 140), center.y + randomRange(center.x * 0.18, -94, 94), randomRange(center.y * 0.15, -0.2, 0.2));
      if (market) market.taxReserve = market.maxTaxReserve * 0.75;
      if (granary) granary.taxReserve = granary.maxTaxReserve * 0.65;
      for (let i = 0; i < center.houses; i += 1) {
        const hx = center.x + randomRange(center.x * 0.1 + i, -160, 160);
        const hy = center.y + randomRange(center.y * 0.2 + i, -120, 120);
        const home = spawnBuilding("neutral", "village_house", hx, hy, randomRange(i + hx, -0.4, 0.4));
        const civilians = 2 + Math.floor(rand(hx * 2.4 + hy * 4.1) * 2);
        for (let c = 0; c < civilians; c += 1) {
          state.world.civilians.push({
            id: createId("civilian"),
            kind: "civilian",
            owner: "neutral",
            x: hx + randomRange(c + hy, -40, 40),
            y: hy + randomRange(c + hx, -40, 40),
            vx: 0,
            vy: 0,
            homeX: hx,
            homeY: hy,
            homeBuildingId: home && home.id,
            wanderTimer: randomRange(hx + hy + c, 1, 4),
            radius: 9,
            coinPouch: 7 + Math.floor(rand(hx * 0.13 + hy * 0.17 + c) * 7),
            maxCoinPouch: 16,
            taxBatch: 6,
            lastTaxedTimer: 0,
          });
        }
      }
    }

    const animalSpawnTiles = state.world.tiles.filter((tile) => tile.biome !== "ocean" && tile.biome !== "river");
    for (let i = 0; i < 22; i += 1) {
      const tile = animalSpawnTiles[Math.floor(rand(i * 41 + 7) * animalSpawnTiles.length)] || state.world.tiles[i % state.world.tiles.length];
      state.world.animals.push({
        id: createId("animal"),
        kind: "animal",
        x: tile.x + randomRange(i * 90 + 1, -TILE_SIZE * 0.32, TILE_SIZE * 0.32),
        y: tile.y + randomRange(i * 120 + 3, -TILE_SIZE * 0.32, TILE_SIZE * 0.32),
        vx: 0,
        vy: 0,
        hp: 46,
        radius: 11,
        wanderTimer: randomRange(i * 34 + 7, 0.5, 3.2),
        species: i % 2 ? "deer" : "boar",
        fleeTimer: 0,
      });
    }

    if (isCompetitiveMatch()) {
      for (const player of getHumanPlayers()) {
        spawnStarterEmpire(player.owner, player.startBase, player.startFacing);
      }
    } else if (isCoopMatch()) {
      for (const player of getHumanPlayers()) {
        spawnStarterEmpire(player.owner, player.startBase, player.startFacing);
      }

      spawnBuilding("enemy1", "royal_keep", 1320, -1160);
      spawnBuilding("enemy1", "army_house", 1140, -1240);
      spawnBuilding("enemy1", "archer_house", 1340, -1370);
      spawnBuilding("enemy1", "watch_tower", 1480, -980);
      spawnBuilding("enemy1", "stone_tower", 1520, -1240);
      spawnBuilding("enemy1", "cannon_nest", 1280, -960);
      spawnBuilding("enemy1", "stable", 1120, -980);
      spawnBuilding("enemy1", "academy", 980, -1180);
      spawnBuilding("enemy1", "siege_workshop", 1220, -1450);
      spawnBuilding("enemy1", "outpost", 1580, -1140);

      spawnBuilding("enemy2", "royal_keep", 1440, 1180);
      spawnBuilding("enemy2", "stable", 1210, 1230);
      spawnBuilding("enemy2", "archer_house", 1430, 1380);
      spawnBuilding("enemy2", "stone_tower", 1280, 980);
      spawnBuilding("enemy2", "mortar_pit", 1520, 980);
      spawnBuilding("enemy2", "cannon_nest", 1600, 1180);
      spawnBuilding("enemy2", "watch_tower", 1250, 1320);
      spawnBuilding("enemy2", "academy", 1160, 1110);
      spawnBuilding("enemy2", "siege_workshop", 1500, 1450);
      spawnBuilding("enemy2", "outpost", 1680, 1290);

      spawnUnit("enemy1", "warrior", 1120, -1120);
      spawnUnit("enemy1", "warrior", 1040, -1180);
      spawnUnit("enemy1", "archer", 1220, -1060);
      spawnUnit("enemy1", "archer", 1310, -1160);
      spawnUnit("enemy1", "knight", 1360, -1290);
      spawnUnit("enemy1", "captain", 1180, -1340);
      spawnUnit("enemy1", "engineer", 980, -1280);
      spawnUnit("enemy1", "lightTank", 1470, -1350);
      spawnUnit("enemy2", "knight", 1320, 1120);
      spawnUnit("enemy2", "knight", 1390, 1220);
      spawnUnit("enemy2", "warrior", 1240, 1210);
      spawnUnit("enemy2", "warrior", 1320, 1280);
      spawnUnit("enemy2", "archer", 1500, 1300);
      spawnUnit("enemy2", "archer", 1410, 1110);
      spawnUnit("enemy2", "captain", 1200, 1330);
      spawnUnit("enemy2", "engineer", 1540, 1350);
      spawnUnit("enemy2", "hovercraft", 1660, 1200);
    } else {
      spawnBuilding("player", "royal_keep", -1180, 980);
      spawnBuilding("player", "army_house", -1000, 980);
      spawnBuilding("player", "archer_house", -1220, 1180);
      spawnBuilding("player", "watch_tower", -880, 1180);
      spawnBuilding("player", "market", -1330, 820);
      spawnBuilding("player", "farm", -1450, 980);
      spawnBuilding("player", "lumber_camp", -1330, 1120);
      spawnBuilding("player", "quarry", -1110, 790);

      spawnBuilding("enemy1", "royal_keep", 1320, -1160);
      spawnBuilding("enemy1", "army_house", 1140, -1240);
      spawnBuilding("enemy1", "watch_tower", 1480, -980);
      spawnBuilding("enemy1", "cannon_nest", 1280, -960);
      spawnBuilding("enemy2", "royal_keep", 1440, 1180);
      spawnBuilding("enemy2", "stable", 1210, 1230);
      spawnBuilding("enemy2", "stone_tower", 1280, 980);
      spawnBuilding("enemy2", "mortar_pit", 1520, 980);

      spawnUnit("player", "warrior", -980, 1100);
      spawnUnit("player", "warrior", -1040, 1140);
      spawnUnit("player", "archer", -1180, 1260);
      spawnUnit("player", "knight", -1260, 1000);
      spawnUnit("enemy1", "warrior", 1120, -1120);
      spawnUnit("enemy1", "archer", 1220, -1060);
      spawnUnit("enemy2", "knight", 1320, 1120);
      spawnUnit("enemy2", "warrior", 1240, 1210);

      addQuest({ title: "Raise the Crownlands", desc: "Build 4 new structures.", kind: "build", target: 4, reward: 220 });
      addQuest({ title: "Timber and Stone", desc: "Harvest 9 resource nodes.", kind: "harvest", target: 9, reward: 260 });
      addQuest({ title: "Break Their Vanguard", desc: "Defeat 12 enemy units.", kind: "kills", target: 12, reward: 320 });
      addQuest({ title: "Empire Treasury", desc: "Reach 2200 coins.", kind: "wealth", target: 2200, reward: 420 });
    }

    renderTerrainCache();
  }

  function renderTerrainCache() {
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    for (const tile of state.world.tiles) {
      const sx = tile.x + HALF_WORLD - TILE_SIZE / 2;
      const sy = tile.y + HALF_WORLD - TILE_SIZE / 2;
      const north = getTileByGrid(tile.gx, tile.gy - 1);
      const south = getTileByGrid(tile.gx, tile.gy + 1);
      const west = getTileByGrid(tile.gx - 1, tile.gy);
      const east = getTileByGrid(tile.gx + 1, tile.gy);
      const neighbors = [
        ["north", north],
        ["south", south],
        ["west", west],
        ["east", east],
      ];
      const palette = terrainPalette[tile.biome];
      const grad = mapCtx.createLinearGradient(sx, sy, sx + TILE_SIZE, sy + TILE_SIZE);
      grad.addColorStop(0, palette[0]);
      grad.addColorStop(0.5, palette[1]);
      grad.addColorStop(1, palette[2]);
      mapCtx.fillStyle = grad;
      mapCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      if (!wetBiomes.has(tile.biome)) {
        const shoreColor = tile.biome === "desert"
          ? "rgba(248,228,176,0.18)"
          : tile.biome === "canyon"
            ? "rgba(236,194,154,0.14)"
            : "rgba(214,234,196,0.12)";
        for (const [side, neighbor] of neighbors) {
          if (!neighbor || !wetBiomes.has(neighbor.biome)) continue;
          paintTileEdgeGradient(mapCtx, sx, sy, TILE_SIZE, side, shoreColor, "rgba(0,0,0,0)", TILE_SIZE * 0.18);
        }
      } else {
        for (const [side, neighbor] of neighbors) {
          if (neighbor && wetBiomes.has(neighbor.biome)) continue;
          const bankShade = tile.biome === "ocean"
            ? "rgba(6,31,48,0.18)"
            : tile.biome === "river"
              ? "rgba(10,41,66,0.12)"
              : "rgba(23,40,28,0.1)";
          const bankGlow = tile.biome === "ocean"
            ? "rgba(214,245,255,0.12)"
            : tile.biome === "river"
              ? "rgba(214,245,255,0.08)"
              : "rgba(192,222,170,0.06)";
          paintTileEdgeGradient(mapCtx, sx, sy, TILE_SIZE, side, bankShade, "rgba(0,0,0,0)", TILE_SIZE * 0.14);
          paintTileEdgeGradient(mapCtx, sx, sy, TILE_SIZE, side, bankGlow, "rgba(0,0,0,0)", TILE_SIZE * 0.08);
        }
      }
      const underGlow = mapCtx.createRadialGradient(sx + TILE_SIZE * 0.46, sy + TILE_SIZE * 0.38, 6, sx + TILE_SIZE * 0.46, sy + TILE_SIZE * 0.38, TILE_SIZE * 0.72);
      underGlow.addColorStop(0, tile.biome === "ocean" ? "rgba(198,236,255,0.14)" : tile.biome === "river" ? "rgba(210,239,255,0.1)" : tile.biome === "desert" ? "rgba(255,232,173,0.08)" : tile.biome === "deadlands" ? "rgba(136,88,116,0.08)" : "rgba(255,255,255,0.04)");
      underGlow.addColorStop(1, "rgba(0,0,0,0)");
      mapCtx.fillStyle = underGlow;
      mapCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      mapCtx.fillStyle = tile.biome === "ocean" ? "rgba(255,255,255,0.08)" : tile.biome === "river" ? "rgba(255,255,255,0.06)" : tile.biome === "desert" ? "rgba(255,243,214,0.03)" : "rgba(255,255,255,0.018)";
      for (let i = 0; i < 8; i += 1) {
        const px = sx + randomRange(tile.gx * 37 + tile.gy * 19 + i, 6, TILE_SIZE - 10);
        const py = sy + randomRange(tile.gx * 31 + tile.gy * 27 + i, 6, TILE_SIZE - 10);
        if (tile.biome === "ocean") {
          mapCtx.fillRect(px, py, 14, 1.8);
        } else if (tile.biome === "river") {
          mapCtx.fillRect(px, py, 12, 1.6);
        } else if (tile.biome === "desert") {
          mapCtx.fillRect(px, py, 10, 1.2);
        } else if (tile.biome === "deadlands") {
          mapCtx.fillRect(px, py, 5, 5);
        } else if (tile.biome === "road") {
          mapCtx.fillRect(px, py, 7, 2.2);
        } else {
          mapCtx.beginPath();
          mapCtx.arc(px, py, randomRange(tile.gx * 73 + tile.gy * 11 + i, 1, 3.5), 0, TAU);
          mapCtx.fill();
        }
      }
      if (tile.biome === "meadow" || tile.biome === "marsh") {
        mapCtx.strokeStyle = tile.biome === "marsh" ? "rgba(181,198,151,0.08)" : "rgba(208,223,168,0.09)";
        mapCtx.lineWidth = 1;
        for (let i = 0; i < 4; i += 1) {
          const px = sx + randomRange(tile.gx * 89 + tile.gy * 41 + i, 8, TILE_SIZE - 8);
          const py = sy + randomRange(tile.gx * 91 + tile.gy * 37 + i, 10, TILE_SIZE - 8);
          mapCtx.beginPath();
          mapCtx.moveTo(px, py + 3);
          mapCtx.lineTo(px + 2, py - 4);
          mapCtx.stroke();
        }
      }
      if (tile.biome === "meadow") {
        mapCtx.fillStyle = "rgba(255,232,176,0.05)";
        for (let i = 0; i < 3; i += 1) {
          const px = sx + randomRange(tile.gx * 47 + tile.gy * 53 + i, 12, TILE_SIZE - 12);
          const py = sy + randomRange(tile.gx * 63 + tile.gy * 43 + i, 10, TILE_SIZE - 10);
          mapCtx.fillRect(px, py, 2.5, 2.5);
        }
      }
      if (tile.biome === "hill") {
        mapCtx.strokeStyle = "rgba(255,240,208,0.08)";
        mapCtx.lineWidth = 1.1;
        mapCtx.beginPath();
        mapCtx.arc(sx + TILE_SIZE * 0.45, sy + TILE_SIZE * 0.52, TILE_SIZE * 0.22, Math.PI * 0.1, Math.PI * 1.8);
        mapCtx.stroke();
      }
      if (tile.biome === "forest") {
        mapCtx.fillStyle = "rgba(16,28,18,0.09)";
        mapCtx.beginPath();
        mapCtx.arc(sx + TILE_SIZE * 0.5, sy + TILE_SIZE * 0.54, TILE_SIZE * 0.28, 0, TAU);
        mapCtx.fill();
        mapCtx.strokeStyle = "rgba(72,108,74,0.16)";
        mapCtx.lineWidth = 1;
        mapCtx.beginPath();
        mapCtx.moveTo(sx + 10, sy + TILE_SIZE * 0.72);
        mapCtx.quadraticCurveTo(sx + TILE_SIZE * 0.38, sy + TILE_SIZE * 0.34, sx + TILE_SIZE - 10, sy + TILE_SIZE * 0.66);
        mapCtx.stroke();
        mapCtx.fillStyle = "rgba(124,166,110,0.06)";
        mapCtx.beginPath();
        mapCtx.ellipse(sx + TILE_SIZE * 0.54, sy + TILE_SIZE * 0.36, TILE_SIZE * 0.22, TILE_SIZE * 0.1, -0.4, 0, TAU);
        mapCtx.fill();
      }
      if (tile.biome === "desert") {
        mapCtx.strokeStyle = "rgba(247,227,178,0.14)";
        mapCtx.lineWidth = 1;
        for (let i = 0; i < 3; i += 1) {
          const waveY = sy + TILE_SIZE * (0.24 + i * 0.19);
          mapCtx.beginPath();
          mapCtx.moveTo(sx + 8, waveY);
          mapCtx.bezierCurveTo(sx + 22, waveY - 4, sx + 54, waveY + 6, sx + TILE_SIZE - 8, waveY);
          mapCtx.stroke();
        }
      }
      if (tile.biome === "marsh") {
        mapCtx.fillStyle = "rgba(18,44,32,0.13)";
        mapCtx.beginPath();
        mapCtx.ellipse(sx + TILE_SIZE * 0.36, sy + TILE_SIZE * 0.58, TILE_SIZE * 0.14, TILE_SIZE * 0.08, 0.2, 0, TAU);
        mapCtx.fill();
        mapCtx.beginPath();
        mapCtx.ellipse(sx + TILE_SIZE * 0.66, sy + TILE_SIZE * 0.34, TILE_SIZE * 0.12, TILE_SIZE * 0.07, -0.4, 0, TAU);
        mapCtx.fill();
      }
      if (tile.biome === "canyon") {
        const canyonShade = mapCtx.createLinearGradient(sx, sy, sx + TILE_SIZE, sy + TILE_SIZE);
        canyonShade.addColorStop(0, "rgba(77,34,18,0.12)");
        canyonShade.addColorStop(1, "rgba(255,180,126,0.05)");
        mapCtx.fillStyle = canyonShade;
        mapCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        mapCtx.strokeStyle = "rgba(52,23,12,0.34)";
        mapCtx.lineWidth = 4;
        mapCtx.beginPath();
        mapCtx.moveTo(sx + TILE_SIZE * 0.16, sy + TILE_SIZE * 0.08);
        mapCtx.lineTo(sx + TILE_SIZE * 0.34, sy + TILE_SIZE * 0.36);
        mapCtx.lineTo(sx + TILE_SIZE * 0.52, sy + TILE_SIZE * 0.46);
        mapCtx.lineTo(sx + TILE_SIZE * 0.72, sy + TILE_SIZE * 0.82);
        mapCtx.stroke();
        mapCtx.strokeStyle = "rgba(206,135,96,0.22)";
        mapCtx.lineWidth = 2;
        mapCtx.stroke();
        mapCtx.fillStyle = "rgba(255,214,186,0.06)";
        mapCtx.fillRect(sx + TILE_SIZE * 0.16, sy + TILE_SIZE * 0.18, TILE_SIZE * 0.2, TILE_SIZE * 0.1);
      }
      if (tile.biome === "deadlands") {
        mapCtx.fillStyle = "rgba(18,10,14,0.18)";
        mapCtx.beginPath();
        mapCtx.arc(sx + TILE_SIZE * 0.48, sy + TILE_SIZE * 0.5, TILE_SIZE * 0.32, 0, TAU);
        mapCtx.fill();
        mapCtx.strokeStyle = "rgba(147,109,126,0.14)";
        mapCtx.lineWidth = 1.2;
        mapCtx.beginPath();
        mapCtx.moveTo(sx + TILE_SIZE * 0.2, sy + TILE_SIZE * 0.2);
        mapCtx.lineTo(sx + TILE_SIZE * 0.82, sy + TILE_SIZE * 0.74);
        mapCtx.moveTo(sx + TILE_SIZE * 0.22, sy + TILE_SIZE * 0.76);
        mapCtx.lineTo(sx + TILE_SIZE * 0.72, sy + TILE_SIZE * 0.3);
        mapCtx.stroke();
      }
      if (tile.biome === "river") {
        mapCtx.strokeStyle = "rgba(176,229,255,0.15)";
        mapCtx.lineWidth = 1.4;
        mapCtx.beginPath();
        mapCtx.moveTo(sx + 8, sy + TILE_SIZE * 0.24);
        mapCtx.bezierCurveTo(sx + TILE_SIZE * 0.34, sy + TILE_SIZE * 0.18, sx + TILE_SIZE * 0.66, sy + TILE_SIZE * 0.38, sx + TILE_SIZE - 8, sy + TILE_SIZE * 0.3);
        mapCtx.moveTo(sx + 6, sy + TILE_SIZE * 0.62);
        mapCtx.bezierCurveTo(sx + TILE_SIZE * 0.28, sy + TILE_SIZE * 0.54, sx + TILE_SIZE * 0.58, sy + TILE_SIZE * 0.78, sx + TILE_SIZE - 10, sy + TILE_SIZE * 0.68);
        mapCtx.stroke();
      }
      if (tile.biome === "ocean") {
        mapCtx.strokeStyle = "rgba(205,240,255,0.18)";
        mapCtx.lineWidth = 1.6;
        for (let i = 0; i < 2; i += 1) {
          const foamY = sy + TILE_SIZE * (0.28 + i * 0.28);
          mapCtx.beginPath();
          mapCtx.moveTo(sx + 10, foamY);
          mapCtx.bezierCurveTo(sx + TILE_SIZE * 0.32, foamY - 5, sx + TILE_SIZE * 0.62, foamY + 7, sx + TILE_SIZE - 10, foamY);
          mapCtx.stroke();
        }
      }
      if (tile.biome === "road") {
        mapCtx.fillStyle = "rgba(255,228,162,0.05)";
        mapCtx.fillRect(sx + TILE_SIZE * 0.26, sy + 4, TILE_SIZE * 0.08, TILE_SIZE - 8);
        mapCtx.fillRect(sx + TILE_SIZE * 0.66, sy + 4, TILE_SIZE * 0.08, TILE_SIZE - 8);
        mapCtx.strokeStyle = "rgba(72,56,38,0.12)";
        mapCtx.lineWidth = 1.1;
        mapCtx.beginPath();
        mapCtx.moveTo(sx + TILE_SIZE * 0.22, sy + 4);
        mapCtx.lineTo(sx + TILE_SIZE * 0.22, sy + TILE_SIZE - 4);
        mapCtx.moveTo(sx + TILE_SIZE * 0.78, sy + 4);
        mapCtx.lineTo(sx + TILE_SIZE * 0.78, sy + TILE_SIZE - 4);
        mapCtx.stroke();
      }
      mapCtx.strokeStyle = "rgba(11, 24, 28, 0.2)";
      mapCtx.lineWidth = 1;
      mapCtx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
      const shade = mapCtx.createLinearGradient(sx, sy, sx, sy + TILE_SIZE);
      shade.addColorStop(0, "rgba(255,255,255,0.02)");
      shade.addColorStop(1, "rgba(0,0,0,0.08)");
      mapCtx.fillStyle = shade;
      mapCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    }

    mapCtx.save();
    mapCtx.globalAlpha = 0.24;
    mapCtx.fillStyle = "#1f4f69";
    mapCtx.beginPath();
    mapCtx.moveTo(HALF_WORLD - 220, 0);
    mapCtx.bezierCurveTo(HALF_WORLD + 70, 860, HALF_WORLD - 140, 1500, HALF_WORLD + 160, 2500);
    mapCtx.bezierCurveTo(HALF_WORLD + 260, 2920, HALF_WORLD - 130, 3600, HALF_WORLD + 110, WORLD_SIZE);
    mapCtx.lineTo(HALF_WORLD + 340, WORLD_SIZE);
    mapCtx.bezierCurveTo(HALF_WORLD + 40, 3550, HALF_WORLD + 380, 2900, HALF_WORLD + 360, 2450);
    mapCtx.bezierCurveTo(HALF_WORLD + 130, 1520, HALF_WORLD + 410, 930, HALF_WORLD + 70, 0);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.strokeStyle = "rgba(169,216,244,0.25)";
    mapCtx.lineWidth = 8;
    mapCtx.stroke();
    mapCtx.globalAlpha = 0.08;
    mapCtx.fillStyle = "#f5f9ff";
    for (let i = 0; i < 18; i += 1) {
      const px = HALF_WORLD + randomRange(i * 10, -120, 120);
      const py = randomRange(i * 40 + 19, 120, WORLD_SIZE - 120);
      mapCtx.fillRect(px - 44, py, 88, 2);
    }
    mapCtx.restore();

    const light = mapCtx.createRadialGradient(HALF_WORLD * 0.35, HALF_WORLD * 0.28, 120, HALF_WORLD * 0.35, HALF_WORLD * 0.28, WORLD_SIZE * 0.8);
    light.addColorStop(0, "rgba(255,238,194,0.22)");
    light.addColorStop(1, "rgba(0,0,0,0)");
    mapCtx.fillStyle = light;
    mapCtx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
    const horizonGlow = mapCtx.createLinearGradient(0, 0, 0, WORLD_SIZE);
    horizonGlow.addColorStop(0, "rgba(136,186,214,0.04)");
    horizonGlow.addColorStop(0.56, "rgba(0,0,0,0)");
    horizonGlow.addColorStop(1, "rgba(6,10,14,0.16)");
    mapCtx.fillStyle = horizonGlow;
    mapCtx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
    const coolShadow = mapCtx.createRadialGradient(WORLD_SIZE * 0.72, WORLD_SIZE * 0.24, 120, WORLD_SIZE * 0.72, WORLD_SIZE * 0.24, WORLD_SIZE * 0.92);
    coolShadow.addColorStop(0, "rgba(0,0,0,0)");
    coolShadow.addColorStop(1, "rgba(10,20,28,0.18)");
    mapCtx.fillStyle = coolShadow;
    mapCtx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  }

  function worldToScreen(x, y) {
    const viewport = state.activeViewport || getViewportForPlayer();
    const dx = x - state.camera.x;
    const dy = y - state.camera.y;
    const cos = Math.cos(state.camera.rotation);
    const sin = Math.sin(state.camera.rotation);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return { x: viewport.x + viewport.w / 2 + rx * state.camera.zoom, y: viewport.y + viewport.h / 2 + ry * state.camera.zoom };
  }

  function screenToWorld(x, y) {
    const viewport = state.activeViewport || getViewportForPlayer();
    const dx = (x - (viewport.x + viewport.w / 2)) / state.camera.zoom;
    const dy = (y - (viewport.y + viewport.h / 2)) / state.camera.zoom;
    const cos = Math.cos(-state.camera.rotation);
    const sin = Math.sin(-state.camera.rotation);
    return { x: state.camera.x + dx * cos - dy * sin, y: state.camera.y + dx * sin + dy * cos };
  }

  function clientToCanvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: clientX, y: clientY };
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function worldToMinimap(x, y, rect) {
    return {
      x: rect.x + ((x + HALF_WORLD) / WORLD_SIZE) * rect.w,
      y: rect.y + ((y + HALF_WORLD) / WORLD_SIZE) * rect.h,
    };
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function getUiScale() {
    const viewport = state.activeViewport || getViewportForPlayer();
    return Math.max(0.64, Math.min(1.04, Math.min(viewport.w / 760, viewport.h / 560)));
  }

  function getAllEntities() {
    return [...state.world.units, ...state.world.buildings, ...state.world.animals, ...state.world.civilians];
  }

  function getEntityById(id) {
    return getAllEntities().find((entity) => entity.id === id) || null;
  }

  function removeEntity(entity) {
    const tables = [state.world.units, state.world.buildings, state.world.animals, state.world.civilians];
    for (const table of tables) {
      const idx = table.findIndex((entry) => entry.id === entity.id);
      if (idx >= 0) {
        table.splice(idx, 1);
        for (const player of getHumanPlayers()) {
          player.selectedIds.delete(entity.id);
          if (player.firstPerson && player.firstPerson.unitId === entity.id) exitFirstPerson(player, { silent: true });
        }
        return;
      }
    }
  }

  function ownerHasForces(owner) {
    return state.world.buildings.some((building) => building.owner === owner) || state.world.units.some((unit) => unit.owner === owner);
  }

  function countHostileUnits() {
    return state.world.units.filter((unit) => unit.owner !== "neutral" && !isHumanOwner(unit.owner)).length;
  }

  function countHostileBuildings() {
    return state.world.buildings.filter((building) => building.owner !== "neutral" && !isHumanOwner(building.owner)).length;
  }

  function countHardCamps() {
    return state.world.buildings.filter((building) => building.hardCamp).length;
  }

  function countEnemyStrongholds() {
    return state.world.buildings.filter((building) => building.owner !== "neutral" && !isHumanOwner(building.owner) && building.itemId === "royal_keep").length;
  }

  function ownerUnitCount(owner) {
    return state.world.units.filter((unit) => unit.owner === owner).length;
  }

  function ownerBuildingCount(owner) {
    return state.world.buildings.filter((building) => building.owner === owner).length;
  }

  function getCompetitiveOpponents(owner) {
    if (!isCompetitiveMatch()) return [];
    return getHumanOwners().filter((candidate) => candidate !== owner);
  }

  function getCompetitiveAliveOpponents(owner) {
    return getCompetitiveOpponents(owner).filter((candidate) => ownerHasForces(candidate));
  }

  function getCompetitiveTotals(owner) {
    const opponents = getCompetitiveOpponents(owner);
    return {
      opponents,
      aliveOpponents: opponents.filter((candidate) => ownerHasForces(candidate)),
      enemyUnits: opponents.reduce((sum, candidate) => sum + ownerUnitCount(candidate), 0),
      enemyBuildings: opponents.reduce((sum, candidate) => sum + ownerBuildingCount(candidate), 0),
    };
  }

  function getCompetitiveLeader(owner) {
    const opponents = getCompetitiveOpponents(owner);
    let best = null;
    for (const candidate of opponents) {
      const forceCount = ownerUnitCount(candidate) + ownerBuildingCount(candidate);
      if (!best || forceCount > best.forceCount) best = { owner: candidate, forceCount };
    }
    return best;
  }

  function getBottomBarLayout() {
    const viewport = state.activeViewport || getViewportForPlayer();
    const scale = getUiScale();
    const slotSize = 70 * scale;
    const gap = 10 * scale;
    const totalWidth = slotSize * 8 + gap * 7;
    const x = viewport.x + (viewport.w - totalWidth) / 2;
    const y = viewport.y + viewport.h - slotSize - 22 * scale;
    const slots = [];
    for (let i = 0; i < 8; i += 1) {
      slots.push({
        x: x + i * (slotSize + gap),
        y,
        w: slotSize,
        h: slotSize,
        side: i < 4 ? "assets" : "weapons",
        index: i < 4 ? i : i - 4,
      });
    }
    return { x, y, slotSize, gap, slots };
  }

  function getPanelLayout(type) {
    const viewport = state.activeViewport || getViewportForPlayer();
    const scale = getUiScale();
    const padding = 24 * scale;
    const cardGap = 8 * scale;
    const w = Math.min(viewport.w - 40 * scale, viewport.w * 0.94);
    const x = viewport.x + (viewport.w - w) / 2;
    const cols = viewport.w < 820 ? 4 : 5;
    const items = type === "assets" ? assetCatalog : weaponCatalog;
    const rows = Math.ceil(items.length / cols);
    const cellW = (w - padding * 2) / cols;
    const cellH = 86 * scale;
    const headerH = 68 * scale;
    const footerH = 28 * scale;
    const bodyH = Math.min(rows * cellH, Math.max(170 * scale, viewport.h - 280 * scale));
    const h = headerH + bodyH + footerH;
    const y = Math.max(viewport.y + 94 * scale, viewport.y + viewport.h - h - 120 * scale);
    const scrollMax = Math.max(0, rows * cellH - bodyH);
    const scroll = clamp(getPanelScroll(type), 0, scrollMax);
    const listX = x + padding;
    const listY = y + headerH;
    return { type, x, y, w, h, cols, cellW, cellH, items, scale, headerH, footerH, bodyH, listX, listY, padding, cardGap, scroll, scrollMax };
  }

  function isInsideRect(px, py, rect) {
    return px >= rect.x && py >= rect.y && px <= rect.x + rect.w && py <= rect.y + rect.h;
  }

  function getItemCardAt(px, py) {
    if (!state.ui.openPanel) return null;
    const layout = getPanelLayout(state.ui.openPanel);
    for (let i = 0; i < layout.items.length; i += 1) {
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);
      const rect = {
        x: layout.listX + col * layout.cellW,
        y: layout.listY + row * layout.cellH - layout.scroll,
        w: layout.cellW - layout.cardGap,
        h: layout.cellH - 10 * layout.scale,
      };
      if (rect.y + rect.h < layout.listY || rect.y > layout.listY + layout.bodyH) continue;
      if (isInsideRect(px, py, rect)) return { item: layout.items[i], rect };
    }
    return null;
  }

  function getQuickSlotAt(px, py) {
    return getBottomBarLayout().slots.find((slot) => isInsideRect(px, py, slot)) || null;
  }

  function setQuickSlot(slot, itemId) {
    const player = getActivePlayerState();
    if (player) player.quickSlots[slot.side][slot.index] = itemId;
  }

  function getActivePlacement() {
    return state.ui.activePlacementId ? itemIndex.get(state.ui.activePlacementId) : null;
  }

  function isTroopPlacementItem(item) {
    return Boolean(item) && !assetCatalog.includes(item) && item.type !== "ability";
  }

  function getPlacedBuildings(owner) {
    return state.world.buildings.filter((building) => building.owner === owner && building.manualPlacement);
  }

  function getOwnedBuildings(owner) {
    return state.world.buildings.filter((building) => building.owner === owner);
  }

  function getHomeBuilding(owner) {
    return state.world.buildings.find((building) => building.owner === owner && building.itemId === "royal_keep") ||
      state.world.buildings.find((building) => building.owner === owner) ||
      null;
  }

  function getLatestPlacedBuilding(owner) {
    const placedBuildings = getPlacedBuildings(owner);
    if (placedBuildings.length) {
      return placedBuildings.reduce((best, building) => (building.placementIndex || 0) > (best.placementIndex || 0) ? building : best, placedBuildings[0]);
    }
    return getHomeBuilding(owner);
  }

  function getFurthestOwnedBuilding(owner) {
    const home = getHomeBuilding(owner);
    const candidateBuildings = getPlacedBuildings(owner);
    const anchorPool = candidateBuildings.length ? candidateBuildings : getOwnedBuildings(owner);
    if (!anchorPool.length) return null;
    if (!home) return anchorPool[0];
    return anchorPool.reduce((best, building) => {
      const bestDist = Math.hypot(best.x - home.x, best.y - home.y);
      const buildingDist = Math.hypot(building.x - home.x, building.y - home.y);
      return buildingDist > bestDist ? building : best;
    }, anchorPool[0]);
  }

  function getPlacementConstraint(item, owner) {
    if (!item || !owner) return null;
    if (assetCatalog.includes(item)) {
      const anchor = getLatestPlacedBuilding(owner);
      return anchor ? {
        anchor,
        radius: TILE_SIZE * 10 + (anchor.radius || 0),
        reason: `Build this asset within 10 tiles of your latest placed structure (${anchor.def && anchor.def.name ? anchor.def.name : "anchor"}).`,
      } : null;
    }
    if (isTroopPlacementItem(item)) {
      const anchor = getFurthestOwnedBuilding(owner);
      return anchor ? {
        anchor,
        radius: TILE_SIZE * 8 + (anchor.radius || 0),
        reason: `Deploy troops within 8 tiles of your frontier structure (${anchor.def && anchor.def.name ? anchor.def.name : "anchor"}).`,
      } : null;
    }
    return null;
  }

  function getPlacementBlockReason(item, x, y, owner = getActivePlayerState() && getActivePlayerState().owner) {
    if (!item) return "Choose a unit or structure first.";
    if (assetCatalog.includes(item)) {
      for (const building of state.world.buildings) {
        if (Math.hypot(building.x - x, building.y - y) < building.radius + TILE_SIZE * item.footprint * 0.4) return "That structure overlaps another building.";
      }
      const terrainSamples = sampleTerrainUnderFootprint(x, y, TILE_SIZE * item.footprint * 0.5);
      if (terrainSamples.some((terrain) => !isStructureAllowedOnTerrain(item, terrain))) return "That structure cannot be placed on this terrain.";
      if (item.id === "bridge" && !pointNearBridgeableGap(x, y)) return "Bridges need water or canyon ground nearby.";
      if (item.id === "dock" && !pointNearWater(x, y)) return "Docks must be placed beside water.";
      if (item.id === "hover_port" && !pointNearWater(x, y)) return "Hover Ports must be placed beside water.";
      if (item.id === "farm" && terrainSamples.some((terrain) => terrain.label === "Deadlands" || terrain.label === "Desert" || terrain.label === "Canyon")) return "Farms need gentler ground than desert, canyon, or deadlands.";
      if ((item.id === "village_house" || item.id === "market" || item.id === "chapel") && terrainSamples.some((terrain) => terrain.label === "Canyon")) return "Settlements cannot be placed inside canyon terrain.";
    }
    const constraint = getPlacementConstraint(item, owner);
    if (constraint && Math.hypot(x - constraint.anchor.x, y - constraint.anchor.y) > constraint.radius) return constraint.reason;
    return null;
  }

  function canAfford(itemId, owner = getActivePlayerState() && getActivePlayerState().owner) {
    const def = itemIndex.get(itemId);
    const resources = getOwnerResources(owner);
    return def && resources && resources.coins >= def.cost;
  }

  function spendCoins(amount, owner) {
    const resources = getOwnerResources(owner);
    if (resources) resources.coins = Math.max(0, resources.coins - amount);
  }

  function addCoins(owner, amount) {
    const resources = getOwnerResources(owner);
    if (resources) resources.coins += amount;
  }

  function addWood(owner, amount) {
    const resources = getOwnerResources(owner);
    if (resources) resources.wood += amount;
  }

  function addStone(owner, amount) {
    const resources = getOwnerResources(owner);
    if (resources) resources.stone += amount;
  }

  function sampleNearbyBiomes(x, y, radius = TILE_SIZE * 0.8) {
    const offsets = [
      [0, 0],
      [-radius, 0],
      [radius, 0],
      [0, -radius],
      [0, radius],
      [-radius * 0.6, -radius * 0.6],
      [radius * 0.6, -radius * 0.6],
      [-radius * 0.6, radius * 0.6],
      [radius * 0.6, radius * 0.6],
    ];
    return offsets
      .map(([ox, oy]) => getTileAtWorld(x + ox, y + oy))
      .filter(Boolean)
      .map((tile) => tile.biome);
  }

  function pointNearWater(x, y) {
    return sampleNearbyBiomes(x, y, TILE_SIZE * 0.9).some((biome) => wetBiomes.has(biome));
  }

  function pointNearBridgeableGap(x, y) {
    return sampleNearbyBiomes(x, y, TILE_SIZE * 1.05).some((biome) => wetBiomes.has(biome) || biome === "canyon");
  }

  function createAdminTree(x, y, tool) {
    const radius = tool && tool.spriteKey === "tree_2" ? 30 : 28;
    const tree = {
      id: createId("tree"),
      x,
      y,
      radius,
      baseRadius: radius,
      spriteKey: (tool && tool.spriteKey) || "tree_1",
      accentKey: tool && tool.accentKey ? tool.accentKey : "bush",
      accentOffsetX: randomRange(x * 0.13 + y, -radius * 0.36, radius * 0.36),
      accentOffsetY: randomRange(y * 0.09 + x, radius * 0.06, radius * 0.42),
      hp: 84,
      maxHp: 84,
      chunkHp: 28,
      chunkMaxHp: 28,
      chunksRemaining: 3,
      maxChunks: 3,
      rewardCoins: 8,
      rewardResource: 10,
      lastWorkedTimer: 0,
      kind: "tree",
    };
    state.world.trees.push(tree);
    return tree;
  }

  function createAdminRock(x, y, tool) {
    const radius = tool && tool.spriteKey === "desert_rock" ? 24 : 28;
    const rock = {
      id: createId("rock"),
      x,
      y,
      radius,
      baseRadius: radius,
      spriteKey: (tool && tool.spriteKey) || "rock_1",
      accentKey: tool && tool.accentKey ? tool.accentKey : null,
      accentOffsetX: randomRange(x * 0.08 + y, -radius * 0.34, radius * 0.34),
      accentOffsetY: randomRange(y * 0.12 + x, radius * 0.08, radius * 0.5),
      hp: 120,
      maxHp: 120,
      chunkHp: 30,
      chunkMaxHp: 30,
      chunksRemaining: 4,
      maxChunks: 4,
      rewardCoins: 10,
      rewardResource: 10,
      lastWorkedTimer: 0,
      kind: "rock",
    };
    state.world.rocks.push(rock);
    return rock;
  }

  function createAdminCivilian(owner, x, y) {
    const civilian = {
      id: createId("civilian"),
      kind: "civilian",
      owner,
      x,
      y,
      vx: 0,
      vy: 0,
      homeX: x,
      homeY: y,
      homeBuildingId: null,
      wanderTimer: randomRange(x * 0.2 + y, 1, 4),
      radius: 9,
      coinPouch: 10,
      maxCoinPouch: 16,
      taxBatch: 6,
      lastTaxedTimer: 0,
    };
    state.world.civilians.push(civilian);
    return civilian;
  }

  function createAdminAnimal(species, x, y) {
    const animal = {
      id: createId("animal"),
      kind: "animal",
      x,
      y,
      vx: 0,
      vy: 0,
      hp: 46,
      radius: 11,
      wanderTimer: randomRange(x * 0.1 + y, 0.5, 3.2),
      species,
      fleeTimer: 0,
    };
    state.world.animals.push(animal);
    return animal;
  }

  function getAdminEntityLabel(entity) {
    if (!entity) return "object";
    if (entity.kind === "tree") return "Tree";
    if (entity.kind === "rock") return "Rock";
    if (entity.kind === "animal") return entity.species === "boar" ? "Boar" : "Deer";
    if (entity.kind === "civilian") return "Civilian";
    return getSelectionEntityName(entity) || entity.itemId || entity.role || entity.kind;
  }

  function findAdminEraseTarget(x, y) {
    const collection = [
      ...state.world.buildings,
      ...state.world.units,
      ...state.world.trees,
      ...state.world.rocks,
      ...state.world.animals,
      ...state.world.civilians,
    ];
    return findNearest(collection, x, y, (entity) => Math.hypot(entity.x - x, entity.y - y) <= (entity.radius || 12) + 34);
  }

  function applyAdminToolAt(x, y) {
    const tool = state.admin.activeTool;
    if (!tool) {
      setAdminStatus("Arm an admin tool first.");
      playUiSound("error", { volume: 0.66, cooldown: 0.05 });
      return { success: false, consumed: false };
    }
    if (isLanClient()) {
      setAdminStatus("Admin edits are host-only during LAN matches.");
      addAdminLog("Blocked admin edit on LAN guest.", { command: tool.command, x, y });
      playUiSound("error", { volume: 0.66, cooldown: 0.05 });
      syncAdminUi();
      return { success: false, consumed: true };
    }

    const owner = tool.usesOwner ? getAdminOwner() : "";
    if (tool.kind === "resource") {
      const entity = tool.resourceKind === "tree"
        ? createAdminTree(x, y, tool)
        : createAdminRock(x, y, tool);
      addAdminPoint({ x, y, label: tool.label, owner, tint: tool.color, detail: `${entity.kind} placed` });
      addAdminLog("Placed admin resource.", { command: tool.command, x, y, extra: tool.label });
      setAdminStatus(`${tool.label} placed at (${Math.round(x)}, ${Math.round(y)}).`);
      playWorldSound(tool.resourceKind === "tree" ? "harvestWood" : "harvestStone", x, y, { cooldown: 0.04, volume: 0.56 });
      return { success: true, consumed: true };
    }

    if (tool.kind === "civilian") {
      createAdminCivilian(owner || "neutral", x, y);
      addAdminPoint({ x, y, label: tool.label, owner: owner || "neutral", tint: tool.color, detail: "civilian spawned" });
      addAdminLog("Spawned civilian.", { command: tool.command, x, y, owner: owner || "neutral" });
      setAdminStatus(`Civilian spawned for ${owner || "neutral"} at (${Math.round(x)}, ${Math.round(y)}).`);
      playWorldSound("deployUnit", x, y, { cooldown: 0.04, volume: 0.52 });
      return { success: true, consumed: true };
    }

    if (tool.kind === "animal") {
      createAdminAnimal(tool.species, x, y);
      addAdminPoint({ x, y, label: tool.label, tint: tool.color, detail: "animal spawned" });
      addAdminLog("Spawned animal.", { command: tool.command, x, y, extra: tool.label });
      setAdminStatus(`${tool.label} spawned at (${Math.round(x)}, ${Math.round(y)}).`);
      playWorldSound("deployUnit", x, y, { cooldown: 0.04, volume: 0.48 });
      return { success: true, consumed: true };
    }

    if (tool.kind === "biome") {
      const tile = getTileAtWorld(x, y);
      if (!tile) {
        setAdminStatus("That point is outside the battlefield.");
        playUiSound("error", { volume: 0.66, cooldown: 0.05 });
        return { success: false, consumed: true };
      }
      tile.biome = tool.biome;
      renderTerrainCache();
      addAdminPoint({ x: tile.x, y: tile.y, label: tool.label, tint: tool.color, detail: `tile ${tile.gx},${tile.gy}` });
      addAdminLog("Painted admin biome.", { command: tool.command, x: tile.x, y: tile.y, extra: `tile=${tile.gx},${tile.gy}` });
      setAdminStatus(`${tool.label} painted on tile ${tile.gx}, ${tile.gy}.`);
      playUiSound("panelOpen", { volume: 0.42, cooldown: 0.05 });
      return { success: true, consumed: true };
    }

    if (tool.kind === "erase") {
      const target = findAdminEraseTarget(x, y);
      if (target) {
        if (isResourceNode(target)) removeResourceNode(target);
        else removeEntity(target);
        const label = getAdminEntityLabel(target);
        addAdminPoint({ x, y, label: "Erase", tint: tool.color, detail: `removed ${label}` });
        addAdminLog("Erased map object.", { command: tool.command, x, y, extra: label });
        setAdminStatus(`${label} erased.`);
        playWorldSound("impactBlast", x, y, { cooldown: 0.04, volume: 0.46 });
        return { success: true, consumed: true };
      }
      const tile = getTileAtWorld(x, y);
      if (tile && tile.biome !== "meadow") {
        const previous = tile.biome;
        tile.biome = "meadow";
        renderTerrainCache();
        addAdminPoint({ x: tile.x, y: tile.y, label: "Erase", tint: tool.color, detail: `tile reset from ${previous}` });
        addAdminLog("Reset painted tile.", { command: tool.command, x: tile.x, y: tile.y, extra: previous });
        setAdminStatus(`Tile reset from ${terrainEffects[previous].label} to Meadow.`);
        playUiSound("clear", { volume: 0.4, cooldown: 0.05 });
        return { success: true, consumed: true };
      }
      setAdminStatus("Nothing close enough to erase.");
      playUiSound("error", { volume: 0.66, cooldown: 0.05 });
      return { success: false, consumed: true };
    }

    if (tool.kind === "asset") {
      for (const building of state.world.buildings) {
        if (Math.hypot(building.x - x, building.y - y) < building.radius + TILE_SIZE * tool.item.footprint * 0.4) {
          setAdminStatus(`${tool.item.name} overlaps another building here.`);
          addAdminLog("Blocked admin building placement.", { command: tool.command, x, y, owner, extra: "overlap" });
          playUiSound("error", { volume: 0.66, cooldown: 0.05 });
          return { success: false, consumed: true };
        }
      }
      spawnBuilding(owner || "neutral", tool.item.id, x, y, 0, { manualPlacement: isHumanOwner(owner) });
      addAdminPoint({ x, y, label: tool.item.name, owner, tint: tool.color, detail: "building placed" });
      addAdminLog("Placed admin building.", { command: tool.command, x, y, owner, extra: tool.item.id });
      setAdminStatus(`${tool.item.name} placed for ${owner}.`);
      playWorldSound("deployStructure", x, y, { cooldown: 0.04, volume: 0.66 });
      return { success: true, consumed: true };
    }

    if (tool.kind === "weapon") {
      if (tool.item.type === "ability") {
        resolveAbility(tool.item, x, y, owner || "neutral");
      } else if (tool.item.type === "deployable" && tool.item.id === "machine_gun") {
        const bunker = spawnBuilding(owner || "neutral", "bunker", x, y, 0, { manualPlacement: isHumanOwner(owner) });
        if (bunker) {
          bunker.hp = tool.item.hp;
          bunker.maxHp = tool.item.hp;
          bunker.armor = tool.item.armor;
        }
      } else {
        spawnWeaponUnit(owner || "neutral", tool.item, x + randomRange(x, -12, 12), y + randomRange(y, -12, 12));
      }
      addAdminPoint({ x, y, label: tool.item.name, owner, tint: tool.color, detail: tool.item.type });
      addAdminLog("Placed admin weapon.", { command: tool.command, x, y, owner, extra: tool.item.id });
      setAdminStatus(`${tool.item.name} placed for ${owner}.`);
      playWorldSound(tool.item.type === "ability" ? "deployAbility" : "deployUnit", x, y, { cooldown: 0.04, volume: 0.64 });
      return { success: true, consumed: true };
    }

    return { success: false, consumed: true };
  }

  function handleAdminPlacement(worldX, worldY) {
    if (!state.admin.panelOpen || !state.admin.activeTool) return false;
    const result = applyAdminToolAt(worldX, worldY);
    if (result && result.success && isLanHost()) pushLanSnapshot();
    syncAdminUi();
    return Boolean(result && result.consumed);
  }

  function isPlacementBlocked(item, x, y) {
    return Boolean(getPlacementBlockReason(item, x, y));
  }

  function spawnWeaponUnit(owner, item, x, y) {
    const template = {
      hp: item.hp,
      speed: item.speed || 60,
      damage: item.damage || 0,
      range: item.range || 0,
      cooldown: item.cooldown || 0.8,
      armor: item.armor || "steel",
      radius: item.type === "vehicle" ? 15 : 12,
      projectile: item.projectile || null,
      splash: item.splash || 0,
      type: item.type === "vehicle" ? "vehicle" : "infantry",
    };
    roleTemplates[item.role] = template;
    const unit = spawnUnit(owner, item.role, x, y, { value: item.cost });
    unit.displayName = item.name;
    if (hoverRoles.has(item.role)) unit.hover = true;
    if (airborneRoles.has(item.role)) unit.airborne = true;
    if (item.role === "copter" || item.role === "gunship") {
      unit.airborne = true;
      unit.z = 26;
    }
    if (item.role === "stealthDrone") {
      unit.airborne = true;
      unit.z = 18;
    }
    return unit;
  }

  function healCircle(x, y, radius, amount, owner) {
    let healed = 0;
    for (const entity of [...state.world.units, ...state.world.buildings]) {
      if (!entity.owner || !areOwnersAllied(entity.owner, owner)) continue;
      if (Math.hypot(entity.x - x, entity.y - y) > radius + (entity.radius || 0)) continue;
      if (entity.hp >= entity.maxHp) continue;
      entity.hp = Math.min(entity.maxHp, entity.hp + amount);
      entity.lastHitTimer = Math.max(entity.lastHitTimer || 0, 0.08);
      if (entity.kind === "unit") entity.empTimer = Math.max(0, (entity.empTimer || 0) - 2);
      healed += 1;
      spawnEffect("repair", entity.x, entity.y, Math.max(12, (entity.radius || 12) * 0.6), "#8affd9", 0.18);
    }
    return healed;
  }

  function getDamageTint(entity) {
    if (!entity) return "#ffe29a";
    if (entity.kind === "building") return entity.armor === "stone" || entity.armor === "steel" ? "#d7ecff" : "#ffd3ad";
    if (entity.armor === "steel" || entity.armor === "stone" || entity.armor === "plate") return "#d7ecff";
    if (entity.kind === "animal") return "#ffbe93";
    return "#ffb3a1";
  }

  function applyImpactKick(entity, nx, ny, force = 0) {
    if (!entity || force <= 0) return;
    if (entity.kind === "animal") {
      entity.vx = (entity.vx || 0) + nx * force;
      entity.vy = (entity.vy || 0) + ny * force;
      entity.fleeTimer = Math.max(entity.fleeTimer || 0, 2.4);
      return;
    }
    if (entity.kind !== "unit" || entity.airborne) return;
    entity.vx += nx * force;
    entity.vy += ny * force;
  }

  function damageCircle(x, y, radius, damage, owner, projectileType, armorPierce = 1) {
    const hits = [];
    for (const entity of [...state.world.units, ...state.world.buildings, ...state.world.animals]) {
      if (entity.owner === owner) continue;
      const d = Math.hypot(entity.x - x, entity.y - y);
      if (d > radius + (entity.radius || 0)) continue;
      const falloff = clamp(1 - d / radius, 0.2, 1);
      const dealt = applyDamage(entity, damage * falloff, projectileType, owner, armorPierce);
      const n = normalize(entity.x - x, entity.y - y);
      const blastForce = projectileType === "rocket" || projectileType === "missile" ? 150 : projectileType === "shell" || projectileType === "mortar" || projectileType === "boulder" ? 120 : projectileType === "pulse" ? 96 : 72;
      applyImpactKick(entity, n.x, n.y, blastForce * falloff);
      hits.push({ entity, damage: dealt, distance: d });
    }
    return hits;
  }

  function pushUnitFromCircle(unit, obstacle, padding = 0) {
    if (unit.hover || unit.airborne) return;
    const dx = unit.x - obstacle.x;
    const dy = unit.y - obstacle.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const minDist = unit.radius + obstacle.radius + padding;
    if (d >= minDist) return;
    const push = minDist - d;
    unit.x += (dx / d) * push;
    unit.y += (dy / d) * push;
    if (unit.moveTarget && Math.hypot(unit.moveTarget.x - obstacle.x, unit.moveTarget.y - obstacle.y) < obstacle.radius + 14) {
      unit.moveTarget = {
        x: unit.moveTarget.x + (dx / d) * Math.min(42, push + 10),
        y: unit.moveTarget.y + (dy / d) * Math.min(42, push + 10),
      };
    }
  }

  function resolveAbility(item, x, y, owner) {
    if (item.id === "carpet_bomb") {
      const angle = randomRange(x + y + state.time, -Math.PI, Math.PI);
      for (let i = -3; i <= 3; i += 1) {
        const ox = x + Math.cos(angle) * i * 44 + randomRange(i * 31 + x, -18, 18);
        const oy = y + Math.sin(angle) * i * 44 + randomRange(i * 27 + y, -18, 18);
        damageCircle(ox, oy, item.blast * 0.46, item.damage, owner, "rocket");
        spawnEffect("blast", ox, oy, 58, "#ffb469", 0.84);
        spawnEffect("smoke", ox, oy, 44, "rgba(68,58,48,0.58)", 1.08);
        playWorldSound("impactBlast", ox, oy, { cooldown: 0.1, volume: 0.92 });
      }
      return;
    }
    if (item.id === "orbital_laser") {
      damageCircle(x, y, item.blast * 0.7, item.damage, owner, "pulse", 1.35);
      damageCircle(x, y, item.blast * 0.38, item.damage * 0.55, owner, "pulse", 1.6);
      spawnEffect("emp", x, y, item.blast, "#7ef7ff", 1.15);
      spawnEffect("impact", x, y, item.blast * 0.55, "#f1fcff", 0.5);
      notify("Orbital beam locked on target.", "#9fe8ff");
      playWorldSound("impactPulse", x, y, { cooldown: 0.16, volume: 1.02 });
      return;
    }
    if (item.id === "nano_swarm") {
      const healed = healCircle(x, y, item.blast, 120, owner);
      damageCircle(x, y, item.blast * 0.7, item.damage, owner, "pulse");
      spawnEffect("repair", x, y, item.blast * 0.54, "#8affd9", 0.9);
      spawnEffect("emp", x, y, item.blast * 0.7, "#7ef7ff", 0.75);
      notify(healed ? `Nano swarm repaired ${healed} allied targets.` : "Nano swarm released over the combat zone.", "#8affd9");
      playWorldSound("repair", x, y, { cooldown: 0.16, volume: 0.9 });
      return;
    }
    if (item.id === "gravity_bomb") {
      damageCircle(x, y, item.blast, item.damage, owner, "pulse", 1.12);
      for (const unit of state.world.units) {
        if (!unit.owner || areOwnersAllied(unit.owner, owner)) continue;
        if (Math.hypot(unit.x - x, unit.y - y) <= item.blast) {
          unit.empTimer = Math.max(unit.empTimer || 0, 5);
          const pull = normalize(x - unit.x, y - unit.y);
          unit.vx += pull.x * 90;
          unit.vy += pull.y * 90;
        }
      }
      spawnEffect("emp", x, y, item.blast, "#b0c6ff", 1.15);
      spawnEffect("blast", x, y, item.blast * 0.42, "#c8d4ff", 0.92);
      playWorldSound("impactPulse", x, y, { cooldown: 0.14, volume: 1 });
      return;
    }
    if (item.id === "cluster_bomb") {
      for (let i = 0; i < item.shards; i += 1) {
        const ox = x + randomRange(i * 20 + x, -92, 92);
        const oy = y + randomRange(i * 17 + y, -92, 92);
        damageCircle(ox, oy, item.blast * 0.4, item.damage, owner, "rocket");
        spawnEffect("blast", ox, oy, 54, "#ffbf69", 0.9);
        spawnEffect("smoke", ox, oy, 42, "rgba(61,53,48,0.58)", 1.15);
        playWorldSound("impactBlast", ox, oy, { cooldown: 0.1, volume: 0.88 });
      }
      return;
    }
    if (item.id === "emp_burst") {
      damageCircle(x, y, item.blast, item.damage, owner, "pulse");
      for (const unit of state.world.units) {
        if (unit.owner === owner) continue;
        if (Math.hypot(unit.x - x, unit.y - y) <= item.blast) {
          unit.speed *= item.slow;
          unit.empTimer = 7;
        }
      }
      spawnEffect("emp", x, y, item.blast, "#7ef7ff", 1.2);
      playWorldSound("impactPulse", x, y, { cooldown: 0.14, volume: 0.9 });
      return;
    }
    if (item.id === "nuke") {
      damageCircle(x, y, item.blast, item.damage, owner, "rocket", item.armorPierce || 1.8);
      spawnEffect("nuke", x, y, item.blast, "#fff4b2", 2.6);
      spawnEffect("smoke", x, y, item.blast * 0.62, "rgba(72,64,60,0.78)", 2.9);
      spawnEffect("blast", x, y, item.blast * 0.52, "#ffcf8f", 1.4);
      notify("Tactical nuke detonated.", "#ffdd85");
      playWorldSound("impactBlast", x, y, { cooldown: 0.24, volume: 1.2 });
      return;
    }
    damageCircle(x, y, item.blast, item.damage, owner, item.id === "bunker_buster" ? "shell" : "rocket", item.armorPierce || 1);
    spawnEffect("blast", x, y, item.blast * 0.48, item.id === "bomb_strike" ? "#f6b36d" : "#ff8d6d", 1.0);
    spawnEffect("smoke", x, y, item.blast * 0.38, "rgba(63,58,54,0.55)", 1.2);
    playWorldSound("impactBlast", x, y, { cooldown: 0.14, volume: item.id === "bunker_buster" ? 1.02 : 0.92 });
  }

  function deployPlacement(item, x, y, owner = "player") {
    if (!item || !canAfford(item.id, owner)) {
      notify("Not enough coins for that deployment.", "#ff8e85");
      playUiSound("error", { volume: 0.72, cooldown: 0.08 });
      return false;
    }
    const blockReason = item.type === "ability" ? null : getPlacementBlockReason(item, x, y, owner);
    if (blockReason) {
      notify(blockReason, "#ff8e85");
      playUiSound("error", { volume: 0.72, cooldown: 0.08 });
      return false;
    }
    if (assetCatalog.includes(item)) {
      spendCoins(item.cost, owner);
      spawnBuilding(owner, item.id, x, y, 0, { manualPlacement: true });
      incrementQuest("build", 1);
      notify(`${item.name} deployed.`, "#7df2ab");
      playWorldSound("deployStructure", x, y, { cooldown: 0.08, volume: 0.82 });
      return true;
    }
    if (item.type === "ability") {
      spendCoins(item.cost, owner);
      resolveAbility(item, x, y, owner);
      notify(`${item.name} deployed.`, "#7df2ab");
      playWorldSound("deployAbility", x, y, { cooldown: 0.1, volume: 0.92 });
      return true;
    }
    if (item.type === "deployable" && item.id === "machine_gun") {
      spendCoins(item.cost, owner);
      const bunker = spawnBuilding(owner, "bunker", x, y);
      bunker.hp = item.hp;
      bunker.maxHp = item.hp;
      bunker.armor = item.armor;
      notify(`${item.name} entrenched.`, "#7df2ab");
      playWorldSound("deployStructure", x, y, { cooldown: 0.08, volume: 0.78 });
      return true;
    }
    spendCoins(item.cost, owner);
    spawnWeaponUnit(owner, item, x + randomRange(x, -18, 18), y + randomRange(y, -18, 18));
    notify(`${item.name} deployed.`, "#7df2ab");
    playWorldSound("deployUnit", x, y, { cooldown: 0.06, volume: 0.74 });
    return true;
  }

  function applyDamage(entity, rawDamage, projectileType, owner, armorPierce = 1) {
    const modifier = getArmorModifier(entity.armor || "flesh", projectileType || "melee");
    const damage = rawDamage * modifier * armorPierce;
    entity.hp -= damage;
    entity.lastHitTimer = 0.2;
    entity.lastCombatTimer = Math.max(entity.lastCombatTimer || 0, 2.4);
    spawnEffect("impact", entity.x, entity.y - Math.max(4, (entity.radius || 12) * 0.16), Math.max(10, (entity.radius || 12) * 0.7), getDamageTint(entity), 0.16);
    spawnDamageText(entity.x, entity.y - Math.max(12, (entity.radius || 12) * 0.75), damage, getDamageTint(entity));
    if (entity.kind === "animal") entity.fleeTimer = 3;
    if (entity.hp <= 0) killEntity(entity, owner);
    return damage;
  }

  function killEntity(entity, owner) {
    if (entity.kind === "animal") {
      addCoins(owner, 20);
      incrementQuest("harvest", 1);
      notify("Hunt secured: +20 coins", "#7df2ab");
    } else if (entity.kind === "unit" && entity.owner && entity.owner !== owner && isHumanOwner(owner)) {
      addCoins(owner, 24);
      incrementQuest("kills", 1);
      notify("Enemy destroyed: +24 coins", "#7df2ab");
    } else if (entity.kind === "building" && entity.owner && entity.owner !== owner && isHumanOwner(owner)) {
      addCoins(owner, 90);
      notify(`Enemy ${entity.def.name} destroyed: +90 coins`, "#7df2ab");
    }
    maybeSpawnRareDrop(entity, owner);
    spawnEffect("debris", entity.x, entity.y, (entity.radius || 16) * 1.4, ownerColors[entity.owner] || "#f2f2f2", 0.8);
    spawnEffect("blast", entity.x, entity.y, (entity.radius || 16) * 0.9, "#ffb97a", 0.42);
    spawnEffect("smoke", entity.x, entity.y, (entity.radius || 16) * 1.8, "rgba(45,50,58,0.7)", 1.3);
    playWorldSound("impactBlast", entity.x, entity.y, { cooldown: 0.09, volume: entity.kind === "building" ? 1 : 0.82 });
    removeEntity(entity);
  }

  function findNearest(collection, x, y, predicate = () => true) {
    let best = null;
    let bestDistance = Infinity;
    for (const entry of collection) {
      if (!predicate(entry)) continue;
      const d = Math.hypot(entry.x - x, entry.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        best = entry;
      }
    }
    return best;
  }

  function isEnemy(a, b) {
    return a && b && a.owner && b.owner && a.owner !== "neutral" && b.owner !== "neutral" && !areOwnersAllied(a.owner, b.owner);
  }

  function updateCivilian(civilian, dt) {
    civilian.lastTaxedTimer = Math.max(0, (civilian.lastTaxedTimer || 0) - dt);
    civilian.coinPouch = Math.min(civilian.maxCoinPouch || 0, (civilian.coinPouch || 0) + dt * 0.95);
    const terrainMove = getTerrainMoveMultiplier(civilian);
    civilian.wanderTimer -= dt;
    if (civilian.wanderTimer <= 0) {
      civilian.wanderTimer = randomRange(civilian.x + civilian.y, 1.6, 4.2);
      const targetX = civilian.homeX + randomRange(civilian.x * 0.1 + civilian.y, -90, 90);
      const targetY = civilian.homeY + randomRange(civilian.x * 0.2 + civilian.y, -90, 90);
      const n = normalize(targetX - civilian.x, targetY - civilian.y);
      civilian.vx = n.x * 24 * terrainMove;
      civilian.vy = n.y * 24 * terrainMove;
    }
    civilian.x += civilian.vx * dt;
    civilian.y += civilian.vy * dt;
    civilian.vx *= 0.92;
    civilian.vy *= 0.92;
  }

  function updateResourceNodes(dt) {
    for (const resource of [...state.world.trees, ...state.world.rocks]) {
      resource.lastWorkedTimer = Math.max(0, (resource.lastWorkedTimer || 0) - dt);
    }
  }

  function updateAnimal(animal, dt) {
    const terrainMove = getTerrainMoveMultiplier(animal);
    animal.wanderTimer -= dt;
    animal.fleeTimer = Math.max(0, animal.fleeTimer - dt);
    if (animal.fleeTimer > 0) {
      const threat = findNearest(state.world.units, animal.x, animal.y, (unit) => isHumanOwner(unit.owner) && Math.hypot(unit.x - animal.x, unit.y - animal.y) < 260);
      if (threat) {
        const n = normalize(animal.x - threat.x, animal.y - threat.y);
        animal.vx += n.x * 44 * terrainMove;
        animal.vy += n.y * 44 * terrainMove;
      }
    } else if (animal.wanderTimer <= 0) {
      animal.wanderTimer = randomRange(animal.x * 0.2 + animal.y, 1.2, 3.5);
      const angle = randomRange(animal.x + animal.y, -Math.PI, Math.PI);
      animal.vx = Math.cos(angle) * 20 * terrainMove;
      animal.vy = Math.sin(angle) * 20 * terrainMove;
    }
    animal.x = clamp(animal.x + animal.vx * dt, -HALF_WORLD + 80, HALF_WORLD - 80);
    animal.y = clamp(animal.y + animal.vy * dt, -HALF_WORLD + 80, HALF_WORLD - 80);
    animal.vx *= 0.95;
    animal.vy *= 0.95;
  }

  function getProductionMultiplier(owner) {
    let multiplier = 1;
    if (isHumanOwner(owner)) {
      for (const building of state.world.buildings) {
        if (building.owner !== owner) continue;
        if (building.itemId === "refinery") multiplier += 0.08;
        if (building.itemId === "command_hall") multiplier += 0.05;
        if (building.itemId === "war_foundry") multiplier += 0.12;
        if (building.itemId === "storm_generator") multiplier += 0.06;
      }
    }
    return multiplier;
  }

  function updateBuilding(building, dt) {
    building.lastHitTimer = Math.max(0, (building.lastHitTimer || 0) - dt);
    building.lastCombatTimer = Math.max(0, (building.lastCombatTimer || 0) - dt);
    building.lastTaxedTimer = Math.max(0, (building.lastTaxedTimer || 0) - dt);
    const terrainMultiplier = getTerrainStructureMultiplier(building);
    const terrainDamage = getTerrainAttrition(building, dt);
    if (terrainDamage > 0 && building.hp > 1) {
      building.hp = Math.max(1, building.hp - terrainDamage);
      building.lastHitTimer = Math.max(building.lastHitTimer || 0, 0.08);
    }
    if (building.owner === "neutral" && building.maxTaxReserve) {
      const reserveRate = 0.7 + getNearbyCivilianCount(building.x, building.y, 200) * 0.18 + (building.itemId === "market" ? 0.45 : 0);
      building.taxReserve = Math.min(building.maxTaxReserve, building.taxReserve + dt * reserveRate);
    }
    const canProduce = isCompetitiveMatch()
      ? isHumanOwner(building.owner)
      : isCoopMatch()
        ? building.owner !== "neutral"
        : isHardModeActive()
          ? building.owner !== "neutral"
          : building.owner === "player";
    if (building.def.spawnRole && canProduce) {
      const hostilityRate = !isHumanOwner(building.owner) && isHardModeActive() ? 1.22 : 1;
      building.spawnCooldown -= dt * getProductionMultiplier(building.owner) * terrainMultiplier * hostilityRate;
      if (building.spawnCooldown <= 0) {
        building.spawnCooldown = building.def.spawnRate || 22;
        const spawnAngle = randomRange(building.x + building.y + state.time, 0, TAU);
        const unit = spawnUnit(
          building.owner,
          building.def.spawnRole,
          building.x + Math.cos(spawnAngle) * (building.radius + 28),
          building.y + Math.sin(spawnAngle) * (building.radius + 28),
        );
        if (!isHumanOwner(building.owner)) {
          if (isEasyModeActive()) {
            const home = getEnemyAiHome(building.owner) || building;
            unit.moveTarget = { x: home.x + randomRange(unit.x, -90, 90), y: home.y + randomRange(unit.y, -90, 90) };
            unit.order = "idle";
            unit.focusMove = false;
          } else {
            const enemyBase = getNearestHostileBase(building.owner, unit.x, unit.y);
            if (enemyBase) {
              unit.moveTarget = { x: enemyBase.x + randomRange(unit.x, -100, 100), y: enemyBase.y + randomRange(unit.y, -100, 100) };
              unit.order = "move";
            }
          }
        }
      }
    }

    if (building.def.gather && isHumanOwner(building.owner)) {
      building.gatherCooldown -= dt;
      if (building.gatherCooldown <= 0) {
        building.gatherCooldown = 5.5 / Math.max(0.5, terrainMultiplier);
        if (building.def.gather === "wood") {
          const nearby = findNearest(state.world.trees, building.x, building.y, (tree) => Math.hypot(tree.x - building.x, tree.y - building.y) < 280);
          if (nearby) harvestResourceNode(building.owner, nearby, 20, { showMessage: false, effectScale: 0.7 });
        } else {
          const nearby = findNearest(state.world.rocks, building.x, building.y, (rock) => Math.hypot(rock.x - building.x, rock.y - building.y) < 260);
          if (nearby) harvestResourceNode(building.owner, nearby, 20, { showMessage: false, effectScale: 0.7 });
        }
      }
    }

    if (building.def.attack) {
      building.attackCooldown -= dt;
      if (building.attackCooldown <= 0) {
        const rangeBoost = getTerrainAttackRangeBonus(building);
        const target = findNearest(
          [...state.world.units, ...state.world.buildings],
          building.x,
          building.y,
          (entity) => {
            if (shouldEnemyStandDown(building) && isHumanOwner(entity.owner)) return false;
            if (isEasyModeActive() && !isHumanOwner(building.owner) && isHumanOwner(entity.owner)) return false;
            return isEnemy(building, entity) && Math.hypot(entity.x - building.x, entity.y - building.y) <= (building.def.range || 260) * rangeBoost;
          },
        );
        if (target) {
          const damage = building.def.attack === "machine" ? 8 : building.def.attack === "bolt" ? 34 : building.def.attack === "shell" ? 70 : building.def.attack === "missile" ? 118 : building.def.attack === "pulse" ? 28 : building.def.attack === "mortar" ? 82 : 16;
          building.attackCooldown = 1 / (building.def.attackRate || 1.2);
          if (building.def.attack === "machine") {
            applyDamage(target, damage, "bullet", building.owner);
            spawnEffect("muzzle", building.x, building.y, 14, "#ffdb9d", 0.12);
            playWorldSound("bulletFire", building.x, building.y, { cooldown: 0.05, volume: 0.7 });
            playWorldSound("bulletImpact", target.x, target.y, { cooldown: 0.05, volume: 0.56 });
          } else {
            const projectileType = building.def.attack === "arrow" ? "arrow" : building.def.attack;
            const splash = building.def.attack === "mortar" ? 100 : building.def.attack === "missile" ? 90 : building.def.attack === "shell" ? 50 : 0;
            const speed = building.def.attack === "mortar" ? 270 : building.def.attack === "missile" ? 300 : 360;
            spawnProjectile(building, target, projectileType, damage, splash, speed);
          }
        }
      }
    }
  }

  function updateUnit(unit, dt) {
    unit.lastHitTimer = Math.max(0, unit.lastHitTimer - dt);
    unit.lastCombatTimer = Math.max(0, (unit.lastCombatTimer || 0) - dt);
    unit.empTimer = Math.max(0, unit.empTimer - dt);
    unit.attackCooldown -= dt;
    unit.interactCooldown = Math.max(0, (unit.interactCooldown || 0) - dt);
    const terrainMove = getTerrainMoveMultiplier(unit);
    const terrainDamage = getTerrainAttrition(unit, dt);
    if (terrainDamage > 0 && unit.hp > 1) {
      unit.hp = Math.max(1, unit.hp - terrainDamage);
      unit.lastHitTimer = Math.max(unit.lastHitTimer || 0, 0.08);
    }
    if (updateFirstPersonUnit(unit, dt, terrainMove)) return;

    if (!isHumanOwner(unit.owner)) {
      if (shouldEnemyStandDown(unit)) {
        unit.targetId = null;
        unit.moveTarget = null;
        unit.focusMove = false;
        unit.order = "idle";
      }
      unit.aiTimer -= dt;
      if (unit.aiTimer <= 0) {
        unit.aiTimer = randomRange(unit.x + unit.y + state.time, 0.4, 1.1);
        if (!unit.targetId && !shouldEnemyStandDown(unit)) {
          const target = findNearest([...state.world.units, ...state.world.buildings], unit.x, unit.y, (entity) => isEnemy(unit, entity));
          const aggroRange = isEasyModeActive() ? 180 : isHardModeActive() ? 560 : 420;
          if (target && Math.hypot(target.x - unit.x, target.y - unit.y) < aggroRange) {
            unit.targetId = target.id;
            unit.order = "attack";
          } else if (!unit.moveTarget) {
            if (isEasyModeActive()) {
              const home = getEnemyAiHome(unit.owner);
              if (home && Math.hypot(unit.x - home.x, unit.y - home.y) > 180) {
                unit.moveTarget = { x: home.x + randomRange(unit.x, -80, 80), y: home.y + randomRange(unit.y, -80, 80) };
                unit.order = "move";
                unit.focusMove = false;
              }
            } else {
              const enemyBase = getNearestHostileBase(unit.owner, unit.x, unit.y);
              if (enemyBase) {
                unit.moveTarget = { x: enemyBase.x + randomRange(unit.x, -120, 120), y: enemyBase.y + randomRange(unit.y, -120, 120) };
                unit.order = "move";
                unit.focusMove = true;
              }
            }
          }
        }
      }
    }

    unit.selected = getHumanPlayers().some((player) => player.selectedIds.has(unit.id));
    if (healerRoles.has(unit.role)) {
      const healTargets = unit.role === "repair" ? [...state.world.units, ...state.world.buildings] : state.world.units;
      const ally = findNearest(
        healTargets,
        unit.x,
        unit.y,
        (entity) => entity.owner === unit.owner && entity.hp < entity.maxHp && entity.id !== unit.id,
      );
      if (ally) {
        const d = Math.hypot(ally.x - unit.x, ally.y - unit.y);
        if (d <= unit.range) {
          ally.hp = Math.min(ally.maxHp, ally.hp + unit.healAmount * dt);
          spawnEffect("repair", ally.x, ally.y, ally.radius * 0.6, "#8affd9", 0.16);
        } else {
          unit.moveTarget = { x: ally.x, y: ally.y };
        }
      }
    }

    if (unit.interactTargetId) {
      const interactionTarget = getInteractionTargetById(unit.interactTargetId, unit.interactKind);
      if (!interactionTarget) {
        clearInteractionOrder(unit);
        if (!unit.targetId && !unit.moveTarget) unit.order = "idle";
      } else {
        const interactionRange = (interactionTarget.radius || 12) + unit.radius + (unit.interactKind === "tax" ? 12 : 16);
        const distanceToTarget = Math.hypot(interactionTarget.x - unit.x, interactionTarget.y - unit.y);
        if (distanceToTarget <= interactionRange) {
          unit.moveTarget = null;
          unit.focusMove = false;
          unit.vx *= 0.84;
          unit.vy *= 0.84;
          unit.angle = angleLerp(unit.angle, Math.atan2(interactionTarget.y - unit.y, interactionTarget.x - unit.x), 0.18);
          if (unit.interactCooldown <= 0) {
            unit.interactCooldown = unit.interactKind === "tax" ? 1.05 : 0.74;
            if (unit.interactKind === "resource") {
              const result = harvestResourceNode(unit.owner, interactionTarget, getResourceWorkRate(unit), { showMessage: true });
              spawnEffect("slash", interactionTarget.x, interactionTarget.y, interactionTarget.radius * 0.56, ownerColors[unit.owner] || "#8de7b8", 0.18);
              if (result.depleted) clearInteractionOrder(unit);
            } else {
              const payout = applyTaxCollection(unit.owner, interactionTarget, { showMessage: true });
              if (!payout || getTaxReserve(interactionTarget) < 1) clearInteractionOrder(unit);
            }
          }
          unit.order = unit.interactKind === "resource" ? "harvest" : "collect";
        } else {
          unit.moveTarget = { x: interactionTarget.x, y: interactionTarget.y };
          unit.focusMove = true;
          unit.order = unit.interactKind === "resource" ? "harvest" : "collect";
        }
      }
    }

    if (unit.targetId) {
      const target = getEntityById(unit.targetId);
      if (!target || !isEnemy(unit, target) || (shouldEnemyStandDown(unit) && isHumanOwner(target.owner)) || (isEasyModeActive() && !isHumanOwner(unit.owner) && isHumanOwner(target.owner))) {
        unit.targetId = null;
        unit.order = unit.moveTarget ? "move" : "idle";
      } else {
        const attackRange = getAttackRange(unit) * getTerrainAttackRangeBonus(unit);
        const d = Math.hypot(target.x - unit.x, target.y - unit.y);
          if (d <= attackRange + target.radius + 6) {
          unit.vx *= 0.84;
          unit.vy *= 0.84;
          unit.moveTarget = null;
          unit.focusMove = false;
            if (unit.attackCooldown <= 0) {
              unit.angle = Math.atan2(target.y - unit.y, target.x - unit.x);
              unit.attackCooldown = unit.cooldown || 0.8;
              if (unit.projectile) {
                spawnProjectile(unit, target, unit.projectile, getAttackDamage(unit), unit.splash || 0, unit.projectile === "rocket" ? 280 : 380);
                spawnEffect("muzzle", unit.x, unit.y, unit.radius * 0.95, "#ffd6a7", 0.18);
              } else {
                applyDamage(target, getAttackDamage(unit), "melee", unit.owner);
                spawnEffect("slash", target.x, target.y, target.radius, ownerColors[unit.owner], 0.2);
                playWorldSound("meleeHit", target.x, target.y, { cooldown: 0.06, volume: 0.72 });
              }
            }
        } else {
          unit.moveTarget = { x: target.x, y: target.y };
          unit.focusMove = false;
        }
      }
    }

    if (unit.moveTarget) {
      const n = normalize(unit.moveTarget.x - unit.x, unit.moveTarget.y - unit.y);
      const desiredSpeed = unit.speed * terrainMove * (unit.empTimer > 0 ? 0.55 : 1);
      unit.vx += n.x * desiredSpeed * dt * 4.2;
      unit.vy += n.y * desiredSpeed * dt * 4.2;
      unit.angle = angleLerp(unit.angle, Math.atan2(n.y, n.x), 0.12);
      if (n.d < 22) {
        unit.moveTarget = null;
        unit.focusMove = false;
        if (!unit.targetId) unit.order = "idle";
      }
    }

    for (const other of state.world.units) {
      if (other.id === unit.id) continue;
      const dx = unit.x - other.x;
      const dy = unit.y - other.y;
      const d = Math.hypot(dx, dy);
      const minDist = unit.radius + other.radius + 4;
      if (d > 0 && d < minDist) {
        const push = (minDist - d) / minDist;
        unit.vx += (dx / d) * push * 38 * dt;
        unit.vy += (dy / d) * push * 38 * dt;
      }
    }

    for (const building of state.world.buildings) {
      const dx = unit.x - building.x;
      const dy = unit.y - building.y;
      const d = Math.hypot(dx, dy);
      const minDist = unit.radius + building.radius + (building.def.style === "wall" || building.def.style === "capital-wall" || building.def.style === "gate" ? 10 : 2);
      if (d > 0 && d < minDist && !(unit.hover || unit.airborne)) {
        unit.vx += (dx / d) * (minDist - d) * 2.8;
        unit.vy += (dy / d) * (minDist - d) * 2.8;
      }
    }

    const maxSpeed = unit.speed * terrainMove * (unit.airborne ? 1.1 : 1);
    const velocity = Math.hypot(unit.vx, unit.vy);
    if (velocity > maxSpeed) {
      unit.vx = (unit.vx / velocity) * maxSpeed;
      unit.vy = (unit.vy / velocity) * maxSpeed;
    }
    unit.x = clamp(unit.x + unit.vx * dt, -HALF_WORLD + 60, HALF_WORLD - 60);
    unit.y = clamp(unit.y + unit.vy * dt, -HALF_WORLD + 60, HALF_WORLD - 60);
    for (const tree of state.world.trees) pushUnitFromCircle(unit, tree, 8);
    for (const rock of state.world.rocks) pushUnitFromCircle(unit, rock, 7);
    for (const building of state.world.buildings) {
      const padding = building.def.style === "wall" || building.def.style === "capital-wall" || building.def.style === "gate" ? 12 : 4;
      pushUnitFromCircle(unit, building, padding);
    }
    unit.vx *= 0.9;
    unit.vy *= 0.9;

    if (isHumanOwner(unit.owner) && !unit.targetId && !unit.focusMove && !unit.interactTargetId) {
      const autoRange = getAttackRange(unit) + 120;
      const enemy = findNearest([...state.world.units, ...state.world.buildings, ...state.world.animals], unit.x, unit.y, (entity) => {
        if (entity.kind === "animal") return Math.hypot(entity.x - unit.x, entity.y - unit.y) < autoRange * 0.8;
        return isEnemy(unit, entity) && Math.hypot(entity.x - unit.x, entity.y - unit.y) < autoRange;
      });
      if (enemy) {
        unit.targetId = enemy.id;
        unit.order = "attack";
      }
    }
  }

  function updateProjectile(projectile, dt) {
    projectile.ttl -= dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.z = Math.max(0, projectile.z + projectile.vz * dt);
    if (projectile.vz) projectile.vz -= 220 * dt;
    const nearTarget = Math.hypot(projectile.x - projectile.targetX, projectile.y - projectile.targetY) < 26;
    if (projectile.ttl <= 0 || nearTarget) {
      if (projectile.splash) {
        const splashHits = damageCircle(projectile.x, projectile.y, projectile.splash, projectile.damage, projectile.owner, projectile.projectileType);
        for (const hit of splashHits) registerFirstPersonHit(projectile.owner, hit.entity, hit.damage, projectile.projectileType);
      } else {
        const target = findNearest([...state.world.units, ...state.world.buildings], projectile.x, projectile.y, (entity) => entity.owner !== projectile.owner);
        if (target && Math.hypot(target.x - projectile.x, target.y - projectile.y) < target.radius + 24) {
          const dealt = applyDamage(target, projectile.damage, projectile.projectileType, projectile.owner);
          const n = normalize(projectile.vx, projectile.vy);
          const hitForce = projectile.projectileType === "rocket" || projectile.projectileType === "missile" ? 130 : projectile.projectileType === "shell" || projectile.projectileType === "mortar" || projectile.projectileType === "boulder" ? 96 : projectile.projectileType === "pulse" ? 74 : 54;
          applyImpactKick(target, n.x, n.y, hitForce);
          registerFirstPersonHit(projectile.owner, target, dealt, projectile.projectileType);
        }
      }
      const impactRadius = projectile.splash ? projectile.splash * 0.45 : 20;
      spawnEffect("impact", projectile.x, projectile.y, impactRadius, projectile.projectileType === "pulse" ? "#7ef7ff" : "#ffc48a", 0.38);
      spawnEffect("smoke", projectile.x, projectile.y, impactRadius * 0.9, "rgba(48,52,58,0.65)", 0.9);
      if (projectile.projectileType === "rocket" || projectile.projectileType === "missile") {
        spawnEffect("blast", projectile.x, projectile.y, impactRadius * 1.2, "#ffb97a", 0.55);
        spawnEffect("smoke", projectile.x, projectile.y, impactRadius * 1.3, "rgba(76,60,52,0.56)", 1.1);
      }
      const impactSfx = getProjectileImpactSfx(projectile.projectileType, projectile.splash);
      playWorldSound(impactSfx.name, projectile.x, projectile.y, { cooldown: impactSfx.cooldown, volume: impactSfx.volume });
      const idx = state.world.projectiles.findIndex((entry) => entry.id === projectile.id);
      if (idx >= 0) state.world.projectiles.splice(idx, 1);
    }
  }

  function updateEffects(dt) {
    for (let i = state.world.effects.length - 1; i >= 0; i -= 1) {
      const effect = state.world.effects[i];
      effect.ttl -= dt;
      effect.rotation = (effect.rotation || 0) + dt * (effect.spin || 0);
      if (effect.type === "damageText") {
        effect.y -= (effect.rise || 22) * dt;
        effect.x += (effect.driftX || 0) * dt * 0.45;
      }
      effect.shards = effect.shards || [];
      for (const shard of effect.shards) {
        shard.vx *= 0.986;
        shard.vy *= 0.986;
        shard.x += shard.vx * dt;
        shard.y += shard.vy * dt;
        shard.size *= 0.992;
      }
      if (effect.ttl <= 0) state.world.effects.splice(i, 1);
    }
  }

  function updateNotifications(dt) {
    for (let i = state.world.notifications.length - 1; i >= 0; i -= 1) {
      state.world.notifications[i].ttl -= dt;
      if (state.world.notifications[i].ttl <= 0) state.world.notifications.splice(i, 1);
    }
  }

  function getPassiveIncomeForOwner(owner) {
    const ownedBuildings = state.world.buildings.filter((building) => building.owner === owner);
    let income = 0;
    let multiplier = 1;
    for (const building of ownedBuildings) {
      if (building.def.tax) income += building.def.tax;
      if (building.def.taxBoost) multiplier += (building.def.taxBoost - 1) * 0.35;
      if (!ownedEconomyBuildingIds.has(building.itemId)) continue;
      const nearbyOwned = ownedBuildings.filter((entry) => entry.id !== building.id && Math.hypot(entry.x - building.x, entry.y - building.y) < 320);
      const nearbyVillagers = state.world.units.filter((unit) => unit.owner === owner && (unit.role === "villager" || unit.role === "engineer") && Math.hypot(unit.x - building.x, unit.y - building.y) < 240).length;
      if (building.itemId === "market") income += 12 + nearbyOwned.filter((entry) => entry.itemId === "village_house" || entry.itemId === "farm" || entry.itemId === "granary").length * 4 + nearbyVillagers * 2;
      else if (building.itemId === "granary") income += 8 + nearbyOwned.filter((entry) => entry.itemId === "farm" || entry.itemId === "village_house").length * 3;
      else if (building.itemId === "farm") income += 6;
      else if (building.itemId === "command_hall") income += 12 + Math.min(14, Math.floor(ownedBuildings.length / 2));
      else if (building.itemId === "dock") income += 10;
      else if (building.itemId === "refinery" || building.itemId === "power_plant") income += 7;
      else if (building.itemId === "supply_depot") income += 9 + Math.min(10, nearbyOwned.length);
      else if (building.itemId === "imperial_mint") income += 18 + nearbyOwned.filter((entry) => entry.itemId === "market" || entry.itemId === "command_hall" || entry.itemId === "supply_depot").length * 4;
      else if (building.itemId === "storm_generator") income += 9;
      else if (building.itemId === "war_foundry") income += 6 + nearbyOwned.filter((entry) => entry.itemId === "refinery" || entry.itemId === "power_plant" || entry.itemId === "command_hall").length * 3;
      else if (building.itemId === "lumber_camp") income += Math.min(8, state.world.trees.filter((tree) => Math.hypot(tree.x - building.x, tree.y - building.y) < 280).length);
      else if (building.itemId === "quarry") income += Math.min(9, state.world.rocks.filter((rock) => Math.hypot(rock.x - building.x, rock.y - building.y) < 260).length);
      else if (building.itemId === "village_house") income += 3 + nearbyVillagers;
    }
    const nearbyCivilians = state.world.civilians.filter((civilian) => findNearest(ownedBuildings, civilian.x, civilian.y, (b) => Math.hypot(b.x - civilian.x, b.y - civilian.y) < 420)).length;
    return Math.round((income + nearbyCivilians * 2) * multiplier);
  }

  function taxTick(owner) {
    const income = getPassiveIncomeForOwner(owner);
    if (income > 0) {
      addCoins(owner, income);
      notify(`Treasury income delivered +${income} coins`, "#7df2ab");
    }
  }

  function handleWorldCommand(worldPos) {
    const player = getActivePlayerState();
    if (!player) return false;
    if (!state.selectedIds.size) return false;
    if (isLanClient()) {
      queueLanCommand({
        type: "worldCommand",
        owner: player.owner,
        selectedIds: [...state.selectedIds],
        hoveredEnemyIds: [...state.ui.hoveredEnemyIds],
        worldPos: { x: worldPos.x, y: worldPos.y },
      });
      return true;
    }
    return applyWorldCommand(player.owner, state.selectedIds, worldPos, state.ui.hoveredEnemyIds);
  }

  function update(dt) {
    updateControllerAssignments();
    updateGamepads(dt);
    if (hasLanSession()) {
      state.lan.pollTimer -= dt;
      if (state.lan.pollTimer <= 0) {
        state.lan.pollTimer = isLanClient() ? 0.08 : 0.1;
        pollLanServer();
      }
      if (isLanHost()) {
        state.lan.syncTimer -= dt;
        if (state.lan.syncTimer <= 0) {
          state.lan.syncTimer = state.lan.guestJoined ? 0.12 : 0.35;
          pushLanSnapshot();
        }
      }
    }
    updateAudio(dt);
    if (state.mode !== "playing") return;
    updateFogOfWar();
    if (isLanClient()) return;
    const simDt = dt * state.speed.multiplier;
    state.time += simDt;
    if (isPvEMatch() && state.difficulty.ceasefireTimer > 0) {
      state.difficulty.ceasefireTimer = Math.max(0, state.difficulty.ceasefireTimer - simDt);
      if (state.difficulty.ceasefireTimer === 0) notify("Ceasefire expired. Enemy armies are active again.", "#ffb484");
      syncLiveControls();
    }

    if (Math.floor(state.time * 10) % 90 === 0 && !state.taxPulseLock) {
      state.taxPulseLock = true;
      for (const player of getHumanPlayers()) taxTick(player.owner);
    }
    if (Math.floor(state.time * 10) % 90 !== 0) state.taxPulseLock = false;

    const wealthQuest = state.world.quests.find((quest) => quest.kind === "wealth" && !quest.done);
    if (wealthQuest && getPrimaryPlayer()) wealthQuest.progress = Math.min(wealthQuest.target, getPrimaryPlayer().resources.coins);

    updateEnemyWaves(simDt);
    updateResourceNodes(simDt);
    for (const civilian of state.world.civilians) updateCivilian(civilian, simDt);
    for (const animal of state.world.animals) updateAnimal(animal, simDt);
    for (const building of [...state.world.buildings]) updateBuilding(building, simDt);
    for (const unit of [...state.world.units]) updateUnit(unit, simDt);
    for (const projectile of [...state.world.projectiles]) updateProjectile(projectile, simDt);
    updateDrops(simDt);
    updateEffects(simDt);
    updateNotifications(simDt);

    if (isCompetitiveMatch()) {
      const aliveOwners = getHumanOwners().filter((owner) => ownerHasForces(owner));
      if (aliveOwners.length <= 1) {
        state.mode = aliveOwners.length === 1 ? "victory" : "defeat";
        state.winnerOwner = aliveOwners[0] || null;
        if (getHumanPlayers().length === 2 && aliveOwners.length === 1) {
          state.loserOwner = getHumanOwners().find((owner) => owner !== aliveOwners[0]) || null;
        } else {
          state.loserOwner = null;
        }
        showMatchResultOverlay();
      }
    } else if (isCoopMatch()) {
      const alliedAlive = getHumanOwners().some((owner) => ownerHasForces(owner));
      const enemyAlive = countHostileBuildings() > 0 || countHostileUnits() > 0;
      if (!enemyAlive) {
        state.mode = "victory";
        state.winnerOwner = null;
        state.loserOwner = null;
        showMatchResultOverlay();
      } else if (!alliedAlive) {
        state.mode = "defeat";
        state.winnerOwner = null;
        state.loserOwner = null;
        showMatchResultOverlay();
      }
    } else {
      const enemyAlive = state.world.buildings.some((building) => building.owner !== "player" && building.owner !== "neutral") ||
        state.world.units.some((unit) => unit.owner !== "player" && unit.owner !== "neutral");
      const playerAlive = ownerHasForces("player");
      if (!enemyAlive) {
        state.mode = "victory";
        showMatchResultOverlay();
      } else if (!playerAlive) {
        state.mode = "defeat";
        showMatchResultOverlay();
      }
    }
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (isSplitScreenMatch() && state.mode !== "menu") {
      for (const player of getHumanPlayers()) drawViewport(player);
      drawSplitDivider();
    } else {
      const player = getPrimaryPlayer();
      drawFirstPersonView(player, getViewportForPlayer(player));
    }
  }

  function drawViewport(player) {
    const viewport = getViewportForPlayer(player);
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewport.x, viewport.y, viewport.w, viewport.h);
    ctx.clip();
    drawFirstPersonView(player, viewport);
    ctx.restore();
    drawViewportLabel(player, viewport);
  }

  function drawSplitDivider() {
    const count = getHumanPlayers().length;
    const drawVertical = (x, y, h) => {
      const grad = ctx.createLinearGradient(x - 10, y, x + 10, y);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, "rgba(255,214,137,0.3)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - 10, y, 20, h);
    };
    const drawHorizontal = (x, y, w) => {
      const grad = ctx.createLinearGradient(x, y - 10, x, y + 10);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, "rgba(255,214,137,0.26)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y - 10, w, 20);
    };
    if (count <= 2) {
      drawVertical(canvas.width / 2, 0, canvas.height);
      return;
    }
    const halfHeight = canvas.height / 2;
    drawHorizontal(0, halfHeight, canvas.width);
    if (count === 3) {
      drawVertical(canvas.width / 2, 0, halfHeight);
      return;
    }
    drawVertical(canvas.width / 2, 0, canvas.height);
  }

  function getVisibleWorldRadius(margin = 0) {
    const viewport = state.activeViewport || getViewportForPlayer();
    return Math.max(viewport.w, viewport.h) / Math.max(0.28, state.camera.zoom) * 0.9 + margin;
  }

  function drawBackdrop(w, h, offsetX = 0, offsetY = 0) {
    const mood = getEnvironmentMood();
    const sky = ctx.createLinearGradient(offsetX, offsetY, offsetX, offsetY + h);
    sky.addColorStop(0, mood.skyTop);
    sky.addColorStop(0.58, mood.skyMid);
    sky.addColorStop(1, mood.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(offsetX, offsetY, w, h);
    const sunX = offsetX + w * 0.18 + Math.sin(state.time * 0.035 + state.camera.x * 0.00016) * w * 0.035;
    const sunY = offsetY + h * 0.15 + Math.cos(state.time * 0.028 + state.camera.y * 0.00013) * h * 0.02;
    const sun = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, w * 0.34);
    sun.addColorStop(0, mood.sunCore);
    sun.addColorStop(0.3, mood.sunGlow);
    sun.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(offsetX, offsetY, w, h);
    const aurora = ctx.createRadialGradient(offsetX + w * 0.18, offsetY + h * 0.12, 12, offsetX + w * 0.18, offsetY + h * 0.12, w * 0.72);
    aurora.addColorStop(0, mood.skyGlow);
    aurora.addColorStop(0.42, mood.horizon);
    aurora.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aurora;
    ctx.fillRect(offsetX, offsetY, w, h);
    for (let i = 0; i < 4; i += 1) {
      const bandY = offsetY + h * (0.17 + i * 0.16) + Math.sin(state.time * 0.042 + i * 1.4 + state.camera.x * 0.0002) * h * 0.028;
      const band = ctx.createLinearGradient(offsetX, bandY, offsetX + w, bandY + h * 0.08);
      band.addColorStop(0, "rgba(255,255,255,0)");
      band.addColorStop(0.5, i % 2 === 0 ? mood.horizon : mood.ember);
      band.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = band;
      ctx.fillRect(offsetX, bandY - h * 0.05, w, h * 0.14);
    }
    const ember = ctx.createLinearGradient(offsetX, offsetY + h * 0.42, offsetX + w, offsetY + h);
    ember.addColorStop(0, mood.ember);
    ember.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ember;
    ctx.fillRect(offsetX, offsetY, w, h);
  }

  function shadeRgb(r, g, b, shade = 1, alpha = 1) {
    const amount = Math.max(0, shade);
    return `rgba(${Math.round(r * amount)}, ${Math.round(g * amount)}, ${Math.round(b * amount)}, ${alpha})`;
  }

  function getFirstPersonHorizon(viewport, fp) {
    return viewport.y + viewport.h * clamp(0.46 + fp.pitch * 0.7, 0.18, 0.78);
  }

  function getBiomeFloorColor(biome, worldX, worldY, distance = 0) {
    const wave = Math.sin(worldX * 0.02) * 0.04 + Math.cos(worldY * 0.024) * 0.04 + Math.sin(state.time * 0.35 + worldX * 0.004) * 0.02;
    const shade = clamp(1 - distance / 1500 + wave, 0.22, 1.08);
    if (biome === "forest") return shadeRgb(58, 82, 48, shade);
    if (biome === "hill") return shadeRgb(120, 108, 78, shade);
    if (biome === "ocean") return shadeRgb(42, 96, 132, shade + Math.sin(state.time * 2.8 + worldY * 0.018) * 0.1);
    if (biome === "river") return shadeRgb(62, 122, 156, shade + Math.sin(state.time * 2.4 + worldY * 0.02) * 0.08);
    if (biome === "marsh") return shadeRgb(68, 96, 72, shade);
    if (biome === "desert") return shadeRgb(170, 138, 86, shade);
    if (biome === "canyon") return shadeRgb(128, 84, 54, shade);
    if (biome === "deadlands") return shadeRgb(88, 68, 82, shade);
    if (biome === "road") {
      const stripe = Math.abs(Math.sin(worldX * 0.03 + worldY * 0.03)) > 0.85 ? 0.16 : 0;
      return shadeRgb(122, 110, 86, shade + stripe);
    }
    return shadeRgb(92, 120, 74, shade);
  }

  function projectFirstPersonPoint(viewport, unit, fp, x, y, z = 0) {
    const dx = x - unit.x;
    const dy = y - unit.y;
    const forwardX = Math.cos(fp.yaw);
    const forwardY = Math.sin(fp.yaw);
    const rightX = -forwardY;
    const rightY = forwardX;
    const depth = dx * forwardX + dy * forwardY;
    if (depth <= 8) return null;
    const side = dx * rightX + dy * rightY;
    const focal = viewport.w * (fp.aiming ? 0.96 : 0.74);
    const centerX = viewport.x + viewport.w * 0.5 + (side / depth) * focal;
    const horizon = getFirstPersonHorizon(viewport, fp);
    const eyeHeight = getFirstPersonEyeHeight(unit);
    const screenY = horizon + ((eyeHeight - z) / depth) * focal;
    return {
      depth,
      side,
      scale: focal / depth,
      x: centerX,
      y: screenY,
      horizon,
      focal,
    };
  }

  function drawFirstPersonBackdrop(viewport, unit, fp) {
    const ray = getFirstPersonRay(unit, getPlayerState(unit.owner), 180);
    const lookTile = getTileAtWorld(ray ? ray.point.x : unit.x, ray ? ray.point.y : unit.y) || getTileAtWorld(unit.x, unit.y);
    const mood = getEnvironmentMood((lookTile && lookTile.biome) || "meadow");
    const horizon = getFirstPersonHorizon(viewport, fp);
    const sky = ctx.createLinearGradient(viewport.x, viewport.y, viewport.x, horizon);
    sky.addColorStop(0, mood.skyTop);
    sky.addColorStop(0.58, mood.skyMid);
    sky.addColorStop(1, mood.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(viewport.x, viewport.y, viewport.w, horizon - viewport.y + 1);
    const sunX = viewport.x + viewport.w * 0.22 + Math.sin(state.time * 0.035 + fp.yaw) * viewport.w * 0.04;
    const sunY = viewport.y + viewport.h * 0.17 + Math.cos(state.time * 0.02 + unit.x * 0.001) * viewport.h * 0.03;
    const sun = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, viewport.w * 0.24);
    sun.addColorStop(0, mood.sunCore);
    sun.addColorStop(0.35, mood.sunGlow);
    sun.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(viewport.x, viewport.y, viewport.w, horizon - viewport.y + 1);
    const haze = ctx.createLinearGradient(viewport.x, horizon - viewport.h * 0.12, viewport.x, horizon + viewport.h * 0.18);
    haze.addColorStop(0, mood.horizon);
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(viewport.x, horizon - viewport.h * 0.14, viewport.w, viewport.h * 0.3);
  }

  function drawFirstPersonGround(viewport, unit, fp) {
    const centerX = viewport.x + viewport.w * 0.5;
    const focal = viewport.w * (fp.aiming ? 0.96 : 0.74);
    const horizon = getFirstPersonHorizon(viewport, fp);
    const eyeHeight = getFirstPersonEyeHeight(unit) + 8;
    const forwardX = Math.cos(fp.yaw);
    const forwardY = Math.sin(fp.yaw);
    const rightX = -forwardY;
    const rightY = forwardX;
    const stepX = Math.max(8, Math.round(viewport.w / 140));
    const stepY = Math.max(4, Math.round(viewport.h / 110));
    for (let y = Math.floor(horizon); y < viewport.y + viewport.h; y += stepY) {
      const rowDistance = clamp((eyeHeight * focal * 0.13) / Math.max(10, y - horizon + 1), 16, 1280);
      for (let x = viewport.x; x < viewport.x + viewport.w; x += stepX) {
        const cameraX = ((x + stepX * 0.5) - centerX) / Math.max(120, focal);
        const worldX = unit.x + forwardX * rowDistance + rightX * rowDistance * cameraX * 1.6;
        const worldY = unit.y + forwardY * rowDistance + rightY * rowDistance * cameraX * 1.6;
        const tile = getTileAtWorld(worldX, worldY);
        ctx.fillStyle = getBiomeFloorColor(tile ? tile.biome : "meadow", worldX, worldY, rowDistance);
        ctx.fillRect(x, y, stepX + 1, stepY + 1);
      }
    }
    const vignette = ctx.createLinearGradient(viewport.x, horizon, viewport.x, viewport.y + viewport.h);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = vignette;
    ctx.fillRect(viewport.x, horizon, viewport.w, viewport.h - (horizon - viewport.y));
  }

  function getAngleDelta(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  function drawFirstPersonScreenShadow(x, y, width, alpha = 0.18) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.4, Math.max(2, width * 0.12), 0, 0, TAU);
    ctx.fill();
  }

  function drawFirstPersonHealthBar(x, y, width, ratio, fill = "#ff9b89") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x - width * 0.5, y, width, 4);
    ctx.fillStyle = fill;
    ctx.fillRect(x - width * 0.5, y, width * clamp(ratio, 0, 1), 4);
  }

  function drawFirstPersonTreeModel(tree, proj) {
    const width = tree.radius * 4.2 * proj.scale;
    const height = tree.radius * 7.2 * proj.scale;
    drawFirstPersonScreenShadow(proj.x, proj.y + 5 * proj.scale, width, 0.22);
    ctx.fillStyle = "#4b2f20";
    ctx.fillRect(proj.x - width * 0.08, proj.y - height * 0.34, width * 0.16, height * 0.46);
    const lowerLeaf = ctx.createRadialGradient(proj.x, proj.y - height * 0.58, width * 0.08, proj.x, proj.y - height * 0.52, width * 0.58);
    lowerLeaf.addColorStop(0, "#89c97e");
    lowerLeaf.addColorStop(0.6, "#4f874d");
    lowerLeaf.addColorStop(1, "#203f26");
    ctx.fillStyle = lowerLeaf;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y - height * 0.52, width * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(proj.x - width * 0.12, proj.y - height * 0.62, width * 0.18, 0, TAU);
    ctx.fill();
  }

  function drawFirstPersonRockModel(rock, proj) {
    const width = rock.radius * 3.9 * proj.scale;
    const height = rock.radius * 2.8 * proj.scale;
    drawFirstPersonScreenShadow(proj.x, proj.y + 4 * proj.scale, width, 0.16);
    ctx.fillStyle = "#626871";
    ctx.beginPath();
    ctx.moveTo(proj.x - width * 0.48, proj.y);
    ctx.lineTo(proj.x - width * 0.22, proj.y - height);
    ctx.lineTo(proj.x + width * 0.16, proj.y - height * 0.88);
    ctx.lineTo(proj.x + width * 0.48, proj.y - height * 0.18);
    ctx.lineTo(proj.x + width * 0.22, proj.y + height * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(proj.x - width * 0.22, proj.y - height);
    ctx.lineTo(proj.x + width * 0.08, proj.y - height * 0.78);
    ctx.lineTo(proj.x + width * 0.18, proj.y - height * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  function drawFirstPersonBuildingModel(building, proj, fp) {
    const style = building.def && building.def.style ? building.def.style : "house";
    const ownerColor = ownerColors[building.owner] || "#d8d1c2";
    const scale = proj.scale * building.radius;
    const width = Math.max(28, scale * (style === "wall" || style === "capital-wall" ? 8.2 : style === "keep" || style === "academy" || style === "command" ? 6.2 : 5.2));
    const height = Math.max(26, scale * (style === "tower" || style === "radar" ? 9.8 : style === "keep" || style === "academy" || style === "command" ? 8.6 : 6.1));
    const x = proj.x;
    const y = proj.y;
    drawFirstPersonScreenShadow(x, y + 6 * proj.scale, width * 1.1, 0.18);
    if (style === "wall" || style === "capital-wall" || style === "gate") {
      ctx.fillStyle = style === "capital-wall" ? "#77828c" : "#aca69c";
      ctx.fillRect(x - width * 0.5, y - height * 0.5, width, height * 0.5);
      ctx.fillStyle = style === "capital-wall" ? "#59636c" : "#7b746b";
      for (let i = -2; i <= 2; i += 1) ctx.fillRect(x + i * width * 0.18 - width * 0.05, y - height * 0.64, width * 0.1, height * 0.18);
    } else if (style === "tower" || style === "radar") {
      ctx.fillStyle = style === "radar" ? "#6c7a84" : "#92847b";
      ctx.fillRect(x - width * 0.2, y - height, width * 0.4, height);
      ctx.fillStyle = "#c9d2d9";
      ctx.fillRect(x - width * 0.34, y - height * 1.04, width * 0.68, height * 0.12);
      if (style === "radar") {
        ctx.strokeStyle = "#b9f0ff";
        ctx.lineWidth = Math.max(1, proj.scale * 2.4);
        ctx.beginPath();
        ctx.arc(x, y - height * 1.02, width * 0.14, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    } else if (style === "bunker" || style === "cannon" || style === "mortar") {
      ctx.fillStyle = "#5d6770";
      ctx.fillRect(x - width * 0.44, y - height * 0.54, width * 0.88, height * 0.54);
      ctx.fillStyle = "#76838e";
      ctx.fillRect(x - width * 0.26, y - height * 0.78, width * 0.52, height * 0.24);
      ctx.fillStyle = "#303b40";
      ctx.fillRect(x + width * 0.08, y - height * 0.56, width * (style === "cannon" ? 0.46 : 0.22), height * 0.08);
    } else if (style === "bridge" || style === "dock") {
      ctx.fillStyle = "#977754";
      ctx.fillRect(x - width * 0.54, y - height * 0.28, width * 1.08, height * 0.28);
      ctx.fillStyle = "#caa879";
      ctx.fillRect(x - width * 0.54, y - height * 0.34, width * 1.08, height * 0.06);
      ctx.fillStyle = "#6d5138";
      ctx.fillRect(x - width * 0.42, y - height * 0.08, width * 0.08, height * 0.16);
      ctx.fillRect(x + width * 0.34, y - height * 0.08, width * 0.08, height * 0.16);
    } else if (style === "keep" || style === "academy" || style === "command") {
      ctx.fillStyle = "#beb8af";
      ctx.fillRect(x - width * 0.42, y - height * 0.66, width * 0.84, height * 0.66);
      ctx.fillStyle = "#8d8378";
      ctx.fillRect(x - width * 0.52, y - height * 0.88, width * 0.18, height * 0.88);
      ctx.fillRect(x + width * 0.34, y - height * 0.88, width * 0.18, height * 0.88);
      ctx.fillStyle = "#6f665d";
      ctx.beginPath();
      ctx.moveTo(x - width * 0.48, y - height * 0.66);
      ctx.lineTo(x, y - height);
      ctx.lineTo(x + width * 0.48, y - height * 0.66);
      ctx.lineTo(x, y - height * 0.42);
      ctx.closePath();
      ctx.fill();
      if (style === "command") {
        ctx.fillStyle = ownerColor;
        ctx.fillRect(x + width * 0.1, y - height * 1.08, width * 0.04, height * 0.26);
        ctx.beginPath();
        ctx.moveTo(x + width * 0.14, y - height * 1.08);
        ctx.lineTo(x + width * 0.32, y - height * 1.02);
        ctx.lineTo(x + width * 0.14, y - height * 0.96);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "#d8d1c2";
      ctx.fillRect(x - width * 0.38, y - height * 0.46, width * 0.76, height * 0.46);
      ctx.fillStyle = style === "market" ? "#c7764f" : style === "plant" || style === "refinery" ? "#5d6774" : style === "hospital" ? "#556c7c" : style === "stable" ? "#6f5337" : "#8d6c5c";
      ctx.beginPath();
      ctx.moveTo(x - width * 0.46, y - height * 0.46);
      ctx.lineTo(x, y - height * 0.9);
      ctx.lineTo(x + width * 0.46, y - height * 0.46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e8f4fb";
      ctx.fillRect(x - width * 0.22, y - height * 0.34, width * 0.12, height * 0.1);
      ctx.fillRect(x + width * 0.1, y - height * 0.34, width * 0.12, height * 0.1);
    }
    if (building.lastHitTimer > 0 || fp.targetId === building.id) {
      drawFirstPersonHealthBar(x, y - height - 8, Math.max(26, width * 0.7), building.hp / Math.max(1, building.maxHp || building.hp || 1), "#ff9b89");
    }
  }

  function drawFirstPersonUnitModel(actor, proj, fp) {
    const ownerColor = ownerColors[actor.owner] || "#eadcc5";
    const angleDelta = getAngleDelta(actor.angle || 0, fp.yaw);
    const turn = clamp(Math.sin(angleDelta), -1, 1);
    const facing = Math.cos(angleDelta);
    const hitAlpha = clamp((actor.lastHitTimer || 0) / 0.2, 0, 1);
    const x = proj.x;
    const y = proj.y;
    if (actor.type === "vehicle") {
      const width = Math.max(20, actor.radius * 7.2 * proj.scale);
      const height = Math.max(18, actor.radius * 4.6 * proj.scale);
      drawFirstPersonScreenShadow(x, y + 4 * proj.scale, width, 0.22);
      ctx.fillStyle = hitAlpha > 0 ? `rgba(255,233,205,${0.32 + hitAlpha * 0.3})` : "#4f5e67";
      ctx.fillRect(x - width * 0.42, y - height * 0.42, width * 0.84, height * 0.42);
      ctx.fillStyle = "#2d353b";
      ctx.fillRect(x - width * 0.48, y - height * 0.36, width * 0.08, height * 0.36);
      ctx.fillRect(x + width * 0.4, y - height * 0.36, width * 0.08, height * 0.36);
      ctx.fillStyle = "#6b7b84";
      ctx.fillRect(x - width * 0.2, y - height * 0.62, width * 0.4, height * 0.26);
      ctx.fillStyle = "#303b40";
      const barrelY = y - height * (0.52 + clamp(facing * 0.1, -0.08, 0.12));
      ctx.fillRect(x + width * 0.06, barrelY, width * (0.32 + Math.abs(turn) * 0.06), height * 0.08);
      if (actor.role === "rocketTruck" || actor.role === "missileCarrier") ctx.fillRect(x - width * 0.22, y - height * 0.78, width * 0.42, height * 0.16);
      if (actor.lastHitTimer > 0 || fp.targetId === actor.id) drawFirstPersonHealthBar(x, y - height - 7, Math.max(22, width * 0.58), actor.hp / actor.maxHp, "#ff9b89");
      return;
    }
    if (actor.airborne) {
      const width = Math.max(18, actor.radius * 6.4 * proj.scale);
      const height = Math.max(16, actor.radius * 3.8 * proj.scale);
      drawFirstPersonScreenShadow(x, y + 6 * proj.scale, width * 0.8, 0.12);
      ctx.fillStyle = hitAlpha > 0 ? `rgba(246,252,255,${0.34 + hitAlpha * 0.28})` : "#8ea2b0";
      ctx.beginPath();
      ctx.ellipse(x, y - height * 0.22, width * 0.2, height * 0.26, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#d8e6f2";
      ctx.lineWidth = Math.max(1, proj.scale * 2.1);
      ctx.beginPath();
      ctx.moveTo(x - width * 0.46, y - height * 0.24);
      ctx.lineTo(x + width * 0.46, y - height * 0.24);
      ctx.stroke();
      if (actor.role === "copter" || actor.role === "gunship") {
        ctx.strokeStyle = "#3f4c54";
        ctx.beginPath();
        ctx.moveTo(x - width * 0.56, y - height * 0.6);
        ctx.lineTo(x + width * 0.56, y - height * 0.6);
        ctx.stroke();
      }
      if (actor.lastHitTimer > 0 || fp.targetId === actor.id) drawFirstPersonHealthBar(x, y - height - 10, Math.max(20, width * 0.5), actor.hp / actor.maxHp, "#ff9b89");
      return;
    }

    const width = Math.max(14, actor.radius * (actor.role === "knight" || actor.role === "paladin" ? 5.8 : 4.2) * proj.scale);
    const height = Math.max(20, actor.radius * (actor.role === "knight" || actor.role === "paladin" ? 7.8 : 6.4) * proj.scale);
    drawFirstPersonScreenShadow(x, y + 3 * proj.scale, width * 0.8, 0.16);
    if (actor.role === "knight" || actor.role === "paladin") {
      ctx.fillStyle = hitAlpha > 0 ? `rgba(255,237,213,${0.3 + hitAlpha * 0.3})` : "#84624b";
      ctx.beginPath();
      ctx.ellipse(x - width * 0.1, y - height * 0.2, width * 0.34, height * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(x - width * 0.36, y - height * 0.1, width * 0.54, height * 0.18);
      ctx.fillStyle = ownerColor;
      ctx.fillRect(x - width * 0.04, y - height * 0.54, width * 0.12, height * 0.34);
      ctx.fillStyle = "#eadcc5";
      ctx.beginPath();
      ctx.arc(x + width * 0.04, y - height * 0.66, width * 0.11, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = ownerColor;
      ctx.lineWidth = Math.max(1.2, proj.scale * 3.2);
      ctx.beginPath();
      ctx.moveTo(x, y - height * 0.48);
      ctx.lineTo(x, y - height * 0.08);
      ctx.moveTo(x - width * 0.18, y - height * 0.22);
      ctx.lineTo(x + width * 0.2, y - height * 0.18);
      ctx.moveTo(x, y - height * 0.08);
      ctx.lineTo(x - width * 0.16, y + height * 0.14);
      ctx.moveTo(x, y - height * 0.08);
      ctx.lineTo(x + width * 0.12, y + height * 0.14);
      ctx.stroke();
      ctx.fillStyle = hitAlpha > 0 ? `rgba(255,241,221,${0.34 + hitAlpha * 0.3})` : "#eadcc5";
      ctx.beginPath();
      ctx.arc(x, y - height * 0.62, width * 0.12, 0, TAU);
      ctx.fill();
    }
    if (actor.projectile || actor.role === "musketeer" || actor.role === "marine" || actor.role === "sniper" || actor.role === "crossbowman") {
      ctx.strokeStyle = actor.pickupWeapon ? "#ffe29a" : "#8e6337";
      ctx.lineWidth = Math.max(1, proj.scale * 2.4);
      ctx.beginPath();
      ctx.moveTo(x - width * 0.04, y - height * 0.28);
      ctx.lineTo(x + width * (0.28 + Math.abs(turn) * 0.14), y - height * (0.34 - facing * 0.06));
      ctx.stroke();
    } else if (actor.role === "archer") {
      ctx.strokeStyle = "#e6bc75";
      ctx.lineWidth = Math.max(1, proj.scale * 2.2);
      ctx.beginPath();
      ctx.arc(x + width * 0.16, y - height * 0.32, width * 0.12, -1.1, 1.1);
      ctx.stroke();
    } else {
      ctx.strokeStyle = actor.pickupWeapon ? "#ffe29a" : "#d8d8d8";
      ctx.lineWidth = Math.max(1, proj.scale * 2.2);
      ctx.beginPath();
      ctx.moveTo(x + width * 0.04, y - height * 0.28);
      ctx.lineTo(x + width * 0.24, y - height * 0.56);
      ctx.stroke();
    }
    if (actor.lastHitTimer > 0 || fp.targetId === actor.id) drawFirstPersonHealthBar(x, y - height - 6, Math.max(18, width * 0.6), actor.hp / actor.maxHp, "#ff9b89");
  }

  function drawFirstPersonWorldObjects(viewport, unit, fp) {
    const drawables = [];
    const maxDistance = 1080;
    const pushDrawable = (kind, source, projection) => {
      if (!projection || projection.depth > maxDistance) return;
      if (Math.abs(projection.side) > projection.depth * 1.7 + 120) return;
      drawables.push({ kind, source, projection });
    };
    for (const tree of state.world.trees) pushDrawable("tree", tree, projectFirstPersonPoint(viewport, unit, fp, tree.x, tree.y, 0));
    for (const rock of state.world.rocks) pushDrawable("rock", rock, projectFirstPersonPoint(viewport, unit, fp, rock.x, rock.y, 0));
    for (const building of state.world.buildings) pushDrawable("building", building, projectFirstPersonPoint(viewport, unit, fp, building.x, building.y, 0));
    for (const other of state.world.units) {
      if (other.id === unit.id) continue;
      pushDrawable("unit", other, projectFirstPersonPoint(viewport, unit, fp, other.x, other.y, other.z || 0));
    }
    for (const animal of state.world.animals) pushDrawable("animal", animal, projectFirstPersonPoint(viewport, unit, fp, animal.x, animal.y, 0));
    for (const civilian of state.world.civilians) pushDrawable("civilian", civilian, projectFirstPersonPoint(viewport, unit, fp, civilian.x, civilian.y, 0));
    for (const projectile of state.world.projectiles) pushDrawable("projectile", projectile, projectFirstPersonPoint(viewport, unit, fp, projectile.x, projectile.y, projectile.z || 0));
    for (const effect of state.world.effects) pushDrawable("effect", effect, projectFirstPersonPoint(viewport, unit, fp, effect.x, effect.y, 0));
    drawables.sort((a, b) => b.projection.depth - a.projection.depth);

    for (const entry of drawables) {
      const proj = entry.projection;
      const baseY = proj.y;
      if (entry.kind === "tree") {
        drawFirstPersonTreeModel(entry.source, proj);
        continue;
      }
      if (entry.kind === "rock") {
        drawFirstPersonRockModel(entry.source, proj);
        continue;
      }
      if (entry.kind === "building") {
        drawFirstPersonBuildingModel(entry.source, proj, fp);
        continue;
      }
      if (entry.kind === "unit" || entry.kind === "animal" || entry.kind === "civilian") {
        drawFirstPersonUnitModel(entry.source, proj, fp);
        continue;
      }
      if (entry.kind === "projectile") {
        const projectile = entry.source;
        const radius = Math.max(2, (projectile.projectileType === "bullet" ? 4 : 7) * proj.scale);
        ctx.strokeStyle = projectile.projectileType === "pulse" ? "#7ef7ff" : projectile.projectileType === "rocket" || projectile.projectileType === "missile" ? "#ffb469" : "#e9e0c9";
        ctx.lineWidth = Math.max(1, radius * 0.45);
        ctx.beginPath();
        ctx.moveTo(proj.x - (projectile.vx || 0) * proj.scale * 0.016, proj.y - (projectile.vy || 0) * proj.scale * 0.016);
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, radius, 0, TAU);
        ctx.fill();
        continue;
      }
      if (entry.kind === "effect") {
        const effect = entry.source;
        if (effect.ttl <= 0) continue;
        const alpha = clamp(effect.ttl / effect.maxTtl, 0, 1) * 0.7;
        if (effect.type === "damageText") {
          ctx.fillStyle = withAlpha(effect.tint || "#ffe29a", alpha);
          ctx.font = `700 ${Math.max(14, Math.round(proj.scale * 86))}px Cambria`;
          ctx.textAlign = "center";
          ctx.fillText(effect.text || "0", proj.x, proj.y);
          ctx.textAlign = "left";
          continue;
        }
        const radius = Math.max(6, effect.radius * 0.22 * proj.scale);
        if (effect.type === "smoke") {
          ctx.fillStyle = `rgba(68,72,80,${alpha * 0.4})`;
        } else {
          ctx.fillStyle = withAlpha(effect.tint || "#ffc48a", alpha * 0.8);
        }
        ctx.beginPath();
        ctx.arc(proj.x, proj.y - radius * 0.35, radius, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawFirstPersonWeaponOverlay(viewport, unit, fp) {
    const moveFactor = (state.keys.forward || state.keys.back || state.keys.left || state.keys.right) ? 1 : 0;
    const sway = Math.sin(state.time * (moveFactor ? 8.2 : 3.6)) * (moveFactor ? 7 : 3) + fp.kick * 12;
    const aimPull = fp.aiming ? 0.54 : 1;
    const baseX = viewport.x + viewport.w * (fp.aiming ? 0.6 : 0.74);
    const baseY = viewport.y + viewport.h * 0.83 + sway * 0.16;
    const pickupName = String(unit.pickupWeapon || "").toLowerCase();
    const projectileType = unit.projectile || (pickupName.includes("gun") || pickupName.includes("rifle") ? "bullet" : "");
    const isBow = !pickupName && projectileType === "arrow";
    const isCrossbow = !pickupName && projectileType === "bolt";
    const isLauncher = projectileType === "rocket" || projectileType === "missile" || projectileType === "shell" || projectileType === "mortar" || projectileType === "boulder";
    const isFirearm = !isBow && !isCrossbow && (projectileType || getAttackRange(unit) >= 120);
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(-0.16 + fp.kick * 0.06);
    const handColor = "#d8c0a4";
    const sleeveColor = withAlpha(ownerColors[unit.owner] || "#50626c", 0.92);
    if (isBow) {
      const bowW = viewport.w * 0.12 * aimPull;
      const bowH = viewport.h * 0.16;
      ctx.fillStyle = sleeveColor;
      ctx.fillRect(-bowW * 0.9, bowH * 0.16, bowW * 0.46, bowH * 0.34);
      ctx.fillRect(-bowW * 0.08, bowH * 0.04, bowW * 0.28, bowH * 0.22);
      ctx.fillStyle = handColor;
      ctx.fillRect(-bowW * 0.46, bowH * 0.14, bowW * 0.14, bowH * 0.2);
      ctx.fillRect(bowW * 0.03, bowH * 0.02, bowW * 0.12, bowH * 0.16);
      ctx.strokeStyle = "#7e5839";
      ctx.lineWidth = Math.max(3, viewport.w * 0.0045);
      ctx.beginPath();
      ctx.arc(bowW * 0.3, -bowH * 0.02, bowW * 0.24, -1.25, 1.25);
      ctx.stroke();
      ctx.strokeStyle = "#e8e0ca";
      ctx.lineWidth = Math.max(1, viewport.w * 0.0018);
      ctx.beginPath();
      ctx.moveTo(bowW * 0.38, -bowH * 0.24);
      ctx.lineTo(bowW * 0.38, bowH * 0.22);
      ctx.stroke();
      ctx.strokeStyle = "#d0d7df";
      ctx.lineWidth = Math.max(1.5, viewport.w * 0.0024);
      ctx.beginPath();
      ctx.moveTo(-bowW * 0.02, bowH * 0.03);
      ctx.lineTo(bowW * 0.44, -bowH * 0.02);
      ctx.stroke();
      ctx.fillStyle = "#d8dce0";
      ctx.beginPath();
      ctx.moveTo(bowW * 0.46, -bowH * 0.04);
      ctx.lineTo(bowW * 0.58, -bowH * 0.01);
      ctx.lineTo(bowW * 0.46, bowH * 0.02);
      ctx.closePath();
      ctx.fill();
      if (fp.muzzle > 0) {
        const release = ctx.createRadialGradient(bowW * 0.44, -bowH * 0.02, 2, bowW * 0.44, -bowH * 0.02, bowW * 0.22);
        release.addColorStop(0, `rgba(255,247,216,${0.8 * fp.muzzle / 0.04})`);
        release.addColorStop(1, "rgba(255,226,154,0)");
        ctx.fillStyle = release;
        ctx.beginPath();
        ctx.arc(bowW * 0.44, -bowH * 0.02, bowW * 0.22, 0, TAU);
        ctx.fill();
      }
    } else if (isCrossbow) {
      const bodyW = viewport.w * 0.16 * aimPull;
      const bodyH = viewport.h * 0.032;
      ctx.fillStyle = sleeveColor;
      ctx.fillRect(-bodyW * 0.72, bodyH * 0.32, bodyW * 0.42, bodyH * 0.64);
      ctx.fillRect(-bodyW * 0.08, bodyH * 0.1, bodyW * 0.26, bodyH * 0.4);
      ctx.fillStyle = handColor;
      ctx.fillRect(-bodyW * 0.34, bodyH * 0.24, bodyW * 0.1, bodyH * 0.3);
      ctx.fillRect(bodyW * 0.05, bodyH * 0.08, bodyW * 0.1, bodyH * 0.22);
      ctx.fillStyle = "rgba(42,31,22,0.96)";
      ctx.fillRect(-bodyW * 0.12, -bodyH * 0.08, bodyW * 0.86, bodyH * 0.22);
      ctx.fillStyle = "#8f6845";
      ctx.fillRect(-bodyW * 0.42, -bodyH * 0.02, bodyW * 0.38, bodyH * 0.14);
      ctx.strokeStyle = "#dcb674";
      ctx.lineWidth = Math.max(2, viewport.w * 0.0034);
      ctx.beginPath();
      ctx.moveTo(bodyW * 0.66, -bodyH * 0.18);
      ctx.lineTo(bodyW * 0.88, -bodyH * 0.42);
      ctx.moveTo(bodyW * 0.66, 0);
      ctx.lineTo(bodyW * 0.88, bodyH * 0.24);
      ctx.stroke();
      ctx.strokeStyle = "#e8e0ca";
      ctx.lineWidth = Math.max(1, viewport.w * 0.0018);
      ctx.beginPath();
      ctx.moveTo(bodyW * 0.88, -bodyH * 0.42);
      ctx.lineTo(bodyW * 0.88, bodyH * 0.24);
      ctx.stroke();
      ctx.fillStyle = "#c7d2dd";
      ctx.fillRect(bodyW * 0.08, -bodyH * 0.04, bodyW * 0.68, bodyH * 0.06);
      if (fp.muzzle > 0) {
        ctx.fillStyle = `rgba(255,245,214,${0.78 * fp.muzzle / 0.04})`;
        ctx.fillRect(bodyW * 0.78, -bodyH * 0.12, bodyW * 0.1, bodyH * 0.2);
      }
    } else if (isFirearm) {
      const bodyW = viewport.w * (isLauncher ? 0.21 : 0.18) * aimPull;
      const bodyH = viewport.h * (isLauncher ? 0.042 : 0.035);
      ctx.fillStyle = sleeveColor;
      ctx.fillRect(-bodyW * 0.74, bodyH * 0.34, bodyW * 0.44, bodyH * 0.68);
      ctx.fillRect(-bodyW * 0.14, bodyH * 0.08, bodyW * 0.34, bodyH * 0.54);
      ctx.fillStyle = handColor;
      ctx.fillRect(-bodyW * 0.36, bodyH * 0.26, bodyW * 0.12, bodyH * 0.34);
      ctx.fillRect(bodyW * 0.06, bodyH * 0.02, bodyW * 0.1, bodyH * 0.28);
      ctx.fillStyle = isLauncher ? "rgba(54,60,66,0.97)" : "rgba(28,34,39,0.96)";
      ctx.fillRect(-bodyW * 0.28, -bodyH * 0.24, bodyW * 0.98, bodyH * 0.42);
      ctx.fillRect(bodyW * 0.52, -bodyH * 0.12, bodyW * (isLauncher ? 0.44 : 0.36), bodyH * (isLauncher ? 0.2 : 0.16));
      ctx.fillStyle = isLauncher ? "rgba(119,127,136,0.96)" : "rgba(98,110,120,0.94)";
      ctx.fillRect(-bodyW * 0.12, -bodyH * 0.46, bodyW * 0.28, bodyH * 0.24);
      ctx.fillStyle = "rgba(56,62,68,0.94)";
      ctx.fillRect(-bodyW * 0.18, bodyH * 0.06, bodyW * 0.16, bodyH * 0.28);
      if (isLauncher) {
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = Math.max(2, viewport.w * 0.003);
        ctx.beginPath();
        ctx.moveTo(bodyW * 0.16, -bodyH * 0.18);
        ctx.lineTo(bodyW * 0.44, -bodyH * 0.18);
        ctx.stroke();
      }
      if (fp.muzzle > 0) {
        const flash = ctx.createRadialGradient(bodyW * 0.86, -bodyH * 0.04, 4, bodyW * 0.86, -bodyH * 0.04, bodyW * 0.26);
        flash.addColorStop(0, `rgba(255,255,232,${0.9 * fp.muzzle / 0.08})`);
        flash.addColorStop(0.45, `rgba(255,208,138,${0.55 * fp.muzzle / 0.08})`);
        flash.addColorStop(1, "rgba(255,184,112,0)");
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(bodyW * 0.86, -bodyH * 0.04, bodyW * 0.26, 0, TAU);
        ctx.fill();
      }
    } else {
      const bladeL = viewport.w * 0.1 * aimPull;
      ctx.fillStyle = sleeveColor;
      ctx.fillRect(-30, 8, 26, 18);
      ctx.fillStyle = handColor;
      ctx.fillRect(-12, 6, 12, 12);
      ctx.fillStyle = "rgba(24,28,33,0.96)";
      ctx.fillRect(-4, 2, 10, 18);
      ctx.fillStyle = "rgba(198,205,214,0.96)";
      ctx.beginPath();
      ctx.moveTo(2, 12);
      ctx.lineTo(bladeL, -22);
      ctx.lineTo(bladeL + 14, -8);
      ctx.lineTo(8, 18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFirstPersonHud(viewport, unit, fp) {
    const aim = getFirstPersonAimData(unit, getPlayerState(unit.owner));
    const centerX = viewport.x + viewport.w * 0.5;
    const centerY = viewport.y + viewport.h * 0.5;
    ctx.strokeStyle = fp.aiming ? "rgba(220,244,255,0.92)" : "rgba(255,226,154,0.9)";
    ctx.lineWidth = fp.aiming ? 1.4 : 2.2;
    ctx.beginPath();
    ctx.moveTo(centerX - 14, centerY);
    ctx.lineTo(centerX - 4, centerY);
    ctx.moveTo(centerX + 4, centerY);
    ctx.lineTo(centerX + 14, centerY);
    ctx.moveTo(centerX, centerY - 14);
    ctx.lineTo(centerX, centerY - 4);
    ctx.moveTo(centerX, centerY + 4);
    ctx.lineTo(centerX, centerY + 14);
    ctx.stroke();
    if (fp.hitTimer > 0) {
      const hitAlpha = clamp(fp.hitTimer / 0.24, 0, 1);
      ctx.strokeStyle = withAlpha(fp.hitColor || "#ffe29a", 0.9 * hitAlpha);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(centerX - 22, centerY - 22);
      ctx.lineTo(centerX - 10, centerY - 10);
      ctx.moveTo(centerX + 22, centerY - 22);
      ctx.lineTo(centerX + 10, centerY - 10);
      ctx.moveTo(centerX - 22, centerY + 22);
      ctx.lineTo(centerX - 10, centerY + 10);
      ctx.moveTo(centerX + 22, centerY + 22);
      ctx.lineTo(centerX + 10, centerY + 10);
      ctx.stroke();
      ctx.fillStyle = withAlpha(fp.hitColor || "#ffe29a", hitAlpha);
      ctx.font = "700 13px Cambria";
      ctx.textAlign = "center";
      ctx.fillText(`Hit ${fp.hitLabel} -${fp.hitDamage}`, centerX, centerY + 46);
      ctx.textAlign = "left";
    }

    roundRect(ctx, viewport.x + 18, viewport.y + 18, 238, 62, 18, "rgba(7,14,20,0.72)", "rgba(255,255,255,0.08)");
    ctx.fillStyle = ownerColors[unit.owner] || "#ffffff";
    ctx.font = "700 16px Cambria";
    ctx.fillText(getSelectionEntityName(unit), viewport.x + 34, viewport.y + 40);
    ctx.fillStyle = "#9db2be";
    ctx.font = "12px Cambria";
    ctx.fillText(unitSupportsAim(unit) ? "First-person control active" : "First-person melee control active", viewport.x + 34, viewport.y + 58);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(viewport.x + 34, viewport.y + 65, 172, 6);
    ctx.fillStyle = unit.hp / unit.maxHp > 0.45 ? "#7df2ab" : "#ff9b89";
    ctx.fillRect(viewport.x + 34, viewport.y + 65, 172 * clamp(unit.hp / unit.maxHp, 0, 1), 6);
    if (unit.lastHitTimer > 0) {
      const hurt = clamp(unit.lastHitTimer / 0.2, 0, 1);
      const hurtGrad = ctx.createRadialGradient(centerX, centerY, viewport.w * 0.18, centerX, centerY, viewport.w * 0.68);
      hurtGrad.addColorStop(0, "rgba(0,0,0,0)");
      hurtGrad.addColorStop(1, `rgba(140,20,18,${0.24 * hurt})`);
      ctx.fillStyle = hurtGrad;
      ctx.fillRect(viewport.x, viewport.y, viewport.w, viewport.h);
    }

    roundRect(ctx, centerX - 186, viewport.y + viewport.h - 58, 372, 36, 18, "rgba(7,14,20,0.68)", "rgba(255,255,255,0.08)");
    ctx.fillStyle = "#d5e2ea";
    ctx.font = "12px Cambria";
    ctx.textAlign = "center";
    ctx.fillText("WASD move | Shift sprint | Left mouse fire | Right mouse aim | Esc exit", centerX, viewport.y + viewport.h - 36);
    ctx.textAlign = "left";

    if (aim && aim.target) {
      const targetWidth = 176;
      roundRect(ctx, centerX - targetWidth * 0.5, centerY - 88, targetWidth, 34, 14, "rgba(7,14,20,0.74)", "rgba(255,255,255,0.08)");
      ctx.fillStyle = aim.target.owner ? ownerColors[aim.target.owner] || "#f3ece0" : "#f3ece0";
      ctx.font = "700 13px Cambria";
      ctx.textAlign = "center";
      ctx.fillText(getSelectionEntityName(aim.target), centerX, centerY - 67);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(centerX - 62, centerY - 60, 124, 4);
      ctx.fillStyle = "#ff9b89";
      ctx.fillRect(centerX - 62, centerY - 60, 124 * clamp((aim.target.hp || 0) / Math.max(1, aim.target.maxHp || aim.target.hp || 1), 0, 1), 4);
      ctx.textAlign = "left";
    }

    if (document.pointerLockElement !== canvas) {
      ctx.fillStyle = "rgba(7,14,20,0.74)";
      ctx.fillRect(centerX - 122, viewport.y + 94, 244, 26);
      ctx.fillStyle = "#ffdf99";
      ctx.font = "12px Cambria";
      ctx.textAlign = "center";
      ctx.fillText("Click inside the view to lock the mouse", centerX, viewport.y + 111);
      ctx.textAlign = "left";
    }
  }

  function drawFirstPersonView(player, viewport) {
    setActivePlayerContext(player, viewport);
    const unit = getFirstPersonUnit(player);
    if (!unit) {
      drawBackdrop(viewport.w, viewport.h, viewport.x, viewport.y);
      drawWorld();
      drawUi(viewport.w, viewport.h);
      drawControllerCursor(player);
      return;
    }
    const fp = getFirstPersonState(player);
    syncFirstPersonCamera(player, unit);
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewport.x, viewport.y, viewport.w, viewport.h);
    ctx.clip();
    drawFirstPersonBackdrop(viewport, unit, fp);
    drawFirstPersonGround(viewport, unit, fp);
    drawFirstPersonWorldObjects(viewport, unit, fp);
    drawFirstPersonWeaponOverlay(viewport, unit, fp);
    if (fp.muzzle > 0) {
      const flash = ctx.createRadialGradient(viewport.x + viewport.w * 0.72, viewport.y + viewport.h * 0.74, 18, viewport.x + viewport.w * 0.72, viewport.y + viewport.h * 0.74, viewport.w * 0.28);
      flash.addColorStop(0, `rgba(255,255,228,${0.18 * fp.muzzle / 0.08})`);
      flash.addColorStop(1, "rgba(255,210,150,0)");
      ctx.fillStyle = flash;
      ctx.fillRect(viewport.x, viewport.y, viewport.w, viewport.h);
    }
    drawFirstPersonHud(viewport, unit, fp);
    ctx.restore();
  }

  function drawEnvironmentShaders() {
    const mood = getEnvironmentMood();
    const visibleRadius = getVisibleWorldRadius(TILE_SIZE * 3);
    const left = state.camera.x - visibleRadius;
    const top = state.camera.y - visibleRadius;
    const size = visibleRadius * 2;
    const lightSweep = Math.sin(state.time * 0.11) * 0.5 + 0.5;
    const waterCullRadius = visibleRadius + TILE_SIZE * 2.4;
    const heatCullRadius = visibleRadius + TILE_SIZE * 2.4;
    const shadeCullRadius = visibleRadius + TILE_SIZE * 2.2;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const sunWash = ctx.createLinearGradient(left - visibleRadius * 0.18 + lightSweep * 160, top, left + size, top + size);
    sunWash.addColorStop(0, mood.groundWash);
    sunWash.addColorStop(0.44, "rgba(255,255,255,0.03)");
    sunWash.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sunWash;
    ctx.fillRect(left, top, size, size);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const edgeShade = ctx.createRadialGradient(state.camera.x, state.camera.y - visibleRadius * 0.08, visibleRadius * 0.12, state.camera.x, state.camera.y, visibleRadius * 1.02);
    edgeShade.addColorStop(0, "rgba(0,0,0,0)");
    edgeShade.addColorStop(0.74, "rgba(0,0,0,0.03)");
    edgeShade.addColorStop(1, mood.groundShade);
    ctx.fillStyle = edgeShade;
    ctx.fillRect(left, top, size, size);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2 / Math.max(0.45, state.camera.zoom);
    for (const tile of state.world.tiles) {
      if (Math.abs(tile.x - state.camera.x) > waterCullRadius || Math.abs(tile.y - state.camera.y) > waterCullRadius || !wetBiomes.has(tile.biome)) continue;
      const sx = tile.x - TILE_SIZE / 2;
      const sy = tile.y - TILE_SIZE / 2;
      const phase = state.time * (tile.biome === "river" ? 2.2 : 1.6) + tile.gx * 0.8 + tile.gy * 1.15;
      ctx.globalAlpha = tile.biome === "river" ? 0.68 : 0.4;
      ctx.strokeStyle = tile.biome === "river" ? mood.water : "rgba(213,240,207,0.18)";
      for (let i = 0; i < 3; i += 1) {
        const waveY = sy + TILE_SIZE * (0.22 + i * 0.23) + Math.sin(phase + i * 1.55) * 4.8;
        ctx.beginPath();
        ctx.moveTo(sx + 8, waveY);
        ctx.bezierCurveTo(sx + TILE_SIZE * 0.28, waveY - 4, sx + TILE_SIZE * 0.64, waveY + 5, sx + TILE_SIZE - 8, waveY + Math.cos(phase + i) * 2.6);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const tile of state.world.tiles) {
      if (
        Math.abs(tile.x - state.camera.x) > heatCullRadius ||
        Math.abs(tile.y - state.camera.y) > heatCullRadius ||
        (tile.biome !== "desert" && tile.biome !== "canyon" && tile.biome !== "deadlands")
      ) continue;
      const sx = tile.x - TILE_SIZE / 2;
      const sy = tile.y - TILE_SIZE / 2;
      const phase = state.time * 1.35 + tile.gx * 0.74 + tile.gy * 0.51;
      ctx.globalAlpha = tile.biome === "desert" ? 0.42 : tile.biome === "canyon" ? 0.3 : 0.24;
      ctx.fillStyle = tile.biome === "deadlands" ? "rgba(190,142,172,0.14)" : mood.heat;
      for (let i = 0; i < 2; i += 1) {
        const x = sx + TILE_SIZE * (0.24 + i * 0.32) + Math.sin(phase + i * 1.2) * 7;
        ctx.beginPath();
        ctx.moveTo(x, sy + 10);
        ctx.bezierCurveTo(x + 10, sy + TILE_SIZE * 0.24, x - 6, sy + TILE_SIZE * 0.74, x + 12, sy + TILE_SIZE - 10);
        ctx.lineTo(x + 24, sy + TILE_SIZE - 10);
        ctx.bezierCurveTo(x + 10, sy + TILE_SIZE * 0.76, x + 24, sy + TILE_SIZE * 0.28, x + 12, sy + 10);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    for (const tile of state.world.tiles) {
      if (
        Math.abs(tile.x - state.camera.x) > shadeCullRadius ||
        Math.abs(tile.y - state.camera.y) > shadeCullRadius ||
        (tile.biome !== "forest" && tile.biome !== "hill")
      ) continue;
      const phase = state.time * 0.65 + tile.gx * 0.38 + tile.gy * 0.52;
      ctx.fillStyle = tile.biome === "forest" ? "rgba(10,24,15,0.08)" : "rgba(58,42,24,0.05)";
      ctx.beginPath();
      ctx.ellipse(tile.x + Math.sin(phase) * 4, tile.y + TILE_SIZE * 0.08, TILE_SIZE * 0.28, TILE_SIZE * 0.13, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const focusGlow = ctx.createRadialGradient(state.camera.x, state.camera.y - visibleRadius * 0.26, 18, state.camera.x, state.camera.y, visibleRadius);
    focusGlow.addColorStop(0, mood.horizon);
    focusGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = focusGlow;
    ctx.fillRect(left, top, size, size);
    ctx.restore();
  }

  function drawWorld() {
    const viewport = state.activeViewport || getViewportForPlayer();
    ctx.save();
    ctx.translate(viewport.x + viewport.w / 2, viewport.y + viewport.h / 2);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.rotate(state.camera.rotation);
    ctx.translate(-state.camera.x, -state.camera.y);

    ctx.drawImage(mapCanvas, -HALF_WORLD, -HALF_WORLD, WORLD_SIZE, WORLD_SIZE);
    drawEnvironmentShaders();
    drawGrid();
    drawResources();
    drawDrops();
    drawBuildings();
    drawCommandLinks();
    drawUnits();
    drawProjectiles();
    drawEffects();
    drawHoveredEnemyHighlights();
    drawPlacementGhost();
    drawSelectionWorld();
    drawFogOfWar();
    drawAdminPoints();
    ctx.restore();
  }

  function drawFogOfWar() {
    const player = getActivePlayerState();
    if (!player || !player.fog) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(player.fog.maskCanvas, -HALF_WORLD, -HALF_WORLD, WORLD_SIZE, WORLD_SIZE);
    ctx.restore();
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1 / state.camera.zoom;
    for (let i = -HALF_WORLD; i <= HALF_WORLD; i += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(i, -HALF_WORLD);
      ctx.lineTo(i, HALF_WORLD);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-HALF_WORLD, i);
      ctx.lineTo(HALF_WORLD, i);
      ctx.stroke();
    }
  }

  function drawResourceAccentSprite(resource, key, x, y, width, height, alpha = 0.94) {
    if (!resource || !key) return false;
    return drawSpriteFromGroup("resources", key, x, y, width, height, 0, alpha);
  }

  function drawResources() {
    for (const tree of state.world.trees) {
      const chunkRatio = ((tree.chunksRemaining - 1) + clamp((tree.chunkHp || tree.chunkMaxHp) / Math.max(1, tree.chunkMaxHp || 1), 0, 1)) / Math.max(1, tree.maxChunks || tree.chunksRemaining || 1);
      const canopyRadius = (tree.baseRadius || tree.radius) * (0.58 + chunkRatio * 0.42);
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.beginPath();
      ctx.ellipse(tree.x, tree.y + 10, canopyRadius * 0.8, canopyRadius * 0.45, 0, 0, TAU);
      ctx.fill();
      if (tree.accentKey) {
        drawResourceAccentSprite(
          tree,
          tree.accentKey,
          tree.x + (tree.accentOffsetX || 0),
          tree.y + (tree.accentOffsetY || 0),
          canopyRadius * 1.28,
          canopyRadius * 0.98,
          0.92,
        );
      }
      const drewTreeSprite = drawSpriteFromGroup(
        "resources",
        tree.spriteKey || "tree_1",
        tree.x,
        tree.y - canopyRadius * 0.16,
        canopyRadius * 2.08,
        canopyRadius * 2.42,
        0,
        1,
      );
      if (!drewTreeSprite) {
        ctx.fillStyle = "#4b2f20";
        ctx.fillRect(tree.x - 3, tree.y - 4, 6, 18);
        const leaf = ctx.createRadialGradient(tree.x, tree.y - 12, 8, tree.x, tree.y - 8, canopyRadius);
        leaf.addColorStop(0, "#7fbc74");
        leaf.addColorStop(0.55, "#4b8048");
        leaf.addColorStop(1, "#224127");
        ctx.fillStyle = leaf;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y - 8, canopyRadius, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < (tree.chunksRemaining || 0); i += 1) {
        ctx.fillStyle = "#f2d889";
        ctx.beginPath();
        ctx.arc(tree.x - 8 + i * 8, tree.y - canopyRadius - 12, 2.6, 0, TAU);
        ctx.fill();
      }
      if (tree.lastWorkedTimer > 0) {
        ctx.strokeStyle = `rgba(255,214,145,${0.34 + tree.lastWorkedTimer})`;
        ctx.lineWidth = 3 / state.camera.zoom;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y - 8, canopyRadius + 6, 0, TAU);
        ctx.stroke();
      }
    }
    for (const rock of state.world.rocks) {
      const chunkRatio = ((rock.chunksRemaining - 1) + clamp((rock.chunkHp || rock.chunkMaxHp) / Math.max(1, rock.chunkMaxHp || 1), 0, 1)) / Math.max(1, rock.maxChunks || rock.chunksRemaining || 1);
      const rockRadius = (rock.baseRadius || rock.radius) * (0.58 + chunkRatio * 0.42);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(rock.x, rock.y + 10, rockRadius * 0.8, rockRadius * 0.42, 0, 0, TAU);
      ctx.fill();
      if (rock.accentKey) {
        drawResourceAccentSprite(
          rock,
          rock.accentKey,
          rock.x + (rock.accentOffsetX || 0),
          rock.y + (rock.accentOffsetY || 0),
          rockRadius * 1.36,
          rockRadius * 0.9,
          0.92,
        );
      }
      const drewRockSprite = drawSpriteFromGroup(
        "resources",
        rock.spriteKey || "rock_1",
        rock.x,
        rock.y - rockRadius * 0.1,
        rockRadius * 2.2,
        rockRadius * 1.72,
        0,
        1,
      );
      if (!drewRockSprite) {
        ctx.fillStyle = "#7e838a";
        ctx.beginPath();
        ctx.moveTo(rock.x - rockRadius * 0.8, rock.y + rockRadius * 0.4);
        ctx.lineTo(rock.x - rockRadius * 0.25, rock.y - rockRadius * 0.8);
        ctx.lineTo(rock.x + rockRadius * 0.5, rock.y - rockRadius * 0.48);
        ctx.lineTo(rock.x + rockRadius * 0.82, rock.y + rockRadius * 0.42);
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < (rock.chunksRemaining || 0); i += 1) {
        ctx.fillStyle = "#dfe8ef";
        ctx.beginPath();
        ctx.arc(rock.x - 9 + i * 7, rock.y - rockRadius - 11, 2.4, 0, TAU);
        ctx.fill();
      }
      if (rock.lastWorkedTimer > 0) {
        ctx.strokeStyle = `rgba(228,240,248,${0.26 + rock.lastWorkedTimer})`;
        ctx.lineWidth = 3 / state.camera.zoom;
        ctx.beginPath();
        ctx.arc(rock.x, rock.y - 2, rockRadius + 5, 0, TAU);
        ctx.stroke();
      }
    }
    for (const animal of state.world.animals) drawAnimal(animal);
    for (const civilian of state.world.civilians) drawCivilian(civilian);
  }

  function drawAnimal(animal) {
    if (drawSpriteFromGroup("units", animal.species, animal.x, animal.y, animal.radius * 3.2, animal.radius * 3.2, 0, 1)) {
      return;
    }
    const body = animal.species === "deer" ? "#bf8e62" : "#5a3d28";
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(animal.x, animal.y + 8, 15, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(animal.x, animal.y, 13, 8, 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = animal.species === "deer" ? "#d6b08a" : "#7a5740";
    ctx.beginPath();
    ctx.arc(animal.x + 8, animal.y - 2, 4, 0, TAU);
    ctx.fill();
    ctx.fillRect(animal.x - 7, animal.y + 5, 2, 10);
    ctx.fillRect(animal.x + 5, animal.y + 5, 2, 10);
    if (animal.species === "deer") {
      ctx.strokeStyle = "#f1d7a3";
      ctx.lineWidth = 2 / state.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(animal.x + 9, animal.y - 5);
      ctx.lineTo(animal.x + 16, animal.y - 16);
      ctx.moveTo(animal.x + 7, animal.y - 6);
      ctx.lineTo(animal.x + 11, animal.y - 18);
      ctx.stroke();
    }
  }

  function drawCivilian(civilian) {
    if (drawSpriteFromGroup("units", "civilian", civilian.x, civilian.y, 34, 34, 0, 1)) {
      if ((civilian.coinPouch || 0) > 1) {
        ctx.fillStyle = `rgba(255,216,137,${0.4 + clamp((civilian.coinPouch || 0) / Math.max(1, civilian.maxCoinPouch || 1), 0, 1) * 0.6})`;
        ctx.beginPath();
        ctx.arc(civilian.x + 10, civilian.y - 16, 4, 0, TAU);
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(civilian.x, civilian.y + 8, 9, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#d7d4c8";
    ctx.beginPath();
    ctx.arc(civilian.x, civilian.y - 4, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#7f5f44";
    ctx.lineWidth = 4 / state.camera.zoom;
    ctx.beginPath();
    ctx.moveTo(civilian.x, civilian.y - 1);
    ctx.lineTo(civilian.x, civilian.y + 12);
    ctx.moveTo(civilian.x - 4, civilian.y + 3);
    ctx.lineTo(civilian.x + 4, civilian.y + 3);
    ctx.stroke();
    if ((civilian.coinPouch || 0) > 1) {
      ctx.fillStyle = `rgba(255,216,137,${0.4 + clamp((civilian.coinPouch || 0) / Math.max(1, civilian.maxCoinPouch || 1), 0, 1) * 0.6})`;
      ctx.beginPath();
      ctx.arc(civilian.x + 8, civilian.y - 14, 4, 0, TAU);
      ctx.fill();
    }
  }

  function drawDrops() {
    for (const drop of state.world.drops) {
      const bobY = Math.sin(drop.bob) * 4;
      if (drawSpriteFromGroup("units", drop.def.id, drop.x, drop.y + bobY, 34, 34, 0, 1)) {
        const glow = ctx.createRadialGradient(drop.x, drop.y + bobY, 4, drop.x, drop.y + bobY, drop.radius * 2.2);
        glow.addColorStop(0, withAlpha(drop.def.tint, 0.65));
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y + bobY, drop.radius * 1.8, 0, TAU);
        ctx.fill();
        continue;
      }
      ctx.save();
      ctx.translate(drop.x, drop.y + bobY);
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, drop.radius * 2.2);
      glow.addColorStop(0, withAlpha(drop.def.tint, 0.75));
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, drop.radius * 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(0, 11, 14, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = drop.def.tint;
      ctx.beginPath();
      ctx.roundRect(-12, -12, 24, 24, 6);
      ctx.fill();
      ctx.fillStyle = "#091118";
      if (drop.def.id === "axe") {
        ctx.fillRect(-1, -8, 4, 16);
        ctx.beginPath();
        ctx.moveTo(-9, -2);
        ctx.lineTo(4, -10);
        ctx.lineTo(7, -4);
        ctx.closePath();
        ctx.fill();
      } else if (drop.def.id === "sword") {
        ctx.fillRect(-2, -9, 4, 18);
        ctx.fillRect(-7, 6, 14, 3);
      } else {
        ctx.fillRect(-8, -2, 16, 6);
        ctx.fillRect(3, -6, 9, 3);
      }
      ctx.restore();
    }
  }

  function drawCommandLinks() {
    const selectedUnits = state.world.units.filter((unit) => state.selectedIds.has(unit.id));
    if (!selectedUnits.length) return;
    ctx.save();
    ctx.lineWidth = 2 / state.camera.zoom;
    ctx.setLineDash([12 / state.camera.zoom, 10 / state.camera.zoom]);
    for (const unit of selectedUnits) {
      const target = unit.targetId ? getEntityById(unit.targetId) : null;
      const interactionTarget = unit.interactTargetId ? getInteractionTargetById(unit.interactTargetId, unit.interactKind) : null;
      const destination = target ? { x: target.x, y: target.y } : interactionTarget ? { x: interactionTarget.x, y: interactionTarget.y } : unit.moveTarget;
      if (!destination) continue;
      ctx.strokeStyle = target
        ? "rgba(255,150,132,0.8)"
        : interactionTarget
          ? unit.interactKind === "tax"
            ? "rgba(255,216,137,0.84)"
            : "rgba(157,226,145,0.8)"
          : "rgba(125,242,171,0.7)";
      ctx.beginPath();
      ctx.moveTo(unit.x, unit.y);
      ctx.lineTo(destination.x, destination.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHoveredEnemyHighlights() {
    if (!state.ui.hoveredEnemyIds.length) return;
    ctx.save();
    ctx.lineWidth = 3 / state.camera.zoom;
    for (let i = 0; i < state.ui.hoveredEnemyIds.length; i += 1) {
      const entity = getEntityById(state.ui.hoveredEnemyIds[i]);
      if (!entity) continue;
      const size = entity.radius + 12 + i * 2;
      ctx.strokeStyle = i === 0 ? "#ffdf92" : "rgba(255,168,144,0.9)";
      ctx.beginPath();
      ctx.rect(entity.x - size, entity.y - size, size * 2, size * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBuildings() {
    for (const building of state.world.buildings) {
      ctx.save();
      ctx.translate(building.x, building.y);
      ctx.rotate(building.angle);
      const selected = state.selectedIds.has(building.id);
      const hit = building.lastHitTimer > 0;
      const ownerColor = ownerColors[building.owner] || "#d5d5d5";
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(0, building.radius * 0.55, building.radius * 0.94, building.radius * 0.42, 0, 0, TAU);
      ctx.fill();
      drawBuildingModel(building, ownerColor, hit);
      drawHealthRing(building, selected);
      if (building.owner === "neutral" && building.maxTaxReserve) {
        const meterWidth = building.radius * 1.4;
        ctx.fillStyle = "rgba(8,12,14,0.55)";
        ctx.fillRect(-meterWidth / 2, -building.radius - 18, meterWidth, 5);
        ctx.fillStyle = "#ffd889";
        ctx.fillRect(-meterWidth / 2, -building.radius - 18, meterWidth * clamp((building.taxReserve || 0) / Math.max(1, building.maxTaxReserve || 1), 0, 1), 5);
      }
      ctx.restore();
    }
  }

  function drawBuildingModel(building, ownerColor, hit) {
    const size = building.radius * 1.9;
    const tint = hit ? "#ffd2b6" : null;
    const spriteSize = getAssetSpriteSize(building, size);
    if (drawSpriteFromGroup("assets", building.itemId, 0, 0, spriteSize.w, spriteSize.h, 0, hit ? 0.88 : 1, building.spriteVariantSeed || building.placementIndex || 0)) {
      drawBanner(ownerColor, size * 0.26, -size * 0.44, size * 0.3);
      return;
    }
    if (building.def.style === "tower" || building.def.style === "radar") {
      ctx.fillStyle = tint || "#9d9688";
      ctx.beginPath();
      ctx.moveTo(-size * 0.16, -size * 0.66);
      ctx.lineTo(size * 0.18, -size * 0.66);
      ctx.lineTo(size * 0.28, size * 0.32);
      ctx.lineTo(-size * 0.28, size * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#7a7367";
      ctx.fillRect(-size * 0.34, -size * 0.72, size * 0.68, size * 0.16);
    } else if (building.def.style === "wall" || building.def.style === "capital-wall") {
      ctx.fillStyle = building.def.style === "capital-wall" ? "#73818c" : "#a7a29b";
      ctx.fillRect(-size * 0.55, -size * 0.18, size * 1.1, size * 0.36);
      ctx.fillStyle = building.def.style === "capital-wall" ? "#5a636c" : "#807b74";
      for (let i = -2; i <= 2; i += 1) ctx.fillRect(i * size * 0.2 - size * 0.05, -size * 0.24, size * 0.1, size * 0.12);
    } else if (building.def.style === "bridge" || building.def.style === "dock") {
      ctx.fillStyle = "#977754";
      ctx.fillRect(-size * 0.68, -size * 0.14, size * 1.36, size * 0.28);
      ctx.strokeStyle = "#caa879";
      ctx.lineWidth = 2 / state.camera.zoom;
      ctx.strokeRect(-size * 0.68, -size * 0.14, size * 1.36, size * 0.28);
    } else if (building.def.style === "bunker" || building.def.style === "cannon" || building.def.style === "mortar") {
      ctx.fillStyle = "#69747d";
      ctx.fillRect(-size * 0.56, -size * 0.2, size * 1.12, size * 0.4);
      ctx.fillStyle = "#485157";
      ctx.fillRect(-size * 0.22, -size * 0.34, size * 0.44, size * 0.2);
      if (building.def.style === "cannon") ctx.fillRect(-size * 0.08, -size * 0.42, size * 0.64, size * 0.12);
      if (building.def.style === "mortar") {
        ctx.strokeStyle = "#c4ced5";
        ctx.lineWidth = 6 / state.camera.zoom;
        ctx.beginPath();
        ctx.arc(0, -size * 0.08, size * 0.18, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      }
    } else if (building.def.style === "keep" || building.def.style === "academy" || building.def.style === "command") {
      ctx.fillStyle = tint || "#beb8af";
      ctx.fillRect(-size * 0.56, -size * 0.36, size * 1.12, size * 0.72);
      ctx.fillStyle = "#8d8378";
      ctx.fillRect(-size * 0.5, -size * 0.64, size * 0.22, size * 0.28);
      ctx.fillRect(size * 0.28, -size * 0.64, size * 0.22, size * 0.28);
      ctx.fillRect(-size * 0.08, -size * 0.78, size * 0.16, size * 0.42);
      ctx.fillStyle = "#6f665d";
      ctx.fillRect(-size * 0.2, size * 0.05, size * 0.4, size * 0.24);
      if (building.def.style === "command") {
        ctx.fillStyle = "#ebcf88";
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.98);
        ctx.lineTo(size * 0.12, -size * 0.74);
        ctx.lineTo(-size * 0.12, -size * 0.74);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = tint || "#d8d1c2";
      ctx.fillRect(-size * 0.46, -size * 0.18, size * 0.92, size * 0.42);
      ctx.fillStyle = building.def.style === "market" ? "#c7764f" : building.def.style === "plant" || building.def.style === "refinery" ? "#5d6774" : building.def.style === "hospital" ? "#556c7c" : building.def.style === "chapel" ? "#8a8580" : building.def.style === "stable" ? "#6f5337" : building.def.style === "archery" ? "#7d6447" : building.def.style === "lumber" ? "#5b3d28" : "#8d6c5c";
      ctx.beginPath();
      ctx.moveTo(-size * 0.58, -size * 0.04);
      ctx.lineTo(0, -size * 0.54);
      ctx.lineTo(size * 0.58, -size * 0.04);
      ctx.lineTo(0, size * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.moveTo(-size * 0.08, -size * 0.42);
      ctx.lineTo(0, -size * 0.54);
      ctx.lineTo(size * 0.26, -size * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#6d4e35";
      ctx.fillRect(-size * 0.08, 0.02 * size, size * 0.16, size * 0.16);
      ctx.fillStyle = "#dfeef6";
      ctx.fillRect(-size * 0.28, -size * 0.02, size * 0.12, size * 0.1);
      ctx.fillRect(size * 0.16, -size * 0.02, size * 0.12, size * 0.1);
      ctx.fillStyle = "#7f6c4f";
      ctx.fillRect(size * 0.18, -size * 0.32, size * 0.1, size * 0.18);
      if (building.def.style === "hospital") {
        ctx.fillStyle = "#ff6969";
        ctx.fillRect(-size * 0.08, -size * 0.1, size * 0.16, size * 0.44);
        ctx.fillRect(-size * 0.22, size * 0.05, size * 0.44, size * 0.16);
      }
      if (building.def.style === "farm") {
        ctx.fillStyle = "#d4bf68";
        ctx.fillRect(-size * 0.6, size * 0.22, size * 1.2, size * 0.16);
      }
      if (building.def.style === "quarry") {
        ctx.fillStyle = "#6f7478";
        ctx.fillRect(-size * 0.12, -size * 0.42, size * 0.24, size * 0.52);
      }
    }
    drawBanner(ownerColor, size * 0.24, -size * 0.46, size * 0.34);
  }

  function drawBanner(color, x, y, height) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, height * 0.18, height);
    ctx.beginPath();
    ctx.moveTo(x + height * 0.18, y);
    ctx.lineTo(x + height * 0.72, y + height * 0.18);
    ctx.lineTo(x + height * 0.18, y + height * 0.34);
    ctx.closePath();
    ctx.fill();
  }

  function drawHealthRing(entity, selected) {
    const r = entity.radius + 8;
    ctx.lineWidth = 5 / state.camera.zoom;
    ctx.strokeStyle = selected ? "#ffe9a3" : "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = entity.owner ? ownerColors[entity.owner] || "#d7d7d7" : "#d7d7d7";
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(entity.hp / entity.maxHp, 0, 1));
    ctx.stroke();
  }

  function drawUnits() {
    for (const unit of state.world.units) {
      ctx.save();
      ctx.translate(unit.x, unit.y - unit.z);
      ctx.rotate(unit.angle || 0);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(0, unit.z + unit.radius * 0.9, unit.radius * 0.9, unit.radius * 0.46, 0, 0, TAU);
      ctx.fill();
      drawUnitModel(unit);
      if (state.selectedIds.has(unit.id)) drawSelectionHalo(unit);
      drawFloatingHealth(unit);
      ctx.restore();
    }
  }

  function drawUnitModel(unit) {
    const color = ownerColors[unit.owner] || "#ffffff";
    const hitTint = unit.lastHitTimer > 0 ? "#fff1d5" : null;
    const spriteKey = getUnitSpriteKey(unit);
    if (spriteKey) {
      const width = unit.type === "vehicle" ? unit.radius * 3.9 : unit.airborne ? unit.radius * 4.1 : unit.radius * 3.2;
      const height = unit.type === "vehicle" ? unit.radius * 3.4 : unit.airborne ? unit.radius * 3.7 : unit.radius * 3.2;
      if (drawSpriteFromGroup("units", spriteKey, 0, 0, width, height, unit.type === "vehicle" || unit.airborne || unit.role === "knight" ? unit.angle : unit.angle, hitTint ? 0.9 : 1)) {
        if (unit.pickupWeapon) {
          ctx.fillStyle = "#ffe29a";
          ctx.fillRect(-unit.radius * 0.16, -unit.radius * 1.08, unit.radius * 0.32, 4);
        }
        drawBanner(color, -unit.radius * 0.82, -unit.radius * 1.08, unit.radius * 0.46);
        return;
      }
    }
    if (unit.type === "vehicle" || unit.role.toLowerCase().includes("tank") || unit.role === "hovercraft") {
      ctx.fillStyle = "#30353b";
      ctx.fillRect(-unit.radius * 0.98, -unit.radius * 0.62, unit.radius * 0.26, unit.radius * 1.24);
      ctx.fillRect(unit.radius * 0.72, -unit.radius * 0.62, unit.radius * 0.26, unit.radius * 1.24);
      ctx.fillStyle = hitTint || "#5f6d72";
      ctx.beginPath();
      ctx.roundRect(-unit.radius * 0.76, -unit.radius * 0.56, unit.radius * 1.52, unit.radius * 1.12, 4);
      ctx.fill();
      ctx.fillStyle = "#7c8e95";
      ctx.beginPath();
      ctx.roundRect(-unit.radius * 0.38, -unit.radius * 0.64, unit.radius * 0.76, unit.radius * 0.54, 4);
      ctx.fill();
      ctx.fillStyle = "#303b40";
      ctx.fillRect(unit.radius * 0.05, -unit.radius * 0.07, unit.radius * 1.08, unit.radius * 0.14);
      if (unit.role === "hovercraft") {
        ctx.strokeStyle = "#9be2ff";
        ctx.lineWidth = 3 / state.camera.zoom;
        ctx.beginPath();
        ctx.arc(0, 0, unit.radius * 0.95, 0, TAU);
        ctx.stroke();
      }
      if (unit.role === "rocketTruck" || unit.role === "missileCarrier") ctx.fillRect(-unit.radius * 0.2, -unit.radius * 0.92, unit.radius * 0.9, unit.radius * 0.22);
    } else if (unit.airborne) {
      ctx.fillStyle = hitTint || "#93a5b3";
      ctx.beginPath();
      ctx.ellipse(0, 0, unit.radius * 1.1, unit.radius * 0.52, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#d4e4f2";
      ctx.lineWidth = 4 / state.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(-unit.radius * 0.8, 0);
      ctx.lineTo(unit.radius * 0.8, 0);
      ctx.stroke();
      if (unit.role === "copter") {
        ctx.strokeStyle = "#43525a";
        ctx.beginPath();
        ctx.moveTo(-unit.radius * 1.1, -unit.radius * 0.76);
        ctx.lineTo(unit.radius * 1.1, -unit.radius * 0.76);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = hitTint || "#eadcc5";
      ctx.beginPath();
      ctx.arc(0, -unit.radius * 0.52, unit.radius * 0.32, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 5 / state.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(0, -unit.radius * 0.12);
      ctx.lineTo(0, unit.radius * 0.78);
      ctx.moveTo(-unit.radius * 0.5, unit.radius * 0.08);
      ctx.lineTo(unit.radius * 0.5, unit.radius * 0.08);
      ctx.stroke();
      ctx.fillStyle = "rgba(12,16,20,0.5)";
      ctx.beginPath();
      ctx.roundRect(-unit.radius * 0.18, -unit.radius * 0.08, unit.radius * 0.36, unit.radius * 0.46, 2);
      ctx.fill();
      if (unit.role === "archer") {
        ctx.strokeStyle = "#e6bc75";
        ctx.lineWidth = 3 / state.camera.zoom;
        ctx.beginPath();
        ctx.arc(unit.radius * 0.28, -unit.radius * 0.1, unit.radius * 0.24, -1.2, 1.2);
        ctx.stroke();
      } else if (unit.role === "knight") {
        ctx.strokeStyle = "#d8d8d8";
        ctx.beginPath();
        ctx.moveTo(unit.radius * 0.22, unit.radius * 0.12);
        ctx.lineTo(unit.radius * 0.78, -unit.radius * 0.46);
        ctx.stroke();
      } else if (unit.role === "musketeer" || unit.role === "marine") {
        ctx.strokeStyle = "#8e6337";
        ctx.beginPath();
        ctx.moveTo(-unit.radius * 0.2, unit.radius * 0.04);
        ctx.lineTo(unit.radius * 0.76, -unit.radius * 0.18);
        ctx.stroke();
      }
      if (unit.pickupWeapon) {
        ctx.fillStyle = "#ffe29a";
        ctx.fillRect(-unit.radius * 0.16, -unit.radius * 1.08, unit.radius * 0.32, 4);
      }
    }
    drawBanner(color, -unit.radius * 0.8, -unit.radius * 1.1, unit.radius * 0.5);
  }

  function drawSelectionHalo(unit) {
    ctx.strokeStyle = "#ffe29a";
    ctx.lineWidth = 4 / state.camera.zoom;
    ctx.beginPath();
    ctx.arc(0, 0, unit.radius + 6, 0, TAU);
    ctx.stroke();
  }

  function drawFloatingHealth(unit) {
    const width = unit.radius * 2;
    ctx.fillStyle = "rgba(6,8,10,0.56)";
    ctx.fillRect(-width / 2, -unit.radius * 1.5, width, 5);
    const activeOwner = getActivePlayerState() && getActivePlayerState().owner;
    ctx.fillStyle = unit.owner === activeOwner ? "#7df2ab" : isHumanOwner(unit.owner) ? "#ff8a80" : "#ffb48a";
    ctx.fillRect(-width / 2, -unit.radius * 1.5, width * clamp(unit.hp / unit.maxHp, 0, 1), 5);
  }

  function drawProjectiles() {
    for (const projectile of state.world.projectiles) {
      const tint = projectile.projectileType === "pulse" ? "#7ef7ff" : projectile.projectileType === "rocket" || projectile.projectileType === "missile" ? "#ffb469" : "#e9e0c9";
      ctx.strokeStyle = tint;
      ctx.lineWidth = projectile.projectileType === "bullet" ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(projectile.x - projectile.vx * 0.018, projectile.y - projectile.z - projectile.vy * 0.018);
      ctx.lineTo(projectile.x, projectile.y - projectile.z);
      ctx.stroke();
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y - projectile.z, projectile.projectileType === "bullet" ? 2.5 : 4.5, 0, TAU);
      ctx.fill();
    }
  }

  function drawEffects() {
    for (const effect of state.world.effects) {
      const alpha = clamp(effect.ttl / effect.maxTtl, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (effect.type === "blast" || effect.type === "impact" || effect.type === "muzzle") {
        const glow = ctx.createRadialGradient(effect.x, effect.y, 4, effect.x, effect.y, effect.radius);
        glow.addColorStop(0, "rgba(255,246,219,0.95)");
        glow.addColorStop(0.35, effect.tint);
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1 - alpha * 0.2), 0, TAU);
        ctx.fill();
        const ringCount = effect.rings || 0;
        for (let ring = 0; ring < ringCount; ring += 1) {
          ctx.strokeStyle = withAlpha(effect.tint, 0.34 - ring * 0.08);
          ctx.lineWidth = (6 - ring) / state.camera.zoom;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (0.42 + ring * 0.24 + (1 - alpha) * 0.22), 0, TAU);
          ctx.stroke();
        }
      } else if (effect.type === "smoke") {
        const smoke = ctx.createRadialGradient(effect.x, effect.y, 4, effect.x, effect.y, effect.radius);
        smoke.addColorStop(0, "rgba(80,86,94,0.55)");
        smoke.addColorStop(1, "rgba(45,50,58,0)");
        ctx.fillStyle = smoke;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, TAU);
        ctx.fill();
      } else if (effect.type === "pickup" || effect.type === "dropPulse") {
        ctx.strokeStyle = effect.tint;
        ctx.lineWidth = 5 / state.camera.zoom;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1 - alpha * 0.18), 0, TAU);
        ctx.stroke();
      } else if (effect.type === "damageText") {
        ctx.fillStyle = withAlpha(effect.tint || "#ffe29a", alpha);
        ctx.font = `700 ${Math.round(16 / Math.max(0.5, state.camera.zoom))}px Cambria`;
        ctx.textAlign = "center";
        ctx.fillText(effect.text || "0", effect.x, effect.y);
        ctx.textAlign = "left";
      } else {
        ctx.strokeStyle = effect.tint;
        ctx.fillStyle = effect.tint;
        ctx.lineWidth = 6 / state.camera.zoom;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1 - alpha * 0.15), 0, TAU);
        if (effect.type === "nuke") ctx.fill(); else ctx.stroke();
        if (effect.type === "nuke") {
          ctx.strokeStyle = "rgba(255,232,180,0.34)";
          ctx.lineWidth = 12 / state.camera.zoom;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (0.56 + (1 - alpha) * 0.32), 0, TAU);
          ctx.stroke();
        }
      }
      if (effect.shards && effect.shards.length) {
        ctx.fillStyle = effect.tint;
        for (const shard of effect.shards) {
          ctx.globalAlpha = alpha * 0.72;
          ctx.beginPath();
          ctx.arc(shard.x, shard.y, shard.size * 0.2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  function drawPlacementGhost() {
    const item = getActivePlacement();
    if (!item) return;
    const viewport = state.activeViewport || getViewportForPlayer();
    if (state.input.mouseScreenY > viewport.y + viewport.h - 180) return;
    const owner = getActivePlayerState() && getActivePlayerState().owner;
    const blockReason = item.type === "ability" ? null : getPlacementBlockReason(item, state.input.mouseWorldX, state.input.mouseWorldY, owner);
    const blocked = Boolean(blockReason);
    const constraint = getPlacementConstraint(item, owner);
    if (constraint) {
      ctx.save();
      ctx.setLineDash([18 / state.camera.zoom, 12 / state.camera.zoom]);
      ctx.lineWidth = 3 / state.camera.zoom;
      ctx.strokeStyle = blocked ? "rgba(255,138,128,0.48)" : "rgba(125,242,171,0.38)";
      ctx.beginPath();
      ctx.arc(constraint.anchor.x, constraint.anchor.y, constraint.radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = blocked ? "rgba(255,138,128,0.16)" : "rgba(125,242,171,0.12)";
      ctx.beginPath();
      ctx.arc(constraint.anchor.x, constraint.anchor.y, constraint.anchor.radius + 16, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(state.input.mouseWorldX, state.input.mouseWorldY);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = blocked ? "#ff8a80" : "#7df2ab";
    ctx.fillStyle = blocked ? "rgba(255,138,128,0.18)" : "rgba(125,242,171,0.16)";
    const radius = (item.footprint ? TILE_SIZE * item.footprint : 100) * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSelectionWorld() {
    if (!state.ui.selectionBox) return;
    const box = state.ui.selectionBox;
    const a = screenToWorld(box.x, box.y);
    const b = screenToWorld(box.x + box.w, box.y + box.h);
    ctx.save();
    ctx.fillStyle = "rgba(255,226,154,0.08)";
    ctx.strokeStyle = "#ffe29a";
    ctx.lineWidth = 2 / state.camera.zoom;
    ctx.setLineDash([18 / state.camera.zoom, 14 / state.camera.zoom]);
    const rx = Math.min(a.x, b.x);
    const ry = Math.min(a.y, b.y);
    const rw = Math.abs(b.x - a.x);
    const rh = Math.abs(b.y - a.y);
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }

  function drawAdminPoints() {
    if (!state.admin.points.length) return;
    ctx.save();
    ctx.textAlign = "center";
    for (let i = 0; i < state.admin.points.length; i += 1) {
      const point = state.admin.points[i];
      const pulse = 0.86 + Math.sin(state.time * 2.6 + i * 0.7) * 0.08;
      const radius = 18 / state.camera.zoom;
      ctx.fillStyle = withAlpha(point.tint || "#8fd8ff", 0.16);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 1.2 * pulse, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = withAlpha(point.tint || "#8fd8ff", 0.92);
      ctx.lineWidth = 2.2 / state.camera.zoom;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * pulse, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x - radius * 0.55, point.y);
      ctx.lineTo(point.x + radius * 0.55, point.y);
      ctx.moveTo(point.x, point.y - radius * 0.55);
      ctx.lineTo(point.x, point.y + radius * 0.55);
      ctx.stroke();
      const labelY = point.y - radius - 18 / state.camera.zoom;
      const labelW = Math.max(64 / state.camera.zoom, (point.label.length * 8.6) / state.camera.zoom);
      roundRect(ctx, point.x - labelW * 0.5, labelY - 11 / state.camera.zoom, labelW, 18 / state.camera.zoom, 8 / state.camera.zoom, "rgba(7,14,20,0.84)", withAlpha(point.tint || "#8fd8ff", 0.34));
      ctx.fillStyle = "#f1f6fa";
      ctx.font = `700 ${Math.round(12 / Math.max(0.48, state.camera.zoom))}px Cambria`;
      ctx.fillText(point.label, point.x, labelY + 2 / state.camera.zoom);
    }
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawUi(w, h) {
    drawTopHud(w);
    drawMinimap();
    drawQuestPanel(w);
    drawSelectionHud(w, h);
    if (state.ui.openPanel) drawCatalogPanel(state.ui.openPanel);
    drawBottomBar();
    drawNotifications();
    drawRecentMessage(w, h);
  }

  function roundRect(context, x, y, w, h, r, fill, stroke) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1.2;
      context.stroke();
    }
  }

  function drawHudStat(x, y, label, value, tint) {
    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "12px Cambria";
    ctx.fillText(label, x, y);
    ctx.fillStyle = tint;
    ctx.font = "700 20px Cambria";
    ctx.fillText(value, x, y + 22);
  }

  function getMinimapLayout() {
    const viewport = state.activeViewport || getViewportForPlayer();
    const scale = getUiScale();
    const mapSize = Math.min(viewport.w * 0.23, 146 * scale);
    const x = viewport.x + 22 * scale;
    const y = viewport.y + 18 * scale + 104 * scale + (isLanMatch() ? 30 : 16) * scale;
    return {
      panelX: x,
      panelY: y,
      panelW: mapSize + 24 * scale,
      panelH: mapSize + 38 * scale,
      mapX: x + 12 * scale,
      mapY: y + 20 * scale,
      mapW: mapSize,
      mapH: mapSize,
      scale,
    };
  }

  function drawMinimap() {
    const player = getActivePlayerState();
    if (!player || !player.fog) return;
    const layout = getMinimapLayout();
    roundRect(ctx, layout.panelX, layout.panelY, layout.panelW, layout.panelH, 20 * layout.scale, "rgba(8,16,23,0.76)", "rgba(104,215,255,0.18)");
    ctx.fillStyle = "rgba(235,241,244,0.86)";
    ctx.font = "700 13px Cambria";
    ctx.fillText("Minimap", layout.panelX + 14 * layout.scale, layout.panelY + 15 * layout.scale);
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.mapX, layout.mapY, layout.mapW, layout.mapH);
    ctx.clip();
    ctx.drawImage(mapCanvas, 0, 0, WORLD_SIZE, WORLD_SIZE, layout.mapX, layout.mapY, layout.mapW, layout.mapH);
    for (const building of state.world.buildings) {
      const point = worldToMinimap(building.x, building.y, { x: layout.mapX, y: layout.mapY, w: layout.mapW, h: layout.mapH });
      ctx.fillStyle = withAlpha(ownerColors[building.owner] || "#d5d5d5", building.itemId === "royal_keep" ? 0.95 : 0.78);
      const size = building.itemId === "royal_keep" ? 4.2 : building.def && (building.def.style === "wall" || building.def.style === "capital-wall") ? 2 : 3;
      ctx.fillRect(point.x - size * 0.5, point.y - size * 0.5, size, size);
    }
    for (const unit of state.world.units) {
      const point = worldToMinimap(unit.x, unit.y, { x: layout.mapX, y: layout.mapY, w: layout.mapW, h: layout.mapH });
      ctx.fillStyle = withAlpha(ownerColors[unit.owner] || "#ffffff", 0.8);
      ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
    }
    ctx.drawImage(player.fog.maskCanvas, layout.mapX, layout.mapY, layout.mapW, layout.mapH);
    const viewport = state.activeViewport || getViewportForPlayer();
    const cameraCorners = [
      screenToWorld(viewport.x, viewport.y),
      screenToWorld(viewport.x + viewport.w, viewport.y),
      screenToWorld(viewport.x + viewport.w, viewport.y + viewport.h),
      screenToWorld(viewport.x, viewport.y + viewport.h),
    ].map((point) => worldToMinimap(point.x, point.y, { x: layout.mapX, y: layout.mapY, w: layout.mapW, h: layout.mapH }));
    ctx.strokeStyle = "#ffe29a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cameraCorners[0].x, cameraCorners[0].y);
    for (let i = 1; i < cameraCorners.length; i += 1) ctx.lineTo(cameraCorners[i].x, cameraCorners[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(163,182,195,0.84)";
    ctx.font = "12px Cambria";
    ctx.fillText(`${getPlayerFogCoverage(player).toFixed(1)}% explored`, layout.panelX + 14 * layout.scale, layout.panelY + layout.panelH - 8 * layout.scale);
  }

  function drawTopHud() {
    const viewport = state.activeViewport || getViewportForPlayer();
    const scale = getUiScale();
    const panelW = 452 * scale;
    const panelH = 104 * scale;
    const player = getActivePlayerState();
    const coop = isCoopMatch();
    const campaign = state.matchType === "single";
    const competitiveTotals = !campaign && !coop ? getCompetitiveTotals(player.owner) : null;
    const x = viewport.x + 22 * scale;
    const y = viewport.y + 18 * scale;
    roundRect(ctx, x, y, panelW, panelH, 24 * scale, "rgba(10,18,25,0.72)", "rgba(214,174,99,0.22)");
    if (isImageReady(uiImages.coin)) {
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.drawImage(uiImages.coin, x + 4 * scale, y + 12 * scale, 24 * scale, 24 * scale);
      ctx.restore();
    }
    drawHudStat(x + 22 * scale, y + 20 * scale, "Coins", `${Math.floor(state.coins)}`, "#ffd889");
    drawHudStat(x + 120 * scale, y + 20 * scale, "Wood", `${Math.floor(state.wood)}`, "#9de291");
    drawHudStat(x + 212 * scale, y + 20 * scale, "Stone", `${Math.floor(state.stone)}`, "#b8c4cc");
    const waveLabel = campaign ? "Wave" : coop ? "Threat" : "Pressure";
    const waveValue = campaign
      ? `${state.waves.index + 1} / ${Math.ceil(state.waves.timer)}s`
      : coop ? `${countHostileUnits()} foe` : `${competitiveTotals.enemyUnits} foe`;
    drawHudStat(x + 322 * scale, y + 20 * scale, waveLabel, waveValue, campaign && state.waves.flash > 0 ? "#ffbf8d" : "#8fd4ff");
    drawHudStat(x + 22 * scale, y + 62 * scale, "Army", `${ownerUnitCount(player.owner)}`, "#7fd8ff");
    drawHudStat(x + 120 * scale, y + 62 * scale, "Build", `${ownerBuildingCount(player.owner)}`, "#ffd889");
    drawHudStat(
      x + 212 * scale,
      y + 62 * scale,
      campaign ? "Nations" : coop ? "Keeps" : competitiveTotals.opponents.length > 1 ? "Rivals" : "Enemy",
      `${campaign ? state.world.buildings.filter((b) => b.owner !== "player" && b.itemId === "royal_keep").length : coop ? countEnemyStrongholds() : competitiveTotals.opponents.length > 1 ? competitiveTotals.aliveOpponents.length : competitiveTotals.enemyBuildings}`,
      "#ff8a80",
    );
    drawHudStat(x + 322 * scale, y + 62 * scale, "Income", `+${getPassiveIncomeForOwner(player.owner)}`, "#9be7c5");
    if (isLanMatch()) {
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "600 12px Cambria";
      ctx.fillText(`LAN ${state.lan.role === "host" ? "HOST" : "JOINED"} • ${state.lan.roomCode || "-----"}`, x + 20 * scale, y + panelH + 18 * scale);
    }
  }

  function drawQuestPanel(w) {
    const viewport = state.activeViewport || getViewportForPlayer();
    const scale = getUiScale();
    const panelW = 360 * scale;
    const player = getActivePlayerState();
    const x = viewport.x + w - panelW - 24 * scale;
    const y = viewport.y + 20 * scale;
    const h = 188 * scale;
    roundRect(ctx, x, y, panelW, h, 24 * scale, "rgba(8,16,23,0.72)", "rgba(125,242,171,0.2)");
    if (isCompetitiveMatch()) {
      const competitiveTotals = getCompetitiveTotals(player.owner);
      const leader = getCompetitiveLeader(player.owner);
      ctx.fillStyle = "#ffd889";
      ctx.font = "700 18px Cambria";
      ctx.fillText(isLanMatch() ? "LAN Warfront" : "Warfront Status", x + 22 * scale, y + 28 * scale);
      const lines = competitiveTotals.opponents.length <= 1
        ? [
          `${player.label}: ${ownerBuildingCount(player.owner)} structures • ${ownerUnitCount(player.owner)} units`,
          `${getPlayerState(competitiveTotals.opponents[0]).label}: ${competitiveTotals.enemyBuildings} structures • ${competitiveTotals.enemyUnits} units`,
          "Destroy every enemy unit and structure to win.",
          "Pads: A select/click • B weapons • X assets • Y clear",
        ]
        : [
          `${player.label}: ${ownerBuildingCount(player.owner)} structures • ${ownerUnitCount(player.owner)} units`,
          `Rivals alive: ${competitiveTotals.aliveOpponents.length}/${competitiveTotals.opponents.length} • enemy forces: ${competitiveTotals.enemyBuildings + competitiveTotals.enemyUnits}`,
          leader ? `Front runner: ${getPlayerState(leader.owner).label} • ${leader.forceCount} total forces` : "Front runner: none",
          "Last empire standing wins the split-screen war.",
        ];
      lines.forEach((line, index) => {
        ctx.fillStyle = index < 2 ? "#f3eee2" : "#aab8c0";
        ctx.font = index < 2 ? "600 13px Cambria" : "12px Cambria";
        wrapText(line, x + 22 * scale, y + 56 * scale + index * 30 * scale, panelW - 44 * scale, 14 * scale);
      });
      return;
    }
    if (isCoopMatch()) {
      const allies = getHumanPlayers();
      const ally = allies.find((candidate) => candidate.owner !== player.owner) || player;
      const lines = allies.length <= 2
        ? [
          `${player.label}: ${ownerBuildingCount(player.owner)} structures • ${ownerUnitCount(player.owner)} units`,
          `${ally.label}: ${ownerBuildingCount(ally.owner)} structures • ${ownerUnitCount(ally.owner)} units`,
          `Enemy keeps: ${countEnemyStrongholds()} • hostile forces: ${countHostileBuildings() + countHostileUnits()}${countHardCamps() ? ` • camps: ${countHardCamps()}` : ""}`,
          `Difficulty: ${state.difficulty.mode === "easy" ? "Easy" : state.difficulty.mode === "hard" ? "Hard" : "Normal"}${isCeasefireActive() ? ` • ceasefire ${Math.ceil(state.difficulty.ceasefireTimer)}s` : ""}`,
          "Destroy both enemy keeps and every hostile survivor to win.",
        ]
        : [
          `${player.label}: ${ownerBuildingCount(player.owner)} structures • ${ownerUnitCount(player.owner)} units`,
          `Alliance: ${allies.length} empires • ${allies.reduce((sum, entry) => sum + ownerBuildingCount(entry.owner), 0)} structures • ${allies.reduce((sum, entry) => sum + ownerUnitCount(entry.owner), 0)} units`,
          `Enemy keeps: ${countEnemyStrongholds()} • hostile forces: ${countHostileBuildings() + countHostileUnits()}${countHardCamps() ? ` • camps: ${countHardCamps()}` : ""}`,
          `Difficulty: ${state.difficulty.mode === "easy" ? "Easy" : state.difficulty.mode === "hard" ? "Hard" : "Normal"}${isCeasefireActive() ? ` • ceasefire ${Math.ceil(state.difficulty.ceasefireTimer)}s` : ""}`,
          "Destroy both enemy keeps and every hostile survivor to win.",
        ];
      ctx.fillStyle = "#ffd889";
      ctx.font = "700 18px Cambria";
      ctx.fillText(isLanMatch() ? "LAN Co-op Front" : "Co-op Warfront", x + 22 * scale, y + 28 * scale);
      lines.forEach((line, index) => {
        ctx.fillStyle = index < 2 ? "#f3eee2" : index === 2 ? "#ffbca0" : "#aab8c0";
        ctx.font = index < 2 ? "600 13px Cambria" : "12px Cambria";
        wrapText(line, x + 22 * scale, y + 54 * scale + index * 24 * scale, panelW - 44 * scale, 13 * scale);
      });
      return;
    }
    ctx.fillStyle = "#ffd889";
    ctx.font = "700 18px Cambria";
    ctx.fillText("Campaign Quests", x + 22 * scale, y + 28 * scale);
    state.world.quests.slice(0, 4).forEach((quest, index) => {
      const qy = y + 54 * scale + index * 32 * scale;
      const progress = clamp(quest.progress / quest.target, 0, 1);
      ctx.fillStyle = quest.done ? "#7df2ab" : "#f3eee2";
      ctx.font = "600 13px Cambria";
      ctx.fillText(quest.title, x + 22 * scale, qy);
      ctx.fillStyle = "#aab8c0";
      ctx.font = "12px Cambria";
      ctx.fillText(`${Math.floor(quest.progress)}/${quest.target}  •  +${quest.reward} coins`, x + 22 * scale, qy + 14 * scale);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x + 22 * scale, qy + 18 * scale, panelW - 44 * scale, 8 * scale);
      ctx.fillStyle = quest.done ? "#7df2ab" : "#ffd889";
      ctx.fillRect(x + 22 * scale, qy + 18 * scale, (panelW - 44 * scale) * progress, 8 * scale);
    });
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let lineY = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, lineY);
        line = word;
        lineY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, lineY);
  }

  function getItemVisualTheme(item) {
    if (!item) {
      return {
        accent: "#9bb0bc",
        accentSoft: "#4a6170",
        panelTop: "rgba(26,35,42,0.96)",
        panelBottom: "rgba(9,13,17,0.98)",
        wellTop: "rgba(58,73,86,0.42)",
        wellBottom: "rgba(13,18,24,0.96)",
        edge: "#c8d1d8",
        shadow: "#364753",
        chipFill: "rgba(36,48,58,0.9)",
      };
    }
    if (item.tier != null) {
      if (["tower", "cannon", "mortar", "bunker", "wall", "capital-wall", "gate"].includes(item.style)) {
        return {
          accent: "#ffbf86",
          accentSoft: "#ff8c5a",
          panelTop: "rgba(52,33,22,0.96)",
          panelBottom: "rgba(16,11,9,0.98)",
          wellTop: "rgba(113,70,44,0.46)",
          wellBottom: "rgba(31,21,17,0.96)",
          edge: "#ffd1a3",
          shadow: "#a55633",
          chipFill: "rgba(93,52,31,0.92)",
        };
      }
      if (["market", "farm", "lumber", "quarry", "granary", "plant", "refinery"].includes(item.style)) {
        return {
          accent: "#9fe0a4",
          accentSoft: "#4b9f6d",
          panelTop: "rgba(21,42,29,0.96)",
          panelBottom: "rgba(8,14,12,0.98)",
          wellTop: "rgba(63,116,81,0.42)",
          wellBottom: "rgba(15,24,18,0.96)",
          edge: "#c7efc4",
          shadow: "#35654a",
          chipFill: "rgba(36,74,50,0.92)",
        };
      }
      if (["radar", "bridge", "dock"].includes(item.style)) {
        return {
          accent: "#9fd8ff",
          accentSoft: "#4b88ac",
          panelTop: "rgba(18,35,47,0.96)",
          panelBottom: "rgba(8,13,20,0.98)",
          wellTop: "rgba(58,98,124,0.4)",
          wellBottom: "rgba(14,20,28,0.96)",
          edge: "#cde9ff",
          shadow: "#35607e",
          chipFill: "rgba(31,62,83,0.92)",
        };
      }
      return {
        accent: "#ffe29a",
        accentSoft: "#b98a45",
        panelTop: "rgba(43,36,21,0.96)",
        panelBottom: "rgba(14,12,9,0.98)",
        wellTop: "rgba(110,90,45,0.4)",
        wellBottom: "rgba(24,21,16,0.96)",
        edge: "#fff0be",
        shadow: "#7a602f",
        chipFill: "rgba(79,62,28,0.92)",
      };
    }
    if (item.type === "ability") {
      return {
        accent: "#ffb27a",
        accentSoft: "#ff744d",
        panelTop: "rgba(54,28,18,0.96)",
        panelBottom: "rgba(18,10,9,0.98)",
        wellTop: "rgba(132,74,49,0.44)",
        wellBottom: "rgba(30,17,16,0.96)",
        edge: "#ffd2af",
        shadow: "#9a4c32",
        chipFill: "rgba(97,45,28,0.92)",
      };
    }
    if (item.type === "vehicle" || item.type === "deployable") {
      if (item.era === "Future") {
        return {
          accent: "#95ecff",
          accentSoft: "#4d9ed0",
          panelTop: "rgba(18,38,53,0.96)",
          panelBottom: "rgba(8,13,22,0.98)",
          wellTop: "rgba(53,108,140,0.42)",
          wellBottom: "rgba(14,20,31,0.96)",
          edge: "#d2f7ff",
          shadow: "#336b90",
          chipFill: "rgba(33,71,95,0.92)",
        };
      }
      return {
        accent: "#a8d5ff",
        accentSoft: "#547aa2",
        panelTop: "rgba(22,35,49,0.96)",
        panelBottom: "rgba(9,14,22,0.98)",
        wellTop: "rgba(62,89,118,0.42)",
        wellBottom: "rgba(15,21,31,0.96)",
        edge: "#d5e9ff",
        shadow: "#3a5d7b",
        chipFill: "rgba(38,57,77,0.92)",
      };
    }
    if (item.era === "Future") {
      return {
        accent: "#8fe7ff",
        accentSoft: "#39a3c7",
        panelTop: "rgba(16,38,48,0.96)",
        panelBottom: "rgba(8,14,20,0.98)",
        wellTop: "rgba(49,107,126,0.42)",
        wellBottom: "rgba(14,22,28,0.96)",
        edge: "#d1f8ff",
        shadow: "#2d7082",
        chipFill: "rgba(28,69,79,0.92)",
      };
    }
    if (item.era === "Modern") {
      return {
        accent: "#9fd8ff",
        accentSoft: "#4a80aa",
        panelTop: "rgba(17,35,48,0.96)",
        panelBottom: "rgba(8,14,22,0.98)",
        wellTop: "rgba(55,94,122,0.4)",
        wellBottom: "rgba(13,20,30,0.96)",
        edge: "#d4ebff",
        shadow: "#365a7a",
        chipFill: "rgba(31,59,81,0.92)",
      };
    }
    if (item.era === "Industrial") {
      return {
        accent: "#e0bc90",
        accentSoft: "#9c6943",
        panelTop: "rgba(46,32,23,0.96)",
        panelBottom: "rgba(14,11,10,0.98)",
        wellTop: "rgba(110,76,55,0.42)",
        wellBottom: "rgba(25,18,16,0.96)",
        edge: "#f0d3b1",
        shadow: "#765038",
        chipFill: "rgba(82,53,36,0.92)",
      };
    }
    return {
      accent: "#ecd299",
      accentSoft: "#a88245",
      panelTop: "rgba(44,36,24,0.96)",
      panelBottom: "rgba(14,12,10,0.98)",
      wellTop: "rgba(103,82,50,0.4)",
      wellBottom: "rgba(24,20,17,0.96)",
      edge: "#f4e1b6",
      shadow: "#6d5632",
      chipFill: "rgba(79,61,33,0.92)",
    };
  }

  function getItemBadgeText(item) {
    if (!item) return "";
    if (item.tier != null) {
      const styleLabel = {
        keep: "KEEP",
        house: "HOUSE",
        barracks: "BARRACKS",
        archery: "RANGE",
        stable: "CAV",
        tower: "TOWER",
        wall: "WALL",
        "capital-wall": "WALL",
        gate: "GATE",
        outpost: "SCOUT",
        market: "TRADE",
        farm: "FARM",
        lumber: "LUMBER",
        quarry: "QUARRY",
        forge: "FORGE",
        academy: "ACADEMY",
        hospital: "MEDIC",
        chapel: "CHAPEL",
        granary: "FOOD",
        workshop: "WORKS",
        cannon: "GUN",
        mortar: "MORTAR",
        bridge: "BRIDGE",
        dock: "DOCK",
        plant: "POWER",
        refinery: "REFINE",
        radar: "RADAR",
        bunker: "BUNKER",
        command: "COMMAND",
      }[item.style] || "ASSET";
      return `T${item.tier} ${styleLabel}`;
    }
    const era = { Old: "OLD", Industrial: "IND", Modern: "MOD", Future: "FTR" }[item.era] || "WAR";
    const kind = { unit: "UNIT", vehicle: "ARMOR", ability: "STRIKE", deployable: "NEST" }[item.type] || "UNIT";
    return `${era} ${kind}`;
  }

  function getItemMetaText(item) {
    if (!item) return "";
    if (item.tier != null) {
      if (item.spawnRole) return `Produces ${formatSelectionLabel(item.spawnRole)}`;
      if (item.attack) return `${formatSelectionLabel(item.attack)} defense platform`;
      if (item.gather) return `Harvests ${formatSelectionLabel(item.gather)}`;
      if (item.taxBoost || item.tax) return "Economic support structure";
      if (item.aura) return `${formatSelectionLabel(item.aura)} aura support`;
      return item.desc.split(".")[0];
    }
    if (item.type === "ability") return `${item.era} battlefield strike`;
    if (item.type === "vehicle") return `${item.era} armored platform`;
    if (item.type === "deployable") return `${item.era} fixed weapon`;
    return item.projectile ? `${item.era} ranged squad` : `${item.era} frontline squad`;
  }

  function getItemStatText(item) {
    if (!item) return "";
    if (item.tier != null) {
      if (item.attack) return `RNG ${Math.round(item.range || 0)} | HP ${Math.round(item.hp || 0)}`;
      if (item.spawnRate) return `TRAIN ${Math.round(item.spawnRate)}s | HP ${Math.round(item.hp || 0)}`;
      if (item.taxBoost) return `TAX x${item.taxBoost.toFixed(2)} | HP ${Math.round(item.hp || 0)}`;
      if (item.tax) return `INC +${Math.round(item.tax)} | HP ${Math.round(item.hp || 0)}`;
      if (item.gather) return `HARV ${formatSelectionLabel(item.gather)} | HP ${Math.round(item.hp || 0)}`;
      return `HP ${Math.round(item.hp || 0)} | ${formatSelectionLabel(item.armor || "stone")}`;
    }
    if (item.type === "ability") return `DMG ${Math.round(item.damage || 0)} | BLAST ${Math.round(item.blast || item.splash || 0)}`;
    if (item.range > 80) return `DMG ${Math.round(item.damage || 0)} | RNG ${Math.round(item.range || 0)}`;
    return `DMG ${Math.round(item.damage || 0)} | HP ${Math.round(item.hp || 0)}`;
  }

  function getItemPipCount(item) {
    if (!item) return 0;
    if (item.tier != null) return clamp(Math.round(item.tier), 1, 4);
    const eraSteps = { Old: 1, Industrial: 2, Modern: 3, Future: 4 };
    return eraSteps[item.era] || 1;
  }

  function drawLabelPill(text, x, y, fill, stroke, textColor, scale, maxWidth = 9999) {
    if (!text) return { x, y, w: 0, h: 0, text: "" };
    ctx.save();
    ctx.font = `700 ${Math.round(9 * scale)}px Cambria`;
    const padX = 7 * scale;
    const h = 16 * scale;
    let label = String(text).toUpperCase();
    const limit = Math.max(22 * scale, maxWidth);
    while (ctx.measureText(label).width + padX * 2 > limit && label.length > 3) {
      label = label.slice(0, -1);
    }
    if (label !== String(text).toUpperCase() && label.length > 2) label = `${label.slice(0, -1)}.`;
    const w = Math.max(22 * scale, Math.min(limit, ctx.measureText(label).width + padX * 2));
    roundRect(ctx, x, y, w, h, 8 * scale, fill, stroke);
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w * 0.5, y + h * 0.5 + 0.3 * scale);
    ctx.restore();
    return { x, y, w, h, text: label };
  }

  function drawItemGlyph(item, x, y, size, muted) {
    ctx.save();
    ctx.translate(x, y);
    if (muted) ctx.globalAlpha = 0.5;
    const theme = getItemVisualTheme(item);
    ctx.shadowColor = withAlpha(theme.shadow, muted ? 0.18 : 0.3);
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.04;
    const shell = ctx.createLinearGradient(0, 0, 0, size);
    shell.addColorStop(0, theme.panelTop);
    shell.addColorStop(1, theme.panelBottom);
    roundRect(ctx, 0, 0, size, size, size * 0.18, shell, withAlpha(theme.edge, 0.46));
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const inner = size * 0.08;
    const insetFill = ctx.createLinearGradient(0, inner, 0, size - inner);
    insetFill.addColorStop(0, theme.wellTop);
    insetFill.addColorStop(1, theme.wellBottom);
    roundRect(ctx, inner, inner, size - inner * 2, size - inner * 2, size * 0.14, insetFill, "rgba(255,255,255,0.06)");
    const spotlight = ctx.createRadialGradient(size * 0.48, size * 0.34, size * 0.04, size * 0.5, size * 0.52, size * 0.5);
    spotlight.addColorStop(0, withAlpha(theme.accent, 0.3));
    spotlight.addColorStop(0.6, withAlpha(theme.accentSoft, 0.08));
    spotlight.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spotlight;
    ctx.fillRect(inner, inner, size - inner * 2, size - inner * 2);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(inner + 2, inner + 2, size - inner * 2 - 4, Math.max(3, size * 0.08));
    ctx.fillStyle = withAlpha(theme.accent, 0.18);
    ctx.fillRect(inner + 3, size - inner - Math.max(4, size * 0.1), size - inner * 2 - 6, Math.max(3, size * 0.08));
    const sprite = getItemSpriteRef(item);
    let drewSprite = false;
    if (sprite) {
      drewSprite = drawSpriteFromGroup(sprite.group, sprite.key, size * 0.5, size * 0.5, size * 0.82, size * 0.82, 0, muted ? 0.9 : 1);
    }
    if (!drewSprite) {
      ctx.fillStyle = "rgba(9,14,18,0.92)";
    }
    if (!drewSprite && assetCatalog.includes(item)) {
      ctx.fillRect(size * 0.24, size * 0.42, size * 0.52, size * 0.3);
      ctx.beginPath();
      ctx.moveTo(size * 0.18, size * 0.42);
      ctx.lineTo(size * 0.5, size * 0.14);
      ctx.lineTo(size * 0.82, size * 0.42);
      ctx.closePath();
      ctx.fill();
      if (item.style === "tower" || item.style === "radar") ctx.fillRect(size * 0.34, size * 0.2, size * 0.32, size * 0.48);
      if (item.style === "wall" || item.style === "capital-wall") ctx.fillRect(size * 0.14, size * 0.42, size * 0.72, size * 0.16);
      ctx.fillStyle = withAlpha(theme.accent, 0.24);
      ctx.fillRect(size * 0.22, size * 0.52, size * 0.56, size * 0.06);
    } else if (!drewSprite && item.type === "ability") {
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.54, size * 0.2, 0, TAU);
      ctx.fill();
      ctx.fillRect(size * 0.44, size * 0.16, size * 0.12, size * 0.3);
      ctx.fillStyle = withAlpha(theme.accent, 0.28);
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.54, size * 0.28, 0, TAU);
      ctx.strokeStyle = withAlpha(theme.edge, 0.34);
      ctx.lineWidth = Math.max(1, size * 0.04);
      ctx.stroke();
    } else if (!drewSprite && item.type === "vehicle") {
      ctx.fillRect(size * 0.18, size * 0.34, size * 0.64, size * 0.32);
      ctx.fillRect(size * 0.34, size * 0.2, size * 0.3, size * 0.2);
      ctx.fillRect(size * 0.54, size * 0.42, size * 0.26, size * 0.08);
      if (item.id === "hovercraft") {
        ctx.strokeStyle = "#091218";
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.5, size * 0.34, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = withAlpha(theme.accent, 0.24);
      ctx.fillRect(size * 0.22, size * 0.62, size * 0.5, size * 0.05);
    } else if (!drewSprite) {
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.26, size * 0.12, 0, TAU);
      ctx.fill();
      ctx.fillRect(size * 0.44, size * 0.36, size * 0.12, size * 0.3);
      ctx.fillRect(size * 0.26, size * 0.42, size * 0.48, size * 0.08);
    }
    const pipCount = getItemPipCount(item);
    const pipGap = size * 0.11;
    const pipStartX = size * 0.18;
    const pipY = size * 0.82;
    for (let i = 0; i < pipCount; i += 1) {
      ctx.fillStyle = withAlpha(theme.accent, 0.55 + i * 0.1);
      ctx.beginPath();
      ctx.arc(pipStartX + i * pipGap, pipY, size * 0.034, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCatalogPanel(type) {
    const layout = getPanelLayout(type);
    const panelAccent = type === "assets" ? "#9fe0a4" : "#ffcf8d";
    const headerGradient = ctx.createLinearGradient(layout.x, layout.y, layout.x, layout.y + layout.h);
    headerGradient.addColorStop(0, type === "assets" ? "rgba(11,37,29,0.97)" : "rgba(43,27,16,0.97)");
    headerGradient.addColorStop(0.22, "rgba(14,24,32,0.95)");
    headerGradient.addColorStop(1, "rgba(7,13,18,0.92)");
    roundRect(ctx, layout.x, layout.y, layout.w, layout.h, 24, headerGradient, type === "assets" ? "rgba(159,224,164,0.28)" : "rgba(255,207,141,0.26)");
    ctx.fillStyle = withAlpha(panelAccent, 0.14);
    ctx.fillRect(layout.x + 12 * layout.scale, layout.y + 12 * layout.scale, layout.w - 24 * layout.scale, 10 * layout.scale);
    ctx.fillStyle = panelAccent;
    ctx.font = `700 ${Math.round(24 * layout.scale)}px Cambria`;
    ctx.fillText(type === "assets" ? "Assets Catalog [E]" : "Weapons Catalog [Q]", layout.x + layout.padding, layout.y + 30 * layout.scale);
    ctx.fillStyle = "#9bb0bc";
    ctx.font = `${Math.round(13 * layout.scale)}px Cambria`;
    ctx.fillText("Drag cards into the quick bar. Scroll here to browse the expanded arsenal.", layout.x + layout.padding, layout.y + 50 * layout.scale);
    drawLabelPill(`${layout.items.length} ready`, layout.x + layout.w - 96 * layout.scale, layout.y + 18 * layout.scale, withAlpha(panelAccent, 0.18), withAlpha(panelAccent, 0.42), "#f4efe2", layout.scale, 80 * layout.scale);
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.listX, layout.listY, layout.w - layout.padding * 2, layout.bodyH);
    ctx.clip();
    layout.items.forEach((item, index) => {
      const col = index % layout.cols;
      const row = Math.floor(index / layout.cols);
      const x = layout.listX + col * layout.cellW;
      const y = layout.listY + row * layout.cellH - layout.scroll;
      const w = layout.cellW - layout.cardGap;
      const h = layout.cellH - 10 * layout.scale;
      if (y + h < layout.listY - 4 || y > layout.listY + layout.bodyH + 4) return;
      const dragging = state.ui.draggingItemId === item.id;
      const affordable = canAfford(item.id);
      const theme = getItemVisualTheme(item);
      const cardFill = ctx.createLinearGradient(x, y, x + w, y + h);
      cardFill.addColorStop(0, dragging ? withAlpha(theme.accentSoft, 0.26) : withAlpha(theme.accentSoft, 0.14));
      cardFill.addColorStop(0.5, "rgba(17,24,31,0.94)");
      cardFill.addColorStop(1, "rgba(9,14,19,0.98)");
      roundRect(ctx, x, y, w, h, 18 * layout.scale, cardFill, affordable ? withAlpha(theme.edge, 0.16) : "rgba(255,138,128,0.34)");
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x + 4 * layout.scale, y + 4 * layout.scale, w - 8 * layout.scale, 4 * layout.scale);
      const iconBoxX = x + 10 * layout.scale;
      const iconBoxY = y + 10 * layout.scale;
      const iconBoxSize = 46 * layout.scale;
      const iconWell = ctx.createLinearGradient(iconBoxX, iconBoxY, iconBoxX, iconBoxY + iconBoxSize);
      iconWell.addColorStop(0, withAlpha(theme.accent, 0.16));
      iconWell.addColorStop(1, "rgba(9,14,18,0.92)");
      roundRect(ctx, iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 12 * layout.scale, iconWell, withAlpha(theme.edge, 0.22));
      drawItemGlyph(item, iconBoxX + 4 * layout.scale, iconBoxY + 4 * layout.scale, 38 * layout.scale, !affordable);
      drawLabelPill(getItemBadgeText(item), x + 62 * layout.scale, y + 10 * layout.scale, theme.chipFill, withAlpha(theme.edge, 0.22), "#f6f0e3", layout.scale, w - 120 * layout.scale);
      ctx.fillStyle = "#f5efe2";
      ctx.font = `700 ${Math.round(12 * layout.scale)}px Cambria`;
      wrapText(item.name, x + 62 * layout.scale, y + 32 * layout.scale, w - 72 * layout.scale, 12 * layout.scale);
      ctx.fillStyle = dragging ? "#dfe9ef" : "#a8bcc7";
      ctx.font = `${Math.round(11 * layout.scale)}px Cambria`;
      ctx.fillText(getItemMetaText(item), x + 62 * layout.scale, y + 50 * layout.scale);
      ctx.fillStyle = "#c9d7de";
      ctx.font = `${Math.round(10 * layout.scale)}px Cambria`;
      ctx.fillText(getItemStatText(item), x + 62 * layout.scale, y + 64 * layout.scale);
      drawLabelPill(`${item.cost} C`, x + w - 58 * layout.scale, y + h - 22 * layout.scale, affordable ? withAlpha(theme.accent, 0.18) : "rgba(111,32,28,0.84)", affordable ? withAlpha(theme.edge, 0.34) : "rgba(255,138,128,0.62)", affordable ? "#ffe6b2" : "#ffd1cb", layout.scale, 48 * layout.scale);
      ctx.fillStyle = withAlpha(theme.accent, affordable ? 0.86 : 0.38);
      ctx.fillRect(x + w - 44 * layout.scale, y + 12 * layout.scale, 28 * layout.scale, 3 * layout.scale);
    });
    ctx.restore();
    if (layout.scrollMax > 0) {
      const trackX = layout.x + layout.w - 12 * layout.scale;
      const trackY = layout.listY + 4 * layout.scale;
      const trackH = layout.bodyH - 8 * layout.scale;
      roundRect(ctx, trackX, trackY, 4 * layout.scale, trackH, 4, "rgba(255,255,255,0.08)", null);
      const thumbH = Math.max(22 * layout.scale, (layout.bodyH / (layout.bodyH + layout.scrollMax)) * trackH);
      const thumbY = trackY + (layout.scrollMax ? (layout.scroll / layout.scrollMax) * (trackH - thumbH) : 0);
      roundRect(ctx, trackX, thumbY, 4 * layout.scale, thumbH, 4, type === "assets" ? "rgba(159,224,164,0.76)" : "rgba(255,207,141,0.76)", null);
    }
    ctx.fillStyle = "#8fa5b1";
    ctx.font = `${Math.round(11 * layout.scale)}px Cambria`;
    ctx.fillText(`${layout.items.length} entries`, layout.x + layout.padding, layout.y + layout.h - 8 * layout.scale);
    if (layout.scrollMax > 0) ctx.fillText("Wheel to scroll", layout.x + layout.w - 100 * layout.scale, layout.y + layout.h - 8 * layout.scale);
  }

  function drawBottomBar() {
    const layout = getBottomBarLayout();
    const quickSlots = getQuickSlots();
    const frameX = layout.x - 22;
    const frameY = layout.y - 24;
    const frameW = layout.slotSize * 8 + layout.gap * 7 + 44;
    const frameH = layout.slotSize + 48;
    const shell = ctx.createLinearGradient(frameX, frameY, frameX, frameY + frameH);
    shell.addColorStop(0, "rgba(10,17,23,0.92)");
    shell.addColorStop(1, "rgba(6,11,16,0.82)");
    roundRect(ctx, frameX, frameY, frameW, frameH, 28, shell, "rgba(214,174,99,0.24)");
    if (isImageReady(uiImages.hudBar)) {
      ctx.save();
      ctx.globalAlpha = 0.48;
      ctx.drawImage(uiImages.hudBar, frameX + 8, frameY + 6, frameW - 16, frameH - 12);
      ctx.restore();
    }
    const assetsW = (frameW - 20) * 0.5 - 6;
    roundRect(ctx, frameX + 10, frameY + 10, assetsW, 22, 12, "rgba(18,42,30,0.56)", "rgba(159,224,164,0.18)");
    roundRect(ctx, frameX + frameW * 0.5 + 2, frameY + 10, assetsW, 22, 12, "rgba(43,28,18,0.56)", "rgba(255,207,141,0.16)");
    ctx.fillStyle = "#8fcf9b";
    ctx.font = "700 12px Cambria";
    ctx.fillText("Assets [E]", layout.x, layout.y - 9);
    ctx.fillStyle = "#ffc986";
    ctx.fillText("Weapons [Q]", layout.x + (layout.slotSize + layout.gap) * 4, layout.y - 9);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(layout.x + (layout.slotSize + layout.gap) * 4 - layout.gap * 0.5, layout.y - 6);
    ctx.lineTo(layout.x + (layout.slotSize + layout.gap) * 4 - layout.gap * 0.5, layout.y + layout.slotSize + 10);
    ctx.stroke();
    for (const slot of layout.slots) {
      const itemId = quickSlots[slot.side][slot.index];
      const item = itemIndex.get(itemId);
      const active = state.ui.activePlacementId === itemId;
      const hover = state.ui.hoveredSlot && state.ui.hoveredSlot.side === slot.side && state.ui.hoveredSlot.index === slot.index;
      const theme = item ? getItemVisualTheme(item) : getItemVisualTheme(slot.side === "assets" ? { tier: 1, style: "market" } : { type: "vehicle", era: "Modern" });
      const slotFill = ctx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
      slotFill.addColorStop(0, active ? withAlpha(theme.accentSoft, 0.28) : withAlpha(theme.accentSoft, 0.12));
      slotFill.addColorStop(1, "rgba(8,13,18,0.94)");
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 18, slotFill, hover ? withAlpha(theme.edge, 0.64) : active ? withAlpha(theme.edge, 0.52) : "rgba(255,255,255,0.12)");
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(slot.x + 4, slot.y + 4, slot.w - 8, 4);
      drawLabelPill(`${slot.side === "assets" ? "E" : "Q"}${slot.index + 1}`, slot.x + 6, slot.y + 6, theme.chipFill, withAlpha(theme.edge, 0.18), "#f5efe3", 0.9, 30);
      if (!item) {
        ctx.fillStyle = withAlpha(theme.accent, 0.22);
        ctx.beginPath();
        ctx.arc(slot.x + slot.w * 0.5, slot.y + 31, 14, 0, TAU);
        ctx.strokeStyle = withAlpha(theme.edge, 0.3);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = "rgba(220,230,235,0.78)";
        ctx.font = "700 11px Cambria";
        ctx.textAlign = "center";
        ctx.fillText("Drop", slot.x + slot.w * 0.5, slot.y + slot.h - 20);
        ctx.textAlign = "left";
        continue;
      }
      const affordable = canAfford(item.id);
      roundRect(ctx, slot.x + 10, slot.y + 14, slot.w - 20, 40, 14, "rgba(0,0,0,0.14)", withAlpha(theme.edge, 0.16));
      drawItemGlyph(item, slot.x + 15, slot.y + 15, 40, !affordable);
      ctx.fillStyle = "#f3ece0";
      ctx.font = "700 10px Cambria";
      wrapText(item.name, slot.x + 8, slot.y + slot.h - 17, slot.w - 16, 11);
      drawLabelPill(`${item.cost}C`, slot.x + slot.w - 38, slot.y + 6, affordable ? withAlpha(theme.accent, 0.18) : "rgba(111,32,28,0.84)", affordable ? withAlpha(theme.edge, 0.26) : "rgba(255,138,128,0.62)", affordable ? "#ffe3ae" : "#ffd1cb", 0.9, 32);
      if (active) {
        ctx.fillStyle = withAlpha(theme.accent, 0.88);
        ctx.fillRect(slot.x + 10, slot.y + slot.h - 6, slot.w - 20, 3);
      }
    }
  }

  function drawNotifications() {
    const viewport = state.activeViewport || getViewportForPlayer();
    const scale = getUiScale();
    const minimap = getMinimapLayout();
    const startY = Math.max(viewport.y + 230 * scale, minimap.panelY + minimap.panelH + 18 * scale);
    state.world.notifications
      .filter((note) => !note.owner || note.owner === getActivePlayerState().owner)
      .slice(-4)
      .forEach((note, index) => {
      const y = startY + index * 28 * scale;
      ctx.fillStyle = note.tint;
      ctx.font = "600 15px Cambria";
      ctx.fillText(note.text, viewport.x + 26 * scale, y);
    });
  }

  function drawRecentMessage(w, h) {
    const viewport = state.activeViewport || getViewportForPlayer();
    const scale = getUiScale();
    const centerX = viewport.x + w / 2;
    roundRect(ctx, centerX - 240 * scale, viewport.y + h - 170 * scale, 480 * scale, 34 * scale, 18, "rgba(7,14,20,0.74)", "rgba(255,255,255,0.08)");
    ctx.fillStyle = "#dbe3e8";
    ctx.font = "600 14px Cambria";
    ctx.textAlign = "center";
    ctx.fillText(state.ui.recentMessage, centerX, viewport.y + h - 149 * scale);
    ctx.textAlign = "left";
  }

  function formatSelectionLabel(value) {
    return String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getSelectedEntities() {
    return [
      ...state.world.units.filter((unit) => state.selectedIds.has(unit.id)),
      ...state.world.buildings.filter((building) => state.selectedIds.has(building.id)),
    ];
  }

  function getSelectionEntityName(entity) {
    if (!entity) return "Selection";
    if (entity.kind === "building") return entity.def && entity.def.name ? entity.def.name : formatSelectionLabel(entity.itemId);
    const item = weaponCatalog.find((entry) => entry.role === entity.role);
    return entity.displayName || (item && item.name) || formatSelectionLabel(entity.role);
  }

  function getEntityVisualItem(entity) {
    if (!entity) return null;
    if (entity.kind === "building") return entity.def || itemIndex.get(entity.itemId) || null;
    return weaponCatalog.find((entry) => entry.role === entity.role) || {
      type: entity.type === "vehicle" ? "vehicle" : "unit",
      era: entity.type === "vehicle" || entity.airborne ? "Modern" : "Old",
    };
  }

  function getSelectionHudLayout(entities = getSelectedEntities()) {
    if (!entities.length) return null;
    const viewport = state.activeViewport || getViewportForPlayer();
    const scale = getUiScale();
    const bottomBar = getBottomBarLayout();
    const padding = 14 * scale;
    const headerH = 62 * scale;
    const iconSize = 46 * scale;
    const gap = 8 * scale;
    const cols = Math.max(1, Math.min(viewport.w < 900 ? 4 : 6, entities.length));
    const rows = Math.ceil(entities.length / cols);
    const panelW = Math.max(220 * scale, padding * 2 + cols * iconSize + Math.max(0, cols - 1) * gap);
    const panelH = padding * 2 + headerH + rows * iconSize + Math.max(0, rows - 1) * gap;
    const x = viewport.x + 20 * scale;
    const y = Math.max(viewport.y + 84 * scale, bottomBar.y - 16 * scale - panelH);
    const contentX = x + padding;
    const contentY = y + padding + headerH;
    const player = getActivePlayerState();
    const slots = entities.map((entity, index) => {
      const slotX = contentX + (index % cols) * (iconSize + gap);
      const slotY = contentY + Math.floor(index / cols) * (iconSize + gap);
      return {
        entity,
        x: slotX,
        y: slotY,
        w: iconSize,
        h: iconSize,
        eyeRect: canEnterFirstPerson(entity, player)
          ? {
            x: slotX + 4 * scale,
            y: slotY + 4 * scale,
            w: 14 * scale,
            h: 14 * scale,
          }
          : null,
      };
    });
    return {
      x,
      y,
      w: panelW,
      h: panelH,
      padding,
      headerH,
      iconSize,
      gap,
      cols,
      rows,
      slots,
      entities,
      scale,
    };
  }

  function getSelectionHudHitAt(px, py) {
    const layout = getSelectionHudLayout();
    if (!layout) return null;
    for (const slot of layout.slots) {
      if (!isInsideRect(px, py, slot)) continue;
      if (slot.eyeRect && isInsideRect(px, py, slot.eyeRect)) return { slot, action: "eye" };
      return { slot, action: "dismiss" };
    }
    return null;
  }

  function drawSelectionEntityIcon(slot, hovered = false, eyeHovered = false) {
    const { entity, x, y, w, scale } = {
      ...slot,
      scale: getUiScale(),
    };
    const ownerColor = ownerColors[entity.owner] || "#ffffff";
    const iconItem = getEntityVisualItem(entity);
    const theme = getItemVisualTheme(iconItem);
    const fill = ctx.createLinearGradient(x, y, x, y + w);
    fill.addColorStop(0, hovered ? withAlpha(theme.accentSoft, 0.28) : withAlpha(theme.accentSoft, 0.16));
    fill.addColorStop(1, "rgba(9,14,20,0.96)");
    roundRect(ctx, x, y, w, w, 13 * scale, fill, hovered ? withAlpha(theme.edge, 0.68) : "rgba(255,255,255,0.12)");
    ctx.fillStyle = withAlpha(ownerColor, 0.94);
    ctx.fillRect(x + 5 * scale, y + 5 * scale, w - 10 * scale, 4 * scale);
    roundRect(ctx, x + 5 * scale, y + 10 * scale, w - 10 * scale, w - 20 * scale, 12 * scale, "rgba(0,0,0,0.14)", withAlpha(theme.edge, 0.16));
    const spotlight = ctx.createRadialGradient(x + w * 0.5, y + w * 0.34, w * 0.04, x + w * 0.5, y + w * 0.5, w * 0.54);
    spotlight.addColorStop(0, withAlpha(theme.accent, 0.22));
    spotlight.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spotlight;
    ctx.fillRect(x + 6 * scale, y + 8 * scale, w - 12 * scale, w - 16 * scale);
    const centerX = x + w * 0.5;
    const centerY = y + w * 0.54;
    let drewSprite = false;
    if (entity.kind === "building") {
      const spriteSize = getAssetSpriteSize(entity, w * 0.58);
      drewSprite = drawSpriteFromGroup("assets", entity.itemId, centerX, centerY, spriteSize.w, spriteSize.h, 0, 1, entity.spriteVariantSeed || entity.placementIndex || 0);
    } else {
      const spriteKey = getUnitSpriteKey(entity);
      if (spriteKey) {
        const spriteW = entity.type === "vehicle" ? w * 0.76 : entity.airborne ? w * 0.8 : w * 0.68;
        const spriteH = entity.type === "vehicle" ? w * 0.68 : entity.airborne ? w * 0.74 : w * 0.68;
        drewSprite = drawSpriteFromGroup("units", spriteKey, centerX, centerY, spriteW, spriteH, entity.type === "vehicle" || entity.airborne ? entity.angle || 0 : 0, 1);
      }
    }
    if (!drewSprite) {
      ctx.save();
      ctx.fillStyle = "#091118";
      ctx.font = `700 ${Math.round(18 * scale)}px Cambria`;
      ctx.textAlign = "center";
      ctx.fillText(getSelectionEntityName(entity).charAt(0), centerX, y + w * 0.62);
      ctx.restore();
    }
    const pipCount = getItemPipCount(iconItem);
    for (let i = 0; i < pipCount; i += 1) {
      ctx.fillStyle = withAlpha(theme.accent, 0.58 + i * 0.08);
      ctx.beginPath();
      ctx.arc(x + 9 * scale + i * 6.5 * scale, y + w - 15 * scale, 1.5 * scale, 0, TAU);
      ctx.fill();
    }
    const hpRatio = clamp(entity.hp / Math.max(1, entity.maxHp || entity.hp || 1), 0, 1);
    roundRect(ctx, x + 6 * scale, y + w - 8 * scale, w - 12 * scale, 4 * scale, 3 * scale, "rgba(0,0,0,0.42)", null);
    if (hpRatio > 0) {
      roundRect(ctx, x + 6 * scale, y + w - 8 * scale, (w - 12 * scale) * hpRatio, 4 * scale, 3 * scale, hpRatio > 0.65 ? "#7df2ab" : hpRatio > 0.35 ? "#ffd889" : "#ff8a80", null);
    }
    const badgeX = x + w - 9 * scale;
    const badgeY = y + 9 * scale;
    ctx.fillStyle = hovered ? "#ff8a80" : "rgba(6,11,16,0.88)";
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 6 * scale, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hovered ? "#2a0d10" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.3 * scale;
    ctx.beginPath();
    ctx.moveTo(badgeX - 2.2 * scale, badgeY - 2.2 * scale);
    ctx.lineTo(badgeX + 2.2 * scale, badgeY + 2.2 * scale);
    ctx.moveTo(badgeX + 2.2 * scale, badgeY - 2.2 * scale);
    ctx.lineTo(badgeX - 2.2 * scale, badgeY + 2.2 * scale);
    ctx.stroke();
    if (slot.eyeRect) {
      const eyeCx = slot.eyeRect.x + slot.eyeRect.w * 0.5;
      const eyeCy = slot.eyeRect.y + slot.eyeRect.h * 0.5;
      ctx.fillStyle = eyeHovered ? "#8fd8ff" : "rgba(6,11,16,0.86)";
      ctx.beginPath();
      ctx.arc(eyeCx, eyeCy, slot.eyeRect.w * 0.56, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = eyeHovered ? "#ecfbff" : "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.1 * scale;
      ctx.beginPath();
      ctx.ellipse(eyeCx, eyeCy, slot.eyeRect.w * 0.34, slot.eyeRect.h * 0.22, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = eyeHovered ? "#ffffff" : "#b4dff5";
      ctx.beginPath();
      ctx.arc(eyeCx, eyeCy, slot.eyeRect.w * 0.12, 0, TAU);
      ctx.fill();
    }
    if (entity.kind === "unit" && entity.pickupWeapon) {
      ctx.fillStyle = "#ffe29a";
      ctx.beginPath();
      ctx.arc(x + 10 * scale, y + w - 12 * scale, 4 * scale, 0, TAU);
      ctx.fill();
    }
  }

  function drawSelectionHud(w, h) {
    const entities = getSelectedEntities();
    if (!entities.length) return;
    const layout = getSelectionHudLayout(entities);
    const hoverHit = getSelectionHudHitAt(state.input.mouseScreenX, state.input.mouseScreenY);
    const hoverSlot = hoverHit ? hoverHit.slot : null;
    const focusEntity = hoverSlot ? hoverSlot.entity : entities[entities.length - 1];
    const focusItem = getEntityVisualItem(focusEntity);
    const focusTheme = getItemVisualTheme(focusItem);
    const boostedCount = entities.filter((entity) => entity.kind === "unit" && entity.pickupWeapon).length;
    const focusHpRatio = clamp(focusEntity.hp / Math.max(1, focusEntity.maxHp || focusEntity.hp || 1), 0, 1);
    const panelFill = ctx.createLinearGradient(layout.x, layout.y, layout.x, layout.y + layout.h);
    panelFill.addColorStop(0, "rgba(10,17,23,0.92)");
    panelFill.addColorStop(1, "rgba(7,12,18,0.8)");
    roundRect(ctx, layout.x, layout.y, layout.w, layout.h, 20 * layout.scale, panelFill, "rgba(255,226,154,0.14)");
    ctx.fillStyle = withAlpha(focusTheme.accent, 0.1);
    ctx.fillRect(layout.x + 8 * layout.scale, layout.y + 8 * layout.scale, layout.w - 16 * layout.scale, 8 * layout.scale);
    roundRect(ctx, layout.x + 8 * layout.scale, layout.y + 14 * layout.scale, layout.w - 16 * layout.scale, 38 * layout.scale, 16 * layout.scale, "rgba(9,16,22,0.94)", "rgba(255,255,255,0.05)");
    ctx.fillStyle = "#ffe29a";
    ctx.font = `700 ${Math.round(15 * layout.scale)}px Cambria`;
    ctx.fillText("Selection", layout.x + layout.padding, layout.y + layout.padding + 14 * layout.scale);
    drawLabelPill(`${entities.length} selected`, layout.x + layout.w - 86 * layout.scale, layout.y + 16 * layout.scale, focusTheme.chipFill, withAlpha(focusTheme.edge, 0.24), "#f5efe3", layout.scale, 72 * layout.scale);
    ctx.fillStyle = ownerColors[focusEntity.owner] || "#dbe6ec";
    ctx.font = `700 ${Math.round(12 * layout.scale)}px Cambria`;
    ctx.fillText(getSelectionEntityName(focusEntity), layout.x + layout.padding, layout.y + layout.padding + 30 * layout.scale);
    ctx.fillStyle = boostedCount ? "#9be7c5" : "#94a9b5";
    ctx.font = `${Math.round(11 * layout.scale)}px Cambria`;
    ctx.fillText(
      boostedCount
        ? `${getItemBadgeText(focusItem)} | HP ${Math.round(focusHpRatio * 100)}% | ${boostedCount} boosted`
        : `${getItemBadgeText(focusItem)} | HP ${Math.round(focusHpRatio * 100)}%`,
      layout.x + layout.padding,
      layout.y + layout.padding + 44 * layout.scale,
    );
    ctx.fillStyle = "#9fb2bc";
    ctx.font = `${Math.round(10 * layout.scale)}px Cambria`;
    ctx.fillText("Click icon to remove. Eye enters first-person.", layout.x + layout.padding, layout.y + layout.padding + 57 * layout.scale);
    layout.slots.forEach((slot) => drawSelectionEntityIcon(
      slot,
      hoverSlot && hoverSlot.entity.id === slot.entity.id,
      hoverHit && hoverHit.action === "eye" && hoverSlot && hoverSlot.entity.id === slot.entity.id,
    ));
  }

  function drawViewportLabel(player, viewport) {
    const scale = getUiScale();
    roundRect(ctx, viewport.x + 18 * scale, viewport.y + viewport.h - 58 * scale, 132 * scale, 34 * scale, 16, "rgba(7,14,20,0.68)", "rgba(255,255,255,0.08)");
    ctx.fillStyle = ownerColors[player.owner] || "#ffffff";
    ctx.font = "700 14px Cambria";
    ctx.fillText(player.label, viewport.x + 34 * scale, viewport.y + viewport.h - 36 * scale);
  }

  function drawControllerCursor(player) {
    if (!player || player.controllerIndex == null) return;
    const viewport = getViewportForPlayer(player);
    if (player.input.cursorX < viewport.x || player.input.cursorX > viewport.x + viewport.w) return;
    ctx.save();
    ctx.translate(player.input.cursorX, player.input.cursorY);
    ctx.strokeStyle = ownerColors[player.owner] || "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
  }

  function getPlayerForScreenPoint(x, y) {
    if (!isSplitScreenMatch()) return getPrimaryPlayer();
    return getHumanPlayers().find((player) => isInsideRect(x, y, getViewportForPlayer(player))) || getPrimaryPlayer();
  }

  function clearPlayerSelection(player, clearPlacement = true) {
    setActivePlayerContext(player, getViewportForPlayer(player));
    state.selectedIds.clear();
    if (clearPlacement) state.ui.activePlacementId = null;
    state.ui.draggingItemId = null;
    state.ui.dragSource = null;
    state.ui.hoveredEnemyIds = [];
    state.ui.selectionBox = null;
    state.input.leftDown = false;
    state.input.actionSource = null;
    state.input.draggingSelection = false;
  }

  function setPlayerOpenPanel(player, panel) {
    if (!player) return null;
    const nextPanel = panel || null;
    if (player.ui.openPanel !== nextPanel) {
      playUiSound(nextPanel ? "panelOpen" : "panelClose", { volume: 0.58, cooldown: 0.05 });
    }
    player.ui.openPanel = nextPanel;
    return nextPanel;
  }

  function handleLeftDown(player, x, y, source = "mouse") {
    setActivePlayerContext(player, getViewportForPlayer(player));
    state.input.leftDown = true;
    state.input.actionSource = source;
    state.input.dragStartScreenX = x;
    state.input.dragStartScreenY = y;
    state.input.mouseScreenX = x;
    state.input.mouseScreenY = y;
    state.input.cursorX = x;
    state.input.cursorY = y;
    state.ui.selectionBox = null;
    const card = getItemCardAt(x, y);
    if (card) {
      state.ui.draggingItemId = card.item.id;
      state.ui.dragSource = state.ui.openPanel;
      return;
    }
    if (state.ui.openPanel && isInsideRect(x, y, getPanelLayout(state.ui.openPanel))) {
      state.input.leftDown = false;
      state.input.actionSource = "panel";
      return;
    }
    const selectionHit = getSelectionHudHitAt(x, y);
    if (selectionHit) {
      if (selectionHit.action === "eye") {
        enterFirstPerson(player, selectionHit.slot.entity);
      } else {
        state.selectedIds.delete(selectionHit.slot.entity.id);
        playUiSound("clear", { volume: 0.45, cooldown: 0.03 });
      }
      state.input.leftDown = false;
      state.input.actionSource = "selectionHud";
      return;
    }
    const slot = getQuickSlotAt(x, y);
    if (slot) {
      state.ui.hoveredSlot = slot;
    }
  }

  function handleLeftMove(player, x, y) {
    setActivePlayerContext(player, getViewportForPlayer(player));
    if (state.admin.panelOpen && state.admin.activeTool) return;
    const dx = x - state.input.dragStartScreenX;
    const dy = y - state.input.dragStartScreenY;
    if (state.input.leftDown && !state.ui.draggingItemId && Math.hypot(dx, dy) > 12) {
      state.input.draggingSelection = true;
      state.ui.selectionBox = {
        x: Math.min(state.input.dragStartScreenX, x),
        y: Math.min(state.input.dragStartScreenY, y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      };
    } else if (state.input.draggingSelection && state.ui.selectionBox) {
      state.ui.selectionBox = {
        x: Math.min(state.input.dragStartScreenX, x),
        y: Math.min(state.input.dragStartScreenY, y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      };
    }
  }

  function finalizeSelection(box) {
    const player = getActivePlayerState();
    state.selectedIds.clear();
    const a = screenToWorld(box.x, box.y);
    const b = screenToWorld(box.x + box.w, box.y + box.h);
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    for (const unit of state.world.units) {
      if (unit.owner !== player.owner) continue;
      if (unit.x >= minX && unit.x <= maxX && unit.y >= minY && unit.y <= maxY) state.selectedIds.add(unit.id);
    }
    if (state.selectedIds.size) {
      notify(`${state.selectedIds.size} units selected.`, "#ffe29a");
      playUiSound("select", { volume: 0.58, cooldown: 0.04 });
    }
  }

  function handleLeftUp(player, x, y, source = "mouse") {
    setActivePlayerContext(player, getViewportForPlayer(player));
    if (state.input.actionSource === "selectionHud" || state.input.actionSource === "panel") {
      state.input.leftDown = false;
      state.input.actionSource = null;
      return;
    }
    const viewport = getViewportForPlayer(player);
    const worldPos = screenToWorld(x, y);
    if (state.ui.draggingItemId) {
      const slot = getQuickSlotAt(x, y);
      if (slot) {
        setQuickSlot(slot, state.ui.draggingItemId);
        if (isLanClient()) {
          queueLanCommand({
            type: "setQuickSlot",
            owner: player.owner,
            slot: { side: slot.side, index: slot.index },
            itemId: state.ui.draggingItemId,
          });
        }
        notify(`${itemIndex.get(state.ui.draggingItemId).name} assigned to quick slot.`, "#7df2ab");
        playUiSound("uiClick", { volume: 0.62, cooldown: 0.04 });
      }
      state.ui.draggingItemId = null;
      state.ui.dragSource = null;
      state.input.leftDown = false;
      state.input.actionSource = null;
      return;
    }
    if (state.input.draggingSelection && state.ui.selectionBox) {
      finalizeSelection(state.ui.selectionBox);
      state.input.draggingSelection = false;
      state.ui.selectionBox = null;
      state.input.leftDown = false;
      state.input.actionSource = null;
      return;
    }
    const slot = getQuickSlotAt(x, y);
    if (slot) {
      const quickSlots = getQuickSlots(player);
      const itemId = quickSlots[slot.side][slot.index];
      state.ui.activePlacementId = state.ui.activePlacementId === itemId ? null : itemId;
      playUiSound("uiClick", { volume: 0.5, cooldown: 0.04 });
      state.input.leftDown = false;
      state.input.actionSource = null;
      return;
    }
    if (handleAdminPlacement(worldPos.x, worldPos.y)) {
      state.input.leftDown = false;
      state.input.actionSource = null;
      return;
    }
    const placement = getActivePlacement();
    if (placement && y < viewport.y + viewport.h - 120) {
      if (isLanClient()) {
        queueLanCommand({
          type: "deployPlacement",
          owner: player.owner,
          itemId: placement.id,
          worldPos: { x: worldPos.x, y: worldPos.y },
        });
      } else {
        deployPlacement(placement, worldPos.x, worldPos.y, player.owner);
      }
      state.input.leftDown = false;
      state.input.actionSource = null;
      return;
    }
    const clickedEntity = findNearest([...state.world.units, ...state.world.buildings], worldPos.x, worldPos.y, (entity) => Math.hypot(entity.x - worldPos.x, entity.y - worldPos.y) <= entity.radius + 18);
    if (clickedEntity && clickedEntity.owner === player.owner && (clickedEntity.kind === "unit" || clickedEntity.kind === "building")) {
      if (state.selectedIds.size === 1 && state.selectedIds.has(clickedEntity.id)) {
        state.selectedIds.clear();
        playUiSound("clear", { volume: 0.45, cooldown: 0.04 });
      } else {
        state.selectedIds.clear();
        state.selectedIds.add(clickedEntity.id);
        playUiSound("select", { volume: 0.56, cooldown: 0.04 });
      }
      state.input.leftDown = false;
      state.input.actionSource = null;
      return;
    }
    if (handleWorldCommand(worldPos)) {
      state.input.leftDown = false;
      state.input.actionSource = null;
      return;
    }
    if (state.selectedIds.size) playUiSound("clear", { volume: 0.4, cooldown: 0.04 });
    state.selectedIds.clear();
    state.input.leftDown = false;
    state.input.actionSource = null;
  }

  function updatePlayerPointer(player, x, y) {
    setActivePlayerContext(player, getViewportForPlayer(player));
    state.input.mouseScreenX = x;
    state.input.mouseScreenY = y;
    state.input.cursorX = x;
    state.input.cursorY = y;
    const world = screenToWorld(x, y);
    state.input.mouseWorldX = world.x;
    state.input.mouseWorldY = world.y;

    if (state.input.leftDown) handleLeftMove(player, x, y);
    if (state.input.rightDown) {
      const dx = (x - state.input.panAnchorX) / state.camera.zoom;
      const dy = (y - state.input.panAnchorY) / state.camera.zoom;
      const cos = Math.cos(-state.camera.rotation);
      const sin = Math.sin(-state.camera.rotation);
      state.camera.x -= dx * cos - dy * sin;
      state.camera.y -= dx * sin + dy * cos;
      state.camera.x = clamp(state.camera.x, -CAMERA_LIMIT, CAMERA_LIMIT);
      state.camera.y = clamp(state.camera.y, -CAMERA_LIMIT, CAMERA_LIMIT);
      state.input.panAnchorX = x;
      state.input.panAnchorY = y;
    }
    if (state.input.middleDown) {
      const dx = x - state.input.panAnchorX;
      state.camera.rotation += dx * 0.004;
      state.input.panAnchorX = x;
      state.input.panAnchorY = y;
    }
    state.ui.hoveredSlot = getQuickSlotAt(x, y);
    state.ui.hoveredEnemyIds = getHoveredEnemyTargets(world.x, world.y, 4);
  }

  function onPointerMove(event) {
    const fpPlayer = getFirstPersonActivePlayer();
    if (fpPlayer) {
      updateFirstPersonLook(fpPlayer, event.movementX || 0, event.movementY || 0);
      return;
    }
    const pointer = clientToCanvasPoint(event.clientX, event.clientY);
    const player = getPlayerForScreenPoint(pointer.x, pointer.y);
    updatePlayerPointer(player, pointer.x, pointer.y);
  }

  function handleWheel(event) {
    event.preventDefault();
    if (getFirstPersonActivePlayer()) return;
    const pointer = clientToCanvasPoint(event.clientX, event.clientY);
    const player = getPlayerForScreenPoint(pointer.x, pointer.y);
    setActivePlayerContext(player, getViewportForPlayer(player));
    if (state.ui.openPanel) {
      const layout = getPanelLayout(state.ui.openPanel);
      if (isInsideRect(pointer.x, pointer.y, { x: layout.x, y: layout.y, w: layout.w, h: layout.h })) {
        setPanelScroll(state.ui.openPanel, clamp(layout.scroll + event.deltaY * 0.9, 0, layout.scrollMax), player);
        return;
      }
    }
    state.camera.zoom = clamp(state.camera.zoom - event.deltaY * 0.0006, 0.36, 1.9);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  }

  function getConnectedGamepads() {
    return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
  }

  function updateControllerAssignments() {
    const pads = getConnectedGamepads();
    const players = getControllablePlayers();
    players.forEach((player, index) => {
      player.controllerIndex = pads[index] ? pads[index].index : null;
    });
    if (controllerStatus) {
      const lines = players.map((player, index) => `${player.label}: ${pads[index] ? `connected (pad ${pads[index].index + 1})` : "waiting for controller"}`);
      controllerStatus.textContent = lines.length ? lines.join("  |  ") : "Connect one controller for solo pad support or up to four controllers for local split-screen matches.";
    }
  }

  function getGamepadButton(gamepad, index) {
    return Boolean(gamepad && gamepad.buttons[index] && gamepad.buttons[index].pressed);
  }

  function clampCursorToViewport(player) {
    const viewport = getViewportForPlayer(player);
    player.input.cursorX = clamp(player.input.cursorX || viewport.x + viewport.w / 2, viewport.x + 18, viewport.x + viewport.w - 18);
    player.input.cursorY = clamp(player.input.cursorY || viewport.y + viewport.h / 2, viewport.y + 18, viewport.y + viewport.h - 18);
  }

  function updateGamepads(dt) {
    const pads = getConnectedGamepads();
    for (const player of getControllablePlayers()) {
      const gamepad = player.controllerIndex == null ? null : pads.find((pad) => pad.index === player.controllerIndex);
      clampCursorToViewport(player);
      if (!gamepad || state.mode !== "playing") continue;
      if (isFirstPersonActive(player)) {
        player.gamepadButtons = {};
        continue;
      }
      const leftX = Math.abs(gamepad.axes[0] || 0) > 0.16 ? gamepad.axes[0] : 0;
      const leftY = Math.abs(gamepad.axes[1] || 0) > 0.16 ? gamepad.axes[1] : 0;
      const rightX = Math.abs(gamepad.axes[2] || 0) > 0.16 ? gamepad.axes[2] : 0;
      const rightY = Math.abs(gamepad.axes[3] || 0) > 0.16 ? gamepad.axes[3] : 0;
      player.input.cursorX += leftX * 420 * dt;
      player.input.cursorY += leftY * 420 * dt;
      clampCursorToViewport(player);
      setActivePlayerContext(player, getViewportForPlayer(player));
      const cos = Math.cos(-player.camera.rotation);
      const sin = Math.sin(-player.camera.rotation);
      player.camera.x += (rightX * cos - rightY * sin) * 320 * dt;
      player.camera.y += (rightX * sin + rightY * cos) * 320 * dt;
      player.camera.x = clamp(player.camera.x, -CAMERA_LIMIT, CAMERA_LIMIT);
      player.camera.y = clamp(player.camera.y, -CAMERA_LIMIT, CAMERA_LIMIT);
      updatePlayerPointer(player, player.input.cursorX, player.input.cursorY);

      const aPressed = getGamepadButton(gamepad, 0);
      const bPressed = getGamepadButton(gamepad, 1);
      const xPressed = getGamepadButton(gamepad, 2);
      const yPressed = getGamepadButton(gamepad, 3);
      const lbPressed = getGamepadButton(gamepad, 4);
      const rbPressed = getGamepadButton(gamepad, 5);
      const r3Pressed = getGamepadButton(gamepad, 11);
      player.camera.zoom = clamp(player.camera.zoom + (rbPressed ? 0.82 * dt : 0) - (lbPressed ? 0.82 * dt : 0), 0.36, 1.9);

      if (aPressed && !player.gamepadButtons.a) handleLeftDown(player, player.input.cursorX, player.input.cursorY, "controller");
      if (!aPressed && player.gamepadButtons.a) handleLeftUp(player, player.input.cursorX, player.input.cursorY, "controller");
      if (bPressed && !player.gamepadButtons.b) setPlayerOpenPanel(player, player.ui.openPanel === "weapons" ? null : "weapons");
      if (xPressed && !player.gamepadButtons.x) setPlayerOpenPanel(player, player.ui.openPanel === "assets" ? null : "assets");
      if (yPressed && !player.gamepadButtons.y) {
        clearPlayerSelection(player, true);
        setPlayerOpenPanel(player, null);
        playUiSound("clear", { volume: 0.46, cooldown: 0.05 });
      }
      if (r3Pressed && !player.gamepadButtons.r3) player.camera.rotation += Math.PI / 4;

      player.gamepadButtons.a = aPressed;
      player.gamepadButtons.b = bPressed;
      player.gamepadButtons.x = xPressed;
      player.gamepadButtons.y = yPressed;
      player.gamepadButtons.lb = lbPressed;
      player.gamepadButtons.rb = rbPressed;
      player.gamepadButtons.r3 = r3Pressed;
    }
  }

  function handleKey(event) {
    const key = event.key.toLowerCase();
    const fpPlayer = getFirstPersonActivePlayer();
    const typingTarget = isTextInputTarget(event.target);
    if (typingTarget) {
      if (state.admin.slashOpen && key === "enter") {
        event.preventDefault();
        executeSlashCommand(slashCommandInput ? slashCommandInput.value : "");
        return;
      }
      if (state.admin.panelOpen && key === "enter" && event.target === adminCommandInput) {
        event.preventDefault();
        armAdminToolFromCommand(adminCommandInput ? adminCommandInput.value : state.admin.commandText);
        return;
      }
      if (key === "escape") {
        event.preventDefault();
        if (state.admin.slashOpen) closeSlashCommand();
        else if (state.admin.panelOpen) closeAdminPanel();
        return;
      }
      return;
    }
    if (state.mode === "playing" && key === "/" && !fpPlayer) {
      event.preventDefault();
      openSlashCommand("/");
      return;
    }
    if (state.admin.slashOpen) {
      if (key === "escape") {
        event.preventDefault();
        closeSlashCommand();
        return;
      }
      if (key === "enter") {
        event.preventDefault();
        executeSlashCommand(slashCommandInput ? slashCommandInput.value : "");
        return;
      }
    }
    if (key === "w") state.keys.forward = true;
    else if (key === "s") state.keys.back = true;
    else if (key === "a") state.keys.left = true;
    else if (key === "d") state.keys.right = true;
    else if (key === "shift") state.keys.sprint = true;
    if (fpPlayer && (key === "w" || key === "a" || key === "s" || key === "d" || key === "shift")) {
      event.preventDefault();
      return;
    }
    const primary = getPrimaryPlayer();
    setActivePlayerContext(primary, getViewportForPlayer(primary));
    if (key === "escape") {
      if (fpPlayer) {
        event.preventDefault();
        exitFirstPerson(fpPlayer);
        return;
      }
      if (state.admin.panelOpen) {
        event.preventDefault();
        closeAdminPanel();
        return;
      }
      if (!document.fullscreenElement) {
        event.preventDefault();
        activateCeasefire();
      }
      return;
    }
    if (fpPlayer) {
      event.preventDefault();
      return;
    }
    if (key === "q") setPlayerOpenPanel(primary, state.ui.openPanel === "weapons" ? null : "weapons");
    else if (key === "e") setPlayerOpenPanel(primary, state.ui.openPanel === "assets" ? null : "assets");
    else if (key === "d") toggleDifficultyMode();
    else if (key === "-") setGameSpeed(0.5);
    else if (key === "1") setGameSpeed(1);
    else if (key === "2") setGameSpeed(2);
    else if (key === "5") setGameSpeed(5);
    else if (key === "x") {
      clearPlayerSelection(primary, true);
      notify("Selection cleared.");
      playUiSound("clear", { volume: 0.46, cooldown: 0.05 });
    } else if (key === "f") {
      toggleFullscreen().catch(() => {});
    }
  }

  function handleKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key === "w") state.keys.forward = false;
    else if (key === "s") state.keys.back = false;
    else if (key === "a") state.keys.left = false;
    else if (key === "d") state.keys.right = false;
    else if (key === "shift") state.keys.sprint = false;
  }

  function startMatch(matchType = "single", playerCount = 2) {
    exitFirstPerson(getFirstPersonActivePlayer(), { silent: true });
    if (matchType !== "lan" && matchType !== "lan-coop") resetLanSessionState();
    initializePlayers(matchType, playerCount);
    state.world.preset = sanitizeMapPreset(state.mapPreset);
    state.keys.forward = false;
    state.keys.back = false;
    state.keys.left = false;
    state.keys.right = false;
    state.keys.sprint = false;
    state.admin.slashOpen = false;
    state.admin.panelOpen = false;
    state.admin.points = [];
    syncAdminUi();
    for (const player of getHumanPlayers()) clampCursorToViewport(player);
    state.mode = "playing";
    state.winnerOwner = null;
    state.loserOwner = null;
    state.score = 0;
    state.time = 0;
    state.ids = 0;
    state.taxPulseLock = false;
    state.difficulty.ceasefireTimer = 0;
    state.difficulty.hardPressureApplied = false;
    audioState.lastResultCue = null;
    createWorld();
    addAdminLog("Loaded battlefield.", { extra: getMapPresetDef(state.world.preset).label });
    if (isHardModeActive()) applyHardDifficultyPressure();
    updateFogOfWar();
    overlay.classList.add("hidden");
    syncLiveControls();
    if (isLanHost()) pushLanSnapshot();
  }

  function renderGameToText() {
    const primary = getPrimaryPlayer();
    setActivePlayerContext(primary, getViewportForPlayer(primary));
    const payload = {
      mode: state.mode,
      matchType: state.matchType,
      mapPreset: state.world.preset || state.mapPreset,
      winnerOwner: state.winnerOwner,
      loserOwner: state.loserOwner,
      time: Number(state.time.toFixed(1)),
      wave: {
        index: state.waves.index,
        nextIn: Number(state.waves.timer.toFixed(1)),
      },
      assists: {
        difficulty: state.difficulty.mode,
        ceasefireSeconds: Number(state.difficulty.ceasefireTimer.toFixed(1)),
        speed: state.speed.multiplier,
        hardCamps: countHardCamps(),
      },
      lan: hasLanSession() || state.lan.linkRoomCode
        ? {
          role: state.lan.role,
          roomCode: state.lan.roomCode,
          linkRoomCode: state.lan.linkRoomCode,
          linkMatchType: state.lan.linkMatchType,
          guestJoined: state.lan.guestJoined,
          localOwner: state.lan.localOwner,
          joinUrl: state.lan.joinUrl,
          started: state.lan.started,
          startedAt: state.lan.startedAt,
          status: state.lan.statusText,
        }
        : null,
      players: getHumanPlayers().map((player) => ({
        owner: player.owner,
        label: player.label,
        camera: {
          x: Math.round(player.camera.x),
          y: Math.round(player.camera.y),
          zoom: Number(player.camera.zoom.toFixed(2)),
          rotation: Number(player.camera.rotation.toFixed(2)),
          coords: "origin centered, x right, y down in world space",
        },
        resources: {
          coins: Math.floor(player.resources.coins),
          wood: Math.floor(player.resources.wood),
          stone: Math.floor(player.resources.stone),
        },
        economy: {
          passiveIncome: getPassiveIncomeForOwner(player.owner),
        },
        fog: {
          exploredPct: Number(getPlayerFogCoverage(player).toFixed(1)),
          exploredCells: player.fog ? player.fog.exploredCount : 0,
          visiblePct: Number(getPlayerFogCoverage(player).toFixed(1)),
          visibleCells: player.fog ? player.fog.exploredCount : 0,
        },
        panels: { open: player.ui.openPanel, activePlacement: player.ui.activePlacementId },
        firstPerson: player.firstPerson && player.firstPerson.active
          ? {
            unitId: player.firstPerson.unitId,
            aiming: player.firstPerson.aiming,
            pitch: Number(player.firstPerson.pitch.toFixed(2)),
            yaw: Number(player.firstPerson.yaw.toFixed(2)),
          }
          : null,
        selection: [...state.world.units, ...state.world.buildings]
          .filter((entity) => player.selectedIds.has(entity.id))
          .map((entity) => entity.kind === "building"
            ? {
              id: entity.id,
              kind: entity.kind,
              itemId: entity.itemId,
              name: entity.def && entity.def.name ? entity.def.name : entity.itemId,
              x: Math.round(entity.x),
              y: Math.round(entity.y),
              hp: Math.round(entity.hp),
            }
            : {
              id: entity.id,
              kind: entity.kind,
              role: entity.role,
              x: Math.round(entity.x),
              y: Math.round(entity.y),
              hp: Math.round(entity.hp),
              bonus: entity.damageBonus || 0,
              weapon: entity.pickupWeapon,
              order: entity.order,
              interactKind: entity.interactKind,
              interactTargetId: entity.interactTargetId,
            }),
        units: state.world.units
          .filter((unit) => unit.owner === player.owner)
          .slice(0, 10)
          .map((unit) => ({
            id: unit.id,
            role: unit.role,
            x: Math.round(unit.x),
            y: Math.round(unit.y),
            hp: Math.round(unit.hp),
            order: unit.order,
            interactKind: unit.interactKind,
            interactTargetId: unit.interactTargetId,
          })),
        quickBar: player.quickSlots,
        buildings: state.world.buildings
          .filter((building) => building.owner === player.owner)
          .slice(0, 12)
          .map((building) => ({ id: building.id, item: building.itemId, x: Math.round(building.x), y: Math.round(building.y), hp: Math.round(building.hp) })),
        highlightedEnemies: player.ui.hoveredEnemyIds,
      })),
      hostiles: state.world.units
        .filter((unit) => !isHumanOwner(unit.owner))
        .slice(0, 10)
        .map((unit) => ({ id: unit.id, owner: unit.owner, role: unit.role, x: Math.round(unit.x), y: Math.round(unit.y), hp: Math.round(unit.hp) })),
      drops: state.world.drops.slice(0, 8).map((drop) => ({ id: drop.id, item: drop.def.id, x: Math.round(drop.x), y: Math.round(drop.y), ttl: Number(drop.ttl.toFixed(1)) })),
      effectsSummary: state.world.effects.slice(0, 12).map((effect) => ({ type: effect.type, radius: Math.round(effect.radius), shards: effect.shards ? effect.shards.length : 0 })),
      hostileSummary: {
        strongholds: countEnemyStrongholds(),
        structures: countHostileBuildings(),
        units: countHostileUnits(),
        camps: countHardCamps(),
      },
      terrainSummary: {
        canyonTiles: state.world.tiles.filter((tile) => tile.biome === "canyon").length,
        midCanyonTiles: state.world.tiles.filter((tile) => tile.biome === "canyon" && Math.abs(tile.x) < 720 && Math.abs(tile.y) < 460).length,
      },
      obstacles: {
        trees: [...state.world.trees]
          .sort((a, b) => Math.hypot(a.x - primary.camera.x, a.y - primary.camera.y) - Math.hypot(b.x - primary.camera.x, b.y - primary.camera.y))
          .slice(0, 8)
          .map((tree) => ({ id: tree.id, x: Math.round(tree.x), y: Math.round(tree.y), radius: Math.round(tree.radius), chunks: tree.chunksRemaining })),
        rocks: [...state.world.rocks]
          .sort((a, b) => Math.hypot(a.x - primary.camera.x, a.y - primary.camera.y) - Math.hypot(b.x - primary.camera.x, b.y - primary.camera.y))
          .slice(0, 8)
          .map((rock) => ({ id: rock.id, x: Math.round(rock.x), y: Math.round(rock.y), radius: Math.round(rock.radius), chunks: rock.chunksRemaining })),
      },
      resourceNodes: [...state.world.trees, ...state.world.rocks]
        .sort((a, b) => Math.hypot(a.x - primary.camera.x, a.y - primary.camera.y) - Math.hypot(b.x - primary.camera.x, b.y - primary.camera.y))
        .slice(0, 10)
        .map((node) => ({
          id: node.id,
          kind: node.kind,
          x: Math.round(node.x),
          y: Math.round(node.y),
          chunks: node.chunksRemaining,
          chunkHp: Math.round(node.chunkHp || 0),
        })),
      neutralEconomy: {
        buildings: state.world.buildings
          .filter((building) => building.owner === "neutral" && building.maxTaxReserve)
          .slice(0, 10)
          .map((building) => ({ id: building.id, item: building.itemId, x: Math.round(building.x), y: Math.round(building.y), reserve: Math.round(building.taxReserve || 0), maxReserve: building.maxTaxReserve })),
        civilians: state.world.civilians
          .slice(0, 10)
          .map((civilian) => ({ id: civilian.id, x: Math.round(civilian.x), y: Math.round(civilian.y), reserve: Math.round(civilian.coinPouch || 0), maxReserve: civilian.maxCoinPouch || 0, homeBuildingId: civilian.homeBuildingId })),
      },
      minimap: primary
        ? {
          exploredPct: Number(getPlayerFogCoverage(primary).toFixed(1)),
          visiblePct: Number(getPlayerFogCoverage(primary).toFixed(1)),
        }
        : null,
      quests: state.world.quests.map((quest) => ({ title: quest.title, progress: Math.round(quest.progress), target: quest.target, done: quest.done })),
    };
    return JSON.stringify(payload);
  }

  function advanceTime(ms) {
    const stepMs = 1000 / 60;
    const steps = Math.max(1, Math.round(ms / stepMs));
    for (let i = 0; i < steps; i += 1) update(stepMs / 1000);
    draw();
  }

  function loop(now) {
    const dt = clamp((now - (loop.lastTime || now)) / 1000, 0, 0.033);
    loop.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("pointerdown", ensureAudioUnlocked, { once: true });
  window.addEventListener("keydown", ensureAudioUnlocked, { once: true });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("mousedown", (event) => {
    const fpPlayer = getFirstPersonActivePlayer();
    if (fpPlayer) {
      setActivePlayerContext(fpPlayer, getViewportForPlayer(fpPlayer));
      if (event.button === 0) {
        event.preventDefault();
        fpPlayer.firstPerson.fireHeld = true;
        requestGameplayPointerLock();
      } else if (event.button === 2) {
        event.preventDefault();
        fpPlayer.firstPerson.aiming = unitSupportsAim(getFirstPersonUnit(fpPlayer, true));
        requestGameplayPointerLock();
      }
      return;
    }
    if (event.target !== canvas) return;
    const pointer = clientToCanvasPoint(event.clientX, event.clientY);
    const player = getPlayerForScreenPoint(pointer.x, pointer.y);
    setActivePlayerContext(player, getViewportForPlayer(player));
    if (event.button === 0) handleLeftDown(player, pointer.x, pointer.y, "mouse");
    else if (event.button === 2) {
      state.input.rightDown = true;
      state.input.actionSource = "mouse";
      state.input.panAnchorX = pointer.x;
      state.input.panAnchorY = pointer.y;
    } else if (event.button === 1) {
      state.input.middleDown = true;
      state.input.actionSource = "mouse";
      state.input.panAnchorX = pointer.x;
      state.input.panAnchorY = pointer.y;
    }
  });
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", (event) => {
    const fpPlayer = getFirstPersonActivePlayer();
    if (fpPlayer) {
      if (event.button === 0) fpPlayer.firstPerson.fireHeld = false;
      if (event.button === 2) fpPlayer.firstPerson.aiming = false;
      return;
    }
    const pointer = clientToCanvasPoint(event.clientX, event.clientY);
    for (const player of getControllablePlayers()) {
      setActivePlayerContext(player, getViewportForPlayer(player));
      if (event.button === 0 && state.input.leftDown && state.input.actionSource === "mouse") handleLeftUp(player, pointer.x, pointer.y, "mouse");
      if (event.button === 2 && state.input.rightDown && state.input.actionSource === "mouse") {
        state.input.rightDown = false;
        state.input.actionSource = null;
      }
      if (event.button === 1 && state.input.middleDown && state.input.actionSource === "mouse") {
        state.input.middleDown = false;
        state.input.actionSource = null;
      }
    }
  });
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("keydown", handleKey);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", () => {
    resize();
    for (const player of getHumanPlayers()) clampCursorToViewport(player);
    draw();
  });
  document.addEventListener("fullscreenchange", () => {
    resize();
    for (const player of getHumanPlayers()) clampCursorToViewport(player);
    draw();
  });
  startBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    handlePrimaryStart().catch((error) => {
      setLanStatus(`Unable to start this mode: ${error.message}`);
    });
  });
  mapPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      playUiSound("uiClick", { volume: 0.48, cooldown: 0.04 });
      setMapPreset(button.dataset.mapPreset, { notify: true });
    });
  });
  versusBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    startMatch("versus", 2);
  });
  if (versus3Btn) versus3Btn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    startMatch("versus", 3);
  });
  if (versus4Btn) versus4Btn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    startMatch("versus", 4);
  });
  if (coopBtn) coopBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    startMatch("coop", 2);
  });
  if (coop3Btn) coop3Btn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    startMatch("coop", 3);
  });
  if (coop4Btn) coop4Btn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    startMatch("coop", 4);
  });
  if (hostLanBtn) hostLanBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    startLanHostMatch();
  });
  if (joinLanBtn) joinLanBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    joinLanMatch();
  });
  if (hostLanCoopBtn) hostLanCoopBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    startLanHostMatch("lan-coop");
  });
  if (joinLanCoopBtn) joinLanCoopBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.54, cooldown: 0.04 });
    joinLanMatch("lan-coop");
  });
  syncLanOriginUi();
  if (difficultyBtn) difficultyBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.48, cooldown: 0.04 });
    toggleDifficultyMode();
  });
  if (ceasefireBtn) ceasefireBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.48, cooldown: 0.04 });
    activateCeasefire();
  });
  if (speedSlowBtn) speedSlowBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.44, cooldown: 0.04 });
    setGameSpeed(0.5);
  });
  if (speedNormalBtn) speedNormalBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.44, cooldown: 0.04 });
    setGameSpeed(1);
  });
  if (speedFastBtn) speedFastBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.44, cooldown: 0.04 });
    setGameSpeed(2);
  });
  if (speedUltraBtn) speedUltraBtn.addEventListener("click", () => {
    playUiSound("uiClick", { volume: 0.44, cooldown: 0.04 });
    setGameSpeed(5);
  });
  if (lanCodeInput) {
    lanCodeInput.addEventListener("input", () => {
      lanCodeInput.value = sanitizeRoomCode(lanCodeInput.value);
    });
  }
  if (lanLinkInput) {
    const selectLanLink = () => lanLinkInput.select();
    lanLinkInput.addEventListener("focus", selectLanLink);
    lanLinkInput.addEventListener("click", selectLanLink);
  }
  if (adminCommandInput) {
    adminCommandInput.addEventListener("input", () => {
      state.admin.commandText = adminCommandInput.value;
    });
  }
  if (adminOwnerSelect) {
    adminOwnerSelect.addEventListener("change", () => {
      state.admin.owner = adminOwnerSelect.value || "neutral";
      if (state.admin.activeTool && state.admin.activeTool.usesOwner) {
        setAdminStatus(`Owner changed to <code>${state.admin.owner}</code> for <code>${getAdminToolLabel(state.admin.activeTool)}</code>.`);
      } else {
        setAdminStatus(`Admin owner changed to <code>${state.admin.owner}</code>.`);
      }
      addAdminLog("Changed admin owner.", { owner: state.admin.owner });
      syncAdminUi();
    });
  }
  if (adminArmBtn) {
    adminArmBtn.addEventListener("click", () => {
      playUiSound("uiClick", { volume: 0.46, cooldown: 0.04 });
      armAdminToolFromCommand(adminCommandInput ? adminCommandInput.value : state.admin.commandText);
    });
  }
  if (adminClearPointsBtn) {
    adminClearPointsBtn.addEventListener("click", () => {
      playUiSound("clear", { volume: 0.42, cooldown: 0.04 });
      clearAdminPoints();
    });
  }
  if (adminClearLogBtn) {
    adminClearLogBtn.addEventListener("click", () => {
      playUiSound("clear", { volume: 0.42, cooldown: 0.04 });
      clearAdminLog();
    });
  }
  if (adminCopyLogBtn) {
    adminCopyLogBtn.addEventListener("click", () => {
      playUiSound("uiClick", { volume: 0.46, cooldown: 0.04 });
      copyAdminLog().catch(() => {});
    });
  }
  if (adminCloseBtn) {
    adminCloseBtn.addEventListener("click", () => {
      playUiSound("panelClose", { volume: 0.44, cooldown: 0.04 });
      closeAdminPanel();
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = advanceTime;

  resize();
  syncMapPresetUi();
  resetLanSessionState();
  syncAdminUi();
  initializePlayers("single");
  for (const player of getHumanPlayers()) clampCursorToViewport(player);
  createWorld();
  updateFogOfWar();
  syncLiveControls();
  draw();
  requestAnimationFrame(loop);
})();
