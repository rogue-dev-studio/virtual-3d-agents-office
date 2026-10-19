import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildWorld } from "../../src/world/worldData.js";
import { NavGrid } from "../../src/agents/navigation.js";
import { Simulation } from "../../src/agents/simulation.js";
import { AGENTS } from "../../src/data/agents.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const world = buildWorld(read("../../public/assets/world/world.json"), read("../../public/assets/world/walls.json"));
const nav = new NavGrid(world);

/** Headless stand-in for `Agent` that shares the movement contract with the real one. */
class FakeAgent {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.position = { x: 0, y: 0 };
    this.floor = def.floor;
    this.facing = 0;
    this.status = "idle";
    this.seated = false;
    this.path = [];
    this.target = null;
    this.onArrive = null;
    this.tasks = def.tasks;
    this.statusLog = [];
    this.tripped = false;
  }

  get travelling() {
    return this.path.length > 0;
  }

  place(pos, floorId, facing) {
    this.position = { x: pos[0], y: pos[1] };
    this.floor = floorId;
    if (typeof facing === "number") this.facing = facing;
    this.path = [];
    this.target = null;
  }

  face(deg) {
    this.facing = deg;
  }

  setSeated(value) {
    this.seated = value;
  }

  setStatus(status) {
    this.status = status;
    this.statusLog.push(status);
  }

  goTo(point) {
    const route = nav.path(this.floor, [this.position.x, this.position.y], point);
    this.path = route.length > 1 ? route.slice(1) : [point];
    this.target = point;
    let length = 0;
    let previous = [this.position.x, this.position.y];
    for (const node of this.path) {
      length += Math.hypot(node[0] - previous[0], node[1] - previous[1]);
      previous = node;
    }
    return length;
  }

  update(dt) {
    if (!this.path.length) return;
    const node = this.path[0];
    const dx = node[0] - this.position.x;
    const dy = node[1] - this.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.12) {
      this.path.shift();
      if (!this.path.length) {
        this.target = null;
        this.onArrive?.();
      }
      return;
    }
    const step = Math.min(distance, 1.15 * dt);
    this.position.x += (dx / distance) * step;
    this.position.y += (dy / distance) * step;
  }
}

function run(minutes, { seed = 7 } = {}) {
  const agents = AGENTS.map((def) => new FakeAgent(def));
  const levels = [];
  const events = [];
  const simulation = new Simulation({
    world,
    nav,
    agents,
    seed,
    events: { emit: (name, payload) => events.push({ name, payload }) },
    onLevelChange: (agent, link, floor) => levels.push({ agent: agent.id, link: link.id, floor }),
  });
  simulation.start();
  const dt = 0.1;
  const steps = (minutes * 60) / dt;
  const seatViolations = [];
  const offGrid = [];
  for (let step = 0; step < steps; step += 1) {
    simulation.update(dt);
    for (const agent of agents) agent.update(dt);
    if (step % 50 === 0) {
      const seated = agents.filter((agent) => agent.seated && !agent.travelling);
      for (let i = 0; i < seated.length; i += 1) {
        for (let j = i + 1; j < seated.length; j += 1) {
          if (seated[i].floor !== seated[j].floor) continue;
          const gap = Math.hypot(seated[i].position.x - seated[j].position.x, seated[i].position.y - seated[j].position.y);
          if (gap < 0.55) seatViolations.push(`${seated[i].id}+${seated[j].id}@${gap.toFixed(2)}m`);
        }
      }
      for (const agent of agents) {
        if (Number.isNaN(agent.position.x) || Number.isNaN(agent.position.y)) offGrid.push(`${agent.id} NaN`);
        else if (!agent.travelling && !nav.isWalkable(agent.floor, agent.position.x, agent.position.y)) {
          offGrid.push(`${agent.id}@${agent.position.x.toFixed(2)},${agent.position.y.toFixed(2)} ${agent.status}`);
        }
      }
    }
  }
  return { simulation, agents, levels, events, seatViolations, offGrid };
}

describe("simulation", () => {
  it("runs a shift without seat clashes, off-grid agents or NaN", () => {
    const { seatViolations, offGrid, agents } = run(25);
    expect(seatViolations).toEqual([]);
    expect(offGrid).toEqual([]);
    for (const agent of agents) expect(agent.statusLog.length).toBeGreaterThan(2);
  });

  it("completes tasks, takes breaks and changes floor", () => {
    const { simulation, levels, events } = run(45);
    const summary = simulation.summary();
    expect(summary.tasksCompleted).toBeGreaterThanOrEqual(agents$tasks());
    expect(summary.trips).toBeGreaterThan(0);
    expect(summary.levelChanges).toBeGreaterThan(0);
    expect(levels.length).toBeGreaterThan(0);
    expect(events.some((event) => event.name === "arrive")).toBe(true);
    expect(events.some((event) => event.name === "task")).toBe(true);
  });

  it("is deterministic for a fixed seed", () => {
    const first = run(8, { seed: 99 }).simulation.summary();
    const second = run(8, { seed: 99 }).simulation.summary();
    expect(second.tasksCompleted).toBe(first.tasksCompleted);
    expect(second.trips).toBe(first.trips);
    expect(second.levelChanges).toBe(first.levelChanges);
  });
});

function agents$tasks() {
  return AGENTS.length;
}
