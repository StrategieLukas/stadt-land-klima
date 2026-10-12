import { readItems } from '@directus/sdk';
import { publicStopFilter, tourHref, tourStopHref } from '~/shared/successProjectTour';
import type { SuccessProjectTourStop } from '~/shared/successProjectTour';
export async function useLegacyTourRedirect(kind:'tour'|'stop',slug:string):Promise<boolean>{
  const {$directus}=useNuxtApp();
  const route=useRoute();
  const rows=await $directus.request(readItems(kind==='tour'?'success_project_tours':'success_project_tour_stops',{
    filter:kind==='tour'?{slug:{_eq:slug},status:{_eq:'published'}}:{...publicStopFilter,slug:{_eq:slug}},fields:kind==='tour'?['slug']:['slug',{tour:['slug']}],limit:1,
  }));
  if(!rows[0])return false;
  const href=kind==='tour'?tourHref(rows[0]):tourStopHref(rows[0] as SuccessProjectTourStop);
  await navigateTo(href+route.fullPath.slice(route.path.length),{redirectCode:301,replace:true});
  return true;
}
