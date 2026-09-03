# Verification checklist

## A. Automated
- `npm test` passes: engine, store, webmcp, plan, three suites.
- `npm run build` passes with no type errors.

## B. Dev panel (any browser, Ctrl+Shift+D)
Start on a fresh profile (a private window, or clear site data and reload), then run in order and confirm each result:
1. The first-run card sits over the plan: three numbered steps, three example prompts each with a **Copy** button, and **Load the demo studio** / **Start empty**. Click **Load the demo studio** → the card goes away and the studio loads. Reload → the card stays away.
2. `get_room` → 360×520 room, door on bottom, window facing 90, no items.
3. `get_catalog` `{"category":"bed"}` → eight beds, cheapest first, each with its `rooms` tags and its alternative `colors`.
4. `suggest_positions` `{"catalogId":"bed-queen-160","near":"window","count":3}` → three placements, best first, each with `x`, `y`, `rotation`, a `reason`, a `light` score and a `score`; every one is inside the room and clear of the door swing, and the room is unchanged.
5. `evaluate_layout` with a bed at (260,300) and a desk at (60,30) → budgetUsed 628, no violations, room unchanged.
6. `propose_layout` twice with different labels → two cards over the plan; hover each; Accept one → both cleared, furniture on plan and in 3D.
7. Select the bed by clicking it → `move_selected` appears in the panel list with "Queen bed" in its description; `find_alternatives_for_selected` → the other beds, the ones that fit first and cheapest within that; deselect → tools gone. `apply_proposal` and `withdraw_proposal` are always listed.
8. Snapping: `place_item` `{"catalogId":"desk-120","x":100,"y":42,"rotation":90}` → `snapped: true` and `wall: "top"`; the desk lands flush against the top wall, turned to face the room (rotation 0, center y 30), not at the y you asked for. Repeat with `{"x":180,"y":260,"rotation":90}` in open floor → `snapped: false` and the position you gave.
9. Drag a desk by hand to within a few centimeters of the left wall → the snap guide highlights that wall while you drag and the desk lands flush on release.
10. Issues panel: `place_item` a second `desk-120` at (150, 30) → the result carries an `overlap` violation and a `suggestion` naming the nearest clear position, and the **Issues** tab of the properties column gains a count badge and an "overlap" row. **Select** on that row selects the desk and switches the column to **Selection**.
11. `fix_item` `{"id":"<the second desk's id from get_room>"}` → `status: "applied"`, the overlap gone, the Issues row gone. Call `fix_item` again on the same id → `error: "already_clear"`. Create the overlap once more and press **Fix** in the Issues tab instead → same move, logged as a human action in the ledger. Lock the item and press **Fix** → the button is disabled with "Unlock the item to fix it".
12. 3D click-to-select: click a piece of furniture in the 3D view → it gets a selection outline and a floating label, the plan selects it too, the properties column switches to **Selection**, and the four selection-scoped tools appear in the panel.
13. Drag the bed against the right wall → red window zone; `move_item` back → clear.
14. `set_daylight_hour` `{"hour":9}` and `get_daylight` → desk light score > 0.5 when near the window; slider moves.
15. `set_item_locked` on the bed, then `move_item` on it → `error: "locked"`; unlock.
16. `set_brief` `{"budget":600}` → over_budget violation, and the budget reading on the status strip turns red. The Issues tab row for it offers **Select** only, since no move can fix a budget.
17. `set_camera` `{"preset":"from_door"}` → 3D camera moves; result lists items in view.
18. `undo_last_action` → ledger gains an "Undid" entry.
19. Toggle Propose first; `place_item` → `status: "proposed"`; Reject the card.
20. `add_catalog_item` for a lamp, then `place_item` with the returned id → appears with a "from agent" badge in the catalog.
21. `list_templates` → eight entries in the order living, kitchen, bedroom, hall, office, dining, kids, studio, each with a `key`, `name`, `blurb`, dimensions, item count and budget. The room is unchanged.
22. `load_template` `{"key":"bedroom"}` → a new room called "Bedroom", 340×420, nine items, switched to. The plan and the 3D view both rebuild; the old room is still in **My rooms**. `evaluate_layout` on it → no blocking violations and under its 1900 budget.
23. **My rooms → New room** → a **Ready-made rooms** grid sits above **Or size an empty one**: eight cards, each with an SVG thumbnail drawn from that template's own footprints, the name, the dimensions, the item count and the total price, with the blurb on hover. Click **Bedroom** → the room loads and the wizard closes.
24. Catalog drawer → a room filter row (**All rooms**, then living, kitchen, bedroom, hall, office, dining, kids, studio) sits above the category chips. Pick **kitchen** → counters, an island, a sink unit, appliances and stools, no beds. Switch to **bedroom** and add the **bed** category chip → both filters narrow the list together. `get_catalog` `{"room":"kids","category":"bed"}` → the single bed, the bunk bed and the two cribs, the same set the drawer shows.
25. Select the bed → the **Selection** tab grows a **Finish** row: one swatch per entry in the catalog item's `colors`, the current one ringed, then a **Default** chip. Click another swatch → the bed repaints in 2D and 3D and the ledger gains a human entry. **Default** clears the override. Select a plant, which has no `colors` → no Finish row at all.
26. `set_item_color` `{"id":"<the bed's id>","color":"#8b6f52"}` → the bed repaints; the Selection tab's swatch ring follows. Call it with `{"color":null}` → back to the catalog color. Call it with `{"color":"nope"}` → a validation error and no change.
27. `suggest_palette` → three schemes named warm, cool and neutral, each with a `wall` hex, a `floor` from oak/walnut/ash/grey/tile, three `accents` and a `recolor` list naming real item ids. The room is unchanged. Call it twice → identical output.
28. `set_finish` `{"wall":"#c3cdb9","floor":"walnut"}` → the 2D floor fill, the 3D walls and the plank hue all change together. `set_finish` `{"floor":"tile"}` → the floor becomes a square grid and the wall color stays sage.
29. **Style** at the foot of the tool rail → a popover with eight wall swatches, five floor buttons and the three suggested schemes with a blurb each. Click a wall swatch → the room repaints. Click **Apply** on a scheme → wall, floor and every recolor land as one ledger entry reading "Applied … palette"; one **Undo** takes all of it back.
30. Click **Shadows** in the 3D viewport's toolbar → the contact shadow goes, the scene still renders. Click the sun button in the plan's toolbar → the daylight wash leaves the drawing; click **Grid** → the grid goes. Reload → all three stay off.
31. Wheel over the plan → it zooms between 0.5x and 4x with every stroke weight unchanged; **Fit to view** in the plan's toolbar puts the whole room back.
32. Reload the page → the room is still there.

