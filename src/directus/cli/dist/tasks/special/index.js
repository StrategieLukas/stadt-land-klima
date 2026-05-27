"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = specialTasks;
const clearDirectusCache_js_1 = __importDefault(require("../shared/clearDirectusCache.js"));
const migrateRatings_js_1 = __importDefault(require("./migrateRatings.js"));
function specialTasks(yargs) {
    return yargs
        .command('migrate [old] [new]', 'migrates all ratings from the old version of the measure catalog to the new version', (yargs) => {
        return yargs
            .positional('old', {
            describe: 'old version',
        })
            .positional('new', {
            describe: 'new version',
        });
    }, async (argv) => {
        console.info(`Migrating ratings from ${argv.old} to ${argv.new}`);
        await (0, clearDirectusCache_js_1.default)();
        await (0, migrateRatings_js_1.default)(argv.old, argv.new);
    });
}
//# sourceMappingURL=index.js.map