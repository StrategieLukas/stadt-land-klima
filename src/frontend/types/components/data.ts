export interface HistogramConfig {
  title?: string | undefined;
  histogramUrl?: string | null | undefined;
  unit?: string | null | undefined;
  dataProductName?: string | undefined;
  population?: number | null | undefined;
  municipalityName?: string | undefined;
  isPercentage?: boolean | undefined;
  currentValue?: number | null | undefined;
  dataType?: string | null | undefined;
  attributeName?: string | null | undefined;
  populationNormalized?: boolean | undefined;
  orangeThreshold?: number | null | undefined;
  yellowThreshold?: number | null | undefined;
  lightGreenThreshold?: number | null | undefined;
  darkGreenThreshold?: number | null | undefined;
}
