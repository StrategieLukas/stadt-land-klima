/** Population is authoritative; legacy type is a fallback when population is absent. */
export function municipalityType(municipality: {
  population?: number | string | null | undefined;
  municipality_type?: string | null | undefined;
}): "big_city" | "small_city" | null {
  const population =
    municipality.population == null || municipality.population === "" ? NaN : Number(municipality.population);
  if (Number.isFinite(population) && population > 0) return population >= 100000 ? "big_city" : "small_city";
  return municipality.municipality_type === "big_city" || municipality.municipality_type === "small_city"
    ? municipality.municipality_type
    : null;
}
