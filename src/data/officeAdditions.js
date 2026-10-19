import { FIXTURE_SIZE } from "./fixtures.js";

const DESK_CHAIR_OFFSET = {
  0: { dy: -0.75, chairRot: 180, facing: 90 },
  90: { dx: 0.75, chairRot: 270, facing: 180 },
  180: { dy: 0.85, chairRot: 0, facing: 270 },
  270: { dx: -0.75, chairRot: 90, facing: 0 },
};

function deskSeat(id, room, floor, pos, rot, dense = false) {
  const offset = DESK_CHAIR_OFFSET[rot];
  const chairPos = [pos[0] + (offset.dx ?? 0), pos[1] + (offset.dy ?? 0)];
  return [
    {
      id: `FX-${id}`,
      floor,
      room,
      type: dense ? "chair" : "chair",
      asset: null,
      added: true,
      pos: chairPos,
      rot: offset.chairRot,
      size: FIXTURE_SIZE.chair,
      collider: true,
    },
    {
      id: `SL-${id}-1`,
      fixture: `FX-${id}`,
      floor,
      room,
      activity: "desk",
      pose: "sit",
      capacity: 1,
      added: true,
      pos: chairPos,
      facing: offset.facing,
    },
  ];
}

function seat(id, room, floor, pos, facing, { pose = "sit", activity = "chat", rot = (facing + 90) % 360 } = {}) {
  return [
    {
      id: `FX-${id}`,
      floor,
      room,
      type: "chair_guest",
      asset: null,
      added: true,
      pos,
      rot,
      size: FIXTURE_SIZE.chair_guest,
      collider: true,
    },
    {
      id: `SL-${id}-1`,
      fixture: `FX-${id}`,
      floor,
      room,
      activity,
      pose,
      capacity: 1,
      added: true,
      pos,
      facing,
    },
  ];
}

function fx(id, room, floor, type, pos, rot = 0, size = null, extra = {}) {
  return {
    id: `FX-${id}`,
    floor,
    room,
    type,
    asset: null,
    added: true,
    pos,
    rot,
    size: size ?? FIXTURE_SIZE[type],
    collider: FIXTURE_SIZE[type] !== undefined ? true : true,
    ...extra,
  };
}

export const ADDITION_FIXTURES = [];
export const ADDITION_SLOTS = [];

function push(items) {
  for (const item of items) {
    if (item && item.fixture === undefined && item.id?.startsWith("SL-")) {
      ADDITION_SLOTS.push(item);
    } else if (item?.id?.startsWith("SL-")) {
      ADDITION_SLOTS.push(item);
    } else {
      ADDITION_FIXTURES.push(item);
    }
  }
}

export function registerAdditions() {
  if (ADDITION_FIXTURES.length > 0) return { fixtures: ADDITION_FIXTURES, slots: ADDITION_SLOTS };

  // L2-BILLIARD → "Focus Pods": two pod dividers and three quiet workstations.
  // The pods face the door so the entry aisle stays clear of furniture.
  push([
    fx("L2-A01", "L2-BILLIARD", "L2", "partition", [9.55, 21.5], 0, [0.08, 2.6, 1.45]),
    fx("L2-A02", "L2-BILLIARD", "L2", "partition", [11.45, 21.5], 0, [0.08, 2.6, 1.45]),
    fx("L2-A03", "L2-BILLIARD", "L2", "desk", [8.6, 21.3], 0),
    ...deskSeat("L2-A04", "L2-BILLIARD", "L2", [8.6, 21.3], 0),
    fx("L2-A05", "L2-BILLIARD", "L2", "desk", [10.5, 21.3], 0),
    ...deskSeat("L2-A06", "L2-BILLIARD", "L2", [10.5, 21.3], 0),
    fx("L2-A07", "L2-BILLIARD", "L2", "desk", [12.4, 21.3], 0),
    ...deskSeat("L2-A08", "L2-BILLIARD", "L2", [12.4, 21.3], 0),
    fx("L2-A09", "L2-BILLIARD", "L2", "plant_large", [13.5, 19.3]),
    fx("L2-A10", "L2-BILLIARD", "L2", "whiteboard", [7.9, 23.6], 180, [1.8, 0.1, 1.2]),
  ]);

  // L2-GAME → "Playtest Lab": stations, third console, planning board
  push([
    fx("L2-A11", "L2-GAME", "L2", "whiteboard", [27.5, 10.62], 0, [1.8, 0.1, 1.2]),
    fx("L2-A12", "L2-GAME", "L2", "media_console", [29.2, 16.15], 0),
    fx("L2-A13", "L2-GAME", "L2", "desk", [28.4, 13.4], 0, [1.6, 0.8, 0.9]),
    ...deskSeat("L2-A14", "L2-GAME", "L2", [28.4, 13.4], 0),
    fx("L2-A15", "L2-GAME", "L2", "desk", [30.2, 13.4], 0, [1.6, 0.8, 0.9]),
    ...deskSeat("L2-A16", "L2-GAME", "L2", [30.2, 13.4], 0),
    fx("L2-A17", "L2-GAME", "L2", "storage_shelf", [31.35, 14.9], 270),
    fx("L2-A18", "L2-GAME", "L2", "plant_large", [20.6, 10.95]),
  ]);

  // L2-GYM → "Training & Workshop Room": tables, boards, storage
  push([
    fx("L2-A19", "L2-GYM", "L2", "round_table", [17, 20.6], 0),
    ...seat("L2-A20", "L2-GYM", "L2", [17, 19.75], 90),
    ...seat("L2-A21", "L2-GYM", "L2", [17, 21.45], 270),
    ...seat("L2-A22", "L2-GYM", "L2", [16.15, 20.6], 0),
    ...seat("L2-A23", "L2-GYM", "L2", [17.85, 20.6], 180),
    fx("L2-A24", "L2-GYM", "L2", "round_table", [21, 22.4], 0),
    ...seat("L2-A25", "L2-GYM", "L2", [21, 21.55], 90),
    ...seat("L2-A26", "L2-GYM", "L2", [21, 23.25], 270),
    ...seat("L2-A27", "L2-GYM", "L2", [20.15, 22.4], 0),
    ...seat("L2-A28", "L2-GYM", "L2", [21.85, 22.4], 180),
    fx("L2-A29", "L2-GYM", "L2", "whiteboard", [15.4, 18.62], 0, [1.8, 0.1, 1.2]),
    fx("L2-A30", "L2-GYM", "L2", "easel", [15.4, 23.2], 0),
    fx("L2-A31", "L2-GYM", "L2", "storage_shelf", [22.6, 19.6], 90),
    fx("L2-A32", "L2-GYM", "L2", "plant_large", [14.6, 19.0]),
    fx("L2-A33", "L2-GYM", "L2", "tool_cabinet", [22.6, 23.4], 90),
  ]);

  // L1-SERVER → extra cabinet/rack density for the infrastructure room
  push([
    fx("L1-A34", "L1-SERVER", "L1", "lab_rack_open", [25.55, 22.4], 90),
    fx("L1-A35", "L1-SERVER", "L1", "lab_rack_open", [28.45, 20.8], 90),
    fx("L1-A36", "L1-SERVER", "L1", "wall_display", [28.9, 21.9], 270),
    fx("L1-A37", "L1-SERVER", "L1", "tool_cabinet", [26.2, 18.9], 0, [1, 0.5, 1.2]),
  ]);

  return { fixtures: ADDITION_FIXTURES, slots: ADDITION_SLOTS };
}
