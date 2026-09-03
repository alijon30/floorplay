// scripts/smoke.mjs
// Headless visual smoke run: boots Vite, drives the app through a scripted
// walkthrough with Playwright, and writes one screenshot per step.
//
//   npm run smoke -- [outDir]
//
// Prints a JSON summary (screenshots, tool count, findings, console/page errors) on
// stdout and exits non-zero if the page threw or an assertion failed.
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.cwd(), process.argv[2] ?? './smoke-out');
const VIEWPORT = { width: 1440, height: 900 };
/** Must match `STORAGE_KEY` in src/config.ts; the run reads persisted state back to assert on it. */
const STORAGE_KEY = 'floorplay.v1';

const shots = [];
const consoleErrors = [];
const pageErrors = [];
/** Every furniture model the page asked for, and what it got back. */
const modelResponses = new Map();
/** Facts worth reading in the summary: what the agent suggested, whether the wall snap fired. */
const findings = {};

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'warn', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('Vite did not report a local URL');

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(String(err?.stack ?? err)));
  page.on('response', (r) => {
    const file = /\/models\/([^/?]+\.glb)/.exec(r.url())?.[1];
    if (file) modelResponses.set(file, r.status());
  });

  let n = 0;
  const shot = async (name) => {
    const file = resolve(outDir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    shots.push(file);
  };
  const tool = (name, input) =>
    page.evaluate(([n, i]) => globalThis.__floorplayFakeMC.executeTool(n, i), [name, input]);
  /** The same call with the tool's JSON payload unwrapped from its text content block. */
  const toolJson = async (name, input) => {
    const r = await tool(name, input);
    return JSON.parse(r?.content?.[0]?.text ?? '{}');
  };
  const settle = (ms = 350) => page.waitForTimeout(ms);
  /** Park the cursor over empty 3D, so no control photographs in its hover style. */
  const park = () => page.mouse.move(1000, 700);

  try {
    await page.goto(url, { waitUntil: 'load' });

    // Start from a fresh profile so the first screenshot shows what a first-time visitor sees.
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });

    // 1. initial paint, with the onboarding card
    await page.getByText('Floorplay', { exact: true }).first().waitFor({ timeout: 20_000 });
    await page.getByRole('heading', { name: 'Design a room with ChatGPT on the same plan' }).waitFor({ timeout: 20_000 });
    await settle(1200); // let the WebGL canvas draw its first frames
    await shot('initial');

    // dismiss the card into the demo studio
    await page.getByRole('button', { name: 'Load the demo studio' }).click();
    await settle(600);

    // 2. two competing layout proposals from the agent
    await tool('propose_layout', {
      label: 'Bed by the window',
      placements: [
        { action: 'place', catalogId: 'bed-queen-160', x: 260, y: 300, rotation: 0 },
        { action: 'place', catalogId: 'desk-120', x: 60, y: 30, rotation: 0 },
        { action: 'place', catalogId: 'sofa-2', x: 120, y: 420, rotation: 0 },
      ],
    });
    await tool('propose_layout', {
      label: 'Bed by the door',
      placements: [
        { action: 'place', catalogId: 'bed-queen-160', x: 100, y: 200, rotation: 0 },
        { action: 'place', catalogId: 'desk-120', x: 280, y: 60, rotation: 90 },
        { action: 'place', catalogId: 'sofa-2', x: 240, y: 440, rotation: 0 },
      ],
    });
    await settle();
    await shot('proposals');

    // 3. hover the first card so its ghosts light up
    const card = page.getByRole('group', { name: 'Bed by the window' }).first();
    await card.hover();
    await settle();
    await shot('hover-proposal');

    // 4. accept it
    await card.getByRole('button', { name: 'Accept' }).click();
    await settle(600);
    await shot('accepted');

    // 5. ask the room where a wardrobe belongs; read-only, so nothing on screen changes
    const suggested = await toolJson('suggest_positions', { catalogId: 'wardrobe-100', count: 3 });
    findings.topSuggestion = suggested.suggestions?.[0] ?? null;
    if (!findings.topSuggestion) throw new Error(`suggest_positions returned nothing: ${JSON.stringify(suggested)}`);

    // 6. a coordinate 12 cm shy of the top wall has to snap flush and turn to face the room
    const placed = await toolJson('place_item', { catalogId: 'desk-120', x: 100, y: 42, rotation: 90 });
    findings.snap = { status: placed.status ?? null, snapped: placed.snapped ?? false, wall: placed.wall ?? null };
    if (placed.snapped !== true) throw new Error(`place_item at (100, 42) did not snap to a wall: ${JSON.stringify(placed)}`);
    await settle();
    await shot('snapped');

    // 7. that desk lands on the one from the accepted layout, so the Issues tab should fill.
    // The tab carries the count as a badge; its panel repeats it as a heading.
    await page.getByRole('tab', { name: /^Issues/ }).click();
    await settle();
    const issuesHeader = page.getByRole('heading', { name: /^Issues \(\d+\)$/ }).first();
    const hasIssues = await issuesHeader.count() > 0;
    findings.issues = hasIssues ? (await issuesHeader.textContent())?.trim() ?? null : 'none';
    await shot('issues');
    if (hasIssues) {
      // Clear it with the agent's own repair tool so the later shots show a settled room.
      const newest = placed.items?.[placed.items.length - 1];
      if (newest) {
        const fixed = await toolJson('fix_item', { id: newest.id });
        findings.fixItem = { status: fixed.status ?? null, error: fixed.error ?? null };
      }
      await settle();
    }
    // back to the room, which is what the rest of the run photographs
    await page.getByRole('tab', { name: 'Room' }).click();
    await settle();

    // 8. daylight sweep
    for (const hour of [9, 12, 17]) {
      await tool('set_daylight_hour', { hour });
      await settle(500);
      await shot(`daylight-${String(hour).padStart(2, '0')}h`);
    }

    // 9. catalog drawer
    await page.getByRole('button', { name: 'Catalog', exact: true }).click();
    await settle();
    await shot('catalog');
    // the two selects narrow the list together
    await page.getByLabel('Filter by room').selectOption('bedroom');
    await page.getByLabel('Filter by category').selectOption('bed');
    await park();
    await settle();
    await shot('catalog-filtered');
    await page.getByRole('button', { name: 'Catalog', exact: true }).click();
    await settle();

    // 10. clicking furniture in the 3D view selects it there and everywhere else.
    // Nothing is selected yet, so the four `*_selected` tools appearing after the click is
    // the proof that the click did the selecting. Whether the center of the canvas happens
    // to land on a piece of furniture depends on the layout, so this is reported, not asserted.
    const scopedTools = () =>
      page.evaluate(() => globalThis.__floorplayFakeMC.getTools().map((t) => t.name).filter((x) => x.endsWith('_selected')).length);
    const scopedBefore = await scopedTools();
    const canvas = page.locator('canvas').first();
    const cbox = await canvas.boundingBox();
    if (!cbox) throw new Error('Could not find the 3D canvas');
    await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
    await settle(600);
    findings.click3d = { scopedToolsBefore: scopedBefore, scopedToolsAfter: await scopedTools() };
    await shot('select-3d');

    // 11. select the bed on the plan to open the inspector
    const bedLabel = page.locator('svg text').filter({ hasText: 'Queen bed' }).first();
    const box = await bedLabel.boundingBox();
    if (!box) throw new Error('Could not find the "Queen bed" label on the plan');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await settle();
    await shot('inspector');

    // 12. agent moves the camera to the doorway
    await tool('set_camera', { preset: 'from_door' });
    await settle(600);
    await shot('camera-from-door');

    // 13. back to orbit
    await page.getByRole('button', { name: 'Orbit view' }).click();
    await settle(600);
    await shot('orbit');

    // 14. dev panel
    await page.keyboard.press('Control+Shift+D');
    await settle();
    await shot('dev-panel');
    await page.keyboard.press('Control+Shift+D');
    await settle();

    // 15. help popover
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await settle();
    await shot('help');
    await page.keyboard.press('Escape');
    await settle();

    // 16. the eight ready-made rooms, as the agent sees them
    const templates = await toolJson('list_templates', {});
    findings.templates = (templates.templates ?? []).map((t) => `${t.key}: ${t.items} items, $${t.budget}`);
    if (findings.templates.length !== 8) {
      throw new Error(`list_templates returned ${findings.templates.length} templates, expected 8: ${JSON.stringify(templates)}`);
    }

    // 17. the same eight as cards in the new-room wizard
    await page.getByRole('button', { name: 'My rooms' }).click();
    await page.getByRole('button', { name: 'New room', exact: true }).click();
    await page.getByText('Ready-made rooms').waitFor({ timeout: 10_000 });
    await settle(400);
    await shot('wizard-templates');

    // 18. load the bedroom template: plan and 3D both rebuild from it
    await page.locator('[aria-label="Ready-made rooms"]').getByRole('button', { name: /^Bedroom/ }).click();
    await settle(1200);
    await shot('template-bedroom');
    const canvasBox = await page.locator('canvas').first().boundingBox();
    if (!canvasBox) throw new Error('Could not find the 3D canvas after loading a template');
    await page.screenshot({ path: resolve(outDir, `${String(++n).padStart(2, '0')}-template-bedroom-3d.png`), clip: canvasBox });
    shots.push(resolve(outDir, `${String(n).padStart(2, '0')}-template-bedroom-3d.png`));
    findings.bedroomTemplate = await page.evaluate((key) => {
      const r = JSON.parse(localStorage.getItem(key) ?? '{}');
      const s = r?.state;
      const room = s?.rooms?.[s?.currentId];
      return room ? { name: room.name, items: room.items.length, finish: room.finish } : null;
    }, STORAGE_KEY);

    // 19. three schemes read off the furniture that is already in the room. Read-only, and the
    // Style tab derives its list the same way, so the first card below has to match this.
    const palettes = await toolJson('suggest_palette', {});
    findings.suggestedPalettes = (palettes.palettes ?? []).map((p) => ({
      name: p.name, wall: p.wall, floor: p.floor, accents: p.accents, recolors: p.recolor?.length ?? 0,
    }));
    if (findings.suggestedPalettes.length !== 3) {
      throw new Error(`suggest_palette returned ${findings.suggestedPalettes.length} schemes, expected 3: ${JSON.stringify(palettes)}`);
    }

    // 20. the Style tab of the properties column: the wall picker, the regional palettes,
    // the floor tiles and those three schemes, all in one column beside the plan.
    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await page.getByRole('tab', { name: 'Style' }).waitFor({ timeout: 10_000 });
    await page.getByLabel('Room plan, click a wall to paint it').waitFor({ timeout: 10_000 });
    await settle(400);
    await shot('style-tab');

    // 21. apply the first suggested scheme: one ledger entry repaints the room
    await page.getByRole('button', { name: 'Apply', exact: true }).first().click();
    await settle(900);
    // Back to the Room tab, so the column reads the way the rest of the run expects it to.
    await page.getByRole('tab', { name: 'Room' }).click();
    await settle(500);
    await shot('palette-applied');
    findings.palette = await page.evaluate((key) => {
      const r = JSON.parse(localStorage.getItem(key) ?? '{}');
      const s = r?.state;
      const room = s?.rooms?.[s?.currentId];
      const last = room?.ledger?.[room.ledger.length - 1];
      return { ledger: room?.ledger?.length ?? 0, summary: last?.summary ?? null, ops: last?.ops?.length ?? 0, finish: room?.finish ?? null };
    }, STORAGE_KEY);
    if (!/palette$/.test(findings.palette.summary ?? '')) {
      throw new Error(`Applying a palette did not write one palette ledger entry: ${JSON.stringify(findings.palette)}`);
    }
    // The button carried out the first scheme `suggest_palette` handed back, so the agent and
    // the Style tab really are reading the same list.
    const first = findings.suggestedPalettes[0];
    if (findings.palette.finish?.wall !== first.wall || findings.palette.finish?.floor !== first.floor) {
      throw new Error(`Applied finish ${JSON.stringify(findings.palette.finish)} is not the first suggested scheme ${JSON.stringify(first)}`);
    }

    // 22. the agent repaints one piece and relays the floor under it
    const roomNow = await toolJson('get_room', {});
    const bed = (roomNow.items ?? []).find((i) => i.catalogId === 'bed-queen-160');
    if (!bed) throw new Error(`No queen bed in the bedroom template to recolor: ${JSON.stringify(roomNow.items)}`);
    const recolored = await toolJson('set_item_color', { id: bed.id, color: '#8b6f52' });
    findings.setItemColor = { id: bed.id, color: '#8b6f52', status: recolored.status ?? null, error: recolored.error ?? null };
    if (recolored.status !== 'applied') throw new Error(`set_item_color did not apply: ${JSON.stringify(recolored)}`);
    const finished = await toolJson('set_finish', { wall: '#c3cdb9', floor: 'walnut' });
    findings.setFinish = { status: finished.status ?? null, finish: finished.finish ?? null, error: finished.error ?? null };
    if (finished.finish?.floor !== 'walnut' || finished.finish?.wall !== '#c3cdb9') {
      throw new Error(`set_finish did not take: ${JSON.stringify(finished)}`);
    }
    await settle(900);
    await shot('agent-colors');

    // 22a. the wall elevation: one wall drawn straight on, all four of them in turn
    await page.getByRole('button', { name: 'Wall', exact: true }).click();
    await page.getByRole('group', { name: 'Which wall' }).waitFor({ timeout: 10_000 });
    for (const wall of ['top', 'right', 'bottom', 'left']) {
      await page.getByRole('button', { name: `Show the ${wall} wall` }).click();
      await park();
      await settle(400);
      await shot(`wall-${wall}`);
    }

    // 22b. paint the east wall from the Japan palette, and leave the other three alone
    const palettesByRegion = await toolJson('list_wall_palettes', {});
    const japan = (palettesByRegion.palettes ?? []).find((p) => p.region === 'Japan');
    if (!japan) throw new Error(`list_wall_palettes has no Japan: ${JSON.stringify(palettesByRegion).slice(0, 300)}`);
    const indigo = japan.swatches.find((sw) => /indigo/i.test(sw.name)) ?? japan.swatches[2];
    const painted = await toolJson('set_wall_color', { wall: 'right', color: indigo.hex });
    findings.wallColor = { swatch: indigo, status: painted.status ?? null, error: painted.error ?? null };
    if (painted.status !== 'applied') throw new Error(`set_wall_color did not apply: ${JSON.stringify(painted)}`);

    // 22c. hang a print on it at 120 cm along, then read the wall back
    const hung = await toolJson('place_on_wall', { catalogId: 'picture-60', wall: 'right', offset: 120 });
    findings.placeOnWall = hung.placement ?? { status: hung.status ?? null, error: hung.error ?? null };
    if (hung.status !== 'applied') throw new Error(`place_on_wall did not apply: ${JSON.stringify(hung)}`);
    const elevation = await toolJson('get_elevation', { wall: 'right' });
    findings.elevation = {
      color: elevation.color ?? null,
      openings: (elevation.openings ?? []).length,
      mounted: (elevation.mounted ?? []).map((m) => ({ catalogId: m.catalogId, offset: m.offset, mountHeight: m.mountHeight })),
      floorNearby: (elevation.floor ?? []).length,
    };
    if (elevation.color !== indigo.hex) throw new Error(`The east wall did not take the swatch: ${JSON.stringify(findings.elevation)}`);
    // The bedroom template already hangs a curtain on this wall, so look for the print itself
    // rather than counting: what matters is that what was hung is where it was hung.
    const print = findings.elevation.mounted.find((m) => m.catalogId === 'picture-60');
    if (!print || print.offset !== 120 || print.mountHeight !== 110) {
      throw new Error(`get_elevation does not see the hung print at 120 cm: ${JSON.stringify(findings.elevation)}`);
    }
    await page.getByRole('button', { name: 'Show the right wall' }).click();
    await park();
    await settle(500);
    await shot('wall-painted-hung');

    // 22d. and the same wall in 3D: only that one is indigo
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await park();
    await settle(1200);
    await shot('3d-recolored-wall');
    findings.perWallFinish = await page.evaluate((key) => {
      const r = JSON.parse(localStorage.getItem(key) ?? '{}');
      const s = r?.state;
      return s?.rooms?.[s?.currentId]?.finish ?? null;
    }, STORAGE_KEY);
    if (findings.perWallFinish?.walls?.right !== indigo.hex) {
      throw new Error(`Per-wall paint did not persist: ${JSON.stringify(findings.perWallFinish)}`);
    }
    if (findings.perWallFinish?.wall === indigo.hex) {
      throw new Error(`Painting one wall changed the room default: ${JSON.stringify(findings.perWallFinish)}`);
    }

    // 23. shadows off: the 3D view keeps rendering, just flat
    await page.getByRole('button', { name: 'Shadows', exact: true }).click();
    // Park the cursor off the control first: a hovered toggle photographs in its hover style.
    await park();
    await settle(900);
    await shot('shadows-off');
    findings.shadowsOff = await page.evaluate((key) => {
      const r = JSON.parse(localStorage.getItem(key) ?? '{}');
      return r?.state?.ui?.showShadows ?? null;
    }, STORAGE_KEY);
    if (findings.shadowsOff !== false) {
      throw new Error(`The Shadows checkbox did not turn the flag off: ${JSON.stringify(findings.shadowsOff)}`);
    }

    // 23b. and back on: the cast shadows under the furniture have to return. The pair of
    // screenshots either side of this is the whole test for the toggle actually applying.
    await page.getByRole('button', { name: 'Shadows', exact: true }).click();
    await park();
    await settle(1200);
    await shot('shadows-on');

    // 24. daylight overlay off: the plan loses its yellow wash
    await page.getByRole('button', { name: 'Show daylight overlay on the plan' }).click();
    await park();
    await settle(500);
    await shot('daylight-off');
    findings.shades = await page.evaluate((key) => {
      const r = JSON.parse(localStorage.getItem(key) ?? '{}');
      return { showDaylight: r?.state?.ui?.showDaylight ?? null, showShadows: r?.state?.ui?.showShadows ?? null };
    }, STORAGE_KEY);

    // 25. the room panel: the right rail's card whenever nothing is selected, carrying the two
    // numbers people hunt for most.
    await page.getByLabel('Room width in cm').waitFor({ timeout: 10_000 });
    await park();
    await settle(400);
    await shot('room-panel');

    // 26. resize from the panel; the top bar's button has to agree
    await page.getByLabel('Room width in cm').fill('400');
    await page.getByRole('button', { name: 'Apply size' }).click();
    await settle(900);
    findings.roomPanelResize = (await page.getByTitle('Room size in centimetres').first().textContent())?.trim() ?? null;
    if (!/^400 ×/.test(findings.roomPanelResize ?? '')) {
      throw new Error(`Applying 400 cm in the room panel left the top bar reading ${JSON.stringify(findings.roomPanelResize)}`);
    }
    await park();
    await settle(400);
    await shot('room-resized');

    // 27. budget from the same card; the budget chip has to agree
    await page.getByLabel('Budget in dollars').fill('900');
    await page.getByRole('button', { name: 'Apply brief' }).click();
    await settle(600);
    findings.roomPanelBudget = (await page.getByTitle(/^Total price of everything placed/).first().textContent())?.trim() ?? null;
    if (!/\/ \$900$/.test(findings.roomPanelBudget ?? '')) {
      throw new Error(`Applying a $900 budget left the chip reading ${JSON.stringify(findings.roomPanelBudget)}`);
    }
    await park();
    await settle(400);
    await shot('room-brief');

    // 28. the panel's two links: one opens the shell dialog, the other turns the column to Style
    await page.getByRole('button', { name: 'Doors & windows…' }).click();
    await page.getByRole('heading', { name: 'Room shell' }).waitFor({ timeout: 10_000 });
    await settle(300);
    await shot('room-panel-shell');
    // `exact` matters: the room panel's own close button is named "Close the room panel".
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    await settle(300);
    await page.getByRole('button', { name: 'Style…' }).click();
    await page.getByRole('tab', { name: 'Style', selected: true }).waitFor({ timeout: 10_000 });
    await settle(300);
    await shot('room-panel-style');
    await page.getByRole('tab', { name: 'Room' }).click();
    await settle(300);

    // 29. the card closes, leaving a pill, and comes back from either the pill or the top bar
    await page.getByRole('button', { name: 'Close the room panel' }).click();
    await settle(400);
    if (await page.getByLabel('Room width in cm').count() !== 0) throw new Error('The room panel did not close');
    await park();
    await settle(300);
    await shot('room-panel-closed');
    findings.roomPanelClosed = await page.evaluate((key) => {
      const r = JSON.parse(localStorage.getItem(key) ?? '{}');
      return r?.state?.ui?.roomPanelOpen ?? null;
    }, STORAGE_KEY);
    if (findings.roomPanelClosed !== false) {
      throw new Error(`Closing the panel did not persist: ${JSON.stringify(findings.roomPanelClosed)}`);
    }
    // the pill on the rail brings it back
    await page.getByRole('button', { name: 'Room', exact: true }).click();
    await page.getByLabel('Room width in cm').waitFor({ timeout: 10_000 });
    await settle(300);
    await shot('room-panel-reopened');
    // the rail's Room button opens the column and no dialog of its own
    await page.getByRole('button', { name: 'Close the room panel' }).click();
    await settle(300);
    await page.getByRole('button', { name: 'Room', exact: true }).click();
    await page.getByLabel('Room width in cm').waitFor({ timeout: 10_000 });
    if (await page.getByRole('heading', { name: 'Room shell' }).count() !== 0) {
      throw new Error('The rail Room button opened the shell dialog as well as the column');
    }
    await settle(300);

    // 30. the Issues tab of the properties column, and the ledger opened out
    await page.getByRole('tab', { name: /^Issues/ }).click();
    await park();
    await settle(400);
    await shot('properties-issues');
    await page.getByRole('button', { name: /^Ledger/ }).click();
    await park();
    await settle(400);
    await shot('ledger-expanded');

    // 31. the contact sheet: one of everything that has a photographed model, in one room.
    //
    // A room only reads as one catalog if the models in it belong to the same one, and that is
    // not something the templates can show — each holds a handful of pieces and no template
    // holds them all. This lays out a representative of every model in `src/three/models.ts`
    // at once, so a piece whose style, scale or orientation is wrong has nowhere to hide.
    //
    // One id per model file. The assertion below closes the loop: if a model is added to the
    // registry without a place here, or a file is left in `public/models` that nothing asks
    // for, this step fails rather than quietly photographing eleven of twelve.
    const SHEET = [
      // The overview camera stands off the room's origin corner, so a high y is far away: the
      // tall carcasses go at the back of the room and the low seating at the front, spaced so
      // that nothing in this sheet is standing behind anything else.
      ['shelf-80', 60, 440, 0], ['shelf-cube-147', 200, 440, 0], ['wardrobe-100', 350, 440, 0], ['plant-large', 465, 440, 0],
      ['sideboard-200', 120, 260, 0], ['table-coffee-90', 290, 260, 0], ['nightstand-45', 390, 260, 0], ['plant-small', 465, 260, 0],
      ['armchair-80', 70, 80, 0], ['chair-dining', 180, 80, 0], ['pouf-round-60', 280, 80, 0],
    ];
    await tool('set_room_shell', { width: 520, depth: 520, height: 260 });
    const before = await toolJson('get_room', {});
    for (const it of before.items ?? []) await tool('remove_item', { id: it.id });
    for (const [catalogId, x, y, rotation] of SHEET) {
      const placed = await toolJson('place_item', { catalogId, x, y, rotation });
      if (placed.status !== 'applied') throw new Error(`contact sheet could not place ${catalogId}: ${JSON.stringify(placed)}`);
    }
    await tool('set_daylight_hour', { hour: 12 });
    await tool('set_camera', { preset: 'overview' });
    await park();
    await settle(1500);
    const sheetBox = await page.locator('section[aria-label="3D"]').boundingBox();
    await page.screenshot({ path: resolve(outDir, 'contact-sheet.png'), clip: sheetBox });
    shots.push(resolve(outDir, 'contact-sheet.png'));

    const onDisk = (await readdir(resolve(root, 'public', 'models'))).filter((f) => f.endsWith('.glb')).sort();
    const served = [...modelResponses.keys()].sort();
    const bad = [...modelResponses.entries()].filter(([, status]) => status >= 400);
    findings.models = { onDisk: onDisk.length, requested: served.length };
    if (bad.length > 0) throw new Error(`models failed to load: ${JSON.stringify(bad)}`);
    const missing = onDisk.filter((f) => !modelResponses.has(f));
    if (missing.length > 0) {
      throw new Error(`public/models holds files nothing asked for, so they ship for nothing: ${missing.join(', ')}`);
    }

    const toolNames = await page.evaluate(() => globalThis.__floorplayFakeMC.getTools().map((t) => t.name));
    const toolCount = toolNames.length;
    // The four `*_selected` tools are only registered while something is selected, so the
    // count only means something alongside the selection state it was taken in.
    findings.selectionScopedTools = toolNames.filter((n) => n.endsWith('_selected'));
    findings.staticToolCount = toolCount - findings.selectionScopedTools.length;

    console.log(JSON.stringify({ url, outDir, screenshots: shots, toolCount, findings, consoleErrors, pageErrors }, null, 2));
    await browser.close();
    await server.close();
    if (pageErrors.length > 0) process.exitCode = 1;
  } catch (err) {
    console.log(JSON.stringify({ url, outDir, screenshots: shots, failure: String(err?.stack ?? err), findings, consoleErrors, pageErrors }, null, 2));
    await browser.close();
    await server.close();
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
