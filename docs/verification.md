# Verification checklist

## A. Automated
- `npm test` passes: 305 tests across the engine, store, webmcp, plan and three suites.
- `npm run build` passes with no type errors.
- `npm run smoke -- <outDir>` boots Vite, drives the app with Playwright and writes 49 numbered
  screenshots plus `contact-sheet.png`. It exits non-zero on a page error or a failed assertion and
  prints a JSON summary; check that summary for `consoleErrors: []`, `pageErrors: []` and a static
  tool count of 59.
  - Steps 1–31, screenshots `01`–`42` and the contact sheet, cover one room: the onboarding card,
    two proposals and accepting one, the wall snap, the Issues tab and `fix_item`, the daylight
    sweep, the catalog filters, 3D click-to-select, the camera presets, the dev panel, the eight
    room templates and the wizard, the three suggested palettes and the Style tab, per-wall paint
    and a hung print read back through `get_elevation`, the shadow and daylight toggles, the room
    panel, the ledger, the Buy tab, and one of every glTF model in a single room.
  - Steps 32–39, screenshots `43-home-plan`, `44-home-doorway-cut`, `45-home-doorway-removed`,
    `46-room-tab-home`, `47-homes-menu`, `48-home-3d` and `49-home-walk`, cover the home: build the
    one-bedroom flat from the wizard and assert `get_home` reads four rooms and three doorways;
    nudge the kitchen 12 cm and assert the 20 cm snap puts it back at `x: 650` with all three
    doorways still standing; cut a fourth hall → living door at offset 250 by clicking the shared
    wall; take it out again with its ×; photograph the Room tab's HOME section and the My homes
    menu; then the whole flat in 3D, and a walkthrough pose square on to the living → bedroom
    doorway, worked out in the living room's own coordinates.

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
22. `load_template` `{"key":"bedroom"}` → a new room called "Bedroom", 340×420, nine items, switched to. The plan and the 3D view both rebuild; the old room is still in **My homes**. `evaluate_layout` on it → no blocking violations and under its 1900 budget.
23. **My homes → New room** → a dialog headed **New room or home**: a **Ready-made homes** grid of two cards, then a **Ready-made rooms** grid of eight, each with an SVG thumbnail drawn from that template's own footprints, the name, the dimensions, the item count and the total price, with the blurb on hover, and **Or size an empty one** below them. Click **Bedroom** → the room loads and the wizard closes.
24. Catalog drawer → a room filter row (**All rooms**, then living, kitchen, bedroom, hall, office, dining, kids, studio) sits above the category chips. Pick **kitchen** → counters, an island, a sink unit, appliances and stools, no beds. Switch to **bedroom** and add the **bed** category chip → both filters narrow the list together. `get_catalog` `{"room":"kids","category":"bed"}` → the single bed, the bunk bed and the two cribs, the same set the drawer shows.
25. Select the bed → the **Selection** tab grows a **Finish** row: one swatch per entry in the catalog item's `colors`, the current one ringed, then a **Default** chip. Click another swatch → the bed repaints in 2D and 3D and the ledger gains a human entry. **Default** clears the override. Select a plant, which has no `colors` → no Finish row at all.
26. `set_item_color` `{"id":"<the bed's id>","color":"#8b6f52"}` → the bed repaints; the Selection tab's swatch ring follows. Call it with `{"color":null}` → back to the catalog color. Call it with `{"color":"nope"}` → a validation error and no change.
27. `suggest_palette` → three schemes named warm, cool and neutral, each with a `wall` hex, a `floor` from oak/walnut/ash/grey/tile, three `accents` and a `recolor` list naming real item ids. The room is unchanged. Call it twice → identical output.
28. `set_finish` `{"wall":"#c3cdb9","floor":"walnut"}` → the 2D floor fill, the 3D walls and the plank hue all change together. `set_finish` `{"floor":"tile"}` → the floor becomes a square grid and the wall color stays sage.
29. **Style** at the foot of the tool rail → the properties column turns to its **Style** tab: a mini plan of the room whose four walls carry their own paint, an **All walls** chip, the eleven regional palettes as cards with their six named swatches under them, five floor tiles drawn as plank and tile patterns, and the three suggested schemes with a blurb each. Click a wall in the mini plan → "Painting: east wall", and the next swatch paints only that one. Click **All walls**, then a swatch → the whole room repaints and the per-wall overrides clear. Click **Apply** on a scheme → wall, floor and every recolor land as one ledger entry reading "Applied … palette"; one **Undo** takes all of it back.
30. Click **Shadows** in the 3D viewport's toolbar → the contact shadow goes, the scene still renders. Click the sun button in the plan's toolbar → the daylight wash leaves the drawing; click **Grid** → the grid goes. Reload → all three stay off.
31. Wheel over the plan → it zooms between 0.5x and 4x with every stroke weight unchanged; **Fit to view** in the plan's toolbar puts the whole room back.
32. Reload the page → the room is still there.
33. `list_rooms` → one row per room with its dimensions and item count, the one you are in flagged `current: true`. `get_guide` → a six-step workflow, the coordinate conventions and the tips, and the room unchanged.
34. `create_room` `{"name":"Loft","width":400,"depth":500,"height":260}` → a new empty room, switched to, with the old one still in **My homes**. `switch_room` back to it by the id `list_rooms` gave → the plan and the 3D view rebuild with the furniture you left there. `rename_room` `{"name":"Guest room"}` → the name in the top bar changes. `delete_room` on the loft → it goes from **My homes**; `delete_room` on the last remaining room → `error: "last_room"`.
35. `apply_layout` with a move, a remove and a place in one call → all three land and the ledger gains **one** entry reading "Applied layout (3 changes)"; a single **Undo** takes all of it back.
36. `apply_palette` `{"name":"cool"}` → the same result as pressing **Apply** on the cool scheme in the **Style** tab: wall, floor and every recolor as one ledger entry.
37. `clear_items` → the room empties in one entry. Lock an item first and call it again → the locked piece stays and the summary counts only what went; on an all-locked room → `error: "nothing_to_clear"`.
38. `revert_to_entry` with an id from `get_ledger` → everything recorded after it is undone in one go and the rewind is itself logged. Call it with the newest entry's id → `error: "nothing_to_revert"`.
39. `select_item` `{"id":"<a bed id>"}` → the bed gets its selection outline in both views, the properties column switches to **Selection**, and the four selection-scoped tools appear. `select_item` `{"id":null}` → the selection clears.
40. `set_view` `{"showDaylight":false,"showShadows":false}` → the daylight wash leaves the plan and the contact shadow leaves the 3D view, the same as pressing the sun button and **Shadows** by hand. Reload → both stay off.
41. `get_shopping_list` → one line per catalog id rather than per placement, so two identical chairs read `qty: 2` with a doubled line total, plus a `searchQuery` per line and the room's brief. Open the **Buy** tab: the same list, each row a status select and a read-only **Source** reading _Not sourced yet_ over the `agent query:` that will be searched, plus a footer weighing what is still to buy against the budget — no store or link to fill in, because that is the agent's half. `set_purchase_status` `{"catalogId":"<one from the list>","status":"ordered","source":"IKEA","url":"https://example.com/listing"}` → every copy of that piece turns Ordered, its Source row now reads **IKEA** with an **Open** link to the listing, the still-to-buy total drops by its line total, and the ledger gains **one** entry that a single **Undo** takes back. **Source with your agent** copies a ready brief naming every unsourced line and its query; **edit** on a row still reveals the store and link fields for something bought in person; **Copy list** puts the whole list on the clipboard as plain text.
42. `get_home` on a room that stands on no plan → `home: null` and a hint naming `create_home` and `add_room_to_home`. `list_home_templates` → two entries, `one-bedroom` and `studio-hall`, each with a name, a blurb, its rooms with their offsets and sizes on the shared plan, and how many doorways come already cut. Nothing changes.
43. `create_home` `{"template":"one-bedroom"}` → a plan called **One-bedroom flat** with four furnished rooms — Entrance hall at (0,0) 200×420, Living room at (200,0) 450×550, Bedroom at (200,550) 340×420, Kitchen at (650,0) 380×420 — three doorways, `entranceRoomId` the hall, `unreachable: []`, and the app switched to the hall. The plan viewport turns to **Home** and the status strip reads `HOME One-bedroom flat · ROOMS 4 · AREA 63.39 m² · ITEMS 38 · BUDGET $6994 / $8200 · REACHABLE all rooms`. `evaluate_layout` in each of the four rooms → no blocking violations.
44. Home view: every room drawn at its offset, the current one in an accent outline and the others dimmed, each named with its size under it. Click the bedroom → it becomes current, and the Plan view, the 3D view and the properties column all follow. Drag the kitchen about 10 cm off the wall it shares and let go → accent snap lines mark the edges it meets while you drag, and the 20 cm snap puts it back at `x: 650`; `get_home` still reads three doorways. Drag it over the living room → it draws red, the drop is refused, and the note names what it overlapped.
45. `move_room` `{"roomId":"<kitchen>","x":900,"y":0}` → applied, with a warning and `removedDoorways` naming the living → kitchen passage, which is gone from both rooms. `move_room` back to `{"x":650,"y":0}` → applied with `removedDoorways: []`, and `cut_doorway` `{"roomId":"<living>","wall":"right","offset":95,"kind":"passage"}` puts it back. `move_room` onto another room → `error: "overlap"`, with the room it ran into named and an offset that would work instead.
46. **Cut doorway** in the Home toolbar → a hint line appears and every wall two rooms share glows as the cursor passes over it. Click the hall/living wall low down → an 80 cm door is cut centred on the click and clamped inside the shared stretch, drawn in both rooms, and each room's ledger gains a "Cut doorway to …" entry. Hover that doorway → a × appears; click it → the opening leaves both rooms. Click a wall with no room behind it → nothing is cut.
47. `cut_doorway` `{"roomId":"<hall>","wall":"right","offset":250}` → a doorway of `width: 80`, `kind: "door"`, both sides named with the offset in their own room's coordinates, and `ledgerEntries` carrying one entry per room. Call it on a wall that room does not share, `{"roomId":"<hall>","wall":"left","offset":50}` → `invalid_input`, with `sharedWalls` listing the walls it really shares, the neighbour on each and the span. `remove_doorway` with the id from `get_home` → the opening leaves both rooms, one ledger entry each.
48. **Room** tab → a **HOME** section at the top: the home's name in an editable field, the four rooms with the current one marked and clickable, the doorways each with a remove control, and **Add room…**, **Cut doorway**, **Set as entrance** and **Remove from home**. **Add room…** offers the rooms standing on no plan, then the eight room templates. **My homes** in the top bar lists the home with its rooms nested under it, then **Standalone rooms**, then **New home** and **New room**. Delete the home → its rooms survive in the standalone list, with the doorway openings stripped out of them.
49. 3D in Home view → the whole flat as one dollhouse: four rooms at their offsets, one sun over the plan, the outer walls facing the camera cut away and the walls between rooms always standing, with the doorways cut through both sides. `switch_room` to the living room and `set_camera` `{"preset":"from_door"}` → the pose comes back in the living room's own coordinates and the camera stands at the matching place on the shared plan. Walk with WASD through the living → bedroom doorway: the walk is clamped to the whole home, not to one room.
50. `switch_room` to a room on no plan, then `add_room_to_home` `{"templateKey":"kitchen","x":400,"y":0}` → a plan named "<room> home" is started, the current room is stood at the origin, a furnished kitchen is built and placed, and `createdHome` names the new plan. Call it for a room already on a plan → `error: "conflict"` naming the home it is on. `remove_room_from_home` → the room leaves the plan with its furniture intact, and `doorwaysRemoved` names what went with it.

