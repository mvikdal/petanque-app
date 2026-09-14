"use server";

import { prisma } from "@/lib/prisma";
import { erGyldigPoengforskjell } from "@/lib/ranking";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createSerie(formData: FormData) {
  const navn = String(formData.get("navn") ?? "").trim();
  const ukedager = String(formData.get("ukedager") ?? "").trim();
  const sesongStart = String(formData.get("sesongStart") ?? "");
  const poengGrense = Number(formData.get("poengGrense") ?? 13);
  const antallTellendeRunder = Number(formData.get("antallTellendeRunder") ?? 12);

  if (!navn || !sesongStart) {
    throw new Error("Navn og sesongstart er obligatorisk");
  }

  await prisma.serie.create({
    data: {
      navn,
      ukedager,
      sesongStart: new Date(sesongStart),
      poengGrense,
      antallTellendeRunder,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createSpiller(serieId: string, navn: string) {
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
  kamp1: number;
  kamp2: number;
  kamp3: number;
};

export async function createRunde(
  serieId: string,
  dato: string,
  deltakelser: NyDeltakelseInput[]
) {
  const serie = await prisma.serie.findUniqueOrThrow({ where: { id: serieId } });

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
    for (const kamp of [d.kamp1, d.kamp2, d.kamp3]) {
      if (!erGyldigPoengforskjell(kamp, serie.poengGrense)) {
        throw new Error(
          `Ugyldig poengforskjell (${kamp}). Må være et heltall mellom -${serie.poengGrense} og ${serie.poengGrense}, ulik 0.`
        );
      }
    }
  }

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

  revalidatePath(`/serie/${serieId}`);
  redirect(`/serie/${serieId}/runde/${runde.id}`);
}
