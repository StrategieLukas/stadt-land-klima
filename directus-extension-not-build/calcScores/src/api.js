export default {
  id: "operation-calculateScores",
  handler: async (
    { keys },
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

      const ratings_measures = await rantingsMeasuresService.readMany(
        keys,
        query,
      );
      const measures = await measuresService.readByQuery(query);
      // logger.info(ratings_measures, "ratings_measures");
      // logger.info(measures, "measures");
      const municipalitiesToRead = Object.values(ratings_measures).map(
        (value) => value.localteam_id,
      );
      if (municipalitiesToRead.length === 0) {
        /* logger.info("NOthing to recalc"); */
        return;
      }

      // logger.info(municipalitiesToRead, "municipalitiesToRead");
      query = {
        filter: {
          localteam_id: {
            _in: municipalitiesToRead,
          },
        },
      };

      const municipalities = await municipalitiesService.readByQuery(query);
      // logger.info(municipalities, "municipalities");
      // logger.info(municipalities[0], "municipalities0");
      for (const municipality of municipalities) {
        const scoreDict = {};
        ratings_measures.forEach((item1) => {
          if (item1.localteam_id === municipality.localteam_id) {
            const item2 = measures.find(
              (item2) => item2.id === item1.measure_id,
            );
            if (item2 !== undefined) {
              scoreDict[item2.sector] = {
                denominator: 0,
                numerator: 0,
              };
            }
          }
        });
        scoreDict["total"] = {
          denominator: 0,
          numerator: 0,
        };
        /* logger.info(scoreDict, "scoreDict" +municipality.name);
         */
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

        const allRatingsMeasures =
          await rantingsMeasuresService.readByQuery(query);
        /* logger.info(allRatingsMeasures, "allRatingsMeasures"); */
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
            applicable,
            weight,
            approved,
            status,
            rating,
            sector,
            measureStatus,
          } = ratingMeasureDetail;

          if (applicable && measureStatus === "published") {
            scoreDict["total"]["denominator"] += weight; //max value needs update
            if (scoreDict[sector]) {
              scoreDict[sector]["denominator"] += weight;
            }
            if (approved && status === "published") {
              scoreDict["total"]["numerator"] += Number(rating) * weight;
              if (scoreDict[sector]) {
                scoreDict[sector]["numerator"] += Number(rating) * weight;
              }
            }
          }
        }
        /* logger.info(scoreDict, "scoreDict"); */
        let scoresToPush = {};
        for (const key in scoreDict) {
          if (scoreDict.hasOwnProperty(key)) {
            if (scoreDict[key]["denominator"] > 0) {
              scoresToPush["score_" + key] =
                scoreDict[key]["numerator"] / scoreDict[key]["denominator"];
            } else {
              scoresToPush["score_" + key] = 0;
            }

            if (key === "total") {
              scoresToPush["score_" + key] *= maxScore;
            } else {
              scoresToPush["score_" + key] *= maxScore;
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
