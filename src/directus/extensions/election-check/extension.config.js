export default {
  plugins: [],
  // node:crypto is a Node.js built-in — tell Rollup not to attempt to bundle it.
  // The bare specifier 'crypto' is listed as well for compatibility with any
  // transitive dependency that hasn't migrated to the 'node:' prefix yet.
  external: ['node:crypto', 'crypto'],
};
