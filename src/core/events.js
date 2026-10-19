/** Minimal synchronous event emitter — enough for simulation → UI fan-out. */
export class Emitter {
  constructor() {
    this.listeners = new Map();
  }

  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type, payload) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  clear() {
    this.listeners.clear();
  }
}
