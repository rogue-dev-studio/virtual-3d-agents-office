import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const NUMERIC_KEYS = [
  "roughness",
  "metalness",
  "opacity",
  "emissiveIntensity",
  "ior",
  "specularIntensity",
  "clearcoat",
  "clearcoatRoughness",
  "sheen",
  "transmission",
  "thickness",
];

/**
 * The vendored furniture/building GLBs carry no textures — only flat PBR colours
 * keyed by material name. That lets us share one material instance per name and
 * merge every piece of furniture that uses it into a single draw call while
 * keeping the original look (SRS NFR-02).
 */
export class MaterialCache {
  constructor() {
    this.materials = new Map();
    this.envMap = null;
  }

  get(source) {
    const name = source?.name || "default";
    if (this.materials.has(name)) return this.materials.get(name);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    material.name = name;
    if (source) {
      if (source.color) material.color.copy(source.color);
      if (source.emissive) material.emissive.copy(source.emissive);
      for (const key of NUMERIC_KEYS) {
        if (typeof source[key] === "number") material[key] = source[key];
      }
      if (source.side !== undefined) material.side = source.side;
      if (source.transparent) {
        material.transparent = true;
        material.depthWrite = false;
      }
    }
    material.envMapIntensity = 0.7;
    material.needsUpdate = true;
    this.materials.set(name, material);
    return material;
  }

  setEnvMap(envMap) {
    this.envMap = envMap;
    for (const material of this.materials.values()) {
      material.envMap = envMap;
      material.needsUpdate = true;
    }
  }

  get size() {
    return this.materials.size;
  }

  dispose() {
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
  }
}

/**
 * Merges geometry per material. Everything is normalised to `POSITION + NORMAL`
 * and de-indexed first, because `mergeGeometries` requires identical attribute
 * sets across inputs and the vendored meshes disagree on UVs.
 */
export class Batcher {
  constructor() {
    this.buckets = new Map();
    this.triangles = 0;
  }

  add(geometry, material, matrix) {
    const bucket = this.bucket(material);
    const clone = normalizeGeometry(geometry);
    if (matrix) clone.applyMatrix4(matrix);
    bucket.push(clone);
    this.triangles += clone.attributes.position.count / 3;
  }

  bucket(material) {
    if (!this.buckets.has(material)) this.buckets.set(material, []);
    return this.buckets.get(material);
  }

  /** Merges each bucket into one mesh and parents them under `group`. */
  build(group, { name = "batch", castShadow = false, receiveShadow = false } = {}) {
    let drawCalls = 0;
    let index = 0;
    for (const [material, geometries] of this.buckets) {
      if (!geometries.length) continue;
      const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
      if (!merged) continue;
      for (let i = 0; i < geometries.length; i += 1) {
        if (merged !== geometries[i]) geometries[i].dispose();
      }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${name}:${material.name || index}`;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      drawCalls += 1;
      index += 1;
    }
    this.buckets.clear();
    return { drawCalls, triangles: Math.round(this.triangles) };
  }
}

function normalizeGeometry(geometry) {
  const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const attribute of Object.keys(clone.attributes)) {
    if (attribute !== "position" && attribute !== "normal") clone.deleteAttribute(attribute);
  }
  if (!clone.attributes.normal) clone.computeVertexNormals();
  clone.morphAttributes = {};
  return clone;
}
