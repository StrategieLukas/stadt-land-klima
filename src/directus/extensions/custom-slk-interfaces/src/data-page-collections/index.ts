import type { DirectusInterfaceConfig } from "../types";
import InterfaceComponent from "./interface.vue";

const config: DirectusInterfaceConfig = {
  id: "data-page-collections",
  name: "Data Page Collections",
  icon: "dataset",
  description: "Choose which Stadtlandzahl collections appear on data pages",
  component: InterfaceComponent,
  types: ["json"],
  group: "selection",
  options: null,
};

export default config;
