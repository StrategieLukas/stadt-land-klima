import { stringify } from "csv-stringify/sync";

export function stringifyRatingReport(rows: object[]): string {
  return stringify(rows, {
    header: true,
    quoted: true,
    quoted_empty: true,
    escape_formulas: true,
    cast: { boolean: (value) => String(value) },
  });
}
