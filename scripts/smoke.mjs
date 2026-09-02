// scripts/smoke.mjs
// Headless visual smoke run: boots Vite, drives the app through a scripted
// walkthrough with Playwright, and writes one screenshot per step.
//
//   npm run smoke -- [outDir]
//
// Prints a JSON summary (screenshots, tool count, console/page errors) on stdout
// and exits non-zero if the page threw.
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
  const settle = (ms = 350) => page.waitForTimeout(ms);

  try {
    await page.goto(url, { waitUntil: 'load' });

    // 1. initial paint
    await page.getByText('Floorplay', { exact: true }).first().waitFor({ timeout: 20_000 });
    await settle(1200); // let the WebGL canvas draw its first frames
    await shot('initial');

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

    // 5. daylight sweep
    for (const hour of [9, 12, 17]) {
      await tool('set_daylight_hour', { hour });
      await settle(500);
      await shot(`daylight-${String(hour).padStart(2, '0')}h`);
    }

    // 6. catalog drawer
    await page.getByRole('button', { name: 'Catalog', exact: true }).click();
    await settle();
    await shot('catalog');
    await page.getByRole('button', { name: 'Catalog', exact: true }).click();
    await settle();

    // 7. select the bed on the plan to open the inspector
    const bedLabel = page.locator('svg text').filter({ hasText: 'Queen bed' }).first();
    const box = await bedLabel.boundingBox();
    if (!box) throw new Error('Could not find the "Queen bed" label on the plan');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await settle();
    await shot('inspector');

    // 8. agent moves the camera to the doorway
    await tool('set_camera', { preset: 'from_door' });
    await settle(600);
    await shot('camera-from-door');

    // 9. back to orbit
    await page.getByRole('button', { name: 'Orbit view' }).click();
    await settle(600);
    await shot('orbit');

    // 10. dev panel
    await page.keyboard.press('Control+Shift+D');
    await settle();
    await shot('dev-panel');
    await page.keyboard.press('Control+Shift+D');
    await settle();

    const toolCount = await page.evaluate(() => globalThis.__floorplayFakeMC.getTools().length);

    console.log(JSON.stringify({ url, outDir, screenshots: shots, toolCount, consoleErrors, pageErrors }, null, 2));
    await browser.close();
    await server.close();
    if (pageErrors.length > 0) process.exitCode = 1;
  } catch (err) {
    console.log(JSON.stringify({ url, outDir, screenshots: shots, failure: String(err?.stack ?? err), consoleErrors, pageErrors }, null, 2));
    await browser.close();
    await server.close();
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
