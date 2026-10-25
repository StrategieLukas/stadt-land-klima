/** Keep stream-json 1.x API; backport safe own-property writes and bound parser/filter depth. JSONC does not exist in this release. */
export const streamJsonPatches = [
  {
    file: "Assembler.js",
    sha256: "a341b21d86a9c005e5433eadb6c33d4708d611c8bc624ee383463c0fb6d2e32b",
    replacements: [
      [
        "this.current[this.key] = value;",
        "Object.defineProperty(this.current, this.key, {value, enumerable: true, writable: true, configurable: true});",
      ],
      [
        "    if (this.done) {\n      this.done = false;",
        "    if (this.stack.length >= 256) throw new Error('JSON nesting limit exceeded');\n    if (this.done) {\n      this.done = false;",
      ],
    ],
  },
  {
    file: "Parser.js",
    sha256: "83866088a1805b0370fbf80a3906377c81d80e6d35521c5716e870212c3ce927",
    replacements: [
      [
        "            case '{':\n              this.push",
        "            case '{':\n              if (this._stack.length >= 128) return callback(new Error('JSON nesting limit exceeded'));\n              this.push",
      ],
      [
        "            case '[':\n              this.push",
        "            case '[':\n              if (this._stack.length >= 128) return callback(new Error('JSON nesting limit exceeded'));\n              this.push",
      ],
    ],
  },
] as const;
