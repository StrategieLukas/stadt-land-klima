import assert from 'node:assert/strict';
import { expect, type Locator, type Page } from '@playwright/test';

export async function openBlokkliField(page: Page, field: Locator): Promise<void> {
  await expect(page.locator('#bk-animation-canvas-webgl')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('._bk_z-init-overlay')).toHaveCount(0);
  await expect(page.locator('.bk-fatal-error-overlay')).toHaveCount(0);
  // V2 performs hit testing on a canvas above the rendered page. Send real
  // pointer events to the field's screen coordinates through that canvas.
  await field.scrollIntoViewIfNeeded();
  const box = await field.boundingBox();
  assert.ok(box);
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.bk-editable-field [contenteditable]')).toBeVisible();
}

export async function saveBlokkliField(page: Page): Promise<void> {
  await page.locator('.bk-editable-field').getByRole('button', { name: 'Speichern', exact: true }).click();
}
