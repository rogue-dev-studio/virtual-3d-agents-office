/**
 * Quality presets. "auto" probes the device once and picks a tier, so a laptop
 * with integrated graphics still gets a usable frame rate.
 *
 * NFR references: SRS NFR-01 (60 fps mid GPU at medium), NFR-04 (pixel ratio ≤ 2,
 * shadow map ≤ 2048).
 */
export const QUALITY_PRESETS = {
  low: {
    label: "Low",
    pixelRatio: 1,
    shadowMapSize: 0,
    shadows: false,
    environmentIntensity: 0.55,
    anisotropy: 2,
    deskProps: false,
    labels: true,
    maxLabelDistance: 18,
    agentFadeDistance: 0,
  },
  medium: {
    label: "Medium",
    pixelRatio: 1.5,
    shadowMapSize: 1024,
    shadows: true,
    environmentIntensity: 0.95,
    anisotropy: 4,
    deskProps: true,
    labels: true,
    maxLabelDistance: 26,
    agentFadeDistance: 0,
  },
  high: {
    label: "High",
    pixelRatio: 2,
    shadowMapSize: 2048,
    shadows: true,
    environmentIntensity: 1.15,
    anisotropy: 8,
    deskProps: true,
    labels: true,
    maxLabelDistance: 34,
    agentFadeDistance: 0,
  },
};

export const QUALITY_ORDER = ["low", "medium", "high"];

export function resolveQuality(requested, device = detectDevice()) {
  if (requested && requested !== "auto" && QUALITY_PRESETS[requested]) return requested;
  return autoQuality(device);
}

export function autoQuality(device = detectDevice()) {
  if (!device.webgl) return "low";
  if (device.mobile) return device.cores >= 8 ? "medium" : "low";
  if (device.cores >= 8 && device.memory >= 8) return "high";
  if (device.cores >= 4) return "medium";
  return "low";
}

export function detectDevice() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  return {
    cores: nav.hardwareConcurrency ?? 4,
    memory: nav.deviceMemory ?? 8,
    mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent ?? ""),
    webgl: hasWebGL(),
  };
}

export function hasWebGL() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function preset(name) {
  return QUALITY_PRESETS[name] ?? QUALITY_PRESETS.medium;
}
