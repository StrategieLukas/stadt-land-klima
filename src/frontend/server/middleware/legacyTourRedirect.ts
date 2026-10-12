/** Preserve old tour URLs; ordinary event/news routes continue to their pages. */
export default defineEventHandler(async event => {
  const requestUrl = new URL(event.node.req.url || event.path || '/', 'http://tour.local');
  const path = requestUrl.pathname;
  const match = path.match(/^\/(events\/series|events|news)\/([^/]+)\/?$/);
  if (!match) return;
  const config = useRuntimeConfig(event);
  const base = String(config.directusServerUrl || config.public.serverDirectusUrl).replace(/\/$/,'');
  const headers = {Authorization:`Bearer ${config.public.directusToken}`};
  const slug = decodeURIComponent(match[2]);
  let target: string | undefined;
  if (match[1] === 'events/series') {
    // A matching published native tour is enough; the legacy series may be gone.
    const result = await $fetch<{data:{slug:string}[]}>(`${base}/items/success_project_tours`,{headers,query:{fields:'slug',limit:1,filter:JSON.stringify({slug:{_eq:slug},status:{_eq:'published'}})}});
    if (result.data[0]) target=`/projects/tours/${result.data[0].slug}`;
  } else if (match[1] === 'events') {
    const result = await $fetch<{data:{slug:string;tour:{slug:string}}[]}>(`${base}/items/success_project_tour_stops`,{headers,query:{fields:'slug,tour.slug',limit:1,filter:JSON.stringify({slug:{_eq:slug},status:{_eq:'published'},tour:{status:{_eq:'published'}}})}});
    if (result.data[0]) target=`/projects/tours/${result.data[0].tour.slug}/${result.data[0].slug}`;
  } else {
    const result=await $fetch<{data:{tour_stop:{slug:string;tour:{slug:string}}|null}[]}>(`${base}/items/news_items`,{headers,query:{fields:'tour_stop.slug,tour_stop.tour.slug',limit:1,filter:JSON.stringify({slug:{_eq:slug},status:{_eq:'published'},is_tour_redirect:{_eq:true},tour_stop:{status:{_eq:'published'},tour:{status:{_eq:'published'}}}})}});
    const stop=result.data[0]?.tour_stop;
    if (stop?.tour) target=`/projects/tours/${stop.tour.slug}/${stop.slug}`;
  }
  if(target) return new Response(null,{status:301,headers:{Location:target+requestUrl.search}});
});
