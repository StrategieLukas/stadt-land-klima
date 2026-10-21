import { publicStopFilter, tourHref, tourStopHref } from '~/shared/successProjectTour';
import type { SuccessProjectTourStop } from '~/shared/successProjectTour';
export async function useLegacyTourRedirect(kind:'tour'|'stop',slug:string):Promise<boolean>{
  const route=useRoute();
  try {
    const result = await $fetch('/api/public/legacy-tour-redirect', {
      query: { kind, slug },
    });
    if(!result.found) return false;
    const row = result.data;
    const href=kind==='tour'?tourHref(row):tourStopHref(row as SuccessProjectTourStop);
    await navigateTo(href+route.fullPath.slice(route.path.length),{redirectCode:301,replace:true});
    return true;
  } catch {
    return false;
  }
}
