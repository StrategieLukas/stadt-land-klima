import { shallowReactive } from "vue";
interface SearchBridge {
  move: ((direction: number) => void) | null;
  navigate: (() => void | Promise<void>) | null;
  focus: (() => void) | null;
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
    },
    registerFocusInput(this: void, fn: () => void) {
      bridge.focus = fn;
    },
    moveFocusEmbedded(this: void, direction: number) {
      bridge.move?.(direction);
    },
    navigateFocusedEmbedded(this: void) {
      return bridge.navigate?.();
    },
    focusHeaderInput(this: void) {
      bridge.focus?.();
    },
    get hasHeaderInput() {
      return !!bridge.focus;
    },
  };
}
