import "./styles/main.css";
import * as THREE from "three";
import { loadWorldData } from "./world/worldData.js";
import { createRenderer, resize, applyQuality } from "./core/renderer.js";
import { AssetLibrary } from "./core/assets.js";
import { LoadingScreen } from "./core/loading.js";
import { Emitter } from "./core/events.js";
import { resolveQuality, detectDevice, hasWebGL, preset } from "./core/quality.js";
import { loadBuilding, DoorController } from "./world/building.js";
import { buildFurniture } from "./world/furniture.js";
import { collectPlacements, buildProps } from "./world/props.js";
import { buildSignage } from "./world/signage.js";
import { MaterialCache } from "./world/materials.js";
import { NavGrid } from "./agents/navigation.js";
import { Agent } from "./agents/agent.js";
import { Simulation } from "./agents/simulation.js";
import { AGENTS } from "./data/agents.js";
import { Hud } from "./ui/hud.js";
import { DetailPanel } from "./ui/detail.js";
import { Overlays } from "./ui/overlays.js";
import { FallbackView, HeadlessAgent } from "./ui/fallback.js";
import { CameraRig } from "./interaction/camera.js";
import { InputController } from "./interaction/input.js";

const TOTAL_STEPS = 9;
const HUD_INTERVAL = 0.4;
const STORAGE_QUALITY = "v3o.quality";
const STORAGE_FLOOR = "v3o.floor";

const canvas = document.getElementById("scene");
const loading = new LoadingScreen(document);
const device = detectDevice();

const params = new URLSearchParams(window.location.search);
const paramQuality = params.get("quality");
const paramSeed = Number(params.get("seed"));
const simulationSeed = Number.isFinite(paramSeed) && paramSeed > 0 ? paramSeed : 20261001;

let requestedQuality = paramQuality ?? readPreference(STORAGE_QUALITY);
let qualityName = resolveQuality(requestedQuality, device);

boot().catch((error) => {
  console.error(error);
  loading.fail(error?.message ?? "Unexpected error while starting the office.");
});

