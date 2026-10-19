/**
 * Loading screen + fatal-error surface. Progress is step based: each stage of
 * bootstrap reports how many of its steps are done, which is more predictable
 * than three's bytes-loaded callbacks when many small files load in parallel.
 */
export class LoadingScreen {
  constructor(root = document) {
    this.overlay = root.getElementById("loading");
    this.label = root.getElementById("loading-label");
    this.bar = root.getElementById("loading-bar");
    this.note = root.getElementById("loading-note");
    this.retry = root.getElementById("loading-retry");
    this.steps = 0;
    this.done = 0;
  }

  setSteps(total, label = "Loading office…") {
    this.steps = Math.max(1, total);
    this.done = 0;
    this.setLabel(label);
    this.setProgress(0);
  }

  step(label, increment = 1) {
    this.done += increment;
    if (label) this.setLabel(label);
    this.setProgress(this.done / this.steps);
  }

  setLabel(text) {
    if (this.label && text) this.label.textContent = text;
  }

  setProgress(fraction) {
    if (this.bar) this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  }

  setNote(text) {
    if (this.note) this.note.textContent = text;
  }

  hide() {
    this.overlay?.classList.add("hidden");
  }

  show() {
    this.overlay?.classList.remove("hidden");
  }

  fail(message, { retryable = true } = {}) {
    this.show();
    this.setLabel("Could not start the office");
    this.setNote(message);
    this.setProgress(1);
    if (this.retry) this.retry.classList.toggle("hidden", !retryable);
  }
}
