import { DROPPED_FIXTURE_TYPES, fixtureSize } from "../data/fixtures.js";
import { FLOOR_META, roomMeta } from "../data/rooms.js";
import { registerAdditions } from "../data/officeAdditions.js";

export const WORLD_URL = "assets/world/world.json";
export const WALLS_URL = "assets/world/walls.json";

export class WorldDataError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "WorldDataError";
    this.detail = detail;
  }
}

const REQUIRED_WORLD_KEYS = ["rooms", "fixtures", "activitySlots", "floors", "verticalLinks"];
const REQUIRED_WALL_KEYS = ["floors"];

/** Fetches and validates the vendored dataset (FR-01). */
export async function loadWorldData({ worldUrl = WORLD_URL, wallsUrl = WALLS_URL, fetchImpl = fetch } = {}) {
  const [worldRes, wallsRes] = await Promise.all([fetchImpl(worldUrl), fetchImpl(wallsUrl)]);
  if (!worldRes.ok) throw new WorldDataError(`Could not load ${worldUrl} (HTTP ${worldRes.status})`);
  if (!wallsRes.ok) throw new WorldDataError(`Could not load ${wallsUrl} (HTTP ${wallsRes.status})`);
  const world = await worldRes.json();
  const walls = await wallsRes.json();
  validate(world, walls);
  return buildWorld(world, walls);
}

export function validate(world, walls) {
  const missing = REQUIRED_WORLD_KEYS.filter((key) => world?.[key] === undefined);
  if (missing.length) throw new WorldDataError(`world.json is missing: ${missing.join(", ")}`);
  const missingWalls = REQUIRED_WALL_KEYS.filter((key) => walls?.[key] === undefined);
  if (missingWalls.length) throw new WorldDataError(`walls.json is missing: ${missingWalls.join(", ")}`);
  for (const room of world.rooms) {
    if (!room.id || !Array.isArray(room.polygon) || room.polygon.length < 3) {
      throw new WorldDataError(`room ${room.id ?? "(no id)"} has an invalid polygon`);
    }
  }
}

/**
 * Turns the raw dataset into the shape the renderer and the simulation use.
 * Nothing here mutates the vendored JSON: remapped names live in `data/rooms.js`
 * and the refurnished rooms are described in `data/officeAdditions.js`, so the
 * geometry stays byte-identical to upstream and walls/doors remain valid (ADR-1/7).
 */
export function buildWorld(world, walls) {
  const additions = registerAdditions();

  const rooms = world.rooms.map((room) => {
    const meta = roomMeta(room.id);
    return {
      id: room.id,
      floor: room.floor,
      sourceName: room.name,
      name: meta.name,
      division: meta.division,
      kind: meta.kind,
      category: room.category,
      access: room.access,
      polygon: room.polygon.map(([x, y]) => [x, y]),
      center: centroid(room.polygon),
      area: polygonArea(room.polygon),
      ict: room.ict ?? [],
      finish: room.finish ?? null,
    };
  });

  const droppedByType = new Map();
  const fixtures = [];
  for (const fixture of world.fixtures) {
    if (DROPPED_FIXTURE_TYPES.has(fixture.type)) {
      droppedByType.set(fixture.type, (droppedByType.get(fixture.type) ?? 0) + 1);
      continue;
    }
    fixtures.push(normalizeFixture(fixture));
  }
  for (const fixture of additions.fixtures) fixtures.push(normalizeFixture(fixture));

  const slots = [
    ...world.activitySlots.map((slot) => ({ ...slot, pos: [slot.pos[0], slot.pos[1]], added: false })),
    ...additions.slots.map((slot) => ({ ...slot, pos: [slot.pos[0], slot.pos[1]], added: true })),
  ];

  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const slotsByFixture = new Map();
  for (const slot of slots) {
    if (!slotsByFixture.has(slot.fixture)) slotsByFixture.set(slot.fixture, []);
    slotsByFixture.get(slot.fixture).push(slot);
  }

  const fixturesByRoom = new Map();
  for (const fixture of fixtures) {
    if (!fixturesByRoom.has(fixture.room)) fixturesByRoom.set(fixture.room, []);
    fixturesByRoom.get(fixture.room).push(fixture);
  }

  const doorById = new Map((world.doors ?? []).map((door) => [door.id, door]));

  const floorIds = Array.isArray(world.floors) ? world.floors.map((floor) => floor.id) : Object.keys(world.floors);
  const floorSource = new Map(
    (Array.isArray(world.floors) ? world.floors : floorIds.map((id) => ({ id, ...world.floors[id] }))).map((floor) => [floor.id, floor]),
  );
  const floors = floorIds.map((id) => {
    const source = floorSource.get(id) ?? {};
    return {
      ...FLOOR_META[id],
      id,
      sourceName: source.name ?? null,
      level: source.level ?? FLOOR_META[id]?.level ?? 1,
      elevation: source.elevation ?? FLOOR_META[id]?.elevation ?? 0,
      envelope: source.envelope ?? null,
      roomIds: rooms.filter((room) => room.floor === id).map((room) => room.id),
      bounds: floorBounds(rooms.filter((room) => room.floor === id)),
    };
  });

  return {
    raw: world,
    walls,
    units: world.units ?? "metre",
    revision: world.revision ?? world.worldRevision ?? "unknown",
    bounds: planBounds(rooms),
    floors,
    floorById: new Map(floors.map((floor) => [floor.id, floor])),
    rooms,
    roomById,
    fixtures,
    fixtureById,
    slots,
    slotById,
    slotsByFixture,
    fixturesByRoom,
    doors: world.doors ?? [],
    doorById,
    windows: world.windows ?? [],
    verticalLinks: (world.verticalLinks ?? []).filter((link) => link.ends?.length > 1),
    wallsByFloor: walls.floors,
    droppedByType,
    additions,
  };
}

function normalizeFixture(fixture) {
  return {
    id: fixture.id,
    floor: fixture.floor,
    room: fixture.room,
    type: fixture.type,
    asset: fixture.asset ?? null,
    added: Boolean(fixture.added),
    pos: [fixture.pos[0], fixture.pos[1]],
    rot: normalizeAngle(fixture.rot ?? 0),
    size: fixtureSize(fixture),
    collider: fixture.collider !== false,
    artwork: fixture.artwork ?? null,
  };
}

export function normalizeAngle(deg) {
  const value = ((deg % 360) + 360) % 360;
  return value;
}

export function isQuarterTurn(deg) {
  return Math.abs(deg / 90 - Math.round(deg / 90)) < 1e-6;
}

export function centroid(polygon) {
  let x = 0;
  let y = 0;
  for (const [px, py] of polygon) {
    x += px;
    y += py;
  }
  return [x / polygon.length, y / polygon.length];
}

export function polygonArea(polygon) {
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function roomAt(worldRooms, x, y, floor = null) {
  for (const room of worldRooms) {
    if (floor && room.floor !== floor) continue;
    if (pointInPolygon(x, y, room.polygon)) return room;
  }
  return null;
}

function planBounds(rooms) {
  const bounds = { x: [Infinity, -Infinity], y: [Infinity, -Infinity] };
  for (const room of rooms) {
    for (const [x, y] of room.polygon) {
      bounds.x[0] = Math.min(bounds.x[0], x);
      bounds.x[1] = Math.max(bounds.x[1], x);
      bounds.y[0] = Math.min(bounds.y[0], y);
      bounds.y[1] = Math.max(bounds.y[1], y);
    }
  }
  return bounds;
}

function floorBounds(rooms) {
  if (!rooms.length) return { x: [0, 0], y: [0, 0] };
  return planBounds(rooms);
}
