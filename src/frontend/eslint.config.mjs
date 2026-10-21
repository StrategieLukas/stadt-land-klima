import { createConfigForNuxt } from "@nuxt/eslint-config/flat";
import prettier from "eslint-plugin-prettier/recommended";

const config = createConfigForNuxt({
  features: {
    stylistic: false,
    typescript: { tsconfigPath: './tsconfig.json' },
  },
}).append(
  { ignores: ["**/dist/**", "**/.output/**", "**/node_modules/**", "**/.nuxt/**"] },
  prettier,
  {
    name: 'migration/checked-contracts',
    files: [
      'shared/contracts/**/*.ts', 'server/types/directus.ts',
      'server/utils/candidateAnswers.ts', 'server/api/public/jobs*.ts',
      'server/api/public/jobs/**/*.ts', 'server/api/candidate/**/answers.post.ts',
      'components/JobOfferCard.vue', 'components/JobOfferStatusPill.vue', 'pages/jobs/**/*.vue',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description' }],
    },
  },
);

// The factory ignores every directory named public, including our API handlers.
export default (await config).map(entry => entry.ignores ? {
  ...entry,
  ignores: entry.ignores.map(pattern => pattern === '**/public' ? 'public/**' : pattern),
} : entry);
