import { shallowReactive } from "vue";
interface SearchBridge {
  move: ((direction: number) => void) | null;
  navigate: (() => void | Promise<void>) | null;
  focus: (() => boolean) | null;
}
const browserBridge = shallowReactive<SearchBridge>({ move: null, navigate: null, focus: null });
export function useEmbeddedSearchBridge() {
  const bridge = import.meta.client ? browserBridge : ({ move: null, navigate: null, focus: null } as SearchBridge);
  const { $t } = useNuxtApp();
  return {
    get placeholder() {
      return $t("search.input_placeholder");
    },
    register(this: void, moveFn: (direction: number) => void, navigateFn: () => void | Promise<void>) {
      bridge.move = moveFn;
      bridge.navigate = navigateFn;
      return () => {
        if (bridge.move === moveFn) bridge.move = null;
        if (bridge.navigate === navigateFn) bridge.navigate = null;
      };
    },
    registerFocusInput(this: void, fn: () => boolean) {
      bridge.focus = fn;
      return () => {
        if (bridge.focus === fn) bridge.focus = null;
      };
    },
    moveFocusEmbedded(this: void, direction: number) {
      bridge.move?.(direction);
    },
    navigateFocusedEmbedded(this: void) {
      return bridge.navigate?.();
    },
    focusHeaderInput(this: void) {
      return bridge.focus?.() ?? false;
    },
    get hasHeaderInput() {
      return !!bridge.focus;
    },
  };
}
