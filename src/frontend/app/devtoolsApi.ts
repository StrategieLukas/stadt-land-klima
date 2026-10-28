// Vue Router imports this API before Nuxt starts. The browser entry eagerly
// initializes storage, so use the package's own no-op entry in restricted frames.
let enabled = false;
try {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && window.self === window.top) {
    window.localStorage.getItem("nuxt-devtools-frame-state");
    enabled = true;
  }
} catch {
  // Cookie/storage blocking is a supported browser setting.
}

const api = enabled
  ? await import("../node_modules/@vue/devtools-api/dist/index.js")
  : await import("../node_modules/@vue/devtools-api/dist/index-node.js");

export const {
  addCustomCommand,
  addCustomTab,
  onDevToolsClientConnected,
  onDevToolsConnected,
  removeCustomCommand,
  setupDevToolsPlugin,
  setupDevtoolsPlugin,
} = api;
export type { CustomCommand, CustomTab } from "../node_modules/@vue/devtools-api/dist/index.js";
