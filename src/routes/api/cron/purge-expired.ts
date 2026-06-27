import { purgeExpiredFiles } from "@/server/purge-expired";

export async function GET({ request }: { request: Request }) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeExpiredFiles();

  return Response.json({
    ok: true,
    filesDeleted: result.filesDeleted,
    sessionsAborted: result.sessionsAborted,
    errors: result.errors,
  });
}
