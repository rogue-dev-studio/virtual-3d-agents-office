import * as THREE from "three";
import { Batcher } from "./materials.js";
import { fixtureMatrix } from "./coords.js";
import { furnitureAssetUrl, isShellType } from "../data/fixtures.js";

/**
 * Places every kept fixture from the vendored dataset.
 *
 * Furniture GLBs are authored in their own local frame (centred on x/z, sitting
 * on y = 0, front towards local +Z) with the size already baked into the node
 * transform, so a fixture is placed by composing its plan position, plan rotation
 * and floor elevation on top of the model's own transform.
 *
 * Static parts are merged per material and per floor; animated shell parts
 * (`stair_u`, `lift`) are skipped because the building GLB already contains them.
 */
export async function buildFurniture(world, assets, materials, quality) {
  const floors = new Map();
  const pickProxies = [];
  const batchers = new Map();
  const missing = new Map();
  const typeCache = new Map();
  const stats = { drawCalls: 0, triangles: 0, placed: 0, missing: 0 };

  for (const floor of world.floors) {
    const group = new THREE.Group();
    group.name = `furniture-${floor.id}`;
    group.userData.floor = floor.id;
    floors.set(floor.id, group);
    batchers.set(floor.id, new Batcher());
  }

  const matrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();

  for (const fixture of world.fixtures) {
    if (isShellType(fixture.type)) continue;
    const floorMeta = world.floorById.get(fixture.floor);
    if (!floorMeta) continue;

    if (!typeCache.has(fixture.type)) typeCache.set(fixture.type, await assets.gltf(furnitureAssetUrl(fixture.type)));
    const gltf = typeCache.get(fixture.type);
    if (!gltf) {
      missing.set(fixture.type, (missing.get(fixture.type) ?? 0) + 1);
      stats.missing += 1;
      continue;
    }

    fixtureMatrix(fixture.pos, fixture.rot, floorMeta.elevation, matrix);
    const batcher = batchers.get(fixture.floor);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((node) => {
      if (!node.isMesh || !node.visible) return;
      worldMatrix.multiplyMatrices(matrix, node.matrixWorld);
      batcher.add(node.geometry, materials.get(node.material), worldMatrix);
    });
    pickProxies.push(fixtureProxy(fixture, floorMeta));
    stats.placed += 1;
  }

  for (const floor of world.floors) {
    const result = batchers.get(floor.id).build(floors.get(floor.id), {
      name: `furniture-${floor.id}`,
      castShadow: quality.shadows,
      receiveShadow: true,
    });
    stats.drawCalls += result.drawCalls;
    stats.triangles += result.triangles;
  }

  return { floors, pickProxies, missing, stats };
}

/** Axis-aligned box around a fixture, used for click picking (no raycast needed). */
export function fixtureProxy(fixture, floorMeta) {
  const [w, d, h] = fixture.size;
  const radians = THREE.MathUtils.degToRad(fixture.rot);
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const halfX = (cos * w + sin * d) / 2;
  const halfZ = (sin * w + cos * d) / 2;
  const elevation = floorMeta?.elevation ?? 0;
  const center = new THREE.Vector3(fixture.pos[0], elevation + h / 2, -fixture.pos[1]);
  const box = new THREE.Box3(
    new THREE.Vector3(center.x - halfX, elevation, center.z - halfZ),
    new THREE.Vector3(center.x + halfX, elevation + h, center.z + halfZ),
  );
  return {
    kind: "fixture",
    id: fixture.id,
    label: fixtureLabel(fixture),
    floor: fixture.floor,
    room: fixture.room,
    type: fixture.type,
    interactive: fixtureInteractive(fixture),
    box,
  };
}

function fixtureLabel(fixture) {
  const names = {
    desk: "Workstation desk",
    desk_exec: "Executive desk",
    chair: "Office chair",
    chair_guest: "Guest chair",
    meeting_table: "Meeting table",
    round_table: "Round table",
    lab_bench: "Lab bench",
    lab_rack_open: "Open equipment rack",
    rack_42u: "42U server rack",
    gallery_panel: "Gallery panel",
    poster: "Poster",
    wall_display: "Wall display",
    whiteboard: "Whiteboard",
    directory_sign: "Directory sign",
    coffee_bar: "Coffee bar",
    pantry_counter: "Pantry counter",
    plan_table: "Blueprint table",
    drafting_table: "Drafting table",
    media_console: "Media console",
    reception_desk: "Reception desk",
    bookshelf: "Bookshelf",
    model_shelf: "Model shelf",
    storage_shelf: "Storage shelf",
    tool_cabinet: "Tool cabinet",
    plant_large: "Plant",
    plant_small: "Small plant",
    planter_box: "Planter box",
    tree_planter: "Indoor tree",
    sofa: "Sofa",
    armchair: "Armchair",
    beanbag: "Beanbag",
    bench: "Bench",
    stool: "Stool",
    locker: "Locker",
    fridge: "Fridge",
    sink: "Sink",
    wc: "WC",
    shower_stall: "Shower",
    partition: "Partition",
    easel: "Easel",
  };
  return names[fixture.type] ?? fixture.type.replace(/_/g, " ");
}

function fixtureInteractive(fixture) {
  return Boolean(fixture.artwork) || ["directory_sign", "coffee_bar", "media_console", "plan_table", "desk", "desk_exec"].includes(fixture.type);
}
