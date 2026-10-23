import {createConfigForNuxt} from '@nuxt/eslint-config/flat';
import prettier from 'eslint-config-prettier';

// Extensions have independent tsconfigs and host-provided dynamic CMS values.
// Their strict compiler/source gates live in bin/check_extensions.sh. Do not
// point ESLint's project service at the unrelated frontend Nuxt project.
export default createConfigForNuxt({features: {stylistic: false, typescript: {strict: false}}}).append(
  prettier,
  {ignores: ['**/node_modules/**', '**/dist/**']},
  {rules: {
    // Directus extension callbacks expose dynamic schemas. The host contract is
    // checked by each package's compiler, rather than pretending these are Nuxt DTOs.
    '@typescript-eslint/no-explicit-any': 'off',
    'vue/multi-word-component-names': 'off', // Directus requires interface.vue/panel.vue.
    'vue/attributes-order': 'off', // Formatting belongs in Prettier.
    'vue/prop-name-casing': 'off', // Persisted Directus interface option names.
    'vue/no-mutating-props': ['error', {shallowOnly: true}], // Parent-owned edit buffers.
    'vue/no-v-html': ['error', {ignorePattern: '^sanitize\\w*\\('}],
  }},
);
