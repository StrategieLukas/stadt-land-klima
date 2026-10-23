import type { DefineComponent, ObjectDirective } from "vue";
declare module "vue" {
  // Accordion deep links intentionally use named HTMLElements and getElementsByName.
  interface HTMLAttributes {
    name?: string | undefined;
    [attribute: `data-${string}`]: unknown;
  }
  interface ComponentCustomProps {
    [attribute: `data-${string}`]: unknown;
    [attribute: `data${Capitalize<string>}`]: unknown;
  }
  interface GlobalDirectives {
    vBlokkliEditable: ObjectDirective<HTMLElement, unknown>;
    vBlokkliDroppable: ObjectDirective<HTMLElement, unknown>;
  }
  interface GlobalComponents {
    "altcha-widget": DefineComponent<{
      challenge?: string | undefined;
      challengeurl?: string | undefined;
      auto?: string | undefined;
      hidefooter?: boolean | undefined;
      hidelogo?: boolean | undefined;
      floating?: boolean | undefined;
      name?: string | undefined;
      language?: string | undefined;
      onStatechange?: ((event: Event) => void) | undefined;
    }>;
  }
}
export {};
