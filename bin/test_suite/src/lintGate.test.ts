import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("real ESLint gate rejects unsafe HTML, explicit any and unhandled promises, while accepting sanitized HTML", () => {
  const cwd = fileURLToPath(new URL("../../../src/frontend/", import.meta.url));
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import {ESLint} from 'eslint';
    const lint = new ESLint();
    const cases = [
      ['components/CanonicalButton.vue', '<template><div v-html="props.content" /></template><script setup lang="ts">const props = defineProps<{content: string}>();</script>'],
      ['components/CanonicalButton.vue', '<template><div>{{ value }}</div></template><script setup lang="ts">const value: any = 1;</script>'],
      ['components/CanonicalButton.vue', '<template><div /></template><script setup lang="ts">Promise.resolve(1);</script>'],
      ['components/CanonicalButton.vue', '<template><div v-html="sanitizeHtml(props.content)" /></template><script setup lang="ts">import {sanitizeHtml} from "~/utils/sanitizeHtml"; const props = defineProps<{content: string}>();</script>'],
    ];
    const results = [];
    for (const [filePath, code] of cases) results.push((await lint.lintText(code, {filePath})).flatMap(result => result.messages.map(message => message.ruleId)));
    console.log(JSON.stringify(results));
  `,
    ],
    { cwd, encoding: "utf8", timeout: 45000 },
  );
  const [html, any, promise, safe] = JSON.parse(output) as string[][];
  assert.ok(html?.includes("vue/no-v-html"));
  assert.ok(any?.includes("@typescript-eslint/no-explicit-any"));
  assert.ok(promise?.includes("@typescript-eslint/no-floating-promises"));
  assert.deepEqual(safe, []);
});
