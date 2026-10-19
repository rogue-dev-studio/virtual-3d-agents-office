import { el, clear, durationText } from "./dom.js";
import { DIVISIONS, DIVISION_ORDER } from "../data/divisions.js";
import { statusLabel, statusColor, isAttention } from "../data/status.js";

const FEED_LIMIT = 40;

const TONE_BY_STATUS = {
  work: "working",
  working: "working",
  reviewing: "working",
  thinking: "thinking",
  in_meeting: "meeting",
  waiting_approval: "waiting",
  error: "error",
  completed: "done",
  idle: "idle",
};

/**
 * Owns every piece of the persistent HUD: the command bar, the dashboard
 * (stats, attention, divisions, roster, feed) and the floor/quality controls.
 * It only reads agent state and reports intent back through `on` callbacks.
 */
export class Hud {
  constructor({ root = document, events = null, world = null, agents = [], on = {} } = {}) {
    this.root = root;
    this.events = events;
    this.world = world;
    this.agents = agents;
    this.on = on;
    this.feed = [];
    this.floor = "all";
    this.selectedAgent = null;

    this.nodes = {
      stats: root.getElementById("stats"),
      statsDetail: root.getElementById("stats-detail"),
      attention: root.getElementById("attention"),
      divisions: root.getElementById("divisions"),
      roster: root.getElementById("roster"),
      feed: root.getElementById("feed"),
      detail: root.getElementById("detail"),
      detailBody: root.getElementById("detail-body"),
      assetIssues: root.getElementById("asset-issues"),
    };

    this.#bindControls();

    events?.on("task", ({ agentId, task }) => {
      const agent = this.#agent(agentId);
      if (agent && task) {
        this.pushEvent("info", `${agent.name} started “${task.title}”${task.room ? ` · ${this.#roomName(task.room)}` : ""}`);
      }
    });
    events?.on("completed", ({ agentId, task }) => {
      const agent = this.#agent(agentId);
      if (agent && task) this.pushEvent("ok", `${agent.name} finished “${task.title}”`);
    });
    events?.on("break", ({ agentId, label }) => {
      const agent = this.#agent(agentId);
      if (agent) this.pushEvent("muted", `${agent.name} stepped out for ${label}`);
    });
    events?.on("attention", ({ agentId, level }) => {
      const agent = this.#agent(agentId);
      if (agent && level === "cleared") this.pushEvent("ok", `${agent.name} is unblocked`);
    });
  }

  #bindControls() {
    const { root, on } = this;
    for (const button of root.querySelectorAll("[data-floor]")) {
      button.addEventListener("click", () => on.floor?.(button.dataset.floor));
    }
    root.getElementById("quality")?.addEventListener("change", (event) => on.quality?.(event.target.value));
    root.getElementById("btn-overview")?.addEventListener("click", () => on.overview?.());
    root.getElementById("btn-credits")?.addEventListener("click", () => on.credits?.());
    root.getElementById("btn-help")?.addEventListener("click", () => on.help?.());
    root.getElementById("btn-fullscreen")?.addEventListener("click", () => on.fullscreen?.());
    root.getElementById("detail-close")?.addEventListener("click", () => (this.on.closeDetail ? this.on.closeDetail() : this.hideDetail()));
    root.getElementById("hint-close")?.addEventListener("click", () => this.dismissHint());
    for (const toggle of root.querySelectorAll(".panel-toggle")) {
      toggle.addEventListener("click", () => {
        const panel = toggle.closest(".panel");
        const collapsed = panel?.classList.toggle("collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
      });
    }
  }

  dismissHint() {
    this.root.getElementById("hint")?.classList.add("hidden");
  }

  setFloor(floor, { silent = false } = {}) {
    this.floor = floor;
    for (const button of this.root.querySelectorAll("[data-floor]")) {
      const active = button.dataset.floor === floor;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    if (!silent) this.on.floor?.(floor);
    return this;
  }

  setQuality(value) {
    const select = this.root.getElementById("quality");
    if (select) select.value = value;
  }

  setAssetIssues(text) {
    const node = this.nodes.assetIssues;
    if (!node) return;
    if (!text) {
      node.classList.add("hidden");
      node.textContent = "";
      return;
    }
    node.textContent = text;
    node.classList.remove("hidden");
  }

  pushEvent(tone, text) {
    this.feed.unshift({ time: Date.now(), tone, text });
    if (this.feed.length > FEED_LIMIT) this.feed.length = FEED_LIMIT;
    this.#renderFeed();
  }

  #agent(id) {
    return this.agents.find((agent) => agent.id === id) ?? null;
  }

  #roomName(id) {
    return this.world?.roomById.get(id)?.name ?? id;
  }

  /** Redraws the dashboard. Called a few times per second, not per frame. */
  render(summary) {
    this.#renderStats(summary);
    this.#renderAttention();
    this.#renderDivisions();
    this.#renderRoster();
  }

  #renderStats(summary) {
    const counts = summary.statuses ?? {};
    const working = (counts.working ?? 0) + (counts.reviewing ?? 0);
    const attention = (counts.error ?? 0) + (counts.waiting_approval ?? 0);

    if (this.nodes.stats) {
      clear(this.nodes.stats).append(
        statCell(String(this.agents.length), "agents", "idle"),
        statCell(String(working), "working", "working"),
        statCell(String(attention), "attention", attention ? "error" : "idle"),
        statCell(durationText(summary.clock ?? 0), "shift", "idle"),
      );
    }

    if (this.nodes.statsDetail) {
      clear(this.nodes.statsDetail).append(
        statCell(String(summary.tasksCompleted ?? 0), "tasks", "done"),
        statCell(String(summary.trips ?? 0), "trips", "meeting"),
        statCell(String(summary.levelChanges ?? 0), "floor moves", "thinking"),
        statCell(String(summary.breaks ?? 0), "breaks", "idle"),
      );
      for (const status of Object.keys(counts).sort((a, b) => (statusOrder(b)) - (statusOrder(a)))) {
        this.nodes.statsDetail.append(statCell(String(counts[status]), statusLabel(status), TONE_BY_STATUS[status] ?? "idle"));
      }
    }
  }

