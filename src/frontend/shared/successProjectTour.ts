import type { MediaFile, TourMedia } from "./tourMedia";
import type { TourPoint } from "./tour";
import type { ComputedRef, InjectionKey } from "vue";
export const TOUR_REPORT_MEDIA: InjectionKey<
  ComputedRef<{ fileIds: Set<string>; editorPreview?: boolean | undefined }>
> = Symbol("tour-report-media");
export type SuccessProjectTour = {
  id: string;
  slug: string;
  title: string;
  status: string;
  introduction?: string | null | undefined;
  closing_reflection?: string | null | undefined;
  cover_image?: MediaFile | null | undefined;
  cover_image_credits?: string | null | undefined;
  brand_logo?: MediaFile | null | undefined;
  featured_on_projects?: boolean | undefined;
};
export type SuccessProjectTourStop = {
  id: string;
  slug: string;
  title: string;
  status: string;
  tour: SuccessProjectTour;
  sort?: number | null | undefined;
  location?: string | null | undefined;
  state?: string | null | undefined;
  geolocation?: TourPoint | null | undefined;
  start_date: string;
  end_date?: string | null | undefined;
  date_only?: boolean | undefined;
  visit_details?: string | null | undefined;
  itinerary_image?: MediaFile | null | undefined;
  itinerary_image_credits?: string | null | undefined;
  report_status: string;
  report_title?: string | null | undefined;
  teaser?: string | null | undefined;
  author?: string | null | undefined;
  date_published?: string | null | undefined;
  image?: MediaFile | null | undefined;
  image_credits?: string | null | undefined;
  media?: TourMedia[] | undefined;
  legacy_report_id?: string | null | undefined;
  source_news_item?: string | null | undefined;
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
