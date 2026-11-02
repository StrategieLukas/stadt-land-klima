import { asRecord, cloneVisualization } from "../shared/visualization";

/** Bind one unit view: a layer-level selection is duplicated across named marks. */
export function withNativeScaleZoom(spec: unknown, name: string) {
  const root = asRecord(spec);
  if (
    !root ||
    (typeof root.$schema === "string" && !root.$schema.includes("vega-lite")) ||
    !(root.mark || root.encoding || root.layer) ||
    root.hconcat ||
    root.vconcat ||
    root.concat ||
    root.facet ||
    root.repeat
  )
    return { spec, enabled: false };

  function hasScaleBinding(view: Record<string, unknown>): boolean {
    return (
      (Array.isArray(view.params) && view.params.some((param) => asRecord(param)?.bind === "scales")) ||
      (Array.isArray(view.layer) &&
        view.layer.some((layer) => {
          const child = asRecord(layer);
          return child ? hasScaleBinding(child) : false;
        }))
    );
  }
  if (hasScaleBinding(root)) return { spec, enabled: true };

  const cloned = cloneVisualization(spec);
  function bind(view: Record<string, unknown>, inherited: Record<string, unknown> = {}): boolean {
    const encoding = { ...inherited, ...asRecord(view.encoding) };
    if (Array.isArray(view.layer)) {
      return view.layer.some((layer) => {
        const child = asRecord(layer);
        return child ? bind(child, encoding) : false;
      });
    }
    const encodings = ["x", "y"].filter((axis) => {
      const channel = asRecord(encoding[axis]);
      return (
        typeof channel?.field === "string" &&
        ["quantitative", "temporal"].includes(String(channel.type)) &&
        !channel.bin
      );
    });
    if (!view.mark || !encodings.length) return false;
    const params: unknown[] = Array.isArray(view.params) ? view.params : [];
    view.params = [
      ...params,
      { name, select: { type: "interval", encodings, translate: true, zoom: true }, bind: "scales" },
    ];
    return true;
  }
  const enabled = bind(cloned);
  return { spec: enabled ? cloned : spec, enabled };
}
