export const DIVISIONS = {
  management: { name: "Management", color: "#7aa2ff" },
  analysis: { name: "Analysis", color: "#5ad1c9" },
  design: { name: "Design", color: "#c58bff" },
  engineering: { name: "Engineering", color: "#3ddc97" },
  quality: { name: "Quality", color: "#ffc861" },
  documentation: { name: "Documentation", color: "#ff9f45" },
};

export const DIVISION_ORDER = [
  "management",
  "analysis",
  "design",
  "engineering",
  "quality",
  "documentation",
];

export function divisionName(id) {
  return DIVISIONS[id]?.name ?? id;
}

export function divisionColor(id) {
  return DIVISIONS[id]?.color ?? "#9aa4b2";
}
