import { z } from "zod";
import { sectors } from "./domain";
export const StatisticsDatumSchema = z.object({
  isCenter: z.boolean().optional(), measureId: z.string().optional(), sectorKey: z.enum(sectors).optional(),
  name: z.string().default(""), cluster: z.string().optional(), ratingKey: z.string().optional(),
  bin_start: z.number().finite().optional(), bin_end: z.number().finite().optional(),
});
export function statisticsDatum(item: unknown) {
  const datum = item && typeof item === "object" && "datum" in item ? item.datum : undefined;
  const parsed = StatisticsDatumSchema.safeParse(datum);
  return parsed.success ? parsed.data : null;
}
export interface PlotPoint {x: number; y: number}
export function matrixValue(matrix: readonly Float32Array[], row: number, column: number): number {
  return matrix[row]?.[column] ?? 0;
}
/** Compare only measures rated by both municipalities; null is never a zero rating. */
export function pairwiseDominance(rows: readonly (readonly (number | null)[])[], count: number) {
  const wins = Array.from({length: count}, () => new Float32Array(count));
  const compared = Array.from({length: count}, () => new Float32Array(count));
  for (const ratings of rows) for (let i = 0; i < count; i++) {
    const left = ratings[i];
    if (left == null || !Number.isFinite(left)) continue;
    for (let j = i + 1; j < count; j++) {
      const right = ratings[j];
      if (right == null || !Number.isFinite(right)) continue;
      // Rows are allocated above for every index in these bounded loops.
      compared[i]![j] = matrixValue(compared, i, j) + 1;
      compared[j]![i] = matrixValue(compared, j, i) + 1;
      if (left > right) wins[i]![j] = matrixValue(wins, i, j) + 1;
      else if (right > left) wins[j]![i] = matrixValue(wins, j, i) + 1;
    }
  }
  return {wins, compared};
}
/** k-means++ initialization and bounded Lloyd iterations over finite 2D points. */
export function kMeans(points: readonly PlotPoint[], k: number, iters = 100): number[] {
  if (!Number.isInteger(k) || k < 1 || k > points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return [];
  const centroids: PlotPoint[] = [points[Math.floor(Math.random() * points.length)]!];
  while (centroids.length < k) {
    const dists = points.map(p => Math.min(...centroids.map(c => (p.x - c.x) ** 2 + (p.y - c.y) ** 2)));
    const sum = dists.reduce((a, b) => a + b, 0);
    if (sum === 0) {centroids.push(points[Math.floor(Math.random() * points.length)]!); continue;}
    let r = Math.random() * sum;
    let index = 0;
    while (r > 0 && index < dists.length - 1) {r -= dists[index]!; index++;}
    centroids.push(points[index]!);
  }
  let labels = points.map(() => 0);
  for (let iter = 0; iter < iters; iter++) {
    labels = points.map(p => centroids.reduce((best, c, ci) => {
      const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      return d < best.d ? {ci, d} : best;
    }, {ci: 0, d: Infinity}).ci);
    for (let ci = 0; ci < k; ci++) {
      const group = points.filter((_, i) => labels[i] === ci);
      if (group.length) centroids[ci] = {x: group.reduce((s, p) => s + p.x, 0) / group.length, y: group.reduce((s, p) => s + p.y, 0) / group.length};
    }
  }
  return labels;
}
