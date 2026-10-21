/**
 * Internal Directus schema types for the jobs feature.
 *
 * These types describe the actual CMS structure. They are NOT public contracts —
 * public responses are constructed explicitly in the API routes using allowlisted
 * mappers. Keep private fields (e.g., internal notes) out of public DTOs.
 */

export interface DirectusJobOffer {
  id: string;
  slug: string;
  role_title: string;
  type: "full_time" | "part_time" | "internship" | "working_student" | "volunteer";
  status: string;
  tasks: string | null;
  qualifications: string | null;
  benefits: string | null;
  contact_notes: string | null;
  salary: string | null;
  hourly_wage: string | null;
  weekly_hours: string | null;
  start_date: string | null;
  end_date: string | null;
  application_url: string | null;
  organisation: number | DirectusOrganisation | null;
  date_created: string;
}

export interface DirectusOrganisation {
  id: number;
  name: string;
  link: string | null;
  logo: string | DirectusAssets | null;
}

export interface DirectusAssets {
  id: string;
  type: string | null;
}

export interface DirectusSchema {
  job_offers: DirectusJobOffer[];
  organisations: DirectusOrganisation[];
  directus_files: DirectusAssets[];
}
