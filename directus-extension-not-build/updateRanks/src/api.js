export default {
	id: 'updateRanks',
	handler: ({ },{database,logger}) => {
		database.raw("WITH RankedScores AS ( \
			SELECT \
			id, \
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
					) \
					ELSE -1 \
				END \
			); \
		").then((results) => {
			logger.info(results, "resultsDB");
		}
		).catch((error) => {
			logger.info(error, "error pushing DB");
			throw new error
		});
		return;
	},
};
