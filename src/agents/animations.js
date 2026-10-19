import * as THREE from "three";

/**
 * Every vendored character ships the same 24 clips. They fall into three kinds:
 *
 * - **Loops** carry a real animation curve (`idle`, `read`, `talk`, `coffee`, …).
 * - **Poses** are two-key clips that hold a stance (`sit`, `type`, `type_fast`, …).
 *   They are the only sensible choice while an agent is seated, because every loop
 *   clip is authored standing.
 * - **Transitions** are short one-shots (`start`, `stop`, `turn`, `surprised`, …).
 *
 * Mapping a status to a clip is therefore a mix of a pose and, every few seconds, a
 * different pose — that is what keeps a seated agent from looking frozen.
 */
export const CLIP_KINDS = {
  loops: new Set(["idle", "read", "talk", "rub_head", "coffee", "wave", "lift", "walk", "run", "stretch"]),
  poses: new Set(["sit", "type", "type_fast", "bike", "billiards", "cable", "draw", "game"]),
  oneShots: new Set(["start", "stop", "turn", "surprised", "flee", "exercise"]),
};

/** Native walk/run cycle speeds measured from the upstream export (m/s). */
export const NATIVE_SPEEDS = { walk: 0.845, run: 2.495 };

/**
 * Status → what to play. `seated` picks the seated variant when the agent is at a
 * chair, so the same status reads correctly at a desk and while standing.
 */
export function planFor(status, { seated = false } = {}) {
  switch (status) {
    case "working":
      return seated ? { pose: "type_fast", fidget: ["type", "type_fast", "type"] } : { clip: "read" };
    case "thinking":
      return seated ? { pose: "type", fidget: ["type", "sit", "type"] } : { clip: "rub_head" };
    case "reviewing":
      return seated ? { pose: "type", fidget: ["type", "type_fast"] } : { clip: "read" };
    case "in_meeting":
      return { clip: "talk" };
    case "waiting_approval":
      return seated ? { pose: "sit", fidget: ["sit", "type"] } : { clip: "idle" };
    case "completed":
      return { clip: "stretch", oneShot: true, then: seated ? "sit" : "idle" };
    case "error":
      return { clip: "surprised", oneShot: true, then: seated ? "sit" : "idle" };
    case "coffee":
      return { clip: "coffee" };
    case "rest":
      return seated ? { pose: "sit", fidget: ["sit", "read"] } : { clip: "read" };
    case "walking":
      return { clip: "walk", locomotion: true };
    case "running":
      return { clip: "run", locomotion: true };
    case "idle":
    default:
      return seated ? { pose: "sit", fidget: ["sit", "type"] } : { clip: "idle" };
  }
}

function toActions(mixer, clips) {
  const actions = new Map();
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.enabled = true;
    actions.set(clip.name, action);
  }
  return actions;
}

/**
 * Thin wrapper over `AnimationMixer` that understands poses, one-shots and
 * locomotion speed. Keeping it here means `Agent` never touches mixer details.
 */
export class AnimationController {
  constructor(mixer, clips) {
    this.mixer = mixer;
    this.actions = toActions(mixer, clips);
    this.current = null;
    this.fidget = [];
    this.fidgetTimer = 0;
    this.fidgetEvery = 0;
    this.oneShot = null;
    this.pendingThen = null;
    this.mixer.addEventListener("finished", (event) => {
      if (this.oneShot && event.action === this.oneShot) {
        const then = this.pendingThen;
        this.oneShot = null;
        this.pendingThen = null;
        if (then) this.play(then, { fade: 0.3 });
      }
    });
  }

  has(name) {
    return this.actions.has(name);
  }

  /** Starts a clip, cross-fading from whatever is playing. */
  play(name, { fade = 0.25, loop = true, timeScale = 1, offset = null } = {}) {
    const action = this.actions.get(name);
    if (!action || this.current?.name === name) {
      if (action && timeScale !== 1) action.setEffectiveTimeScale(timeScale);
      return action ?? null;
    }
    const previous = this.current;
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.setEffectiveTimeScale(timeScale);
    action.setEffectiveWeight(1);
    action.fadeIn(fade);
    const duration = action.getClip().duration;
    action.time = offset ?? Math.random() * Math.max(duration - 0.01, 0);
    action.play();
    if (previous) previous.action.fadeOut(fade);
    this.current = { name, action, loop };
    this.fidget = [];
    this.fidgetTimer = 0;
    return action;
  }

  /**
   * Plays a base pose and rotates through `variants` every few seconds, so a
   * seated agent appears to keep working instead of freezing mid-pose.
   */
  playPose(base, variants = [base], { every = 0, fade = 0.35 } = {}) {
    this.play(base, { fade });
    if (variants.length > 1 && every > 0) {
      this.fidget = variants.filter((name) => this.actions.has(name));
      this.fidgetEvery = every;
      this.fidgetTimer = every * (0.6 + Math.random() * 0.8);
    }
  }

  playOnce(name, { then = null, fade = 0.2 } = {}) {
    if (!this.actions.has(name)) {
      if (then) this.play(then, { fade });
      return;
    }
    const action = this.play(name, { fade, loop: false });
    if (action) {
      this.oneShot = action;
      this.pendingThen = then;
    } else if (then) {
      this.play(then, { fade });
    }
  }

  /** Applies a status plan in one call. */
  apply(plan) {
    if (!plan) return;
    if (plan.oneShot) {
      this.playOnce(plan.clip, { then: plan.then ?? null });
      return;
    }
    if (plan.pose) {
      this.playPose(plan.pose, plan.fidget ?? [plan.pose], { every: 6.5 });
      return;
    }
    if (plan.clip) {
      this.play(plan.clip, { loop: true });
    }
  }

  /** Matches the clip cycle to the travelled metres per second, so feet do not slide. */
  setLocomotion(clip, metresPerSecond) {
    const native = NATIVE_SPEEDS[clip];
    const action = this.current?.name === clip ? this.current.action : this.play(clip, { fade: 0.15 });
    if (!action || !native) return;
    action.setEffectiveTimeScale(Math.max(0.35, Math.min(2.2, metresPerSecond / native)));
  }

  update(dt) {
    this.mixer.update(dt);
    if (this.fidget.length && this.fidgetEvery > 0) {
      this.fidgetTimer -= dt;
      if (this.fidgetTimer <= 0) {
        this.fidgetTimer = this.fidgetEvery * (0.6 + Math.random() * 0.8);
        const index = Math.floor(Math.random() * this.fidget.length);
        this.play(this.fidget[index], { fade: 0.45 });
      }
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
