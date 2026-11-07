import { filnavnForKopi, hentBackup } from "@/lib/data/backup";
import { krevKlubbAdmin } from "@/lib/klubb-admin";

// Nedlasting av én sikkerhetskopi som JSON-fil. proxy.ts krever innlogging
// i klubben, men tilgangen sjekkes også her, slik som i server actions.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/[klubb]/admin/serie/[serieId]/backup/[backupId]">
) {
  const { klubb: klubbSlug, serieId, backupId } = await ctx.params;
  let klubbId: string;
  try {
    klubbId = (await krevKlubbAdmin(klubbSlug)).id;
  } catch {
    return new Response("Ikke tilgang", { status: 403 });
  }

  const backup = await hentBackup(klubbId, serieId, backupId);
  if (!backup) return new Response("Finnes ikke", { status: 404 });

  return new Response(backup.data, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filnavnForKopi({ ...backup, klubbSlug })}"`,
    },
  });
}
