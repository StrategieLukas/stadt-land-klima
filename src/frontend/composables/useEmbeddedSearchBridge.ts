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
    register(moveFn: (direction: number) => void, navigateFn: () => void | Promise<void>) {
      bridge.move = moveFn;
      bridge.navigate = navigateFn;
    },
    registerFocusInput(fn: () => void) {
      bridge.focus = fn;
    },
    moveFocusEmbedded(direction: number) {
      bridge.move?.(direction);
    },
    navigateFocusedEmbedded() {
      return bridge.navigate?.();
    },
    focusHeaderInput() {
      bridge.focus?.();
    },
    get hasHeaderInput() {
      return !!bridge.focus;
    },
  };
}
