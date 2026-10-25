import assert from "node:assert/strict";
import { test } from "node:test";
import { stringifyRatingReport } from "./reportCsv";

test("rating CSV preserves headers, multiline text, quotes, nulls and numeric ratings", () => {
  assert.equal(
    stringifyRatingReport([{ source: 'first, "quoted"\nsecond', rating: 4, note: null, approved: true }]),
    '"source","rating","note","approved"\n"first, ""quoted""\nsecond","4","","true"\n',
  );
});

test("rating CSV treats spreadsheet formula prefixes as text", () => {
  for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) {
    const csv = stringifyRatingReport([{ source: `${prefix}SUM(1,2)` }]);
    assert.equal(csv, `"source"\n"'${prefix}SUM(1,2)"\n`);
  }
});
