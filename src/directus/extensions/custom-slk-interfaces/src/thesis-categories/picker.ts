import { defineInterface } from "@directus/extensions-sdk";
import ThesisCategoryPicker from "./picker.vue";

export default defineInterface({
  id: "slk-thesis-category-picker",
  name: "$t:theses.categories",
  icon: "school",
  component: ThesisCategoryPicker,
  options: null,
  types: ["json"],
});
