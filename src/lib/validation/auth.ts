import { z } from "zod";

/**
 * Shared email + password schemas reused by the client form (RHF + zodResolver)
 * and the server actions. Error messages are i18n keys resolved to localized
 * strings by the consumer (next-intl `Validation` namespace), never hardcoded copy.
 */
export const signInSchema = z.object({
  email: z.email({ message: "invalid_email" }),
  password: z.string().min(1, { message: "password_required" }),
});

export const signUpSchema = z.object({
  email: z.email({ message: "invalid_email" }),
  password: z.string().min(6, { message: "password_too_short" }),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
