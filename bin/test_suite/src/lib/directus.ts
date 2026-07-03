import { assert } from './assert.js';

export type JsonRecord = Record<string, unknown>;

export interface ReadOptions {
  filter?: JsonRecord;
  fields?: string[];
  limit?: number;
  sort?: string[];
  search?: string;
}

export class DirectusClient {
  constructor(
    public readonly baseUrl: string,
    private token?: string,
  ) {}

  setToken(token: string): void {
    this.token = token;
  }

  async login(email: string, password: string): Promise<string> {
    const response = await this.request<{ access_token: string }>('POST', '/auth/login', {
      body: { email, password },
      auth: false,
    });
    assert(response.access_token, `No access token returned for ${email}`);
    this.token = response.access_token;
    return response.access_token;
  }

  async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; query?: Record<string, string | number | boolean | undefined>; auth?: boolean } = {},
  ): Promise<T> {
    const url = new URL(path, `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.auth !== false && this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        parsed?.errors?.[0]?.message ??
        parsed?.error ??
        parsed?.message ??
        response.statusText;
      throw new Error(`${method} ${url.pathname}${url.search} failed with ${response.status}: ${message}`);
    }

    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return parsed.data as T;
    }

    return parsed as T;
  }

  async readItems<T>(collection: string, options: ReadOptions = {}): Promise<T[]> {
    const query: Record<string, string | number | undefined> = {
      limit: options.limit,
      search: options.search,
    };
    if (options.filter) query.filter = JSON.stringify(options.filter);
    if (options.fields) query.fields = options.fields.join(',');
    if (options.sort) query.sort = options.sort.join(',');

    return this.request<T[]>('GET', `/items/${collection}`, { query });
  }

  async readItem<T>(collection: string, id: string | number, fields?: string[]): Promise<T> {
    return this.request<T>('GET', `/items/${collection}/${id}`, {
      query: fields ? { fields: fields.join(',') } : undefined,
    });
  }

  async createItem<T>(collection: string, body: JsonRecord): Promise<T> {
    return this.request<T>('POST', `/items/${collection}`, { body });
  }

  async updateItem<T>(collection: string, id: string | number, body: JsonRecord): Promise<T> {
    return this.request<T>('PATCH', `/items/${collection}/${id}`, { body });
  }

  async deleteItem(collection: string, id: string | number): Promise<void> {
    await this.request<null>('DELETE', `/items/${collection}/${id}`);
  }

  async readUsers<T>(options: ReadOptions = {}): Promise<T[]> {
    const query: Record<string, string | number | undefined> = { limit: options.limit };
    if (options.filter) query.filter = JSON.stringify(options.filter);
    if (options.fields) query.fields = options.fields.join(',');
    return this.request<T[]>('GET', '/users', { query });
  }

  async createUser<T>(body: JsonRecord): Promise<T> {
    return this.request<T>('POST', '/users', { body });
  }

  async updateUser<T>(id: string, body: JsonRecord): Promise<T> {
    return this.request<T>('PATCH', `/users/${id}`, { body });
  }

  async deleteUser(id: string): Promise<void> {
    await this.request<null>('DELETE', `/users/${id}`);
  }
}

export async function createAdminClient(baseUrl: string, env: Record<string, string>): Promise<DirectusClient> {
  const token = env.CLI_DIRECTUS_STATIC_TOKEN || env.DIRECTUS_ADMIN_TOKEN;
  const client = new DirectusClient(baseUrl, token || undefined);

  if (!token) {
    assert(env.ADMIN_EMAIL, 'ADMIN_EMAIL missing in backend env file');
    assert(env.ADMIN_PASSWORD, 'ADMIN_PASSWORD missing in backend env file');
    await client.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  }

  await client.request('GET', '/server/health', { auth: false });
  return client;
}
