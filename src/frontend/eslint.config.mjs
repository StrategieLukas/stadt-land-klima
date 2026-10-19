import { createConfigForNuxt } from "@nuxt/eslint-config/flat";
import prettier from "eslint-plugin-prettier/recommended";

export default createConfigForNuxt({ features: { stylistic: false } }).append(
  { ignores: ["**/dist/**", "**/.output/**", "**/node_modules/**", "**/.nuxt/**"] },
  prettier,
);
