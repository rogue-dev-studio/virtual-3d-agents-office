# Design — Virtual 3D Agent Office

## 1. Visual direction

A modern technology company's office, lit like an architectural visualisation: neutral warm
interior, controlled contrast, believable materials (wood, fabric, metal, glass, carpet, vinyl).
The 3D world is the product — the HUD is a thin overlay, never a dashboard that hides the office.

- Tone mapping: ACES Filmic, `exposure ≈ 1.0`, physically correct-ish lighting (HDRI + interior fills).
- Environment: `studio_small_09` HDRI (CC0) for image-based lighting + reflections; intensity
  reduced at the low preset.
- Colour: interior palette comes from the vendored world dataset/material names. Status colours are
  the only saturated elements besides signage:
  - working `#3ddc97` · thinking `#7aa2ff` · in meeting `#c58bff` · reviewing `#ffc861`
  - waiting approval `#ff9f45` · completed `#8bd450` · error `#ff5d5d` · idle `#9aa4b2`
- Camera: 3/4 top-down rig (pitch 0.55–1.45 rad, distance 7–34 m), portrait screens pull back.

## 2. Layout (remapped from the vendored dataset)

| Floor | Rooms (display names) |
|---|---|
| L1 | Lobby & Reception · Meeting Room A · Design Studio & Showcase · Pantry & Coffee · Product Room · **Engineering Workspace** · Research Lab · **QA Lab** · CEO Office · Architecture Studio · Frontend Pod · Backend Pod · **Server Room** · Storage · Corridors · Stairs & Lift · Restrooms |
| L2 | Library / Focus Area · Lounge & Coffee Bar · Dining & Break Room · War Room · Indoor Garden · **Playtest Lab** · Focus Pods · Training & Workshop Room · Terrace · Showers & Lockers · Storage · Corridors · Stairs & Lift |

Every space required by the brief exists; the three rooms whose RPG fixtures were dropped are
repurposed and refurnished (ADR-7).

## 3. Workstations

Each desk gets tech props placed in the desk's own local frame (no hand-tuned absolute
coordinates): monitor centred on the far edge facing the sitter, laptop offset, arm lamp on the
free corner, notepads and stationery on the surface, floor cabinet and bin beside the desk.
Only the desks that host an agent (9) and the open-plan rows (6) get the full kit at medium/high;
the low preset keeps monitors only.

## 4. Agent representation

- Vendored character GLBs (shared 18-bone skeleton, 24 clips).
- Status → animation: idle→`idle`, thinking→`rub_head`, working→`type_fast`, reviewing→`read`,
  in_meeting→`talk`, waiting_approval→`idle` + amber ring, completed→`stretch`, error→`surprised`,
  walking→`walk`/`run`.
- A floating label sprite per agent: name · role · status pill. Labels fade out beyond 26 m or when
  the agent's floor is inactive (keeps the scene readable).
- A floor ring under the selected agent, coloured by status.

## 5. HUD and panels

- **Top bar:** app title, live counters (agents, working, idle, tasks active/completed/errors),
  simulation badge, floor switch (L1/L2/All), quality select, help, credits, fullscreen.
- **Left: Dashboard** — activity feed (latest events), division list with working counts,
  "needs attention" list (error + waiting approval), agent roster (click to focus).
- **Right: Detail panel** — agent (avatar, role, division, status, task, progress bar, last
  activity, log, focus button) or room (name, division, occupant list) or workstation (desk,
  occupant, equipment list).
- Panels are semi-transparent, blur-backed, collapsible, and never cover more than ~30 % of the
  viewport width; on phones they become bottom sheets and the HUD collapses to icon buttons.

## 6. Interaction model

| Input | Action |
|---|---|
| Left-drag / one-finger drag | Orbit |
| Right-drag / two-finger drag | Pan |
| Wheel / pinch | Zoom |
| Click / tap agent, desk, room floor, prop | Open detail panel |
| `W` / `S` / `A` / `D` or arrows | Move the camera focus point |
| `Q` / `E` | Rotate camera |
| `R` | Reset to office overview |
| `F` | Focus the selected agent |
| `1` / `2` / `0` | Show L1 / L2 / overview |
| `H` / `?` | Help overlay |
| `Esc` | Close panel/overlay, clear selection |

Clicks that land on HUD elements are ignored by the picking system (pointer target check).

## 7. Accessibility

- All controls are real `<button>`/`<select>` elements with labels and visible focus.
- Panels are `role="dialog"` with `aria-modal`, focus trapped, Esc closes, focus restored.
- Status is never colour-only: label text carries the status name.
- `prefers-reduced-motion` disables camera fly-in easing and label pulses.
- No-WebGL: DOM directory (roster table + activity list + status counts) remains fully usable.

## 8. Responsive breakpoints

| Width | Behaviour |
|---|---|
| ≥ 1280 px | Dashboard left, detail right, full top bar |
| 900–1279 px | Detail becomes an overlay sheet; dashboard collapses |
| < 900 px (tablet/phone) | Icon-only top bar, bottom-sheet panels, larger hit targets, labels limited to name + status |
