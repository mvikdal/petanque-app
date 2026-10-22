"use server";

import { harBildetolkning, krevKlubbAdmin } from "@/lib/klubb-admin";
import * as data from "@/lib/data/serier";
import type { NyDeltakelseInput } from "@/lib/data/serier";
import { matchSpillere } from "@/lib/navnematch";
import {
  kamperFraRad,
  kontrollerRad,
  lesResultatark,
  tolkDato,
  type TolketArk,
  type TolketRad,
} from "@/lib/resultatark";
import {
  adminRunderUrl,
  adminUrl,
  klubbUrl,
  rundeUrl,
  serieUrl,
} from "@/lib/lenker";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Hver action tar klubbens slug og slår opp klubben via krevKlubbAdmin,
// som også sjekker tilgangen. All datatilgang går via lib/data, som
// filtrerer på klubbId - en id fra en annen klubb gir feil, ikke data.

export async function createSerie(klubbSlug: string, formData: FormData) {
  const klubb = await krevKlubbAdmin(klubbSlug);

  const navn = String(formData.get("navn") ?? "").trim();
  const ukedager = String(formData.get("ukedager") ?? "").trim();
  const sesongStart = String(formData.get("sesongStart") ?? "");
  const poengGrense = Number(formData.get("poengGrense") ?? 13);
  const antallTellendeRunder = Number(formData.get("antallTellendeRunder") ?? 12);

  if (!navn || !sesongStart) {
    throw new Error("Navn og sesongstart er obligatorisk");
  }

  await data.opprettSerie(klubb.id, {
    navn,
    ukedager,
    sesongStart: new Date(sesongStart),
    poengGrense,
    antallTellendeRunder,
  });

  revalidatePath(adminUrl(klubb.slug));
  revalidatePath(klubbUrl(klubb.slug));
}

// Redigering av en eksisterende serie (lagt til 2026-10-14). Poenggrensen
// kan ikke endres her, siden allerede lagrede resultater er validert mot den.
// Endret antall tellende runder slår straks inn i sesongtabellen, fordi
// rangeringen alltid beregnes på nytt fra rundene.
export async function updateSerie(klubbSlug: string, serieId: string, formData: FormData) {
  const klubb = await krevKlubbAdmin(klubbSlug);

  const navn = String(formData.get("navn") ?? "").trim();
  const ukedager = String(formData.get("ukedager") ?? "").trim();
  const antallTellendeRunder = Number(formData.get("antallTellendeRunder"));
  const status = String(formData.get("status") ?? "");

  if (!navn) {
    throw new Error("Navn er obligatorisk");
  }
  if (!Number.isInteger(antallTellendeRunder) || antallTellendeRunder < 1) {
    throw new Error("Tellende runder må være et heltall på minst 1");
  }
  if (status !== "aktiv" && status !== "avsluttet") {
    throw new Error("Ugyldig status");
  }

  await data.oppdaterSerie(klubb.id, serieId, { navn, ukedager, antallTellendeRunder, status });

  revalidatePath(adminUrl(klubb.slug));
  revalidatePath(klubbUrl(klubb.slug));
  revalidatePath(serieUrl(klubb.slug, serieId));
  redirect(adminUrl(klubb.slug));
}

export async function createSpiller(klubbSlug: string, serieId: string, navn: string) {
  const klubb = await krevKlubbAdmin(klubbSlug);

  const trimmet = navn.trim();
  if (!trimmet) {
    throw new Error("Navn kan ikke være tomt");
  }
  return data.opprettSpiller(klubb.id, serieId, trimmet);
}

export async function sorterRunderEtterDato(klubbSlug: string, serieId: string) {
  const klubb = await krevKlubbAdmin(klubbSlug);

  await data.sorterRunderEtterDato(klubb.id, serieId);

  revalidatePath(serieUrl(klubb.slug, serieId));
  revalidatePath(klubbUrl(klubb.slug));
  revalidatePath(adminUrl(klubb.slug));
  revalidatePath(adminRunderUrl(klubb.slug, serieId));
}

