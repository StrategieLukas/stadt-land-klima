/** Keep __proto__ as own data rather than assigning the legacy prototype setter. */
const replacements: [string, string][] = [
  [
    "destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);",
    "Object.defineProperty(destination, key, { value: cloneUnlessOtherwiseSpecified(target[key], options), enumerable: true, configurable: true, writable: true });",
  ],
  [
    "destination[key] = getMergeFunction(key, options)(target[key], source[key], options);",
    "Object.defineProperty(destination, key, { value: getMergeFunction(key, options)(target[key], source[key], options), enumerable: true, configurable: true, writable: true });",
  ],
  [
    "destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);",
    "Object.defineProperty(destination, key, { value: cloneUnlessOtherwiseSpecified(source[key], options), enumerable: true, configurable: true, writable: true });",
  ],
];
export const deepmergePatches = [
  { file: "dist/cjs.js", sha256: "2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d", replacements },
  { file: "dist/umd.js", sha256: "f33e6596482d1fb5c7c427f8ef92f2aa849eea9223acd974176b2fb27ddbf73a", replacements },
];
