import { systemLog } from "../utils/securityLogging";
import { fetchStadtlandzahl } from "../utils/stadtlandzahl";

/** A background health probe emits one safe outcome, never an unhandled rejection. */
export default defineNitroPlugin(() => {
  void fetchStadtlandzahl("/api/areas/", { params: { limit: 1 }, timeout: 8000 })
    .then(() => {
      systemLog("info", "nuxt.upstream.ready");
    })
    .catch(() => {
      systemLog("error", "nuxt.upstream.startup_unavailable");
    });
});
