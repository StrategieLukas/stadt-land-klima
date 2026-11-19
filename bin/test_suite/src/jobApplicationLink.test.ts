import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolveJobApplicationLink } from "../../../src/frontend/shared/jobApplicationLink.js";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));

test("job actions accept web, email and internal destinations without losing prefilled query values", () => {
  for (const link of [
    "https://example.org/apply?role=climate#form",
    "http://example.org/apply",
    "mailto:jobs@example.org?subject=Klimaschutz%20%26%20Kommunen",
    "/contact?title=Klimaschutz%20%26%20Kommunen&type=cooperation",
  ]) {
    assert.equal(resolveJobApplicationLink(link), link);
  }
  assert.equal(resolveJobApplicationLink("  mailto:jobs@example.org  "), "mailto:jobs@example.org");
});

test("job actions reject executable schemes, ambiguous relative URLs and embedded credentials", () => {
  for (const link of [
    null,
    undefined,
    "",
    "   ",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//example.org/apply",
    "/\\example.org/apply",
    "/\n/example.org/apply",
    "/path/..//example.org/apply",
    "https://user:password@example.org/apply",
    "ftp://example.org/apply",
    "mailto:",
    "contact",
  ]) {
    assert.equal(resolveJobApplicationLink(link), null, String(link));
  }
});

test("the CMS application field permits the supported link forms and rejects unsafe schemes", () => {
  const field = frontend("yaml").parse(
    readFileSync(
      new URL("../../../src/directus/schema/fields/job_offers/application_url.yaml", import.meta.url),
      "utf8",
    ),
  );
  const pattern = new RegExp(field.meta.validation._or[1].application_url._regex);
  for (const link of [
    "https://example.org/apply",
    "http://example.org/apply",
    "mailto:jobs@example.org?subject=Job",
    "/contact?title=Job",
  ]) {
    assert(pattern.test(link), link);
  }
  for (const link of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "//example.org",
    "/\\example.org",
    "https://example.org/\ninvalid",
  ]) {
    assert(!pattern.test(link), link);
  }
  assert.equal(field.meta.options.trim, true);
});
