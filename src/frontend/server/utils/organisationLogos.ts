import { z } from "zod";

const MissingDarkLogoErrorSchema = z.object({
  errors: z
    .array(
      z.object({
        message: z.string(),
        extensions: z.object({ code: z.enum(["FORBIDDEN", "INVALID_QUERY"]) }),
      }),
    )
    .min(1),
});

/** Keep legacy logos readable while the optional field and private policy await import. */
export async function readWithOrganisationDarkLogo<T>(read: (includeDarkLogo: boolean) => Promise<T>): Promise<T> {
  try {
    return await read(true);
  } catch (error) {
    const parsed = MissingDarkLogoErrorSchema.safeParse(error);
    if (
      !parsed.success ||
      !parsed.data.errors.every(
        ({ message }) => /["']logo_dark["']/.test(message) && /["']organisations["']/.test(message),
      )
    )
      throw error;
    return read(false);
  }
}
