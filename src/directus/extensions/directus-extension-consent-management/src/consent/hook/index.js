class ConsentNotAcceptedError extends Error {  // Custom error
  name = 'DirectusError'; // Required for Directus
  code = 'CONSENT_NOT_ACCEPTED';
  status = 403;

  constructor(message) {
    super(message || 'You must accept the terms and conditions.');
  }

  toString() {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

export default ({ filter }, { services }) => {
  const { UsersService, ItemsService } = services;
  const ROLE_NAMES_TO_IGNORE = ["Administrator", "frontend"];

  // Helper function to get user and ignored roles
  const getUserAndRolesToIgnore = async (context) => {
      const { accountability, schema } = context;
      const userId = accountability?.user;

      if (!userId) {
          return { user: null, idsToIgnore: [] };
      }

      const usersService = new UsersService({
          accountability: null,
          schema: schema,
      });

      const user = await usersService.readOne(userId);

      // Get roles to ignore
      const rolesService = new ItemsService('directus_roles', {
          accountability: null,
          schema: schema,
      });

      const roles = await rolesService.readByQuery({
          fields: ["id"],
          filter: { name: { _in: ROLE_NAMES_TO_IGNORE } },
      });
      const idsToIgnore = roles.map(role => role.id);

      return { user, idsToIgnore };
  };

  // Helper function to check if user has accepted required agreements
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
          // If there are no current versions, we can't check - block access
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

  // MINIMAL HOOK - Only block access, don't modify settings
  const filters = ['items.create', 'items.update', 'items.read'];
  filters.forEach(actionName => {
      filter(actionName, async (items, meta, context) => {
          const { collection } = meta;
          const { accountability, schema } = context;
          
          // Allow access to consent-related collections
          if (collection === "user_consent" || collection === "agreement_versions") {
              return items;
          }

          const { user, idsToIgnore } = await getUserAndRolesToIgnore(context);

          if (!user) {
              return items; // No authenticated user, so no check needed
          }

          if (!idsToIgnore.includes(user.role)) {
              const hasAccepted = await hasAcceptedRequiredAgreements(user.id, context);
              
              if (!hasAccepted) {
                  // Simple error - let Directus handle the rest
                  throw new ConsentNotAcceptedError('You must accept the terms and conditions to access this content.');
              }
          }

          return items;
      });
  });
};
