// Data model interfaces for the editor-manager operations

export interface LocalTeam {
  id: string;
  municipality_name: string;
}

export interface DirectusUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  /**
   * In Directus v11, a user's role is a single role ID (string).
   * Permissions are now managed via policies attached to roles.
   */
  role: string;
  status: "active" | "invited" | "suspended" | "archived";
  localteams: Array<{ localteam_id: string }>;
}

export interface Role {
  id: string;
  name: string;
}

export interface Editor {
  id: string;
  email: string;
}

export interface MailTemplateData {
  url: string;
  email: string;
  fullName: string;
  municipality_name: string;
}

/**
 * Typed context object shared by both operation handlers.
 * Using `env` from context instead of process.env is the idiomatic
 * Directus way and works correctly in sandboxed extensions.
 */
export interface OperationContext {
  env: Record<string, string>;
  logger: {
    info: (msg: unknown) => void;
    warn: (msg: unknown) => void;
    error: (msg: unknown) => void;
  };
  accountability: { user: string | null; admin: boolean };
  services: {
    UsersService: new (opts: ServiceOptions) => UsersServiceInstance;
    RolesService: new (opts: ServiceOptions) => RolesServiceInstance;
    MailService: new (opts: ServiceOptions) => MailServiceInstance;
    ItemsService: new (collection: string, opts: ServiceOptions) => ItemsServiceInstance;
  };
  getSchema: () => Promise<unknown>;
}

export interface ServiceOptions {
  schema: unknown;
  accountability: { user: string | null; admin: boolean };
}

export interface UsersServiceInstance {
  validateEmail: (email: string) => void;
  inviteUrl: (email: string, role: string) => string;
  getUserByEmail: (email: string) => Promise<DirectusUser | undefined>;
  readOne: (id: string, query?: { fields: string[] }) => Promise<DirectusUser>;
  createOne: (data: Partial<DirectusUser> & { localteams?: Array<{ localteam_id: string }> }) => Promise<string>;
  deleteMany: (ids: string[]) => Promise<void>;
}

export interface RolesServiceInstance {
  readByQuery: (query: { fields: string[]; filter: Record<string, unknown> }) => Promise<Role[]>;
}

export interface MailServiceInstance {
  send: (options: {
    to: string;
    subject: string;
    template: { name: string; data: MailTemplateData };
  }) => Promise<void>;
}

export interface ItemsServiceInstance {
  readOne: (id: string, query?: { fields: string[] }) => Promise<LocalTeam>;
  readMany: (ids: string[], query?: { limit: number }) => Promise<Editor[]>;
}
