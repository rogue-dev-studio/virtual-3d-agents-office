# Asset Register — Virtual 3D Agent Office v1.0

**Owner:** Technical Writer · **Date:** 2026-10-19 · **Rule:** every integrated asset has a source,
a license and a status. `unverified` must never ship as final — **there are no `unverified` entries.**

Runtime assets are served from `public/assets/`; **nothing is fetched from a third-party host at
runtime** (NFR-05). The in-app *Credits & Asset Licenses* modal is generated from
`src/data/assetCredits.js` + `SOFTWARE_CREDITS`, so the UI and this register cannot drift.

---

## 1. Vendored (MIT) — upstream `kantor-rpg`

| Field | Value |
|---|---|
| Author | Budi Prabhawa |
| License | **MIT** |
| Copyright | Copyright (c) 2026 Budi Prabhawa |
| Use | Vendored **unmodified** (ADR-3). Room names/divisions are remapped in our data layer; geometry is untouched |
| License text | `public/assets/vendor/kantor-rpg/LICENSE` · `NOTICE` |

| Asset group | Path | Count | Notes |
|---|---|---|---|
| Building shell | `building/building-L1.glb`, `building-L2.glb` | 2 | Authored in absolute glTF coordinates at the correct elevation |
| Characters | `characters/ch-{architect,assistant,ceo,designer,ictspec,netinstall,qa,supervisor,visual}.glb` | 9 | Skeleton + 24 named clips each; quantized skin weights |
| Furniture | `furniture/*.glb` | 54 | One node `FURN-<type>`; `KHR_mesh_quantization` |
| Signage / artwork | `signage/ART-01.jpg` … `ART-11.jpg` | 11 | |
| World dataset | `world/world.json`, `world/walls.json` | 2 | As vendored: 36 rooms, 44 doors, 39 windows, 201 fixtures, 118 activity slots, 9 actors; wall pieces with door gaps pre-carved. After our office additions (ADR-7) the runtime world has **227 fixtures / 131 slots** |

**Furniture models (54):** arcade_cabinet, armchair, beanbag, bench, billiard_table, board_table,
bookshelf, chair, chair_guest, coffee_bar, coffee_table, cue_rack, desk, desk_exec, dining_table,
directory_sign, drafting_table, dumbbell_rack, easel, exercise_bike, exercise_mat, fridge,
gallery_panel, high_table, lab_bench, lab_rack_open, lift, locker, media_console, meeting_table,
model_shelf, pantry_counter, partition, plan_table, plant_large, plant_small, planter_box, poster,
rack_42u, reception_desk, round_table, shower_stall, sink, sofa, stair_u, stool, storage_shelf,
tool_cabinet, treadmill, tree_planter, wall_display, wc, whiteboard, work_table.

> Eight types are filtered out of the office scene (arcade/billiard/gym) per ADR-7; the models remain
> on disk and credited.

## 2. CC0 — Poly Haven

| Field | Value |
|---|---|
| License | **CC0 1.0 Universal** (public domain dedication) — <https://polyhaven.com/license> |
| Attribution | Not required; recorded anyway for traceability |
| Pipeline | `npm run assets:fetch` then `npm run assets:optimize` (gltf-transform quantize + simplify + 512 px textures) |

| Asset | Used for | Source |
|---|---|---|
| Classic Laptop | Workstation laptops | <https://polyhaven.com/a/classic_laptop> |
| Television 01 | Desk monitors, wall displays, infrastructure screen | <https://polyhaven.com/a/Television_01> |
| Office Notepads | Desk props | <https://polyhaven.com/a/office_notepads> |
| Stationery Supplies | Desk props | <https://polyhaven.com/a/stationery_supplies> |
| Desk Lamp Arm 01 | Desk task lighting | <https://polyhaven.com/a/desk_lamp_arm_01> |
| Drawer Cabinet | Under-desk storage | <https://polyhaven.com/a/drawer_cabinet> |
| Metal Trash Can | Office bins | <https://polyhaven.com/a/metal_trash_can> |
| Wall Clock | Corridor / meeting-room clocks | <https://polyhaven.com/a/wall_clock> |
| Circuit Board | Server-room detail | <https://polyhaven.com/a/circuit_board> |
| Power Box 01 | Infrastructure cabinets | <https://polyhaven.com/a/power_box_01> |
| Projector Screen | Meeting rooms / training room | <https://polyhaven.com/a/projector_screen> |
| Studio Small 09 (HDRI, 1k) | Image-based lighting + reflections | <https://polyhaven.com/a/studio_small_09> |

Preview thumbnails for the credits modal: `public/assets/credits/*.png` (12).

## 3. Software

| Component | License | Use |
|---|---|---|
| three.js | MIT | WebGL renderer, GLTF loading, animation, raycasting |
| Vite | MIT | Dev server + production build |
| gltf-transform | MIT | Build-time optimizing/quantizing of CC0 props |
| Vitest | MIT | Unit tests |
| Playwright | Apache-2.0 | E2E tests + reference screenshots |

## 4. Generated / first-party

| Asset | Origin | License |
|---|---|---|
| Application source (`src/`, `index.html`, `tests/`, `scripts/`) | This project | MIT |
| Reference screenshots (`docs/qa/screens/*.png`) | Playwright capture of this app | MIT |

## 5. Status legend

| Status | Meaning |
|---|---|
| ✅ `verified` | Source URL, author and license confirmed and recorded |
| ⚠️ `unverified` | Not confirmed — **none in this project** |

All rows above are ✅ verified. The upstream project's public URL is intentionally redacted in
`assetCredits.js` (`VENDORED_SOURCE.url`) — the MIT license text and copyright holder are preserved
in full, which is what the license requires.
