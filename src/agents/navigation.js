/**
 * Navigation over the vendored plan geometry.
 *
 * The building ships as 2D polygons plus derived wall segment lists, so the world
 * is rasterised into a per-floor grid: a cell is walkable when it lies inside a
 * room, is clear of the wall bands (which already contain the door gaps) and is
 * clear of fixture colliders inflated by the agent radius. Seat cells are carved
 * back open so an agent can always reach its own chair.
 *
 * Pathing is 8-neighbour A* with a binary heap, no corner cutting, then smoothed by
 * line-of-sight string pulling. The approach follows the reference implementation's
 * raster-grid + reservation design (see NOTICE) without sharing code.
 */

const CELL = 0.15;
const AGENT_RADIUS = 0.26;
const SEAT_CLEARANCE = 0.62;
const APPROACH_LENGTH = 2.6;
const APPROACH_RADIUS = 0.3;

export class NavGrid {
  constructor(world, { cell = CELL, agentRadius = AGENT_RADIUS } = {}) {
    this.cell = cell;
    this.agentRadius = agentRadius;
    this.floors = new Map();
    this.bounds = world.bounds;
    this.origin = { x: Math.floor(world.bounds.x[0] / cell) * cell, y: Math.floor(world.bounds.y[0] / cell) * cell };
    for (const floor of world.floors) {
      this.floors.set(floor.id, this.#buildFloor(floor, world, agentRadius));
    }
  }

  #buildFloor(floor, world, agentRadius) {
    const { cell, origin } = this;
    const width = Math.ceil((world.bounds.x[1] - origin.x) / cell) + 1;
    const height = Math.ceil((world.bounds.y[1] - origin.y) / cell) + 1;
    const grid = new Uint8Array(width * height);
    const rooms = world.rooms.filter((room) => room.floor === floor.id);

    for (let gy = 0; gy < height; gy += 1) {
      for (let gx = 0; gx < width; gx += 1) {
        const x = origin.x + (gx + 0.5) * cell;
        const y = origin.y + (gy + 0.5) * cell;
        let inside = false;
        for (const room of rooms) {
          if (pointInPolygon(x, y, room.polygon)) {
            inside = true;
            break;
          }
        }
        grid[gy * width + gx] = inside ? 1 : 0;
      }
    }

    for (const wall of world.wallsByFloor?.[floor.id]?.walls ?? []) {
      const reach = (wall.thickness ?? 0.15) / 2 + agentRadius;
      const horizontal = wall.axis === "x";
      const min = wall.from - reach;
      const max = wall.to + reach;
      for (let gy = 0; gy < height; gy += 1) {
        for (let gx = 0; gx < width; gx += 1) {
          const index = gy * width + gx;
          if (!grid[index]) continue;
          const x = origin.x + (gx + 0.5) * cell;
          const y = origin.y + (gy + 0.5) * cell;
          const along = horizontal ? x : y;
          const across = horizontal ? y : x;
          if (along >= min && along <= max && Math.abs(across - wall.at) <= reach) grid[index] = 0;
        }
      }
    }

    for (const fixture of world.fixtures) {
      if (fixture.floor !== floor.id || !fixture.collider) continue;
      const [w, d] = fixture.size;
      const radians = (fixture.rot * Math.PI) / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const halfX = (cos * w + sin * d) / 2 + agentRadius;
      const halfY = (sin * w + cos * d) / 2 + agentRadius;
      this.#blockBox(grid, width, height, fixture.pos[0], fixture.pos[1], halfX, halfY);
    }

    for (const slot of world.slots) {
      if (slot.floor !== floor.id) continue;
      this.#carve(grid, width, height, slot.pos[0], slot.pos[1], SEAT_CLEARANCE);
      // Seats pushed against a sofa, table or partition still need a way in, so a
      // short spoke is carved from the seat towards its room centre.
      const room = world.roomById.get(slot.room);
      if (!room) continue;
      const dx = room.center[0] - slot.pos[0];
      const dy = room.center[1] - slot.pos[1];
      const length = Math.min(APPROACH_LENGTH, Math.hypot(dx, dy));
      if (length < 0.2) continue;
      const ux = dx / Math.hypot(dx, dy);
      const uy = dy / Math.hypot(dx, dy);
      const steps = Math.ceil(length / (cell / 2));
      for (let step = 1; step <= steps; step += 1) {
        const t = (step / steps) * length;
        this.#carve(grid, width, height, slot.pos[0] + ux * t, slot.pos[1] + uy * t, APPROACH_RADIUS);
      }
    }

    // Doorways are carved last so no fixture or seat can ever seal a room off.
    for (const door of world.doors ?? []) {
      if (door.floor !== floor.id) continue;
      const reach = Math.min((door.width ?? 1) / 2, 0.7);
      this.#carve(grid, width, height, door.center[0], door.center[1], reach);
      const push = reach + agentRadius + 0.15;
      this.#carve(
        grid,
        width,
        height,
        door.center[0] + (door.wallAxis === "y" ? push : 0),
        door.center[1] + (door.wallAxis === "y" ? 0 : push),
        reach * 0.8,
      );
      this.#carve(
        grid,
        width,
        height,
        door.center[0] - (door.wallAxis === "y" ? push : 0),
        door.center[1] - (door.wallAxis === "y" ? 0 : push),
        reach * 0.8,
      );
    }

    for (const link of world.verticalLinks) {
      for (const end of link.ends ?? []) {
        if (end.floor !== floor.id) continue;
        this.#carve(grid, width, height, end.arrive[0], end.arrive[1], 0.9);
      }
    }

    return { id: floor.id, width, height, grid };
  }

  #blockBox(grid, width, height, x, y, halfX, halfY) {
    const { cell, origin } = this;
    const gx0 = Math.max(0, Math.floor((x - halfX - origin.x) / cell));
    const gx1 = Math.min(width - 1, Math.ceil((x + halfX - origin.x) / cell));
    const gy0 = Math.max(0, Math.floor((y - halfY - origin.y) / cell));
    const gy1 = Math.min(height - 1, Math.ceil((y + halfY - origin.y) / cell));
    for (let gy = gy0; gy <= gy1; gy += 1) {
      for (let gx = gx0; gx <= gx1; gx += 1) {
        const px = origin.x + (gx + 0.5) * cell;
        const py = origin.y + (gy + 0.5) * cell;
        if (Math.abs(px - x) <= halfX && Math.abs(py - y) <= halfY) grid[gy * width + gx] = 0;
      }
    }
  }

  #carve(grid, width, height, x, y, radius) {
    const { cell, origin } = this;
    const gx0 = Math.max(0, Math.floor((x - radius - origin.x) / cell));
    const gx1 = Math.min(width - 1, Math.ceil((x + radius - origin.x) / cell));
    const gy0 = Math.max(0, Math.floor((y - radius - origin.y) / cell));
    const gy1 = Math.min(height - 1, Math.ceil((y + radius - origin.y) / cell));
    for (let gy = gy0; gy <= gy1; gy += 1) {
      for (let gx = gx0; gx <= gx1; gx += 1) {
        const px = origin.x + (gx + 0.5) * cell;
        const py = origin.y + (gy + 0.5) * cell;
        if ((px - x) ** 2 + (py - y) ** 2 <= radius * radius) grid[gy * width + gx] = 1;
      }
    }
  }

  toGrid(x, y) {
    return [Math.floor((x - this.origin.x) / this.cell), Math.floor((y - this.origin.y) / this.cell)];
  }

  toPlan(gx, gy) {
    return [this.origin.x + (gx + 0.5) * this.cell, this.origin.y + (gy + 0.5) * this.cell];
  }

  isWalkable(floorId, x, y) {
    const floor = this.floors.get(floorId);
    if (!floor) return false;
    const [gx, gy] = this.toGrid(x, y);
    if (gx < 0 || gy < 0 || gx >= floor.width || gy >= floor.height) return false;
    return floor.grid[gy * floor.width + gx] === 1;
  }

  nearestWalkable(floorId, x, y, maxRadius = 3) {
    if (this.isWalkable(floorId, x, y)) return [x, y];
    const floor = this.floors.get(floorId);
    if (!floor) return [x, y];
    const [cx, cy] = this.toGrid(x, y);
    for (let radius = 1; radius <= maxRadius / this.cell; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const gx = cx + dx;
          const gy = cy + dy;
          if (gx < 0 || gy < 0 || gx >= floor.width || gy >= floor.height) continue;
          if (floor.grid[gy * floor.width + gx] === 1) return this.toPlan(gx, gy);
        }
      }
    }
    return [x, y];
  }

  /** A* between two plan points on one floor. Returns smoothed plan-space waypoints. */
  path(floorId, from, to) {
    const floor = this.floors.get(floorId);
    if (!floor) return [to];
    const start = this.#clampToGrid(floor, ...this.toGrid(...this.nearestWalkable(floorId, from[0], from[1])));
    const goal = this.#clampToGrid(floor, ...this.toGrid(...this.nearestWalkable(floorId, to[0], to[1])));
    const index = (gx, gy) => gy * floor.width + gx;
    if (start.gx === goal.gx && start.gy === goal.gy) return [to];
    if (floor.grid[index(goal.gx, goal.gy)] !== 1) return [to];

    const total = floor.width * floor.height;
    const gScore = new Float32Array(total).fill(Infinity);
    const fScore = new Float32Array(total).fill(Infinity);
    const cameFrom = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const heap = new MinHeap();
    const startIndex = index(start.gx, start.gy);
    const goalIndex = index(goal.gx, goal.gy);
    gScore[startIndex] = 0;
    fScore[startIndex] = this.#heuristic(start.gx, start.gy, goal.gx, goal.gy);
    heap.push(startIndex, fScore[startIndex]);

    let found = false;
    while (heap.size) {
      const current = heap.pop();
      if (current === goalIndex) {
        found = true;
        break;
      }
      if (closed[current]) continue;
      closed[current] = 1;
      const cx = current % floor.width;
      const cy = (current - cx) / floor.width;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= floor.width || ny >= floor.height) continue;
          const neighbour = index(nx, ny);
          if (closed[neighbour] || floor.grid[neighbour] !== 1) continue;
          if (dx && dy && (floor.grid[index(cx + dx, cy)] !== 1 || floor.grid[index(cx, cy + dy)] !== 1)) continue;
          const step = dx && dy ? Math.SQRT2 : 1;
          const tentative = gScore[current] + step;
          if (tentative >= gScore[neighbour]) continue;
          cameFrom[neighbour] = current;
          gScore[neighbour] = tentative;
          fScore[neighbour] = tentative + this.#heuristic(nx, ny, goal.gx, goal.gy);
          heap.push(neighbour, fScore[neighbour]);
        }
      }
    }

    if (!found) return [to];

    const points = [];
    let node = goalIndex;
    while (node !== -1) {
      const gx = node % floor.width;
      const gy = (node - gx) / floor.width;
      points.push(this.toPlan(gx, gy));
      node = cameFrom[node];
    }
    points.reverse();
    const smoothed = this.#smooth(floor, points);
    if (smoothed.length) smoothed[smoothed.length - 1] = to;
    return smoothed;
  }

  #clampToGrid(floor, gx, gy) {
    return {
      gx: Math.min(Math.max(gx, 0), floor.width - 1),
      gy: Math.min(Math.max(gy, 0), floor.height - 1),
    };
  }

  #heuristic(ax, ay, bx, by) {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
  }

  /** String pulling: keeps a waypoint only when the straight line stops being clear. */
  #smooth(floor, points) {
    if (points.length <= 2) return points;
    const result = [points[0]];
    let anchor = 0;
    for (let i = 2; i < points.length; i += 1) {
      if (!this.#lineClear(floor, points[anchor], points[i])) {
        result.push(points[i - 1]);
        anchor = i - 1;
      }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  #lineClear(floor, a, b) {
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.ceil(distance / (this.cell * 0.5));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const [gx, gy] = this.toGrid(x, y);
      if (gx < 0 || gy < 0 || gx >= floor.width || gy >= floor.height) return false;
      if (floor.grid[gy * floor.width + gx] !== 1) return false;
    }
    return true;
  }

  stats() {
    const stats = {};
    for (const [id, floor] of this.floors) {
      let walkable = 0;
      for (let i = 0; i < floor.grid.length; i += 1) walkable += floor.grid[i];
      stats[id] = { cells: floor.width * floor.height, walkable, ratio: walkable / (floor.width * floor.height) };
    }
    return stats;
  }
}

class MinHeap {
  constructor() {
    this.items = [];
    this.keys = [];
  }

  get size() {
    return this.items.length;
  }

  push(item, key) {
    this.items.push(item);
    this.keys.push(key);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.keys[parent] <= this.keys[index]) break;
      this.#swap(parent, index);
      index = parent;
    }
  }

  pop() {
    const top = this.items[0];
    const lastItem = this.items.pop();
    const lastKey = this.keys.pop();
    if (this.items.length) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.items.length && this.keys[left] < this.keys[smallest]) smallest = left;
        if (right < this.items.length && this.keys[right] < this.keys[smallest]) smallest = right;
        if (smallest === index) break;
        this.#swap(smallest, index);
        index = smallest;
      }
    }
    return top;
  }

  #swap(a, b) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
