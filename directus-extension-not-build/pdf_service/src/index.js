import path from "path";
import {  execFile } from "child_process";

// ROUTES ---------------------------------------------------------------------
export default {
    id: 'pdf-service',
    handler: async (router, { services, getSchema }) => {

        const { ItemsService } = services;

        router.get('/', (req, res) => res.send('Hello, World!'));
        router.post('/test', async (req, res) => {
            let accountability = res.accountability     // this is undefined
            // console.log(res.accountability.ip)
            // accountability.admin = true
            const schema = await getSchema()
            console.log(req)
            const municipality = req.body.municipality;
            if (!municipality) {
                return res.status(400).send("Missing 'municipality' parameter");
            }
            console.log(municipality)
            
            console.log(accountability)

            
            try{
                const itemService = new ItemsService('municipalities', {
                    schema,
                    accountability
                });
                const data = await itemService.readOne(municipality);
                if ( data == null) {
                    res.status(403);
                    return res.send(`You don't have permission to access this.`);
                }
                console.log(data)
            }
            catch(error){
                console.log("eror", error)
            }

            // const items = await client.request(readItems("measures", {}));
            // console.log(items)
            const sampleData = {
                municipality: municipality,
                state: "Sachsen",
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
            
            

            try {
                const typstDir = path.join(process.cwd(), "/extensions/directus-extension-pdf-service/dist/typst");
                
                const typFilePath = path.join(typstDir, "municpality_overview.typ");
                
                const args = [
                    "compile",
                    "--input", `data=${JSON.stringify(sampleData)}`,
                    "--font-path", `${typstDir}/fonts`,
                    typFilePath,
                    "-" // write PDF to stdout
                ];

                execFile("typst", args, { maxBuffer: 1024 * 1024 * 50, encoding: "buffer" }, (err, stdout, stderr) => {
                    if (err) {
                        console.error("error:", err);
                        return;
                    }
                    if (stderr && stderr.length) {
                        console.error("typst stderr:", stderr.toString());
                        // continue — typst may print warnings to stderr
                    }

                    const pdfBuffer = Buffer.from(stdout); // stdout is already a Buffer due to encoding: "buffer"
                    // send to client:
                    res.setHeader("Content-Type", "application/pdf");
                    res.setHeader("Content-Disposition", 'inline; filename="output.pdf"');
                    res.status(200).send(pdfBuffer);
                });

            } catch (err) {
                res.status(500).send("PDF generation failed");
            }
        });
    },
};