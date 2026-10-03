import { definePanel } from "@directus/extensions-sdk";
import PanelComponent from "./panel.vue";

export default definePanel({
  id: "erfolgsprojekte-user-manager",
  name: "Erfolgsprojekte-Redaktion",
  icon: "person_add",
  description: "Lädt neue Redakteur:innen für Erfolgsprojekte ein.",
  component: PanelComponent,
  options: [],
  minWidth: 24,
  minHeight: 12,
});
