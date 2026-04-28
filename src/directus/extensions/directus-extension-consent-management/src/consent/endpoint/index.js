export default (router, { services }) => {
  const { ItemsService } = services;

  // Newsletter opt-out endpoint
  router.get('/consent/newsletter/optout', async (req, res) => {
      try {
          const { accountability, schema } = req;
          const userId = accountability?.user;

          if (!userId) {
              return res.status(401).json({ error: 'Unauthorized' });
          }

          const consentsService = new ItemsService('user_consent', {
              accountability: null,
              schema: schema,
          });

          const versionsService = new ItemsService('agreement_versions', {
              accountability: null,
              schema: schema,
          });

          // Get current newsletter version
          const currentVersions = await versionsService.readByQuery({
              filter: { 
                  isCurrentVersion: { _eq: true },
                  type: { _eq: 'newsletter' }
              },
              limit: 1
          });

          if (currentVersions.length === 0) {
              return res.status(404).json({ error: 'No newsletter agreement version found' });
          }

          const newsletterVersionId = currentVersions[0].id;

          // Find existing consent for newsletter
          const existingConsents = await consentsService.readByQuery({
              filter: { 
                  user_id: { _eq: userId },
                  consent_target: { _eq: newsletterVersionId }
              },
              limit: 1
          });

          if (existingConsents.length === 0) {
              return res.status(404).json({ error: 'No newsletter consent found for this user' });
          }

          const consent = existingConsents[0];

          // Delete the newsletter consent (opt-out)
          await consentsService.deleteOne(consent.id);

          return res.json({ success: true, message: 'Newsletter subscription updated' });
      } catch (error) {
          console.error('Error in newsletter optout:', error);
          return res.status(500).json({ error: 'Internal server error' });
      }
  });

  // Get consent status endpoint
  router.get('/consent/status', async (req, res) => {
      try {
          const { accountability, schema } = req;
          const userId = accountability?.user;

          if (!userId) {
              return res.status(401).json({ error: 'Unauthorized' });
          }

          const consentsService = new ItemsService('user_consent', {
              accountability: null,
              schema: schema,
          });

          const versionsService = new ItemsService('agreement_versions', {
              accountability: null,
              schema: schema,
          });

          // Get current agreement versions
          const currentVersions = await versionsService.readByQuery({
              filter: { isCurrentVersion: { _eq: true } },
              limit: -1
          });

          const agbVersion = currentVersions.find(v => v.type === 'terms_of_service');
          const dataProtectionVersion = currentVersions.find(v => v.type === 'data_protection');
          const newsletterVersion = currentVersions.find(v => v.type === 'newsletter');

          // Get all consents for this user
          const userConsents = await consentsService.readByQuery({
              filter: { user_id: { _eq: userId } },
              limit: -1
          });

          const hasAgbConsent = userConsents.some(c => c.consent_target === agbVersion?.id);
          const hasDataProtectionConsent = userConsents.some(c => c.consent_target === dataProtectionVersion?.id);
          const hasNewsletterConsent = userConsents.some(c => c.consent_target === newsletterVersion?.id);

          return res.json({ 
              hasAccepted: hasAgbConsent && hasDataProtectionConsent,
              newsletterSubscribed: hasNewsletterConsent || false,
              agbVersion: agbVersion?.version || null,
              dataProtectionVersion: dataProtectionVersion?.version || null,
              newsletterVersion: newsletterVersion?.version || null
          });
      } catch (error) {
          console.error('Error in consent status:', error);
          return res.status(500).json({ error: 'Internal server error' });
      }
  });
};
