import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import PlanGenerator from "@/components/plan/plan-generator";
import { getUser } from "@/lib/supabase/get-user";

export async function generateMetadata() {
  const t = await getTranslations("Nav");
  return { title: t("newPlan") };
}

export default async function NewPlanPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations("Plan");

  return (
    <div className="container max-w-400 py-12 mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      </div>
      <PlanGenerator />
    </div>
  );
}
