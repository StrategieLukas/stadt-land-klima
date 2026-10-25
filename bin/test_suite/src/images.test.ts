import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crc32, inflateSync } from "node:zlib";
import { PNG_1X1 } from "./lib/images.js";
test("PNG fixtures have valid chunk checksums and compressed pixel data under strict image decoders", () => {
  const fixtures = [
    Buffer.from(PNG_1X1),
    readFileSync(new URL("fixtures/tour-portrait.png", import.meta.url)),
    readFileSync(new URL("fixtures/tour-landscape.png", import.meta.url)),
  ];
  for (const png of fixtures) {
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    const compressed: Buffer[] = [];
    for (let offset = 8; offset < png.length;) {
      const size = png.readUInt32BE(offset);
      const kind = png.subarray(offset + 4, offset + 8).toString();
      assert.equal(
        crc32(png.subarray(offset + 4, offset + 8 + size)),
        png.readUInt32BE(offset + 8 + size),
        `${kind} checksum`,
      );
      if (kind === "IDAT") compressed.push(png.subarray(offset + 8, offset + 8 + size));
      offset += size + 12;
    }
    assert.ok(inflateSync(Buffer.concat(compressed)).length);
  }
});
