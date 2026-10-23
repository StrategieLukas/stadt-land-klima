import type { Argv } from 'yargs';
import { z } from 'zod';
import type createDirectusClient from './createDirectusClient.ts';

export type CliClient = ReturnType<typeof createDirectusClient<{}>>;
export type TaskOptions = {
  verbose?: boolean;
  remove?: boolean;
  overwrite?: boolean;
};
export type CliOptions = {
  verbose?: boolean;
  force?: boolean;
  clear?: boolean;
  'remove-orphans'?: boolean;
};
export type CliArguments = Argv<CliOptions>;
export type NamedRecord = { id: string; name: string };
const RelationSchema = z.union([
  z.string().min(1),
  z.object({ id: z.string().min(1) }),
]);
export const AccessResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().optional(),
      role: RelationSchema.nullable().optional(),
      policy: RelationSchema,
    }),
  ),
});
export const RecordSchema = z.record(z.string(), z.unknown());
export const ItemSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional(),
});
export type Item = z.infer<typeof ItemSchema>;
export const PermissionSchema = z.looseObject({
  id: z.number().optional(),
  policy: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  collection: z.string().min(1),
  action: z.enum(['create', 'read', 'update', 'delete', 'share']),
  permissions: RecordSchema.nullable().optional(),
  validation: RecordSchema.nullable().optional(),
  presets: RecordSchema.nullable().optional(),
  fields: z.array(z.string()).nullable().optional(),
});
export type Permission = z.infer<typeof PermissionSchema>;
export const PolicySchema = z.looseObject({
  id: z.string().optional(),
  name: z.string().min(1),
  icon: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  ip_access: z.array(z.string()).nullable().optional(),
  enforce_tfa: z.boolean().optional(),
  admin_access: z.boolean().optional(),
  app_access: z.boolean().optional(),
  permissions: z.array(PermissionSchema).optional(),
});
export type Policy = z.infer<typeof PolicySchema>;
export const RoleSchema = z.looseObject({
  id: z.string().nullable().optional(),
  name: z.string().min(1),
  icon: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  parent: z.string().nullable().optional(),
  children: z.array(z.string()).optional(),
  policies: z.array(z.string()).optional(),
  permissions: z.array(PermissionSchema).optional(),
  policiesToAttach: z.array(z.string()).optional(),
  policyRefsToAttach: z.array(z.string()).optional(),
  _skipMetadataUpdate: z.boolean().optional(),
});
export type Role = z.infer<typeof RoleSchema>;
export const OperationSchema = z.looseObject({
  id: z.string().optional(),
  key: z.string().min(1),
  type: z.string().min(1),
  name: z.string().nullable().optional(),
  flow: z.string().optional(),
  flow_name: z.string().optional(),
  position_x: z.number().int(),
  position_y: z.number().int(),
  resolve: z.string().nullable().optional(),
  reject: z.string().nullable().optional(),
  resolve_key: z.string().nullable().optional(),
  reject_key: z.string().nullable().optional(),
  options: RecordSchema.nullable().optional(),
});
export type Operation = z.infer<typeof OperationSchema>;
export const FlowSchema = z.looseObject({
  id: z.string().optional(),
  name: z.string().min(1),
  operation: z.string().nullable().optional(),
  operation_key: z.string().optional(),
  operations: z.array(OperationSchema).optional(),
});
export type Flow = z.infer<typeof FlowSchema>;
// Directus returns relation ID arrays on reads; exports fetch the full rows separately.
export const ApiFlowSchema = z.preprocess((value) => {
  const { operations, ...flow } = RecordSchema.parse(value);
  return flow;
}, FlowSchema);
export const PanelSchema = z.looseObject({
  id: z.string().optional(),
  name: z.string().nullable().optional(),
  type: z.string().min(1),
  dashboard: z.union([z.string(), z.object({ id: z.string() })]).optional(),
  position_x: z.number().int(),
  position_y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Panel = z.infer<typeof PanelSchema>;
export const DashboardSchema = z.looseObject({
  id: z.string().optional(),
  name: z.string().min(1),
  panels: z.array(PanelSchema).optional(),
});
export type Dashboard = z.infer<typeof DashboardSchema>;
export const ApiDashboardSchema = z.preprocess((value) => {
  const { panels, ...dashboard } = RecordSchema.parse(value);
  return dashboard;
}, DashboardSchema);
export const PresetSchema = z.looseObject({
  id: z.number().optional(),
  collection: z.string().min(1).nullable(),
  user: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  bookmark: z.string().nullable().optional(),
  layout: z.string().nullable().optional(),
  layout_query: RecordSchema.nullable().optional(),
  layout_options: RecordSchema.nullable().optional(),
  filter: RecordSchema.nullable().optional(),
});
export const TranslationSchema = z.looseObject({
  id: z.string().optional(),
  language: z.string().regex(/^[A-Za-z0-9_-]*$/, 'Translation language must be a safe path segment').default(''),
  key: z.string().min(1),
  value: z.string(),
});
export type Translation = z.infer<typeof TranslationSchema>;

export function requiredId(value: unknown): string {
  if (typeof value !== 'string' || !value)
    throw new Error('Directus did not return the required record ID');
  return value;
}
export function relationId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string'
  )
    return value.id;
  return null;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function errorMessages(error: unknown): string {
  if (!error || typeof error !== 'object') return errorMessage(error);
  const messages: string[] = [];
  if ('message' in error && typeof error.message === 'string')
    messages.push(error.message);
  if ('errors' in error && Array.isArray(error.errors)) {
    for (const detail of error.errors) {
      if (
        detail &&
        typeof detail === 'object' &&
        'message' in detail &&
        typeof detail.message === 'string'
      )
        messages.push(detail.message);
    }
  }
  return messages.join('\n');
}
