"use server";

import { redirect } from "next/navigation";
import { settSesjonscookie, slettSesjonscookie } from "@/lib/auth/cookie";
import { sjekkPassord, UBRUKELIG_HASH } from "@/lib/auth/passord";
import { finnBrukerForInnlogging, hentKlubbtilgang } from "@/lib/data/brukere";
import { hentKlubb } from "@/lib/data/klubber";
import { adminUrl, klubbUrl } from "@/lib/lenker";

// Kun lenker inn i denne klubbens admin godtas som «neste», så
// innloggingen ikke kan brukes til å sende folk til andre nettsteder.
function tryggNeste(slug: string, neste: string): string {
  const admin = adminUrl(slug);
  return neste === admin || neste.startsWith(`${admin}/`) ? neste : admin;
}

export async function loggInn(klubbSlug: string, formData: FormData) {
  const klubb = await hentKlubb(klubbSlug);
  if (!klubb) redirect("/");

  const epost = String(formData.get("epost") ?? "");
  const passord = String(formData.get("passord") ?? "");
  const neste = tryggNeste(klubb.slug, String(formData.get("neste") ?? ""));

  // Godtas: admin i akkurat denne klubben, eller superadmin. Samme
  // feilmelding uansett hva som var feil.
  const bruker = await finnBrukerForInnlogging(epost);
  const passordOk = await sjekkPassord(passord, bruker?.passordHash ?? UBRUKELIG_HASH);
  const tilgang = bruker && passordOk ? await hentKlubbtilgang(bruker.id, klubb.id) : null;
  if (!bruker || !tilgang) {
    redirect(`${adminUrl(klubb.slug)}/login?feil=1&neste=${encodeURIComponent(neste)}`);
  }

  await settSesjonscookie({ brukerId: bruker.id, klubb: { id: klubb.id, slug: klubb.slug } });
  redirect(neste);
}

export async function loggUt(klubbSlug: string) {
  await slettSesjonscookie();
  redirect(klubbUrl(klubbSlug));
}
