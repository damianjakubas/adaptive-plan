import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

/**
 * Protected placeholder dashboard — the post-login landing target. S-02 replaces
 * this with the parameter form. Defense in depth: re-checks the session here in
 * addition to the proxy gate (Server Functions can bypass proxy matchers).
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations("Dashboard");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-stack-md px-container-margin text-center">
      <h1 className="font-headline-lg text-headline-lg">
        {t("greeting", { email: user.email ?? "" })}
      </h1>
      <p className="text-body-md text-on-surface-variant">{t("subtitle")}</p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          {t("logout")}
        </Button>
      </form>
    </div>
  );
}
