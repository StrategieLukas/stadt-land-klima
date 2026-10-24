import prettier from "eslint-config-prettier";
import { createConfigForNuxt } from "@nuxt/eslint-config/flat";

const config = createConfigForNuxt({
  features: {
    stylistic: false,
    typescript: { tsconfigPath: "./tsconfig.json" },
  },
}).append(
  prettier,
  { ignores: ["**/dist/**", "**/.output/**", "**/node_modules/**", "**/.nuxt/**"] },
  {
    name: "migration/checked-contracts",
    files: ["**/*.ts", "**/*.mts", "**/*.vue"],
    rules: {
      "prettier/prettier": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
    },
  },
  {
    name: "application/vue-typescript",
    files: ["**/*.vue"],
    rules: {
      "vue/no-multiple-template-root": "off",
      "vue/valid-template-root": "off",
      // Optional TS props deliberately use Vue's native absent-value behavior.
      // Meaningful defaults belong in withDefaults; strict templates check consumers.
      "vue/require-default-prop": "off",
      "vue/no-v-html": ["error", { ignorePattern: "^sanitize(?:Html|Svg)\\(" }],
      "vue/prop-name-casing": "error",
      "vue/attribute-hyphenation": ["error", "always", { ignore: ["ariaHidden"] }],
    },
  },
  {
    // These public prop contracts mirror persisted CMS snake_case fields.
    files: [
      "components/ArticlePage.vue",
      "components/MeasureCard.vue",
      "components/MeasureDetails.vue",
      "components/ProjectCard.vue",
    ],
    rules: { "vue/prop-name-casing": "off" },
  },
  // Policy owned by the application maintainers: keep defensive guards at I/O
  // boundaries, including APIs whose third-party declarations overstate their guarantees.
  {
    name: "application/runtime-guards",
    files: ["server/**/*.ts", "middleware/**/*.ts", "layouts/**/*.vue"],
    rules: { "@typescript-eslint/no-unnecessary-condition": "off" },
  },
  {
    name: "migration/preserve-component-markup",
    files: ["components/**/*.vue", "pages/**/*.vue"],
    rules: {
      "prettier/prettier": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
    },
  },
);

// The factory ignores every directory named public, including our API handlers.
export default (await config).map((entry) =>
  entry.ignores
    ? {
        ...entry,
        ignores: entry.ignores.map((pattern) => (pattern === "**/public" ? "public/**" : pattern)),
      }
    : entry,
);
