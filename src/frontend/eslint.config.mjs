import { createConfigForNuxt } from "@nuxt/eslint-config/flat";
import prettier from "eslint-plugin-prettier/recommended";

const config = createConfigForNuxt({
  features: {
    stylistic: false,
    typescript: { tsconfigPath: "./tsconfig.json" },
  },
}).append(
  { ignores: ["**/dist/**", "**/.output/**", "**/node_modules/**", "**/.nuxt/**"] },
  prettier,
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
    name: "migration/vue3-pages",
    files: ["**/*.vue"],
    rules: { "vue/no-multiple-template-root": "off", "vue/valid-template-root": "off" },
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
