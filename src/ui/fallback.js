import { el, clear, durationText } from "./dom.js";
import { divisionName } from "../data/divisions.js";
import { statusLabel, statusColor, isAttention } from "../data/status.js";

const WALK_SPEED = 1.15;
const ARRIVE_EPSILON = 0.12;

/**
 * A rendering-free stand-in for `Agent` that speaks the same movement contract, so
 * the *same* `Simulation` can run on a device without WebGL and still drive the
 * directory view. No agent state is faked: it is the simulation, minus the meshes.
 */
export class HeadlessAgent {
  constructor(definition, { nav, world } = {}) {
    this.def = definition;
    this.nav = nav;
    this.world = world;
    this.id = definition.id;
    this.name = definition.name;
    this.role = definition.role;
    this.division = definition.division;
    this.position = { x: 0, y: 0 };
    this.floor = definition.floor;
    this.status = "idle";
    this.task = null;
    this.path = [];
    this.target = null;
    this.speed = 0;
    this.seated = false;
    this.visible = true;
    this.distanceWalked = 0;
  }

  place(pos, floorId) {
    this.position.x = pos[0];
    this.position.y = pos[1];
    this.floor = floorId;
    this.path = [];
    this.target = null;
    this.speed = 0;
  }

  face() {}

  setStatus(status, { seated = this.seated } = {}) {
    this.status = status;
    this.seated = seated;
  }

  setSeated(seated) {
    this.seated = seated;
  }

  setVisible(visible) {
    this.visible = visible;
  }

  goTo(point) {
    const start = [this.position.x, this.position.y];
    const route = this.nav.path(this.floor, start, point);
    this.path = route.length > 1 ? route.slice(1) : [point];
    this.target = point;
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

  update(dt) {
    let remaining = dt;
    while (this.path.length && remaining > 0) {
      const node = this.path[0];
      const dx = node[0] - this.position.x;
      const dy = node[1] - this.position.y;
      const distance = Math.hypot(dx, dy);
      const step = WALK_SPEED * remaining;
      if (distance < ARRIVE_EPSILON || step >= distance) {
        this.position.x = node[0];
        this.position.y = node[1];
        this.distanceWalked += distance;
        this.path.shift();
        remaining -= distance / WALK_SPEED;
        if (!this.path.length) {
          this.target = null;
          this.speed = 0;
          this.onArrive?.();
        }
        continue;
      }
      this.speed = WALK_SPEED;
      this.position.x += (dx / distance) * step;
      this.position.y += (dy / distance) * step;
      this.distanceWalked += step;
      break;
    }
    if (!this.path.length) this.speed = 0;
  }

  dispose() {}
}

/** Directory + activity feed for devices without WebGL (SRS FR-03 / AC 9). */
export class FallbackView {
  constructor({ root = document, world = null, agents = [], simulation = null } = {}) {
    this.root = root;
    this.world = world;
    this.agents = agents;
    this.simulation = simulation;
    this.nodes = {
      overlay: root.getElementById("fallback"),
      reason: root.getElementById("fallback-reason"),
      stats: root.getElementById("fallback-stats"),
      agents: root.getElementById("fallback-agents"),
      feed: root.getElementById("fallback-feed"),
      credits: root.getElementById("fallback-credits"),
    };
    root.getElementById("loading")?.classList.add("hidden");
    this.nodes.overlay?.classList.remove("hidden");
    this.feed = [];
    this.list = el("ul", { class: "feed" });
    if (this.nodes.feed) clear(this.nodes.feed).append(this.list);
    this.#bindFeed();
  }

  setReason(text) {
    if (this.nodes.reason) this.nodes.reason.textContent = text;
  }

  setCredits(text) {
    if (this.nodes.credits) this.nodes.credits.textContent = text;
  }

  #bindFeed() {
    const events = this.simulation?.events;
    if (!events) return;
    events.on("task", ({ agentId, task }) => this.#push(`${this.#name(agentId)} started “${task.title}”`));
    events.on("completed", ({ agentId, task }) => this.#push(`${this.#name(agentId)} finished “${task.title}”`));
    events.on("break", ({ agentId, label }) => this.#push(`${this.#name(agentId)} stepped out for ${label}`));
  }

  #name(id) {
    return this.agents.find((agent) => agent.id === id)?.name ?? id;
  }

  #push(text) {
    this.feed.unshift({ time: Date.now(), text });
    if (this.feed.length > 20) this.feed.length = 20;
    this.#renderFeed();
  }

  render(summary) {
    if (this.nodes.stats) {
      clear(this.nodes.stats).append(
        cell(String(this.agents.length), "agents"),
        cell(String(summary.tasksCompleted ?? 0), "tasks done"),
        cell(String(summary.trips ?? 0), "room trips"),
        cell(durationText(summary.clock ?? 0), "shift"),
      );
    }

    if (this.nodes.agents) {
      clear(this.nodes.agents);
      for (const agent of this.agents) {
        this.nodes.agents.append(
          el("article", {}, [
            el("h3", {}, [
              agent.name,
              " ",
              el("span", { class: "pill", style: `color:${statusColor(agent.status)}` }, statusLabel(agent.status)),
              isAttention(agent.status) ? el("span", { class: "tag warn", text: "attention" }) : null,
            ]),
            el("p", { class: "credit-meta", text: `${agent.role} · ${divisionName(agent.division)} · ${agent.floor}` }),
            el("p", { text: agent.task ? agent.task.title : "Between tasks" }),
          ]),
        );
      }
    }
    this.#renderFeed();
  }

  #renderFeed() {
    clear(this.list);
    for (const entry of this.feed) {
      this.list.append(
        el("li", {}, [
          el("time", { text: new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }),
          el("span", { text: entry.text }),
        ]),
      );
    }
  }
}

function cell(value, label) {
  return el("div", { class: "stat" }, [el("b", { text: value }), el("small", { text: label })]);
}