## C. Chrome with the flag
- Enable `chrome://flags/#enable-webmcp-testing`, restart, open the deployed URL.
- DevTools → Application → WebMCP panel lists 59 tools with nothing selected; selecting an item adds four and deselecting removes them.
- Invoke `get_room` from the panel and confirm the JSON.

## D. ChatGPT in-app browser
- Open the deployed URL in ChatGPT's browser. The agent chip turns green with 59 tools.
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

**0:22 — Switch to the studio.** **My homes** in the top bar, pick the untouched first room, then
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

**1:30 — Budget.** Back to the **Room** tab. Type a lower budget in **Budget** and press
**Apply brief**. The budget reading turns red and an over-budget row joins the Issues tab. Then:

> I'm over budget. Find cheaper storage.

The agent swaps a piece; the budget reading goes black again.

**1:50 — What it can see.** Press the walk button in the 3D viewport's toolbar, then:

> What do I see from the door?

The camera walks to the doorway and the agent answers from the list of items the call returned,
not from a guess.

**2:08 — A whole flat.** **My homes** in the top bar, **New room**, then **One-bedroom flat** under
**Ready-made homes**. The plan turns to **Home** and draws four furnished rooms edge to edge on one
sheet — hall, living room, bedroom and kitchen — with their doorways already cut, and the status
strip reads the home rather than the room: rooms, area, items, budget and that every room is
reachable. In the **Room** tab's **HOME** section, press the × beside the Living room → Bedroom
doorway: the opening closes in both rooms at once. Then in ChatGPT:

> Cut a doorway between the living room and the bedroom and walk me through it.

`get_home`, then `cut_doorway`. The door is back in both rooms on the plan, and the 3D view walks
out of the living room, through the new opening, and into the bedroom.

**2:28 — Style.** Click **Style** at the foot of the tool rail. The column turns to its Style tab:
a mini plan of the room, the regional palettes, five floors and the three schemes read from what is
already in the room. Click **Apply** on **Warm**. Walls, floor and every recolored piece change
together in 2D and 3D.

**2:40 — Undo anything.** Expand the ledger drawer at the bottom. Every entry is marked with who
did it, the person or the agent. Click **Revert** on one agent step; it comes straight back out of
both views. Close on the 3D view: switch back to orbit, drag the whole flat round once, and end on
the tagline.
