import { relationId } from './tour';

export type MediaFile = { id: string; type?: string } | string;
export type TourMedia = {
  id: number; file: MediaFile; poster?: MediaFile | null; sort?: number | null;
  alt: string; caption?: string | null; credit: string;
};
export type EventReport = {
  id: string; event: string | { id: string }; status: string; title: string;
  teaser?: string | null; author?: string | null; date_published?: string | null;
  image?: MediaFile | null; image_credits?: string | null; media?: TourMedia[];
};
export const REPORT_FIELDS = ['id', 'event', 'status', 'title', 'teaser', 'author', 'date_published', 'image_credits',
  { image: ['id', 'type'] }, { media: ['id', 'sort', 'alt', 'caption', 'credit', { file: ['id', 'type'] }, { poster: ['id', 'type'] }] }];
export const isVideoMedia = (media: TourMedia): boolean => typeof media.file !== 'string' && Boolean(media.file.type?.startsWith('video/'));
export const orderedMedia = (report?: EventReport | null): TourMedia[] => [...(report?.media ?? [])]
  .filter(media => relationId(media.file))
  .sort((a, b) => (a.sort ?? Number.MAX_SAFE_INTEGER) - (b.sort ?? Number.MAX_SAFE_INTEGER) || a.id - b.id);
