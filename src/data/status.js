export const STATUS_META = {
  idle: { label: "Idle", color: "#9aa4b2", order: 0 },
  thinking: { label: "Thinking", color: "#7aa2ff", order: 1 },
  working: { label: "Working", color: "#3ddc97", order: 2 },
  reviewing: { label: "Reviewing", color: "#ffc861", order: 3 },
  in_meeting: { label: "In meeting", color: "#c58bff", order: 4 },
  waiting_approval: { label: "Waiting approval", color: "#ff9f45", order: 5 },
  completed: { label: "Completed", color: "#8bd450", order: 6 },
  error: { label: "Error", color: "#ff5d5d", order: 7 },
  walking: { label: "Walking", color: "#8b9bb4", order: 0 },
  running: { label: "Running", color: "#8b9bb4", order: 0 },
};

export const ATTENTION_STATUSES = ["error", "waiting_approval"];

export function statusLabel(status) {
  return STATUS_META[status]?.label ?? status;
}

export function statusColor(status) {
  return STATUS_META[status]?.color ?? "#9aa4b2";
}

export function isAttention(status) {
  return ATTENTION_STATUSES.includes(status);
}
