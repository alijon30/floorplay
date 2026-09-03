# Floorplay

Design a room with ChatGPT on the same floor plan.

Floorplay is a single-room furniture planner where a human and an AI agent edit the same live plan. You drag furniture, lock what you love, and approve proposals. ChatGPT works the same room through [WebMCP](https://github.com/webmachinelearning/webmcp) tools and iterates against a geometry engine that checks door swings, walkways, clearances, daylight and budget, so it reasons over facts it cannot fake.

**Live demo:** coming soon (Vercel URL added after deploy).

## What you can do

- Start from a ready-made room. Eight furnished templates, each with its own brief, budget and finish, load in one click.
- Build a room from scratch: dimensions, doors with swing, windows with a compass direction.
- Furnish it by hand from a catalog of 139 items with real dimensions and prices, or let the agent do it.
- Hang things on the walls: pictures, mirrors, wall shelves, curtains, coat hooks and a wall TV all mount at a real height.
- Recolor a piece from its alternative finishes, repaint the walls, change the floor, or take one of three palettes derived from what is already in the room.
- Drop furniture near a wall and watch it snap flush and turn to face the room, or ask the agent where a piece belongs.
- See every problem as it happens: blocked doors, no walkway, an item in the dark, a blown budget, each with a one-click fix.
- Get layout options from the agent as ghost furniture and floating cards, then accept, reject, or drag a ghost before accepting.
- Watch daylight move through the room on a time slider, in 2D and in 3D.
- Walk through the room in 3D, or ask the agent what it sees from the door.
- Roll back any step from a ledger that records every action by either party.

Everything is stored in your browser. Nothing leaves your machine.

## The workspace

Floorplay is laid out like a drafting tool rather than a chat window.

- **Top bar** — the brand mark, the room name, the room's size in centimetres, then undo, **My rooms** and the agent chip.
- **Tool rail**, down the left edge — **Catalog** and **Room** at the top, **Style** and **Help** at the bottom. Each is an icon button with a tooltip and an accent bar while its surface is open.
- **Plan viewport** — a drafting sheet: paper ground, a 10 cm fine grid over a 100 cm major grid, solid wall bands with doors and windows cut out of them, swing arcs, dimension lines with witness ticks, and outlined furniture with its own glyph. Its toolbar carries the north-wall control, the grid toggle, the daylight-overlay toggle and fit-to-view. The wheel zooms from 0.5x to 4x.
- **3D viewport** — the same room in three.js, with its own orbit/walk, shadows and fit buttons. Clicking a piece here selects it everywhere.
- **Properties column**, on the right — **Room**, **Selection** and **Issues** tabs, the last carrying a count badge. Selecting anything anywhere switches to Selection and opens the column if it was shut.
- **Ledger drawer** — one line showing the last action and the entry count, expanding to the full list with a **Revert** on every entry.
- **Status strip** — six readings across the bottom (free floor, walkway, open area, budget, light at the selected item, issues), then the daylight hour slider and the **Propose first** switch.

Proposals do not take a panel of their own. They float over the plan as cards, each with a thumbnail drawing the room's current footprints in grey and the proposal's ghosts as dashed outlines, its label, its three biggest deltas and **Accept** / **Reject**. Hovering one previews it on the drawing and in 3D underneath.

## Ready-made rooms

The new-room wizard opens on a grid of eight furnished templates, each with a thumbnail drawn from its own footprints. Every one arrives with a brief, a budget and a finish, and none of them starts with a blocked door, an unreachable item or a blown budget.

- **Living room** — a sofa facing the TV wall, a reading corner and a rug that ties the seating together.
- **Kitchen** — counters in an L along two walls with the fridge at the end of the run and an island in the middle.
- **Bedroom** — queen bed against the long wall, wardrobe opposite and a small desk under the window.
- **Entrance hall** — everything hugs the walls so the run from the front door stays clear.
- **Home office** — desk under the window, shelving on the blank wall and files within reach of the chair.
- **Dining room** — a long table centred under the pendant with chairs pulled back on every side.
- **Kids room** — a crib on one wall, a bed on the other and a soft rug across the floor between them.
- **Studio flat** — the starter studio, furnished: bed in the corner, desk in the east light, a loveseat by the door.

The agent reaches the same eight through `list_templates` and `load_template`, which builds the room, switches to it and hands back the summary.

## Catalog, colors and finishes

The catalog holds 139 items in twenty categories: beds, sofas, armchairs, desks, chairs, tables, wardrobes, shelves, dressers, nightstands, rugs, lamps, plants, TVs, kitchen units, appliances, storage, decor, wall-mounted pieces and a catch-all. Each item carries the room kinds it suits, so the catalog drawer and `get_catalog` both filter by room as well as by category, price and footprint. Wall-mounted items hang at a real height and take no floor, so a picture may sit above a sofa and a mirror above a desk without either reading as a collision.

Every color in the catalog is one of twenty-two named finishes: five woods, nine fabrics, three metals, three surfaces and two greens. The 3D view reads the hex back to decide how to shade a piece, so an oak table gets grain, a linen sofa gets a weave and a brass lamp gets metal.

Sixty-three items list two to four alternative colors. The **Selection** tab shows them as swatches under **Finish**; the agent sets one with `set_item_color`. **Style** in the tool rail turns the properties column to its Style tab: a mini plan you click to choose which wall you are painting, eleven regional palettes of six named paints each, and five floors (oak, walnut, ash, grey, tile), which the agent sets with `set_finish`, `set_wall_color` (by hex or by a "Japan/Aizome indigo" swatch name) and reads back with `get_style`. `suggest_palette` reads the dominant tone of the furniture already in the room and returns three whole-room schemes, warm, cool and neutral, each with a wall color, a floor, three accents and the exact recolors that would carry it out. Applying one from the Style tab lands as a single ledger entry, so one undo takes the room back.

## Walls

The plan says where furniture stands and the 3D view says what the room feels like; neither answers *how high, and how far along*. The **Wall** tab on the right viewport draws one wall straight on: its own paint, its doors and windows at their real sills, everything hanging on it, and the furniture standing in front of it as faint silhouettes, because a picture is hung relative to the sofa under it and not to the corner of the room. Pick a piece from the **Hang** strip and click the wall to hang it at its mount height; drag a hung piece along the wall and the whole slide lands as one undoable move. The N/E/S/W control switches walls.

Each wall can carry its own colour. **Style** opens eleven regional palettes — Japan, China, Europe, American, Italy, Egypt, Middle East, Scandinavia, Morocco, India, Mexico — of six named paints each, from shoji white and aizome indigo to Venetian red and Majorelle blue. A swatch paints the wall you are looking at; **Apply to all walls** takes the room back to a single colour. Four tools do the same for the agent: `get_elevation` reads one wall with its openings, its hung items and the furniture within a metre of it, `list_wall_palettes` returns the regions, `set_wall_color` paints one wall or all four, and `place_on_wall` hangs a wall-category item flush at a given offset.

## Use it with an agent

1. Open the live URL in ChatGPT's in-app browser, or in Google Chrome with `chrome://flags/#enable-webmcp-testing` enabled.
2. Click **Load the demo studio** on the first-run card, or pick a ready-made room from **My rooms → New room**.
3. Try prompts such as:
   - "Furnish this studio for my brief using suggest_positions. Give me three options."
   - "Start me a bedroom from a template, then make it work for two people."
   - "Suggest a palette for this room and apply the cool one."
   - "I moved the bed. Make it work and keep the desk in morning light."
   - "I'm over budget. Find cheaper storage."
   - "What do I see from the door?"

**First run.** On an untouched room a card sits over the plan with the three steps above, a **Load the demo studio** button, a **Start empty** button, a **Ready-made rooms...** link into the wizard, and three example prompts each with a **Copy** button. It disappears once you place anything or ask the agent for something, and **Don't show again** retires it for good.

The chip in the top right says whether an agent is connected and how many tools are registered; hover it for the last tool called. **Help** at the foot of the tool rail lists every shortcut:

| Key | What it does |
| --- | --- |
| Drag | Move an item on the plan. It snaps to walls and to the nearest 5 cm. |
| Wheel | Zoom the plan. Fit to view puts the whole room back on screen. |
| `R` | Rotate the selected item by 90 degrees. |
| `L` | Lock or unlock the selected item. |
| `Delete` | Remove the selected item (Backspace works too). |
| `Esc` | Clear the selection. |
| Cmd/Ctrl `Z` | Undo the last change, yours or the agent's. |
| Cmd/Ctrl Shift `D` | Open the developer panel: every tool, callable by hand. |

Three viewport toggles turn the drawing down to plain geometry when you want it: **Grid** and the sun button in the plan's toolbar drop the grid and the daylight wash, and **Shadows** over the 3D view drops the contact shadow. All three stick across reloads, along with the ledger drawer and the properties column.

## The WebMCP surface

All coordinates are integer centimeters from the room's top-left corner, items are placed by their center, and rotation is 0, 90, 180 or 270 degrees clockwise.

There are 49 static tools plus 4 that appear only while an item is selected. Between them they cover everything a person can do in the app, so the agent is never stuck asking the user to click something. `run_layout_script` needs a real Web Worker for its sandbox, so it is registered only in a browser; the test harness's fake model context sees the other 48.

Read-only tools: `get_room`, `get_catalog`, `suggest_positions`, `suggest_furniture`, `evaluate_layout`, `get_daylight`, `list_templates`, `suggest_palette`, `get_ledger`, `list_rooms`, `get_guide`.

Mutating tools: `set_room_shell`, `add_opening`, `remove_opening`, `set_brief`, `create_room`, `switch_room`, `rename_room`, `delete_room`, `place_item`, `move_item`, `rotate_item`, `fix_item`, `remove_item`, `swap_item`, `set_item_locked`, `select_item`, `clear_items`, `add_catalog_item`, `load_template`, `set_item_color`, `set_finish`, `apply_palette`, `propose_layout`, `apply_layout`, `apply_proposal`, `withdraw_proposal`, `apply_all_proposals`, `set_daylight_hour`, `set_camera`, `set_view`, `undo_last_action`, `revert_to_entry`, `run_layout_script`.

`suggest_positions` ranks real positions for a catalog item against the walls, the door swing, the window and the daylight model, and returns each one with a reason and a score, so the agent asks the room where a bed goes instead of guessing coordinates. `place_item` and `move_item` snap a position within 15 cm of a wall flush against it and turn wall furniture to face the room, reporting `snapped: true` and which wall, so a rough coordinate still lands like a designer put it there. `fix_item` moves one item to the nearest position that clears its blocking violations.

`run_layout_script` runs a small algorithm the agent writes, in a sandboxed Web Worker with no DOM access, and turns the returned placements into a proposal.

Nothing in the app is out of the agent's reach. `list_rooms`, `create_room`, `switch_room`, `rename_room` and `delete_room` cover the rooms menu, so the agent can start a second room and move between them. `apply_layout` writes a whole layout as one ledger entry, the way `propose_layout` offers one, and `apply_palette` does the same for a scheme from `suggest_palette`. `clear_items` empties a room while leaving locked pieces alone, `revert_to_entry` rewinds to any point in the ledger, `select_item` points the user at what the agent is discussing, and `set_view` reaches the daylight and shadow toggles. `get_guide` returns the recommended order of calls and the conventions, so an agent that has never seen the app can start well.

Three of the groups are about starting well and about how the room looks rather than where things stand. `list_templates` and `load_template` let the agent open a whole furnished room from one of the eight ready-made layouts instead of placing a dozen items one at a time. `set_item_color` and `set_finish` set a per-item finish and the room's wall paint and floor material, and `suggest_palette` derives three whole-room schemes from the furniture already placed, each carrying the exact calls that would apply it. `get_catalog` takes a `room` filter, so the agent can ask for kitchen items or kids items directly.

Tools that appear only while the page is in a matching state:

- When you select an item: `move_selected`, `replace_selected`, `remove_selected`, `find_alternatives_for_selected`. Their descriptions name the selected item, and they disappear when you deselect.

Every mutating tool returns the violations it caused, the new metrics, and, when a placement has problems, the nearest clear position. `evaluate_layout` lets the agent score a layout privately before showing anything. The **Propose first** switch turns every agent change into a proposal you accept on screen.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, store and tool tests
npm run build    # typecheck and production build
npm run smoke    # 35 screenshots plus a model contact sheet into ./smoke-out (first run downloads Chromium)
npm run models   # rebuild public/models from Poly Haven (the .glb files are committed; this is only for changing them)
```

## How it is built

- `src/engine` is a pure TypeScript model: geometry, validation, a 10 cm occupancy grid for reachability, a daylight model, metrics, the eight room templates, the palette deriver, the twenty-two named finishes, and invertible operations. It has no UI dependencies and is fully unit-tested, including a test that every template loads clean against the same validator the agent is scored by.
- `src/store` is a Zustand store. UI and tools both dispatch operations to it; every change appends a ledger entry with its inverse.
- `src/webmcp` registers tools with `document.modelContext`, re-registering the selection-scoped group whenever the selection changes. Proposal tools stay static, so everything a dynamic tool can do is also reachable by id. A shim provides a fake model context so the dev panel works in any browser.
- `src/plan` is the SVG drawing, with its own token palette kept separate from the interface palette so the sheet keeps printed contrast. `src/three` is the three.js scene: walls built as segments around real openings so sunlight comes through the window, procedural wood, fabric and plaster detail maps, and glTF models where the catalog's proportions allow.
- `src/ui` is the workspace shell: the tool rail, the viewport frames, the properties column, the ledger drawer and the status strip, all drawing on one module of shared class strings and a single 16 px icon set.

## 3D models

Armchairs, dining chairs, shelving, cabinets, sideboards, nightstands, coffee tables, poufs and
plants are drawn from photographed models rather than from boxes. They come from
[Poly Haven](https://polyhaven.com/models), are published under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), and are used here with thanks to the
people who made them — James Ray Cock, Ulan Cabanilla, Rico Cilliers, Amin, Vibrant Nordic, Patrik
Pangerl and Caspian Fortune. `public/models/LICENSES.md` credits each file individually.

Everything else — beds, sofas, desks, dining tables, stools, benches, rugs, lamps, kitchen units and
everything that hangs on a wall — is drawn procedurally. That is a choice about style, not a gap:
Poly Haven's furniture is largely period and salvage, and a Gothic four-poster or a Victorian settee
would break a plan for a modern rental more than a plain box does. The models that survived are the
short list Poly Haven itself files as `condition: clean` with modern or minimalist tags, so the two
renderers read as one catalog.

`npm run models` rebuilds them: it reads `scripts/models.manifest.json`, downloads the 1k glTF of
each asset, and compresses it to 512 px WebP textures and meshopt-packed geometry, which brings
eleven models to about 1.6 MB in total. `src/three/models.ts` decides which catalog entries each one
stands in for and how far it may be stretched onto a size it was not photographed at. `npm run smoke`
photographs one of every model in a single room as `contact-sheet.png`, which is where a piece whose
style, scale or orientation has drifted shows up.

Built for the WebMCP Challenge, September 2026. MIT licensed.
