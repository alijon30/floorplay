# Floorplay

Design a room with ChatGPT on the same floor plan.

Floorplay is a furniture planner where a human and an AI agent edit the same live plan. You drag furniture, lock what you love, and approve proposals. Rooms stand edge to edge on a shared floor plan, so a hall, a living room and a bedroom become one flat you can walk through. ChatGPT works those same rooms through [WebMCP](https://github.com/webmachinelearning/webmcp) tools and iterates against a geometry engine that checks door swings, walkways, clearances, daylight and budget, so it reasons over facts it cannot fake.

**Live demo:** https://floorplay-zeta.vercel.app — open it in ChatGPT's browser, or in Chrome with `chrome://flags/#enable-webmcp-testing` on.

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
- Join rooms into a home: stand them edge to edge on one plan, then cut a doorway through a wall two of them share and the opening appears in both rooms at once.
- Start a whole flat in one click from two ready-made homes, and walk it in 3D through the doorways.
- Roll back any step from a ledger that records every action by either party.

Everything is stored in your browser. Nothing leaves your machine.

## The workspace

Floorplay is laid out like a drafting tool rather than a chat window.

- **Top bar** — the brand mark, the room name, the room's size in centimetres, then undo, **My homes** and the agent chip. The menu lists each home with its rooms nested under it, then the rooms that stand on no plan, and offers **New home**, **New room** and the demo studio.
- **Tool rail**, down the left edge — **Catalog** and **Room** at the top, **Style** and **Help** at the bottom. Each is an icon button with a tooltip and an accent bar while its surface is open.
- **Properties column**, immediately right of the rail — **Catalog**, **Room**, **Style**, **Selection**, **Issues** and **Buy** tabs, with Issues carrying a count badge. Everything you press is down the left edge and everything you look at is to the right of it, so the plan never sits boxed in between two panels. Selecting anything anywhere switches to Selection and opens the column if it was shut.
- **Buy tab** — the room read back as a shopping list: one line per catalog id with a quantity, a line total, a status of To buy, Owned or Ordered, the shop it is coming from and a link, and a footer weighing what is still to buy against the budget. **Copy list** puts the whole thing on the clipboard as plain text.
- **Plan viewport** — a drafting sheet: paper ground, a 10 cm fine grid over a 100 cm major grid, solid wall bands with doors and windows cut out of them, swing arcs, dimension lines with witness ticks, and outlined furniture with its own glyph. Its toolbar carries a **Plan** / **Home** toggle, the north-wall control, the grid toggle, the daylight-overlay toggle and fit-to-view. The wheel zooms from 0.5x to 4x.
- **3D viewport** — the same room in three.js, with its own orbit/walk, shadows and fit buttons. Clicking a piece here selects it everywhere. In Home view it draws the whole flat instead, as one dollhouse.
- **Ledger drawer** — one line showing the last action and the entry count, expanding to the full list with a **Revert** on every entry.
- **Status strip** — six readings across the bottom (free floor, walkway, open area, budget, light at the selected item, issues), then the daylight hour slider. In Home view the six become home, rooms, area, items, budget against the summed budgets, and which rooms you can reach from the front door.

Proposals do not take a panel of their own. They float over the plan as cards, each with a thumbnail drawing the room's current footprints in grey and the proposal's ghosts as dashed outlines, its label, its three biggest deltas and **Accept** / **Reject**. Hovering one previews it on the drawing and in 3D underneath.

## Ready-made rooms

The wizard opens on the two ready-made homes, then a grid of eight furnished room templates, each with a thumbnail drawn from its own footprints. Every one arrives with a brief, a budget and a finish, and none of them starts with a blocked door, an unreachable item or a blown budget.

- **Living room** — a sofa facing the TV wall, a reading corner and a rug that ties the seating together.
- **Kitchen** — counters in an L along two walls with the fridge at the end of the run and an island in the middle.
- **Bedroom** — queen bed against the long wall, wardrobe opposite and a small desk under the window.
- **Entrance hall** — everything hugs the walls so the run from the front door stays clear.
- **Home office** — desk under the window, shelving on the blank wall and files within reach of the chair.
- **Dining room** — a long table centred under the pendant with chairs pulled back on every side.
- **Kids room** — a crib on one wall, a bed on the other and a soft rug across the floor between them.
- **Studio flat** — the starter studio, furnished: bed in the corner, desk in the east light, a loveseat by the door.

The agent reaches the same eight through `list_templates` and `load_template`, which builds the room, switches to it and hands back the summary.

## Connected rooms

A room does not have to stand alone. Rooms are placed on a shared floor plan — a **home** — at their own offset in centimetres, and they snap edge to edge: drop one within 20 cm of a neighbour's edge and it pulls flush, which is how two rooms come to share a wall. Rooms never overlap, and a drop that would overlap is refused, with the room it ran into named and an offset that works instead. Each room keeps its own coordinates, its own furniture, its own ledger and its own analysis; the home only says where each one stands and which walls have been cut through.

A doorway is cut through a wall two rooms share, and it is one hole in **both** of them. It defaults to 80 cm and hangs either as a door swinging into the room you cut from or as an open passage. Cutting one writes an opening and a ledger entry in each room; removing it takes both away. Move a room afterwards and a doorway survives only while both halves still meet at the same point on the plan, which is what a snap back to the same seam is; any doorway the move pulls out of line is taken out of both rooms and named back to you.

The plan toolbar carries a **Plan** / **Home** toggle. Home draws every room at its offset on one sheet, the current one in an accent outline and the rest dimmed, each with its name and size. Drag a room and accent lines mark every edge it has come to rest against; an overlap draws it red and refuses the drop. **Add room** offers the rooms standing on no plan, then the eight room templates. **Cut doorway** glows each shared wall as you pass over it and cuts a centred door where you click, and every doorway grows a × that takes it out again. Pressing **Home** while the current room is on no plan opens the short list of homes to join instead of greying out.

The 3D view follows the toggle. In Home view the whole flat renders as one dollhouse: every room stood at its offset, one sun over the plan, the orbit framed on the home. The outer walls facing the camera cut away, and the walls between rooms never do, so a doorway reads as a doorway. Walkthrough is clamped to the home rather than to one room, so you walk out of the living room, through the door and into the bedroom. `set_camera` and its presets stay in the current room's own coordinates either way.

Two homes come ready made, from **My homes → New room** or from `create_home` with a template key:

- **One-bedroom flat** — an entrance hall (200×420 cm) you come in through, a living room (450×550) off it, and a bedroom (340×420) and kitchen (380×420) beyond it, with all three doorways already cut and the front door in the hall.
- **Studio and hall** — the starter studio with a proper entrance hall in front of it, joined by one door.

Every room in a ready-made home is furnished from its own room template and none of them has a blocking violation, so the flat is walkable the moment it is built. The **HOME** section at the head of the **Room** tab reads the plan back as lists: the home's name, its rooms with the current one marked, its doorways each with a remove control, and buttons for **Add room…**, **Cut doorway**, **Set as entrance** and **Remove from home**.

## Catalog, colors and finishes

The catalog holds 139 items in twenty categories: beds, sofas, armchairs, desks, chairs, tables, wardrobes, shelves, dressers, nightstands, rugs, lamps, plants, TVs, kitchen units, appliances, storage, decor, wall-mounted pieces and a catch-all. Each item carries the room kinds it suits, so the catalog drawer and `get_catalog` both filter by room as well as by category, price and footprint. Wall-mounted items hang at a real height and take no floor, so a picture may sit above a sofa and a mirror above a desk without either reading as a collision.

Every color in the catalog is one of twenty-two named finishes: five woods, nine fabrics, three metals, three surfaces and two greens. The 3D view reads the hex back to decide how to shade a piece, so an oak table gets grain, a linen sofa gets a weave and a brass lamp gets metal.

Sixty-three items list two to four alternative colors. The **Selection** tab shows them as swatches under **Finish**; the agent sets one with `set_item_color`. **Style** in the tool rail turns the properties column to its Style tab: a mini plan you click to choose which wall you are painting, eleven regional palettes of six named paints each, and five floors (oak, walnut, ash, grey, tile), which the agent sets with `set_finish`, `set_wall_color` (by hex or by a "Japan/Aizome indigo" swatch name) and reads back with `get_style`. `suggest_palette` reads the dominant tone of the furniture already in the room and returns three whole-room schemes, warm, cool and neutral, each with a wall color, a floor, three accents and the exact recolors that would carry it out. Applying one from the Style tab lands as a single ledger entry, so one undo takes the room back.

## Walls

The plan says where furniture stands and the 3D view says what the room feels like; neither answers *how high, and how far along*. Wall pieces — pictures, mirrors, shelves, curtains, hooks, the TV — carry a mount height of their own, so dropping one against a wall on the plan hangs it there at that height and the 3D view shows it hung. The agent reads a wall straight on with `get_elevation`: its paint, its doors and windows at their real sills, everything hanging on it, and the furniture standing within a metre of it, because a picture is hung relative to the sofa under it and not to the corner of the room.

Each wall can carry its own colour. **Style** opens eleven regional palettes — Japan, China, Europe, American, Italy, Egypt, Middle East, Scandinavia, Morocco, India, Mexico — of six named paints each, from shoji white and aizome indigo to Venetian red and Majorelle blue. A swatch paints the wall you are looking at; **Apply to all walls** takes the room back to a single colour. Four tools do the same for the agent: `get_elevation` reads one wall with its openings, its hung items and the furniture within a metre of it, `list_wall_palettes` returns the regions, `set_wall_color` paints one wall or all four, and `place_on_wall` hangs a wall-category item flush at a given offset.

## Use it with an agent

1. Open the live URL in ChatGPT's in-app browser, or in Google Chrome with `chrome://flags/#enable-webmcp-testing` enabled.
2. Click **Load the demo studio** on the first-run card, or pick a ready-made room or home from **My homes → New room**.
3. Try prompts such as:
   - "Furnish this studio for my brief using suggest_positions. Give me three options."
   - "Start me a bedroom from a template, then make it work for two people."
   - "Suggest a palette for this room and apply the cool one."
   - "I moved the bed. Make it work and keep the desk in morning light."
   - "I'm over budget. Find cheaper storage."
   - "What do I see from the door?"
   - "Build me a one-bedroom flat, then cut a doorway between the living room and the bedroom."
   - "Put a kitchen to the right of this room and join the two."

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

All coordinates are integer centimeters from the room's top-left corner, items are placed by their center, and rotation is 0, 90, 180 or 270 degrees clockwise. A home adds one more frame: offsets on the shared plan are a room's top-left corner in centimetres, x growing right and y growing down.

There are 60 static tools plus 4 that appear only while an item is selected. Between them they cover everything a person can do in the app, so the agent is never stuck asking the user to click something. `run_layout_script` needs a real Web Worker for its sandbox, so it is registered only in a browser; the test harness's fake model context sees the other 58.

Read-only tools: `get_room`, `get_catalog`, `suggest_positions`, `suggest_furniture`, `evaluate_layout`, `get_daylight`, `list_templates`, `suggest_palette`, `get_ledger`, `list_rooms`, `get_shopping_list`, `get_guide`, `get_elevation`, `list_wall_palettes`, `get_style`, `get_home`, `list_home_templates`.

Mutating tools: `set_room_shell`, `add_opening`, `remove_opening`, `move_opening`, `set_brief`, `create_room`, `switch_room`, `rename_room`, `delete_room`, `place_item`, `move_item`, `rotate_item`, `fix_item`, `remove_item`, `swap_item`, `set_item_locked`, `select_item`, `clear_items`, `add_catalog_item`, `load_template`, `set_item_color`, `set_finish`, `apply_palette`, `set_wall_color`, `place_on_wall`, `propose_layout`, `apply_layout`, `apply_proposal`, `withdraw_proposal`, `apply_all_proposals`, `set_daylight_hour`, `set_camera`, `set_view`, `undo_last_action`, `revert_to_entry`, `set_purchase_status`, `run_layout_script`, `create_home`, `add_room_to_home`, `move_room`, `remove_room_from_home`, `cut_doorway`, `remove_doorway`.

`suggest_positions` ranks real positions for a catalog item against the walls, the door swing, the window and the daylight model, and returns each one with a reason and a score, so the agent asks the room where a bed goes instead of guessing coordinates. `place_item` and `move_item` snap a position within 15 cm of a wall flush against it and turn wall furniture to face the room, reporting `snapped: true` and which wall, so a rough coordinate still lands like a designer put it there. `fix_item` moves one item to the nearest position that clears its blocking violations.

`get_shopping_list` and `set_purchase_status` divide the buyout between the two parties. The app knows what is in the room, how many of each and what the catalog thinks each is worth, so it hands over the whole list with a ready-made `searchQuery` per line and the room's brief. What it cannot know is which shop near this person has the thing this week, so the agent goes and looks and writes the shop and the link back onto every copy of that piece as one ledger entry. The app plans the buyout; the agent finds the sources.

`run_layout_script` runs a small algorithm the agent writes, in a sandboxed Web Worker with no DOM access, and turns the returned placements into a proposal.

Eight tools cover the floor plan, and none of them touches furniture: they move rectangles around and open holes between them, so every room tool carries on working exactly as before. `get_home` reads the plan back — every room with its offset, size and item count, the doorways with both sides named, the bounding box, which room the front door is in, any room you cannot walk to from it, and totals for area, items and budget. `list_home_templates` and `create_home` build a whole flat furnished and joined, or start an empty plan. `add_room_to_home` stands a room on it, by id or by building a fresh one from a room template first, and when the current room is on no plan it starts one named after that room and places it at the origin, so "put a kitchen to the right of this room" works from a single room. `move_room` re-places a room and names the doorways the move cost in `removedDoorways`. `remove_room_from_home` takes a room off the plan and leaves it standing on its own with everything in it. `cut_doorway` and `remove_doorway` open and close one hole in two rooms at once, each writing a ledger entry in each room, which is why closing a doorway wants `remove_doorway` rather than an undo in one room. An overlap is refused with the room it ran into named and an offset that would work; an impossible doorway is refused with the walls that room really shares and the span of each in its own coordinates.

Nothing in the app is out of the agent's reach. `list_rooms`, `create_room`, `switch_room`, `rename_room` and `delete_room` cover the rooms menu, so the agent can start a second room and move between them, and the home tools above cover the floor plan they stand on. `apply_layout` writes a whole layout as one ledger entry, the way `propose_layout` offers one, and `apply_palette` does the same for a scheme from `suggest_palette`. `clear_items` empties a room while leaving locked pieces alone, `revert_to_entry` rewinds to any point in the ledger, `select_item` points the user at what the agent is discussing, and `set_view` reaches the daylight and shadow toggles. `get_guide` returns the recommended order of calls and the conventions, so an agent that has never seen the app can start well.

Three of the groups are about starting well and about how the room looks rather than where things stand. `list_templates` and `load_template` let the agent open a whole furnished room from one of the eight ready-made layouts instead of placing a dozen items one at a time. `set_item_color` and `set_finish` set a per-item finish and the room's wall paint and floor material, and `suggest_palette` derives three whole-room schemes from the furniture already placed, each carrying the exact calls that would apply it. `get_catalog` takes a `room` filter, so the agent can ask for kitchen items or kids items directly.

Tools that appear only while the page is in a matching state:

- When you select an item: `move_selected`, `replace_selected`, `remove_selected`, `find_alternatives_for_selected`. Their descriptions name the selected item, and they disappear when you deselect.

Every mutating tool returns the violations it caused, the new metrics, and, when a placement has problems, the nearest clear position. `evaluate_layout` lets the agent score a layout privately before showing anything. `propose_layout` puts an option on the plan as ghosts for you to accept or reject; everything else applies at once and one undo takes it back.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, store and tool tests
npm run build    # typecheck and production build
npm run smoke    # 44 screenshots plus a model contact sheet into ./smoke-out (first run downloads Chromium)
npm run models   # rebuild public/models from Poly Haven (the .glb files are committed; this is only for changing them)
```

## How it is built

- `src/engine` is a pure TypeScript model: geometry, validation, a 10 cm occupancy grid for reachability, a daylight model, metrics, the eight room templates, the palette deriver, the twenty-two named finishes, and invertible operations. `home.ts` adds the shared plan on top of it — shared wall segments, the 20 cm placement snap, the pair of openings a doorway builds, which walls another room covers end to end, and reachability from the front door — and `homeTemplates.ts` the two ready-made homes. It has no UI dependencies and is fully unit-tested, including tests that every room template and every ready-made home loads clean against the same validator the agent is scored by.
- `src/store` is a Zustand store. UI and tools both dispatch operations to it; every change appends a ledger entry with its inverse.
- `src/webmcp` registers tools with `document.modelContext`, re-registering the selection-scoped group whenever the selection changes. Proposal tools stay static, so everything a dynamic tool can do is also reachable by id. A shim provides a fake model context so the dev panel works in any browser.
- `src/plan` is the SVG drawing, with its own token palette kept separate from the interface palette so the sheet keeps printed contrast; `HomePlan.tsx` reuses the same layers inside a transform per room to draw a whole flat on one sheet. `src/three` is the three.js scene: walls built as segments around real openings so sunlight comes through the window, procedural wood, fabric and plaster detail maps, glTF models where the catalog's proportions allow, and one body per room translated to its offset when the whole home is on screen.
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
