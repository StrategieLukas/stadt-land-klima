import { computed, ref, watch, type Ref } from "vue";

/** Keep keyboard selection attached to a result as independently loaded groups change. */
export function useSearchSelection<T>(results: Ref<T[]>, key: (result: T) => string) {
  const selectedKey = ref<string | null>(null);
  const index = computed(() => results.value.findIndex((result) => key(result) === selectedKey.value));
  const selected = computed(() => results.value[index.value]);
  function clear() {
    selectedKey.value = null;
  }
  function select(result: T) {
    selectedKey.value = key(result);
  }
  function move(direction: number) {
    const result = results.value[Math.min(results.value.length - 1, Math.max(0, index.value + direction))];
    if (result) select(result);
  }
  watch(
    index,
    (value) => {
      if (value < 0) clear();
    },
    { flush: "sync" },
  );
  return { index, selected, select, move, clear };
}
