"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const clearDir_js_1 = __importDefault(require("../shared/clearDir.js"));
const clearDirectusCache_js_1 = __importDefault(require("../shared/clearDirectusCache.js"));
const exportSchema_js_1 = __importDefault(require("./exportSchema.js"));
const clearSchema_js_1 = __importDefault(require("./clearSchema.js"));
const exportRoles_js_1 = __importDefault(require("./exportRoles.js"));
const exportPolicies_js_1 = __importDefault(require("./exportPolicies.js"));
const exportPresets_js_1 = __importDefault(require("./exportPresets.js"));
const exportFlows_js_1 = __importDefault(require("./exportFlows.js"));
const exportTranslations_js_1 = __importDefault(require("./exportTranslations.js"));
const exportSettings_js_1 = __importDefault(require("./exportSettings.js"));
const exportCollectionItems_js_1 = __importDefault(require("./exportCollectionItems.js"));
const clerDirOpts = { extensions: ['.yaml'] };
async function clear(dest, options = { verbose: false }) {
    try {
        (0, clearDir_js_1.default)(dest, clerDirOpts);
        if (options.verbose) {
            console.info(`${dest} cleared`);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
function exportTasks(yargs) {
    return yargs
        .command('export:schema [dest]', 'export the schema to the folder specified by "dest". By default it will export into "schema"', (yargs) => {
        return yargs
            .positional('dest', {
            describe: 'destination folder',
            default: 'schema',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Exporting schema to ${argv.dest}`);
        }
        if (argv.clear) {
            (0, clearSchema_js_1.default)(argv.dest, {
                verbose: argv.verbose,
            });
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, exportSchema_js_1.default)(argv.dest, {
            verbose: argv.verbose,
            remove: argv.clear,
        });
    })
        .command('export:policies [dest]', 'export all policies to the folder specified by "dest". By default it will export into "policies". Always clears the directory first.', (yargs) => {
        return yargs
            .positional('dest', {
            describe: 'destination folder',
            default: 'policies',
        });
    }, async (argv) => {
        const dest = argv.dest;
        if (argv.verbose) {
            console.info(`Exporting policies to ${dest}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        // Clear the directory before export (deletes all yaml files)
        if (fs_1.default.existsSync(dest)) {
            (0, clearDir_js_1.default)(dest, { extensions: ['.yaml'] });
        }
        else {
            fs_1.default.mkdirSync(dest, { recursive: true });
        }
        if (argv.verbose) {
            console.info(`${dest} cleared`);
        }
        await (0, exportPolicies_js_1.default)(dest, {
            verbose: argv.verbose,
            overwrite: true,
        });
    })
        .command('export:roles [dest]', 'export all roles to the folder specified by "dest". By default it will export into "roles"', (yargs) => {
        return yargs
            .positional('dest', {
            describe: 'destination folder',
            default: 'roles',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Exporting roles to ${argv.dest}`);
        }
        if (argv.clear) {
            clear(argv.dest, {
                verbose: argv.verbose,
            });
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, exportRoles_js_1.default)(argv.dest, {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
    })
        .command('export:presets [dest]', 'export all presets to the folder specified by "dest". By default it will export into "presets"', (yargs) => {
        return yargs
            .positional('dest', {
            describe: 'destination folder',
            default: 'presets',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Exporting presets to ${argv.dest}`);
        }
        if (argv.clear) {
            clear(argv.dest, {
                verbose: argv.verbose,
            });
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, exportPresets_js_1.default)(argv.dest, {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
    })
        .command('export:flows [dest]', 'export all flows to the folder specified by "dest". By default it will export into "flows"', (yargs) => {
        return yargs
            .positional('dest', {
            describe: 'destination folder',
            default: 'flows',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Exporting flows to ${argv.dest}`);
        }
        if (argv.clear) {
            clear(argv.dest, {
                verbose: argv.verbose,
            });
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, exportFlows_js_1.default)(argv.dest, {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
    })
        .command('export:translations [dest]', 'export all translations to the folder specified by "dest". By default it will export into "translations"', (yargs) => {
        return yargs
            .positional('dest', {
            describe: 'destination folder',
            default: 'translations',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Exporting translations to ${argv.dest}`);
        }
        if (argv.clear) {
            clear(argv.dest, {
                verbose: argv.verbose,
            });
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, exportTranslations_js_1.default)(argv.dest, {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
    })
        .command('export:settings [dest]', 'export all settings to the folder specified by "dest". By default it will export into "settings"', (yargs) => {
        return yargs
            .positional('dest', {
            describe: 'destination folder',
            default: 'settings',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Exporting settings to ${argv.dest}`);
        }
        if (argv.clear) {
            clear(argv.dest, {
                verbose: argv.verbose,
            });
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, exportSettings_js_1.default)(argv.dest, {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
    })
        .command('export:all [dest]', 'export schema, policies, roles, flows, presets, translations, and settings consecutively. In v11+, policies are exported separately from roles.', (yargs) => {
        return yargs
            .positional('dest', {
            describe: 'base destination folder (default: current directory)',
            default: '.',
        });
    }, async (argv) => {
        const startTime = Date.now();
        const dest = argv.dest;
        console.info('Starting full export...');
        // Clear cache once at the beginning
        console.info('Clearing cache...');
        await (0, clearDirectusCache_js_1.default)();
        // Export schema
        console.info('Exporting schema...');
        if (argv.clear) {
            (0, clearSchema_js_1.default)(path_1.default.join(dest, 'schema'), { verbose: argv.verbose });
        }
        await (0, exportSchema_js_1.default)(path_1.default.join(dest, 'schema'), {
            verbose: argv.verbose,
            remove: argv.clear,
        });
        // Export policies (separate from roles in v11+)
        console.info('Exporting policies...');
        if (argv.clear) {
            clear(path_1.default.join(dest, 'policies'), { verbose: argv.verbose });
        }
        await (0, exportPolicies_js_1.default)(path_1.default.join(dest, 'policies'), {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
        // Export roles
        console.info('Exporting roles...');
        if (argv.clear) {
            clear(path_1.default.join(dest, 'roles'), { verbose: argv.verbose });
        }
        await (0, exportRoles_js_1.default)(path_1.default.join(dest, 'roles'), {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
        // Export flows
        console.info('Exporting flows...');
        if (argv.clear) {
            clear(path_1.default.join(dest, 'flows'), { verbose: argv.verbose });
        }
        await (0, exportFlows_js_1.default)(path_1.default.join(dest, 'flows'), {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
        // Export presets
        console.info('Exporting presets...');
        if (argv.clear) {
            clear(path_1.default.join(dest, 'presets'), { verbose: argv.verbose });
        }
        await (0, exportPresets_js_1.default)(path_1.default.join(dest, 'presets'), {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
        // Export translations
        console.info('Exporting translations...');
        if (argv.clear) {
            clear(path_1.default.join(dest, 'translations'), { verbose: argv.verbose });
        }
        await (0, exportTranslations_js_1.default)(path_1.default.join(dest, 'translations'), {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
        // Export settings
        console.info('Exporting settings...');
        if (argv.clear) {
            clear(path_1.default.join(dest, 'settings'), { verbose: argv.verbose });
        }
        await (0, exportSettings_js_1.default)(path_1.default.join(dest, 'settings'), {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.info(`Full export completed in ${elapsed}s`);
    })
        .command('export:items [collection] [dest]', 'export all items of a collection to the folder specified by "dest". By default it will export into "contents"', (yargs) => {
        return yargs
            .positional('collection', {
            describe: 'collection to export',
            required: true,
        })
            .positional('dest', {
            describe: 'destination folder',
            default: 'contents',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Exporting ${argv.collection} items to ${argv.dest}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, exportCollectionItems_js_1.default)(argv.collection, argv.dest, {
            verbose: argv.verbose,
            overwrite: argv.force,
        });
    })
        .option('clear', {
        alias: 'c',
        type: 'boolean',
        description: 'Clear existing files',
    })
        .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Overwrite existing files',
    })
        .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging',
    });
}
exports.default = exportTasks;
//# sourceMappingURL=index.js.map