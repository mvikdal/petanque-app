import { sendKopierPåEpost } from "@/lib/backup-epost";
import { backupEndredeSerier } from "@/lib/data/backup";

// Nattlig sikkerhetskopi (vercel.json, kl. 03 UTC): kopi av alle serier som
// er endret siden forrige kopi, og en e-post med kopiene som vedlegg.
// Vercel sender CRON_SECRET som Bearer-token. Uten riktig token avvises
// kallet, så ingen andre kan starte jobben.
export async function GET(request: Request) {
  const hemmelighet = process.env.CRON_SECRET;
  if (!hemmelighet || request.headers.get("authorization") !== `Bearer ${hemmelighet}`) {
    return new Response("Ikke tilgang", { status: 401 });
  }

  const kopier = await backupEndredeSerier();

  // Kopiene ligger trygt i databasen selv om e-posten feiler.
  let epostSendt = true;
  try {
    await sendKopierPåEpost(kopier);
  } catch (e) {
    epostSendt = false;
    console.error("Kunne ikke sende sikkerhetskopier på e-post:", e);
  }

  return Response.json({
    kopier: kopier.map((k) => `${k.klubbSlug}/${k.serienavn}`),
    epostSendt,
  });
}
