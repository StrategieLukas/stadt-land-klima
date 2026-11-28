import { defineDisplay } from "@directus/extensions-sdk";
import ThesisCategoryBadges from "./display.vue";

export default defineDisplay({
  id: "slk-thesis-categories",
  name: "$t:theses.categories",
  icon: "school",
  component: ThesisCategoryBadges,
  options: null,
  types: ["json"],
});
