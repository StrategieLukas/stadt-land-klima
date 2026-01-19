import path from "path";
import { writeFileSync, unlinkSync } from 'fs';

function jsonToCsv(jsonString) {
    // Parse the JSON string into an object
    const jsonData = JSON.parse(jsonString);
    
    // Get the headers from the keys of the first object
    const headers = Object.keys(jsonData[0]);

    // Map each row in the JSON data to an array of values
    const rows = jsonData.map(row => {
        return headers.map(header => {
            // Handling null values and ensuring quoting if necessary
            const value = row[header] !== null ? row[header] : '';
            return `"${value}"`; // Quoting values to handle commas in the data
        }).join(',');
    });

    // Join the headers and rows into CSV format
    return `${headers.join(',')}\n${rows.join('\n')}`;
}


export default ({ schedule }, { accountability, services, database, getSchema }) => {
	const { MailService, ItemsService } = services

    schedule('*/1 * * * *', async () => {
		console.log("1 minute has passed");

		const schema = await getSchema();

		const mailService = new MailService({
			schema: schema,
			accountability: accountability,
		});

		const itemService_ratingMeasures = new ItemsService("ratings_measures", {
			database,
			schema: schema,
		})

		const ratingMeasures_results = await itemService_ratingMeasures.readByQuery({limit: -1})

		const hookDir = path.join(process.cwd(), "/extensions/directus-extension-hook-measure-rating-reports");
		
        const timestamp = Date.now();
        const fileName = `rating_measures-${timestamp}.csv`;
        const filePath = path.join(hookDir, fileName);

		const csv_string = jsonToCsv(JSON.stringify(ratingMeasures_results))
        writeFileSync(filePath, csv_string, {flag: 'w'});

		// Send Mail
		const subjectLine =
        "Stadt.Land.Klima Wochenbericht";

		const email = "TODO: info@stadt-land-klima.de";
		await mailService.send({
			to: email,
			subject: subjectLine,
			text: 'Please find attached the CSV file.',
			attachments: [
				{
					filename: 'rating_measures.csv',
					path: filePath
				}
			]
		});

		unlinkSync(filePath)

    });
};
