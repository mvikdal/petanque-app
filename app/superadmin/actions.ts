"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  // redirect() kaster internt, så tilbake() kalles alltid utenfor try/catch.
  let klubbId: string;
  try {
    klubbId = (await data.opprettKlubb(navn, slug)).id;
  } catch (e) {
    tilbake("feil", feilmelding(e));
  }

  try {
    await data.leggTilKlubbAdmin(klubbId, epost, "admin");
  } catch (e) {
    tilbake(
      "feil",
      `Klubben ${navn} er opprettet, men admin ble ikke lagt til: ${feilmelding(e)}`
    );
  }
  tilbake("ok", `Klubben ${navn} er opprettet med ${epost} som admin.`);
}

export async function leggTilAdmin(klubbId: string, formData: FormData) {
  await krevSuperadmin();

  const epost = String(formData.get("epost") ?? "").trim();
  try {
    await data.leggTilKlubbAdmin(klubbId, epost, lesRolle(formData));
  } catch (e) {
    tilbake("feil", feilmelding(e));
  }
  tilbake("ok", `${epost} er lagt til og kan logge inn med e-postadressen sin.`);
}
