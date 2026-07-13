import { checkGenerationQuota, currentUserId } from "@/lib/ai-usage";

/** The signed-in user's generation allowance for this month (for the UI chip). */
export async function GET() {
  const userId = await currentUserId();
  const quota = await checkGenerationQuota(userId);
  return Response.json(quota);
}
