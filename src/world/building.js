import * as THREE from "three";
import { Batcher } from "./materials.js";
import { planRotationToY } from "./coords.js";

const OPEN_RADIUS = 2.7;
const SWING_SECONDS = 0.55;
const BUILDING_FILES = {
  L1: "assets/building/building-L1.glb",
  L2: "assets/building/building-L2.glb",
};

/**
 * Loads the vendored building shell. The exported GLB is already in absolute
 * glTF coordinates `(x, height, -planY)` at the correct floor elevation, so it
 * is added without any extra transform.
 *
 * Static geometry is merged per material to keep the draw-call budget
 * (SRS NFR-02); door leaves and the lift stay separate because they animate.
 */
export async function loadBuilding(assets, world) {
  const floors = new Map();
  const leaves = new Map();
  const stats = { drawCalls: 0, triangles: 0, leaves: 0 };

  for (const floor of world.floors) {
    const gltf = await assets.gltf(BUILDING_FILES[floor.id]);
    const group = new THREE.Group();
    group.name = `building-${floor.id}`;
    group.userData.floor = floor.id;

    if (gltf) {
      const batcher = new Batcher();
      const source = gltf.scene;
      source.updateMatrixWorld(true);
      const materialCache = new Map();
      const keepSeparate = [];

      source.traverse((node) => {
        if (!node.isMesh) return;
        const kind = node.userData?.kantor_kind ?? node.parent?.userData?.kantor_kind;
        const name = node.name || node.parent?.name || "";
        if (/^LEAF-/.test(name) || kind === "door_leaf") {
          keepSeparate.push({ node, kind: "door_leaf", name });
          return;
        }
        if (kind === "lift" || /^LIFT-/.test(name)) {
          keepSeparate.push({ node, kind: "lift", name });
          return;
        }
        const material = mergeBuildingMaterial(materialCache, node.material);
        batcher.add(node.geometry, material, node.matrixWorld);
      });

      const result = batcher.build(group, { name: `shell-${floor.id}`, receiveShadow: true });
      stats.drawCalls += result.drawCalls;
      stats.triangles += result.triangles;

      for (const entry of keepSeparate) {
        const mesh = detachMesh(entry.node);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.name = entry.name || mesh.name;
        if (entry.kind === "door_leaf") {
          const leaf = registerLeaf(mesh, world, floor);
          if (leaf) {
            group.add(leaf.pivot);
            leaves.set(leaf.id, leaf);
            stats.drawCalls += 1;
          }
          continue;
        }
        group.add(mesh);
        stats.drawCalls += 1;
      }
    }

    floors.set(floor.id, group);
  }

  stats.leaves = leaves.size;
  return { floors, leaves, stats };
}

function mergeBuildingMaterial(cache, material) {
  const key = material?.name ?? "default";
  if (cache.has(key)) return cache.get(key);
  const merged = new THREE.MeshStandardMaterial({
    color: material?.color?.clone() ?? new THREE.Color(0xffffff),
    roughness: material?.roughness ?? 0.8,
    metalness: material?.metalness ?? 0,
    side: THREE.DoubleSide,
    transparent: Boolean(material?.transparent),
    opacity: material?.opacity ?? 1,
    emissive: material?.emissive?.clone() ?? new THREE.Color(0x000000),
    emissiveIntensity: material?.emissiveIntensity ?? 1,
  });
  merged.name = `shell:${key}`;
  merged.envMapIntensity = 0.55;
  cache.set(key, merged);
  return merged;
}

/** Moves a mesh out of the loaded hierarchy while keeping its world transform. */
function detachMesh(node) {
  node.updateWorldMatrix(true, false);
  const mesh = new THREE.Mesh(node.geometry, node.material);
  mesh.applyMatrix4(node.matrixWorld);
  mesh.userData = { ...node.parent?.userData, ...node.userData };
  node.removeFromParent();
  return mesh;
}

/**
 * Re-parents a leaf mesh under a pivot group placed at its hinge, so a rotation
 * about the group's up axis swings the leaf instead of spinning it in place.
 * The GLB leaf node already sits at the hinge, so the geometry stays untouched.
 */
function registerLeaf(mesh, world, floor) {
  const leafId = mesh.name || mesh.userData?.kantor_id;
  if (!leafId) return null;
  const data = (world.wallsByFloor?.[floor.id]?.leaves ?? []).find((leaf) => leaf.id === leafId);
  const hinge = [mesh.position.x, -mesh.position.z];
  const pivot = new THREE.Group();
  pivot.name = `door-${leafId}`;
  pivot.position.copy(mesh.position);
  pivot.quaternion.copy(mesh.quaternion);
  const baseQuaternion = mesh.quaternion.clone();
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.removeFromParent();
  pivot.add(mesh);

  return {
    id: leafId,
    floor: floor.id,
    pivot,
    baseQuaternion,
    closedDeg: data?.closedDeg ?? 0,
    openDeg: data?.openDeg ?? 90,
    hinge: data?.hinge ?? hinge,
    openness: 0,
    target: 0,
  };
}

/**
 * Door leaves open when an agent walks up to them, exactly like a person would.
 * Angles come from the derived walls dataset; the authored GLB is in the closed
 * position, so only the delta from `closedDeg` is applied.
 */
export class DoorController {
  constructor(leaves) {
    this.leaves = leaves;
  }

  update(dt, agents, activeFloors) {
    const step = dt / SWING_SECONDS;
    for (const leaf of this.leaves.values()) {
      const active = !activeFloors || activeFloors.has(leaf.floor);
      const near =
        active &&
        agents.some((agent) => {
          if (agent.floor !== leaf.floor || !agent.visible) return false;
          return Math.hypot(agent.position.x - leaf.hinge[0], agent.position.y - leaf.hinge[1]) < OPEN_RADIUS;
        });
      leaf.target = near ? 1 : 0;
      if (leaf.openness === leaf.target) continue;
      leaf.openness =
        leaf.target > leaf.openness
          ? Math.min(leaf.target, leaf.openness + step)
          : Math.max(leaf.target, leaf.openness - step);
      this.apply(leaf);
    }
  }

  apply(leaf) {
    const delta = shortestDelta(leaf.closedDeg, leaf.openDeg) * leaf.openness;
    leaf.pivot.quaternion.copy(leaf.baseQuaternion);
    leaf.pivot.rotateY(planRotationToY(delta));
  }
}

function shortestDelta(from, to) {
  return (((to - from + 540) % 360) - 180);
}
