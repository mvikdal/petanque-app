"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { byttPassord, leggTilKlubbAdmin } from "@/lib/data/brukere";
import { krevKlubbAdmin, type KlubbKontekst } from "@/lib/klubb-admin";
import { adminKontoUrl } from "@/lib/lenker";

// Kontoen: bytte eget passord og legge til flere admins i klubben.
// Demo-admin (rolle "demo") har ikke lov til noe av dette - innloggingen
// står på /demo/admin/login, og ingen skal kunne låse andre ute eller
// lage nye brukere med den.

async function krevVanligAdmin(klubbSlug: string): Promise<KlubbKontekst> {
  const kontekst = await krevKlubbAdmin(klubbSlug);
  if (kontekst.rolle === "demo") {
    throw new Error("Demo-admin kan ikke endre passord eller opprette brukere.");
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

export async function byttEgetPassord(klubbSlug: string, formData: FormData) {
  const k = await krevVanligAdmin(klubbSlug);

  const nytt = String(formData.get("nytt") ?? "");
  if (nytt !== String(formData.get("gjenta") ?? "")) {
    tilbake(k.slug, "feil", "De to nye passordene er ikke like.");
  }
  try {
    await byttPassord(k.brukerId, String(formData.get("gammelt") ?? ""), nytt);
  } catch (e) {
    tilbake(k.slug, "feil", feilmelding(e));
  }
  tilbake(k.slug, "ok", "Passordet er byttet.");
}

// Klubbadmin kan bare gi vanlig admin-rolle, ikke demo.
export async function leggTilAdmin(klubbSlug: string, formData: FormData) {
  const k = await krevVanligAdmin(klubbSlug);

  const epost = String(formData.get("epost") ?? "").trim();
  let nyBruker: boolean;
  try {
    ({ nyBruker } = await leggTilKlubbAdmin(
      k.id,
      epost,
      String(formData.get("passord") ?? ""),
      "admin"
    ));
  } catch (e) {
    tilbake(k.slug, "feil", feilmelding(e));
  }
  tilbake(
    k.slug,
    "ok",
    nyBruker
      ? `${epost} er lagt til som admin. Gi passordet til personen på en trygg måte.`
      : `${epost} fantes fra før og er lagt til med sitt eksisterende passord.`
  );
}
