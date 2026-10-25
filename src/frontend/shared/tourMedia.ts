import { relationId } from "./tour";

export type MediaFile = { id: string; type?: string | null | undefined } | string;
export type TourMedia = {
  id: number;
  file: MediaFile;
  poster?: MediaFile | null | undefined;
  sort?: number | null | undefined;
  alt: string;
  caption?: string | null | undefined;
  credit: string;
};
export const isVideoMedia = (media: TourMedia): boolean =>
  typeof media.file !== "string" && Boolean(media.file.type?.startsWith("video/"));
export const orderedMedia = (report?: { media?: TourMedia[] | undefined } | null): TourMedia[] =>
  [...(report?.media ?? [])]
    .filter((media) => relationId(media.file))
    .sort((a, b) => (a.sort ?? Number.MAX_SAFE_INTEGER) - (b.sort ?? Number.MAX_SAFE_INTEGER) || a.id - b.id);
