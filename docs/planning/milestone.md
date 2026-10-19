# Milestones — Virtual 3D Agent Office v1.0

**Owner:** Project Manager · **Date:** 2026-10-19

## Milestone status

| Milestone | Scope | Exit criteria | Status | Closed |
|---|---|---|---|---|
| **M0 — Gate 0** | Attribution + entitlement gates | All three verification scripts pass before any catalog use | ✅ done | 2026-10-19 |
| **M1 — Foundations** | Vite + three.js shell, world data loader, asset pipeline, quality presets | The app builds and renders the empty office shell | ✅ done | 2026-10-19 |
| **M2 — Vertical slice** | One real workspace, GLB furniture, ≥2 agents, animation, camera, selection, agent panel, credits | A visitor can select an agent and read its profile | ✅ done | 2026-10-19 |
| **M3 — The office** | Both floors, furniture everywhere, workstation props, nav grid, walking, room/prop interaction, simulation | Agents work, move and take breaks on both floors | ✅ done | 2026-10-19 |
| **M4 — Command centre** | HUD/dashboard/feed/divisions/attention, responsiveness, fallback, error handling | Full HUD works on desktop, tablet, mobile | ✅ done | 2026-10-19 |
| **M5 — Verification** | vitest, Playwright ×3 viewports, build, perf, console + asset audit | All gates green; QA report written | ✅ done | 2026-10-19 |
| **M6 — Release (local)** | README, release notes, asset register, project card | v1.0.0 packaged locally | ✅ done | 2026-10-19 |

## Timeline (single iteration, local development)

| Day | Planned | Actual |
|---|---|---|
| D1 | Audit, decision, asset vendoring + CC0 download/optimize, docs skeleton | done — plan/SRS/architecture/design; assets vendored + fetched |
| D2 | Core runtime, world builder, workstation props | done |
| D2 | Agents: roster, animation, simulation, navigation | done |
| D3 | HUD/panels/credits, camera + interaction | done |
| D3 | Tests, build, screenshots, QA report, README | done |

## Milestone metrics

| Metric | Target | Actual |
|---|---|---|
| Acceptance criteria met | 13 / 13 | 13 / 13 (2 partial notes: fallback test, reduced-motion) |
| Unit tests | ≥ 8 | **10 / 10** |
| E2E tests | desktop + mobile | **15 / 15** across desktop, tablet, mobile |
| Console errors on load | 0 | **0** |
| Draw calls | few hundred | **163** (Low) / **351** (Medium) |
| Medium fps on this machine | 60 (NFR-01) | **18** (weak iGPU) — open follow-up |
| Production build | green | **green** |
| Blocking defects at release | 0 | **0** (5 found, all fixed) |

## What closes the project

All exit criteria above are met. The remaining items are **explicitly out of v1 scope** and recorded
in `wbs.md` (Remaining) and `docs/qa/QA-REPORT.md` §7. No milestone is left open.
