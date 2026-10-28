import { inject, onBeforeUnmount, onMounted, provide, ref, type InjectionKey, type Ref } from "vue";
import {
  WAHLCHECK_EMBED_MAX_HEIGHT,
  WahlcheckEmbedHostMessageSchema,
  type WahlcheckEmbedMessage,
} from "~/shared/wahlcheckEmbed";

const embedScrollKey: InjectionKey<(top: number) => boolean> = Symbol("wahlcheck-embed-scroll");

export function useWahlcheckEmbedScroll() {
  return inject(embedScrollKey, undefined);
}

/** Size messages contain layout metadata only; framing authorization remains in CSP. */
export function useWahlcheckEmbed(root: Ref<HTMLElement | null>) {
  const connected = ref(false);
  let parentOrigin: string | undefined;
  let observer: ResizeObserver | undefined;
  let animationFrame = 0;
  let lastHeight = 0;

  function send(message: WahlcheckEmbedMessage): boolean {
    if (!parentOrigin) return false;
    window.parent.postMessage(message, parentOrigin);
    return true;
  }

  provide(embedScrollKey, (top) => {
    if (!Number.isFinite(top) || top < 0 || top > WAHLCHECK_EMBED_MAX_HEIGHT) return false;
    return send({ type: "slk:wahlcheck:scroll", version: 1, top: Math.round(top) });
  });

  function measure() {
    animationFrame = 0;
    if (!parentOrigin || !root.value) return;
    // Measure the content wrapper, not document.scrollHeight: the latter includes
    // the current iframe viewport and would prevent shrinking after long results.
    const height = Math.max(1, Math.ceil(root.value.getBoundingClientRect().height));
    if (height > WAHLCHECK_EMBED_MAX_HEIGHT || height === lastHeight) return;
    lastHeight = height;
    send({ type: "slk:wahlcheck:resize", version: 1, height });
  }

  function queueMeasurement() {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(measure);
  }

  function receive(event: MessageEvent<unknown>) {
    if (window.parent === window || event.source !== window.parent || !/^https?:\/\//.test(event.origin)) return;
    if (parentOrigin && event.origin !== parentOrigin) return;
    const parsed = WahlcheckEmbedHostMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    if (parsed.data.type === "slk:wahlcheck:init") {
      parentOrigin = event.origin;
      connected.value = true;
      document.documentElement.dataset.wahlcheckEmbed = "resized";
      lastHeight = 0;
      queueMeasurement();
    } else if (connected.value && root.value) {
      root.value.style.setProperty("--wahlcheck-viewport-top", `${parsed.data.top}px`);
      root.value.style.setProperty("--wahlcheck-viewport-height", `${Math.max(64, parsed.data.height)}px`);
    }
  }

  onMounted(() => {
    window.addEventListener("message", receive);
    window.addEventListener("resize", queueMeasurement);
    if (root.value) {
      observer = new ResizeObserver(queueMeasurement);
      observer.observe(root.value);
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("message", receive);
    window.removeEventListener("resize", queueMeasurement);
    if (connected.value) delete document.documentElement.dataset.wahlcheckEmbed;
  });

  return connected;
}
