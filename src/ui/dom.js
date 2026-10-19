/** Tiny DOM helpers. Building nodes instead of innerHTML keeps user data safe. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of flatten(children)) {
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Flattens nested arrays and drops null/false entries, so `[dt, dd]` pairs inline. */
export function flatten(list) {
  const out = [];
  for (const item of list) {
    if (Array.isArray(item)) out.push(...flatten(item));
    else if (item !== null && item !== undefined && item !== false) out.push(item);
  }
  return out;
}

export function clear(node) {
  if (node) node.replaceChildren();
  return node;
}

export function durationText(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function titleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
