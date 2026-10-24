import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const { compile } = (await import(
  frontend.resolve("@tailwindcss/node")
)) as typeof import("../../../src/frontend/node_modules/@tailwindcss/node/dist/index.mjs");
const postcss = frontend("postcss") as typeof import("../../../src/frontend/node_modules/postcss/lib/postcss.js");
const input = new URL("../../../src/frontend/assets/css/main.css", import.meta.url);
const compiler = await compile(readFileSync(input, "utf8"), {
  base: fileURLToPath(new URL(".", input)),
  onDependency() {},
});
// No hand-supplied candidates: runtime classes must come from the real CSS sources.
const output = postcss.parse(compiler.build([]));
const {
  theme: {
    extend: { colors },
  },
} = frontend("./tailwind.config.js") as {
  theme: { extend: { colors: Record<string, string> } };
};

function declaration(selector: string, property: string) {
  let value: string | undefined;
  output.walkRules(selector, (rule) => {
    rule.walkDecls(property, (entry) => {
      value = entry.value;
    });
  });
  assert.ok(value, `Missing generated ${selector} / ${property}`);
  return value;
}

test("the real CSS entry generates every runtime rating color and transparent variant without template candidates", () => {
  for (const rating of ["na", "0", "1", "2", "3", "4"]) {
    for (const suffix of ["", "-light", "-very-light"]) {
      assert.equal(
        declaration(`.bg-rating-${rating}${suffix}`, "background-color").toLowerCase(),
        colors[`rating-${rating}${suffix}`]!.toLowerCase(),
      );
    }
    for (const opacity of [10, 90]) {
      assert.match(declaration(`.bg-rating-${rating}\\/${opacity}`, "background-color"), new RegExp(`${opacity}%`));
    }
    assert.equal(
      declaration(`.border-rating-${rating}`, "border-color").toLowerCase(),
      colors[`rating-${rating}`]!.toLowerCase(),
    );
    assert.equal(
      declaration(`.text-rating-${rating}`, "color").toLowerCase(),
      colors[`rating-${rating}`]!.toLowerCase(),
    );
  }
  assert.equal(compiler.root, "none", "Scan only maintained app sources, not arbitrary checkout/private data");
});

test("both persisted DaisyUI theme IDs retain brand colors and the existing card dimensions", () => {
  for (const theme of ["staedteChallemgeTheme", "staedteChallengeDark"]) {
    let found = false;
    output.walkRules((rule) => {
      if (!rule.selector.includes(`[data-theme=${theme}]`) && !rule.selector.includes(`[data-theme="${theme}"]`))
        return;
      const properties = Object.fromEntries(
        rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value]),
      );
      if (properties["--color-primary"]) {
        found = true;
        assert.equal(properties["--color-primary"].toLowerCase(), "#afca0b");
        assert.equal(properties["--card-p"], "2rem");
        assert.equal(properties["--card-fs"], "1rem");
      }
    });
    assert.ok(found, `Missing ${theme}`);
  }
});

test("CSS engine platform bindings remain optional and every supported binding is retained in the lockfile", () => {
  const lock = JSON.parse(
    readFileSync(new URL("../../../src/frontend/package-lock.json", import.meta.url), "utf8"),
  ) as {
    packages: Record<string, { optional?: boolean; optionalDependencies?: Record<string, string> }>;
  };
  for (const name of ["@tailwindcss/oxide", "lightningcss"]) {
    const bindings = Object.keys(lock.packages[`node_modules/${name}`]?.optionalDependencies ?? {});
    assert.ok(bindings.some((binding) => binding.includes("darwin")));
    assert.ok(bindings.some((binding) => binding.includes("win32")));
    assert.ok(bindings.some((binding) => binding.includes("linux")));
    for (const binding of bindings) assert.equal(lock.packages[`node_modules/${binding}`]?.optional, true, binding);
  }
});
