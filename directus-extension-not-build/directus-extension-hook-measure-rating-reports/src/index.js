import path from "path";
import { writeFileSync } from 'fs';

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


export default ({ schedule }, { services, database, getSchema }) => {
	const { ItemsService } = services

    schedule('*/1 * * * *', async () => {
		console.log("1 minute has passed");

		const itemService_ratingMeasures = new ItemsService("ratings_measures", {
			database,
			schema: await getSchema(),
		})

		const ratingMeasures_results = await itemService_ratingMeasures.readByQuery({limit: -1})

		const hookDir = path.join(process.cwd(), "/extensions/directus-extension-hook-measure-rating-reports");
		
        const timestamp = Date.now();
        const fileName = `timestamp-${timestamp}.txt`;
        const filePath = path.join(hookDir, fileName);

		const csv_string = jsonToCsv(JSON.stringify(ratingMeasures_results))
        writeFileSync(filePath, csv_string, {flag: 'w'});

    });
};