async function boot() {
  loading.setSteps(TOTAL_STEPS);
  loading.setNote(`Simulated agent activity · seed 20261001 · ${device.mobile ? "mobile" : "desktop"}`);

  loading.step("Reading the office dataset…");
  const world = await loadWorldData();

  if (!hasWebGL()) {
    loading.step("WebGL unavailable — switching to the directory view");
    runHeadless(world);
    return;
  }

  loading.step("Starting the renderer…", 0);
  const { renderer, scene, camera } = createRenderer(canvas, qualityName, window.devicePixelRatio || 1);
  renderer.localClippingEnabled = true;

  const assets = new AssetLibrary();
  loading.step("Loading lighting…");
  const env = await assets.environment("assets/hdri/studio_small_09_1k.hdr", renderer);
  if (env?.environment) scene.environment = env.environment;

  loading.step("Loading the building…");
  const building = await loadBuilding(assets, world);
  for (const group of building.floors.values()) scene.add(group);

  loading.step("Placing furniture…");
  const materials = new MaterialCache();
  if (env?.environment) materials.setEnvMap(env.environment);
  const furniture = await buildFurniture(world, assets, materials, preset(qualityName));
  for (const group of furniture.floors.values()) scene.add(group);

  loading.step("Hanging artwork…");
  const signage = await buildSignage(world, assets);
  scene.add(signage.group);

  loading.step("Adding desk equipment…");
  const placementQuality = { ...preset(qualityName), deskProps: true };
  const agentDeskIds = new Set(AGENTS.map((agent) => agent.desk));
  const placements = collectPlacements(world, { agentDeskIds, quality: placementQuality });
  const props = await buildProps(assets, world, placements, preset(qualityName));
  props.group.visible = preset(qualityName).deskProps;
  scene.add(props.group);

  loading.step("Waking the agents…");
  const nav = new NavGrid(world);
  const agents = await createAgents(world, nav, assets, qualityName);
  for (const agent of agents) scene.add(agent.root);

  const events = new Emitter();
  const doors = new DoorController(building.leaves);
  const camera_ = new CameraRig(camera, canvas, { bounds: world.bounds });
  let activeFloors = null;

  const hud = new Hud({
    events,
    world,
    agents,
    on: {
      floor: (floor) => setFloor(floor),
      quality: (value) => setQuality(value),
      overview: () => camera_.overview(),
      credits: () => overlays.showCredits(),
      help: () => overlays.showHelp(),
      fullscreen: () => toggleFullscreen(),
      selectAgent: (id) => selectAgent(id),
      closeDetail: () => detail.close(),
    },
  });

  const detail = new DetailPanel({
    hud,
    world,
    agents,
    on: {
      focusAgent: (id) => focusAgent(id),
      followAgent: (id) => followAgent(id),
      focusRoom: (id) => focusRoom(id),
      focusFixture: (id) => focusFixture(id),
    },
  });

  const overlays = new Overlays({ world });

  const simulation = new Simulation({
    world,
    nav,
    agents,
    seed: simulationSeed,
    events,
    onLevelChange: (agent) => {
      if (camera_.follow?.agentId === agent.id) camera_.follow = null;
    },
  });
  detail.simulation = simulation;
  simulation.start();

  const proxies = [...furniture.pickProxies, ...props.proxies];
  const input = new InputController({
    canvas,
    camera,
    agents,
    proxies,
    getActiveFloors: () => activeFloors,
    handlers: {
      click: (hit) => onPick(hit),
      background: () => detail.close(),
      hover: () => {},
      overview: () => camera_.overview(),
      help: () => overlays.showHelp(),
      escape: () => {
        if (overlays.anyOpen) overlays.hideAll();
        else detail.close();
      },
      fullscreen: () => toggleFullscreen(),
      floor: (floor) => setFloor(floor),
    },
  });

  camera_.controls.addEventListener("start", () => {
    camera_.follow = null;
  });

  const floorBefore = readPreference(STORAGE_FLOOR);
  setFloor(floorBefore ?? "all", { silent: true });
  hud.setQuality(requestedQuality ?? "auto");

  const report = assets.getFailureReport();
  const assetNotes = [];
  if (report) assetNotes.push(report);
  if (furniture.missing.size) assetNotes.push(`Missing models: ${[...furniture.missing.keys()].join(", ")}.`);
  if (assetNotes.length) hud.setAssetIssues(assetNotes.join(" "));

  window.addEventListener("resize", onResize);
  onResize();

  loading.step("Ready", 1);
  loading.hide();

  const clock = createClock();
  let hudTimer = HUD_INTERVAL;

  renderer.setAnimationLoop(() => {
    const dt = clock();
    simulation.update(dt);
    for (const agent of agents) agent.update(dt, { camera, reducedMotion: false });
    applyLod(agents, camera);
    doors.update(dt, agents, activeFloors);
    camera_.update(dt);

    hudTimer += dt;
    if (hudTimer >= HUD_INTERVAL) {
      hudTimer = 0;
      const summary = simulation.summary();
      hud.render(summary);
      if (detail.subject) detail.refresh();
    }

    if (camera_.follow) {
      const live = agents.find((entry) => entry.id === camera_.follow.agentId);
      if (live) {
        camera_.follow.point = live.position;
        camera_.follow.elevation = world.floorById.get(live.floor)?.elevation ?? 0;
      }
    }

    renderer.render(scene, camera);
  });

  window.__office = { world, agents, simulation, hud, camera: camera_, renderer, scene, assets, input, detail, overlays };

  function setFloor(floor, { silent = false } = {}) {
    const normalized = floor === "L1" || floor === "L2" ? floor : "all";
    activeFloors = normalized === "all" ? null : new Set([normalized]);
    applyFloorClipping(renderer, normalized);
    for (const agent of agents) {
      agent.setVisible(!activeFloors || activeFloors.has(agent.floor));
    }
    const f1 = building.floors.get("L1");
    const f2 = building.floors.get("L2");
    const u1 = furniture.floors.get("L1");
    const u2 = furniture.floors.get("L2");
    if (f1) f1.visible = normalized !== "L2";
    if (f2) f2.visible = normalized !== "L1";
    if (u1) u1.visible = normalized !== "L2";
    if (u2) u2.visible = normalized !== "L1";
    for (const holder of signage.group.children) {
      holder.visible = !activeFloors || activeFloors.has(holder.userData.floor);
    }
    props.group.visible = preset(qualityName).deskProps;
    if (!silent) writePreference(STORAGE_FLOOR, normalized);
    hud.setFloor(normalized, { silent: true });
  }

  function setQuality(value) {
    requestedQuality = value;
    qualityName = resolveQuality(value, device);
    const config = applyQuality(renderer, qualityName, window.devicePixelRatio || 1);
    if (env?.environment) scene.environment = env.environment;
    props.group.visible = config.deskProps;
    props.group.traverse((node) => {
      if (node.isInstancedMesh) node.castShadow = config.shadows;
    });
    for (const agent of agents) {
      agent.maxLabelDistance = config.maxLabelDistance;
      agent.model.traverse((node) => {
        if (node.isMesh) node.castShadow = config.shadows;
      });
    }
    for (const group of [building.floors, furniture.floors]) {
      for (const floorGroup of group.values()) {
        floorGroup.traverse((node) => {
          if (node.isMesh && node.name.startsWith("shell-")) node.receiveShadow = config.shadows;
        });
      }
    }
    writePreference(STORAGE_QUALITY, value);
    hud.setQuality(value);
  }

  function onResize() {
    resize(renderer, camera, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  function onPick(hit) {
    if (hit.type === "agent") {
      const agent = agents.find((entry) => entry.id === hit.id);
      selectAgent(hit.id);
      if (agent) {
        camera_.focusPoint(agent.position.x, agent.position.y, world.floorById.get(agent.floor)?.elevation ?? 0, {
          distance: 6,
          height: 3,
        });
      }
      return;
    }
    if (hit.type === "fixture") {
      detail.showFixture(hit.id);
      const proxy = proxies.find((entry) => entry.id === hit.id && entry.kind === "fixture");
      if (proxy) camera_.focusBox(proxy.box);
      return;
    }
    if (hit.type === "prop") {
      detail.showRoom(hit.room);
      return;
    }
    detail.close();
  }

  function selectAgent(id) {
    const agent = agents.find((entry) => entry.id === id);
    if (!agent) return;
    camera_.follow = { agentId: id, point: agent.position, elevation: world.floorById.get(agent.floor)?.elevation ?? 0 };
    detail.showAgent(id);
    hud.setSelectedAgent(id);
  }

  function focusAgent(id) {
    const agent = agents.find((entry) => entry.id === id);
    if (!agent) return;
    camera_.focusPoint(agent.position.x, agent.position.y, world.floorById.get(agent.floor)?.elevation ?? 0, { distance: 6, height: 3 });
  }

  function followAgent(id) {
    const agent = agents.find((entry) => entry.id === id);
    if (!agent) return;
    camera_.follow = { agentId: id, point: agent.position, elevation: world.floorById.get(agent.floor)?.elevation ?? 0 };
  }

  function focusRoom(id) {
    const room = world.roomById.get(id);
    if (!room) return;
    camera_.focusPoint(room.center[0], room.center[1], world.floorById.get(room.floor)?.elevation ?? 0, { distance: 12, height: 7 });
  }

  function focusFixture(id) {
    const proxy = proxies.find((entry) => entry.id === id && entry.kind === "fixture");
    if (proxy) camera_.focusBox(proxy.box);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }
}

function applyFloorClipping(renderer, floor) {
  if (floor === "L1") renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 3.7)];
  else if (floor === "L2") renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -3.9)];
  else renderer.clippingPlanes = [];
}

