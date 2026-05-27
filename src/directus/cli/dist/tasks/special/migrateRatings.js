"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
const sdk_1 = require("@directus/sdk");
/**
 * Migrate ratings between two measure catalog versions (oldVersion → newVersion)
 *
 * @param oldVersion - e.g. "beta"
 * @param newVersion - e.g. "v1.0"
 */
async function migrateRatings(oldVersion, newVersion) {
    if (!oldVersion || !newVersion) {
        console.error("❌ Missing arguments: migrateRatings(oldVersion, newVersion)");
        console.error("Example: migrateRatings('beta', 'v1.0')");
        process.exit(1);
    }
    const client = (0, createDirectusClient_js_1.default)();
    // Check if user input refers to valid versions
    console.log("📥 Fetching measure catalog versions...");
    // ✅ Validate both catalog versions exist in measure_catalog
    const catalogs = (await client.request((0, sdk_1.readItems)("measure_catalog", {
        filter: { name: { _in: [oldVersion, newVersion] } },
        fields: ["id", "name"],
    })));
    const oldCatalog = catalogs.find((c) => c.name === oldVersion);
    const newCatalog = catalogs.find((c) => c.name === newVersion);
    if (!oldCatalog || !newCatalog) {
        console.error(`❌ Version(s) not found in measure_catalog: missing ${[!oldCatalog ? oldVersion : "", !newCatalog ? newVersion : ""].filter(Boolean).join(", ")}`);
        process.exit(1);
    }
    console.log(`📚 Found catalog entries: ${oldCatalog.name} (id=${oldCatalog.id}), ${newCatalog.name} (id=${newCatalog.id})`);
    // Safety confirmation
    const rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout });
    const confirm = await new Promise((resolve) => {
        rl.question(`⚠️  This will copy ratings from "${oldVersion}" → "${newVersion}".\n` +
            `Are you absolutely sure you want to continue? (yes/no): `, (answer) => resolve(answer.trim().toLowerCase()));
    });
    rl.close();
    if (confirm !== "yes") {
        console.log("🛑 Aborted by user.");
        process.exit(0);
    }
    console.log(`\n🚀 Starting migration: ${oldVersion} → ${newVersion}`);
    const startTime = Date.now();
    try {
        console.log("📥 Fetching measures...");
        const [oldMeasures, newMeasures] = await Promise.all([
            client.request((0, sdk_1.readItems)("measures", {
                filter: { catalog_version: { _eq: oldCatalog.id }, status: { _eq: "published" } },
                fields: ["id", "measure_id"],
                limit: -1,
            })),
            client.request((0, sdk_1.readItems)("measures", {
                filter: { catalog_version: { _eq: newCatalog.id }, status: { _eq: "published" } },
                fields: ["id", "measure_id", "must_be_rated_again"],
                limit: -1,
            })),
        ]);
        console.log(`📊 Measures loaded: ${oldMeasures.length} (${oldVersion}) | ${newMeasures.length} (${newVersion})`);
        // Build lookup maps and find common measure_ids
        const oldMap = new Map(oldMeasures.map((m) => [m.measure_id, m]));
        const newMap = new Map(newMeasures.map((m) => [m.measure_id, m]));
        const commonMeasureIds = [...oldMap.keys()].filter((id) => newMap.has(id));
        console.log(`🔗 Found ${commonMeasureIds.length} measures existing in both catalogs:\n  ${commonMeasureIds.join(", ")}`);
        let updatedCount = 0;
        // Process each shared measure
        for (const measureId of commonMeasureIds) {
            const oldMeasure = oldMap.get(measureId);
            const newMeasure = newMap.get(measureId);
            console.log(`\n➡️ Processing measure "${measureId}".`);
            // Load ratings for both versions
            const oldRatings = (await client.request((0, sdk_1.readItems)("ratings_measures", {
                filter: { measure_id: { _eq: oldMeasure.id } },
                fields: [
                    "id",
                    "localteam_id",
                    "internal_note",
                    "status",
                    "applicable",
                    "why_not_applicable",
                    "rating",
                    "current_progress",
                    "source",
                ],
                limit: -1,
            })));
            const newRatings = (await client.request((0, sdk_1.readItems)("ratings_measures", {
                filter: { measure_id: { _eq: newMeasure.id } },
                fields: ["id", "localteam_id"],
                limit: -1,
            })));
            console.log(`   🧮 ${oldRatings.length} old → ${newRatings.length} new ratings`);
            if (oldRatings.length !== newRatings.length) {
                console.warn("Amount of new and old ratings should be identical, were some manually deleted?");
            }
            if (oldRatings.length === 0 || newRatings.length === 0)
                continue;
            const newByLocalteam = new Map(newRatings.map((r) => [r.localteam_id, r]));
            const mustBeRatedAgain = !!newMeasure.must_be_rated_again;
            if (mustBeRatedAgain) {
                console.log(`\n Measure "${measureId}" must be rated again, so only copying over internal note...`);
            }
            else {
                console.log(`\n Measure "${measureId}" must NOT be rated again, so copying over the entire rating info...`);
            }
            let updatedForThisMeasure = 0;
            let hasLoggedDetailedError = false;
            for (const oldRating of oldRatings) {
                const target = newByLocalteam.get(oldRating.localteam_id);
                if (!target)
                    continue;
                const updateData = mustBeRatedAgain
                    ? { internal_note: oldRating.internal_note }
                    : {
                        internal_note: oldRating.internal_note,
                        status: oldRating.status,
                        applicable: oldRating.applicable,
                        why_not_applicable: oldRating.why_not_applicable,
                        rating: oldRating.rating,
                        current_progress: oldRating.current_progress,
                        source: oldRating.source,
                    };
                try {
                    await client.request((0, sdk_1.updateItem)("ratings_measures", target.id, updateData));
                    updatedCount++;
                    updatedForThisMeasure++;
                }
                catch (err) {
                    // Log the first error in full detail, but not repeats
                    if (!hasLoggedDetailedError) {
                        console.log(err);
                        console.log(updateData);
                        hasLoggedDetailedError = true;
                    }
                    console.error(`   ❌ Failed to update rating for localteam ${oldRating.localteam_id}: ${err.message}`);
                }
            }
            console.log(`   ✅ Updated ${updatedForThisMeasure} ratings for measure "${measureId}"`);
        }
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 Migration complete: ${updatedCount} ratings updated in ${elapsed}s`);
    }
    catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}
exports.default = migrateRatings;
//# sourceMappingURL=migrateRatings.js.map