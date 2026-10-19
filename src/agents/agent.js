import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { AnimationController, planFor } from "./animations.js";
import { facingToRotationY } from "../world/coords.js";
import { createLabel } from "./labels.js";
import { statusColor, statusLabel } from "../data/status.js";

const WALK_SPEED = 1.15;
const RUN_SPEED = 2.35;
const TURN_RATE = 6.5;
const ARRIVE_EPSILON = 0.12;

/**
 * One agent: the vendored character model, its animation state, its seat and its
 * position in plan space.
 *
 * Movement follows the verified upstream conventions: the dataset azimuth (0° = +x,
 * counter-clockwise) maps to `rotation.y = toRad(azimuth + 90)` because the model's
 * nose is local `+Z`, and locomotion clip playback is scaled by the model's own
 * native stride speed so the feet do not slide.
 */
export class Agent {
  constructor(definition, { gltf, nav, world, quality, accent = "#7aa2ff" }) {
    this.def = definition;
    this.nav = nav;
    this.world = world;
    this.id = definition.id;
    this.name = definition.name;
    this.role = definition.role;
    this.division = definition.division;
    this.accent = accent;

    this.position = { x: 0, y: 0 };
    this.floor = definition.floor;
    this.facing = 0;
    this.facingY = 0;
    this.status = "idle";
    this.task = null;
    this.path = [];
    this.target = null;
    this.speed = 0;
    this.action = "idle";
    this.seated = false;
    this.visible = true;
    this.maxLabelDistance = quality.maxLabelDistance ?? 26;
    this.nativeSpeeds = { walk: 0.845, run: 2.495 };
    this.distanceWalked = 0;

    this.object = new THREE.Group();
    this.object.name = `agent-${this.id}`;
    this.object.userData.agentId = this.id;

    this.model = cloneSkinned(gltf.scene);
    this.model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = quality.shadows;
      node.receiveShadow = false;
      node.frustumCulled = false;
    });

    this.hairNodes = [];
    this.lod1 = null;
    this.faceMesh = null;
    this.model.traverse((node) => {
      const extras = node.userData ?? {};
      if (typeof extras.kantor_walk_native_speed_mps === "number") this.nativeSpeeds.walk = extras.kantor_walk_native_speed_mps;
      if (typeof extras.kantor_run_native_speed_mps === "number") this.nativeSpeeds.run = extras.kantor_run_native_speed_mps;
      if (typeof extras.kantor_default_hair === "string") this.defaultHair = extras.kantor_default_hair.replace(/^hair_/, "");
      if (node.name === "lod1") this.lod1 = node;
      if (node.name.startsWith("hair_")) this.hairNodes.push(node);
      if (node.isMesh && node.morphTargetDictionary && "blink" in node.morphTargetDictionary) this.faceMesh = node;
    });
    this.applyVisibility(false);

    this.object.add(this.model);
    this.model.position.y = 0;

    this.label = createLabel({
      name: this.name,
      role: this.role,
      accent,
      statusLabel: statusLabel(this.status),
      statusColor: statusColor(this.status),
    });
    this.label.sprite.position.set(0, 2.02, 0);
    this.object.add(this.label.sprite);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.animations = new AnimationController(this.mixer, gltf.animations);
    this.animations.play("idle", { fade: 0 });

    this.blinkTimer = 1 + Math.random() * 3;
    this.blinkPhase = -1;
    this.expressionTime = 0;
  }

  get root() {
    return this.object;
  }

  /** LOD0 keeps the body and exactly one hair style visible; LOD1 swaps both out. */
  applyVisibility(far) {
    for (const node of this.hairNodes) {
      node.visible = !far && Boolean(this.defaultHair) && node.name.startsWith(`hair_${this.defaultHair}`);
    }
    if (this.lod1) this.lod1.visible = far;
    const body = this.model.getObjectByName("body");
    if (body) body.visible = !far;
  }

  place(pos, floorId, facingDeg) {
    const floor = this.world.floorById.get(floorId);
    const elevation = floor?.elevation ?? 0;
    this.position.x = pos[0];
    this.position.y = pos[1];
    this.floor = floorId;
    this.object.position.set(pos[0], elevation, -pos[1]);
    if (facingDeg !== undefined) this.face(facingDeg, true);
    this.path = [];
    this.target = null;
    this.speed = 0;
  }

  face(facingDeg, immediate = false) {
    this.facing = ((facingDeg % 360) + 360) % 360;
    this.facingY = facingToRotationY(this.facing);
    if (immediate) this.object.rotation.y = this.facingY;
  }

  /** Sets the animation the status implies. */
  setStatus(status, { seated = this.seated } = {}) {
    if (status === this.status) return;
    this.status = status;
    this.label.setStatus(statusLabel(status), statusColor(status));
    this.animations.apply(planFor(status, { seated }));
  }

  setSeated(seated) {
    if (seated === this.seated) return;
    this.seated = seated;
    this.animations.apply(planFor(this.status, { seated }));
  }

  /** Walks to a plan point (same floor). Returns the route length in metres. */
  goTo(point, { run = false } = {}) {
    const start = [this.position.x, this.position.y];
    const route = this.nav.path(this.floor, start, point);
    this.path = route.length > 1 ? route.slice(1) : [point];
    this.target = point;
    this.runMode = run;
    let length = 0;
    let previous = start;
    for (const node of this.path) {
      length += Math.hypot(node[0] - previous[0], node[1] - previous[1]);
      previous = node;
    }
    return length;
  }

  get travelling() {
    return this.path.length > 0;
  }

  update(dt, { camera = null, reducedMotion = false } = {}) {
    if (this.path.length) {
      const node = this.path[0];
      const dx = node[0] - this.position.x;
      const dy = node[1] - this.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance < ARRIVE_EPSILON) {
        this.path.shift();
        if (!this.path.length) {
          this.target = null;
          this.speed = 0;
          this.onArrive?.();
        }
      } else {
        const wanted = this.runMode ? RUN_SPEED : WALK_SPEED;
        this.speed = wanted;
        const azimuth = (Math.atan2(dy, dx) * 180) / Math.PI;
        this.steer(azimuth, dt);
        const step = Math.min(distance, wanted * dt);
        this.position.x += (dx / distance) * step;
        this.position.y += (dy / distance) * step;
        this.distanceWalked += step;
        const floor = this.world.floorById.get(this.floor);
        this.object.position.set(this.position.x, floor?.elevation ?? 0, -this.position.y);
      }
    } else {
      this.speed = 0;
    }

    this.object.rotation.y = this.facingY;
    if (this.animations.current?.name === "walk" || this.animations.current?.name === "run") {
      this.animations.setLocomotion(this.animations.current.name, this.speed || 0.0001);
    }

    if (!reducedMotion) this.updateFace(dt);
    this.animations.update(dt);

    if (this.label) {
      const distance = camera ? camera.position.distanceTo(this.object.position) : 0;
      this.label.sprite.visible = camera ? distance <= this.maxLabelDistance : true;
      if (this.label.sprite.visible && camera) {
        const scale = Math.min(1.25, Math.max(0.6, distance / 18));
        this.label.sprite.scale.set(0.86 * scale, 0.86 * (176 / 512) * scale, 1);
      }
    }
  }

  steer(azimuthDeg, dt) {
    const targetY = facingToRotationY(azimuthDeg);
    const delta = shortestAngle(targetY - this.facingY);
    const step = Math.min(Math.abs(delta), TURN_RATE * dt);
    this.facingY += Math.sign(delta) * step;
    this.facing = ((((this.facingY - Math.PI / 2) * 180) / Math.PI) % 360 + 360) % 360;
  }

  /** Blinks on a random cadence and mouths along while the talk clip plays. */
  updateFace(dt) {
    if (!this.faceMesh?.morphTargetInfluences) return;
    const dict = this.faceMesh.morphTargetDictionary;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkTimer = 2.2 + Math.random() * 3.4;
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.16;
      const weight = this.blinkPhase < 1 ? Math.sin(this.blinkPhase * Math.PI) : 0;
      setMorph(this.faceMesh, dict, "blink", weight);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
    const talking = this.animations.current?.name === "talk";
    this.expressionTime += dt;
    setMorph(this.faceMesh, dict, "talk", talking ? 0.35 + 0.35 * Math.sin(this.expressionTime * 14) : 0);
    setMorph(this.faceMesh, dict, "smile", talking ? 0.4 : this.status === "completed" ? 0.5 : 0);
  }

  setLod(level) {
    this.applyVisibility(level === 1);
  }

  /** Floor filtering and culling both go through here so doors can ignore off-screen agents. */
  setVisible(visible) {
    this.visible = visible;
    this.object.visible = visible;
  }

  dispose() {
    this.animations.dispose();
    this.label.dispose();
  }
}

function setMorph(mesh, dictionary, name, weight) {
  const index = dictionary?.[name];
  if (index === undefined || !mesh.morphTargetInfluences) return;
  mesh.morphTargetInfluences[index] = weight;
}

function shortestAngle(radians) {
  let value = radians;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
