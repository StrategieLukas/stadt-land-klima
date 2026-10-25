import type { ComputedRef, InjectionKey } from "vue";
export const FORM_SCOPE: InjectionKey<ComputedRef<{ entityType: string; entityUuid: string }>> = Symbol("formScope");
