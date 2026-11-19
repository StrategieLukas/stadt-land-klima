import { asRecord, cloneVisualization } from "./visualization";

export interface BarLabel {
  barName: string;
  textName: string;
  orientation: string;
  labelField: string;
  valueField: string;
  font: string;
  fontSize: number;
  padding: number;
}

export function isBarLabel(value: unknown): value is BarLabel {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    ["barName", "textName", "orientation", "labelField", "valueField", "font"].every(
      (key) => typeof record[key] === "string",
    ) &&
    typeof record.fontSize === "number" &&
    record.fontSize > 0 &&
    record.fontSize <= 72 &&
    typeof record.padding === "number" &&
    record.padding >= 0 &&
    record.padding <= 24
  );
}

/** Category axes already identify bars; omit the matching generated text overlays. */
export function withCollectionBarAxes(input: unknown) {
  const spec = cloneVisualization(input);
  const metadata = asRecord(spec.usermeta);
  const labels = Array.isArray(metadata?.barLabels) ? metadata.barLabels.filter(isBarLabel) : [];
  const removed = new Set<string>();
  const visit = (value: unknown): void => {
    const node = asRecord(value);
    if (!node) return;
    if (Array.isArray(node.layer)) {
      for (const layer of node.layer) {
        const bar = asRecord(layer);
        if (!bar || (asRecord(bar.mark)?.type ?? bar.mark) !== "bar") continue;
        const label = labels.find((item) => item.barName === `${String(bar.name)}_marks`);
        if (!label) continue;
        const encoding = { ...asRecord(node.encoding), ...asRecord(bar.encoding) };
        const categoryChannel = label.orientation === "horizontal" ? "y" : "x";
        const valueChannel = label.orientation === "horizontal" ? "x" : "y";
        const category = asRecord(encoding[categoryChannel]);
        const axis = asRecord(category?.axis);
        const config = asRecord(spec.config);
        const channelConfig = asRecord(config?.[categoryChannel === "y" ? "axisY" : "axisX"]);
        if (
          !["nominal", "ordinal"].includes(String(category?.type)) ||
          category?.axis === null ||
          category?.axis === false ||
          axis?.labels === false ||
          (axis?.labels === undefined && (channelConfig?.labels ?? asRecord(config?.axis)?.labels) === false)
        )
          continue;
        const quantitative = asRecord(encoding[valueChannel]);
        if (quantitative?.type !== "quantitative") continue;
        encoding[valueChannel] = {
          ...quantitative,
          axis: { ...asRecord(quantitative.axis), labels: true, ticks: true },
        };
        bar.encoding = encoding;
        removed.add(label.textName);
      }
      node.layer = node.layer.filter((layer) => !removed.has(`${String(asRecord(layer)?.name)}_marks`));
    }
    for (const key of ["layer", "hconcat", "vconcat", "concat"]) {
      const children = node[key];
      if (Array.isArray(children)) children.forEach(visit);
    }
    visit(node.spec);
  };
  visit(spec);
  if (metadata && removed.size) {
    metadata.barLabels = labels.filter((label) => !removed.has(label.textName));
  }
  return spec;
}
