import { seedHomepage } from "./tasks/special/seedHomepage.ts";
import clearDirectusCache from "./tasks/shared/clearDirectusCache.ts";
if (await seedHomepage()) await clearDirectusCache();
