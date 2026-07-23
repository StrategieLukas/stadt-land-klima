import { definePanel } from "@directus/extensions-sdk";
import PanelComponent from "./panel.vue";

export default definePanel({
  id: "community-activity",
  name: "Lokalteam-Betreuung",
  icon: "monitoring",
  description:
    "Zeigt Lokalteam-Aktivität, Stillstand, auffällige Muster und Katalogübernahme.",
  component: PanelComponent,
  options: [
    {
      field: "defaultDays",
      name: "Standard-Zeitraum",
      type: "integer",
      meta: {
        interface: "select-dropdown",
        width: "half",
        options: {
          choices: [
            { text: "30 Tage", value: 30 },
            { text: "90 Tage", value: 90 },
            { text: "180 Tage", value: 180 },
            { text: "365 Tage", value: 365 },
          ],
        },
      },
      schema: {
        default_value: 30,
      },
    },
  ],
  minWidth: 36,
  minHeight: 18,
});
