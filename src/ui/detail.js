import { el, clear } from "./dom.js";
import { divisionName, divisionColor } from "../data/divisions.js";
import { statusLabel, statusColor } from "../data/status.js";

/**
 * Detail panel. The subject is remembered so a periodic `refresh()` keeps live
 * fields (status, task, occupants) current without rebuilding the panel chrome.
 */
export class DetailPanel {
  constructor({ hud, world, agents = [], simulation = null, on = {} } = {}) {
    this.hud = hud;
    this.world = world;
    this.agents = agents;
    this.simulation = simulation;
    this.on = on;
    this.subject = null;
  }

  showAgent(agentId) {
    if (!this.agents.some((entry) => entry.id === agentId)) return;
    this.subject = { kind: "agent", id: agentId };
    this.refresh();
  }

  showRoom(roomId) {
    if (!this.world.roomById.has(roomId)) return;
    this.subject = { kind: "room", id: roomId };
    this.refresh();
  }

  showFixture(fixtureId) {
    if (!this.world.fixtureById.has(fixtureId)) return;
    this.subject = { kind: "fixture", id: fixtureId };
    this.refresh();
  }

  close() {
    this.subject = null;
    this.hud.hideDetail();
  }

  refresh() {
    if (!this.subject) return;
    const builder = this.subject.kind === "agent" ? this.#agent : this.subject.kind === "room" ? this.#room : this.#fixture;
    const node = builder.call(this, this.subject.id);
    if (!node) {
      this.close();
      return;
    }
    this.hud.showDetail(node);
  }

  #agent(id) {
    const agent = this.agents.find((entry) => entry.id === id);
    if (!agent) return null;
    const task = agent.task;
    return el("div", {}, [
      el("h3", { text: agent.name }),
      el("p", { class: "sub" }, [
        agent.role,
        " · ",
        el("span", { style: `color:${divisionColor(agent.division)}`, text: divisionName(agent.division) }),
      ]),
      el("p", { class: "pill", dataset: { status: agent.status } }, statusLabel(agent.status)),
      el("dl", { class: "kv" }, [
        pair("Division", divisionName(agent.division)),
        pair("Location", `${agent.floor} · ${this.world.roomById.get(agent.def.room)?.name ?? agent.def.room}`),
        pair("Current task", task ? task.title : "Between tasks"),
        task?.room ? pair("Task location", this.world.roomById.get(task.room)?.name ?? task.room) : null,
        pair("Persona", agent.def.persona ?? "—"),
      ]),
      el("div", { class: "detail-actions" }, [
        el("button", { class: "btn", type: "button", onClick: () => this.on.focusAgent?.(agent.id) }, "Focus camera"),
        el("button", { class: "btn", type: "button", onClick: () => this.on.followAgent?.(agent.id) }, "Follow"),
      ]),
    ]);
  }

  #room(id) {
    const room = this.world.roomById.get(id);
    if (!room) return null;
    const fixtures = this.world.fixturesByRoom.get(id) ?? [];
    const slots = this.world.slots.filter((slot) => slot.room === id);
    const occupants = this.agents.filter((agent) => this.#roomOf(agent) === id);
    return el("div", {}, [
      el("h3", { text: room.name ?? id }),
      el("p", { class: "sub", text: `${room.floor} · ${fixtures.length} fixtures · ${slots.length} slots` }),
      el("h3", { text: "Who is here" }),
      occupants.length
        ? el("ul", { class: "list" }, occupants.map((agent) => el("li", {}, `${agent.name} — ${statusLabel(agent.status)}`)))
        : el("p", { class: "muted", text: "Empty right now." }),
      el("div", { class: "detail-actions" }, [
        el("button", { class: "btn", type: "button", onClick: () => this.on.focusRoom?.(id) }, "Focus camera"),
      ]),
    ]);
  }

  #fixture(id) {
    const fixture = this.world.fixtureById.get(id);
    if (!fixture) return null;
    const slotIds = (this.world.slotsByFixture.get(id) ?? []).map((slot) => slot.id);
    const owner = this.agents.find((agent) => agent.def.desk === fixture.id || slotIds.includes(agent.def.seat));
    return el("div", {}, [
      el("h3", { text: fixtureLabel(fixture) }),
      el("p", { class: "sub", text: `${this.world.roomById.get(fixture.room)?.name ?? fixture.room} · ${fixture.floor}` }),
      el("dl", { class: "kv" }, [
        pair("Type", title(fixture.type)),
        pair("Source", fixture.added ? "Added by this build" : "Vendored kit"),
        pair("Size (m)", fixture.size.map((value) => value.toFixed(2)).join(" × ")),
        pair("Rotation", `${fixture.rot}°`),
        owner ? pair("Owner", owner.name) : null,
      ]),
      el("div", { class: "detail-actions" }, [
        el("button", { class: "btn", type: "button", onClick: () => this.on.focusFixture?.(id) }, "Focus camera"),
      ]),
    ]);
  }

  #roomOf(agent) {
    if (!agent.floor || !agent.position) return null;
    for (const room of this.world.rooms) {
      if (room.floor !== agent.floor) continue;
      if (pointInPolygon(agent.position.x, agent.position.y, room.polygon)) return room.id;
    }
    return null;
  }
}

function fixtureLabel(fixture) {
  return fixture.type === "desk" || fixture.type === "desk_exec" ? "Workstation" : title(fixture.type);
}

function pair(label, value) {
  return [el("dt", { text: label }), el("dd", { text: String(value ?? "—") })];
}

function title(value) {
  return String(value ?? "").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
