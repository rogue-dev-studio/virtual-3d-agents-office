import { el, clear } from "./dom.js";
import {
  PROJECT_AUTHOR,
  VENDORED_SOURCE,
  POLYHAVEN_LICENSE,
  POLYHAVEN_ASSETS,
  SOFTWARE_CREDITS,
  polyHavenThumb,
  polyHavenAssetUrl,
} from "../data/assetCredits.js";

/**
 * Credits and help overlays. Attribution is a hard requirement for the MIT
 * vendored source and the CC0 Poly Haven assets, so this is always reachable
 * from the command bar (`docs/architecture/decisions.md`, ADR-3/ADR-4).
 */
export class Overlays {
  constructor({ root = document, world = null } = {}) {
    this.root = root;
    this.world = world;
    this.credits = root.getElementById("credits");
    this.help = root.getElementById("help");
    this.lastFocus = null;

    root.getElementById("credits-close")?.addEventListener("click", () => this.hideCredits());
    root.getElementById("help-close")?.addEventListener("click", () => this.hideHelp());
    for (const overlay of [this.credits, this.help]) {
      overlay?.addEventListener("click", (event) => {
        if (event.target === overlay) this.hideAll();
      });
    }
    this.#buildCredits();
    this.#buildHelp();
  }

  get anyOpen() {
    return Boolean(
      (this.credits && !this.credits.classList.contains("hidden")) ||
        (this.help && !this.help.classList.contains("hidden")),
    );
  }

  showCredits() {
    if (!this.credits) return;
    this.lastFocus = document.activeElement;
    this.credits.classList.remove("hidden");
    this.credits.querySelector("button")?.focus();
  }

  hideCredits() {
    this.credits?.classList.add("hidden");
    this.lastFocus?.focus?.();
  }

  showHelp() {
    if (!this.help) return;
    this.lastFocus = document.activeElement;
    this.help.classList.remove("hidden");
    this.help.querySelector("button")?.focus();
  }

  hideHelp() {
    this.help?.classList.add("hidden");
    this.lastFocus?.focus?.();
  }

  hideAll() {
    this.hideCredits();
    this.hideHelp();
  }

  #buildCredits() {
    const summary = this.root.getElementById("credits-summary");
    const body = this.root.getElementById("credits-body");
    if (!body) return;
    if (summary) {
      summary.textContent = `Built by ${PROJECT_AUTHOR.name} (${PROJECT_AUTHOR.handle}) · ${PROJECT_AUTHOR.product} v${PROJECT_AUTHOR.version}`;
    }
    const dataset = this.world
      ? `${this.world.rooms.length} rooms · ${this.world.fixtures.length} fixtures · ${this.world.doors.length} doors · ${this.world.slots.length} activity slots`
      : "";
    clear(body).append(
      creditGroup("Vendored office kit (MIT)", [
        creditItem(null, {
          title: VENDORED_SOURCE.author,
          link: VENDORED_SOURCE.url,
          meta: `${VENDORED_SOURCE.license} · ${VENDORED_SOURCE.copyright}`,
          note: VENDORED_SOURCE.note,
          badge: dataset,
        }),
      ]),
      creditGroup("Technology props & lighting (CC0)", [
        paragraph(`${POLYHAVEN_LICENSE.name} — ${POLYHAVEN_LICENSE.note}`),
        ...POLYHAVEN_ASSETS.map((asset) =>
          creditItem(polyHavenThumb(asset.id), {
            title: asset.name,
            link: polyHavenAssetUrl(asset.id),
            meta: asset.kind,
            note: asset.usedFor,
          }),
        ),
      ]),
      creditGroup("Software", [
        ...SOFTWARE_CREDITS.map((entry) =>
          creditItem(null, {
            title: entry.name,
            link: entry.url,
            meta: entry.license,
            note: entry.usedFor,
          }),
        ),
      ]),
    );
  }

  #buildHelp() {
    const body = this.root.getElementById("help-body");
    if (!body) return;
    clear(body).append(
      el("dl", { class: "help-grid" }, [
        dt("Drag"), dd("Orbit the camera around the office"),
        dt("Scroll / pinch"), dd("Zoom in and out"),
        dt("Right drag"), dd("Pan the view"),
        dt("Click an agent"), dd("Open their live status and task"),
        dt("Click a desk or room"), dd("Inspect the workspace or room"),
        dt("R"), dd("Reset to the office overview"),
        dt("H"), dd("Toggle this help"),
        dt("Esc"), dd("Close panels and dialogs"),
        dt("F"), dd("Toggle fullscreen"),
        dt("L1 / L2 / Both"), dd("Show one floor or both"),
      ]),
      el("p", { class: "help-note" }, [
        "A two-floor technology office. Nine AI agents hold desks, pick tasks from their own lists, walk through doorways, ride the stair or lift between floors, take coffee breaks and report status on the dashboard.",
      ]),
      el("p", { class: "help-note" }, [
        "The building shell, furniture, characters and the room/fixture dataset are a vendored, unmodified MIT asset kit. The agent behaviour is an invented, seeded simulation — reload the page and the same shift replays. Every asset and its licence is listed under Credits.",
      ]),
    );
  }
}

function creditGroup(title, children) {
  return el("section", { class: "credit-group" }, [el("h2", { text: title }), ...children]);
}

function creditItem(thumb, { title, link, meta, note, badge = "" }) {
  const preview = thumb
    ? el("img", { src: thumb, alt: "", loading: "lazy", width: 78, height: 78 })
    : el("span", { class: "no-preview", text: "no preview" });
  return el("div", { class: "credit-item" }, [
    preview,
    el("div", {}, [
      el("h3", {}, [
        link ? el("a", { href: link, target: "_blank", rel: "noreferrer", text: title }) : title,
        badge ? el("span", { class: "tag info", text: badge }) : null,
      ]),
      el("div", { class: "credit-meta", text: meta }),
      note ? el("p", { class: "credit-meta", text: note }) : null,
    ]),
  ]);
}

function paragraph(text) {
  return el("p", { class: "muted", text });
}

function dt(text) {
  return el("dt", { text });
}

function dd(text) {
  return el("dd", { text });
}
