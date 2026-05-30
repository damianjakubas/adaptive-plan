"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signIn, signUp } from "@/lib/auth/actions";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

type Mode = "signIn" | "signUp";

/** Both schemas share this shape; one type keeps the generic form simple. */
type AuthFormValues = { email: string; password: string };

const INPUT_CLASS =
  "input-dark h-12 rounded-t-md border-x-0 border-t-0 border-b-2 border-b-transparent bg-[#262626] text-on-surface placeholder:text-on-surface-variant/50 focus-visible:border-b-primary-container focus-visible:ring-0";

function AuthForm({ mode }: { mode: Mode }) {
  const tAuth = useTranslations("Auth");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("AuthErrors");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const isSignIn = mode === "signIn";
  const schema = isSignIn ? signInSchema : signUpSchema;
  const action = isSignIn ? signIn : signUp;

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: AuthFormValues) {
    startTransition(async () => {
      // On success the server action calls `redirect()`, so this resolves with
      // no value and navigation follows; a returned result means failure.
      const result = await action(values);
      if (result && !result.ok) {
        toast.error(tErrors(result.code));
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-stack-md">
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <FormItem className="gap-stack-sm">
              <FormLabel className="font-label-md text-label-md text-on-surface-variant">
                {tAuth("emailLabel")}
              </FormLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={tAuth("emailPlaceholder")}
                    className={`${INPUT_CLASS} pl-10`}
                    {...field}
                  />
                </FormControl>
              </div>
              {fieldState.error?.message ? (
                <p className="text-label-md text-sm text-destructive">
                  {tValidation(fieldState.error.message)}
                </p>
              ) : null}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <FormItem className="gap-stack-sm">
              <FormLabel className="font-label-md text-label-md text-on-surface-variant">
                {tAuth("passwordLabel")}
              </FormLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignIn ? "current-password" : "new-password"}
                    placeholder={tAuth("passwordPlaceholder")}
                    className={`${INPUT_CLASS} px-10`}
                    {...field}
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={tAuth("passwordLabel")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {fieldState.error?.message ? (
                <p className="text-label-md text-sm text-destructive">
                  {tValidation(fieldState.error.message)}
                </p>
              ) : null}
            </FormItem>
          )}
        />

        <div className="pt-stack-sm">
          <Button
            type="submit"
            disabled={isPending}
            className="btn-glow h-12 w-full rounded-md bg-primary-container font-label-md text-label-md uppercase text-on-primary-container hover:bg-primary-container/90"
          >
            <span>{tAuth(isSignIn ? "signInButton" : "signUpButton")}</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Tabbed login / register card. Each tab is an RHF form bound to the shared Zod
 * schema; field errors render inline (localized) and action-level failures fire a
 * localized Sonner toast. Ports the mockup's glass-panel + neon-lime CTA styling.
 */
export function AuthCard() {
  const tAuth = useTranslations("Auth");

  return (
    <Tabs defaultValue="signIn" className="w-full">
      <TabsList
        variant="line"
        className="mb-8 grid w-full grid-cols-2 gap-0 rounded-none border-b border-outline-variant/50 bg-transparent p-0"
      >
        <TabsTrigger
          value="signIn"
          className="rounded-none pb-4 font-label-md text-label-md text-on-surface-variant data-active:text-primary-fixed"
        >
          {tAuth("loginTab")}
        </TabsTrigger>
        <TabsTrigger
          value="signUp"
          className="rounded-none pb-4 font-label-md text-label-md text-on-surface-variant data-active:text-primary-fixed"
        >
          {tAuth("registerTab")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="signIn">
        <AuthForm mode="signIn" />
      </TabsContent>
      <TabsContent value="signUp">
        <AuthForm mode="signUp" />
      </TabsContent>
    </Tabs>
  );
}
