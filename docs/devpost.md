# Floorplay — Devpost submission text

## Why the use case fits WebMCP

Furnishing a room is a spatial problem with hard constraints. A door has to swing, you have to reach the bed, a desk wants daylight, and the total has to fit a budget. A chatbot can talk about a layout but cannot see one; a planner app can draw one but cannot read your brief. WebMCP lets the page hand the room itself to the agent as tools, so it reads true state and gets back computed violations and metrics instead of guessing coordinates. Both parties work one live artifact.

## How it improves the experience

Floorplay is a designer's workspace, not a chat window with a picture in it. A tool rail runs down the left edge, and the plan is drawn like a drafting sheet: paper ground, a 10 cm grid, solid wall bands with doors and windows cut out of them, swing arcs, dimension lines, outlined furniture. Beside it a 3D viewport, where eleven CC0 Poly Haven models cover the pieces whose proportions fit and procedural shapes the rest, lit through the glass. Between the rail and the viewports, a properties column with Catalog, Room, Style, Selection, Issues and Buy tabs, so everything you press is down one edge and the drawing has the rest of the window. Along the bottom, a ledger drawer and a status strip of six readings: free floor, walkway, open area, budget, light and issues.

The agent's work lands in that workspace, in its visual language. Proposals arrive as floating cards over the plan, each with a thumbnail of its ghosts over the current footprints and its three biggest deltas. Hovering one previews it in both views. Violations draw as dashed markers on the sheet and rows in the Issues tab, each with a one-click Fix running the same operation as `fix_item`. Every action by either party appends a ledger entry carrying its inverse, so any step reverts.

The hardest moment in a planner is the empty rectangle, so the wizard opens on eight furnished rooms, from a kitchen to a studio flat, each with its own brief, budget and finish. A test asserts every one loads with no blocked door, nothing unreachable and nothing over budget, so the agent inherits a valid room and the conversation is refinement rather than construction.

**Connected rooms.** A room does not have to stand alone. Rooms are placed on a shared floor plan and snap edge to edge within 20 cm, never overlapping, and a doorway is cut through a wall two of them share — one record owning a matching opening in both rooms, so the door is there from either side and closing it takes both away. A Plan / Home toggle draws the whole flat on one sheet, where you drag rooms with live snap lines and click a shared wall to cut a door; the 3D view renders the same flat as one dollhouse, the walls between rooms always standing, and the walkthrough is clamped to the home so you walk out of the living room and into the bedroom. Two homes come ready made: a **One-bedroom flat** — hall, living room, bedroom and kitchen with all three doorways already cut — and **Studio and hall**, the starter studio with a proper entrance in front of it. Both build furnished from the room templates with no blocking violations, so a flat is walkable the moment it is made. Eight tools give the agent the same plan: read it, build one, add and move rooms, cut and close doorways.

## What people and agents can now do together

- Start from a furnished room, one click or one `load_template` call, then refine it.
- Ask for three layout options against a real brief, then compare them by hovering the cards.
- Drag the bed where the agent did not expect, then ask it to make the room work around that.
- Say "keep the sofa" and have the lock respected by every later tool call.
- Take a whole palette derived from what is already placed, walls, floor and recolors, in one undoable step.
- Ask what the room looks like from the door and get an answer from the real camera view.
- Paint the east wall aizome indigo from the Japan palette and hang a print on it at the height you actually want — by hand, or by asking the agent to read the wall first with `get_elevation`.
- Open a one-bedroom flat, ask for a doorway between the living room and the bedroom, and walk through it in 3D.
- Say "put a kitchen to the right of this room" and have the plan start itself around the room you are already in.

## Implementation

A Vite, React and TypeScript single-page app with no backend. A pure engine computes footprints, overlaps, door and window conflicts, clearances, a 10 cm occupancy grid for reachability and walkway width, a daylight model with line of sight, the templates, a palette deriver, twenty-two named finishes, and invertible operations for the ledger. On top of that sits the shared floor plan: which walls two rooms really share, the 20 cm snap that makes them share one, the pair of openings a doorway builds in both rooms at once, and reachability from the front door. The catalog holds 139 items in twenty categories, sixty-three with alternative colors.

The WebMCP layer registers 60 static tools plus four scoped to the current selection, using abort-signal registration so the tool list follows page state. The surface is deliberately complete: every room, item, style and view control a person can reach, the agent can reach too, so it never has to ask the user to click something. Placement quality comes from mechanism, not prompting. `suggest_positions` ranks real candidate positions against walls, door swing, window and daylight, returning each with a reason and a score. `place_item` and `move_item` snap within 15 cm of a wall, turn wall furniture to face the room and report `snapped: true`. `fix_item` moves an item to the nearest position clearing its violations. `run_layout_script` runs agent-written search code in a sandboxed Web Worker. `cut_doorway` writes an opening and a ledger entry in each of the two rooms it joins and hands back both, because one hole in a wall is two edits in two histories. The Buy tab reads the room back as a shopping list grouped by catalog id, and `get_shopping_list` hands the agent every line with a ready-made search query while `set_purchase_status` writes the shop and the link back: the app plans the buyout; the agent finds the sources. Read-only tools carry the read-only hint, text-returning tools the untrusted-content hint. Every mutating tool returns violations, metrics, and the nearest clear position on failure. `apply_layout` and `apply_palette` land a whole idea as one ledger entry, `revert_to_entry` rewinds to any point in it, and `get_guide` hands a first-time agent the order of calls and the coordinate conventions. Rooms persist in the browser only.

Repository: https://github.com/alijon30/floorplay. Live: https://floorplay-zeta.vercel.app. Video: (YouTube URL).
