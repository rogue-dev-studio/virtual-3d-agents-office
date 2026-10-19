# Architecture — Virtual 3D Agent Office

## 1. Principles

Separation between **data**, **world**, **agents**, **interaction** and **UI**; every module has one
job and a small public surface. No framework: three.js for rendering, hand-written ES modules,
plain CSS. Data drives geometry — nothing about the office layout is hard-coded in a renderer.

## 2. Module map

```
index.html
  └── src/main.js                 bootstrap, fallback gate, error boundary
        ├── core/renderer.js      WebGLRenderer, tone mapping, resize, dispose
        ├── core/assets.js        GLTF / HDRI / texture loaders + cache + failure policy
        ├── core/loading.js       LoadingManager progress + loading screen state
        ├── core/quality.js       auto/low/medium/high presets (shadows, pixel ratio, props)
        ├── world/worldData.js    fetch+validate world.json + walls.json, apply room labels/divisions
        ├── world/building.js     building-L{1,2}.glb shell, per-floor groups, door leaves, floor switch
        ├── world/furniture.js    fixtures → furniture/<type>.glb → merged per material
        ├── world/props.js        workstation tech props + CC0 props (local frames, instanced)
        ├── world/signage.js      artwork planes for fixtures carrying `artwork`
        ├── world/materials.js    shared material/palette cache + batching helper
        ├── agents/roster.js      agent data (role, division, desk, seat, away rooms)
        ├── agents/agent.js       character instance: model, mixer, status, label sprite
        ├── agents/animations.js  clip name → semantic animation mapping + crossfade
        ├── agents/simulation.js  seeded plan → task/status/progress/movement intents
        ├── agents/navigation.js  raster grid, A*, path following, seat reservation
        ├── interaction/camera.js orbit/focus/overview camera rig
        ├── interaction/picking.js raycaster + Box3 proxies for agents/desks/rooms/props
        ├── interaction/input.js  keyboard, wheel, touch, pointer → intents
        ├── ui/*.js               hud, dashboard, agentPanel, roomPanel, credits, help, loading, dom
        └── data/*.js             agents, divisions, tasks, rooms, officeAdditions, assetCredits
```

## 3. Data flow

```
world.json ─┐
            ├─► worldData ─► building (shell GLB) ─► scene
walls.json ─┘            ├─► furniture (fixtures)  ─► batched meshes + pick proxies
                         ├─► props (desks/CC0)     ─► batched meshes + pick proxies
                         └─► signage               ─► textured planes

roster.js ─► Agent instances ─► simulation (status/task) ─► animation + navigation
                                    │
                                    └─► events ─► HUD / dashboard / agentPanel
```

The simulation never touches three.js directly: it emits state, and the renderer/UI react.
That keeps the door open for a real backend later (replace `simulation.js` with a transport).

## 4. Coordinate conventions

Vendored data uses **plan coordinates** `(x, y)` with `z` up; three.js is Y-up.
`toThree(x, y, z) = (x, z, -y)` (same convention as the source dataset, so the vendored building
GLB, walls and fixtures all agree).

- Fixture rotation: `rotation.y = rot°` (fixture front = glTF `+Z` = plan `-Y` at rot 0).
- Seat facing: plan azimuth `φ` (0° = +X east, CCW) → character `rotation.y = 90° + φ`.
- Floors: L1 at `y = 0`, L2 at `y = 4` (floor-to-floor from the dataset).

## 5. Navigation

`navigation.js` rasterises per floor at `CELL = 0.1 m`:

1. fill wall rectangles (`walls.json`),
2. clear door-opening rectangles (openings are already cut in the data),
3. fill fixture collider rectangles (desks, racks, sofas…),
4. fill open door leaves,
5. inflate by `RADIUS = 0.25 m` (agent body) to get the blocked mask.

Pathfinding is A* on 8 neighbours without corner cutting, then path smoothing via grid line
traversal. Seat reservations are held per activity slot (`capacity 1`); a reserved seat is a
blocked cell for other agents. Level changes use the dataset's `verticalLinks` (stairs/lift) with
the endpoints animated at `elevation` interpolation.

## 6. Rendering strategy

- **Platform shell** (building GLB) is a handful of meshes per floor: cheap, already optimised.
- **Furniture** is loaded per type once, decomposed into parts by material, transformed into world
  space and merged per material → one draw call per (type, material) instead of per fixture.
- **Tech props** (monitor/laptop/lamp/…) are the same trick with instanced/merged geometry.
- **Picking** does not raycast the merged geometry: every fixture/prop registers a `Box3` proxy, so
  picking is a ray-vs-box test list (fast and stable) with agents tested against capsules.
- **Floor switching** toggles group visibility + shadow casting, and L2 is loaded lazily on first use.
- **Quality presets** control shadow map size, PCF type, pixel ratio, environment intensity and
  whether CC0 prop detail is placed at all.

## 7. Failure policy

| Failure | Behaviour |
|---|---|
| WebGL missing | `main.js` renders the DOM directory (agents, statuses, activity) + explanation |
| `world.json` invalid | Loading screen shows a fatal error, console error, rendering aborts |
| One furniture GLB missing | Fixture is skipped, a magenta marker keeps its footprint honest, entry is appended to the HUD "asset issues" list, credits mark it `missing` |
| HDRI missing | Falls back to hemisphere + directional lighting, HUD notes "no HDRI" |
| Character GLB missing | Agent is shown as a status stand-in marker and flagged in the panel |

Nothing is silently substituted: every degradation is visible in the UI and in
`docs/assets/ASSET-REGISTER.md`.

## 8. Performance budget (medium preset)

| Budget | Target |
|---|---|
| Draw calls (both floors visible, L2 lazy) | < 250 active |
| Triangles on screen | < 900 k |
| Textures | ≤ 512 px for CC0 props, 1k HDRI |
| Shadow map | 2048 (high) / 1024 (medium) / off (low) |
| Pixel ratio | min(devicePixelRatio, 2) |
| JS transfer | < 700 KB gzip (three + app) |
| Frame time | ≤ 16 ms median on a mid desktop GPU |

## 9. Related decisions

`docs/architecture/decisions.md` records ADR-1 (build new vs fork), ADR-2 (vendoring MIT assets),
ADR-3 (JS over TS), ADR-4 (merged geometry + box picking), ADR-5 (seeded simulation), ADR-6 (single
credits registry).
