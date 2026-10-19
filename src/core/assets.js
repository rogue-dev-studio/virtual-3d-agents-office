import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

const ASSET_BASE = "assets/";

/**
 * Loads and caches the vendored building/furniture/character GLBs, the CC0 prop
 * GLBs and the HDRI. Every failure is recorded instead of thrown, so one broken
 * file can never blank the whole office (SRS FR-03 / AC 9).
 */
export class AssetLibrary {
  constructor({ base = ASSET_BASE } = {}) {
    this.base = base;
    this.manager = new THREE.LoadingManager();
    this.gltfLoader = new GLTFLoader(this.manager);
    this.hdrLoader = new HDRLoader(this.manager);
    this.textureLoader = new THREE.TextureLoader(this.manager);
    this.gltfCache = new Map();
    this.textureCache = new Map();
    this.envCache = new Map();
    this.failures = [];
  }

  resolve(url) {
    if (/^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
    return `${this.base}${url.replace(/^\/?(assets\/)?/, "")}`;
  }

  url(path) {
    if (path.startsWith("assets/")) return path;
    return this.resolve(path);
  }

  get failureCount() {
    return this.failures.length;
  }

  async gltf(path) {
    const url = this.url(path);
    if (this.gltfCache.has(url)) return this.gltfCache.get(url);
    const promise = new Promise((resolve) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (error) => {
          this.failures.push({ url, reason: describeError(error) });
          resolve(null);
        },
      );
    });
    this.gltfCache.set(url, promise);
    return promise;
  }

  async texture(path, { colorSpace = THREE.SRGBColorSpace } = {}) {
    const url = this.url(path);
    if (this.textureCache.has(url)) return this.textureCache.get(url);
    const promise = new Promise((resolve) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = colorSpace;
          resolve(texture);
        },
        undefined,
        (error) => {
          this.failures.push({ url, reason: describeError(error) });
          resolve(null);
        },
      );
    });
    this.textureCache.set(url, promise);
    return promise;
  }

  /** Loads an HDR environment and returns a PMREM-filtered environment texture. */
  async environment(path, renderer) {
    const url = this.url(path);
    if (this.envCache.has(url)) return this.envCache.get(url);
    const promise = new Promise((resolve) => {
      this.hdrLoader.load(
        url,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          if (!renderer) {
            resolve({ texture, environment: texture });
            return;
          }
          const pmrem = new THREE.PMREMGenerator(renderer);
          pmrem.compileEquirectangularShader();
          const environment = pmrem.fromEquirectangular(texture).texture;
          pmrem.dispose();
          resolve({ texture, environment });
        },
        undefined,
        (error) => {
          this.failures.push({ url, reason: describeError(error) });
          resolve(null);
        },
      );
    });
    this.envCache.set(url, promise);
    return promise;
  }

  getFailureReport() {
    if (!this.failures.length) return "";
    const unique = [...new Map(this.failures.map((f) => [f.url, f])).values()];
    return `${unique.length} asset(s) failed to load: ${unique
      .slice(0, 3)
      .map((f) => `${f.url.replace(this.base, "")} (${f.reason})`)
      .join(", ")}${unique.length > 3 ? `, +${unique.length - 3} more` : ""}`;
  }

  dispose() {
    for (const promise of this.gltfCache.values()) {
      Promise.resolve(promise).then((value) => {
        value?.scene?.traverse?.((node) => {
          node.geometry?.dispose?.();
          const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
          for (const material of materials) {
            for (const key of Object.keys(material)) {
              const value2 = material[key];
              if (value2 && value2.isTexture) value2.dispose();
            }
            material.dispose?.();
          }
        });
      });
    }
    for (const promise of this.textureCache.values()) {
      Promise.resolve(promise).then((texture) => texture?.dispose?.());
    }
    for (const promise of this.envCache.values()) {
      Promise.resolve(promise).then((value) => value?.environment?.dispose?.());
    }
    this.gltfCache.clear();
    this.textureCache.clear();
    this.envCache.clear();
  }
}

function describeError(error) {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  if (error.type) return error.type;
  return "load error";
}
