const puppeteer = require('puppeteer-core');

const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/chromium-browser';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--user-data-dir=/tmp/sg-udd']
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('[page]', msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err));

  await page.goto('http://localhost:9013/', { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1200, height: 800 });

  await page.waitForSelector('.djs-element[data-element-id="Task_B"]', { timeout: 5000 });

  const bbox = async (id) => {
    return page.evaluate((elId) => {
      const registry = window.__modeler.get('elementRegistry');
      const gfx = registry.getGraphics(elId);
      const rect = gfx.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, id);
  };

  const guideCount = () => page.evaluate(
    () => document.querySelectorAll('.djs-spacing-guide-segment').length
  );

  console.log('guides before drag:', await guideCount());

  const taskB = await bbox('Task_B');
  const startX = taskB.x + taskB.width / 2;
  const startY = taskB.y + taskB.height / 2;

  // Task_B already sits exactly midway between Task_A and Task_C (100px gap
  // each side). Cross the drag-activation threshold first, then return to
  // the exact starting position — the "between neighbors" guide should
  // light back up once both gaps match again.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 15, startY, { steps: 3 });
  await page.mouse.move(startX, startY, { steps: 3 });

  const midDragGuides = await guideCount();
  const midDragLabels = await page.evaluate(
    () => Array.from(document.querySelectorAll('.djs-spacing-guide-segment text')).map((t) => t.textContent)
  );
  console.log('guides mid-drag (Task_B, back to centered):', midDragGuides, midDragLabels);
  await page.screenshot({ path: '/tmp/spacing-guides-between.png' });

  // Now break symmetry: drag Task_B noticeably to the right.
  await page.mouse.move(startX + 120, startY, { steps: 10 });
  const brokenGuides = await guideCount();
  console.log('guides after breaking symmetry:', brokenGuides);

  await page.mouse.up();
  const afterDropGuides = await guideCount();
  console.log('guides after drop (should be 0):', afterDropGuides);

  await page.screenshot({ path: '/tmp/spacing-guides-after-drop.png' });

  // Undo the move so re-running this script is idempotent.
  await page.evaluate(() => window.__modeler.get('commandStack').undo());

  // Scenario B: drag EndEvent_1 (no outgoing) back to a position where the
  // gap to Task_C matches the established Task_B -> Task_C gap.
  const endEvent = await bbox('EndEvent_1');
  const endX = endEvent.x + endEvent.width / 2;
  const endY = endEvent.y + endEvent.height / 2;

  await page.mouse.move(endX, endY);
  await page.mouse.down();
  await page.mouse.move(endX + 15, endY, { steps: 3 });
  await page.mouse.move(endX, endY, { steps: 3 });

  const chainGuideCount = await guideCount();
  const chainGuideLabels = await page.evaluate(
    () => Array.from(document.querySelectorAll('.djs-spacing-guide-segment text')).map((t) => t.textContent)
  );
  console.log('guides mid-drag (EndEvent_1, chain scenario):', chainGuideCount, chainGuideLabels);
  await page.screenshot({ path: '/tmp/spacing-guides-chain.png' });

  await page.mouse.up();
  await page.evaluate(() => window.__modeler.get('commandStack').undo());

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
