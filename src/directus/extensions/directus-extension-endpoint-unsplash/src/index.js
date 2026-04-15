export default {
  id: 'unsplash',
  handler: (router) => {
    const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

    if (!ACCESS_KEY) {
      router.use((_req, res) => {
        res.status(503).json({ error: 'UNSPLASH_ACCESS_KEY is not configured' });
      });
      return;
    }

    /**
     * GET /unsplash/search?q=QUERY&page=N&per_page=N
     * Proxy to Unsplash Search Photos API.
     */
    router.get('/search', async (req, res) => {
      const q = String(req.query.q || '').trim();
      if (!q) {
        return res.status(400).json({ error: 'Missing query parameter "q"' });
      }
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const per_page = Math.min(30, Math.max(1, parseInt(req.query.per_page) || 24));

      const url = new URL('https://api.unsplash.com/search/photos');
      url.searchParams.set('query', q);
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', String(per_page));
      url.searchParams.set('orientation', 'landscape');

      try {
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Client-ID ${ACCESS_KEY}`,
            'Accept-Version': 'v1',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ error: text });
        }

        const data = await response.json();

        // Return a minimal subset so we don't leak unnecessary data to the client
        const photos = (data.results || []).map((p) => ({
          id: p.id,
          description: p.alt_description || p.description || '',
          urls: {
            thumb: p.urls.thumb,
            small: p.urls.small,
            regular: p.urls.regular,
          },
          user: {
            name: p.user.name,
            link: p.user.links.html,
          },
          download_location: p.links.download_location,
        }));

        return res.json({
          total: data.total,
          total_pages: data.total_pages,
          page,
          per_page,
          results: photos,
        });
      } catch (err) {
        console.error('[unsplash endpoint] search error:', err);
        return res.status(500).json({ error: 'Upstream request failed' });
      }
    });

    /**
     * POST /unsplash/trigger-download
     * Body: { download_location: string }
     * Required by Unsplash API guidelines whenever a photo is used/downloaded.
     */
    router.post('/trigger-download', async (req, res) => {
      const { download_location } = req.body || {};
      if (!download_location || typeof download_location !== 'string') {
        return res.status(400).json({ error: 'Missing download_location in body' });
      }

      // Only allow Unsplash URLs to avoid SSRF
      if (!download_location.startsWith('https://api.unsplash.com/')) {
        return res.status(400).json({ error: 'Invalid download_location' });
      }

      try {
        await fetch(download_location, {
          headers: {
            Authorization: `Client-ID ${ACCESS_KEY}`,
            'Accept-Version': 'v1',
          },
        });
        return res.json({ ok: true });
      } catch (err) {
        console.error('[unsplash endpoint] trigger-download error:', err);
        // Non-fatal — attribution attempt failed but we don't block the user
        return res.json({ ok: false });
      }
    });
  },
};
