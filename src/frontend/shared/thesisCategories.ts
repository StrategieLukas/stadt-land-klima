export const THESIS_CATEGORIES = ["political_science", "data_science", "climate_action_management"] as const;

/** Preserve earlier item assignments and coalesce topics listed in both sides of a merge. */
export function mergeThesisCategories(categories: readonly unknown[]): unknown[] {
  return [
    ...new Set(
      categories.map((category) => {
        if (category === "public_administration") return "political_science";
        if (category === "computer_and_data_science") return "data_science";
        if (category === "climate_and_environmental_engineering") return "climate_action_management";
        return category;
      }),
    ),
  ];
}
