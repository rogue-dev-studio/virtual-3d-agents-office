import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildWorld } from "../../src/world/worldData.js";
import { NavGrid } from "../../src/agents/navigation.js";
import { AGENTS } from "../../src/data/agents.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const world = buildWorld(
  read("../../public/assets/world/world.json"),
  read("../../public/assets/world/walls.json"),
);
const nav = new NavGrid(world);
const cell = nav.cell;

function largestComponent(floorId) {
  const floor = nav.floors.get(floorId);
  const total = floor.width * floor.height;
  const seen = new Uint8Array(total);
  let best = null;
  for (let start = 0; start < total; start += 1) {
    if (seen[start] || floor.grid[start] !== 1) continue;
    const queue = [start];
    seen[start] = 1;
    const cells = [];
    while (queue.length) {
      const current = queue.pop();
      cells.push(current);
      const cx = current % floor.width;
      const cy = (current - cx) / floor.width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= floor.width || ny >= floor.height) continue;
        const index = ny * floor.width + nx;
        if (seen[index] || floor.grid[index] !== 1) continue;
        if (dx && dy && (floor.grid[cy * floor.width + cx + dx] !== 1 || floor.grid[(cy + dy) * floor.width + cx] !== 1)) continue;
        seen[index] = 1;
        queue.push(index);
      }
    }
    if (!best || cells.length > best.length) best = cells;
  }
  return new Set(best ?? []);
}

function indexOf(floorId, x, y) {
  const floor = nav.floors.get(floorId);
  const [gx, gy] = nav.toGrid(x, y);
  const snapped = nav.nearestWalkable(floorId, x, y);
  const [sx, sy] = nav.toGrid(snapped[0], snapped[1]);
  return { index: sy * floor.width + sx, snapped, raw: gx + gy * floor.width };
}

describe("world data", () => {
  it("keeps every kept fixture, drops only the RPG-only types", () => {
    expect(world.fixtures.length).toBeGreaterThan(200);
    expect([...world.droppedByType.keys()].sort()).toEqual(
      ["arcade_cabinet", "billiard_table", "board_table", "cue_rack", "dumbbell_rack", "exercise_bike", "exercise_mat", "treadmill"],
    );
  });

  it("has both floors with their elevations", () => {
    expect(world.floors.map((floor) => floor.id)).toEqual(["L1", "L2"]);
    expect(world.floorById.get("L2").elevation).toBe(4);
  });
});

describe("layout clearance", () => {
  it("never places a collider fixture across a doorway", () => {
    const clashes = [];
    for (const door of world.doors) {
      for (const fixture of world.fixtures) {
        if (fixture.floor !== door.floor || !fixture.collider) continue;
        const [w, d] = fixture.size;
        const radians = (fixture.rot * Math.PI) / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));
        const halfX = (cos * w + sin * d) / 2;
        const halfY = (sin * w + cos * d) / 2;
        if (
          Math.abs(door.center[0] - fixture.pos[0]) <= halfX + 0.35 &&
          Math.abs(door.center[1] - fixture.pos[1]) <= halfY + 0.35
        ) {
          clashes.push(`${door.id} <- ${fixture.id} (${fixture.type})`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe("navigation", () => {
  it("keeps every doorway walkable", () => {
    const blocked = world.doors
      .filter((door) => !nav.isWalkable(door.floor, door.center[0], door.center[1]))
      .map((door) => door.id);
    expect(blocked).toEqual([]);
  });

  it("keeps every seat reachable from the main walkable region", () => {
    const unreachable = [];
    for (const floor of world.floors) {
      const main = largestComponent(floor.id);
      for (const slot of world.slots) {
        if (slot.floor !== floor.id) continue;
        const { index } = indexOf(floor.id, slot.pos[0], slot.pos[1]);
        if (!main.has(index)) unreachable.push(`${slot.id} @ ${slot.pos.join(",")}`);
      }
    }
    expect(unreachable).toEqual([]);
  });

  it("routes every agent from spawn to its own seat", () => {
    const spawn = world.raw.waypoints.find((waypoint) => waypoint.id === "WP-L1-SPAWN");
    const failures = [];
    for (const agent of AGENTS) {
      const agentWorld = world.fixtures.find((fixture) => fixture.id === agent.desk);
      const slot = world.slotById.get(agent.seat);
      expect(agentWorld, `desk ${agent.desk} for ${agent.id}`).toBeTruthy();
      expect(slot, `seat ${agent.seat} for ${agent.id}`).toBeTruthy();
      const path = nav.path("L1", spawn.pos, slot.pos);
      const reaches = Math.hypot(path[path.length - 1][0] - slot.pos[0], path[path.length - 1][1] - slot.pos[1]);
      if (reaches > cell * 4) failures.push(`${agent.id}: path stopped ${reaches.toFixed(2)}m away`);
    }
    expect(failures).toEqual([]);
  });

  it("crosses floors through the stair and lift links", () => {
    for (const link of world.verticalLinks) {
      for (const end of link.ends) {
        expect(nav.isWalkable(end.floor, end.arrive[0], end.arrive[1]), `${link.id} ${end.floor}`).toBe(true);
      }
    }
  });
});
