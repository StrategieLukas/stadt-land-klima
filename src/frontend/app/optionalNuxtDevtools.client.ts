import { optionalDevtools } from "./optionalDevtools";

export default optionalDevtools(() => import("../node_modules/@nuxt/devtools/dist/runtime/plugins/devtools.client.js"));
