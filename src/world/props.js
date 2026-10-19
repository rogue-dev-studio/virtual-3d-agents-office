import * as THREE from "three";
import { fixtureMatrix } from "./coords.js";

/**
 * Poly Haven CC0 props that fill the gaps the vendored kit does not cover
 * (monitors, laptops, lighting, desk clutter, infrastructure details).
 *
 * Each model is measured at runtime and uniformly scaled so that one chosen axis
 * matches a real-world target size — that removes all guesswork about the export
 * scale of a third-party asset.
 */
export const PROP_MODELS = {
  monitor: { asset: "Television_01", fit: { axis: "x", size: 0.62 }, label: "Desk monitor" },
  laptop: { asset: "classic_laptop", fit: { axis: "x", size: 0.34 }, label: "Laptop" },
  lamp: { asset: "desk_lamp_arm_01", fit: { axis: "y", size: 0.5 }, label: "Desk lamp" },
  notepads: { asset: "office_notepads", fit: { axis: "x", size: 0.3 }, label: "Notepads" },
  stationery: { asset: "stationery_supplies", fit: { axis: "x", size: 0.36 }, label: "Stationery" },
  cabinet: { asset: "drawer_cabinet", fit: { axis: "x", size: 0.45 }, label: "Drawer cabinet" },
  bin: { asset: "metal_trash_can", fit: { axis: "y", size: 0.36 }, label: "Office bin" },
  clock: { asset: "wall_clock", fit: { axis: "x", size: 0.34 }, label: "Wall clock" },
  powerBox: { asset: "power_box_01", fit: { axis: "y", size: 0.6 }, label: "Power distribution box" },
  circuitBoard: { asset: "circuit_board", fit: { axis: "x", size: 0.3 }, label: "Circuit board" },
  projector: { asset: "projector_screen", fit: { axis: "x", size: 2.6 }, label: "Projector screen" },
};

/** Which props each desk tier gets. Tiers keep the open-plan rows readable. */
export const DESK_TIERS = {
  full: ["monitor", "laptop", "lamp", "notepads", "stationery", "cabinet", "bin"],
  row: ["monitor", "laptop", "notepads"],
  lab: ["monitor", "notepads", "stationery"],
  reception: ["monitor", "notepads"],
};

const DESK_TIER_BY_TYPE = {
  desk: "row",
  desk_exec: "full",
  lab_bench: "lab",
  reception_desk: "reception",
};

/**
 * Prop placement in the desk's own local frame.
 * `x` = along the desk width, `z` = depth with `+z` towards the sitter,
 * `y` = height above the floor; `surface: true` puts it on the worktop instead.
 */
const DESK_LAYOUT = {
  monitor: { pos: [0, 0, -0.26], surface: true, rot: 0 },
  laptop: { pos: [-0.42, 0, 0.07], surface: true, rot: 0 },
  lamp: { pos: [0.58, 0, -0.28], surface: true, rot: 0 },
  notepads: { pos: [0.3, 0.004, 0.3], surface: true, rot: -12 },
  stationery: { pos: [0.02, 0.004, 0.34], surface: true, rot: 8 },
  cabinet: { pos: [-0.72, 0, -0.16], surface: false, rot: 0 },
  bin: { pos: [0.62, 0, 0.34], surface: false, rot: 0 },
};

/** Room-level props, positioned on walls or floors in plan coordinates. */
const ROOM_PROPS = [
  { prop: "projector", room: "L1-MEET", pos: [4, 0.55], rot: 180, mount: 1.55 },
  { prop: "projector", room: "L2-GYM", pos: [18.5, 19.1], rot: 180, mount: 1.55 },
  { prop: "projector", room: "L2-CHAT", pos: [3, 10.55], rot: 180, mount: 1.55 },
  { prop: "powerBox", room: "L1-SERVER", pos: [25.5, 22.9], rot: 180, mount: 0 },
  { prop: "powerBox", room: "L1-STORE", pos: [24.5, 20.4], rot: 0, mount: 0 },
  { prop: "circuitBoard", room: "L1-SERVER", pos: [27.7, 22.35], rot: 0, mount: 2.02 },
  { prop: "circuitBoard", room: "L1-LAB", pos: [26.6, 15.55], rot: 0, mount: 1.24 },
];

/** Clocks are anchored to existing wall displays so they always land on a wall. */
const CLOCK_ANCHORS = ["FX-L1-065", "FX-L2-079", "FX-L2-087"];

