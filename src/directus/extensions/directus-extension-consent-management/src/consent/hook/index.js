export default ({ filter }, { services }) => {
  const { ItemsService } = services;
  const ROLE_NAMES_TO_IGNORE = ["Administrator", "frontend"];

  // Helper to get accountabilities to ignore
  const getIdsToIgnore = async (context) => {
    const { schema } = context;
    const rolesService = new ItemsService('directus_roles', {
      accountability: null,
      schema: schema,
    });
    const roles = await rolesService.readByQuery({
      fields: ["id"],
      filter: { name: { _in: ROLE_NAMES_TO_IGNORE } },
    });
    return roles.map(role => role.id);
  };

  // Helper to check if user has accepted required agreements
  const hasAcceptedRequiredAgreements = async (userId, context) => {
    const { schema } = context;
    
    const consentsService = new ItemsService('user_consent', {
      accountability: null,
      schema: schema,
    });

    const versionsService = new ItemsService('agreement_versions', {
      accountability: null,
      schema: schema,
    });

    // Get current agreement versions (where isCurrentVersion is true)
    const currentVersions = await versionsService.readByQuery({
      filter: { isCurrentVersion: { _eq: true } },
      limit: -1
    });
    
    // Find the IDs for terms_of_service and data_protection
    const agbVersion = currentVersions.find(v => v.type === 'terms_of_service');
    const dataProtectionVersion = currentVersions.find(v => v.type === 'data_protection');
    
    if (!agbVersion || !dataProtectionVersion) {
      return false;
    }

    // Get all consents for this user
    const userConsents = await consentsService.readByQuery({
      filter: { 
        user_id: { _eq: userId },
        consent_target: { _in: [agbVersion.id, dataProtectionVersion.id] }
      },
      limit: -1
    });

    // Check if user has consent for both AGB and Datenschutz
    const hasAgbConsent = userConsents.some(c => c.consent_target === agbVersion.id);
    const hasDataProtectionConsent = userConsents.some(c => c.consent_target === dataProtectionVersion.id);
    
    return hasAgbConsent && hasDataProtectionConsent;
  };

  // Block access to all collections until consent is given
  const filters = ['items.create', 'items.update', 'items.read'];
  filters.forEach(actionName => {
    filter(actionName, async (items, meta, context) => {
      const { collection } = meta;
      const { accountability, schema } = context;
      
      // Allow access to consent-related collections
      if (collection === "user_consent" || collection === "agreement_versions") {
        return items;
      }

      const userId = accountability?.user;
      if (!userId) {
        return items; // No authenticated user
      }

      // Check if user is in ignored roles
      const idsToIgnore = await getIdsToIgnore(context);
      const usersService = new ItemsService('directus_users', {
        accountability: null,
        schema: schema,
      });
      const user = await usersService.readOne(userId);
      
      if (!user || !idsToIgnore.includes(user.role)) {
        const hasAccepted = await hasAcceptedRequiredAgreements(userId, context);
        if (!hasAccepted) {
          // Return empty array instead of throwing error - this blocks data without redirect
          return [];
        }
      }

      return items;
    });
  });
};
