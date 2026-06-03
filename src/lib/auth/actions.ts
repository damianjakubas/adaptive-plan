"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { mapAuthError, type AuthResult } from "@/lib/auth/errors";
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation/auth";

/**
 * Sign in with email + password. On success redirects to the active plan;
 * on failure returns a mapped error code the UI resolves to a localized message.
 */
export async function signIn(values: SignInInput): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, code: "generic" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, code: mapAuthError(error) };
  }

  redirect("/plan");
}

/**
 * Register with email + password. Auto-confirm is enabled (no email step), so a
 * successful sign-up yields an immediate session and redirects to the active plan.
 */
export async function signUp(values: SignUpInput): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, code: "generic" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, code: mapAuthError(error) };
  }

  // With email confirmation disabled, a duplicate signup does NOT error — Supabase
  // returns a user with an empty `identities` array. Treat that as "already registered".
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, code: "email_exists" };
  }

  redirect("/plan");
}

/** Sign out and return to the auth route. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
