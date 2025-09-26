import path from "path";
import { execFile } from "child_process";

export default {
  id: 'pdf-service',
  handler: async (router, { services, getSchema }) => {
    const { ItemsService } = services;

    router.get('/', (req, res) => res.send('Hello, World!'));

    router.post('/municipality/:slug', async (req, res) => {
      const accountability = req.accountability; // use frontend user's auth
      const schema = await getSchema();
      const municipalitySlug = req.params.slug;

      if (!municipalitySlug) {
        return res.status(400).send("Missing municipality slug in path");
      }

      try {
        const itemService = new ItemsService('municipalities', { schema, accountability });

        // Query by slug
        const results = await itemService.readByQuery({
          filter: { slug: { _eq: municipalitySlug } },
          limit: 1
        });

        if (!results || !results[0]) {
          return res.status(404).send(`Municipality "${municipalitySlug}" not found or access denied`);
        }

        const municipality = results[0];

        // Sample PDF data
        const sampleData = {
          municipality: municipalitySlug,
          state: municipality.state || "Unknown",
          ranking: 43,
          circular_barplot_values: {
            energy: 20,
            transport: 40,
            ann: 60,
            iec: 80,
            bh: 15,
            cpma: 100,
          },
          progress: 22
        };

        const typstDir = path.join(process.cwd(), "/extensions/directus-extension-pdf-service/dist/typst");
        const typFilePath = path.join(typstDir, "municpality_overview.typ");

        const args = [
          "compile",
          "--input", `data=${JSON.stringify(sampleData)}`,
          "--font-path", `${typstDir}/fonts`,
          typFilePath,
          "-"
        ];

        execFile("typst", args, { maxBuffer: 1024 * 1024 * 50, encoding: "buffer" }, (err, stdout, stderr) => {
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
