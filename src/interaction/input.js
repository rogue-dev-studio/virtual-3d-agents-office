import { Picker } from "./picking.js";

/**
 * Pointer + keyboard input. Distinguishes a click from an orbit drag (a pointer
 * that moves more than a few pixels is a drag, not a selection) and routes
 * keyboard shortcuts to the handlers main.js provides.
 */
export class InputController {
  constructor({ canvas, camera, agents = [], proxies = [], getActiveFloors = () => null, handlers = {} }) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.picker = new Picker({ camera, agents, proxies, getActiveFloors });
    this.pointerDown = null;
    this.moved = false;

    this.onPointerDown = (event) => this.#down(event);
    this.onPointerUp = (event) => this.#up(event);
    this.onPointerMove = (event) => this.#move(event);
    this.onPointerLeave = () => this.handlers.hover?.(null);
    this.onKeyDown = (event) => this.#key(event);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("keydown", this.onKeyDown);
  }

  setAgents(agents) {
    this.picker.agents = agents;
  }

  setProxies(proxies) {
    this.picker.setProxies(proxies);
  }

  #toNdc(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  #down(event) {
    if (event.button !== 0) return;
    this.pointerDown = { x: event.clientX, y: event.clientY };
    this.moved = false;
  }

  #move(event) {
    if (this.pointerDown && Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 5) {
      this.moved = true;
    }
    if (event.buttons !== 0 || event.pointerType === "touch") return;
    const hit = this.picker.pick(this.#toNdc(event));
    this.handlers.hover?.(hit);
    this.canvas.style.cursor = hit ? "pointer" : "grab";
  }

  #up(event) {
    if (event.button !== 0 || !this.pointerDown) return;
    const wasDrag = this.moved;
    this.pointerDown = null;
    if (wasDrag) return;
    const hit = this.picker.pick(this.#toNdc(event));
    if (hit) this.handlers.click?.(hit);
    else this.handlers.background?.();
  }

  #key(event) {
    if (event.target && /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
    switch (event.key.toLowerCase()) {
      case "r":
        this.handlers.overview?.();
        break;
      case "h":
        this.handlers.help?.();
        break;
      case "escape":
        this.handlers.escape?.();
        break;
      case "f":
        this.handlers.fullscreen?.();
        break;
      case "1":
        this.handlers.floor?.("L1");
        break;
      case "2":
        this.handlers.floor?.("L2");
        break;
      case "0":
        this.handlers.floor?.("all");
        break;
      default:
        break;
    }
  }

  dispose() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("keydown", this.onKeyDown);
  }
}
