import assert from 'node:assert/strict';
import { expect, type Locator, type Page } from '@playwright/test';

export async function openBlokkliField(page: Page, field: Locator): Promise<void> {
  await expect(page.locator('#bk-animation-canvas-webgl')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('._bk_z-init-overlay')).toHaveCount(0);
  await expect(page.locator('.bk-fatal-error-overlay')).toHaveCount(0);
  const center = async () => {
    const box = await field.boundingBox();
    assert.ok(box);
    return {x: box.x + box.width / 2, y: box.y + box.height / 2};
  };
  const isCanvas = (point: {x: number; y: number}) => page.evaluate(
    ({x, y}) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', point,
  );
  // V2 pans a transformed artboard rather than the document. Native DOM
  // scrollIntoView can leave its cached hit rectangles stale or a field behind
  // the fixed toolbar. Pan through the same wheel events a user sends.
  if (!await isCanvas(await center())) {
    const canvas = await page.locator('#bk-animation-canvas-webgl').boundingBox();
    assert.ok(canvas);
    const point = await center();
    const target = {x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2};
    await page.mouse.move(target.x, target.y);
    await page.mouse.wheel(point.x - target.x, point.y - target.y);
  }
  await expect.poll(async () => isCanvas(await center()), {
    message: 'The editable field must be under the editor canvas, clear of fixed toolbars',
  }).toBe(true);
  let previous: {x: number; y: number} | undefined;
  let stableSamples = 0;
  await expect.poll(async () => {
    const current = await center();
    stableSamples = previous && Math.abs(current.x - previous.x) < 0.5 && Math.abs(current.y - previous.y) < 0.5
      ? stableSamples + 1 : 0;
    previous = current;
    return stableSamples >= 2;
  }, {message: 'The artboard must finish panning before pointer hit testing', intervals: [50, 100]}).toBe(true);
  const point = await center();
  await page.mouse.move(point.x, point.y);
  // Hit testing follows artboard/pointer updates on animation frames.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.locator('.bk-editable-field [contenteditable]')).toBeVisible();
}

export async function saveBlokkliField(page: Page): Promise<void> {
  await page.locator('.bk-editable-field').getByRole('button', { name: 'Speichern', exact: true }).click();
}
