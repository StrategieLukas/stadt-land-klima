class ConsentNotAcceptedError extends Error {
  name = 'DirectusError';
  code = 'CONSENT_NOT_ACCEPTED';
  status = 400;

  constructor() {
    super('Sie müssen die AGB und Datenschutzerklärung akzeptieren, um auf diese Inhalte zugreifen zu können. Bitte akzeptieren Sie die Vereinbarungen im Consent Management Modul.');
  }
}

export default ({ filter }, { services }) => {
  const { ItemsService } = services;
  const ROLE_NAMES_TO_IGNORE = ["Administrator", "frontend"];

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

    const currentVersions = await versionsService.readByQuery({
      filter: { isCurrentVersion: { _eq: true } },
      limit: -1
    });
    
    const agbVersion = currentVersions.find(v => v.type === 'terms_of_service');
    const dataProtectionVersion = currentVersions.find(v => v.type === 'data_protection');
    
    if (!agbVersion || !dataProtectionVersion) {
      return false;
    }

    const userConsents = await consentsService.readByQuery({
      filter: { 
        user_id: { _eq: userId },
        consent_target: { _in: [agbVersion.id, dataProtectionVersion.id] }
      },
      limit: -1
    });

    const hasAgbConsent = userConsents.some(c => c.consent_target === agbVersion.id);
    const hasDataProtectionConsent = userConsents.some(c => c.consent_target === dataProtectionVersion.id);
    
    return hasAgbConsent && hasDataProtectionConsent;
  };

  const filters = ['items.create', 'items.update', 'items.read'];
  filters.forEach(actionName => {
    filter(actionName, async (items, meta, context) => {
      const { collection } = meta;
      const { accountability, schema } = context;
      
      if (collection === "user_consent" || collection === "agreement_versions") {
        return items;
      }

      const userId = accountability?.user;
      if (!userId) {
        return items;
      }

      const idsToIgnore = await getIdsToIgnore(context);
      const usersService = new ItemsService('directus_users', {
        accountability: null,
        schema: schema,
      });
      const user = await usersService.readOne(userId);
      
      if (!user || !idsToIgnore.includes(user.role)) {
        const hasAccepted = await hasAcceptedRequiredAgreements(userId, context);
        if (!hasAccepted) {
          throw new ConsentNotAcceptedError();
        }
      }

      return items;
    });
  });
};