## C. Chrome with the flag
- Enable `chrome://flags/#enable-webmcp-testing`, restart, open the deployed URL.
- DevTools → Application → WebMCP panel lists 32 tools with nothing selected; selecting an item adds four and deselecting removes them.
- Invoke `get_room` from the panel and confirm the JSON.

## D. ChatGPT in-app browser
- Open the deployed URL in ChatGPT's browser. The agent chip turns green with 32 tools.
- Run the video script prompts below and confirm the plan updates live.

## E. Video script (under 3 minutes, with audio)

Record at 1440x900 or wider so the tool rail, both viewports and the properties column all fit.
Have ChatGPT's browser on the left and nothing else on screen. Prompts below are verbatim.

**0:00 — Open cold.** A fresh incognito window on the live URL. The onboarding card sits over the
plan: three numbered steps, three example prompts, **Load the demo studio** / **Start empty**.
Say: "Floorplay. A room you design with ChatGPT on the same plan."

**0:08 — Start from a real room.** Click **Ready-made rooms...** on the card. The wizard opens on
eight furnished templates, each with a thumbnail drawn from its own footprints. Click **Bedroom**.
The plan draws the bed, wardrobe, desk and nightstand; the 3D view fills in beside it. The
properties column is on the **Room** tab, showing the brief and the $1900 budget; the status strip
reads free floor, walkway, budget and issues. Say: "Eight rooms come furnished, so nobody starts on
an empty rectangle."

**0:22 — Switch to the studio.** **My rooms** in the top bar, pick the untouched first room, then
**Load the demo studio** on the card that returns. This is the Studio flat shell with the same
brief, $1200 and "sleep, work from home, host two friends", and no furniture yet.

**0:25 — Three options.** In ChatGPT, with the properties column on **Room** so the brief is
visible:

> Furnish this studio for my brief using suggest_positions. Give me three options.

Show the tool calls going by. Cards appear along the top of the plan, each with a thumbnail of its
ghosts over the current footprints, its label and its three biggest deltas. Hover each in turn: the
ghosts light up on the drawing and in 3D underneath. Click **Accept** on one. Furniture lands in
both views and the ledger line at the foot reads the accepted proposal.

**1:05 — Drag it somewhere the agent did not expect.** Drag the bed toward the window wall. The
snap guide highlights the wall while you drag, the bed lands flush, and a dashed marker with a
count appears where it now blocks something. Click the **Issues** tab so the row is on screen, then
in ChatGPT:

> I moved the bed. Make it work and keep the desk in morning light.

The desk moves, the marker clears, and the status strip's light reading climbs.

**1:35 — Budget.** Back to the **Room** tab. Type a lower budget in **Budget** and press
**Apply brief**. The budget reading turns red and an over-budget row joins the Issues tab. Then:

> I'm over budget. Find cheaper storage.

The agent swaps a piece; the budget reading goes black again.

**2:00 — What it can see.** Press the walk button in the 3D viewport's toolbar, then:

> What do I see from the door?

The camera walks to the doorway and the agent answers from the list of items the call returned,
not from a guess.

**2:20 — Style.** Click **Style** at the foot of the tool rail. The popover shows eight wall
colors, five floors and the three schemes read from what is already in the room. Click **Apply** on
**Warm**. Walls, floor and every recolored piece change together in 2D and 3D.

**2:35 — Undo anything.** Expand the ledger drawer at the bottom. Every entry is marked with who
did it, the person or the agent. Click **Revert** on one agent step; it comes straight back out of
both views. Close on the 3D view: switch back to orbit, drag the room round once, and end on the
tagline.
