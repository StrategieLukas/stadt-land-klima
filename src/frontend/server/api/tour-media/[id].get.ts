/** Stream only assets belonging to a published tour-stop report, including range requests. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Media not found' });
  }
  const config = useRuntimeConfig(event);
  const base = config.public.serverDirectusUrl.replace(/\/$/, '');
  const query = new URL(event.node.req.url || event.path || '/', 'http://media.local').searchParams;
  const previewToken = query.get('access_token');
  const headers = { Authorization: `Bearer ${typeof previewToken === 'string' ? previewToken : (config.directusFrontendServerToken || config.public.directusToken)}` };
  if (typeof previewToken === 'string') {
    const permissions = await $fetch<{data:Record<string,Record<string,{access:string}>>}>(`${base}/permissions/me`,{headers});
    const access=permissions.data.success_project_tour_stops?.update?.access;
    if (!access || access === 'none') throw createError({statusCode:403,statusMessage:'Editor permission required'});
  }
  const reports = await $fetch<{ data: { id: string }[] }>(`${base}/items/success_project_tour_stops`, {
    headers,
    query: { fields: 'id', limit: 1, filter: JSON.stringify({
      ...(typeof previewToken === 'string' ? {} : { status: { _eq: 'published' }, report_status: { _eq: 'published' }, tour: { status: { _eq: 'published' } } }),
      _or: [{ image: { _eq: id } }, { media: { file: { _eq: id } } }, { media: { poster: { _eq: id } } }],
    }) },
  });
  if (!reports.data.length) throw createError({ statusCode: 404, statusMessage: 'Media not found' });
  const transforms = new URLSearchParams();
  for (const name of ['width', 'height'] as const) {
    const value = query.get(name);
    if (value && /^\d+$/.test(value)) transforms.set(name, String(Math.min(Number(value), 1600)));
  }
  const fit = query.get('fit');
  if (fit === 'cover' || fit === 'contain') transforms.set('fit', fit);
  const range = event.node.req.headers.range;
  const upstream = await fetch(`${base}/assets/${id}?${transforms}`, {
    headers: { ...headers, ...(range ? { Range: range } : {}) }, redirect: 'error',
  });
  if (!upstream.ok) throw createError({ statusCode: upstream.status === 416 ? 416 : 502, statusMessage: 'Media unavailable' });
  const responseHeaders = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  for (const name of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
});
