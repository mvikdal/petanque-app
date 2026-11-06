"use server";

import { redirect } from "next/navigation";
import { settSesjonscookie, slettSesjonscookie } from "@/lib/auth/cookie";
import { finnBrukerForInnlogging } from "@/lib/data/brukere";
import { brukKode, ForMangeKoder, opprettKode } from "@/lib/data/innloggingskoder";
import { sendInnloggingskode } from "@/lib/epost";

// Samme to steg som klubbinnloggingen (e-post, så engangskode), men bare
// for superadmin. Superadmin-sesjonen gjelder ingen klubb (klubb = null),
// så den gir ikke tilgang til noen klubbs data - bare til oppsett og
// brukere på /superadmin.

function loginUrl(felter: Record<string, string>) {
  return `/superadmin/login?${new URLSearchParams(felter)}`;
}

export async function sendKodeSuperadmin(formData: FormData) {
  const epost = String(formData.get("epost") ?? "").trim();
  const bruker = await finnBrukerForInnlogging(epost);
  if (bruker?.erSuperadmin) {
    try {
      await sendInnloggingskode(bruker.epost, await opprettKode(bruker.id), "superadmin");
    } catch (e) {
      if (!(e instanceof ForMangeKoder)) {
        console.error("Kunne ikke sende innloggingskode:", e);
        redirect(loginUrl({ feil: "sending" }));
      }
    }
  }
  redirect(loginUrl({ steg: "kode", epost }));
}

export async function bekreftKodeSuperadmin(formData: FormData) {
  const epost = String(formData.get("epost") ?? "").trim();
  const bruker = await finnBrukerForInnlogging(epost);
  const kodeOk =
    !!bruker?.erSuperadmin && (await brukKode(bruker.id, String(formData.get("kode") ?? "")));
  if (!bruker || !kodeOk) redirect(loginUrl({ steg: "kode", epost, feil: "kode" }));

  await settSesjonscookie({ brukerId: bruker.id, klubb: null });
  redirect("/superadmin");
}

export async function loggUtSuperadmin() {
  await slettSesjonscookie();
  redirect("/");
}
