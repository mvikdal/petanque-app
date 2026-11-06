"use server";

import { redirect } from "next/navigation";
import { settSesjonscookie, slettSesjonscookie } from "@/lib/auth/cookie";
import { finnBrukerForInnlogging, finnDemoAdmin, hentKlubbtilgang } from "@/lib/data/brukere";
import { brukKode, ForMangeKoder, opprettKode } from "@/lib/data/innloggingskoder";
import { hentKlubb } from "@/lib/data/klubber";
import { sendInnloggingskode } from "@/lib/epost";
import { adminUrl, klubbUrl } from "@/lib/lenker";

// Innlogging i to steg (2026-10-24): først e-post, så en engangskode som
// sendes dit. Godtas: admin i akkurat denne klubben, eller superadmin.
// Svaret er det samme uansett om e-posten finnes, så innloggingen ikke
// avslører hvem som er admin.

// Kun lenker inn i denne klubbens admin godtas som «neste», så
// innloggingen ikke kan brukes til å sende folk til andre nettsteder.
function tryggNeste(slug: string, neste: string): string {
  const admin = adminUrl(slug);
  return neste === admin || neste.startsWith(`${admin}/`) ? neste : admin;
}

function loginUrl(slug: string, felter: Record<string, string>) {
  return `${adminUrl(slug)}/login?${new URLSearchParams(felter)}`;
}

export async function sendKode(klubbSlug: string, formData: FormData) {
  const klubb = await hentKlubb(klubbSlug);
  if (!klubb) redirect("/");

  const epost = String(formData.get("epost") ?? "").trim();
  const neste = tryggNeste(klubb.slug, String(formData.get("neste") ?? ""));

  const bruker = await finnBrukerForInnlogging(epost);
  const tilgang = bruker && (await hentKlubbtilgang(bruker.id, klubb.id));
  if (bruker && tilgang) {
    try {
      await sendInnloggingskode(bruker.epost, await opprettKode(bruker.id), klubb.navn);
    } catch (e) {
      // For mange koder: ingen ny e-post, men samme svar som ellers.
      if (!(e instanceof ForMangeKoder)) {
        console.error("Kunne ikke sende innloggingskode:", e);
        redirect(loginUrl(klubb.slug, { feil: "sending", neste }));
      }
    }
  }
  redirect(loginUrl(klubb.slug, { steg: "kode", epost, neste }));
}

export async function bekreftKode(klubbSlug: string, formData: FormData) {
  const klubb = await hentKlubb(klubbSlug);
  if (!klubb) redirect("/");

  const epost = String(formData.get("epost") ?? "").trim();
  const neste = tryggNeste(klubb.slug, String(formData.get("neste") ?? ""));

  const bruker = await finnBrukerForInnlogging(epost);
  const kodeOk = !!bruker && (await brukKode(bruker.id, String(formData.get("kode") ?? "")));
  const tilgang = bruker && kodeOk ? await hentKlubbtilgang(bruker.id, klubb.id) : null;
  if (!bruker || !tilgang) {
    redirect(loginUrl(klubb.slug, { steg: "kode", epost, neste, feil: "kode" }));
  }

  await settSesjonscookie({ brukerId: bruker.id, klubb: { id: klubb.id, slug: klubb.slug } });
  redirect(neste);
}

// Demo-klubben kan prøves av hvem som helst (instruks §6), uten e-post.
// Knappen logger inn som klubbens demo-admin, som har rollen "demo" og
// ikke kan legge til brukere eller tolke resultatark.
export async function loggInnSomDemo(klubbSlug: string) {
  const klubb = await hentKlubb(klubbSlug);
  if (!klubb || klubb.slug !== "demo") redirect("/");

  const demo = await finnDemoAdmin(klubb.id);
  if (!demo) redirect(loginUrl(klubb.slug, { feil: "demo" }));

  await settSesjonscookie({ brukerId: demo.brukerId, klubb: { id: klubb.id, slug: klubb.slug } });
  redirect(adminUrl(klubb.slug));
}

export async function loggUt(klubbSlug: string) {
  await slettSesjonscookie();
  redirect(klubbUrl(klubbSlug));
}
