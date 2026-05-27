import path from "path";
import { writeFileSync, unlinkSync } from 'fs';
import csvjson from "csvjson";
import type { Accountability, Database, Schema, Services } from '@directus/types';

interface RatingMeasure {
  applicable?: boolean;
  approved?: boolean;
  choices?: any;
  current_progress?: number;
  date_created?: string;
  date_updated?: string;
  measure_published?: any;
  rating?: number;
  source?: string;
  status?: string;
  id?: number;
  localteam_id?: {
    municipality_id?: {
      name?: string;
    };
  };
  measure_id?: {
    catalog_version?: {
      name?: string;
      id?: number;
    };
    date_updated?: string;
    measure_id?: number;
    must_be_rated_again?: boolean;
    name?: string;
  };
}

interface HookContext {
  schedule: (cron: string, handler: () => Promise<void>) => void;
  accountability: Accountability;
  services: Services;
  database: Database;
  getSchema: () => Promise<Schema>;
}

export default ({ schedule }: HookContext, { accountability, services, database, getSchema }: {
  accountability: Accountability;
  services: Services;
  database: Database;
  getSchema: () => Promise<Schema>;
}) => {
	const { MailService, ItemsService } = services;

	// const period = '*/1 * * * *' // Every 1 minute
	const period = '0 0 * * 0'; // At 00:00 on Sunday.
    
	schedule(period, async () => {
		// console.log("create and send rating measure report");

		const schema = await getSchema();

		// Request data
		const itemService_ratingMeasures = new ItemsService("ratings_measures", {
			database,
			schema: schema,
		});

		const ratingMeasures_results = await itemService_ratingMeasures.readByQuery({
			limit: -1,
			fields: ["applicable", "approved", "choices", "current_progress", "date_created", "date_updated", 
				"measure_published", "rating", "source", "status",
				"id",
				"localteam_id.municipality_id.name",
				"measure_id.catalog_version.name",
				"measure_id.catalog_version.id",
				"measure_id.date_updated",
				"measure_id.measure_id",
				"measure_id.must_be_rated_again",
				"measure_id.name"
			]
		}) as RatingMeasure[];

		// Create CSV File
		const hookDir = path.join(process.cwd(), "/extensions/directus-extension-hook-measure-rating-reports");
		
		const d = new Date(); // Create a new Date object
		const timestamp = d.getDate() + "-" + (d.getMonth() + 1) + "-" + d.getFullYear();
		const fileName = `rating_measures-${timestamp}.csv`;
      const filePath = path.join(hookDir, fileName);

		const options = {
			delimiter: ",",
			wrap: true
		};

		const csv_string = csvjson.toCSV(ratingMeasures_results, options);
      
		writeFileSync(filePath, csv_string, { flag: 'w' });

		// Send Mail
		const mailService = new MailService({
			schema: schema,
			accountability: accountability,
		});

		const subjectLine = "Stadt.Land.Klima Wochenbericht";

		const email = "massnahmen@stadt-land-klima.de";
		await mailService.send({
			to: email,
			subject: subjectLine,
			text: 'Please find attached the CSV file.',
			attachments: [
				{
					filename: fileName,
					path: filePath
				}
			]
		});

		// Delete CSV File
		unlinkSync(filePath);

    });
};
