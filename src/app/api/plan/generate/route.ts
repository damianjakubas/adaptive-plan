import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import { getLocale } from "next-intl/server";

import { saveActivePlan } from "@/db/plans";
import buildPlanPrompt from "@/lib/plan/build-prompt";
import { mapPlanError, type PlanErrorCode } from "@/lib/plan/errors";
import { logGenerationError } from "@/lib/plan/log-generation-error";
import { createClient } from "@/lib/supabase/server";
import { planInputSchema, planOutputSchema } from "@/lib/validation/plan-schema";

/**
 * Streaming generation endpoint for US-01.
 *
 * Flow: authenticate → validate the 12 parameter inputs → stream a structured plan
 * from Gemini → persist it server-side as the user's single active plan.
 *
 * Persistence happens in `onFinish` (see Critical Implementation Details in the
 * plan): `onFinish` does not receive the parsed object, so we await `result.output`,
 * `safeParse` it, and only then `saveActivePlan`. A rejected `output`, a failed parse,
 * or a DB error must NOT mutate the active plan — we swallow and let the client
 * surface a generation error. The write runs after the stream is consumed; Fluid
 * Compute keeps the function alive because the SDK awaits the `onFinish` promise as
 * part of finalizing the stream. The response itself is never blocked on the write.
 */

// Free-tier Gemini can be slow on a full structured plan; the 2s-acknowledgment NFR
// is met by the stream opening, not by completion, so allow a generous ceiling.
export const maxDuration = 300;

const MODEL_ID = "gemini-2.5-flash";

function errorResponse(code: PlanErrorCode, status: number): Response {
  return Response.json({ code }, { status });
}

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("unauthenticated", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_parameters", 400);
  }

  const parsed = planInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("invalid_parameters", 400);
  }
  const input = parsed.data;
  const locale = await getLocale();

  try {
    const result = streamText({
      abortSignal: req.signal,
      model: google(MODEL_ID),
      onError: ({ error }) => {
        logGenerationError({ error, stage: "stream" });
      },
      onFinish: async () => {
        try {
          const generated = await result.output;
          const validated = planOutputSchema.safeParse(generated);
          if (!validated.success) {
            logGenerationError({ error: validated.error, stage: "validation" });
            return;
          }
          await saveActivePlan({
            model: MODEL_ID,
            parameters: input,
            plan: validated.data,
            userId: user.id,
          });
        } catch (error) {
          logGenerationError({ error, stage: "persist" });
        }
      },
      output: Output.object({ schema: planOutputSchema }),
      prompt: buildPlanPrompt(input, locale),
    });

    return result.toTextStreamResponse();
  } catch (error) {
    logGenerationError({ error, stage: "setup" });
    return errorResponse(mapPlanError(error), 500);
  }
}
