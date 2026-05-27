// Extended type definitions for @directus/sdk to match actual runtime behavior
// This fixes issues where the SDK types are stricter than the actual API

import { DirectusClient, RestCommand } from '@directus/sdk';

// Extend the DirectusClient type
declare module '@directus/sdk' {
  interface DirectusClient<T> {
    request<T = any>(command: RestCommand | any, payload?: any): Promise<T>;
    url: string;
  }

  // Extend readRoles to accept fields with nested relations
  function readRoles<T extends Record<string, any> = any>(payload?: {
    limit?: number | string;
    filter?: Record<string, any>;
    fields?: (keyof T | '*' | `${keyof T}.*` | string)[] | string;
    offset?: number | string;
    page?: number | string;
    sort?: string | string[];
    search?: string;
  }): RestCommand<T>;

  // Extend readPolicies to accept fields with nested relations
  function readPolicies<T extends Record<string, any> = any>(payload?: {
    limit?: number | string;
    filter?: Record<string, any>;
    fields?: (keyof T | '*' | `${keyof T}.*` | string)[] | string;
    offset?: number | string;
    page?: number | string;
    sort?: string | string[];
    search?: string;
  }): RestCommand<T>;

  // Extend readPresets
  function readPresets<T extends Record<string, any> = any>(payload?: {
    limit?: number | string;
    filter?: Record<string, any>;
    fields?: string[];
    offset?: number | string;
    page?: number | string;
    sort?: string | string[];
    search?: string;
  }): RestCommand<T>;

  // Extend readFlows
  function readFlows<T extends Record<string, any> = any>(payload?: {
    limit?: number | string;
    filter?: Record<string, any>;
    fields?: string[];
    offset?: number | string;
    page?: number | string;
    sort?: string | string[];
    search?: string;
  }): RestCommand<T>;

  // Extend readOperations
  function readOperations<T extends Record<string, any> = any>(payload?: {
    limit?: number | string;
    filter?: Record<string, any>;
    fields?: string[];
    offset?: number | string;
    page?: number | string;
    sort?: string | string[];
    search?: string;
  }): RestCommand<T>;

  // Extend readRoles to accept fields with nested relations
  function readRoles<T extends Record<string, any> = any>(payload?: {
    limit?: number | string;
    filter?: Record<string, any>;
    fields?: (keyof T | '*' | `${keyof T}.*` | string)[] | string;
    offset?: number | string;
    page?: number | string;
    sort?: string | string[];
    search?: string;
  }): RestCommand<T>;

  // Extend readPermissions
  function readPermissions<T extends Record<string, any> = any>(payload?: {
    limit?: number | string;
    filter?: Record<string, any>;
    fields?: string[];
    offset?: number | string;
    page?: number | string;
    sort?: string | string[];
    search?: string;
  }): RestCommand<T>;

  // Extend readSettings
  function readSettings<T extends Record<string, any> = any>(): RestCommand<T>;

  // Extend readTranslations
  function readTranslations<T extends Record<string, any> = any>(payload?: {
    limit?: number | string;
    filter?: Record<string, any>;
    fields?: string[];
    offset?: number | string;
    page?: number | string;
    sort?: string | string[];
    search?: string;
  }): RestCommand<T>;

  // Extend readItems
  function readItems<T extends Record<string, any> = any>(
    collection: string,
    payload?: {
      limit?: number | string;
      filter?: Record<string, any>;
      fields?: string[];
      offset?: number | string;
      page?: number | string;
      sort?: string | string[];
      search?: string;
    }
  ): RestCommand<T>;

  // Extend createRoles
  function createRoles<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    payload: T | T[]
  ): RestCommand<R>;

  // Extend updateRole
  function updateRole<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    id: string | number,
    payload: T
  ): RestCommand<R>;

  // Extend createPolicies
  function createPolicies<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    payload: T | T[]
  ): RestCommand<R>;

  // Extend updatePolicy
  function updatePolicy<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    id: string | number,
    payload: T
  ): RestCommand<R>;

  // Extend createPermissions
  function createPermissions<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    payload: T | T[]
  ): RestCommand<R>;

  // Extend updatePermission
  function updatePermission<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    id: string | number,
    payload: T
  ): RestCommand<R>;

  // Extend deletePermissions
  function deletePermissions<T extends Record<string, any> = any>(
    ids: (string | number)[]
  ): RestCommand<T>;

  // Extend deletePolicies
  function deletePolicies<T extends Record<string, any> = any>(
    ids: (string | number)[]
  ): RestCommand<T>;

  // Extend deleteRoles
  function deleteRoles<T extends Record<string, any> = any>(
    ids: (string | number)[]
  ): RestCommand<T>;

  // Extend deleteTranslations
  function deleteTranslations<T extends Record<string, any> = any>(
    ids: (string | number)[]
  ): RestCommand<T>;

  // Extend deleteFlows
  function deleteFlows<T extends Record<string, any> = any>(
    ids: (string | number)[]
  ): RestCommand<T>;

  // Extend deleteOperations
  function deleteOperations<T extends Record<string, any> = any>(
    ids: (string | number)[]
  ): RestCommand<T>;

  // Extend deleteItems
  function deleteItems<T extends Record<string, any> = any>(
    collection: string,
    ids: (string | number)[]
  ): RestCommand<T>;

  // Extend createItems
  function createItems<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    collection: string,
    payload: T | T[]
  ): RestCommand<R>;

  // Extend createTranslations
  function createTranslations<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    payload: T | T[]
  ): RestCommand<R>;

  // Extend createFlows
  function createFlows<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    payload: T | T[]
  ): RestCommand<R>;

  // Extend createPresets
  function createPresets<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    payload: T | T[]
  ): RestCommand<R>;

  // Extend updateItem
  function updateItem<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    collection: string,
    id: string | number,
    payload: T
  ): RestCommand<R>;

  // Extend updateFlow
  function updateFlow<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    id: string | number,
    payload: T
  ): RestCommand<R>;

  // Extend updateOperation
  function updateOperation<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    id: string | number,
    payload: T
  ): RestCommand<R>;

  // Extend updateTranslation
  function updateTranslation<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    id: string | number,
    payload: T
  ): RestCommand<R>;

  // Extend updatePreset
  function updatePreset<T extends Record<string, any> = any, R extends Record<string, any> = any>(
    id: string | number,
    payload: T
  ): RestCommand<R>;

  // Extend schemaSnapshot
  function schemaSnapshot(): RestCommand<{
    version: string;
    directus: string;
    vendor: string;
    collections?: any[];
    fields?: any[];
    relations?: any[];
  }>;
}
