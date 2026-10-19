import * as THREE from "three";
import { preset } from "./quality.js";

export const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Renderer + scene + camera defaults. Tone mapping is ACES filmic so the office
 * reads as architectural visualisation rather than a cartoon level.
 */
export function createRenderer(canvas, qualityName, devicePixelRatio = 1) {
  const config = preset(qualityName);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  applyQuality(renderer, qualityName, devicePixelRatio);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(new THREE.Color("#0a0e13"), 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0a0e13");
  scene.fog = new THREE.Fog(new THREE.Color("#0a0e13"), 60, 150);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.15, 260);
  camera.position.set(16, 22, 34);
  camera.lookAt(16, 2, 12);

  return { renderer, scene, camera, config };
}

export function applyQuality(renderer, qualityName, devicePixelRatio = 1) {
  const config = preset(qualityName);
  renderer.setPixelRatio(Math.min(devicePixelRatio, config.pixelRatio));
  renderer.shadowMap.enabled = config.shadows;
  return config;
}

export function resize(renderer, camera, width, height) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

export function disposeObject(root) {
  root?.traverse((node) => {
    if (node.geometry) node.geometry.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of materials) disposeMaterial(material);
  });
  root?.removeFromParent?.();
}

export function disposeMaterial(material) {
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && value.isTexture) value.dispose();
  }
  material.dispose?.();
}
