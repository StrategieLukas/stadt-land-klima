export default {
  id: "operation-calculateScores",
  handler: async (
    { keys, measureIds },
    { env, logger, accountability, services, getSchema },
  ) => {
    try {
      const { ItemsService } = services;
      const schema = await getSchema();
      let maxScore = 100;
      // logger.info(accountability, "accountability");
      //logger.info(keys, "keys");
      accountability.admin = true;
      const rantingsMeasuresService = new ItemsService("ratings_measures", {
        schema,
        accountability,
      });
      const measuresService = new ItemsService("measures", {
        schema,
        accountability,
      });
      const municipalitiesService = new ItemsService("municipalities", {
        schema,
        accountability,
      });
      let query = {
        limit: -1,
      };
      // better to give measure id with and than only get the one measure, or read it by taking the
      // ratings_measures and the corresponding measures
      const measures = await measuresService.readByQuery(query);
      let ratings_measures;
      let measureNotToConsiderForCalc;
      if (measureIds === null || typeof measureIds === "undefined") {
        measureNotToConsiderForCalc = [];
      } else {
        measureNotToConsiderForCalc = measureIds;
      }
      //logger.info(measureNotToConsiderForCalc, "measureNotToConsiderForCalc");

      if (measureNotToConsiderForCalc.length === 0) {
        // when there is no measureId than read all rating measures with given key
        ratings_measures = await rantingsMeasuresService.readMany(keys, query);
        const municipalitiesToRead = Object.values(ratings_measures).map(
          (value) => value.localteam_id,
        );
        if (municipalitiesToRead.length === 0) {
          /* logger.info("NOthing to recalc"); */
          return;
        }
        query = {
          //query to only read the necessary municipalities
          filter: {
            localteam_id: {
              _in: municipalitiesToRead,
            },
          },
        };
      }

      // logger.info(ratings_measures, "ratings_measures");
      // logger.info(measures, "measures");

      // logger.info(municipalitiesToRead, "municipalitiesToRead");

      //Reads all the municipalities which were in the updated ratings or all
      const municipalities = await municipalitiesService.readByQuery(query);
      // logger.info(municipalities, "municipalities");
      // logger.info(municipalities[0], "municipalities0");
      for (const municipality of municipalities) {
        //Dict for Calculating the scores
        const scoreDict = {};

        if (measureNotToConsiderForCalc.length === 0) {
          //Add all Sectors which are present in ratings_measures to the scoreDict
          ratings_measures.forEach((rating) => {
            if (rating.localteam_id === municipality.localteam_id) {
              //Find the the sector for the rating
              const measureForSector = measures.find(
                (measureTemp) => measureTemp.id === rating.measure_id,
              );
              if (measureForSector !== undefined) {
                scoreDict[measureForSector.sector] = {
                  denominator: 0,
                  numerator: 0,
                };
              }
            }
          });
        } else {
          //Sets the measure we dont want to consider
          measures.forEach(function (measureTemp) {
            if (measureNotToConsiderForCalc.includes(measureTemp.id)) {
              scoreDict[measureTemp.sector] = {
                denominator: 0,
                numerator: 0,
              };
            }
          });
        }
        scoreDict["total"] = {
          denominator: 0,
          numerator: 0,
        };
        //The number of rated measures(numerator) and total measures(denominator)
        scoreDict["numberOfRated"] = {
          denominator: 0,
          numerator: 0,
        };
        //logger.info(scoreDict, "scoreDict" + municipality.name);

        query = {
          filter: {
            _and: [
              {
                localteam_id: {
                  _eq: municipality.localteam_id,
                },
              },
            ],
          },
        };
        //All Ratings for the municipality
        const allRatingsMeasures =
          await rantingsMeasuresService.readByQuery(query);
        /* logger.info(allRatingsMeasures, "allRatingsMeasures"); */

        //Map the information from the measures to the ratings, for each measure there is always one rating even if its not rated yet
        let ratingsMeasureDetail = allRatingsMeasures.map((item1) => {
          const item2 = measures.find((item2) => item2.id === item1.measure_id);
          if (
            item2.weight != null &&
            item2.sector != null &&
            item2.status != null
          ) {
            item1.weight = item2.weight;
            item1.sector = item2.sector;
            item1.measureStatus = item2.status;
          } else {
            item1.weight = 0;
            item1.sector = "total";
            item1.measureStatus = "draft";
          }

          return item1;
        });
        /* logger.info(ratingsMeasureDetail, "ratingsMeasureDetail"); */

        for (const ratingMeasureDetail of ratingsMeasureDetail) {
          const {
            measure_id,
            applicable,
            weight,
            approved,
            status,
            rating,
            sector,
            measureStatus,
          } = ratingMeasureDetail;
          if (
            applicable &&
            measureStatus === "published" &&
            !measureNotToConsiderForCalc.includes(measure_id)
          ) {
            scoreDict["total"]["denominator"] += weight; //max value needs update
            scoreDict["numberOfRated"]["denominator"] += weight;
            if (scoreDict[sector]) {
              scoreDict[sector]["denominator"] += weight;
            }
            if (approved && status === "published") {
              scoreDict["total"]["numerator"] += Number(rating) * weight;
              scoreDict["numberOfRated"]["numerator"] += weight;
              if (scoreDict[sector]) {
                scoreDict[sector]["numerator"] += Number(rating) * weight;
              }
            }
          }
        }
        /* logger.info(scoreDict, "scoreDict"); */
        let scoresToPush = {};

        //calculate the scores and percentage_rated
        for (const key in scoreDict) {
          if (scoreDict.hasOwnProperty(key)) {
            if (scoreDict[key]["denominator"] > 0) {
              if (key === "numberOfRated") {
                scoresToPush["percentage_rated"] =
                  (scoreDict[key]["numerator"] /
                    scoreDict[key]["denominator"]) *
                  maxScore;
              } else {
                scoresToPush["score_" + key] =
                  (scoreDict[key]["numerator"] /
                    scoreDict[key]["denominator"]) *
                  maxScore;
              }
            } else {
              if (key === "numberOfRated") {
                scoresToPush["percentage_rated"] = 0;
              } else {
                scoresToPush["score_" + key] = 0;
              }
            }
          }
        }

        /* logger.info(scoresToPush, "scoresToPush"); */
        let result = await municipalitiesService.updateOne(
          municipality.id,
          scoresToPush,
        );
      }
    } catch (e) {
      logger.error(e);
      throw e;
    }
    return {};
  },
};
