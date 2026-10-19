import { TASK_KIND_STATUS, LEISURE_SPOTS } from "../data/agents.js";

/**
 * Seeded agent behaviour. This is an **invented simulation** that drives the office
 * from the roster and the world dataset — no upstream behaviour is claimed (ADR-6).
 *
 * Every agent cycles through its own task list: desk work stays at its seat, a task
 * in another room walks there (through doorways, and through the stair or lift when
 * the target is on the other floor), holds for a while and returns. A share of the
 * finishes turns into a break at a leisure spot. Seats are reserved so two agents
 * never share a chair, and the RNG is seeded so a reload reproduces the same shift.
 */
const HOLD_SECONDS = { work: [16, 34], thinking: [12, 24], review: [14, 26], meeting: [20, 40], approval: [8, 16], error: [10, 20], default: [12, 26] };
const BREAK_CHANCE = 0.22;
const BREAK_SECONDS = [18, 34];
const ACTIVITY_BY_KIND = { work: "desk", thinking: "desk", review: "desk", meeting: "chat", approval: "desk" };

export class Simulation {
  constructor({ world, nav, agents, seed = 20261001, events = null, onLevelChange = null }) {
    this.world = world;
    this.nav = nav;
    this.agents = agents;
    this.events = events;
    this.onLevelChange = onLevelChange;
    this.random = mulberry32(seed);
    this.clock = 0;
    this.reserved = new Map();
    this.homeSeats = new Set();
    this.standSpots = new Map();
    this.state = new Map();
    this.leisureCursor = 0;
    this.stats = { tasksCompleted: 0, trips: 0, levelChanges: 0, breaks: 0 };

    for (const agent of agents) {
      this.state.set(agent.id, {
        taskIndex: Math.floor(this.random() * (agent.def.tasks.length || 1)),
        phase: "boot",
        timer: this.random() * 6,
        route: [],
        holding: false,
        breaks: 0,
      });
      // A home desk stays its owner's for the whole shift, so a visitor can never sit
      // down on a chair that its owner is about to return to.
      this.reserved.set(agent.def.seat, agent.id);
      this.homeSeats.add(agent.def.seat);
    }
  }

  start() {
    for (const agent of this.agents) this.#settleAtDesk(agent, { silent: true });
  }

  update(dt) {
    this.clock += dt;
    for (const agent of this.agents) this.#tick(agent, dt);
  }

