import * as THREE from "three";
import { fixtureMatrix } from "./coords.js";
import { furnitureAssetUrl } from "../data/fixtures.js";

/**
 * The vendored gallery panels and posters reserve a colour zone for artwork
 * (`art_a`/`art_b`/`art_c`) but ship no images — the upstream signage files are
 * the generator's own compositions (`ART-01`…`ART-11`, original work, generated
 * by the upstream `tools/make_signage.py`).
 *
 * Rather than guessing placement constants, the art zone is measured from the
 * loaded model and the artwork plane is laid exactly on that face. If an image is
 * missing the plane is simply not created, leaving the panel's original colours.
 */
export async function buildSignage(world, assets) {
  const group = new THREE.Group();
  group.name = "signage";
  const materialCache = new Map();
  const typeCache = new Map();
  const stats = { planes: 0, missing: [] };

  for (const fixture of world.fixtures) {
    if (!fixture.artwork) continue;
    if (!typeCache.has(fixture.type)) {
      typeCache.set(fixture.type, await assets.gltf(furnitureAssetUrl(fixture.type)));
    }
    const gltf = typeCache.get(fixture.type);
    if (!gltf) continue;

    const zone = measureArtZone(gltf.scene);
    if (!zone) continue;

    let material = materialCache.get(fixture.artwork);
    if (material === undefined) {
      material = await createArtworkMaterial(assets, fixture.artwork);
      materialCache.set(fixture.artwork, material);
      if (!material) stats.missing.push(fixture.artwork);
    }
    if (!material) continue;

    const width = (zone.max.x - zone.min.x) * 0.94;
    const height = (zone.max.y - zone.min.y) * 0.94;
    if (width <= 0.02 || height <= 0.02) continue;

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    plane.position.set((zone.min.x + zone.max.x) / 2, (zone.min.y + zone.max.y) / 2, zone.max.z + 0.006);
    plane.name = `art-${fixture.id}`;

    const holder = new THREE.Group();
    holder.name = `art-holder-${fixture.id}`;
    holder.applyMatrix4(fixtureMatrix(fixture.pos, fixture.rot, world.floorById.get(fixture.floor)?.elevation ?? 0));
    holder.userData.floor = fixture.floor;
    holder.add(plane);
    group.add(holder);
    stats.planes += 1;
  }

  return { group, stats };
}

/**
 * Bounding box (in the model's local frame, node transforms included) of the
 * meshes that carry an artwork material. Falls back to the whole model so a panel
 * without an art zone still shows its image.
 */
export function measureArtZone(scene) {
  scene.updateMatrixWorld(true);
  const artBox = new THREE.Box3();
  const fullBox = new THREE.Box3();
  let foundArt = false;
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const isArt = materials.some((material) => /^art/i.test(material?.name ?? ""));
    node.geometry.computeBoundingBox();
    const box = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
    fullBox.union(box);
    if (isArt) {
      artBox.union(box);
      foundArt = true;
    }
  });
  if (fullBox.isEmpty()) return null;
  return foundArt ? artBox : fullBox;
}

async function createArtworkMaterial(assets, artworkId) {
  const texture = await assets.texture(`assets/signage/${artworkId}.jpg`);
  if (!texture) return null;
  texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.62,
    metalness: 0,
    side: THREE.FrontSide,
  });
  material.name = `artwork:${artworkId}`;
  return material;
}
