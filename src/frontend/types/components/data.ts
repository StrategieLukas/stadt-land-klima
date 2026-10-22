export interface HistogramConfig {
  title?: string;
  histogramUrl?: string | null;
  unit?: string | null;
  dataProductName?: string;
  population?: number | null;
  municipalityName?: string;
  isPercentage?: boolean;
  currentValue?: number | null;
  dataType?: string | null;
  attributeName?: string | null;
  populationNormalized?: boolean;
  orangeThreshold?: number | null;
  yellowThreshold?: number | null;
  lightGreenThreshold?: number | null;
  darkGreenThreshold?: number | null;
}
