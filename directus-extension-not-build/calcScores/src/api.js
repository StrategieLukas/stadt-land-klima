
export default {
	id: 'operation-calculateScores',
	handler: async ({ keys }, { env, logger, accountability, services, getSchema, database }) => {
		try {



			const { ItemsService } = services;
			const schema = await getSchema();

			logger.info(accountability, "accountability");
			logger.info(keys, "keys");
			accountability.admin = true;
			const rantingsMeasuresService = new ItemsService("ratings_measures", { schema, accountability });
			const measuresService = new ItemsService("measures", { schema, accountability });
			const municipalitiesService = new ItemsService("municipalities", { schema, accountability });
			let query = {
				limit: -1
			}

			const ratings_measures = await rantingsMeasuresService.readMany(keys, query);
			const measures = await measuresService.readByQuery(query);
			logger.info(ratings_measures, "ratings_measures");
			logger.info(measures, "measures");
			const municipalitiesToRead = Object.values(ratings_measures)
				.filter(value => value.status === "published") //TODO ggf rausnehemn
				.map(value => value.localteam_id);
			if (municipalitiesToRead.length === 0) {
					logger.info("NOthing to recalc");
					return;
				}
			const scoreDict = {};
			ratings_measures.forEach(item1 => {
				const item2 = measures.find(item2 => item2.id === item1.measure_id);
				if (item2 !== undefined) {
					scoreDict[item2.sector] = {
						denominator: 0,
						numerator: 0
					};
				}
			});
			scoreDict["total"] = {
				denominator: 0,
				numerator: 0
			};
			
			logger.info(municipalitiesToRead, "municipalitiesToRead");
			logger.info(scoreDict, "scoreDict");
			query = {

				filter:
				{
					localteam_id: {
						_in: municipalitiesToRead
					}
				}

			}

			const municipalities = await municipalitiesService.readByQuery(query);
			logger.info(municipalities, "municipalities");
			logger.info(municipalities[0], "municipalities0");
			for (const municipality of municipalities) {
				query = {
					filter: {
						_and: [{
							localteam_id: {
								_eq: municipality.localteam_id
							}
						}
						]
					}
				}

				const allRatingsMeasures = await rantingsMeasuresService.readByQuery(query);
				logger.info(allRatingsMeasures, "allRatingsMeasures");
				let ratingsMeasureDetail = allRatingsMeasures.map(item1 => {
					const item2 = measures.find(item2 => item2.id === item1.measure_id);
					if (item2.weight != null && item2.sector != null) {
						item1.weight = item2.weight;
						item1.measureStatus = item2.status;
						item1.sector = item2.sector;
					}
					else {
						item1.weight = 0;
						item1.measureStatus = "draft"
					}


					return item1;
				})
				logger.info(ratingsMeasureDetail, "ratingsMeasureDetail");

				for (const ratingMeasureDetail of ratingsMeasureDetail) {
					const {
						applicable,
						measureStatus,
						weight,
						approved,
						status,
						rating,
						sector
					} = ratingMeasureDetail;

					if (applicable && measureStatus === "published") {
						scoreDict["total"]["denominator"] += 3 * weight; //max value needs update
						if (scoreDict[sector]) {
							scoreDict[sector]["denominator"] += 3 * weight;
						}
						if (approved && status === "published") {
							scoreDict["total"]["numerator"] += rating * weight;
							if (scoreDict[sector]) {
								scoreDict[sector]["numerator"] += rating * weight;
							}
						}
					}

				}
				logger.info(scoreDict, "scoreDict");
				let scoresToPush = {}
				for (const key in scoreDict) {
					if (scoreDict.hasOwnProperty(key)) {
						
						scoresToPush["score_"+key]= scoreDict[key]=scoreDict[key]["numerator"]/scoreDict[key]["denominator"];
						if(key==="total") {
							scoresToPush["score_"+key] *=100;
						}
						else{
							scoresToPush["score_"+key] *=10;
						}
					
					}
				  }
				  logger.info(scoresToPush, "scoresToPush");
				  let result = await municipalitiesService.updateOne(municipality.id,scoresToPush);
				/* console.log(denominator, "denominator");
				console.log(numerator, "numerator");
				let total = 0
				if (denominator !== 0) {
					total = numerator / denominator;
				}
				console.log(denominator, "denominator");

				let result = await municipalitiesService.updateOne(municipality.id, {
					score_total: total
				});
				logger.info(result, "result"); */
			}

			/* Object.entries(res).forEach((entry) => {
				const [key, value] = entry;
				console.log(`${key}: ${value}`);
			});
			let arrayChangedRatings = data["$last"];
			let uniqueMeasuresIds = [];
			let uniqueMeasures = arrayChangedRatings.filter((item, index, array) => {
				// Use indexOf to find the first occurrence of the current item
				const firstIndex = array.findIndex((element) => element["measure_id"] === item["measure_id"]);

				// If the current item is the first occurrence in the array, keep it and push to Ids array
				if (index === firstIndex) {
					uniqueMeasuresIds.push(array[index].id);
				}
				return index === firstIndex;
			});
			uniqueMeasures["Ids"] = uniqueMeasuresIds;
			return { uniqueMeasures }; */
			//Update Bulk

			/* database.raw("WITH RankedScores AS ( \
				SELECT \
				  id, \
				  score_total, \
				  DENSE_RANK() OVER (ORDER BY score_total DESC) AS place \
				FROM \
				  public.municipalities \
				  WHERE status='published' \
			  ) \
			  \
			  UPDATE public.municipalities AS t \
			  SET place = ( \
				  CASE \
					  WHEN t.status = 'published' THEN ( \
						  SELECT r.place \
						  FROM RankedScores r \
						  WHERE t.id = r.id \
						  LIMIT 1 \
					  ) \
					  ELSE -1 \
				  END \
			  ); \
			  ")
				.then((results) => res.json(results))
				.catch((error) => {
					throw new ServiceUnavailableException(error.message);
				}); */


		} catch (e) {
			logger.info(e)
		}
		return {

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
