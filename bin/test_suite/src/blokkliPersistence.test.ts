import { loginWebsite, newContext } from "./lib/browser.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { parseEnvFile } from "./lib/config.js";
import { createAdminClient } from "./lib/directus.js";
import { openBlokkliField, saveBlokkliField } from "./lib/blokkli.js";

test("Blökkli edits survive preview, failed publish, successful publish and reload", { timeout: 120_000 }, async () => {
  const backend = process.env.TEST_BACKEND_URL || "http://localhost:8081";
  const frontend = process.env.TEST_FRONTEND_URL || "http://localhost:8080";
  const env = parseEnvFile("../../src/directus/.env");
  const admin = await createAdminClient(backend, env);
  await admin.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  const fixtureName = `blokkli-regression-${randomUUID()}`;
  const entity = await admin.createItem<{ id: string; slug: string }>("pages", {
    name: fixtureName,
    slug: fixtureName,
    status: "published",
  });
  const slug = entity.slug;
  const browser = await chromium.launch({ headless: true });
  try {
    await admin.createItem("blocks", {
      uuid: randomUUID(),
      bundle: "heading",
      entity_type: "pages",
      entity_uuid: entity.id,
      field_name: "content",
      sort_order: 0,
      status: "published",
      props: { text: "Original regression heading" },
      options: {},
    });
    const context = await newContext(browser);
    await loginWebsite(context, frontend, env.ADMIN_EMAIL!, env.ADMIN_PASSWORD!);
    await context.addInitScript(() => {
      localStorage.setItem("blokkli:popup:tour:closed", "true");
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("Browser error:", error.message));
    await page.goto(`${frontend}/${slug}?blokkliEditing=${entity.id}`);
    // The development-only Vite dock overlaps blökkli's menu button.
    await page
      .locator("vite-devtools-dock-embedded")
      .evaluateAll((elements) => elements.forEach((element) => element.remove()));
    const heading = page.locator(".blokkli-block-heading");
    await expect(heading).toHaveText("Original regression heading", { timeout: 30_000 });
    await page.route("**/items/edit_states/*", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Simulated autosave failure" }),
          })
        : route.continue(),
    );
    await openBlokkliField(page, page.locator('[data-blokkli-editable-field="text"]'));
    const input = page.locator(".bk-editable-field [contenteditable]");
    await input.fill("Updated regression heading");
    await saveBlokkliField(page);
    await expect(heading).toHaveText("Updated regression heading");
    await expect(page.locator(".bk-message.bk-is-error")).toContainText(
      "Dein Entwurf konnte nicht auf dem Server gespeichert werden",
    );
    await page.unroute("**/items/edit_states/*");
    await page.locator(".bk-message.bk-is-error .bk-message-content").click();
    const preview = await context.newPage();
    await preview.goto(`${frontend}/${slug}?blokkliPreview=${entity.id}`);
    await expect(preview.locator(".blokkli-block-heading")).toHaveText("Updated regression heading");

    // An already-open preview must discover edits from the editor tab.
    await openBlokkliField(page, page.locator('[data-blokkli-editable-field="text"]'));
    await input.fill("Final regression heading");
    await saveBlokkliField(page);
    await expect(preview.locator(".blokkli-block-heading")).toHaveText("Final regression heading", { timeout: 15_000 });
    await preview.close();

    // A rejected publish must be visible and must leave both draft and live
    // content intact, so retrying does not silently lose the user's work.
    await page.route("**/blokkli-persistence/publish", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated publish failure" }),
      }),
    );
    await page.locator(".bk-toolbar-menu-button").click();
    const publish = page.locator("#bk-menu-list-button-publish");
    await publish.click();
    await expect(page.locator(".bk-message.bk-is-error")).toBeVisible();
    const beforeRetry = await admin.readItems<{ props: { text: string } }>("blocks", {
      filter: { entity_uuid: { _eq: entity.id } },
    });
    assert.equal(beforeRetry[0].props.text, "Original regression heading");
    await page.unroute("**/blokkli-persistence/publish");
    // Prove recovery uses the server draft as well as the browser backup.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("slk:blokkli-draft:")) localStorage.removeItem(key);
      }
    });
    await page.reload();
    await page
      .locator("vite-devtools-dock-embedded")
      .evaluateAll((elements) => elements.forEach((element) => element.remove()));
    await expect(heading).toHaveText("Final regression heading");
    await page.locator(".bk-toolbar-menu-button").click();
    await publish.click();
    await page.waitForURL(`${frontend}/${slug}`);
    await expect(heading).toHaveText("Final regression heading");
    await page.reload();
    await expect(heading).toHaveText("Final regression heading");
    // Published blocks must also render for visitors without JavaScript or an
    // editor session. A database-only assertion misses broken public rendering.
    const html = await (await fetch(`${frontend}/${slug}`)).text();
    assert.ok(html.includes("Final regression heading"));
    const blocks = await admin.readItems<{ props: { text: string } }>("blocks", {
      filter: { entity_uuid: { _eq: entity.id }, status: { _neq: "archived" } },
    });
    assert.equal(blocks[0].props.text, "Final regression heading");
  } finally {
    await browser.close();
    for (const collection of ["edit_states", "blocks"]) {
      const records = await admin.readItems<{ id: number }>(collection, {
        filter: { entity_uuid: { _eq: entity.id } },
        limit: -1,
      });
      for (const record of records) await admin.deleteItem(collection, record.id);
    }
    await admin.deleteItem("pages", entity.id);
  }
});

