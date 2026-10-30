import type { Sector } from "./domain";

/** Keep chart context when moving from aggregate statistics to an assessment. */
export function municipalityAssessmentHref(
  slug: string,
  catalog: string,
  selection: { measureCode?: string | null; sector?: Sector | null } = {},
) {
  const hash = selection.measureCode
    ? `measure-${selection.measureCode}`
    : selection.sector
      ? `sector-${selection.sector}`
      : "";
  return `/municipalities/${encodeURIComponent(slug)}?${new URLSearchParams({ v: catalog })}${hash ? `#${encodeURIComponent(hash)}` : ""}`;
}
