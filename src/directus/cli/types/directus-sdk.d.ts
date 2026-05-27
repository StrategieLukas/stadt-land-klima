import { DirectusClient } from '@directus/sdk';

// Extend DirectusClient to include the request method used in the codebase
declare module '@directus/sdk' {
  interface DirectusClient<T> {
    request<T>(action: any, payload?: any): Promise<T>;
    url: string;
  }
}

export {};