/** Frame delta in seconds, clamped so a tab that was backgrounded cannot jump. */
function createClock() {
  let last = performance.now();
  return () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    return dt;
  };
}

function applyLod(agents, camera) {
  for (const agent of agents) {
    const far = camera.position.distanceToSquared(agent.object.position) > 30 * 30;
    agent.setLod(far ? 1 : 0);
  }
}

async function createAgents(world, nav, assets, qualityName) {
  const quality = preset(qualityName);
  const gltfs = await Promise.all(AGENTS.map((agent) => assets.gltf(`assets/characters/${agent.avatar}.glb`)));
  const agents = [];
  AGENTS.forEach((definition, index) => {
    const gltf = gltfs[index];
    if (!gltf) return;
    const agent = new Agent(definition, { gltf, nav, world, quality, accent: definition.accent });
    const slot = world.slotById.get(definition.seat);
    if (slot) agent.place(slot.pos, definition.floor, slot.facing ?? 0);
    else agent.place(world.roomById.get(definition.room)?.center ?? [0, 0], definition.floor, 0);
    agents.push(agent);
  });
  return agents;
}

function runHeadless(world) {
  const nav = new NavGrid(world);
  const agents = AGENTS.map((definition) => {
    const agent = new HeadlessAgent(definition, { nav, world });
    const slot = world.slotById.get(definition.seat);
    agent.place(slot?.pos ?? world.roomById.get(definition.room)?.center ?? [0, 0], definition.floor);
    return agent;
  });
  const events = new Emitter();
  const simulation = new Simulation({ world, nav, agents, events });
  simulation.start();
  const view = new FallbackView({ world, agents, simulation });
  view.setReason(
    "This browser or device did not provide a WebGL context, so the 3D office cannot be drawn. The simulation below is the same one the 3D view runs.",
  );
  const summary = simulation.summary();
  view.setCredits(`MIT-licensed office kit by Budi Prabhawa + CC0 Poly Haven props — see the 3D view's Credits dialog for the full list.`);
  view.render(summary);
  loading.hide();
  let timer = 0;
  const clock = createClock();
  const tick = () => {
    const dt = clock();
    simulation.update(dt);
    for (const agent of agents) agent.update(dt);
    timer += dt;
    if (timer >= HUD_INTERVAL) {
      timer = 0;
      view.render(simulation.summary());
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function readPreference(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode — preferences are optional */
  }
}
