# Development tour media

These original synthetic images and the five-second WebM test-pattern clip are
development fixtures, not photographs or footage of real tour visits.

Run the explicit seed command inside the development Directus container with a
working local admin token supplied as `CLI_DIRECTUS_STATIC_TOKEN`:

```bash
docker compose -f docker-compose.yaml exec -e CLI_DIRECTUS_STATIC_TOKEN directus \
  /directus/cli/node_modules/.bin/tsx /directus/cli/seedTourDemoContent.ts
```

The command requires `SLK_ENV=development`, uses the container-local Directus API,
and fills only Tour Ost 2026 stops without existing report fields or media. It never overwrites
editorial reports. Reruns reuse uploaded fixture files and skip existing reports.
It is intentionally separate from production imports and automatic migrations.

Each stop report contains a Blökkli text block, three images and one uploaded video.
Their order varies by stop to test portrait crops, video-first previews, optional
video posters and the four-item gallery. Reports are published only after their
blocks have been saved through the existing atomic Blökkli publishing endpoint.
Failed publishes retain the stop itinerary and its incomplete draft for inspection.
Reruns skip that draft too, so existing editorial work is never overwritten.

All report titles, teasers, captions and credits identify the content as test data.
The assets are shared across stops and can be replaced through normal CMS editing.
