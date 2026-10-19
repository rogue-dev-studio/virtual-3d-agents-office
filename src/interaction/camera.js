import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { toThree } from "../world/coords.js";

const ANIM_SECONDS = 0.7;

/**
 * Orbit camera with smoothed framing. `focus*` methods tween the target and the
 * camera position instead of snapping, which keeps the sense of space when you
 * jump between rooms.
 */
export class CameraRig {
  constructor(camera, domElement, { bounds = { x: [0, 32], y: [0, 24] }, minDistance = 3, maxDistance = 90 } = {}) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = minDistance;
    this.controls.maxDistance = maxDistance;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minPolarAngle = 0.08;
    this.controls.screenSpacePanning = false;
    this.bounds = bounds;
    this.tween = null;
    this.follow = null;
    this.overview();
    this.camera.position.copy(this.homePosition);
    this.controls.target.copy(this.homeTarget);
    this.controls.update();
  }

  overview() {
    const [minX, maxX] = this.bounds.x;
    const [minY, maxY] = this.bounds.y;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY);
    this.homeTarget = toThree(cx, cy, 1.5);
    this.homePosition = toThree(cx, cy + span * 0.62, span * 0.85);
    this.tween = null;
    this.follow = null;
    this.controls.target.copy(this.homeTarget);
    this.camera.position.copy(this.homePosition);
    this.controls.update();
  }

  focusPoint(planX, planY, elevation = 0, { distance = 9, height = 4 } = {}) {
    this.#tweenTo(toThree(planX, planY, elevation + 0.9), { distance, height });
  }

  focusBox(box, { pad = 1.6 } = {}) {
    if (!box || box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z, size.y) / 2 + pad;
    const distance = Math.max(6, radius * 2.6);
    this.#tweenTo(new THREE.Vector3(center.x, box.max.y * 0.4 + 0.6, center.z), { distance, height: distance * 0.55 });
  }

  followPoint(point, elevation = 0, { distance = 7, height = 3.4 } = {}) {
    const target = toThree(point[0], point[1], elevation + 0.9);
    this.controls.target.copy(target);
    this.camera.position.copy(new THREE.Vector3(target.x + distance * 0.55, target.y + height, target.z + distance));
    this.controls.update();
  }

  #tweenTo(target, { distance = 9, height = 4 } = {}) {
    const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    if (direction.lengthSq() < 1e-6) direction.set(0.4, 0.7, 0.6).normalize();
    const position = new THREE.Vector3(
      target.x + direction.x * distance,
      target.y + height,
      target.z + direction.z * distance,
    );
    this.tween = {
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      fromPosition: this.camera.position.clone(),
      toPosition: position,
      t: 0,
    };
    this.follow = null;
  }

  update(dt) {
    if (this.tween) {
      this.tween.t = Math.min(1, this.tween.t + dt / ANIM_SECONDS);
      const eased = easeInOut(this.tween.t);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, eased);
      this.camera.position.lerpVectors(this.tween.fromPosition, this.tween.toPosition, eased);
      if (this.tween.t >= 1) this.tween = null;
    } else if (this.follow) {
      const { point, elevation } = this.follow;
      this.controls.target.lerp(toThree(point[0], point[1], elevation + 0.9), 0.15);
    }
    this.controls.update();
  }

  setEnabled(enabled) {
    this.controls.enabled = enabled;
  }

  dispose() {
    this.controls.dispose();
  }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
