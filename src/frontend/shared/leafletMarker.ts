import type { DivIcon, Icon } from "leaflet";
/** vue-leaflet narrows icon options to image icons, though Leaflet accepts DivIcon too. */
export function leafletMarkerIcon(icon: Icon | DivIcon | null | undefined): Icon | undefined {
  return icon == null ? undefined : (icon as Icon);
}

/** Omit missing icons rather than passing undefined to vue-leaflet. */
export function leafletMarkerProps(icon: Icon | undefined): { icon?: Icon } {
  return icon ? { icon } : {};
}
