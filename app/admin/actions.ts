"use server";

import { assertAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { erGyldigPoengforskjell } from "@/lib/ranking";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createSerie(formData: FormData) {
  await assertAdmin();

  const navn = String(formData.get("navn") ?? "").trim();
  const klubbId = String(formData.get("klubbId") ?? "");
  const ukedager = String(formData.get("ukedager") ?? "").trim();
  const sesongStart = String(formData.get("sesongStart") ?? "");
  const poengGrense = Number(formData.get("poengGrense") ?? 13);
  const antallTellendeRunder = Number(formData.get("antallTellendeRunder") ?? 12);

  if (!navn || !klubbId || !sesongStart) {
    throw new Error("Navn, klubb og sesongstart er obligatorisk");
  }

  await prisma.serie.create({
    data: {
      navn,
      klubbId,
      ukedager,
      sesongStart: new Date(sesongStart),
      poengGrense,
      antallTellendeRunder,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

// Redigering av en eksisterende serie (lagt til 2026-10-14). Poenggrensen
// kan ikke endres her, siden allerede lagrede resultater er validert mot den.
// Endret antall tellende runder slår straks inn i sesongtabellen, fordi
// rangeringen alltid beregnes på nytt fra rundene.
export async function updateSerie(serieId: string, formData: FormData) {
  await assertAdmin();

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

  await prisma.serie.update({
    where: { id: serieId },
    data: { navn, ukedager, antallTellendeRunder, status },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/serie/${serieId}`);
  redirect("/admin");
}

// Klubb-administrasjon (lagt til 2026-10-13) - egen seksjon under /admin,
// men låst med samme admin-passord (avklart samme dag). Toppnivå-inndeling
// over serier; foreløpig kun én klubb, men flere skal kunne opprettes.
export async function createKlubb(formData: FormData) {
  await assertAdmin();

  const navn = String(formData.get("navn") ?? "").trim();
  if (!navn) {
    throw new Error("Navn er obligatorisk");
  }

  const finnesAllerede = await prisma.klubb.findUnique({ where: { navn } });
  if (finnesAllerede) {
    throw new Error(`Klubben "${navn}" finnes allerede.`);
  }

  await prisma.klubb.create({ data: { navn } });

  revalidatePath("/admin/klubber");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createSpiller(serieId: string, navn: string) {
  await assertAdmin();

  const trimmet = navn.trim();
  if (!trimmet) {
    throw new Error("Navn kan ikke være tomt");
  }

  const eksisterende = await prisma.spiller.findMany({ where: { serieId } });
  const finnesAllerede = eksisterende.some(
    (s) => s.navn.toLowerCase() === trimmet.toLowerCase()
  );
  if (finnesAllerede) {
    throw new Error(`"${trimmet}" er allerede registrert i denne serien.`);
  }

  const spiller = await prisma.spiller.create({ data: { navn: trimmet, serieId } });
  return spiller;
}

export type NyDeltakelseInput = {
  spillerId: string;
  kamp1: number | null;
  kamp2: number | null;
  kamp3: number | null;
};

async function validerDeltakelser(
  serieId: string,
  poengGrense: number,
  deltakelser: NyDeltakelseInput[]
) {
  if (deltakelser.length === 0) {
    throw new Error("Minst én spiller må delta i runden");
  }

  const antallSpillereISerie = await prisma.spiller.count({
    where: { serieId, id: { in: deltakelser.map((d) => d.spillerId) } },
  });
  if (antallSpillereISerie !== deltakelser.length) {
    throw new Error("En eller flere spillere hører ikke til denne serien.");
  }

  for (const d of deltakelser) {
    const kamper = [d.kamp1, d.kamp2, d.kamp3];
    if (kamper.every((k) => k === null)) {
      throw new Error("En spiller kan ikke registreres uten resultat for minst én kamp.");
    }
    for (const kamp of kamper) {
      if (kamp !== null && !erGyldigPoengforskjell(kamp, poengGrense)) {
        throw new Error(
          `Ugyldig poengforskjell (${kamp}). Må være et heltall mellom -${poengGrense} og ${poengGrense}, ulik 0.`
        );
      }
    }
  }
}

// Rundenummer skal alltid følge datoen (avklart 2026-10-15): eldste runde
// er runde 1. Ved samme dato beholdes den eksisterende innbyrdes rekkefølgen.
// Gjøres i to steg via negative midlertidige numre, fordi (serieId,
// rundenummer) er unik og to runder ellers kan kollidere underveis.
async function renummererRunderEtterDato(serieId: string) {
  const runder = await prisma.runde.findMany({
    where: { serieId },
    orderBy: [{ dato: "asc" }, { rundenummer: "asc" }],
    select: { id: true, rundenummer: true },
  });
  const endres = runder
    .map((r, i) => ({ id: r.id, fra: r.rundenummer, til: i + 1 }))
    .filter((r) => r.fra !== r.til);
  if (endres.length === 0) return;

  await prisma.$transaction([
    ...endres.map((r) =>
      prisma.runde.update({ where: { id: r.id }, data: { rundenummer: -r.til } })
    ),
    ...endres.map((r) =>
      prisma.runde.update({ where: { id: r.id }, data: { rundenummer: r.til } })
    ),
  ]);
}

// Engangsretting fra admin for serier der rundenummer og dato har kommet
// i utakt (f.eks. Demo-serie og Lillekula, rettet 2026-10-15).
export async function sorterRunderEtterDato(serieId: string) {
  await assertAdmin();

  await renummererRunderEtterDato(serieId);

  revalidatePath(`/serie/${serieId}`);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/admin/serie/${serieId}/runder`);
}

export async function createRunde(
  serieId: string,
  dato: string,
  deltakelser: NyDeltakelseInput[]
) {
  await assertAdmin();

  const serie = await prisma.serie.findUniqueOrThrow({ where: { id: serieId } });

  await validerDeltakelser(serieId, serie.poengGrense, deltakelser);

  const siste = await prisma.runde.findFirst({
    where: { serieId },
    orderBy: { rundenummer: "desc" },
  });
  const rundenummer = (siste?.rundenummer ?? 0) + 1;

  const runde = await prisma.runde.create({
    data: {
      serieId,
      dato: new Date(dato),
      rundenummer,
      deltakelser: {
        create: deltakelser.map((d) => ({
          spillerId: d.spillerId,
          kamp1: d.kamp1,
          kamp2: d.kamp2,
          kamp3: d.kamp3,
        })),
      },
    },
  });

  // En runde kan registreres med en dato før tidligere runder.
  await renummererRunderEtterDato(serieId);

  revalidatePath(`/serie/${serieId}`);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/admin/serie/${serieId}/runder`);
  redirect(`/serie/${serieId}/runde/${runde.id}`);
}

// Admin-mulighet for å rette en allerede lagret runde (§ ny avklaring
// 2026-09-14) - kan gjøres på en hvilken som helst runde, uansett alder.
// Hver retting logges i RundeEndring med tidspunkt, valgfri kommentar, og
// en snapshot av deltakelsene slik de var før rettingen.
export async function updateRunde(
  rundeId: string,
  dato: string,
  deltakelser: NyDeltakelseInput[],
  kommentar: string
) {
  await assertAdmin();

  const runde = await prisma.runde.findUniqueOrThrow({
    where: { id: rundeId },
    include: { serie: true, deltakelser: { include: { spiller: true } } },
  });

  await validerDeltakelser(runde.serieId, runde.serie.poengGrense, deltakelser);

  const forrigeData = JSON.stringify(
    runde.deltakelser.map((d) => ({
      spillerNavn: d.spiller.navn,
      kamp1: d.kamp1,
      kamp2: d.kamp2,
      kamp3: d.kamp3,
    }))
  );

  await prisma.$transaction([
    prisma.deltakelse.deleteMany({ where: { rundeId } }),
    prisma.runde.update({
      where: { id: rundeId },
      data: {
        dato: new Date(dato),
        deltakelser: {
          create: deltakelser.map((d) => ({
            spillerId: d.spillerId,
            kamp1: d.kamp1,
            kamp2: d.kamp2,
            kamp3: d.kamp3,
          })),
        },
      },
    }),
    prisma.rundeEndring.create({
      data: {
        rundeId,
        kommentar: kommentar.trim() || null,
        forrigeData,
      },
    }),
  ]);

  // En rettet dato kan flytte runden i rekkefølgen.
  await renummererRunderEtterDato(runde.serieId);

  revalidatePath(`/serie/${runde.serieId}`);
  revalidatePath(`/serie/${runde.serieId}/runde/${rundeId}`);
  revalidatePath(`/admin/serie/${runde.serieId}/runder`);
  redirect(`/serie/${runde.serieId}/runde/${rundeId}`);
}
