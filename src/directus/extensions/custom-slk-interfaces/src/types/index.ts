import type { DefineComponent } from 'vue';

// Directus Extension Interface Configuration
export interface DirectusInterfaceConfig {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  component: DefineComponent;
  types: string[];
  group?: string;
  localTypes?: string[];
  recommendedDisplays?: string[];
  options?: InterfaceOption[] | null;
}

// Interface Option Configuration
export interface InterfaceOption {
  field: string;
  type: string;
  name: string;
  meta?: Record<string, unknown>;
  schema?: Record<string, unknown>;
}

// Page type for autocomplete
export interface Page {
  id: string | number;
  name: string;
  slug: string;
  status?: string;
}

// File type for library
export interface DirectusFile {
  id: string;
  title?: string;
  filename_download: string;
  type: string;
  uploaded_on?: string;
}

// Unsplash photo type
export interface UnsplashPhoto {
  id: string;
  urls: {
    small: string;
    regular: string;
  };
  description?: string;
  user: {
    name: string;
    link: string;
  };
  download_location?: string;
}

// Unsplash search response
export interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  page: number;
  total_pages: number;
}
