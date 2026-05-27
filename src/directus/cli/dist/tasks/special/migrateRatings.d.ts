/**
 * Migrate ratings between two measure catalog versions (oldVersion → newVersion)
 *
 * @param oldVersion - e.g. "beta"
 * @param newVersion - e.g. "v1.0"
 */
declare function migrateRatings(oldVersion: string, newVersion: string): Promise<void>;
export default migrateRatings;
//# sourceMappingURL=migrateRatings.d.ts.map