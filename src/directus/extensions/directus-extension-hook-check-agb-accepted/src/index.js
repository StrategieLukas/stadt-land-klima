class AgbNotAcceptedError extends Error {  // Custom error
  name = 'DirectusError'; // Required for Directus
  code = 'AGB_NOT_ACCEPTED';
  status = 403;

  constructor(message) {
    super(message || 'You must accept the AGB.');
  }

  toString() {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

export default ({ filter }, { services }) => {
    const { UsersService, TranslationsService, RolesService } = services;
    const DEFAULT_LANGUAGE = 'de-DE';
    const ROLE_NAMES_TO_IGNORE = ["Administrator", "frontend"];

    // Helper function to get user and ignored roles
    const getUserAndRolesToIgnore = async (context) => {
        const { accountability, schema } = context;
        const userId = accountability?.user;

        if (!userId) {
            return { user: null, idsToIgnore: [] };
        }

        const rolesService = new RolesService({
            accountability: null,
            schema: schema,
        });

        const roles = await rolesService.readByQuery({
            fields: ["id"],
            filter: { name: { _in: ROLE_NAMES_TO_IGNORE } },
        });
        const idsToIgnore = roles.map(role => role.id);
        const usersService = new UsersService({
            accountability: null,
            schema: schema,
        });

        const user = await usersService.readOne(userId);

        return { user, idsToIgnore };
    };

    // Helper function for translations
    const getTranslation = async (key, translationsService, language) => {
        try {
            const translations = await translationsService.readByQuery({
                // Using a filter to find the specific key and language 
                filter: {
                    key: { _eq: key },
                    language: { _eq: language }
                },
                limit: 1
            });
            return translations[0]?.value || key;
        } catch (error) {
            console.error('Error fetching translation:', error);
            return key;
        }
    };
    // Filters for settings read
    filter('settings.read', async (items, meta, context) => {
        const settings = items[0];
        const { accountability, schema } = context
        const { user, idsToIgnore } = await getUserAndRolesToIgnore(context);
        const translationService = new TranslationsService({
                accountability: null,
                schema: schema,
            });
        if (user && !user.agb_accepted) {
            if (!idsToIgnore.includes(user.role)) {
                settings.module_bar = [ // Only allow the landing page with the accept Agb
                    {
                        type: "module",
                        id: "landing-page",
                        enabled: true,
                    },
                ];
                
                
            }
        }

    });

    // Filters for item actions
    const filters = ['items.create', 'items.update', 'items.read'];
    filters.forEach(actionName => {
        filter(actionName, async (items, meta, context) => {
            const { collection, } = meta;
            const { accountability, schema } = context
            if (collection === "pages") {
                return; // Allow access to "pages" collection
            }

            const { user, idsToIgnore } = await getUserAndRolesToIgnore(context);

            if (!user) {
                return; // No authenticated user, so no check needed
            }

            const translationService = new TranslationsService({
                accountability: null,
                schema: schema,
            });

            if (!user.agb_accepted) {
                const language = user.language || DEFAULT_LANGUAGE;
                const errorMessage = await getTranslation('errors.user_not_accepted_agb', translationService, language);
                throw new AgbNotAcceptedError(errorMessage);
            }
        });
    });
};