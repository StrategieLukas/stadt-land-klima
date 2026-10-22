import type { MediaFile, TourMedia } from "./tourMedia";
import type { TourPoint } from "./tour";
import type { ComputedRef, InjectionKey } from "vue";
export const TOUR_REPORT_MEDIA: InjectionKey<ComputedRef<{ fileIds: Set<string>; accessToken?: string | null }>> =
  Symbol("tour-report-media");
export type SuccessProjectTour = {
  id: string;
  slug: string;
  title: string;
  status: string;
  introduction?: string | null;
  closing_reflection?: string | null;
  cover_image?: MediaFile | null;
  cover_image_credits?: string | null;
  brand_logo?: MediaFile | null;
  featured_on_projects?: boolean;
};
export type SuccessProjectTourStop = {
  id: string;
  slug: string;
  title: string;
  status: string;
  tour: SuccessProjectTour;
  sort?: number | null;
  location?: string | null;
  state?: string | null;
  geolocation?: TourPoint | null;
  start_date: string;
  end_date?: string | null;
  date_only?: boolean;
  visit_details?: string | null;
  itinerary_image?: MediaFile | null;
  itinerary_image_credits?: string | null;
  report_status: string;
  report_title?: string | null;
  teaser?: string | null;
  author?: string | null;
  date_published?: string | null;
  image?: MediaFile | null;
  image_credits?: string | null;
  media?: TourMedia[];
  legacy_report_id?: string | null;
  source_news_item?: string | null;
};
export const TOUR_FIELDS = [
  "id",
  "slug",
  "title",
  "status",
  "introduction",
  "closing_reflection",
  "featured_on_projects",
  "cover_image_credits",
  { cover_image: ["id", "type"] },
  { brand_logo: ["id", "type"] },
] as const;
export const REPORT_FIELDS = [
  "report_status",
  "report_title",
  "teaser",
  "author",
  "date_published",
  "image_credits",
  { image: ["id", "type"] },
  { media: ["id", "sort", "alt", "caption", "credit", { file: ["id", "type"] }, { poster: ["id", "type"] }] },
] as const;
export const STOP_FIELDS = [
  "id",
  "slug",
  "title",
  "status",
  "sort",
  "location",
  "state",
  "geolocation",
  "start_date",
  "end_date",
  "date_only",
  "visit_details",
  "itinerary_image_credits",
  { itinerary_image: ["id", "type"] },
  { tour: ["id", "slug", "title", "status"] },
  ...REPORT_FIELDS,
] as const;
export const tourHref = (tour: Pick<SuccessProjectTour, "slug">) => `/projects/tours/${tour.slug}`;
export const tourStopHref = (stop: Pick<SuccessProjectTourStop, "tour" | "slug">) =>
  `${tourHref(stop.tour)}/${stop.slug}`;
export const publicStopFilter = { status: { _eq: "published" }, tour: { status: { _eq: "published" } } };
export const publicReportFilter = { ...publicStopFilter, report_status: { _eq: "published" } };
