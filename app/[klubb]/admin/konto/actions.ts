"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { leggTilKlubbAdmin } from "@/lib/data/brukere";
import { krevKlubbAdmin, type KlubbKontekst } from "@/lib/klubb-admin";
import { adminKontoUrl } from "@/lib/lenker";

// Kontoen: legge til flere admins i klubben. Demo-admin (rolle "demo")
// har ikke lov til dette - demo-innloggingen er åpen for alle på
// /demo/admin/login, og ingen skal kunne lage nye brukere med den.

async function krevVanligAdmin(klubbSlug: string): Promise<KlubbKontekst> {
  const kontekst = await krevKlubbAdmin(klubbSlug);
  if (kontekst.rolle === "demo") {
    throw new Error("Demo-admin kan ikke opprette brukere.");
  }
  return kontekst;
}

function tilbake(slug: string, type: "ok" | "feil", melding: string): never {
  revalidatePath(adminKontoUrl(slug));
  redirect(`${adminKontoUrl(slug)}?${type}=${encodeURIComponent(melding)}`);
}

function feilmelding(e: unknown) {
  return e instanceof Error ? e.message : "Noe gikk galt.";
}

// Klubbadmin kan bare gi vanlig admin-rolle, ikke demo.
export async function leggTilAdmin(klubbSlug: string, formData: FormData) {
  const k = await krevVanligAdmin(klubbSlug);

  const epost = String(formData.get("epost") ?? "").trim();
  try {
    await leggTilKlubbAdmin(k.id, epost, "admin");
  } catch (e) {
    tilbake(k.slug, "feil", feilmelding(e));
  }
  tilbake(k.slug, "ok", `${epost} er lagt til som admin og kan logge inn med e-postadressen sin.`);
}
