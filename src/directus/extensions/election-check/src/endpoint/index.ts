import generateQuestions from '../generate-questions/api.js';
import sendCandidateMails from '../send-candidate-mails/api.js';
import type { Router, Services, GetSchema, Logger, Database } from '@directus/extensions-sdk';

export default {
  id: 'election-actions',
  handler: (router: Router, { services, getSchema, logger, database }: { services: Services; getSchema: GetSchema; logger: Logger; database: Database }) => {
    router.post('/generate', async (req, res) => {
      const { election_id } = req.body as { election_id?: string | number };
      if (!election_id) return res.status(400).send('Missing election_id');

      const schema = await getSchema();
      const accountability = req.accountability;

      try {
        const result = await generateQuestions.handler(
          { election_id },
          { logger, accountability, services, getSchema: async () => schema, data: {}, database }
        );
        return res.json(result);
      } catch (err: unknown) {
        const error = err as Error;
        logger.error(`[election-actions] generate error: ${error.message}`);
        return res.status(500).json({ error: error.message });
      }
    });

    router.post('/send-mails', async (req, res) => {
      const { election_id } = req.body as { election_id?: string | number };
      if (!election_id) return res.status(400).send('Missing election_id');

      const schema = await getSchema();
      const accountability = req.accountability;

      try {
        const result = await sendCandidateMails.handler(
          { election_id },
          { logger, accountability, services, getSchema: async () => schema, data: {}, database }
        );
        return res.json(result);
      } catch (err: unknown) {
        const error = err as Error;
        logger.error(`[election-actions] send-mails error: ${error.message}`);
        return res.status(500).json({ error: error.message });
      }
    });
  },
};
