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

          const agreementsService = new ItemsService('user_agreements', {
              accountability: null,
              schema: schema,
          });

          // Find existing agreement
          const existingAgreements = await agreementsService.readByQuery({
              filter: { user_id: { _eq: userId } },
              limit: 1
          });

          if (existingAgreements.length === 0) {
              return res.status(404).json({ error: 'No agreement found for this user' });
          }

          const agreement = existingAgreements[0];

          // Update newsletter subscription to false
          await agreementsService.updateOne(agreement.id, {
              newsletter_subscribed: false,
              newsletter_subscribed_at: new Date().toISOString()
          });

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

          const agreementsService = new ItemsService('user_agreements', {
              accountability: null,
              schema: schema,
          });

          // Find existing agreement
          const existingAgreements = await agreementsService.readByQuery({
              filter: { user_id: { _eq: userId } },
              limit: 1
          });

          if (existingAgreements.length === 0) {
              return res.json({ 
                  hasAccepted: false,
                  newsletterSubscribed: false
              });
          }

          const agreement = existingAgreements[0];

          return res.json({ 
              hasAccepted: true,
              newsletterSubscribed: agreement.newsletter_subscribed || false,
              agbVersion: agreement.agb_version,
              dataProtectionVersion: agreement.data_protection_version,
              agbAcceptedAt: agreement.agb_accepted_at,
              dataProtectionAcceptedAt: agreement.data_protection_accepted_at
          });
      } catch (error) {
          console.error('Error in consent status:', error);
          return res.status(500).json({ error: 'Internal server error' });
      }
  });
};