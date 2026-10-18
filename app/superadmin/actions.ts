"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MIN_PASSORDLENGDE } from "@/lib/auth/passord";
import type { Rolle } from "@/lib/data/brukere";
import * as data from "@/lib/data/superadmin";
import { krevSuperadmin } from "@/lib/superadmin";

// Hver action sjekker superadmin på nytt på serveren, og melder tilbake via
// URL-en (?ok= eller ?feil=), så siden kan vise resultatet uten klientkode.

function tilbake(type: "ok" | "feil", melding: string): never {
  revalidatePath("/superadmin");
  revalidatePath("/");
  redirect(`/superadmin?${type}=${encodeURIComponent(melding)}`);
}

function feilmelding(e: unknown) {
  return e instanceof Error ? e.message : "Noe gikk galt.";
}

function lesRolle(formData: FormData): Rolle {
  return formData.get("rolle") === "demo" ? "demo" : "admin";
}

export async function opprettKlubbMedAdmin(formData: FormData) {
  await krevSuperadmin();

  const navn = String(formData.get("navn") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const epost = String(formData.get("epost") ?? "").trim();
  const passord = String(formData.get("passord") ?? "");

  // Passordkravet sjekkes før klubben opprettes, så vi ikke står igjen med
  // en klubb uten admin på grunn av et for kort passord.
  if (passord.length < MIN_PASSORDLENGDE) {
    tilbake("feil", `Passordet må ha minst ${MIN_PASSORDLENGDE} tegn.`);
  }

  // redirect() kaster internt, så tilbake() kalles alltid utenfor try/catch.
  let klubbId: string;
  try {
    klubbId = (await data.opprettKlubb(navn, slug)).id;
  } catch (e) {
    tilbake("feil", feilmelding(e));
  }

  let nyBruker: boolean;
  try {
    ({ nyBruker } = await data.leggTilKlubbAdmin(klubbId, epost, passord, "admin"));
  } catch (e) {
    tilbake(
      "feil",
      `Klubben ${navn} er opprettet, men admin ble ikke lagt til: ${feilmelding(e)}`
    );
  }
  tilbake(
    "ok",
    nyBruker
      ? `Klubben ${navn} er opprettet med ${epost} som admin.`
      : `Klubben ${navn} er opprettet. ${epost} fantes fra før og er lagt til som admin med sitt eksisterende passord.`
  );
}

export async function leggTilAdmin(klubbId: string, formData: FormData) {
  await krevSuperadmin();

  const epost = String(formData.get("epost") ?? "").trim();
  let melding: string;
  try {
    const { nyBruker } = await data.leggTilKlubbAdmin(
      klubbId,
      epost,
      String(formData.get("passord") ?? ""),
      lesRolle(formData)
    );
    melding = nyBruker
      ? `${epost} er lagt til som admin.`
      : `${epost} fantes fra før og er lagt til med sitt eksisterende passord.`;
  } catch (e) {
    tilbake("feil", feilmelding(e));
  }
  tilbake("ok", melding);
}

export async function tilbakestillPassord(brukerId: string, formData: FormData) {
  await krevSuperadmin();

  let epost: string;
  try {
    epost = await data.tilbakestillPassord(brukerId, String(formData.get("passord") ?? ""));
  } catch (e) {
    tilbake("feil", feilmelding(e));
  }
  tilbake("ok", `Nytt passord er satt for ${epost}. Gi det til brukeren på en trygg måte.`);
}
