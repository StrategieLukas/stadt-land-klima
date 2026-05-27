"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const clearDirectusCache_js_1 = __importDefault(require("../shared/clearDirectusCache.js"));
const importSchema_js_1 = __importDefault(require("./importSchema.js"));
const importRoles_js_1 = __importDefault(require("./importRoles.js"));
const importPolicies_js_1 = __importDefault(require("./importPolicies.js"));
const importRolesAndPolicies_js_1 = __importDefault(require("./importRolesAndPolicies.js"));
const importPresets_js_1 = __importDefault(require("./importPresets.js"));
const importFlows_js_1 = __importDefault(require("./importFlows.js"));
const importTranslations_js_1 = __importDefault(require("./importTranslations.js"));
const importSettings_js_1 = __importDefault(require("./importSettings.js"));
const importCollectionItems_js_1 = __importDefault(require("./importCollectionItems.js"));
function importTasks(yargs) {
    return yargs
        .command('import:schema [src]', 'imports the schema from the folder specified by "src". By default it will import from "schema"', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'source folder',
            default: 'schema',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Importing schema from ${argv.src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importSchema_js_1.default)(argv.src, {
            verbose: argv.verbose,
        });
    })
        .command('import:policies [src]', 'imports the policies from the folder specified by "src". By default it will import from "policies"', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'source folder',
            default: 'policies',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Importing policies from ${argv.src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importPolicies_js_1.default)(argv.src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
    })
        .command('import:roles [src]', 'imports the roles from the folder specified by "src". By default it will import from "roles". NOTE: Import policies first, as roles reference policies by ID.', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'source folder',
            default: 'roles',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Importing roles from ${argv.src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importRoles_js_1.default)(argv.src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
    })
        .command('import:roles-and-policies [src]', 'imports roles and policies from the folder specified by "src". Expects policies/ and roles/ subdirectories. By default imports from current directory.', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'source folder containing policies/ and roles/ subdirectories',
            default: '.',
        });
    }, async (argv) => {
        const src = argv.src;
        if (argv.verbose) {
            console.info(`Importing roles and policies from ${src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importRolesAndPolicies_js_1.default)(src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
    })
        .command('import:presets [src]', 'imports the presets from the folder specified by "src". By default it will import from "presets"', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'source folder',
            default: 'presets',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Importing presets from ${argv.src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importPresets_js_1.default)(argv.src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
    })
        .command('import:flows [src]', 'imports the flows from the folder specified by "src". By default it will import from "flows"', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'source folder',
            default: 'flows',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Importing flows from ${argv.src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importFlows_js_1.default)(argv.src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
    })
        .command('import:translations [src]', 'imports the translations from the folder specified by "src". By default it will import from "translations"', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'source folder',
            default: 'translations',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Importing translations from ${argv.src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importTranslations_js_1.default)(argv.src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
    })
        .command('import:settings [src]', 'imports the settings from the folder specified by "src". By default it will import from "settings"', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'source folder',
            default: 'settings',
        });
    }, async (argv) => {
        if (argv.verbose) {
            console.info(`Importing settings from ${argv.src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importSettings_js_1.default)(argv.src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
    })
        .command('import:all [src]', 'imports schema, policies, roles, flows, presets, translations, and settings consecutively. In v11+, policies are imported before roles.', (yargs) => {
        return yargs
            .positional('src', {
            describe: 'base folder for all imports (default: current directory)',
            default: '.',
        });
    }, async (argv) => {
        const startTime = Date.now();
        const src = argv.src;
        console.info('Starting full import...');
        // Clear cache once at the beginning
        console.info('Clearing cache...');
        await (0, clearDirectusCache_js_1.default)();
        // Import schema
        console.info('Importing schema...');
        await (0, importSchema_js_1.default)(path_1.default.join(src, 'schema'), {
            verbose: argv.verbose,
        });
        // Import policies and roles together (policies must be before roles in v11+)
        console.info('Importing policies and roles...');
        await (0, importRolesAndPolicies_js_1.default)(src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
        // Import flows
        console.info('Importing flows...');
        await (0, importFlows_js_1.default)(path_1.default.join(src, 'flows'), {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
        // Import presets
        console.info('Importing presets...');
        await (0, importPresets_js_1.default)(path_1.default.join(src, 'presets'), {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
        // Import translations
        console.info('Importing translations...');
        await (0, importTranslations_js_1.default)(path_1.default.join(src, 'translations'), {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
        // Import settings
        console.info('Importing settings...');
        await (0, importSettings_js_1.default)(path_1.default.join(src, 'settings'), {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.info(`Full import completed in ${elapsed}s`);
    })
        .command('import:items [collection] [src]', 'imports the items of a collection from a file specified by "src". By default it will import from "contents/{collection}.yaml"', (yargs) => {
        return yargs
            .positional('collection', {
            describe: 'collection to import',
            required: true,
        })
            .positional('src', {
            describe: 'source file',
            default: '',
        });
    }, async (argv) => {
        const src = argv.src || path_1.default.join('contents', argv.collection + '.yaml');
        if (argv.verbose) {
            console.info(`Importing ${argv.collection} items from ${src}`);
        }
        await (0, clearDirectusCache_js_1.default)();
        await (0, importCollectionItems_js_1.default)(argv.collection, src, {
            verbose: argv.verbose,
            remove: argv.removeOrphans,
            overwrite: argv.force,
        });
    })
        .option('remove-orphans', {
        alias: 'r',
        type: 'boolean',
        description: 'Removes orphan entries not present in the imported data.',
    })
        .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Overwrite existing entries',
    })
        .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging',
    });
}
exports.default = importTasks;
//# sourceMappingURL=index.js.map