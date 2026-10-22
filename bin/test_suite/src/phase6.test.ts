import { test } from "node:test";
import assert from "node:assert/strict";
import { singleRouteValue, routeSlug, routeText } from "../../../src/frontend/shared/routeValues.js";
import { ClimateToolSchema, ContentPageSchema, TeamMemberSchema } from "../../../src/frontend/shared/contracts/content.js";

test("page route values distinguish absent, repeated, malformed and supported input", () => {
  for (const value of [undefined, null, ["valid"], ["a", "b"], {}, 1]) {
    assert.equal(singleRouteValue(value), undefined);
    assert.equal(routeSlug(value), undefined);
    assert.equal(routeText(value, 200), "");
  }
  for (const value of ["../secret", "a/b", "", "a".repeat(161)]) assert.equal(routeSlug(value), undefined);
  assert.equal(routeSlug("some-page-2"), "some-page-2");
  assert.equal(routeText("äöü", 3), "äöü");
  assert.equal(routeText("long", 3), "");
});

test("simple content contracts project private fields and reject malformed records", () => {
  const page = {id: "id", slug: "index", name: "Home", contents: null, status: "published", secret: "hidden"};
  assert.equal("secret" in ContentPageSchema.parse(page), false);
  assert.equal(ContentPageSchema.safeParse({...page, status: "draft"}).success, false);
  assert.equal(ContentPageSchema.safeParse({...page, contents: {bad: true}}).success, false);
  const tool = {id: "tool", title: "Tool", description: "Description", link: "https://example.org", image: null, sort: null};
  assert.equal(ClimateToolSchema.safeParse(tool).success, true);
  for (const link of ["javascript:alert(1)", "data:text/html,test", "//example.org"]) assert.equal(ClimateToolSchema.safeParse({...tool, link}).success, false);
  assert.deepEqual(TeamMemberSchema.parse({id: "user", avatar: null, password: "hidden"}), {id: "user", first_name: null, last_name: null, bio: null, avatar: null, slk_team: []});
});