  #renderAttention() {
    const list = this.nodes.attention;
    if (!list) return;
    const flagged = this.agents.filter((agent) => isAttention(agent.status));
    clear(list);
    if (!flagged.length) {
      list.append(el("li", { class: "empty", text: "Nothing needs attention." }));
      return;
    }
    for (const agent of flagged) {
      list.append(el("li", { class: "row" }, [agentRow(agent, { onClick: () => this.on.selectAgent?.(agent.id), current: this.selectedAgent === agent.id })]));
    }
  }

  #renderDivisions() {
    const list = this.nodes.divisions;
    if (!list) return;
    clear(list);
    for (const id of DIVISION_ORDER) {
      const members = this.agents.filter((agent) => agent.division === id);
      if (!members.length) continue;
      const busy = members.filter((agent) => agent.status === "working" || agent.status === "reviewing").length;
      const attention = members.filter((agent) => isAttention(agent.status)).length;
      list.append(
        el("li", {}, [
          el("span", { class: "dot", style: `background:${DIVISIONS[id].color}` }),
          el("span", { class: "muted", text: DIVISIONS[id].name }),
          el("span", { class: "grow", text: "" }),
          el("span", { class: "tag info", text: `${busy}/${members.length}` }),
          attention ? el("span", { class: "tag warn", text: `${attention} alert` }) : null,
        ]),
      );
    }
  }

  #renderRoster() {
    const list = this.nodes.roster;
    if (!list) return;
    clear(list);
    for (const agent of this.agents) {
      list.append(
        el("li", { class: "row" }, [agentRow(agent, { onClick: () => this.on.selectAgent?.(agent.id), current: this.selectedAgent === agent.id })]),
      );
    }
  }

  #renderFeed() {
    const list = this.nodes.feed;
    if (!list) return;
    clear(list);
    for (const entry of this.feed) {
      list.append(
        el("li", { class: entry.tone }, [
          el("time", { text: new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }),
          el("span", { text: entry.text }),
        ]),
      );
    }
  }

  showDetail(node) {
    const panel = this.nodes.detail;
    const body = this.nodes.detailBody;
    if (!panel || !body) return;
    clear(body).append(node);
    panel.classList.remove("hidden");
  }

  hideDetail() {
    this.nodes.detail?.classList.add("hidden");
  }

  setSelectedAgent(id) {
    this.selectedAgent = id;
    this.#renderRoster();
  }
}

function statusOrder(status) {
  return { idle: 0, thinking: 1, working: 2, reviewing: 3, in_meeting: 4, waiting_approval: 5, completed: 6, error: 7 }[status] ?? 0;
}

function statCell(value, label, tone = "idle") {
  return el("div", { class: "stat", dataset: { tone } }, [el("b", { text: value }), el("small", { text: label })]);
}

function agentRow(agent, { onClick, current = false } = {}) {
  return el("button", {
    class: "agent-row",
    type: "button",
    "aria-current": String(current),
    onClick,
  }, [
    el("span", { class: "dot", dataset: { status: agent.status } }),
    el("span", {}, [el("strong", { text: agent.name }), el("small", { text: agent.role })]),
    el("span", { class: "pill", dataset: { status: agent.status } }, statusLabel(agent.status)),
  ]);
}
