# Prompt for the Stadt.Land.Zahl backend

Implement optional national overview images for each public data collection. The Stadt.Land.Klima `/data` page already uses the collection's existing `cover_image` for its card. When someone opens a card, it fetches `GET /api/collections/{id}/` and can display `overview_visuals` beneath the collection description and narrative steps. The collection index manifest should stay small.

## Requested behavior

1. For a collection with a meaningful municipality-level result, generate a Germany-wide choropleth image of **all municipality areas**, colored by that result. Use the same metric definition, unit, normalization, thresholds, palette direction, and no-data handling as the collection's existing abstract map or KPI plot. Include a clear legend. Never color missing values as zero.
2. Generate a histogram of that same municipality-level result. Label the axes, unit, number of municipalities, and missing-data count. Ensure the histogram and map use the same data snapshot and filtering rules.
3. Reuse the existing abstract plot metadata (`render_elements`, `plot_id`, localized `title` and `description`, and existing narrative descriptions). Do not create a second editorial source for those descriptions. If a collection has no suitable numeric municipality result, omit the relevant image rather than inventing a metric.
4. Expose pre-rendered, cached PNG or WebP images through stable public API paths. Keep geometry and raw municipality rows out of the collection response. Regenerate or invalidate images when source data or plot definitions change. Supply source attribution and accessible localized alt text.
5. Add the optional field below to `GET /api/collections/{id}/`. Existing clients and collections without images must continue to work. The frontend resolves relative `image_url` paths against its Stadt.Land.Zahl proxy and displays the images only when the field is present.

```json
{
  "overview_visuals": [
    {
      "plot_id": "existing-national-comparison-plot-id",
      "type": "municipality_map",
      "image_url": "/api/collections/wind-turbines/overview/municipality-map.webp",
      "title": { "de-DE": "…", "en-US": "…" },
      "description": { "de-DE": "…", "en-US": "…" },
      "alt": { "de-DE": "…", "en-US": "…" },
      "attribution": { "de-DE": "…", "en-US": "…" }
    },
    {
      "plot_id": "existing-national-comparison-plot-id",
      "type": "histogram",
      "image_url": "/api/collections/wind-turbines/overview/histogram.webp",
      "title": { "de-DE": "…", "en-US": "…" },
      "description": { "de-DE": "…", "en-US": "…" },
      "alt": { "de-DE": "…", "en-US": "…" },
      "attribution": { "de-DE": "…", "en-US": "…" }
    }
  ]
}
```

The title and description should come from the referenced existing plot metadata wherever possible. Keep `overview_visuals` absent or empty until an image is actually available. The frontend also falls back to `render_elements[plot_id].title/description` when the new fields are omitted.

## Acceptance checks

- Compare map colors and histogram bins with the underlying municipality values for at least two collections, including one with normalized or percentage values.
- Confirm missing municipalities are counted and displayed distinctly from zero values.
- Confirm image URLs, attribution, and German/English alt text work without authentication and return cacheable responses.
- Confirm the existing collection index manifest, municipality detail plots, and API clients remain compatible.
