import path from "path";
import { execFile } from "child_process";
import { writeFileSync, unlinkSync } from 'fs';

function sortMeasuresBySector(ratingsMeasuresArr, measuresArr) {
  if (!Array.isArray(ratingsMeasuresArr) || !Array.isArray(measuresArr)) {
    return {};
  }
  const measureMap = new Map(measuresArr.map((measure) => [measure.id, measure]));
  const dictMeasuresRatingSorted = {};

  for (const item of ratingsMeasuresArr) {
    const measure = measureMap.get(item.measure_id);
    if (measure) {
      const { sector } = measure;
      item.measure = measure;
      dictMeasuresRatingSorted[sector] = dictMeasuresRatingSorted[sector] || [];
      dictMeasuresRatingSorted[sector].push(item);
    }
  }
  return dictMeasuresRatingSorted;
}

export default {
  id: 'pdf-service',
  handler: async (router, { services, getSchema }) => {
    const { ItemsService } = services;

    router.get('/', (req, res) => res.send('Hello, World!'));

    router.post('/municipality/:slug/:version', async (req, res) => {
      const accountability = req.accountability; // use frontend user's auth
      const schema = await getSchema();
      const municipalitySlug = req.params.slug;
      const catalogVersionName = req.params.version;

      if (!municipalitySlug) {
        return res.status(400).send("Missing municipality slug in path");
      }

      try {
        const municipalityScoreService = new ItemsService('municipality_scores', { schema, accountability });
        const municipalityScores = await municipalityScoreService.readByQuery({
          fields: ["date_updated", "score_total", "score_buildings", "score_energy", "score_transport", "score_industry",
          "score_management", "score_agriculture", "percentage_rated", "rank",
          // municipality fields
          "municipality.id", "municipality.name", "municipality.slug", "municipality.localteam_id", "municipality.population",
          "municipality.state", "municipality.overall_status_comment",
          ],
          filter: { catalog_version: { name: { _eq: catalogVersionName } }, municipality: { slug: { _eq: municipalitySlug}}},
          limit: 1
        });

        if (!municipalityScores || !municipalityScores[0]) {
          return res.status(404).send(`No scores found for municipality "${municipalitySlug}" or access denied`);
        }

        const municipalityScore = municipalityScores[0];
        console.log(municipalityScore);

        // Query measures
        const itemService_measures = new ItemsService('measures', { schema, accountability });
        const measures_results = await itemService_measures.readByQuery({})

        if (!measures_results) {
          return res.status(404).send(`Measures not found or access denied`);
        }

        // Query rating measures by localteam_id
        const itemService_ratingMeasures = new ItemsService('ratings_measures', { schema, accountability })
        const ratingMeasures_results = await itemService_ratingMeasures.readByQuery({
          filter: { localteam_id: {_eq: municipalityScore.municipality.localteam_id}}
        })

        if (!ratingMeasures_results) {
          return res.status(404).send(`Rating measures not found or access denied`);
        }

        // Sort Measures
        const sorted_measures = sortMeasuresBySector(ratingMeasures_results, measures_results)
//        console.log(sorted_measures);

        const typstDir = path.join(process.cwd(), "/extensions/directus-extension-endpoint-pdf-service/typst");
        const typstFilePath = path.join(typstDir, "municipality_summary.typ");
        // writeFileSync(`${typstDir}/sorted_measures.json`, JSON.stringify(sorted_measures, null, 2));

        // Create temporary files for municipality and measures
        const timestamp = Date.now();
        const municipalityScoreFile = `municipalityScore_${timestamp}.json`;
        const measuresFile = `measures_${timestamp}.json`;
        const municipalityScoreFilePath = path.join(typstDir, municipalityScoreFile);
        const measuresFilePath = path.join(typstDir, measuresFile);

        writeFileSync(municipalityScoreFilePath, JSON.stringify(municipalityScore));
        writeFileSync(measuresFilePath, JSON.stringify(sorted_measures));
        const args = [
          "compile",
          "--input", `municipalityScore=${municipalityScoreFile}`,
          "--input", `measures=${measuresFile}`,
          "--font-path", `${typstDir}/fonts`,
          typstFilePath,
          "-"
        ];

        execFile("typst", args, { maxBuffer: 1024 * 1024 * 50, encoding: "buffer" }, (err, stdout, stderr) => {
          // Cleanup temporary files after execution
          try {
            unlinkSync(municipalityScoreFilePath);
            unlinkSync(measuresFilePath);
          } catch (cleanupErr) {
            console.error("Error cleaning up temporary files:", cleanupErr);
          }

          if (err) {
            console.error("Typst error:", err);
            return res.status(500).send("PDF generation failed");
          }
          if (stderr && stderr.length) console.warn("Typst warnings:", stderr.toString());

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", 'inline; filename="output.pdf"');
          res.status(200).send(stdout);
        });

      } catch (error) {
        console.error("Error fetching municipality:", error);
        return res.status(500).send("Server error");
      }
    });
  },
};
