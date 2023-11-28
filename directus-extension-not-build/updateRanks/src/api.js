export default {
  id: "updateRanks",
  handler: ({}, { database, logger }) => {
    database
      .raw(
		"BEGIN; \
		SELECT  FROM public.municipalities  \
					ORDER BY id \
					FOR UPDATE; \
				WITH RankedScores AS ( \
						SELECT \
						id, \
						DENSE_RANK() OVER (ORDER BY score_total DESC) AS place \
						FROM \
						public.municipalities \
						WHERE status='published' \
					) \
				UPDATE public.municipalities AS m \
						SET place = ( \
							CASE \
								WHEN m.status = 'published' THEN ( \
									SELECT r.place \
									FROM RankedScores r \
									WHERE m.id = r.id \
								) \
								ELSE -1 \
							END \
						); \
				COMMIT;\
		",
      )
      .then((results) => {
        /* logger.info(results, "resultsDB"); */
        return;
      })
      .catch((error) => {
        logger.info(error, "error pushing DB");
        throw error;
      });
  },
};
