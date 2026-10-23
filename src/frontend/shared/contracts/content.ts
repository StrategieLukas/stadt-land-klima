import { z } from "zod";

export const EntityIdSchema = z.union([z.string().min(1), z.number().int()]);
export const NullableTextSchema = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
export const FileSchema = z.object({ id: z.string(), type: NullableTextSchema });
export const AssetSchema = z.union([z.string(), FileSchema]).nullable();
export const HttpLinkSchema = z.string().refine((value) => {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "Expected an HTTP link");
export const ClimateToolSchema = z.object({
  id: EntityIdSchema,
  title: z.string(),
  description: z.string(),
  category: NullableTextSchema,
  vendor: NullableTextSchema,
  link: HttpLinkSchema,
  image: FileSchema.nullish().transform((value) => value ?? null),
  image_credits: NullableTextSchema,
  sort: z.number().nullable(),
});
export type ClimateTool = z.infer<typeof ClimateToolSchema>;
export const ContentPageSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  contents: NullableTextSchema,
  status: z.literal("published"),
});
export const OrganisationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  logo: AssetSchema,
  link: NullableTextSchema,
});
export const OrganisationTeamSchema = z.object({
  team_key: z.string(),
  label: NullableTextSchema,
  email: NullableTextSchema,
  color: NullableTextSchema,
  tasks: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
});
export const TeamMemberSchema = z.object({
  id: z.string(),
  first_name: NullableTextSchema,
  last_name: NullableTextSchema,
  avatar: z.string().nullable(),
  bio: NullableTextSchema,
  slk_team: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const ContentIdentitySchema = z.object({ id: z.string(), slug: z.string(), title: z.string() });
export const ProjectIdentitySchema = ContentIdentitySchema.extend({ id: z.number().int() });
export const EventSeriesSchema = ContentIdentitySchema.extend({
  introduction: NullableTextSchema,
  format: NullableTextSchema,
  cover_image: AssetSchema,
  cover_image_credits: NullableTextSchema,
  brand_logo: AssetSchema,
  closing_reflection: NullableTextSchema,
});
export const EventSchema = ContentIdentitySchema.extend({
  description: NullableTextSchema,
  start_date: z.string(),
  end_date: NullableTextSchema,
  date_only: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  location: NullableTextSchema,
  event_type: NullableTextSchema,
  event_category: NullableTextSchema,
  image: FileSchema.nullish().transform((value) => value ?? null),
  image_credits: NullableTextSchema,
});
export type PublicEvent = z.infer<typeof EventSchema>;
export const EventDetailSchema = EventSchema.extend({
  registration_url: NullableTextSchema,
  cta_label: NullableTextSchema,
  series: EventSeriesSchema.pick({ slug: true, title: true, format: true }).nullable(),
});
const ProjectMeasureSchema = z.object({ id: z.string(), measure_id: z.string(), name: z.string(), slug: z.string() });
export const ProjectListSchema = ProjectIdentitySchema.extend({
  abstract: NullableTextSchema,
  author: NullableTextSchema,
  date_created: NullableTextSchema,
  municipality_name: NullableTextSchema,
  state: NullableTextSchema,
  sectors: z.array(z.string()).nullable(),
  can_do_autonomously: z.boolean().nullable(),
  is_profitable: z.boolean().nullable(),
  public_impact_effects: z.array(z.string()).nullable(),
  ghg_savings_level: NullableTextSchema,
  profile_stage: NullableTextSchema,
  image: FileSchema.nullish().transform((value) => value ?? null),
  image_credits: NullableTextSchema,
  municipality: z
    .object({
      id: z.string(),
      name: z.string(),
      state: NullableTextSchema,
      geolocation: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(), z.number()]) }).nullable(),
    })
    .nullable(),
  organisation: OrganisationSchema.omit({ link: true }).nullable(),
  measures: z.array(z.object({ measures_id: ProjectMeasureSchema.nullable() })).nullable(),
});
export const ProjectDetailSchema = ProjectIdentitySchema.extend({
  date_created: NullableTextSchema,
  subtitle: NullableTextSchema,
  abstract: NullableTextSchema,
  article_text: NullableTextSchema,
  image: FileSchema.nullish().transform((value) => value ?? null),
  image_credits: NullableTextSchema,
  author: NullableTextSchema,
  municipality_name: NullableTextSchema,
  state: NullableTextSchema,
  link: NullableTextSchema,
  instagram: NullableTextSchema,
  linkedin: NullableTextSchema,
  profile_stage: NullableTextSchema,
  organisation: OrganisationSchema.nullable(),
  measures: z.array(z.object({ measures_id: ProjectMeasureSchema.nullable() })).nullable(),
});
export const NewsListSchema = ContentIdentitySchema.extend({
  teaser: NullableTextSchema,
  image: FileSchema.nullish().transform((value) => value ?? null),
  image_credits: NullableTextSchema,
  date_published: NullableTextSchema,
  date_created: NullableTextSchema,
});
export const NewsDetailSchema = NewsListSchema.extend({
  author: NullableTextSchema,
  status: z.string(),
  is_tour_redirect: z.boolean(),
  tour_stop: z
    .object({ id: z.string(), slug: z.string(), tour: z.object({ slug: z.string(), title: z.string() }).nullable() })
    .nullable(),
  report_event: ContentIdentitySchema.extend({
    series: z.object({ slug: z.string(), title: z.string(), format: NullableTextSchema }).nullable(),
  }).nullable(),
});
export const TourSchema = ContentIdentitySchema.extend({
  status: z.literal("published"),
  introduction: NullableTextSchema,
  closing_reflection: NullableTextSchema,
  featured_on_projects: z.boolean(),
  cover_image: AssetSchema,
  cover_image_credits: NullableTextSchema,
  brand_logo: AssetSchema,
});
export const TourMediaSchema = z.object({
  id: z.number().int(),
  sort: z.number().nullable(),
  alt: z.string(),
  caption: NullableTextSchema,
  credit: z.string(),
  file: z.union([z.string(), FileSchema]),
  poster: AssetSchema,
});
export const TourStopSchema = ContentIdentitySchema.extend({
  status: z.literal("published"),
  sort: z.number().nullable(),
  location: NullableTextSchema,
  state: NullableTextSchema,
  geolocation: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(), z.number()]) }).nullable(),
  start_date: z.string(),
  end_date: NullableTextSchema,
  date_only: z.boolean(),
  visit_details: NullableTextSchema,
  itinerary_image: AssetSchema,
  itinerary_image_credits: NullableTextSchema,
  tour: TourSchema.pick({ id: true, slug: true, title: true, status: true }),
  report_status: z.string(),
  report_title: NullableTextSchema,
  teaser: NullableTextSchema,
  author: NullableTextSchema,
  date_published: NullableTextSchema,
  image: FileSchema.nullish().transform((value) => value ?? null),
  image_credits: NullableTextSchema,
  media: z.array(TourMediaSchema),
});
