
export default {
	id: 'operation-calculateScores',
	handler: async({ keys },  { env, logger, accountability, services, getSchema }) => {
		try {
			
		  
	  
		const { ItemsService } = services;
		const schema = await getSchema();

		logger.info(accountability, "accountability");
		logger.info(keys, "keys");
		accountability.admin=true;
		const rankinsMeasuresService = new ItemsService("ratings_measures", { schema, accountability });
		const measuresService = new ItemsService("measures", { schema, accountability });

		let queryAll= {
						"query": {
						"limit": -1
						}
					}
				
		
		
	
		
		const rankins_measures = await rankinsMeasuresService.readMany(keys,queryAll);
		const measures = await measuresService.readByQuery(queryAll);
		logger.info(rankins_measures, "ratings_measures");
		logger.info(measures, "measures");
		Object.entries(res).forEach((entry) => {
			const [key, value] = entry;
			console.log(`${key}: ${value}`);
		  });
		  let  arrayChangedRatings = data["$last"];
		  let uniqueMeasuresIds=[];
		  let uniqueMeasures = arrayChangedRatings.filter((item, index, array) => {
			  // Use indexOf to find the first occurrence of the current item
			  const firstIndex = array.findIndex((element) =>  element["measure_id"] === item["measure_id"]);
		  
			  // If the current item is the first occurrence in the array, keep it and push to Ids array
			  if(index === firstIndex){
				  uniqueMeasuresIds.push(array[index].id);
			  }
			  return index === firstIndex;
			});
		  uniqueMeasures["Ids"]=uniqueMeasuresIds;
		  return {uniqueMeasures}; 	
		
	} catch (e) {
		logger.info(e)
	  }
		return{
			
			/* text: slugify(text, {
				replacement: '-',  // replace spaces with replacement character, defaults to `-`
				remove: undefined, // remove characters that match regex, defaults to `undefined`
				lower: true,      // convert to lower case, defaults to `false`
				strict: true,     // strip special characters except replacement, defaults to `false`
				locale: 'de',      // language code of the locale to use
				trim: true         // trim leading and trailing replacement chars, defaults to `true`
			  }) */
		}
	},
};
