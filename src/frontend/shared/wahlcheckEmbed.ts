import { z } from "zod";

export const WAHLCHECK_EMBED_MAX_HEIGHT = 1_000_000;
export const WahlcheckEmbedHostMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("slk:wahlcheck:init"), version: z.literal(1) }),
  z.strictObject({
    type: z.literal("slk:wahlcheck:viewport"),
    version: z.literal(1),
    top: z.number().min(0).max(WAHLCHECK_EMBED_MAX_HEIGHT),
    height: z.number().min(0).max(WAHLCHECK_EMBED_MAX_HEIGHT),
  }),
]);

export type WahlcheckEmbedMessage =
  | { type: "slk:wahlcheck:resize"; version: 1; height: number }
  | { type: "slk:wahlcheck:scroll"; version: 1; top: number };
