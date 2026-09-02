// scripts/smoke.mjs
// Headless visual smoke run: boots Vite, drives the app through a scripted
// walkthrough with Playwright, and writes one screenshot per step.
//
//   npm run smoke -- [outDir]
//
// Prints a JSON summary (screenshots, tool count, findings, console/page errors) on
// stdout and exits non-zero if the page threw or an assertion failed.
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.cwd(), process.argv[2] ?? './smoke-out');
const VIEWPORT = { width: 1440, height: 900 };

const shots = [];
const consoleErrors = [];
const pageErrors = [];
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
    const card = page.locator('div.w-56').filter({ hasText: 'Bed by the window' }).first();
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

    // 7. that desk lands on the one from the accepted layout, so the issues panel should open
    const issuesHeader = page.getByText(/^Issues \(\d+\)$/).first();
    if (await issuesHeader.count() > 0) {
      findings.issues = (await issuesHeader.textContent())?.trim() ?? null;
      await shot('issues');
      // Clear it with the agent's own repair tool so the later shots show a settled room.
      const newest = placed.items?.[placed.items.length - 1];
      if (newest) {
        const fixed = await toolJson('fix_item', { id: newest.id });
        findings.fixItem = { status: fixed.status ?? null, error: fixed.error ?? null };
      }
      await settle();
    } else {
      findings.issues = 'none';
    }

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
