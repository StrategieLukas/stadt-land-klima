import type { DefineComponent, ObjectDirective } from "vue";
declare module "vue" {
  // Accordion deep links intentionally use named HTMLElements and getElementsByName.
  interface HTMLAttributes {
    name?: string;
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
      challenge?: string;
      challengeurl?: string;
      auto?: string;
      hidefooter?: boolean;
      hidelogo?: boolean;
      floating?: boolean;
      name?: string;
      language?: string;
      onStatechange?: (event: Event) => void;
    }>;
  }
}
export {};
