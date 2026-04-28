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
      
      const agreementsService = new ItemsService('user_agreements', {
          accountability: null,
          schema: schema,
      });

      // Get current agreement versions
      const versionsService = new ItemsService('agreement_versions', {
          accountability: null,
          schema: schema,
      });

      const [agreements, versions] = await Promise.all([
          agreementsService.readByQuery({
              filter: { user_id: { _eq: userId } },
              limit: 1
          }),
          versionsService.readByQuery({
              limit: 1
          })
      ]);

      const currentAgreement = agreements[0];
      const currentVersions = versions[0];

      if (!currentVersions) {
          return false;
      }

      if (!currentAgreement) {
          return false;
      }

      // Check if user has accepted current versions of AGB and data protection
      return currentAgreement.agb_version === currentVersions.current_agb_version &&
             currentAgreement.data_protection_version === currentVersions.current_data_protection_version;
  };

  // MINIMAL HOOK - Only block access, don't modify settings
  const filters = ['items.create', 'items.update', 'items.read'];
  filters.forEach(actionName => {
      filter(actionName, async (items, meta, context) => {
          const { collection } = meta;
          const { accountability, schema } = context;
          
          // Allow access to consent-related collections and pages
          if (collection === "user_agreements" || collection === "agreement_versions" || collection === "pages") {
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