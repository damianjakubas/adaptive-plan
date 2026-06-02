import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import ParameterForm from "@/components/plan/parameter-form";

export const metadata = {
  title: "New Plan",
};

export default async function NewPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations("Plan");

  return (
    <div className="container max-w-4xl py-12 mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      </div>
      <ParameterForm onGenerate={async () => {
        "use server";
        // To be implemented in Phase 5
      }} />
    </div>
  );
}