export function collectPlacements(world, { agentDeskIds = new Set(), quality } = {}) {
  const placements = [];
  if (!quality?.deskProps) return placements;

  for (const fixture of world.fixtures) {
    const tier = agentDeskIds.has(fixture.id) ? "full" : DESK_TIER_BY_TYPE[fixture.type];
    if (!tier) continue;
    const floorMeta = world.floorById.get(fixture.floor);
    const base = fixtureMatrix(fixture.pos, fixture.rot, floorMeta?.elevation ?? 0);
    for (const prop of DESK_TIERS[tier]) {
      const layout = DESK_LAYOUT[prop];
      if (!layout) continue;
      placements.push({
        prop,
        room: fixture.room,
        floor: fixture.floor,
        anchor: fixture.id,
        matrix: composeLocal(base, layout, fixture.size[2], fixture.size[0]),
      });
    }
  }

  for (const entry of ROOM_PROPS) {
    const room = world.roomById.get(entry.room);
    if (!room) continue;
    const base = fixtureMatrix(entry.pos, entry.rot, world.floorById.get(room.floor)?.elevation ?? 0);
    placements.push({
      prop: entry.prop,
      room: entry.room,
      floor: room.floor,
      anchor: entry.room,
      matrix: new THREE.Matrix4().multiplyMatrices(base, new THREE.Matrix4().makeTranslation(0, entry.mount, 0)),
    });
  }

  for (const fixtureId of CLOCK_ANCHORS) {
    const fixture = world.fixtureById.get(fixtureId);
    if (!fixture) continue;
    const alongY = fixture.rot % 180 === 90;
    const offset = alongY ? [0, 1.7] : [1.7, 0];
    const base = fixtureMatrix(
      [fixture.pos[0] + offset[0], fixture.pos[1] + offset[1]],
      fixture.rot,
      world.floorById.get(fixture.floor)?.elevation ?? 0,
    );
    placements.push({
      prop: "clock",
      room: fixture.room,
      floor: fixture.floor,
      anchor: fixture.id,
      matrix: new THREE.Matrix4().multiplyMatrices(base, new THREE.Matrix4().makeTranslation(0, 2.35, 0)),
    });
  }

  return placements;
}

function composeLocal(base, layout, surfaceHeight, deskWidth) {
  const local = new THREE.Matrix4();
  const y = layout.surface ? surfaceHeight : layout.pos[1];
  const x = layout.pos[0] < 0 ? Math.min(layout.pos[0], -(deskWidth / 2)) : layout.pos[0];
  local.compose(
    new THREE.Vector3(x, y, layout.pos[2]),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(layout.rot ?? 0)),
    new THREE.Vector3(1, 1, 1),
  );
  return new THREE.Matrix4().multiplyMatrices(base, local);
}

/**
 * Builds one `InstancedMesh` per source mesh of every used prop, so 13 monitors
 * cost three draw calls instead of thirty-nine. Returns pick proxies so props
 * are also clickable.
 */
export async function buildProps(assets, world, placements, quality) {
  const group = new THREE.Group();
  group.name = "props";
  const proxies = [];
  const byProp = new Map();
  for (const placement of placements) {
    if (!byProp.has(placement.prop)) byProp.set(placement.prop, []);
    byProp.get(placement.prop).push(placement);
  }

  const stats = { drawCalls: 0, triangles: 0, instances: 0, missing: 0 };
  const materialCache = new Map();

  for (const [propId, list] of byProp) {
    const model = PROP_MODELS[propId];
    const gltf = await assets.gltf(`assets/polyhaven/${model.asset}.glb`);
    if (!gltf) {
      stats.missing += list.length;
      continue;
    }
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const native = size[model.fit.axis] || Math.max(size.x, size.y, size.z);
    const scale = model.fit.size / native;
    const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale);

    const parts = [];
    gltf.scene.traverse((node) => {
      if (node.isMesh && node.visible) parts.push(node);
    });

    const scaledBounds = bounds.clone().applyMatrix4(scaleMatrix);
    const placementMatrix = new THREE.Matrix4();

    for (const part of parts) {
      const material = materialCache.get(part.material) ?? part.material;
      materialCache.set(part.material, material);
      const instanced = new THREE.InstancedMesh(part.geometry, material, list.length);
      instanced.name = `prop:${propId}:${part.name || "part"}`;
      instanced.castShadow = quality.shadows;
      instanced.receiveShadow = true;
      instanced.frustumCulled = false;
      list.forEach((placement, index) => {
        placementMatrix.multiplyMatrices(placement.matrix, scaleMatrix).multiply(part.matrixWorld);
        instanced.setMatrixAt(index, placementMatrix);
      });
      instanced.instanceMatrix.needsUpdate = true;
      instanced.computeBoundingSphere();
      group.add(instanced);
      stats.drawCalls += 1;
      stats.triangles +=
        ((part.geometry.index ? part.geometry.index.count : part.geometry.attributes.position.count) / 3) * list.length;
    }

    for (const placement of list) {
      const box = scaledBounds.clone().applyMatrix4(placement.matrix);
      proxies.push({
        kind: "prop",
        id: `${placement.anchor}:${propId}`,
        label: model.label,
        floor: placement.floor,
        room: placement.room,
        box,
      });
      stats.instances += 1;
    }
  }

  stats.triangles = Math.round(stats.triangles);
  return { group, proxies, stats };
}
