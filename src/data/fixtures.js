/** Fixture footprint [width, depth, height] in metres, copied from the vendored world catalog. */
export const FIXTURE_SIZE = {
  reception_desk: [3, 0.9, 1.1],
  desk: [1.6, 0.8, 0.75],
  desk_exec: [1.8, 0.9, 0.75],
  chair: [0.6, 0.6, 0.9],
  chair_guest: [0.55, 0.55, 0.85],
  stool: [0.45, 0.45, 0.7],
  meeting_table: [4, 1.4, 0.75],
  round_table: [1.2, 1.2, 0.75],
  high_table: [1.2, 0.7, 1.05],
  dining_table: [1.8, 0.9, 0.75],
  coffee_table: [1, 0.6, 0.4],
  work_table: [1.6, 0.8, 0.9],
  plan_table: [1.8, 0.9, 0.9],
  drafting_table: [1.4, 1, 0.95],
  sofa: [2, 0.9, 0.8],
  armchair: [0.9, 0.9, 0.85],
  beanbag: [0.8, 0.8, 0.5],
  bench: [1.6, 0.45, 0.45],
  bookshelf: [1.2, 0.4, 2],
  model_shelf: [1.2, 0.4, 1.8],
  tool_cabinet: [1, 0.5, 1.2],
  storage_shelf: [1.8, 0.5, 2],
  locker: [1.2, 0.5, 1.8],
  whiteboard: [1.8, 0.1, 1.2],
  wall_display: [1.6, 0.1, 0.95],
  gallery_panel: [1.5, 0.3, 2],
  poster: [0.7, 0.05, 1],
  directory_sign: [1.2, 0.08, 0.9],
  easel: [0.8, 0.8, 1.7],
  plant_large: [0.6, 0.6, 1.6],
  plant_small: [0.4, 0.4, 0.9],
  planter_box: [1.6, 0.6, 0.7],
  tree_planter: [1.2, 1.2, 2.6],
  pantry_counter: [3, 0.65, 0.9],
  coffee_bar: [2.4, 0.6, 1],
  fridge: [0.7, 0.7, 1.8],
  sink: [0.6, 0.45, 0.85],
  wc: [0.4, 0.7, 0.8],
  partition: [1.5, 0.05, 2],
  shower_stall: [0.9, 0.9, 2.1],
  rack_42u: [0.6, 1, 2],
  lab_bench: [1.8, 0.75, 0.9],
  lab_rack_open: [0.6, 0.6, 1.2],
  media_console: [2, 0.5, 1.6],
  stair_u: [2.6, 4.4, 4],
  lift: [1.9, 2.2, 3],
};

/**
 * RPG-flavoured fixture types that do not belong in a technology office. They are
 * filtered out of the vendored dataset and the three rooms that hosted them are
 * repurposed (see `docs/architecture/decisions.md` ADR-7).
 */
export const DROPPED_FIXTURE_TYPES = new Set([
  "billiard_table",
  "cue_rack",
  "arcade_cabinet",
  "board_table",
  "treadmill",
  "exercise_bike",
  "exercise_mat",
  "dumbbell_rack",
]);

export function furnitureAssetUrl(type) {
  return `assets/furniture/${type}.glb`;
}

/**
 * `stair_u` and `lift` are catalog entries whose geometry already exists inside
 * the building shell GLB (`STAIR-FX-L1-067`, `LIFT-FX-L1-068`, …). Placing the
 * standalone models too would duplicate them, so they are skipped.
 */
export const SHELL_FIXTURE_TYPES = new Set(["stair_u", "lift"]);

export function isShellType(type) {
  return SHELL_FIXTURE_TYPES.has(type);
}

export function fixtureSize(fixture) {
  return fixture.size ?? FIXTURE_SIZE[fixture.type] ?? [1, 1, 1];
}
