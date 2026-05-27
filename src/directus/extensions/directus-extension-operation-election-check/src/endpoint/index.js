import generateQuestions from '../generate-questions/api.js';
import sendCandidateMails from '../send-candidate-mails/api.js';

export default {
  id: 'election-actions',
  handler: (router, { services, getSchema, logger, database }) => {
    router.post('/generate', async (req, res) => {
      const { election_id } = req.body;
      if (!election_id) return res.status(400).send('Missing election_id');

      const schema = await getSchema();
      const accountability = req.accountability;

      try {
        const result = await generateQuestions.handler(
          { election_id },
          { logger, accountability, services, getSchema: async () => schema, data: {}, database }
        );
        return res.json(result);
      } catch (err) {
        logger.error(`[election-actions] generate error: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }
    });

    router.post('/send-mails', async (req, res) => {
      const { election_id } = req.body;
      if (!election_id) return res.status(400).send('Missing election_id');

      const schema = await getSchema();
      const accountability = req.accountability;

      try {
        const result = await sendCandidateMails.handler(
          { election_id },
          { logger, accountability, services, getSchema: async () => schema, data: {}, database }
        );
        return res.json(result);
      } catch (err) {
        logger.error(`[election-actions] send-mails error: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }
    });
  },
};