export async function createRunde(
  klubbSlug: string,
  serieId: string,
  dato: string,
  deltakelser: NyDeltakelseInput[]
) {
  const klubb = await krevKlubbAdmin(klubbSlug);

  const runde = await data.opprettRunde(klubb.id, serieId, new Date(dato), deltakelser);

  revalidatePath(serieUrl(klubb.slug, serieId));
  revalidatePath(klubbUrl(klubb.slug));
  revalidatePath(adminUrl(klubb.slug));
  revalidatePath(adminRunderUrl(klubb.slug, serieId));
  redirect(rundeUrl(klubb.slug, serieId, runde.id));
}

export async function updateRunde(
  klubbSlug: string,
  rundeId: string,
  dato: string,
  deltakelser: NyDeltakelseInput[],
  kommentar: string
) {
  const klubb = await krevKlubbAdmin(klubbSlug);

  const runde = await data.oppdaterRunde(
    klubb.id,
    rundeId,
    new Date(dato),
    deltakelser,
    kommentar
  );

  revalidatePath(serieUrl(klubb.slug, runde.serieId));
  revalidatePath(rundeUrl(klubb.slug, runde.serieId, rundeId));
  revalidatePath(adminRunderUrl(klubb.slug, runde.serieId));
  redirect(rundeUrl(klubb.slug, runde.serieId, rundeId));
}

const ARKTYPER = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAKS_ARKSTØRRELSE = 4 * 1024 * 1024;

// Leser et bilde eller en PDF av resultatarket og foreslår utfylling av
// rundeskjemaet. Lagrer ingenting - admin kontrollerer og lagrer selv.
// Feil i selve tolkningen returneres som { feil }, siden Next skjuler
// meldingen i feil som kastes fra server actions i produksjon.
export async function tolkResultatark(
  klubbSlug: string,
  serieId: string,
  formData: FormData
): Promise<TolketArk | { feil: string }> {
  const klubb = await krevKlubbAdmin(klubbSlug);
  const serie = await data.hentSerie(klubb.id, serieId);
  if (!serie) throw new Error("Serien finnes ikke i denne klubben.");
  if (!harBildetolkning(klubb)) return { feil: "Innlesing fra bilde er ikke tilgjengelig i demo." };

  const fil = formData.get("fil");
  if (!(fil instanceof File) || fil.size === 0) return { feil: "Velg et bilde eller en PDF." };
  if (!ARKTYPER.includes(fil.type)) {
    return { feil: "Filtypen støttes ikke. Bruk JPG, PNG, WEBP, HEIC eller PDF." };
  }
  if (fil.size > MAKS_ARKSTØRRELSE) return { feil: "Filen er for stor (maks 4 MB)." };

  const spillere = await data.listSpillere(klubb.id, serieId);
  let ark;
  try {
    ark = await lesResultatark({
      fil: new Uint8Array(await fil.arrayBuffer()),
      mediaType: fil.type,
      spillernavn: spillere.map((s) => s.navn),
      poengGrense: serie.poengGrense,
    });
  } catch (e) {
    console.error("Tolking av resultatark feilet", e);
    return { feil: "Klarte ikke å tolke arket. Prøv et skarpere bilde, eller fyll ut for hånd." };
  }

  const treff = matchSpillere(
    ark.rader.map((r) => r.navnPaaArk),
    spillere
  );
  return {
    dato: tolkDato(ark.datoTekst, serie.sesongStart, serie.sesongSlutt),
    datoTekst: ark.datoTekst,
    merknad: ark.merknad,
    rader: ark.rader.map((rad, i) => ({
      navnPaaArk: rad.navnPaaArk,
      spillerId: treff[i].spillerId,
      sikkerhet: treff[i].sikkerhet,
      kamper: kamperFraRad(rad).map((k) => k.forskjell) as TolketRad["kamper"],
      usikkert: rad.usikkert,
      advarsler: kontrollerRad(rad, serie.poengGrense),
    })),
  };
}