  #tick(agent, dt) {
    const state = this.state.get(agent.id);
    state.timer -= dt;
    if (agent.travelling) return;
    if (state.timer > 0) return;
    switch (state.phase) {
      case "boot":
      case "returning":
        this.#beginTask(agent, state);
        break;
      case "holding":
        this.#finishHold(agent, state);
        break;
      case "break":
        this.#endBreak(agent, state);
        break;
      default:
        this.#beginTask(agent, state);
    }
  }

  #beginTask(agent, state) {
    const tasks = agent.def.tasks;
    if (!tasks.length) return;
    state.taskIndex = (state.taskIndex + 1) % tasks.length;
    const task = tasks[state.taskIndex];
    const status = TASK_KIND_STATUS[task.kind] ?? "working";
    agent.task = { title: task.title, kind: task.kind, room: task.room, startedAt: this.clock };
    this.events?.emit("task", { agentId: agent.id, task: agent.task });

    if (task.room === agent.def.room) {
      this.#settleAtDesk(agent);
      agent.setStatus(status, { seated: true });
      state.phase = "holding";
      state.timer = pick(this.random, HOLD_SECONDS[task.kind] ?? HOLD_SECONDS.default);
      return;
    }

    const slot = this.#pickSlot(task.room, ACTIVITY_BY_KIND[task.kind] ?? "desk", agent);
    const point = slot ? slot.pos : this.world.roomById.get(task.room)?.center;
    if (!point) {
      state.timer = pick(this.random, HOLD_SECONDS.default);
      return;
    }
    this.#startRoute(agent, state, {
      floor: slot?.floor ?? agent.def.floor,
      point,
      status,
      activity: slot?.activity ?? "stand",
      onArriveStatus: status,
      seat: slot ?? null,
    });
  }

  #finishHold(agent, state) {
    const task = agent.task;
    if (task?.kind === "approval") {
      agent.setStatus("completed", { seated: agent.seated });
      this.events?.emit("attention", { agentId: agent.id, level: "cleared" });
    } else if (task?.kind !== "error") {
      agent.setStatus("completed", { seated: agent.seated });
    }
    this.stats.tasksCompleted += 1;
    this.events?.emit("completed", { agentId: agent.id, task });

    if (this.random() < BREAK_CHANCE && agent.def.division !== "management") {
      this.#startBreak(agent, state);
      return;
    }
    this.#settleAtDesk(agent);
    agent.setStatus("idle", { seated: true });
    state.phase = "returning";
    state.timer = 3 + this.random() * 5;
  }

  #startBreak(agent, state) {
    const spot = this.#nextLeisure(agent);
    if (!spot) {
      state.phase = "returning";
      state.timer = 4;
      return;
    }
    const slot = this.#pickSlot(spot.room, spot.activity, agent);
    if (!slot) {
      state.phase = "returning";
      state.timer = 4;
      return;
    }
    this.#releaseSeat(agent);
    state.breaks += 1;
    this.stats.breaks += 1;
    this.events?.emit("break", { agentId: agent.id, room: spot.room, label: spot.label });
    this.#startRoute(agent, state, {
      floor: slot.floor,
      point: slot.pos,
      status: spot.status === "thinking" ? "thinking" : spot.activity === "coffee" ? "coffee" : "rest",
      activity: spot.activity,
      onArriveStatus: spot.activity === "coffee" ? "coffee" : "rest",
      seat: slot,
      breakSpot: spot,
    });
  }

  #endBreak(agent, state) {
    this.#releaseSeat(agent);
    this.#settleAtDesk(agent);
    agent.setStatus("idle", { seated: true });
    state.phase = "returning";
    state.timer = 3 + this.random() * 6;
  }

  /**
   * Builds a route. A target on another floor is split at the stair or lift link,
   * and the crossing is reported so the caller can fade the agent between floors.
   */
  #startRoute(agent, state, { floor, point, status, activity, onArriveStatus, seat = null, breakSpot = null }) {
    const steps = [];
    if (floor === agent.floor) {
      steps.push({ kind: "walk", floor, point });
    } else {
      const link = this.#pickLink(agent.floor, floor);
      if (!link) {
        state.timer = pick(this.random, HOLD_SECONDS.default);
        return;
      }
      const from = link.ends.find((end) => end.floor === agent.floor);
      const to = link.ends.find((end) => end.floor === floor);
      steps.push({ kind: "walk", floor: agent.floor, point: from.arrive });
      steps.push({ kind: "link", floor, point: to.arrive, link, seconds: link.travelSeconds ?? 2.5 });
      steps.push({ kind: "walk", floor, point });
    }
    state.route = steps;
    state.activity = activity;
    state.onArriveStatus = onArriveStatus;
    state.breakSpot = breakSpot;
    state.seat = seat;
    agent.task = { ...(agent.task ?? {}), destination: point, room: this.#roomAt(floor, point)?.id ?? null };
    agent.onArrive = () => this.#advanceRoute(agent, state);
    agent.setSeated(false);
    this.#advanceRoute(agent, state);
    this.stats.trips += 1;
  }

  #advanceRoute(agent, state) {
    const step = state.route.shift();
    if (!step) {
      this.#arrive(agent, state);
      return;
    }
    if (step.kind === "link") {
      this.stats.levelChanges += 1;
      this.onLevelChange?.(agent, step.link, step.floor);
      agent.place(step.point, step.floor);
      agent.setStatus("walking");
      this.#advanceRoute(agent, state);
      return;
    }
    if (step.floor !== agent.floor) agent.place([agent.position.x, agent.position.y], step.floor);
    const length = agent.goTo(step.point, { run: lengthOf(step.point, agent) > 12 });
    agent.setStatus(state.route.length ? "walking" : state.onArriveStatus);
    if (length < 0.25) this.#advanceRoute(agent, state);
  }

  #arrive(agent, state) {
    agent.onArrive = null;
    const activity = state.activity ?? "stand";
    const seated = activity === "desk" || activity === "rest" || activity === "read";
    if (seated && state.seat) this.#reserve(agent, state.seat.id);
    if (state.seat && typeof state.seat.facing === "number") agent.face(state.seat.facing, true);
    agent.setSeated(seated);
    const status = state.onArriveStatus ?? (seated ? "working" : "idle");
    agent.setStatus(status, { seated });
    state.phase = state.breakSpot ? "break" : "holding";
    state.timer = state.breakSpot
      ? pick(this.random, BREAK_SECONDS)
      : pick(this.random, HOLD_SECONDS[agent.task?.kind] ?? HOLD_SECONDS.default);
    this.events?.emit("arrive", { agentId: agent.id, room: this.#roomAt(agent.floor, [agent.position.x, agent.position.y])?.id ?? null });
  }

  #settleAtDesk(agent, { silent = false } = {}) {
    const slot = this.world.slotById.get(agent.def.seat);
    const desk = this.world.fixtureById.get(agent.def.desk);
    if (!slot) return;
    this.#releaseSeat(agent);
    this.#reserve(agent, agent.def.seat);
    agent.place(slot.pos, slot.floor, slot.facing);
    agent.setSeated(true);
    if (!silent) agent.setStatus("working", { seated: true });
    agent.task = agent.task ?? null;
    void desk;
  }

  /**
   * Finds a free slot in a room. When every seat is taken the agent gets a standing
   * spot near the room centre instead of doubling up on a chair, and the spot is
   * snapped to the navigation grid so it can never land inside a fixture.
   */
  #pickSlot(roomId, activity, agent) {
    const room = this.world.roomById.get(roomId);
    if (!room) return null;
    const candidates = this.world.slots.filter((slot) => slot.room === roomId);
    const free = candidates.filter((slot) => !this.#isTaken(slot, agent));
    if (free.length) {
      const preferred = free.filter((slot) => slot.activity === activity);
      const pool = preferred.length ? preferred : free;
      const chosen = pool[Math.floor(this.random() * pool.length)];
      // Reserve at planning time, not on arrival: otherwise two agents can race to the
      // same free chair and land on top of each other.
      this.#reserve(agent, chosen.id);
      return chosen;
    }
    const [x, y] = this.#standingSpot(room, agent);
    return {
      id: `stand-${roomId}-${agent.id}`,
      room: roomId,
      floor: room.floor,
      activity: "stand",
      pose: "stand",
      pos: [x, y],
      facing: 0,
      synthetic: true,
    };
  }

  /**
   * Allocates a free standing point in a room: a spiral of candidate points snapped to
   * the navigation grid, rejecting anything within 0.75 m of another standing agent or
   * a reserved seat. Snapping alone would collapse two candidates onto the same grid
   * cell, which is what put agents on top of each other.
   */
  #standingSpot(room, agent) {
    const occupied = [...(this.standSpots.get(room.floor) ?? [])];
    for (const [slotId, owner] of this.reserved) {
      if (owner === agent.id) continue;
      const slot = this.world.slotById.get(slotId);
      if (slot?.floor === room.floor) occupied.push(slot.pos);
    }
    const seed = agent.id.length * 1.618;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const angle = seed + attempt * 2.39996;
      const radius = 0.9 + 0.32 * attempt;
      const [x, y] = this.nav.nearestWalkable(
        room.floor,
        room.center[0] + Math.cos(angle) * radius,
        room.center[1] + Math.sin(angle) * radius,
        6,
      );
      if (occupied.every((point) => Math.hypot(point[0] - x, point[1] - y) > 0.75)) {
        const list = this.standSpots.get(room.floor) ?? [];
        list.push([x, y]);
        this.standSpots.set(room.floor, list);
        return [x, y];
      }
    }
    return this.nav.nearestWalkable(room.floor, room.center[0], room.center[1], 6);
  }

  #pickLink(fromFloor, toFloor) {
    return this.world.verticalLinks.find((link) => {
      const floors = link.ends.map((end) => end.floor);
      return floors.includes(fromFloor) && floors.includes(toFloor);
    }) ?? null;
  }

  #nextLeisure(agent) {
    const usable = LEISURE_SPOTS.filter((spot) => this.world.roomById.has(spot.room));
    if (!usable.length) return null;
    this.leisureCursor = (this.leisureCursor + 1 + Math.floor(this.random() * 2)) % usable.length;
    void agent;
    return usable[this.leisureCursor];
  }

  #reserve(agent, slotId) {
    const owner = this.reserved.get(slotId);
    if (owner && owner !== agent.id) return;
    this.reserved.set(slotId, agent.id);
  }

  #releaseSeat(agent) {
    for (const [slotId, owner] of this.reserved) {
      if (owner === agent.id && !this.homeSeats.has(slotId)) this.reserved.delete(slotId);
    }
  }

  /**
   * A slot is free when nobody owns it, when no *other* slot within 0.4 m is owned
   * (the dataset places a bench work slot and its stool on the exact same point), and
   * when no standing agent has already claimed the spot.
   */
  #isTaken(slot, agent) {
    const owner = this.reserved.get(slot.id);
    if (owner && owner !== agent.id) return true;
    for (const [slotId, other] of this.reserved) {
      if (other === agent.id || slotId === slot.id) continue;
      const reserved = this.world.slotById.get(slotId);
      if (!reserved || reserved.floor !== slot.floor) continue;
      if (Math.hypot(reserved.pos[0] - slot.pos[0], reserved.pos[1] - slot.pos[1]) < 0.4) return true;
    }
    for (const point of this.standSpots.get(slot.floor) ?? []) {
      if (Math.hypot(point[0] - slot.pos[0], point[1] - slot.pos[1]) < 0.75) return true;
    }
    return false;
  }

  #roomAt(floorId, point) {
    for (const room of this.world.rooms) {
      if (room.floor !== floorId) continue;
      if (pointInPolygon(point[0], point[1], room.polygon)) return room;
    }
    return null;
  }

  /** Snapshot for the HUD. */
  summary() {
    const statuses = {};
    for (const agent of this.agents) statuses[agent.status] = (statuses[agent.status] ?? 0) + 1;
    return {
      statuses,
      tasksCompleted: this.stats.tasksCompleted,
      trips: this.stats.trips,
      levelChanges: this.stats.levelChanges,
      breaks: this.stats.breaks,
      clock: this.clock,
    };
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, range) {
  return range[0] + random() * (range[1] - range[0]);
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function lengthOf(point, agent) {
  return Math.hypot(point[0] - agent.position.x, point[1] - agent.position.y);
}
