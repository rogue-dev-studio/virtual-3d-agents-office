import * as THREE from "three";

/**
 * Agent nameplates drawn onto a canvas sprite. One texture per agent, redrawn only
 * when the name, role or status changes, so the per-frame cost is a single sprite
 * draw and no layout work.
 */
const WIDTH = 512;
const HEIGHT = 176;

export function createLabel({ name, role, accent, statusLabel: initialStatus = "Idle", statusColor = "#8b9bb4" }) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.86, 0.86 * (HEIGHT / WIDTH), 1);
  sprite.renderOrder = 10;

  let current = { status: null, color: null };

  function draw(status, color) {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    const padding = 10;
    const radius = 28;
    roundRect(context, padding, padding, WIDTH - padding * 2, HEIGHT - padding * 2, radius);
    context.fillStyle = "rgba(9, 13, 20, 0.84)";
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 5;
    context.stroke();

    context.fillStyle = "#f3f7ff";
    context.font = "700 54px 'Segoe UI', system-ui, sans-serif";
    context.textBaseline = "top";
    context.fillText(name, 40, 30, WIDTH - 80);

    context.fillStyle = "#a9b6cc";
    context.font = "500 34px 'Segoe UI', system-ui, sans-serif";
    context.fillText(role, 40, 92, WIDTH - 80);

    context.beginPath();
    context.arc(WIDTH - 62, 52, 18, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();

    context.fillStyle = color;
    context.font = "600 30px 'Segoe UI', system-ui, sans-serif";
    context.fillText(status, WIDTH - 92 - measure(context, status, "600 30px 'Segoe UI', system-ui, sans-serif"), 88);
    texture.needsUpdate = true;
  }

  draw(initialStatus, statusColor);
  current = { status: initialStatus, color: statusColor };

  return {
    sprite,
    setStatus(status, color) {
      if (status === current.status && color === current.color) return;
      current = { status, color };
      draw(status, color);
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function measure(context, text, font) {
  context.save();
  context.font = font;
  const width = context.measureText(text).width;
  context.restore();
  return width;
}