test(
  "Blökkli V2 preserves nested legacy content, formatting, media and reusable blocks",
  { timeout: 180_000 },
  async () => {
    const backend = process.env.TEST_BACKEND_URL || "http://localhost:8081";
    const frontend = process.env.TEST_FRONTEND_URL || "http://localhost:8080";
    const env = parseEnvFile("../../src/directus/.env");
    const admin = await createAdminClient(backend, env);
    const token = await admin.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
    const name = `blokkli-v2-${randomUUID()}`;
    const entity = await admin.createItem<{ id: string; slug: string }>("pages", {
      name,
      slug: name,
      status: "published",
    });
    const browser = await chromium.launch({ headless: true });
    let fileId: string | undefined;
    let libraryId: string | number | undefined;
    const nested = (bundle: string, props: Record<string, unknown>, options: Record<string, unknown> = {}) => ({
      uuid: randomUUID(),
      bundle,
      props,
      options,
    });
    const nestedHeading = nested("heading", { text: "Legacy nested heading" }, { color: "blue", level: "h3" });
    const libraryHeading = nested("heading", { text: "Reusable nested heading" });
    try {
      const form = new FormData();
      form.set("title", name);
      form.set(
        "file",
        new Blob([await readFile(new URL("./fixtures/tour-portrait.png", import.meta.url))], { type: "image/png" }),
        `${name}.png`,
      );
      const uploaded = await fetch(`${backend}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      assert.ok(uploaded.ok, `Fixture image upload failed with ${uploaded.status}`);
      fileId = (await uploaded.json()).data.id;
      const library = await admin.createItem<{ id: string | number }>("library_items", {
        uuid: randomUUID(),
        label: name,
        bundle: "container",
        options: {},
        props: { blocks: [libraryHeading] },
      });
      libraryId = library.id;
      const roots = [
        nested(
          "container",
          {
            blocks: [
              nestedHeading,
              nested("text", {
                content:
                  '<p>Legacy <strong>bold</strong> and <em>italic</em> <span class="slk-text-light">light</span> <a href="/contact">contact link</a></p>',
              }),
              nested("richtext", { content: "## Legacy Markdown\n\n**Preserved Markdown**" }),
            ],
          },
          { layout: "columns-2" },
        ),
        nested("timeline", {
          title: "Legacy timeline",
          items: [
            nested("timeline_item", {
              title: "Legacy milestone",
              date: "2026",
              blocks: [nested("heading", { text: "Timeline nested heading" })],
            }),
          ],
        }),
        nested("carousel", { slides: [nested("heading", { text: "Legacy carousel heading" })] }),
        nested("hex_grid", { hexagons: [nested("hex_item", { label: "Legacy hexagon", imageId: "" })] }),
        nested("form", {
          title: "Legacy form",
          fields: [
            nested(
              "form_field",
              { label: [nested("form_label", { text: "Legacy field label", description: "" })] },
              { fieldType: "text", fieldName: "legacy", required: true },
            ),
          ],
        }),
        nested("hero", {
          title: "Legacy hero",
          subtitle: "",
          imageId: "",
          blocks: [nested("heading", { text: "Hero nested heading" })],
        }),
        nested("image", { imageId: fileId, alt: "Legacy fixture image", caption: "Legacy image caption" }),
        nested("icon", {}, { source: "slk", slkIcon: "icon_info" }),
        nested(
          "button",
          { label: "Legacy button" },
          { iconSlug: "icon_info", iconPosition: "left", linkType: "internal", link: "/contact" },
        ),
      ];
      for (const [index, block] of roots.entries())
        await admin.createItem("blocks", {
          ...block,
          entity_type: "pages",
          entity_uuid: entity.id,
          field_name: "content",
          sort_order: index,
          status: "published",
        });

      // These fixtures deliberately contain V1 data without isVisible/editContext.
      const publicHtml = await (await fetch(`${frontend}/${entity.slug}`)).text();
      for (const text of [
        "Legacy nested heading",
        "Timeline nested heading",
        "Legacy carousel heading",
        "Legacy hexagon",
        "Legacy field label",
        "Hero nested heading",
        "Legacy image caption",
      ])
        assert.ok(publicHtml.includes(text), `Missing public content: ${text}`);
      assert.ok(publicHtml.includes("<strong>bold</strong>"));
      assert.ok(publicHtml.includes("slk-text-light"));
      assert.ok(publicHtml.includes("Preserved Markdown"));
      const publicData = await (
        await fetch(`${frontend}/api/public/blocks?entityUuid=${entity.id}&entityType=pages&fieldName=content`)
      ).json();
      assert.equal(publicData.blocks[0].uuid, roots[0].uuid);
      assert.equal(publicData.blocks[0].options.layout, "columns-2");

      const context = await newContext(browser, { viewport: { width: 1440, height: 1000 } });
      await loginWebsite(context, frontend, env.ADMIN_EMAIL!, env.ADMIN_PASSWORD!);
      await context.addInitScript(() => {
        localStorage.setItem("blokkli:popup:tour:closed", "true");
      });
      const page = await context.newPage();
      const moduleErrors: string[] = [];
      page.on("pageerror", (error) => moduleErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && message.text().includes("[vite] Internal Server Error"))
          moduleErrors.push(message.text());
      });
      await page.goto(`${frontend}/${entity.slug}?blokkliEditing=${entity.id}`);
      await page
        .locator("vite-devtools-dock-embedded")
        .evaluateAll((elements) => elements.forEach((element) => element.remove()));
      const heading = page.locator(".blokkli-block-heading").filter({ hasText: "Legacy nested heading" });
      await expect(heading).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".blokkli-block-icon svg")).toBeVisible();
      await expect(page.locator(".blokkli-block-button .blokkli-button-icon svg").first()).toBeVisible();
      await expect(page.locator(".bk-dev-mode-banner")).toHaveCount(0);
      await openBlokkliField(page, heading.locator('[data-blokkli-editable-field="text"]'));
      const input = page.locator(".bk-editable-field [contenteditable]");
      await input.fill("Updated nested heading");
      // The existing custom formatting toolbar must still drive real input events.
      await input.press("ControlOrMeta+A");
      await page.locator(".slk-rich-text-toolbar").getByRole("button", { name: "Fett", exact: true }).click();
      await expect(input.locator("strong")).toHaveText("Updated nested heading");
      await saveBlokkliField(page);
      await expect(page.locator(".blokkli-block-heading").filter({ hasText: "Updated nested heading" })).toBeVisible();
      await expect(page.locator(".bk-fatal-error-overlay")).toHaveCount(0);

      await page.locator("#bk-sidebar-button-media_library").click();
      const mediaSearch = page.waitForResponse(
        (response) => response.url().includes("/files?") && response.url().includes(name),
      );
      await page.locator('.bk-media-library input[type="text"]').fill(name);
      await page.locator('.bk-media-library input[type="text"]').blur();
      await mediaSearch;
      await expect(page.locator(".bk-media-library-items-item")).toHaveCount(1);
      await expect(page.locator(".bk-media-library-items")).toContainText(name);
      await expect(page.locator(".bk-media-library-items img").first()).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator(".bk-media-library-items img")
            .first()
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.locator("#bk-sidebar-button-media_library").click();

      // Drag the library action into a nested field through the editor canvas.
      await page.keyboard.press("Escape");
      const source = await page.locator('#bk-add-list [data-sortli-id="library"] .bk-add-item-icon').boundingBox();
      const target = await page.locator(".blokkli-block-container .bk-draggable-list-container").first().boundingBox();
      assert.ok(source && target);
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await page.mouse.down();
      await page.mouse.move(source.x + source.width + 10, source.y - 10, { steps: 5 });
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 25 });
      await page.mouse.up();
      await expect(page.locator(".bk-library-dialog")).toBeVisible();
      const librarySearch = page.waitForResponse(
        (response) => response.url().includes("/items/library_items") && response.url().includes(name),
      );
      await page.locator('.bk-library-dialog input[type="text"]').fill(name);
      await page.locator('.bk-library-dialog input[type="text"]').press("Tab");
      await librarySearch;
      await page.locator(".bk-library-dialog-list > li").filter({ hasText: name }).click();
      await expect(page.locator(".bk-library-dialog-list > li.bk-is-selected")).toContainText(name);
      await page.getByRole("button", { name: "Wiederverwendbaren Block hinzufügen", exact: true }).click();
      await expect(page.locator(".bk-library-dialog")).toHaveCount(0);
      await expect(page.locator(".blokkli-block-heading").filter({ hasText: "Reusable nested heading" })).toBeVisible();
      await expect(page.locator(".bk-fatal-error-overlay")).toHaveCount(0);
      await page.locator(".bk-toolbar-menu-button").click();
      await page.locator("#bk-menu-list-button-publish").click();
      await page.waitForURL(`${frontend}/${entity.slug}`);
      await expect(page.locator(".blokkli-block-heading").filter({ hasText: "Updated nested heading" })).toBeVisible();
      const published = await admin.readItems<{ uuid: string; props: Record<string, any> }>("blocks", {
        filter: { entity_uuid: { _eq: entity.id }, status: { _eq: "published" } },
        sort: ["sort_order"],
      });
      const container = published.find((block) => block.uuid === roots[0].uuid)!;
      assert.ok(container.props.blocks[0].props.text.includes("<strong>Updated nested heading</strong>"));
      assert.equal(container.props.blocks[0].editContext, undefined);
      assert.equal(published.length, roots.length);
      const copy = container.props.blocks.find(
        (block: any) =>
          block.bundle === "container" && block.props.blocks?.[0]?.props.text === "Reusable nested heading",
      );
      assert.ok(copy);
      assert.notEqual(copy.props.blocks[0].uuid, libraryHeading.uuid);
      assert.ok((await (await fetch(`${frontend}/${entity.slug}`)).text()).includes("Reusable nested heading"));
      assert.deepEqual(moduleErrors, [], "Editor components must load without Vite errors or browser exceptions");
    } finally {
      await browser.close();
      for (const collection of ["edit_states", "blocks"])
        for (const record of await admin.readItems<{ id: string | number }>(collection, {
          filter: { entity_uuid: { _eq: entity.id } },
          limit: -1,
        }))
          await admin.deleteItem(collection, record.id);
      if (libraryId) await admin.deleteItem("library_items", libraryId);
      if (fileId) await admin.request("DELETE", `/files/${fileId}`);
      await admin.deleteItem("pages", entity.id);
    }
  },
);
