import { z } from "zod";
export const AuthUserSchema = z.object({
  id: z.string().min(1),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  role: z
    .union([z.string(), z.object({ id: z.string(), name: z.string().nullable().optional() })])
    .nullable()
    .optional(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;
export const AuthSessionSchema = z.object({
  accessToken: z.string().min(1).max(16384),
  refreshToken: z.string().min(1).max(16384).nullable().optional(),
  user: AuthUserSchema,
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export function authErrorMessage(error: unknown): string {
  let message: string | undefined;
  if (error && typeof error === "object") {
    if ("errors" in error && Array.isArray(error.errors)) {
      const first: unknown = error.errors[0];
      if (first && typeof first === "object" && "message" in first && typeof first.message === "string")
        message = first.message;
    }
    if (!message && "message" in error && typeof error.message === "string") message = error.message;
  }
  if (message?.includes("Invalid user credentials")) return "Invalid email or password";
  if (message?.includes("Token expired")) return "Session expired. Please login again.";
  return message || "An unexpected error occurred";
}
