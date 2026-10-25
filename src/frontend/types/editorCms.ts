import type { CoreSchema, DirectusFile } from "@directus/sdk";
import type { SuccessProjectTour, SuccessProjectTourStop } from "~/shared/successProjectTour";
import type { TourMedia } from "~/shared/tourMedia";
type File = DirectusFile<object>;
type Tour = Omit<SuccessProjectTour, "cover_image" | "brand_logo"> & {
  cover_image?: File | string | null | undefined;
  brand_logo?: File | string | null | undefined;
};
type Media = Omit<TourMedia, "file" | "poster"> & { file: File | string; poster?: File | string | null | undefined };
type Stop = Omit<SuccessProjectTourStop, "tour" | "image" | "itinerary_image" | "media"> & {
  tour: Tour;
  image?: File | string | null | undefined;
  itinerary_image?: File | string | null | undefined;
  media?: Media[] | undefined;
};
interface EditorialCollections {
  success_project_tours: Tour[];
  success_project_tour_stops: Stop[];
  success_project_tour_media: Media[];
  blocks: {
    id: number;
    uuid: string;
    bundle: string;
    entity_type: string;
    entity_uuid: string;
    field_name: string;
    status: string;
    sort_order: number;
    props: Record<string, unknown>;
    options: Record<string, unknown>;
  }[];
}
export type EditorCmsSchema = EditorialCollections & CoreSchema<EditorialCollections>;
