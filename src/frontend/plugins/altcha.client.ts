// Registers the <altcha-widget> web component on the client side.
// Importing the package is enough — it self-registers the custom element.
import "altcha/external";
import "altcha/altcha.css";
import ShaWorker from "altcha/workers/sha?worker";

// The external bundle deliberately excludes workers. Register the server's
// one supported algorithm using a same-origin Vite worker asset.
$altcha.algorithms.set("SHA-256", () => new ShaWorker());

export default defineNuxtPlugin(() => {});
